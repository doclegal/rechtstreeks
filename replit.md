# Rechtstreeks.ai - Legal AI Platform

## Overview
Rechtstreeks.ai is a Dutch legal assistance platform that uses AI to provide accessible legal help. It automates legal document analysis and generation, guiding users through the entire legal process from case intake to court proceedings. The platform supports managing multiple legal cases concurrently, offering a step-by-step approach with AI-powered analysis and automated generation of legal letters and summons, aiming to empower users with minimal legal knowledge.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, built using Vite.
- **UI Components**: Shadcn/ui with Radix UI primitives.
- **Styling**: TailwindCSS with a custom theme and Dutch design system.
- **State Management**: TanStack React Query for server state; Wouter for routing.
- **Forms**: React Hook Form with Zod validation.
- **User Experience**: Single-page application supporting multi-case management, 9-step progress tracking, and dedicated case menus.

### Backend
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **Database ORM**: Drizzle ORM.
- **File Processing**: Multer for diverse file uploads (PDF, DOCX, images, email).
- **Authentication**: Replit Auth integration with session management.
- **API Design**: RESTful API with error handling.
- **Architecture**: Service-oriented (AI analysis, file processing, PDF generation).

### Database
- **Database**: PostgreSQL (Replit Database or Neon).
- **Schema Management**: Drizzle migrations.
- **Key Tables**: Users, Cases, Document storage, AI analyses, Generated letters/summons, Event logging.

### File Storage
- **Storage Backend**: Replit Object Storage via Google Cloud Storage client.
- **Security**: Time-bound signed URLs (1-hour expiry) for document access.
- **ACL Management**: Owner-based access control.

### Process Flow & AI Integration
- **Status Progression**: Automated transitions through 9 legal process steps.
- **Document Processing**: Multi-format parsing with text extraction.
- **RKOS Analysis (Redelijke Kans Op Succes)**: Primary analysis via MindStudio (RKOS.flow) providing chance of success, confidence, strengths, weaknesses, missing elements, and recommendations. Stored in `analyses.succesKansAnalysis` and displayed in UI.
- **Legal Advice Generation**: AI-powered via MindStudio (Create_advice.flow), requires RKOS analysis, supports JSON/plain text output.
- **Missing Information Check**: AI-powered consolidation via MindStudio (missing_info.flow) for a unified checklist.
- **Summons Generation**: AI-powered via MindStudio (CreateDagvaarding.flow), generates professional Dutch legal summons as PDFs via Puppeteer.
- **Q&A Generation**: AI-powered via MindStudio (InfoQnA.flow) for case-specific Q&A, supports incremental additions.
- **Letter Generation**: AI-powered via MindStudio (DraftFirstLetter.flow), generates professional legal letters using dynamic templates and integrated jurisprudence references.
- **Template Management System**: Dynamic templates with `[user_field]` and `{ai_field}`, automatic field extraction, dynamic rendering, and MindStudio integration for field mapping. Supports .txt, .docx, .pdf template formats.

### Legislation Search & Commentary
- **Search Engine**: Pinecone vector database with "laws-current" namespace for Dutch legislation.
- **Multi-stage Pipeline**: Semantic search → BGE reranker → Article grouping by leden.
- **Tekst & Commentaar Feature**: AI-generated Dutch legal commentary for statutory articles.
  - **Article Retrieval**: Fetches complete articles from Pinecone with metadata filtering.
  - **Provision Analysis**: OpenAI GPT-4o analyzes article for key issues and search questions.
  - **Web Sources**: Serper.dev integration for doctrinal/literature sources (universities, law firms).
  - **Case Law**: Searches ECLI_NL and WEB_ECLI namespaces for Hoge Raad and Gerechtshof decisions.
  - **Commentary Generation**: AI generates structured Tekst & Commentaar-style explanation with sections: short_intro, systematiek, kernbegrippen, reikwijdte_en_beperkingen.
  - **Caching**: In-memory cache with 24h TTL to prevent redundant generation.
  - **UI Display**: Right column shows statutory text, commentary sections, case law references, and online sources.

### Jurisprudence Integration
- **Search Engine**: Pinecone serverless vector database with semantic search.
- **Index**: "rechtstreeks-dmacda9" (namespace "ECLI_NL") using multilingual-e5-large embeddings.
- **Data Source**: Pre-indexed Dutch court decisions (ECLI documents) with AI-generated summaries.
- **Retrieval Strategy**: Two-pass with Pinecone query (topK=200, threshold=12%), adjusted scoring (similarity + court weighting + keyword bonuses), and Pinecone native reranker (bge-reranker-v2-m3) for top 20 candidates.
- **Filtering**: Configurable score threshold, topK parameter, display filters, required keywords, and metadata filters (legal_area, court, procedure_type).
- **Automatic Query Generation**: AI-powered (OpenAI GPT-4o-mini) to generate optimized search queries and required keywords from legal advice.
- **Full Judgment Text Retrieval**: Rechtspraak.nl API integration with database caching for full judgment texts, displayed in a dialog.
- **AI-Powered Reference Generation**: "Genereer verwijzing" feature uses OpenAI GPT-4o to analyze full judgment texts against legal advice to generate relevant ECLI references with one-paragraph explanations.
  - **Data Structure**: References stored as `[{ecli: string, court: string, explanation: string}]` in `analyses.jurisprudenceReferences` JSONB field
  - **Court Instance**: Each reference includes the court instance (e.g., "Hoge Raad", "Gerechtshof Amsterdam", "Rechtbank Rotterdam")
  - **UI Display**: Saved references shown in collapsible "Opgeslagen Verwijzingen" section on Jurisprudentie page with ECLI badge, court badge, and explanation
  - **MindStudio Integration**: References automatically sent to DraftFirstLetter.flow as `{{jurisprudence_references}}` input variable with ecli, court, and explanation fields
  - **Fresh State**: Always persists current references (including empty array) to prevent stale citations in generated letters
  - **Cache Invalidation**: Query cache automatically refreshed after reference generation for immediate UI update

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
- **Vector Database**: Pinecone.

### AI & Processing Services
- **Language Models**: OpenAI API (or configurable LLM).
- **Document Parsing**: `pdf-parse`, `mammoth`, `mailparser`.
- **PDF Generation**: Puppeteer.
- **Jurisprudence API**: Rechtspraak.nl Open Data API.

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