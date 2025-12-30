-- Supabase Row Level Security (RLS) Migration - Phase 1
-- Apply this in the Supabase SQL Editor (Database -> SQL Editor)
-- 
-- IMPORTANT: This application has a DUAL DATABASE architecture:
-- - Supabase PostgreSQL: Accessed via Supabase client (caseService)
-- - Neon PostgreSQL: Accessed via Drizzle ORM (storage.ts)
--
-- PHASE 1 SCOPE: This migration enables RLS ONLY on the `cases` table,
-- which is consistently accessed via caseService using user-scoped Supabase clients.
--
-- FUTURE PHASES:
-- - Phase 2: Migrate case_documents routes to consistently use Supabase client
-- - Phase 3: Enable RLS on case_documents and document_analyses
--
-- TABLES COVERED IN PHASE 1:
-- - cases: Case data accessed via caseService (RLS enabled)
--
-- TABLES NOT COVERED (use app-level auth):
-- - case_documents: Mixed Neon/Supabase access, RLS not reliable
-- - document_analyses: Accessed via Neon storage
-- - All other tables: Accessed via Neon storage (app-level auth)

-- ============================================================================
-- ENABLE RLS ON CASES TABLE ONLY
-- ============================================================================

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CASES TABLE POLICIES
-- Owner has full access, counterparty has read access
-- ============================================================================

-- Owner has full CRUD access
CREATE POLICY "cases_owner_all"
ON cases FOR ALL
USING (owner_user_id = auth.uid()::text)
WITH CHECK (owner_user_id = auth.uid()::text);

-- Counterparty can read the case
CREATE POLICY "cases_counterparty_read"
ON cases FOR SELECT
USING (counterparty_user_id = auth.uid()::text);

-- NOTE: Counterparty updates (e.g., approve description) are handled via supabaseAdmin
-- in the route handler after verifying counterparty role in application code.
-- This prevents counterparties from updating owner-controlled fields.
-- See: PATCH /api/cases/:id/approve-description in server/routes.ts

-- ============================================================================
-- SERVICE ROLE BYPASS POLICY
-- Allows service role (supabaseAdmin) to bypass RLS for:
-- - Invitation acceptance flow (before user becomes counterparty)
-- - Public endpoints (case info for invitation pages)
-- - Background/system operations
-- ============================================================================

CREATE POLICY "service_role_bypass_cases" ON cases FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- VERIFICATION QUERY
-- Run this after applying the migration to verify RLS is enabled:
-- ============================================================================
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'cases';
-- 
-- Expected result: cases table should show rowsecurity = true

-- ============================================================================
-- PHASE 2 (FUTURE): CASE_DOCUMENTS RLS
-- Prerequisites:
-- 1. Migrate all document operations to use Supabase client consistently
-- 2. Remove Neon-based document routes or consolidate to single source
-- 
-- When ready, uncomment and apply:
-- ============================================================================
-- ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "case_documents_participant_read"
-- ON case_documents FOR SELECT
-- USING (
--   EXISTS (
--     SELECT 1 FROM cases 
--     WHERE cases.id = case_documents.case_id 
--     AND (cases.owner_user_id = auth.uid()::text OR cases.counterparty_user_id = auth.uid()::text)
--   )
-- );
-- 
-- CREATE POLICY "case_documents_participant_insert"
-- ON case_documents FOR INSERT
-- WITH CHECK (
--   user_id = auth.uid()::text
--   AND EXISTS (
--     SELECT 1 FROM cases 
--     WHERE cases.id = case_documents.case_id 
--     AND (cases.owner_user_id = auth.uid()::text OR cases.counterparty_user_id = auth.uid()::text)
--   )
-- );
-- 
-- CREATE POLICY "case_documents_uploader_update"
-- ON case_documents FOR UPDATE
-- USING (user_id = auth.uid()::text)
-- WITH CHECK (user_id = auth.uid()::text);
-- 
-- CREATE POLICY "case_documents_uploader_delete"
-- ON case_documents FOR DELETE
-- USING (user_id = auth.uid()::text);
-- 
-- CREATE POLICY "service_role_bypass_case_documents" ON case_documents FOR ALL TO service_role USING (true) WITH CHECK (true);
