import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

export function isReplitEnvironment(): boolean {
  return !!(process.env.REPL_ID && process.env.REPLIT_DOMAINS);
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isReplit = isReplitEnvironment();
  
  let sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (isDevelopment) {
      console.warn('⚠️ SESSION_SECRET not set - using development fallback (NOT for production)');
      sessionSecret = 'dev-only-secret-not-for-production';
    } else {
      throw new Error('SESSION_SECRET environment variable is required in production');
    }
  }
  
  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction || isReplit,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

function isEmailAllowed(email: string): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  const allowedEmails = process.env.ALLOWED_EMAILS || '';
  
  if (!allowedEmails.trim()) {
    return true;
  }
  
  const emailList = allowedEmails.split(',').map(e => e.trim().toLowerCase());
  return emailList.includes(email.toLowerCase());
}

async function upsertUser(
  claims: any,
) {
  try {
    await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      console.warn('User upsert failed due to unique constraint, continuing with existing user:', error.detail);
      return;
    }
    throw error;
  }
}

export async function setupAuth(app: Express) {
  const authMode = isReplitEnvironment() ? 'REPLIT' : 'NON-REPLIT';
  console.log(`🔐 Auth mode: ${authMode}`);
  
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  if (!isReplitEnvironment()) {
    console.log('   Replit authentication disabled - routes accessible without auth');
    console.log('   To enable auth, ensure REPL_ID and REPLIT_DOMAINS are set');
    
    app.get("/api/login", (req, res) => {
      res.status(503).json({ 
        message: "Authentication not available in this environment",
        hint: "Replit authentication is only available when running on Replit"
      });
    });

    app.get("/api/callback", (req, res) => {
      res.redirect("/");
    });

    app.get("/api/logout", (req, res) => {
      req.logout(() => {
        res.redirect("/");
      });
    });
    
    return;
  }

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = tokens.claims();
    if (!claims) {
      return verified(new Error('No claims found in token'));
    }
    
    const email = claims.email;
    if (!email || typeof email !== 'string') {
      return verified(new Error('No email found in claims'));
    }
    
    if (!isEmailAllowed(email)) {
      console.warn(`Login attempt blocked for unauthorized email: ${email}`);
      return verified(new Error('Access denied: Your email address is not authorized to access this application.'));
    }
    
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(claims);
    verified(null, user);
  };

  const domains = process.env.REPLIT_DOMAINS!.split(",");
  
  if (process.env.NODE_ENV === 'development') {
    domains.push('localhost');
  }
  
  for (const domain of domains) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/cases",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Check if isAuthenticated function exists (passport might not be fully configured in non-Replit)
  const isAuth = typeof req.isAuthenticated === 'function' && req.isAuthenticated();
  
  if (!isAuth || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;

  // In non-Replit environments, skip token refresh logic (no OIDC tokens)
  if (!isReplitEnvironment()) {
    return next();
  }

  // Replit OIDC token refresh logic
  if (!user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
