/**
 * @deprecated REMOVED - Security vulnerability
 * 
 * This middleware was using a hard-coded user ID for all requests,
 * which is a critical security issue. It has been disabled.
 * 
 * DO NOT RE-ENABLE IN PRODUCTION.
 * 
 * For testing purposes, use proper authentication with test accounts.
 */

import type { Request, Response, NextFunction } from "express";

export function testAuthMiddleware(_req: Request, res: Response, _next: NextFunction) {
  console.error("🚨 SECURITY: testAuthMiddleware called but is disabled. This route should not be accessible.");
  return res.status(503).json({ 
    error: "This endpoint has been disabled for security reasons",
    code: "TEST_AUTH_DISABLED"
  });
}
