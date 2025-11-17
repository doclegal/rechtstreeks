# Rechtstreeks.ai - Legal AI Platform

## Overview
Rechtstreeks.ai is a Dutch legal assistance platform that leverages AI to provide accessible, low-threshold legal help. It automates legal document analysis and generation, guiding users through the entire legal process from case intake to court proceedings. The platform supports multiple concurrent legal cases per user, offering a step-by-step approach with AI-powered analysis and automated generation of legal letters and summons, aiming to empower users with minimal legal knowledge.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, built using Vite.
- **UI Components**: Shadcn/ui components with Radix UI primitives.
- **Styling**: TailwindCSS with a custom theme and Dutch design system.
- **State Management**: TanStack React Query for server state; Wouter for routing.
- **Forms**: React Hook Form with Zod validation.
- **Case Management**: React Context for selected case state, persisted with localStorage.
- **User Experience**: Single-page application with a multi-case approach, allowing users to manage multiple legal cases, track progress through 9 distinct steps, and navigate a dedicated menu for the active case.

### Backend
- **Runtime**: Node.js with Express.js server.
- **Language**: TypeScript with ES modules.
- **Database ORM**: Drizzle ORM for type-safe operations.
- **File Processing**: Multer for diverse file uploads (PDF, DOCX, images, email files).
- **Authentication**: Replit Auth integration with session management.
- **API Design**: RESTful API with comprehensive error handling.
- **Architecture**: Service-oriented, with separate services for AI analysis, file processing, and PDF generation.

### Database
- **Database**: PostgreSQL (via Replit Database or Neon).
- **Schema Management**: Drizzle migrations.
- **Key Tables**: Users (with roles), Cases (status tracking), Document storage, AI analyses (structured JSON), Generated letters/summons, Event logging.

### File Storage (Production)
- **Storage Backend**: Replit Object Storage via Google Cloud Storage client (production-ready).
- **Implementation**: `server/objectStorage.ts` - ObjectStorageService with sidecar credentials.
- **Security**: Time-bound signed URLs (1-hour expiry) for MindStudio document access.
- **ACL Management**: `server/objectAcl.ts` - Owner-based access control with defensive error handling.
- **Fallback**: Local filesystem for development/testing when object storage unavailable.

### Process Flow & AI Integration
- **Status Progression**: Automated transitions through 9 legal process steps.
- **Document Processing**: Multi-format parsing with text extraction.
- **AI Integration**: Structured legal analysis (fact extraction, issue identification, risk assessment).
- **Template System**: Configurable legal document templates with dynamic field population.
- **Legal Advice Generation**: AI-powered via MindStudio (Create_advice.flow), supporting structured JSON or plain text output, and rendered in a popup dialog on the Analysis page.
- **Missing Information Check (Dossier Controle)**: AI-powered consolidation of missing information via MindStudio (missing_info.flow) from various analysis sources into a unified checklist.
- **Summons Generation (Dagvaarding)**: AI-powered via MindStudio (CreateDagvaarding.flow), generating professional Dutch legal summons based on a strict JSON schema, sending complete case context without summarization, and generating PDFs via Puppeteer.
- **Q&A Generation (Veelgestelde Vragen)**: AI-powered via MindStudio (InfoQnA.flow) to generate case-specific Q&A pairs. Supports both initial generation and incremental "add more questions" functionality. When adding more questions, existing Q&A items are sent as `{{qna_history}}` to prevent duplicate questions. New questions are appended (not replaced) to maintain full history.

### Template Management System
- **Dynamic Templates**: Supports `[user_field]` for user input and `{ai_field}` for AI-generated content, defining JSON keys directly.
- **Automatic Field Extraction**: Template parser extracts user and AI fields.
- **Dynamic Rendering**: Renders templates with editable inputs for user fields and placeholders for AI fields.
- **MindStudio Integration**: Dynamic field mapping for AI fields via `returnDataKeys` to resolve nested paths in MindStudio responses.
- **Template Upload Flow**: Admin uploads templates, system extracts fields, admin configures MindStudio flow and field mappings.
- **Multi-Format Support**: Parses templates from .txt, .docx, or .pdf files.

### Jurisprudentie Integration (Pinecone Semantic Search)
- **Search Engine**: Pinecone serverless vector database with semantic search.
- **Index**: "rechtstreeks-dmacda9" index, host: rechtstreeks-dmacda9.svc.aped-4627-b74a.pinecone.io, namespace "ECLI_NL".
- **Data Source**: Pre-indexed Dutch court decisions (ECLI documents) with AI-generated summaries.
- **Semantic Search**: Dense vector search using multilingual-e5-large embeddings for conceptual similarity matching.
  - **Embedding Model**: multilingual-e5-large (1024 dimensions) optimized for multilingual legal text.
  - **inputType distinction**: Queries use `inputType: 'query'`, index uses `inputType: 'passage'` for optimal embedding compatibility.
  - **Performance**: Achieves 80-87% similarity scores for relevant Dutch legal queries.
- **AI Metadata Fields**: ai_inhoudsindicatie, ai_feiten, ai_geschil, ai_beslissing, ai_motivering (pre-computed, stored in Pinecone).
- **Relevance Filtering**: Configurable score threshold (default 10%, range 5-30%) to filter irrelevant results.
- **Result Limiting**: Configurable topK parameter (default 20, range 5-50) to limit Pinecone query results.
- **Display Limiting**: Configurable display filter (All/Top 3/Top 5/Top 10) to show only most relevant results.
- **Required Keywords**: Exact text match filter (case-insensitive) to ensure specific terms appear in results. Searches across all text fields including AI summaries. Multiple keywords can be specified (comma-separated) - all must be present.
- **Metadata Filtering**: Supports legal_area, court, procedure_type filters.
- **Advanced Settings UI**: Collapsible panel with sliders and buttons for real-time threshold and result limiting.
- **Score Display**: Each result shows its relevance score as a percentage badge for transparency.
- **Automatic Query Generation**: AI-powered (OpenAI GPT-4o-mini) feature that analyzes complete legal advice to generate optimized search queries AND required keywords.
  - Analyzes facts, legal issues, claims, defenses, and desired outcomes from user's case.
  - Generates search queries specifically designed to find jurisprudence that strengthens user's position.
  - Automatically identifies 1-3 essential keywords that MUST appear in results (exact match filter).
  - AI balances specificity (filtering irrelevant cases) vs. breadth (not excluding valuable precedents).
  - Example keywords: "huurovereenkomst" for rental disputes, "merkinbreuk" for trademark infringement.
  - Avoids overly generic keywords that would exclude too many relevant cases.
  - Optimized for semantic search with focus on legal concepts and key terms.
  - Endpoint: `/api/pinecone/generate-query` (requires caseId with legal advice, returns query + requiredKeywords array).
- **Implementation**: `server/pineconeService.ts` for vector operations, `server/routes.ts` for search and query generation endpoints.
- **Frontend**: `/jurisprudentie` page with manual search, automatic AI query generation, metadata filters, and AI summary display.
- **Cost Efficiency**: Pre-computed AI summaries eliminate runtime AI generation costs (~€0.0023 per summary).

### Authentication & Authorization
- **Primary Auth**: Replit Auth with OpenID Connect.
- **Session Management**: PostgreSQL-backed sessions.
- **Role System**: Three-tier access control (user, reviewer, admin).

## External Dependencies

### Cloud Services
- **Database**: Neon Serverless PostgreSQL.
- **Authentication**: Replit Auth service.
- **File Storage**: Replit App Storage.
- **Deployment**: Replit Autoscale.

### AI & Processing Services
- **Language Models**: OpenAI API (or configurable LLM).
- **Document Parsing**: `pdf-parse`, `mammoth`, `mailparser`.
- **PDF Generation**: Puppeteer.

### UI & Component Libraries
- **Component System**: Radix UI primitives.
- **Styling**: TailwindCSS.
- **Icons**: Lucide React.
- **Fonts**: Google Fonts (Inter, DM Sans, Fira Code).

### Development & Build Tools
- **Build System**: Vite.
- **Type Checking**: TypeScript.
- **Code Quality**: ESBuild.
- **Environment**: `dotenv`.

### Mock Services (MVP)
- **Bailiff Services**: Simulated `deurwaarder` (bailiff) integration.
- **Court Integration**: Mock `rechtbank` (court) filing system.
- **Notification System**: Placeholder for deadline warnings.