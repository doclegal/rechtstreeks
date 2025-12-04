import type { Request, Response, NextFunction } from "express";

const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

export function testAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  (req as any).user = { id: TEST_USER_ID };
  next();
}
