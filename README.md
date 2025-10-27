# Rechtstreeks.ai - Juridische Hulp Platform

## Wat is Rechtstreeks.ai?

Rechtstreeks.ai is een Nederlands online platform dat juridische hulp toegankelijk maakt voor iedereen. Het platform begeleidt gebruikers stap-voor-stap door het volledige juridische proces - van het indienen van een zaak tot aan rechtbankprocedures - met behulp van kunstmatige intelligentie (AI).

## Voor wie is dit bedoeld?

Het platform is specifiek ontwikkeld voor Nederlandse gebruikers die:
- Juridische hulp nodig hebben maar weinig juridische kennis hebben
- Kosteneffectieve alternatieven zoeken voor dure advocaten
- Snel en eenvoudig juridische documenten willen opstellen
- Inzicht willen in de kans van slagen van hun zaak

## Wat kun je ermee doen?

### 1. **Zaakbeheer**
- Maak meerdere juridische zaken aan en beheer deze centraal
- Bekijk de voortgang van elke zaak via een duidelijk dashboard
- Alle informatie (partijen, bedragen, documenten) op één plek

### 2. **Document Upload & Analyse**
- Upload relevante documenten (PDF, Word, afbeeldingen, e-mails)
- AI analyseert automatisch de documenten en haalt belangrijke informatie eruit
- Krijg een overzicht van feiten, juridische punten en bewijsmateriaal

### 3. **AI-Gedreven Juridische Analyse**
- **Kantonzaak Check**: Bepaal of je zaak geschikt is voor de kantonrechter
- **Volledige Analyse**: Uitgebreide beoordeling met:
  - Kans op succes (percentage)
  - Sterke en zwakke punten van je zaak
  - Ontbrekende informatie of bewijs
  - Juridische duiding volgens Nederlands recht
- **Juridisch Advies**: Gedetailleerde vervolgstappen en aanbevelingen

### 4. **Ontbrekende Informatie Bijhouden**
- Het systeem identificeert wat er nog ontbreekt in je dossier
- Voeg tekst, documenten of notities toe per ontbrekend item
- Markeer items als "niet beschikbaar" indien van toepassing

### 5. **Automatische Brieven Genereren**
- Genereer professionele juridische brieven:
  - Laatste aanmaning
  - Ingebrekestelling
  - Informatieverzoek
- Kies de toon (zakelijk-vriendelijk, formeel, streng)
- Download als PDF of bekijk in je browser

### 6. **Dagvaarding Opstellen**
- Volledige dagvaarding volgens officieel Nederlands model
- AI genereert alle secties met case-specifieke content:
  - Partijen en vertegenwoordiging
  - Feitelijke grondslag
  - Juridische grondslag
  - Vorderingen met bedragen
  - Proceskosten
- Bewerkbare velden voor laatste aanpassingen
- Download als print-klare PDF

### 7. **Mock Integraties** (MVP fase)
- Deurwaarder simulatie voor betekening
- Rechtbank simulatie voor indiening

## Hoe werkt het technisch?

### Architectuur

**Frontend (gebruikersinterface)**
- Gebouwd met React en TypeScript
- Moderne UI componenten via Shadcn/ui en Tailwind CSS
- Single-page applicatie voor snelle navigatie
- Responsive design voor desktop en mobiel

**Backend (server)**
- Node.js met Express.js
- TypeScript voor type-veiligheid
- RESTful API architectuur
- Sessie-gebaseerde authenticatie via Replit Auth

**Database**
- PostgreSQL voor betrouwbare data-opslag
- Drizzle ORM voor type-safe database operaties
- Automatische migraties voor schema updates

### AI & Document Verwerking

**AI Integratie**
- MindStudio flows voor gestructureerde juridische analyse
- OpenAI API voor tekst generatie en begrip
- Specifieke flows:
  - `RKOS.flow`: Kantonzaak check en volledige analyse
  - `Create_advice.flow`: Juridisch advies generatie
  - `CreateDagvaarding.flow`: Dagvaarding secties genereren
  - `missing_info.flow`: Ontbrekende informatie consolideren

**Document Parsing**
- PDF extractie via pdf-parse
- Word documenten via mammoth
- E-mail parsing via mailparser
- Automatische tekst extractie en categorisatie

**PDF Generatie**
- HTML naar PDF conversie met Puppeteer
- Print-klare professionele documenten
- A4 formaat met juiste marges

### Data Flow

1. **Gebruiker upload documenten** → Backend parseert tekst → Opslag in database
2. **Analyse aanvraag** → Volledige case context naar MindStudio → Gestructureerde JSON response → Opslag + weergave
3. **Brief/Dagvaarding genereren** → Template + case data → MindStudio AI generatie → HTML/PDF output
4. **Ontbrekende info check** → Analyse van meerdere bronnen → Geconsolideerde checklist → Gebruiker vult aan

### Beveiliging & Privacy

- HTTPS encryptie voor alle communicatie
- Session-based authenticatie met HTTP-only cookies
- Database-backed sessies voor betrouwbaarheid
- Rol-gebaseerde toegangscontrole (gebruiker, reviewer, admin)
- Alle gebruikersdata gescheiden per account

### Opslag & Hosting

- Document opslag via Replit App Storage
- Database hosting via Neon (serverless PostgreSQL)
- Deployment via Replit Autoscale
- Optioneel Reserved VM voor productie

## Technische Stack Samenvatting

| Onderdeel | Technologie |
|-----------|-------------|
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS, Shadcn/ui |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (Neon) |
| ORM | Drizzle ORM |
| AI | MindStudio, OpenAI |
| Document Parsing | pdf-parse, mammoth, mailparser |
| PDF Generatie | Puppeteer |
| Authenticatie | Replit Auth (OpenID) |
| Hosting | Replit |

## Development Status

**Huidige Fase**: MVP (Minimum Viable Product)

**Beschikbare Functies**:
- ✅ Multi-case management
- ✅ Document upload en parsing
- ✅ AI juridische analyse (RKOS flow)
- ✅ Juridisch advies generatie
- ✅ Ontbrekende informatie tracking
- ✅ Brief generatie (3 types)
- ✅ Volledige dagvaarding met dynamische templates
- ✅ Dashboard met voortgangsweergave

**Mock Services** (vervangen in productie):
- 🔶 Deurwaarder integratie (gesimuleerd)
- 🔶 Rechtbank filing systeem (gesimuleerd)
- 🔶 Notificatie systeem (placeholder)

## Voor Developers

### Project Starten

```bash
npm install
npm run dev
```

### Database Migratie

```bash
npm run db:push
```

### Environment Variables

Zie `.env` voor vereiste configuratie:
- `DATABASE_URL`: PostgreSQL connectie string
- `SESSION_SECRET`: Voor sessie encryptie
- MindStudio API configuratie
- OpenAI API keys

### Code Structuur

```
├── client/          # Frontend React applicatie
│   ├── src/
│   │   ├── pages/   # Route paginas
│   │   ├── components/  # UI componenten
│   │   └── hooks/   # React hooks
├── server/          # Backend Express server
│   ├── routes.ts    # API endpoints
│   ├── services/    # Business logic
│   └── storage.ts   # Database interface
└── shared/          # Gedeelde types en schema
    └── schema.ts    # Database schema (Drizzle)
```

### Key Design Patterns

- **Service-Oriented**: Logica gescheiden in services (AI, files, PDF, templates)
- **Type-Safe**: TypeScript overal + Drizzle ORM
- **Schema-First**: Shared schema definities tussen frontend/backend
- **Context API**: React Context voor actieve zaak management
- **Query-First**: TanStack Query voor server state

## Licentie & Contact

Dit is een MVP platform ontwikkeld voor Nederlandse juridische dienstverlening.

Voor vragen of feedback, neem contact op via het Replit project.
