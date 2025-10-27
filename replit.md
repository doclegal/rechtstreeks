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

### Process Flow & AI Integration
- **Status Progression**: Automated transitions through 9 legal process steps.
- **Document Processing**: Multi-format parsing with text extraction.
- **AI Integration**: Structured legal analysis (fact extraction, issue identification, risk assessment).
- **Template System**: Configurable legal document templates with dynamic field population.
- **Legal Advice Generation**: AI-powered via MindStudio (Create_advice.flow), supporting structured JSON or plain text output, and rendered in an A4 document layout.
- **Missing Information Check (Dossier Controle)**: AI-powered consolidation of missing information via MindStudio (missing_info.flow) from various analysis sources into a unified checklist.
- **Summons Generation (Dagvaarding)**: AI-powered via MindStudio (CreateDagvaarding.flow), generating professional Dutch legal summons based on a strict JSON schema, sending complete case context without summarization, and generating PDFs via Puppeteer.

### Template Management System
- **Dynamic Templates**: Supports `[user_field]` for user input and `{ai_field}` for AI-generated content, defining JSON keys directly.
- **Automatic Field Extraction**: Template parser extracts user and AI fields.
- **Dynamic Rendering**: Renders templates with editable inputs for user fields and placeholders for AI fields.
- **MindStudio Integration**: Dynamic field mapping for AI fields via `returnDataKeys` to resolve nested paths in MindStudio responses.
- **Template Upload Flow**: Admin uploads templates, system extracts fields, admin configures MindStudio flow and field mappings.
- **Multi-Format Support**: Parses templates from .txt, .docx, or .pdf files.

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