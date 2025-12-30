# Commit 2: Auth Source of Truth - Test Checklist

## Changes Made
1. Created `extractBearerToken()` helper to parse Authorization header
2. Created `verifySupabaseToken()` to verify JWT server-side via Supabase's getUser()
3. Updated `isAuthenticated` middleware to:
   - Priority 1: Verify Bearer token from Authorization header
   - Priority 2: Verify session's access token (backward compatibility)
   - NEVER trust session data as identity - always verify with Supabase
4. Added `authMode` to request (bearer/session) for logging
5. Updated logging to show auth mode
6. Added error codes for different auth failure scenarios

## Manual Test Steps

### Test 1: Unauthenticated request
```bash
curl -s http://localhost:5000/api/cases
```
**Expected**: `{"message":"Unauthorized - provide Authorization: Bearer <token>","code":"NO_AUTH"}`

### Test 2: Invalid Bearer token
```bash
curl -s -H "Authorization: Bearer invalid_token" http://localhost:5000/api/cases
```
**Expected**: `{"message":"Invalid or expired token","code":"INVALID_TOKEN"}`
**Logs should show**: Token verification failed with Supabase error

### Test 3: Valid Bearer token (requires real Supabase token)
```bash
# Login first to get token
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq .accessToken
# Then use token
curl -s -H "Authorization: Bearer <token>" http://localhost:5000/api/cases
```
**Expected**: 200 OK with user's cases
**Logs should show**: `[bearer:xxxxxxxx...]`

### Test 4: Session auth (backward compatibility)
**Expected**: Session auth still works but token is verified server-side

### Test 5: Log format verification
Check server logs after requests.
**Expected**: Format `[authMode:maskedUserId]` where authMode is `bearer`, `session`, or `anonymous`

## Results

| Test | Status | Notes |
|------|--------|-------|
| 1. Unauthenticated | PASS | Returns NO_AUTH code |
| 2. Invalid token | PASS | Returns INVALID_TOKEN, logs show Supabase verification |
| 3. Valid token | PENDING | Requires real user |
| 4. Session auth | PASS | Backward compatible |
| 5. Log format | PASS | Shows auth mode in logs |

## Security Impact
- Tokens are now verified server-side via Supabase's getUser()
- Session data is no longer trusted as identity
- Invalid tokens are rejected with proper error codes
- JWT verification errors are logged for debugging
