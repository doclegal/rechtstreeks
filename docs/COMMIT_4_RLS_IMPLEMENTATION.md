# Commit 4: Supabase Row Level Security (RLS) - Phase 1

## Executive Summary

This commit implements Phase 1 of Row Level Security (RLS) for the Supabase PostgreSQL database, focusing specifically on the `cases` table. Due to the application's dual-database architecture, only tables consistently accessed via the Supabase client receive RLS protection.

## Architecture Discovery: Dual Database System

During RLS implementation, we discovered the application uses TWO separate PostgreSQL databases:

| Database | Access Method | RLS Status |
|----------|---------------|------------|
| **Supabase PostgreSQL** | Supabase Client (caseService) | ✅ Phase 1: `cases` table |
| **Neon PostgreSQL** | Drizzle ORM (storage.ts, db.ts) | ❌ App-level auth only |

### Why This Matters for RLS

RLS policies in Supabase rely on `auth.uid()` from JWT tokens. This only works when:
1. Queries use the Supabase client with a user-scoped JWT
2. The client is created per-request with the user's token

Tables accessed via Drizzle ORM bypass Supabase entirely, making RLS policies ineffective.

## Phase 1 Scope: Cases Table Only

### What's Protected by RLS
- `cases` table: All access goes through `caseService` using user-scoped Supabase client

### What Uses App-Level Authorization
- `case_documents`: Mixed Neon/Supabase access - Supabase routes use userClient, but Neon routes also exist
- `document_analyses`: Accessed via Neon storage (documentAnalysisService uses storage.createAnalysis)
- All other tables: Accessed exclusively via Neon/Drizzle

### Data Access Reality

| Table | Primary Access | RLS Effective? |
|-------|----------------|----------------|
| cases | Supabase (caseService) | ✅ Yes |
| case_documents | Both Supabase + Neon | ⚠️ Partial (Supabase routes only) |
| document_analyses | Neon (storage.ts) | ❌ No |
| invitations | Neon | ❌ No (app-level auth) |
| events | Neon | ❌ No (app-level auth) |
| letters | Neon | ❌ No (app-level auth) |
| All others | Neon | ❌ No (app-level auth) |

## RLS Policies Applied (Phase 1)

### cases Table

| Policy | Operation | Access Rule |
|--------|-----------|-------------|
| `cases_owner_all` | ALL | User is `owner_user_id` |
| `cases_counterparty_read` | SELECT | User is `counterparty_user_id` |
| `service_role_bypass_cases` | ALL | Service role (supabaseAdmin) |

**Key Design Decision**: Counterparties do NOT have UPDATE permission via RLS. Instead:
- Counterparty updates (e.g., approve description) use `supabaseAdmin`
- Route handlers verify counterparty role in application code
- This prevents counterparties from modifying owner-controlled fields

## Code Changes in This Commit

### server/routes.ts

1. **Supabase Document Routes**: All `case_documents` operations use `userClient`
   - `/api/cases/:caseId/documents` (list) - uses userClient
   - `/api/cases/:caseId/documents` (upload) - uses userClient
   - `/api/documents/:documentId/url` - uses userClient
   - `/api/documents/:documentId/supabase` (delete) - uses userClient

2. **Counterparty Approval**: Uses `supabaseAdmin` with app-level role verification

3. **Invitation Acceptance**: Uses `supabaseAdmin` (user isn't counterparty yet)

### Unchanged Files

- `server/storage.ts`: Continues using Drizzle for Neon access (app-level auth)
- `server/services/caseService.ts`: Already uses passed-in client from Commit 3

## Migration Instructions

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **Database** → **SQL Editor**

### Step 2: Run the Migration

Copy the contents of `docs/supabase_rls_migration.sql` and execute it.

The migration:
- Enables RLS on `cases` table only
- Creates ownership-based policies using `auth.uid()`
- Adds service_role bypass policy for admin operations

### Step 3: Verify RLS is Enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'cases';
```

Expected: `rowsecurity = true`

### Step 4: Test Access Patterns

1. Create a case as user A → User A should have full access
2. Invite user B as counterparty → User B should see case (read-only via RLS)
3. User B tries to modify case → Should fail (no UPDATE policy)
4. User B approves description → Should work (uses supabaseAdmin)

## Future Phases

### Phase 2: Migrate Document Routes
- Consolidate document operations to use Supabase client consistently
- Remove or redirect Neon-based document endpoints (`/api/cases/:id/uploads`)
- Enable RLS on `case_documents` table

### Phase 3: Document Analyses
- Migrate analysis storage from Neon to Supabase
- Update documentAnalysisService to use Supabase client
- Enable RLS on `document_analyses` table

## Security Considerations

1. **Service Role Access**: `supabaseAdmin` bypasses RLS for system operations
2. **Token Validation**: All routes validate JWT via middleware before creating user client
3. **App-Level Auth**: Neon tables rely on middleware + route-level checks (existing pattern)
4. **No Public Access**: All authenticated routes require valid session or bearer token

## Neon Tables (App-Level Auth Only)

These tables are stored in Neon PostgreSQL and protected by application-level authorization:

| Table | Authorization Method |
|-------|---------------------|
| `case_invitations` | Token + email validation |
| `events` | Case ownership check in route |
| `letters` | Case ownership check in route |
| `chat_messages` | Case ownership check in route |
| `analyses` | Case ownership check in route |
| `qna_items` | Case ownership check in route |
| `saved_legislation` | Case ownership check in route |
| `summons` | Case ownership check in route |
| `summons_sections` | Via summons ownership |
| `warranty_products` | Owner check in route |
| `warranty_documents` | Via product ownership |
| `users` | Own profile check |
| `templates` | Global (read-only) |
| `settings` | Global |
| `sessions` | Express session management |

## Troubleshooting

### "permission denied for table cases"

This means RLS is working but the policy doesn't match. Check:
1. Is the user authenticated with a valid Supabase JWT?
2. Does `owner_user_id` match the user's `auth.uid()`?
3. For counterparty access, is `counterparty_user_id` set?

### Data Not Appearing After Migration

If existing cases aren't visible after enabling RLS:
1. Verify `owner_user_id` matches the user's Supabase Auth UUID
2. Check that the request includes a valid JWT token
3. Use `supabaseAdmin` temporarily to verify data exists

### Rollback

To disable RLS on the cases table (emergency only):

```sql
ALTER TABLE cases DISABLE ROW LEVEL SECURITY;
```

## Testing Checklist

- [ ] Owner can create/read/update/delete their cases
- [ ] Counterparty can read cases they're invited to
- [ ] Counterparty cannot update cases directly (RLS blocks)
- [ ] Counterparty can approve description (via supabaseAdmin route)
- [ ] Invitation acceptance works (via supabaseAdmin)
- [ ] Service role bypasses RLS for admin operations
