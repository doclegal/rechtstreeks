# Rechtstreeks.ai - Legal AI Platform

## Overview

Rechtstreeks.ai is a Dutch legal assistance platform that provides low-threshold legal help through AI-powered document analysis and automated legal document generation. The system guides users through the complete legal process from case intake to court proceedings, using a clear step-by-step approach with AI analysis of legal documents and automated generation of legal letters and summons.

The platform operates as a single-case focused application where users upload their legal documents, receive AI analysis, and proceed through various stages including demand letters, bailiff services, and court proceedings. The system is designed to make legal assistance accessible to Dutch users with minimal legal knowledge.

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

The frontend follows a single-page application architecture with a single-case-first UX approach. Users see their primary case immediately upon login with clear progress tracking through 9 distinct steps.

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

### Authentication & Authorization
- **Primary Auth**: Replit Auth with OpenID Connect
- **Session Management**: PostgreSQL-backed sessions with connect-pg-simple
- **Role System**: Three-tier access control (user, reviewer, admin)
- **Security**: HTTP-only cookies with CSRF protection

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

### Mock Services (MVP)
- **Bailiff Services**: Simulated deurwaarder (bailiff) integration with callback system
- **Court Integration**: Mock rechtbank (court) filing system
- **Notification System**: Placeholder for deadline warnings and process updates

The platform is designed to easily replace mock services with real integrations as it moves beyond MVP stage.