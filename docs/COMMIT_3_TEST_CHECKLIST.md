# Commit 3: User-Scoped DB Access - COMPLETE

## Summary
Implemented user-scoped Supabase clients for Row Level Security (RLS). All services now **require** a user-scoped client - no more admin fallback.

## Changes Made

### 1. Middleware Enhancement (`server/supabaseAuth.ts`)
- `isAuthenticated` middleware attaches `req.supabaseClient` to all authenticated requests
- Uses user's JWT with anon key for RLS-protected operations
- Added `getRequestClient(req)` helper
- Imported `createUserClient` from supabaseClient.ts

### 2. Supabase Client Factory (`server/supabaseClient.ts`)
- **SUPABASE_ANON_KEY is REQUIRED at startup** (throws FATAL error if missing)
- `createUserClient(accessToken)` - creates client with user's JWT + anon key
- `requireUserClient(req)` - strict version that throws if no token
- `supabaseAdmin` - explicit alias for service-role client

### 3. Services Now STRICT (`server/services/`)
All services now **throw an error** if no client is provided:
- `caseService.ts` - all methods require client
- `supabaseStorageService.ts` - all methods require client
- `documentAnalysisService.ts` - all methods require client

**No more silent admin fallback!**

### 4. Routes Updated (`server/routes.ts`)
- All authenticated routes pass `req.supabaseClient` to services
- 50+ routes updated by subagent

### 5. Intentional Exceptions (Documented)
Routes without user context use admin client (documented):
1. Public invitation acceptance (unauthenticated)
2. Webhook callbacks (external systems)
3. Public search APIs

## Architecture

### Request Flow
```
Client Request with Bearer token
      │
      ▼
isAuthenticated middleware
      ├─ Verify token with Supabase Auth
      ├─ req.user = { id, email }
      └─ req.supabaseClient = createUserClient(accessToken)
      │
      ▼
Route Handler
      └─ caseService.getCaseById(id, req.supabaseClient)
      │
      ▼
caseService.getClient()
      └─ THROWS if no client provided
      │
      ▼
Supabase with user's JWT
      └─ auth.uid() returns user's ID
      └─ RLS: owner_user_id = auth.uid()
```

### Security Enforcement
```typescript
// caseService.ts
function getClient(client?: SupabaseClient): SupabaseClient {
  if (!client) {
    throw new Error("No Supabase client provided. Pass req.supabaseClient for RLS to work.");
  }
  return client;
}
```

## Test Results

| Test | Status | Notes |
|------|--------|-------|
| App starts successfully | PASS | No missing client errors |
| SUPABASE_ANON_KEY required | PASS | Throws FATAL if missing |
| Services strict (no fallback) | PASS | Throws if no client |
| All routes pass client | PASS | 50+ routes updated |

## Environment Requirements
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SECRET_KEY=<service-role-key>    # For admin operations ONLY
SUPABASE_ANON_KEY=<anon-key>              # REQUIRED for user-scoped clients
```

## Security Analysis

### Enforced:
- All authenticated routes use user-scoped client
- Services throw if no client provided (no silent bypass)
- SUPABASE_ANON_KEY required at startup

### Exceptions (Documented):
1. **Public endpoints** - No user context available
2. **Webhooks** - External systems can't provide JWT
3. **System operations** - Internal functions without request context

## Next Steps (Commit 4)
- [ ] Enable RLS on Supabase tables (cases, documents, etc.)
- [ ] Create RLS policies: `owner_user_id = auth.uid()`
- [ ] Test cross-user access is blocked
- [ ] Verify webhook/public endpoints work with admin client
