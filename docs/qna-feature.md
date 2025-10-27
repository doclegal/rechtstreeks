# Q&A Feature - Veelgestelde Vragen

## Overzicht

De Q&A feature genereert automatisch zaakspecifieke vragen en antwoorden via MindStudio InfoQnA.flow. Deze feature helpt gebruikers snel antwoorden te vinden op veelvoorkomende vragen over hun specifieke zaak.

## Architectuur

### Database Schema
- **Tabel**: `qna_items`
- **Velden**:
  - `id`: Primary key (UUID)
  - `caseId`: Foreign key naar cases tabel
  - `question`: Text - de vraag
  - `answer`: Text - het antwoord
  - `order`: Integer - display volgorde
  - `createdAt`: Timestamp
  - `updatedAt`: Timestamp

### Backend Services

#### qnaService.ts
Bevat de volgende functies:

1. **buildQnAContext(caseId)**
   - Verzamelt volledige zaak context
   - Inclusief: zaakgegevens, documenten, RKOS analyse, juridisch advies
   - Zelfde context als Chat.flow en Create_advice.flow

2. **callInfoQnAFlow(caseId)**
   - Roept MindStudio InfoQnA.flow aan
   - Gebruikt MS_AGENT_APP_ID (zelfde als andere flows)
   - Timeout: 3 minuten
   - Verwacht output: `qna_pairs` array met `{question, answer}` objecten

3. **saveQnAPairs(caseId, pairs)**
   - Verwijdert bestaande Q&A voor de zaak
   - Slaat nieuwe Q&A pairs op met volgorde

4. **getQnAItems(caseId)**
   - Haalt Q&A items op gesorteerd op volgorde

### API Endpoints

#### GET /api/cases/:id/qna
- Haalt Q&A items op voor een zaak
- Vereist: Authenticatie + ownership verificatie
- Returns: `{ items: QnaItem[] }`

#### POST /api/cases/:id/generate-qna
- Genereert nieuwe Q&A voor een zaak
- Vereist: Authenticatie + ownership verificatie
- Roept MindStudio InfoQnA.flow aan
- Returns: `{ success: true, items: QnaItem[], count: number }`

### Frontend Component

#### CaseQnA.tsx
- **UI**: Accordion component (shadcn/ui)
- **Features**:
  - Automatisch ophalen van bestaande Q&A
  - "Genereer Q&A" knop voor eerste keer
  - "Vernieuwen" knop om Q&A te updaten
  - Collapsible vragen met expandable antwoorden
  - Loading states tijdens generatie
  - Empty state met instructies

#### Integration
- Geïntegreerd in **Analysis page** onderaan
- Alleen zichtbaar als `caseId` beschikbaar is
- Data-testid voor testing: `section-qna`

## MindStudio InfoQnA.flow

### Input Variables
```json
{
  "input_json": {
    "zaakgegevens": { ... },
    "dossier": {
      "documents": [...],
      "document_count": N
    },
    "analyse": {
      "type": "rkos",
      "data": { ... }
    },
    "juridisch_advies": {
      "type": "create_advice",
      "data": { ... }
    }
  }
}
```

### Expected Output Format
```json
{
  "result": {
    "qna_pairs": [
      {
        "question": "Wat is mijn kans van slagen?",
        "answer": "Op basis van uw dossier heeft u een kans van 95%..."
      },
      {
        "question": "Welk bewijs heb ik?",
        "answer": "U heeft de volgende bewijsstukken..."
      }
    ]
  }
}
```

Alternative field name ook supported: `qna_items`

### Configuratie
- **workerId**: `MS_AGENT_APP_ID` (zelfde als andere flows)
- **API Key**: `MINDSTUDIO_API_KEY`
- **workflow**: "InfoQnA.flow" (case-sensitive!)
- **Timeout**: 180 seconden (3 minuten)

## Gebruik

### Voor Gebruikers
1. Ga naar **Analyse** pagina
2. Scroll naar beneden naar "Veelgestelde Vragen"
3. Klik op **"Genereer Q&A"** (eerste keer) of **"Vernieuwen"** (update)
4. Wacht 1-2 minuten terwijl AI de Q&A genereert
5. Klik op vragen om antwoorden te expanderen

### Update Triggers
Q&A kan opnieuw gegenereerd worden wanneer:
- Nieuwe documenten worden toegevoegd
- Analyse wordt geüpdatet
- Juridisch advies wordt toegevoegd
- Gebruiker handmatig op "Vernieuwen" klikt

## Error Handling

### Geen Q&A gegenereerd
```json
{
  "message": "Geen Q&A gegenereerd - mogelijk te weinig informatie in het dossier",
  "items": []
}
```
Dit gebeurt als:
- Zaak heeft geen documenten
- Analyse is nog niet uitgevoerd
- MindStudio kan geen relevante vragen bedenken

### MindStudio API fouten
- 503: MindStudio configuratie problemen
- Timeout: AI reageert niet binnen 3 minuten
- Parse errors: Onverwachte output format

## UI/UX Design

### Accordion Pattern
- **Q:** label in primaire kleur
- **A:** label in primaire kleur
- Expandable antwoorden
- Smooth collapse/expand animaties
- Whitespace preservation in antwoorden

### States
1. **Loading**: Spinner tijdens ophalen
2. **Empty**: Alert met instructies
3. **Generating**: Loading overlay met "1-2 minuten" bericht
4. **Populated**: Accordion met vragen

### Responsive Design
- Full width op alle schermen
- Mobile-friendly collapsible design
- Touch-friendly accordion triggers

## Toekomstige Verbeteringen

1. **Auto-update**: Q&A automatisch regenereren na nieuwe analyse
2. **Favoriet vragen**: Gebruikers kunnen vragen pinnen
3. **Custom vragen**: Gebruikers kunnen eigen vragen toevoegen
4. **Export**: Q&A exporteren naar PDF
5. **Zoekfunctie**: Zoeken binnen Q&A items
6. **Categories**: Groeperen van vragen per categorie

## Testing

### Manual Testing
1. Maak een zaak aan
2. Upload documenten
3. Voer analyse uit
4. Ga naar Analysis pagina
5. Klik "Genereer Q&A"
6. Verificeer dat vragen verschijnen
7. Test expand/collapse functionaliteit

### Test Cases
- [ ] Q&A genereren voor nieuwe zaak
- [ ] Q&A updaten na nieuwe documenten
- [ ] Empty state wanneer geen Q&A
- [ ] Loading state tijdens generatie
- [ ] Error handling bij API fouten
- [ ] Accordion expand/collapse
- [ ] Responsive design op mobile
