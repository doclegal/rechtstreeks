# Rechtstreeks.ai - Legal AI Platform

## Overview

Rechtstreeks.ai is a Dutch legal assistance platform that provides low-threshold legal help through AI-powered document analysis and automated legal document generation. The system guides users through the complete legal process from case intake to court proceedings, using a clear step-by-step approach with AI analysis of legal documents and automated generation of legal letters and summons.

The platform supports multiple concurrent legal cases per user. Users start at a cases overview where they can view all their cases, select one to work with, or create a new case. Once a case is selected, they can proceed through various stages including document upload, AI analysis, demand letters, bailiff services, and court proceedings. The system is designed to make legal assistance accessible to Dutch users with minimal legal knowledge.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, built using Vite
- **UI Components**: Shadcn/ui components with Radix UI primitives
- **Styling**: TailwindCSS with custom theme and Dutch design system
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod schema validation
- **Case Management**: React Context for selected case state with localStorage persistence

The frontend follows a single-page application architecture with a multi-case UX approach. After login, users land on the cases overview page where they can:
- View all their legal cases as tiles with key information
- Select a case to work with (selection persists via localStorage)
- Create new cases

Once a case is selected, users can work through the case lifecycle with clear progress tracking through 9 distinct steps. The selected case is displayed in the header and all menu items (Mijn Zaak, Analyse, Brieven, Dagvaarding) operate on the active case. If no case is explicitly selected, the system automatically uses the most recently created case.

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **File Processing**: Multer for file uploads with support for PDF, DOCX, images, and email files
- **Authentication**: Replit Auth integration with session management
- **API Design**: RESTful API with comprehensive error handling

The backend uses a service-oriented architecture with separate services for AI analysis, file processing, PDF generation, and mock integrations.

### Database Design
- **Database**: PostgreSQL (via Replit Database or Neon)
- **Schema Management**: Drizzle migrations with shared schema definitions
- **Key Tables**: 
  - Users with role-based access (user, reviewer, admin)
  - Cases with status progression tracking
  - Document storage with extracted text
  - AI analyses with structured JSON results
  - Generated letters and summons with templates
  - Event logging for audit trails

The database schema supports a complete legal case lifecycle with document versioning, template management, and integration webhooks.

### Process Flow Management
- **Status Progression**: Automated transitions through 9 legal process steps
- **Document Processing**: Multi-format file parsing with text extraction
- **AI Integration**: Structured legal analysis with fact extraction, issue identification, and risk assessment
- **Template System**: Configurable legal document templates with dynamic field population
- **Mock Integrations**: Simulated bailiff and court services for MVP testing

### Legal Advice Generation
- **MindStudio Integration**: AI-powered legal advice generation via Create_advice.flow
- **Flexible Output Formats**: Supports multiple response structures from MindStudio:
  - **advisory_text format**: Single text field containing complete advisory
  - **Structured JSON format** (current): 8 separate fields:
    - `samenvatting_advies`: Executive summary of key points
    - `het_geschil`: Description of the dispute/conflict
    - `de_feiten`: Factual overview of the case
    - `betwiste_punten`: Explanation of unclear or disputed elements
    - `beschikbaar_bewijs`: List of supporting documents and references
    - `ontbrekend_bewijs`: Missing or incomplete evidence and why it matters
    - `juridische_duiding`: Legal interpretation, reasoning, and assessment under Dutch law
    - `vervolgstappen`: Concrete recommended next steps and actions
- **Input Context**: Receives complete case data including full analysis, documents, parties, facts, legal analysis, and risk assessment (same format as RKOS.flow)
- **Storage**: legal_advice_json stored in analyses.legalAdviceJson field (supports both formats)
- **API Endpoint**: POST /api/cases/:id/generate-advice with intelligent parsing of flowResult.result.legal_advice_json
- **Prerequisites**: Requires existing full analysis (mindstudio-full-analysis)
- **Rendering**: A4 document layout with professional formatting
  - **advisory_text**: Displays single text with whitespace preservation
  - **Structured JSON**: Renders sections with highlights and clear headings
  - Copy and download functionality for both formats
- **Backwards Compatibility**: Supports legacy legal_advice_full text format for older analyses
- **Timeout**: 5-minute timeout for longer AI-generated text output
- **Error Handling**: Comprehensive error messages for missing analysis, service unavailability, and timeouts

### Authentication & Authorization
- **Primary Auth**: Replit Auth with OpenID Connect
- **Session Management**: PostgreSQL-backed sessions with connect-pg-simple
- **Role System**: Three-tier access control (user, reviewer, admin)
- **Security**: HTTP-only cookies with CSRF protection

### Summons Generation (Dagvaarding)
- **Template System**: Professional Dutch legal summons following official "Model dagvaarding" structure
- **Data Structure**: Strict SummonsV1 JSON schema with Zod validation
- **MindStudio Integration**: AI-powered summons generation via CreateDagvaarding.flow
- **Complete Context Payload**: NO summarization - sends entire case context including:
  - Full party information (claimant/defendant with all details)
  - Complete court information and session details
  - All claims with full descriptions and amounts
  - Complete user-entered fields (no filtering)
  - Full facts array (known/disputed/unclear with labels)
  - Complete legal basis with all articles and notes
  - Full evidence registry with metadata
  - **Document Chunking**: Large documents split into 6000-8000 char chunks with sequential indexing
  - Complete analysis JSON (no filtering or compression)
  - All communications and timeline data
  - Control flags (no_summarize, allow_long_context, dont_invent)
- **Backward Compatibility**: Supports both complete payload and legacy summarized format
- **Mock Fallback**: Environment-gated mock responses for development (USE_MINDSTUDIO_SUMMONS_MOCK=true)
- **PDF Generation**: HTML-to-PDF conversion using Puppeteer with print-ready styling
- **Frontend**: React-based preview with download functionality
- **Validation**: Server-side JSON schema validation with comprehensive error handling
- **Error Handling**: Returns 503 with clear configuration messages for MindStudio setup issues

The summons feature requires an existing analysis (kanton check or full analysis) before generation. The complete context payload ensures MindStudio receives all available case data without any summarization or truncation, enabling rich, case-specific legal text generation.

### Template Management System

#### Dynamic Template System (New)
The platform now supports fully dynamic templates where field names in the template directly determine JSON keys:

- **Field Marker Format**:
  - `[field_name]` - User input fields (e.g., `[eiser_naam]`, `[bedrag]`)
  - `{field_name}` - AI-generated fields (e.g., `{result_analyses}`, `{juridische_gronden}`)
  - The exact text in brackets becomes the JSON key

- **Automatic Field Extraction**: Template parser (`server/services/templateParser.ts`) extracts:
  - All `[user_field]` markers → userFieldsJson array with field names and occurrence counts
  - All `{ai_field}` markers → aiFieldsJson array with field names and occurrence counts
  - Field positions for validation and rendering

- **Dynamic Rendering**: `DynamicTemplateRenderer` component renders templates based on parsed fields:
  - User fields render as editable inputs (yellow highlight when empty)
  - AI fields render as placeholders until filled by MindStudio (amber highlight)
  - Supports both inline and multiline fields based on field naming conventions
  - Handles numeric values including zero correctly

- **MindStudio Integration**: Dynamic field mapping via returnDataKeys:
  - Template defines mapping: `{key: "template_field", value: "mindstudio.response.path"}`
  - System resolves nested paths in MindStudio response (e.g., "sections.grounds.intro")
  - Arrays are automatically joined with newlines
  - Falls back to legacy hardcoded mapping for backwards compatibility

- **Template Upload Flow**:
  1. Admin uploads template text/file via POST /api/templates/parse
  2. System extracts `[user]` and `{ai}` field markers
  3. Admin configures MindStudio flow name and returnDataKeys mapping
  4. Template is ready for use with dynamic field population

- **Multi-Format Support**: Parse templates from .txt, .docx, or .pdf files with dynamic imports (pdf-parse uses lazy loading to avoid import issues)

- **Template Detail View** (Admin only): Expandable UI component showing:
  - Parsed [user] fields with occurrence counts
  - Parsed {ai} fields with occurrence counts
  - Flow configuration form with save functionality
  - Visual mapping between {ai} fields and return data
  - Template deletion with confirmation dialog

- **Dynamic Flow Selection**: Summons generation uses the linked flow from selected template
  - Defaults to "CreateDagvaarding.flow" if no flow configured
  - Validates flow name is non-empty before use
  - Trims whitespace and prevents empty flow configurations

- **API Endpoints**:
  - POST /api/templates/parse - Parse and register template from text/file
  - PATCH /api/templates/:id/flow - Update flow linking configuration
  - DELETE /api/templates/:id - Delete template (admin only)
  - GET /api/templates/:id - Retrieve full template with flow config

- **Backward Compatibility**: Legacy v1, v2, v3 templates continue to work with hardcoded field mappings

## External Dependencies

### Cloud Services
- **Database**: Neon Serverless PostgreSQL for production data storage
- **Authentication**: Replit Auth service for user management
- **File Storage**: Replit App Storage with structured paths for document storage
- **Deployment**: Replit Autoscale with optional Reserved VM for production

### AI & Processing Services
- **Language Models**: OpenAI API or configurable LLM provider for legal document analysis
- **Document Parsing**: 
  - pdf-parse for PDF text extraction
  - mammoth for DOCX processing
  - mailparser for email file processing
- **PDF Generation**: Puppeteer for generating legal documents from HTML templates

### UI & Component Libraries
- **Component System**: Radix UI primitives for accessible components
- **Styling**: TailwindCSS with PostCSS processing
- **Icons**: Lucide React icon library
- **Fonts**: Google Fonts integration (Inter, DM Sans, Fira Code)

### Development & Build Tools
- **Build System**: Vite for fast development and optimized production builds
- **Type Checking**: TypeScript with strict configuration
- **Code Quality**: ESBuild for server-side bundling
- **Development**: Replit-specific plugins for development experience
- **Environment**: dotenv for environment variable management (loaded via dotenv/config in server/index.ts)

### Mock Services (MVP)
- **Bailiff Services**: Simulated deurwaarder (bailiff) integration with callback system
- **Court Integration**: Mock rechtbank (court) filing system
- **Notification System**: Placeholder for deadline warnings and process updates

The platform is designed to easily replace mock services with real integrations as it moves beyond MVP stage.