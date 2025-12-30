# Environment Variables Documentation

This document describes all environment variables used by the Rechtstreeks application.

## Required Secrets

### Supabase Authentication & Database

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project API URL (https://<project>.supabase.co) | Yes |
| `SUPABASE_SECRET_KEY` | Supabase service role key - ADMIN ONLY, never expose to client | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key - used for user-scoped clients with RLS | Yes |

**Security Notes:**
- `SUPABASE_SECRET_KEY` (service role): Bypasses RLS. Only used for:
  - Invitation acceptance (before user becomes counterparty)
  - Public case info endpoints
  - Admin/system operations
- `SUPABASE_ANON_KEY`: Used with user JWTs for RLS-protected operations
- Never expose service role key to frontend or logs

### Neon PostgreSQL Database

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Yes |
| `PGHOST` | PostgreSQL host (auto-set by Replit) | Auto |
| `PGPORT` | PostgreSQL port (auto-set by Replit) | Auto |
| `PGUSER` | PostgreSQL user (auto-set by Replit) | Auto |
| `PGPASSWORD` | PostgreSQL password (auto-set by Replit) | Auto |
| `PGDATABASE` | PostgreSQL database name (auto-set by Replit) | Auto |

### Session Management

| Variable | Description | Required |
|----------|-------------|----------|
| `SESSION_SECRET` | Secret for Express session encryption | Yes |

## External API Keys

### AI/LLM Services

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT models | Yes |
| `MINDSTUDIO_API_KEY` | MindStudio API key for document analysis | Optional |
| `MS_AGENT_APP_ID` | MindStudio agent application ID | Optional |
| `MINDSTUDIO_WORKFLOW` | MindStudio workflow configuration | Optional |
| `MINDSTUDIO_WORKER_ID` | MindStudio worker ID | Optional |
| `MS_FLOW_BEVOEGDHEID_ID` | MindStudio competence flow ID | Optional |

### Vector Search (Pinecone)

| Variable | Description | Required |
|----------|-------------|----------|
| `PINECONE_API_KEY` | Pinecone API key | Optional |
| `PINECONE_INDEX_NAME` | Pinecone index name | Optional |
| `PINECONE_ENVIRONMENT` | Pinecone environment | Optional |
| `VITE_PINECONE_INDEX_HOST` | Pinecone index host (frontend access) | Optional |

### Web Search

| Variable | Description | Required |
|----------|-------------|----------|
| `SERPER_API_KEY` | Serper API key for web search | Optional |

### Government APIs

| Variable | Description | Required |
|----------|-------------|----------|
| `DSO_API_KEY` | Dutch Government DSO API key | Optional |
| `DSO_BASE_URL` | DSO API base URL | Optional |

## Object Storage

| Variable | Description | Required |
|----------|-------------|----------|
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Replit Object Storage bucket ID | Auto |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Public file search paths | Auto |
| `PRIVATE_OBJECT_DIR` | Private object directory | Auto |

## Access Control

| Variable | Description | Required |
|----------|-------------|----------|
| `ALLOWED_EMAILS` | Comma-separated list of allowed user emails | Optional |

## Replit Environment (Auto-populated)

| Variable | Description |
|----------|-------------|
| `REPLIT_DOMAINS` | Replit deployment domains |
| `REPLIT_DEV_DOMAIN` | Replit development domain |
| `REPL_ID` | Replit project ID |

## Authentication Flow

### User Request Flow (RLS Protected)
1. Frontend authenticates with Supabase Auth
2. Supabase returns access token (JWT)
3. Frontend sends `Authorization: Bearer <token>` header
4. Backend validates token and creates user-scoped client with `SUPABASE_ANON_KEY`
5. RLS policies filter data based on `auth.uid()` from the JWT

### Admin Operation Flow (RLS Bypassed)
1. Backend uses `SUPABASE_SECRET_KEY` to create admin client
2. Admin client bypasses RLS for system operations
3. Used only for: invitation acceptance, public endpoints, background jobs

## Security Best Practices

1. **Never log secrets** - Ensure no console.log contains API keys
2. **Service role is server-only** - `SUPABASE_SECRET_KEY` never touches frontend
3. **Validate tokens server-side** - All auth checks happen in `isAuthenticated` middleware
4. **Use anon key with JWTs** - User operations always include user's access token
5. **RLS is defense in depth** - Even with valid token, user only sees their data
