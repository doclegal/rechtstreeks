import { createClient, SupabaseClient } from "@supabase/supabase-js";
import session from "express-session";
import type { Express, RequestHandler, Request, Response, NextFunction } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { createUserClient } from "./supabaseClient";

// Validate and sanitize SUPABASE_URL
function validateSupabaseUrl(url: string | undefined): string {
  if (!url) {
    console.error("FATAL: Missing SUPABASE_URL environment variable");
    process.exit(1);
  }

  const trimmedUrl = url.trim();
  if (trimmedUrl !== url) {
    console.warn("⚠️ SUPABASE_URL had trailing/leading whitespace - trimmed");
  }

  if (!trimmedUrl.startsWith("https://")) {
    console.error(
      `FATAL: SUPABASE_URL must start with https://. ` +
      `Current starts with: ${trimmedUrl.substring(0, 10)}... ` +
      `Correct format: https://<project>.supabase.co`
    );
    process.exit(1);
  }

  if (trimmedUrl.startsWith("https://db.")) {
    console.error(
      `FATAL: SUPABASE_URL is the database URL, not the API URL. ` +
      `Use https://<project>.supabase.co (from Settings → API)`
    );
    process.exit(1);
  }

  if (trimmedUrl.includes("/v2") || trimmedUrl.includes("/v1")) {
    console.error(
      `FATAL: SUPABASE_URL should not include /v2 or /v1 paths. ` +
      `Correct format: https://<project>.supabase.co`
    );
    process.exit(1);
  }

  return trimmedUrl;
}

const supabaseUrl = validateSupabaseUrl(process.env.SUPABASE_URL);
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseServiceKey) {
  console.error(
    "FATAL: Missing SUPABASE_SECRET_KEY environment variable. " +
    "Server requires service role key for auth admin operations."
  );
  process.exit(1);
}

// Log validated config (safe - no secrets)
const maskedUrl = supabaseUrl.replace(/^(https:\/\/[^.]+).*/, "$1.***");
console.log(`🔐 Supabase Auth URL: ${maskedUrl}`);

// Create Supabase admin client - NO realtime, NO WebSocket
// Auth operations use REST API only (/auth/v1/*)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    flowType: 'implicit',
  },
  realtime: {
    params: {
      eventsPerSecond: 0,
    },
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'rechtstreeks-server-auth',
    },
  },
});

// Explicitly disconnect realtime to prevent any WebSocket connections
supabaseAdmin.realtime.disconnect();

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const isProduction = process.env.NODE_ENV === "production";

  let sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (process.env.NODE_ENV === "development") {
      console.warn("⚠️ SESSION_SECRET not set - using development fallback");
      sessionSecret = "dev-only-secret-not-for-production";
    } else {
      throw new Error("SESSION_SECRET environment variable is required in production");
    }
  }

  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      maxAge: sessionTtl,
      sameSite: isProduction ? "strict" : "lax",
    },
  });
}

async function upsertSupabaseUser(supabaseUser: any) {
  try {
    await storage.upsertUser({
      id: supabaseUser.id,
      email: supabaseUser.email,
      firstName: supabaseUser.user_metadata?.first_name || supabaseUser.user_metadata?.full_name?.split(" ")[0] || null,
      lastName: supabaseUser.user_metadata?.last_name || supabaseUser.user_metadata?.full_name?.split(" ").slice(1).join(" ") || null,
      profileImageUrl: supabaseUser.user_metadata?.avatar_url || null,
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      console.warn("User upsert failed due to unique constraint, continuing with existing user");
      return;
    }
    throw error;
  }
}

export async function setupSupabaseAuth(app: Express) {
  console.log("🔐 Auth mode: SUPABASE");

  app.set("trust proxy", 1);
  app.use(getSession());

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email en wachtwoord zijn verplicht" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Wachtwoord moet minimaal 6 tekens zijn" });
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

      if (error) {
        console.error("Supabase signup error:", error);
        if (error.message.includes("already registered")) {
          return res.status(409).json({ message: "Dit e-mailadres is al in gebruik" });
        }
        return res.status(400).json({ message: error.message });
      }

      if (data.user) {
        await upsertSupabaseUser(data.user);
      }

      res.json({ success: true, message: "Account aangemaakt. Je kunt nu inloggen." });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Fout bij registratie" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email en wachtwoord zijn verplicht" });
      }

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Supabase login error:", error);
        return res.status(401).json({ message: "Ongeldige inloggegevens" });
      }

      if (!data.user || !data.session) {
        return res.status(401).json({ message: "Inloggen mislukt" });
      }

      await upsertSupabaseUser(data.user);

      (req.session as any).supabaseUser = {
        id: data.user.id,
        email: data.user.email,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      };

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Sessie fout" });
        }
        res.json({
          success: true,
          user: {
            id: data.user.id,
            email: data.user.email,
          },
          accessToken: data.session.access_token,
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Fout bij inloggen" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    (req.session as any).supabaseUser = null;
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/session", async (req: Request, res: Response) => {
    const sessionUser = (req.session as any)?.supabaseUser;

    if (!sessionUser) {
      return res.json({ user: null });
    }

    const now = Math.floor(Date.now() / 1000);
    if (sessionUser.expiresAt && now > sessionUser.expiresAt - 60) {
      try {
        const { data, error } = await supabaseAdmin.auth.refreshSession({
          refresh_token: sessionUser.refreshToken,
        });

        if (error || !data.session) {
          (req.session as any).supabaseUser = null;
          return res.json({ user: null });
        }

        (req.session as any).supabaseUser = {
          id: data.user!.id,
          email: data.user!.email,
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
        };
      } catch (error) {
        console.error("Token refresh error:", error);
        return res.json({ user: null });
      }
    }

    const user = await storage.getUser(sessionUser.id);
    
    // If user not found in database, return session data as fallback
    if (!user) {
      return res.json({ 
        user: {
          id: sessionUser.id,
          email: sessionUser.email,
        }
      });
    }
    
    res.json({ user });
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is verplicht" });
      }

      const redirectTo = process.env.PUBLIC_URL
        ? `${process.env.PUBLIC_URL}/reset-password`
        : `${req.protocol}://${req.get("host")}/reset-password`;

      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        console.error("Password reset error:", error);
      }

      res.json({ success: true, message: "Als dit e-mailadres bij ons bekend is, ontvang je een reset link." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Fout bij wachtwoord reset" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { accessToken, password } = req.body;

      if (!accessToken || !password) {
        return res.status(400).json({ message: "Token en wachtwoord zijn verplicht" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Wachtwoord moet minimaal 6 tekens zijn" });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(accessToken, {
        password,
      });

      if (error) {
        console.error("Password update error:", error);
        return res.status(400).json({ message: "Wachtwoord reset mislukt" });
      }

      res.json({ success: true, message: "Wachtwoord succesvol gewijzigd" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Fout bij wachtwoord reset" });
    }
  });
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim();
}

/**
 * Verify Supabase JWT and return user data
 * Uses supabaseAdmin.auth.getUser() which validates the token server-side
 */
async function verifySupabaseToken(accessToken: string): Promise<{ id: string; email: string } | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    
    if (error || !data.user) {
      console.warn("Token verification failed:", error?.message || "No user data");
      return null;
    }
    
    return {
      id: data.user.id,
      email: data.user.email || "",
    };
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

/**
 * Authentication middleware - verifies Supabase JWT
 * 
 * Priority:
 * 1. Authorization: Bearer <access_token> header (verified server-side)
 * 2. Session with valid access token (verified server-side, refreshed if needed)
 * 
 * IMPORTANT: We never trust session data as identity - always verify with Supabase
 */
export const isAuthenticated: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Priority 1: Check Authorization header
  const bearerToken = extractBearerToken(req);
  
  if (bearerToken) {
    const verifiedUser = await verifySupabaseToken(bearerToken);
    
    if (verifiedUser) {
      (req as any).user = verifiedUser;
      (req as any).authMode = "bearer";
      // Attach user-scoped Supabase client for RLS-protected operations
      (req as any).supabaseClient = createUserClient(bearerToken);
      return next();
    }
    
    // Bearer token provided but invalid
    return res.status(401).json({ 
      message: "Invalid or expired token",
      code: "INVALID_TOKEN"
    });
  }
  
  // Priority 2: Check session (for backward compatibility during migration)
  const sessionUser = (req.session as any)?.supabaseUser;
  
  if (!sessionUser || !sessionUser.accessToken) {
    return res.status(401).json({ 
      message: "Unauthorized",
      code: "NO_AUTH"
    });
  }
  
  // Refresh token if expired
  const now = Math.floor(Date.now() / 1000);
  if (sessionUser.expiresAt && now > sessionUser.expiresAt - 60) {
    try {
      const { data, error } = await supabaseAdmin.auth.refreshSession({
        refresh_token: sessionUser.refreshToken,
      });

      if (error || !data.session) {
        (req.session as any).supabaseUser = null;
        return res.status(401).json({ 
          message: "Session expired - please login again",
          code: "SESSION_EXPIRED"
        });
      }

      (req.session as any).supabaseUser = {
        id: data.user!.id,
        email: data.user!.email,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      };
      
      // Use the new access token
      sessionUser.accessToken = data.session.access_token;
    } catch (error) {
      console.error("Token refresh error:", error);
      return res.status(401).json({ 
        message: "Session expired",
        code: "REFRESH_FAILED"
      });
    }
  }
  
  // IMPORTANT: Verify the session's access token server-side (don't trust session data)
  const verifiedUser = await verifySupabaseToken(sessionUser.accessToken);
  
  if (!verifiedUser) {
    (req.session as any).supabaseUser = null;
    return res.status(401).json({ 
      message: "Session invalid - please login again",
      code: "SESSION_INVALID"
    });
  }
  
  (req as any).user = verifiedUser;
  (req as any).authMode = "session";
  // Attach user-scoped Supabase client for RLS-protected operations
  (req as any).supabaseClient = createUserClient(sessionUser.accessToken);
  
  next();
};

/**
 * Get the verified Supabase user ID from request
 * Only returns the ID if the user was verified via isAuthenticated middleware
 */
export function getSupabaseUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id || null;
}

/**
 * Get auth mode (bearer or session)
 */
export function getAuthMode(req: Request): string {
  return (req as any).authMode || "none";
}

/**
 * Get the user's access token from request
 * Used for creating user-scoped Supabase clients
 */
export function getUserAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  
  const sessionUser = (req.session as any)?.supabaseUser;
  return sessionUser?.accessToken || null;
}

/**
 * Get the user-scoped Supabase client from request
 * This is attached by isAuthenticated middleware
 * 
 * @param req Express request (must have passed isAuthenticated)
 * @returns SupabaseClient with user identity
 * @throws Error if no client available (should not happen after isAuthenticated)
 */
export function getRequestClient(req: Request): import("@supabase/supabase-js").SupabaseClient {
  const client = (req as any).supabaseClient;
  if (!client) {
    throw new Error("No Supabase client on request. This should not happen after isAuthenticated middleware.");
  }
  return client;
}

/**
 * Export verifySupabaseToken for use in other modules
 */
export { verifySupabaseToken, extractBearerToken };
