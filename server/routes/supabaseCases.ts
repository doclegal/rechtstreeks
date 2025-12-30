/**
 * @deprecated REMOVED - Security vulnerability
 * 
 * These routes were using testAuthMiddleware with a hard-coded user ID,
 * bypassing proper authentication. They have been disabled.
 * 
 * All case operations should go through the main /api/cases/* routes
 * which use proper Supabase authentication.
 * 
 * DO NOT RE-ENABLE WITHOUT PROPER AUTH.
 */

import { Router, type Request, type Response } from "express";

const router = Router();

const DISABLED_MESSAGE = {
  error: "This endpoint has been disabled for security reasons. Use /api/cases/* instead.",
  code: "SUPABASE_CASES_DISABLED"
};

router.all("*", (_req: Request, res: Response) => {
  console.error("🚨 SECURITY: /api/supabase/cases/* route accessed but is disabled");
  return res.status(503).json(DISABLED_MESSAGE);
});

export default router;
