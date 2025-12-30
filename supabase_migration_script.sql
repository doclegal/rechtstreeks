-- =====================================================
-- SUPABASE PRODUCTION DATABASE MIGRATION SCRIPT
-- =====================================================
-- Dit script synchroniseert je productie Supabase database
-- met de huidige app code schema.
-- 
-- INSTRUCTIES:
-- 1. Ga naar je Supabase Dashboard (production project)
-- 2. Ga naar "SQL Editor" in het linkermenu
-- 3. Maak een backup van je data voordat je dit uitvoert!
-- 4. Kopieer en plak dit script
-- 5. Klik op "Run" om het uit te voeren
-- =====================================================

-- STAP 1: Hernoem bestaande kolommen die niet kloppen
-- (Alleen uitvoeren als de kolom bestaat - Supabase zal een fout geven als kolom niet bestaat)

-- Hernoem claim_amount_eur naar claim_amount
ALTER TABLE cases RENAME COLUMN claim_amount_eur TO claim_amount;

-- Hernoem client_address naar claimant_address (als dit de oude naam was)
ALTER TABLE cases RENAME COLUMN client_address TO claimant_address;

-- =====================================================
-- STAP 2: Voeg ontbrekende kolommen toe aan cases tabel
-- =====================================================

-- Claimant (eiser) velden
ALTER TABLE cases ADD COLUMN IF NOT EXISTS claimant_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS claimant_city VARCHAR;

-- Counterparty (gedaagde) velden
ALTER TABLE cases ADD COLUMN IF NOT EXISTS counterparty_type VARCHAR;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS counterparty_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS counterparty_email VARCHAR;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS counterparty_phone VARCHAR;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS counterparty_address TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS counterparty_city VARCHAR;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS counterparty_user_id VARCHAR REFERENCES users(id);

-- User role en status velden
ALTER TABLE cases ADD COLUMN IF NOT EXISTS user_role VARCHAR DEFAULT 'EISER';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS counterparty_description_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS current_step VARCHAR;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS next_action_label VARCHAR;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS has_unseen_missing_items BOOLEAN DEFAULT FALSE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS needs_reanalysis BOOLEAN DEFAULT FALSE;

-- =====================================================
-- STAP 3: Controleer en maak ENUM types aan (indien nodig)
-- =====================================================

-- User role enum (wie is de gebruiker in het geschil?)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('EISER', 'GEDAAGDE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Case status enum
DO $$ BEGIN
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
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Invitation status enum
DO $$ BEGIN
    CREATE TYPE invitation_status AS ENUM (
        'PENDING',
        'ACCEPTED',
        'EXPIRED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Summons section status enum
DO $$ BEGIN
    CREATE TYPE summons_section_status AS ENUM (
        'pending',
        'generating',
        'draft',
        'needs_changes',
        'approved'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- STAP 4: Maak indexes aan voor performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_cases_owner ON cases(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created ON cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_counterparty ON cases(counterparty_user_id);

-- =====================================================
-- STAP 5: Voeg case_invitations tabel toe (indien niet bestaat)
-- =====================================================

CREATE TABLE IF NOT EXISTS case_invitations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    invited_by_user_id VARCHAR NOT NULL REFERENCES users(id),
    invited_email VARCHAR NOT NULL,
    invitation_code VARCHAR NOT NULL UNIQUE,
    status VARCHAR DEFAULT 'PENDING' NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    accepted_by_user_id VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_code ON case_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON case_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_invitations_case ON case_invitations(case_id);

-- =====================================================
-- STAP 6: Update saved_legislation tabel (indien nodig)
-- =====================================================

ALTER TABLE saved_legislation ADD COLUMN IF NOT EXISTS commentary JSONB;
ALTER TABLE saved_legislation ADD COLUMN IF NOT EXISTS commentary_sources JSONB;
ALTER TABLE saved_legislation ADD COLUMN IF NOT EXISTS commentary_generated_at TIMESTAMP;

-- =====================================================
-- STAP 7: Update analyses tabel met nieuwere kolommen
-- =====================================================

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS missing_info_struct JSONB;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS all_files JSONB;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS user_context JSONB;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS procedure_context JSONB;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS succes_kans_analysis JSONB;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS legal_advice_json JSONB;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS missing_information JSONB;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS jurisprudence_references JSONB;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS jurisprudence_search_results JSONB;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS legislation_search_results JSONB;

-- =====================================================
-- STAP 8: Update case_documents tabel
-- =====================================================

ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS public_url TEXT;
ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS document_analysis JSONB;
ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS analysis_status VARCHAR DEFAULT 'pending';

-- =====================================================
-- STAP 9: Update summons tabel met multi-step velden
-- =====================================================

ALTER TABLE summons ADD COLUMN IF NOT EXISTS template_version VARCHAR DEFAULT 'v1';
ALTER TABLE summons ADD COLUMN IF NOT EXISTS user_fields_json JSONB;
ALTER TABLE summons ADD COLUMN IF NOT EXISTS ai_fields_json JSONB;
ALTER TABLE summons ADD COLUMN IF NOT EXISTS readiness_json JSONB;
ALTER TABLE summons ADD COLUMN IF NOT EXISTS user_responses_json JSONB;
ALTER TABLE summons ADD COLUMN IF NOT EXISTS generation_error TEXT;
ALTER TABLE summons ADD COLUMN IF NOT EXISTS is_multi_step BOOLEAN DEFAULT FALSE;
ALTER TABLE summons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- =====================================================
-- STAP 10: Maak summons_sections tabel aan (indien niet bestaat)
-- =====================================================

CREATE TABLE IF NOT EXISTS summons_sections (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    summons_id VARCHAR NOT NULL REFERENCES summons(id) ON DELETE CASCADE,
    section_key VARCHAR NOT NULL,
    section_name TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    status VARCHAR DEFAULT 'pending',
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

-- =====================================================
-- STAP 11: Update templates tabel
-- =====================================================

ALTER TABLE templates ADD COLUMN IF NOT EXISTS raw_template_text TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS user_fields_json JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS ai_fields_json JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS field_occurrences JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS mindstudio_flow_name VARCHAR;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS mindstudio_flow_id VARCHAR;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS launch_variables JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS return_data_keys JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS is_multi_step BOOLEAN DEFAULT FALSE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS sections_config JSONB;

-- =====================================================
-- STAP 12: Maak chat_messages tabel aan
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    role VARCHAR NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_case ON chat_messages(case_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- =====================================================
-- STAP 13: Maak qna_items tabel aan
-- =====================================================

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

-- =====================================================
-- STAP 14: Maak judgment_texts tabel aan (cache voor Rechtspraak.nl)
-- =====================================================

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

-- =====================================================
-- STAP 15: Maak warranty tabellen aan
-- =====================================================

CREATE TABLE IF NOT EXISTS warranty_products (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    owner_user_id VARCHAR NOT NULL REFERENCES users(id),
    product_name TEXT NOT NULL,
    brand VARCHAR,
    model VARCHAR,
    serial_number VARCHAR,
    purchase_date TIMESTAMP,
    purchase_price DECIMAL(10,2),
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

-- =====================================================
-- KLAAR!
-- =====================================================
-- Als dit script succesvol is uitgevoerd, zou je app
-- nu moeten werken met de productie database.
-- 
-- Test door een nieuwe case aan te maken in de app.
-- =====================================================
