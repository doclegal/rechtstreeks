import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable");
}

// Validate SUPABASE_URL format
if (supabaseUrl.startsWith("ws://") || supabaseUrl.startsWith("wss://")) {
  throw new Error(
    `FATAL: SUPABASE_URL must start with https://, not ${supabaseUrl.split("://")[0]}://. ` +
    `Correct format: https://<project>.supabase.co`
  );
}

if (supabaseUrl.includes("/v2")) {
  throw new Error(
    `FATAL: SUPABASE_URL should not include /v2. ` +
    `Correct format: https://<project>.supabase.co (without path)`
  );
}

if (!supabaseUrl.startsWith("https://")) {
  console.warn(`⚠️ SUPABASE_URL should start with https:// for production. Current: ${supabaseUrl}`);
}

if (!supabaseServiceKey) {
  throw new Error("Missing SUPABASE_SECRET_KEY or SUPABASE_ANON_KEY environment variable");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
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
