-- ============================================================================
-- RECHTSTREEKS.AI - Complete Supabase Production Database Schema
-- Generated: 2024
-- 
-- This script creates all tables, indexes, and RLS policies needed for production.
-- Run this in your new Supabase project's SQL Editor.
-- ============================================================================

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('EISER', 'GEDAAGDE');
CREATE TYPE case_status AS ENUM (
  'NEW_INTAKE',
  'DOCS_UPLOADED',
  'ANALYZED',
  'LETTER_DRAFTED',
  'BAILIFF_ORDERED',
  'SERVED',
  'SUMMONS_DRAFTED',
  'FILED',
  'PROCEEDINGS_ONGOING',
  'JUDGMENT'
);
CREATE TYPE invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE summons_section_status AS ENUM ('pending', 'generating', 'draft', 'needs_changes', 'approved');

-- ============================================================================
-- CORE TABLES (Drizzle ORM managed - also used by Supabase)
-- ============================================================================

-- Sessions table (for express-session with connect-pg-simple)
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions(expire);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  role VARCHAR DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cases table
CREATE TABLE IF NOT EXISTS cases (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_user_id VARCHAR NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  category VARCHAR,
  description TEXT,
  claim_amount DECIMAL(10, 2),
  claimant_name TEXT,
  claimant_address TEXT,
  claimant_city VARCHAR,
  counterparty_type VARCHAR,
  counterparty_name TEXT,
  counterparty_email VARCHAR,
  counterparty_phone VARCHAR,
  counterparty_address TEXT,
  counterparty_city VARCHAR,
  counterparty_user_id VARCHAR REFERENCES users(id),
  user_role user_role DEFAULT 'EISER' NOT NULL,
  counterparty_description_approved BOOLEAN DEFAULT FALSE,
  status case_status DEFAULT 'NEW_INTAKE',
  current_step VARCHAR,
  next_action_label VARCHAR,
  has_unseen_missing_items BOOLEAN DEFAULT FALSE,
  needs_reanalysis BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cases_owner ON cases(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created ON cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_counterparty ON cases(counterparty_user_id);

-- Case Invitations
CREATE TABLE IF NOT EXISTS case_invitations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  invited_by_user_id VARCHAR NOT NULL REFERENCES users(id),
  invited_email VARCHAR NOT NULL,
  invitation_code VARCHAR NOT NULL UNIQUE,
  status invitation_status DEFAULT 'PENDING' NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  accepted_by_user_id VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON case_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON case_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_invitations_case ON case_invitations(case_id);

-- Case Documents
CREATE TABLE IF NOT EXISTS case_documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mimetype VARCHAR NOT NULL,
  size_bytes INTEGER NOT NULL,
  extracted_text TEXT,
  public_url TEXT,
  uploaded_by_user_id VARCHAR NOT NULL REFERENCES users(id),
  document_analysis JSONB,
  analysis_status VARCHAR DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_case ON case_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_created ON case_documents(created_at);

-- Analyses
CREATE TABLE IF NOT EXISTS analyses (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  model VARCHAR NOT NULL,
  raw_text TEXT,
  analysis_json JSONB,
  extracted_texts JSONB,
  missing_info_struct JSONB,
  all_files JSONB,
  user_context JSONB,
  procedure_context JSONB,
  facts_json JSONB,
  issues_json JSONB,
  missing_docs_json JSONB,
  legal_basis_json JSONB,
  risk_notes_json JSONB,
  prev_analysis_id VARCHAR,
  missing_info_answers JSONB,
  succes_kans_analysis JSONB,
  legal_advice_json JSONB,
  missing_information JSONB,
  jurisprudence_references JSONB,
  jurisprudence_search_results JSONB,
  legislation_search_results JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analyses_case ON analyses(case_id);
CREATE INDEX IF NOT EXISTS idx_analyses_version ON analyses(case_id, version);

-- Saved Legislation
CREATE TABLE IF NOT EXISTS saved_legislation (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  bwb_id VARCHAR NOT NULL,
  article_number VARCHAR NOT NULL,
  article_key VARCHAR NOT NULL,
  law_title TEXT,
  article_text TEXT,
  wetten_link TEXT,
  boek_nummer VARCHAR,
  boek_titel TEXT,
  valid_from VARCHAR,
  leden JSONB,
  commentary JSONB,
  commentary_sources JSONB,
  commentary_generated_at TIMESTAMP,
  search_score DECIMAL(5, 4),
  search_rank INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_legislation_case ON saved_legislation(case_id);
CREATE INDEX IF NOT EXISTS idx_saved_legislation_article ON saved_legislation(bwb_id, article_number);

-- Letters
CREATE TABLE IF NOT EXISTS letters (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  template_id VARCHAR,
  brief_type VARCHAR,
  tone VARCHAR,
  html TEXT,
  markdown TEXT,
  pdf_storage_key TEXT,
  status VARCHAR DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_letters_case ON letters(case_id);

-- Summons
CREATE TABLE IF NOT EXISTS summons (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  template_id VARCHAR,
  template_version VARCHAR DEFAULT 'v1',
  user_fields_json JSONB,
  ai_fields_json JSONB,
  data_json JSONB,
  readiness_json JSONB,
  user_responses_json JSONB,
  html TEXT,
  markdown TEXT,
  pdf_storage_key TEXT,
  status VARCHAR DEFAULT 'draft',
  generation_error TEXT,
  is_multi_step BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_summons_case ON summons(case_id);

-- Summons Sections
CREATE TABLE IF NOT EXISTS summons_sections (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  summons_id VARCHAR NOT NULL REFERENCES summons(id) ON DELETE CASCADE,
  section_key VARCHAR NOT NULL,
  section_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  status summons_section_status DEFAULT 'pending',
  flow_name VARCHAR,
  feedback_variable_name VARCHAR,
  generated_text TEXT,
  user_feedback TEXT,
  generation_count INTEGER DEFAULT 0,
  warnings_json JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_summons_sections_summons ON summons_sections(summons_id);
CREATE INDEX IF NOT EXISTS idx_summons_sections_order ON summons_sections(summons_id, step_order);

-- Templates
CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kind VARCHAR NOT NULL,
  name TEXT NOT NULL,
  version VARCHAR NOT NULL,
  body_markdown TEXT NOT NULL,
  fields_json JSONB,
  validations_json JSONB,
  raw_template_text TEXT,
  user_fields_json JSONB,
  ai_fields_json JSONB,
  field_occurrences JSONB,
  mindstudio_flow_name VARCHAR,
  mindstudio_flow_id VARCHAR,
  launch_variables JSONB,
  return_data_keys JSONB,
  is_multi_step BOOLEAN DEFAULT FALSE,
  sections_config JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_templates_kind ON templates(kind);
CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  actor_user_id VARCHAR NOT NULL REFERENCES users(id),
  type VARCHAR NOT NULL,
  payload_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_case ON events(case_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id VARCHAR REFERENCES cases(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  event_types_json JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhooks_case ON webhooks(case_id);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key VARCHAR NOT NULL UNIQUE,
  value_json JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Warranty Products
CREATE TABLE IF NOT EXISTS warranty_products (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_user_id VARCHAR NOT NULL REFERENCES users(id),
  product_name TEXT NOT NULL,
  brand VARCHAR,
  model VARCHAR,
  serial_number VARCHAR,
  purchase_date TIMESTAMP,
  purchase_price DECIMAL(10, 2),
  supplier TEXT,
  warranty_duration VARCHAR,
  warranty_expiry TIMESTAMP,
  category VARCHAR,
  description TEXT,
  status VARCHAR DEFAULT 'active',
  website_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warranty_products_owner ON warranty_products(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_warranty_products_created ON warranty_products(created_at);
CREATE INDEX IF NOT EXISTS idx_warranty_products_expiry ON warranty_products(warranty_expiry);

-- Warranty Documents
CREATE TABLE IF NOT EXISTS warranty_documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id VARCHAR NOT NULL REFERENCES warranty_products(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mimetype VARCHAR NOT NULL,
  size_bytes INTEGER NOT NULL,
  document_type VARCHAR NOT NULL,
  extracted_text TEXT,
  public_url TEXT,
  uploaded_by_user_id VARCHAR NOT NULL REFERENCES users(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warranty_documents_product ON warranty_documents(product_id);
CREATE INDEX IF NOT EXISTS idx_warranty_documents_type ON warranty_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_warranty_documents_created ON warranty_documents(created_at);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_case ON chat_messages(case_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- QnA Items
CREATE TABLE IF NOT EXISTS qna_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qna_items_case ON qna_items(case_id);
CREATE INDEX IF NOT EXISTS idx_qna_items_order ON qna_items("order");

-- Judgment Texts (cached from Rechtspraak.nl)
CREATE TABLE IF NOT EXISTS judgment_texts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ecli VARCHAR(255) NOT NULL UNIQUE,
  full_text TEXT,
  xml_content TEXT,
  fetched_at TIMESTAMP DEFAULT NOW(),
  fetch_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_judgment_texts_ecli ON judgment_texts(ecli);
CREATE INDEX IF NOT EXISTS idx_judgment_texts_fetched_at ON judgment_texts(fetched_at);

-- ============================================================================
-- SUPABASE-SPECIFIC TABLES (not in Drizzle schema)
-- ============================================================================

-- Document Analyses (MindStudio document analysis results)
CREATE TABLE IF NOT EXISTS document_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR NOT NULL,
  user_id UUID NOT NULL,
  document_name TEXT NOT NULL,
  document_type TEXT,
  is_readable BOOLEAN DEFAULT TRUE,
  belongs_to_case BOOLEAN DEFAULT TRUE,
  summary TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_analyses_document ON document_analyses(document_id);
CREATE INDEX IF NOT EXISTS idx_document_analyses_user ON document_analyses(user_id);

-- RKOS Analyses (Redelijke Kans Op Succes - Success Chance Analysis)
CREATE TABLE IF NOT EXISTS rkos_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR NOT NULL,
  user_id UUID,
  analysis_id VARCHAR,
  mindstudio_run_id VARCHAR,
  flow_version VARCHAR DEFAULT 'RKOS.flow',
  status VARCHAR DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  chance_of_success INTEGER,
  confidence_level VARCHAR,
  summary_verdict TEXT,
  assessment TEXT,
  facts JSONB DEFAULT '[]'::jsonb,
  strengths JSONB DEFAULT '[]'::jsonb,
  weaknesses JSONB DEFAULT '[]'::jsonb,
  risks JSONB DEFAULT '[]'::jsonb,
  legal_analysis TEXT,
  recommended_claims TEXT,
  applicable_laws TEXT,
  missing_elements TEXT,
  raw_payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rkos_analyses_case ON rkos_analyses(case_id);
CREATE INDEX IF NOT EXISTS idx_rkos_analyses_user ON rkos_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_rkos_analyses_status ON rkos_analyses(status);

-- Legal Advice (from Create_advice.flow)
CREATE TABLE IF NOT EXISTS legal_advice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR NOT NULL,
  user_id UUID,
  mindstudio_run_id VARCHAR,
  flow_version VARCHAR DEFAULT 'Create_advice.flow',
  status VARCHAR DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  het_geschil TEXT,
  de_feiten TEXT,
  betwiste_punten TEXT,
  beschikbaar_bewijs TEXT,
  juridische_duiding TEXT,
  vervolgstappen TEXT,
  samenvatting_advies TEXT,
  ontbrekend_bewijs JSONB DEFAULT '[]'::jsonb,
  raw_payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_legal_advice_case ON legal_advice(case_id);
CREATE INDEX IF NOT EXISTS idx_legal_advice_user ON legal_advice(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_advice_status ON legal_advice(status);

-- Saved Jurisprudence (user-saved court decisions)
CREATE TABLE IF NOT EXISTS saved_jurisprudence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  case_id VARCHAR NOT NULL,
  ecli VARCHAR NOT NULL,
  court VARCHAR,
  court_level VARCHAR,
  decision_date VARCHAR,
  legal_area VARCHAR,
  procedure_type VARCHAR,
  title TEXT,
  source_url TEXT,
  text_fragment TEXT,
  ai_feiten TEXT,
  ai_geschil TEXT,
  ai_beslissing TEXT,
  ai_motivering TEXT,
  ai_inhoudsindicatie TEXT,
  search_score DECIMAL,
  search_namespace VARCHAR,
  search_query TEXT,
  user_notes TEXT,
  saved_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, case_id, ecli)
);
CREATE INDEX IF NOT EXISTS idx_saved_jurisprudence_user ON saved_jurisprudence(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_jurisprudence_case ON saved_jurisprudence(case_id);
CREATE INDEX IF NOT EXISTS idx_saved_jurisprudence_ecli ON saved_jurisprudence(ecli);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all Supabase-specific tables
ALTER TABLE document_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rkos_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_advice ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jurisprudence ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- Policies for document_analyses
CREATE POLICY "Users can view own document analyses" ON document_analyses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own document analyses" ON document_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own document analyses" ON document_analyses
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own document analyses" ON document_analyses
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for rkos_analyses
CREATE POLICY "Users can view own RKOS analyses" ON rkos_analyses
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can insert RKOS analyses" ON rkos_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own RKOS analyses" ON rkos_analyses
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Policies for legal_advice
CREATE POLICY "Users can view own legal advice" ON legal_advice
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can insert legal advice" ON legal_advice
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own legal advice" ON legal_advice
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Policies for saved_jurisprudence
CREATE POLICY "Users can view own saved jurisprudence" ON saved_jurisprudence
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved jurisprudence" ON saved_jurisprudence
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved jurisprudence" ON saved_jurisprudence
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved jurisprudence" ON saved_jurisprudence
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for cases (owner-based access)
CREATE POLICY "Users can view own cases" ON cases
  FOR SELECT USING (
    owner_user_id::uuid = auth.uid() OR 
    counterparty_user_id::uuid = auth.uid()
  );
CREATE POLICY "Users can insert own cases" ON cases
  FOR INSERT WITH CHECK (owner_user_id::uuid = auth.uid());
CREATE POLICY "Users can update own cases" ON cases
  FOR UPDATE USING (
    owner_user_id::uuid = auth.uid() OR 
    counterparty_user_id::uuid = auth.uid()
  );
CREATE POLICY "Users can delete own cases" ON cases
  FOR DELETE USING (owner_user_id::uuid = auth.uid());

-- ============================================================================
-- SERVICE ROLE BYPASS (for server-side operations)
-- ============================================================================
-- Note: When using the service_role key from your server, RLS is automatically
-- bypassed. This is the recommended approach for server-side operations.
-- The policies above are for client-side (anon key) operations only.

-- ============================================================================
-- STORAGE BUCKET (create manually in Supabase Dashboard)
-- ============================================================================
-- Create a storage bucket named 'documents' for file uploads
-- Go to Storage > Create new bucket > Name: documents > Public: OFF

-- ============================================================================
-- NOTES FOR PRODUCTION
-- ============================================================================
-- 1. Set SUPABASE_URL and SUPABASE_SECRET_KEY (service role) in Azure env vars
-- 2. The service role key bypasses RLS, so server operations work without auth
-- 3. Never expose the service role key to the client
-- 4. Create the 'documents' storage bucket manually in Supabase Dashboard
