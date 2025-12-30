# Commit 1: Security Hotfix - Test Checklist

## Changes Made
1. Removed `testAuthMiddleware` registration from `server/index.ts`
2. Removed `/api/supabase/cases` route registration from `server/index.ts`
3. Replaced `server/middleware/testAuth.ts` with disabled version (returns 503)
4. Replaced `server/routes/supabaseCases.ts` with disabled version (returns 503)
5. Added auth logging: `[auth_mode:masked_user_id]` to all API requests

## Manual Test Steps

### Test 1: Verify disabled routes
```bash
curl -s http://localhost:5000/api/supabase/cases
```
**Expected**: Returns frontend HTML (route not registered, falls through to Vite)

### Test 2: Verify main API still works
```bash
curl -s http://localhost:5000/api/auth/session
```
**Expected**: Returns `{"user":null}` for unauthenticated request

### Test 3: Verify logging format
Check server logs after making API requests.
**Expected**: Log format includes `[anonymous:none]` or `[authenticated:xxxxxxxx...]`

### Test 4: No hard-coded user IDs in code
```bash
grep -r "550e8400" server/ --include="*.ts"
```
**Expected**: No matches (hard-coded test user ID removed)

## Results

| Test | Status | Notes |
|------|--------|-------|
| 1. Disabled routes | PASS | Route returns frontend HTML, not API response |
| 2. Main API works | PASS | `/api/auth/session` returns proper JSON |
| 3. Logging format | PASS | Shows `[anonymous:none]` in logs |
| 4. No hard-coded IDs | PASS | testAuth.ts no longer contains UUID |

## Security Impact
- Hard-coded test user ID (`550e8400-e29b-41d4-a716-446655440000`) no longer accessible
- `/api/supabase/cases/*` routes no longer bypass authentication
- All API requests now logged with auth mode and masked user ID
