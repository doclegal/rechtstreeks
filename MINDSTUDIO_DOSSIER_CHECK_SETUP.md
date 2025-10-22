# MindStudio Dossier_check.flow - Setup Documentatie

Deze documentatie beschrijft hoe de **Dossier_check.flow** in MindStudio moet worden geconfigureerd om automatische documentanalyse uit te voeren voor elk geüpload document in Rechtstreeks.ai.

## Overzicht

De Replit applicatie stuurt **automatisch na elke succesvolle file upload** een on-demand API call naar MindStudio om het document te analyseren. De analyse resultaten worden direct onder het document getoond in de UI.

## MindStudio Agent Taak

De AI Agent in MindStudio moet:

1. **Lezen en interpreteren** van het geüploade document
2. **Controleren** of het document leesbaar, begrijpelijk en compleet is
3. **Identificeren** van het documenttype (bijv. factuur, contract, bewijs van betaling, correspondentie, etc.)
4. **Evalueren** of het document logisch bij de zaak hoort (gebruikmakend van de volledige zaakcontext)
5. **Noteer** een waarschuwing als het document niet relevant lijkt te zijn voor de zaak

## Input Structuur

De Replit app stuurt de volgende JSON payload naar MindStudio:

```json
{
  "document": {
    "filename": "factuur_2024_03_15.pdf",
    "type": "application/pdf",
    "size": 245678,
    "text": "[Geëxtraheerde tekst uit het document...]"
  },
  "case_context": {
    "case_id": "abc-123-xyz",
    "title": "Geschil met autodealer over verborgen gebreken",
    "description": "Auto gekocht met verborgen gebreken, dealer weigert verantwoordelijkheid",
    "category": "kooprecht",
    "claim_amount": 5000,
    "counterparty_name": "Auto Centrum BV",
    "counterparty_type": "company"
  }
}
```

### Input Velden

- **document.filename**: Bestandsnaam van het geüploade document
- **document.type**: MIME type (bijv. application/pdf, application/msword, image/jpeg)
- **document.size**: Bestandsgrootte in bytes
- **document.text**: Geëxtraheerde tekstinhoud uit het document (kan `[Tekst kon niet worden geëxtraheerd]` zijn voor sommige bestanden)
- **case_context**: Volledige zaakgegevens om het document in context te evalueren

## Verwachte Output Structuur

De AI Agent moet een JSON object retourneren met de volgende structuur:

### Example JSON Schema

```json
{
  "document_name": "factuur_2024_03_15.pdf",
  "document_type": "factuur",
  "is_readable": true,
  "belongs_to_case": true,
  "summary": "Reparatiefactuur van garage voor €1.250 voor motorschade aan auto, gedateerd 15 maart 2024.",
  "tags": ["factuur", "reparatie", "bewijs", "kosten"],
  "note": null
}
```

### Output Velden (verplicht)

| Veld | Type | Beschrijving |
|------|------|--------------|
| `document_name` | string | De bestandsnaam van het document |
| `document_type` | string | Type document: factuur, contract, overeenkomst, bewijs van betaling, correspondentie, rapport, foto, garantiebewijs, bon, etc. |
| `is_readable` | boolean | Of het document leesbaar en begrijpelijk is |
| `belongs_to_case` | boolean | Of het document logisch bij deze zaak hoort |
| `summary` | string | **Korte samenvatting in 1-2 zinnen** van de inhoud van het document |
| `tags` | array[string] | Array van relevante tags voor dit document (3-6 tags) |
| `note` | string \| null | **Optioneel**: Korte waarschuwing of opmerking, bijv. "Document lijkt niet gerelateerd aan deze zaak" of "Datum document valt buiten zaakperiode". Gebruik `null` als er geen bijzonderheden zijn. |

## Prompt Template voor MindStudio Agent

Gebruik de volgende prompt in de MindStudio Agent configuratie:

```
Je bent een juridische document-analysator voor het Nederlandse rechtssysteem. 

Je ontvangt een document met geëxtraheerde tekst EN volledige zaakcontext.

TAAK:
1. Lees en interpreteer het document
2. Bepaal of het document leesbaar en compleet is
3. Identificeer het documenttype (factuur, contract, bewijs van betaling, correspondentie, etc.)
4. Evalueer of het document logisch bij de zaak hoort op basis van:
   - Inhoud van het document
   - Zaaktitel en beschrijving
   - Tegenpartij naam
   - Claim bedrag en zaakcategorie
5. Geef een korte samenvatting in 1-2 zinnen
6. Kies 3-6 relevante tags
7. Als het document niet relevant lijkt of verdacht is, voeg dan een korte note toe

OUTPUT FORMAAT (strict JSON):
{
  "document_name": "[filename uit input]",
  "document_type": "[factuur|contract|bewijs|correspondentie|rapport|foto|etc.]",
  "is_readable": true/false,
  "belongs_to_case": true/false,
  "summary": "[1-2 zinnen samenvatting]",
  "tags": ["tag1", "tag2", "tag3"],
  "note": null of "[korte waarschuwing]"
}

REGELS:
- Summary: Altijd in het Nederlands, maximaal 2 zinnen
- Tags: Nederlandse woorden, 3-6 tags
- Note: Alleen invullen bij:
  * Document lijkt niet gerelateerd aan de zaak
  * Document onleesbaar of corrupt
  * Datum document valt buiten relevante periode
  * Verdachte of incomplete informatie
- Als alles OK is: note = null
- Wees niet overdreven voorzichtig - als document relevant lijkt, zet belongs_to_case op true

CONTEXT GEBRUIK:
- Vergelijk document inhoud met zaakbeschrijving
- Check of partijen in document overeenkomen met tegenpartij
- Evalueer of bedragen in document relevant zijn voor claim bedrag
- Beoordeel of datum/tijdlijn logisch is voor de zaak
```

## Voorbeelden

### Voorbeeld 1: Relevante Factuur

**Input:**
```json
{
  "document": {
    "filename": "garage_factuur_maart_2024.pdf",
    "type": "application/pdf",
    "size": 123456,
    "text": "FACTUUR\nAuto Reparatie Centrum\nDatum: 15-03-2024\n\nReparatie motorschade\nTotaal: € 1.250,00\n\nBetreft: Mercedes C-Klasse, Kenteken XX-123-YY"
  },
  "case_context": {
    "title": "Geschil autodealer over verborgen gebreken Mercedes",
    "claim_amount": 5000,
    "counterparty_name": "Auto Dealer XYZ"
  }
}
```

**Expected Output:**
```json
{
  "document_name": "garage_factuur_maart_2024.pdf",
  "document_type": "factuur",
  "is_readable": true,
  "belongs_to_case": true,
  "summary": "Reparatiefactuur van Auto Reparatie Centrum voor motorschade aan Mercedes C-Klasse voor €1.250. Document ondersteunt de claim over verborgen gebreken.",
  "tags": ["factuur", "reparatie", "motorschade", "bewijs", "kosten"],
  "note": null
}
```

### Voorbeeld 2: Niet-gerelateerd Document

**Input:**
```json
{
  "document": {
    "filename": "vakantie_foto.jpg",
    "type": "image/jpeg",
    "size": 2456789,
    "text": "[Tekst kon niet worden geëxtraheerd]"
  },
  "case_context": {
    "title": "Huurgeschil met verhuurder over achterstallig onderhoud",
    "category": "huurrecht"
  }
}
```

**Expected Output:**
```json
{
  "document_name": "vakantie_foto.jpg",
  "document_type": "foto",
  "is_readable": false,
  "belongs_to_case": false,
  "summary": "Afbeeldingsbestand zonder relevante tekst of context voor deze zaak.",
  "tags": ["foto", "afbeelding"],
  "note": "Document lijkt niet gerelateerd aan deze huurzaak. Controleer of dit het juiste bestand is."
}
```

### Voorbeeld 3: Koopovereenkomst

**Input:**
```json
{
  "document": {
    "filename": "koopcontract_auto.pdf",
    "type": "application/pdf",
    "text": "KOOPOVEREENKOMST AUTO\n\nKoper: Jan Jansen\nVerkoper: Auto Centrum BV\nObject: Mercedes C200, bouwjaar 2019\nKoopprijs: € 18.500\nDatum: 1 februari 2024\n\nVerkoper garandeert dat de auto vrij is van gebreken..."
  },
  "case_context": {
    "title": "Geschil met autodealer over verborgen gebreken",
    "counterparty_name": "Auto Centrum BV",
    "claim_amount": 5000
  }
}
```

**Expected Output:**
```json
{
  "document_name": "koopcontract_auto.pdf",
  "document_type": "koopovereenkomst",
  "is_readable": true,
  "belongs_to_case": true,
  "summary": "Koopovereenkomst tussen koper Jan Jansen en Auto Centrum BV voor Mercedes C200 voor €18.500, gedateerd 1 februari 2024. Document bevat garantiebepalingen.",
  "tags": ["contract", "koopovereenkomst", "auto", "garantie", "bewijs"],
  "note": null
}
```

## Integratie Flow

1. **Gebruiker uploadt document** → Replit extraheert tekst
2. **Replit roept MindStudio aan** → `POST` naar `Dossier_check.flow` met document + case_context
3. **MindStudio Agent analyseert** → Volgt bovenstaande prompt en schema
4. **MindStudio retourneert JSON** → Analysis object volgens schema
5. **Replit slaat analyse op** → In database bij document record
6. **UI toont resultaat** → Automatisch onder document card:
   - ✅ Groene achtergrond met summary
   - 🏷️ Tags als chips
   - ⚠️ Gele warning box (alleen als `note` aanwezig is)

## MindStudio Configuratie Checklist

- [ ] Flow naam: `Dossier_check.flow`
- [ ] Input variable: `input_json` (JSON string met document en case_context)
- [ ] Agent prompt: Gebruik bovenstaande prompt template
- [ ] Output format: JSON (strict schema zoals beschreven)
- [ ] Output variable: `result` (bevat het JSON analysis object)
- [ ] API credentials: Zelfde `MS_AGENT_APP_ID` en `MINDSTUDIO_API_KEY` als andere flows

## Testen

Test de flow met verschillende documenttypes:
- ✅ PDF facturen
- ✅ Word documenten (.docx)
- ✅ Afbeeldingen (.jpg, .png)
- ✅ Email bestanden (.eml)
- ✅ Onleesbare/corrupte bestanden

Controleer dat:
- Summary altijd kort en informatief is (1-2 zinnen)
- Tags relevant zijn (3-6 tags)
- Note alleen gebruikt wordt bij echte problemen
- JSON schema strict gevolgd wordt (alle velden aanwezig, juiste types)

## Support

Voor vragen of problemen met de MindStudio integratie, zie:
- Replit backend code: `server/routes.ts` (functie `analyzeDocumentWithMindStudio`)
- Frontend component: `client/src/components/DocumentList.tsx`
- Database schema: `shared/schema.ts` (caseDocuments table)
