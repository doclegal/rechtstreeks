import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";

// Validate and sanitize SUPABASE_URL
function validateSupabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error("FATAL: Missing SUPABASE_URL environment variable");
  }

  const trimmedUrl = url.trim();
  if (trimmedUrl !== url) {
    console.warn("⚠️ SUPABASE_URL had trailing/leading whitespace - trimmed automatically");
  }

  if (!trimmedUrl.startsWith("https://")) {
    throw new Error(
      `FATAL: SUPABASE_URL must start with https://. ` +
      `Current: ${trimmedUrl.substring(0, 20)}... ` +
      `Correct format: https://<project>.supabase.co`
    );
  }

  if (trimmedUrl.startsWith("https://db.")) {
    throw new Error(
      `FATAL: SUPABASE_URL should be the API URL, not the database URL. ` +
      `Use https://<project>.supabase.co (from Settings → API), not https://db.<project>.supabase.co`
    );
  }

  if (trimmedUrl.includes("/v2") || trimmedUrl.includes("/v1")) {
    throw new Error(
      `FATAL: SUPABASE_URL should not include path segments like /v2 or /v1. ` +
      `Correct format: https://<project>.supabase.co (base URL only)`
    );
  }

  if (trimmedUrl.includes("wss://") || trimmedUrl.includes("ws://")) {
    throw new Error(
      `FATAL: SUPABASE_URL must be an HTTPS URL, not WebSocket. ` +
      `Correct format: https://<project>.supabase.co`
    );
  }

  return trimmedUrl;
}

const supabaseUrl = validateSupabaseUrl(process.env.SUPABASE_URL);
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseServiceKey) {
  throw new Error(
    "FATAL: Missing SUPABASE_SECRET_KEY environment variable. " +
    "The server requires the service role key (not anon key) for admin operations."
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "FATAL: Missing SUPABASE_ANON_KEY environment variable. " +
    "The anon key is required for user-scoped Supabase clients with RLS."
  );
}

console.log(`🔗 Supabase URL: ${supabaseUrl.replace(/^(https:\/\/[^.]+).*/, "$1.supabase.co")}`);

/**
 * @deprecated Use createUserClient() for user data access
 * 
 * Admin client with service role - ONLY use for:
 * - Auth admin operations (create user, reset password)
 * - Schema migrations
 * - System-level operations
 * 
 * NEVER use for reading/writing user data (bypasses RLS)
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 0,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'rechtstreeks-server-admin',
    },
  },
});

supabase.realtime.disconnect();

/**
 * Alias for clarity - admin client with service role
 */
export const supabaseAdmin = supabase;

/**
 * Create a user-scoped Supabase client for RLS-protected operations
 * 
 * Uses the user's access token so RLS policies like:
 *   owner_user_id = auth.uid()
 * work correctly.
 * 
 * @param accessToken - The user's Supabase access token (JWT)
 * @returns A Supabase client that operates with the user's identity
 */
export function createUserClient(accessToken: string): SupabaseClient {
  // SUPABASE_ANON_KEY is now required at startup, so this should always work
  return createClient(supabaseUrl, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 0,
      },
    },
    global: {
      headers: {
        'X-Client-Info': 'rechtstreeks-server-user',
        'Authorization': `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Get user-scoped Supabase client from Express request
 * 
 * Extracts the access token from the request (set by isAuthenticated middleware)
 * and creates a user-scoped client.
 * 
 * @param req - Express request (must have passed isAuthenticated middleware)
 * @returns A Supabase client with user's identity, or null if no token available
 */
export function getUserClientFromRequest(req: Request): SupabaseClient | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    return createUserClient(token);
  }
  
  // Fallback: check session for access token
  const sessionUser = (req.session as any)?.supabaseUser;
  if (sessionUser?.accessToken) {
    return createUserClient(sessionUser.accessToken);
  }
  
  return null;
}

/**
 * Get user-scoped Supabase client from request, with fallback to admin
 * 
 * WARNING: Only use this during migration. After RLS is enabled,
 * admin fallback will not have correct user context.
 * @deprecated Use requireUserClient for user-facing routes
 */
export function getUserClientFromRequestOrAdmin(req: Request): SupabaseClient {
  const userClient = getUserClientFromRequest(req);
  if (userClient) {
    return userClient;
  }
  console.warn("⚠️ No user token available - using admin client (RLS bypassed!)");
  return supabase;
}

/**
 * Get user-scoped Supabase client from request - STRICT VERSION
 * 
 * Throws an error if no valid token is available.
 * Use this for user-facing routes where RLS must be enforced.
 * 
 * @param req - Express request (must have passed isAuthenticated middleware)
 * @returns A Supabase client with user's identity
 * @throws Error if no token available
 */
export function requireUserClient(req: Request): SupabaseClient {
  const userClient = getUserClientFromRequest(req);
  if (!userClient) {
    throw new Error("No authentication token available for user-scoped database access");
  }
  return userClient;
}
