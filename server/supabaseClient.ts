import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Validate and sanitize SUPABASE_URL
function validateSupabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error("FATAL: Missing SUPABASE_URL environment variable");
  }

  // Trim whitespace
  const trimmedUrl = url.trim();
  if (trimmedUrl !== url) {
    console.warn("⚠️ SUPABASE_URL had trailing/leading whitespace - trimmed automatically");
  }

  // Must start with https://
  if (!trimmedUrl.startsWith("https://")) {
    throw new Error(
      `FATAL: SUPABASE_URL must start with https://. ` +
      `Current: ${trimmedUrl.substring(0, 20)}... ` +
      `Correct format: https://<project>.supabase.co`
    );
  }

  // Must not start with https://db. (database URL, not API URL)
  if (trimmedUrl.startsWith("https://db.")) {
    throw new Error(
      `FATAL: SUPABASE_URL should be the API URL, not the database URL. ` +
      `Use https://<project>.supabase.co (from Settings → API), not https://db.<project>.supabase.co`
    );
  }

  // Must not include /v2 or other paths
  if (trimmedUrl.includes("/v2") || trimmedUrl.includes("/v1")) {
    throw new Error(
      `FATAL: SUPABASE_URL should not include path segments like /v2 or /v1. ` +
      `Correct format: https://<project>.supabase.co (base URL only)`
    );
  }

  // Must not be a WebSocket URL
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

if (!supabaseServiceKey) {
  throw new Error(
    "FATAL: Missing SUPABASE_SECRET_KEY environment variable. " +
    "The server requires the service role key (not anon key) for admin operations."
  );
}

// Log validated URL (without exposing secrets)
console.log(`🔗 Supabase URL: ${supabaseUrl.replace(/^(https:\/\/[^.]+).*/, "$1.supabase.co")}`);

// Create Supabase client with realtime COMPLETELY DISABLED
// Server-side operations don't need realtime - only REST API calls
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
      'X-Client-Info': 'rechtstreeks-server',
    },
  },
});

// Explicitly remove realtime channel to prevent any WebSocket connections
supabase.realtime.disconnect();
