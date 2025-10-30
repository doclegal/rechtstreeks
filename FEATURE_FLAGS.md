# Feature Flags

## USE_LOCAL_TEXT_EXTRACTION

⚠️ **STATUS: UITGESCHAKELD - WERKT NIET**

Deze feature flag is uitgeschakeld omdat de lokale PDF text extractie niet betrouwbaar genoeg is.

### Probleem
MindStudio's "Extract Text from File" block duurt te lang voor grote PDFs (>60 seconden), wat Cloudflare timeout veroorzaakt (Error 524).

### Geprobeerde oplossing (werkt niet)
Lokale text extractie stuurt RAW PDF binary data in plaats van schone tekst naar MindStudio, waardoor de analyse faalt.

### Huidige oplossing
We gebruiken de originele file_url methode. Voor documenten die langer dan 2 minuten duren:
- MindStudio moet geoptimaliseerd worden
- Of we accepteren timeout voor zeer grote documenten

---

## Hoe in te schakelen

### Optie 1: Via Replit Secrets (AANBEVOLEN)
1. Klik op "Secrets" in de Replit sidebar (🔐 icoon)
2. Voeg een nieuwe secret toe:
   - **Key:** `USE_LOCAL_TEXT_EXTRACTION`
   - **Value:** `true`
3. Herstart de workflow: klik op "Restart" bij "Start application"

### Optie 2: Via .env bestand
1. Open of maak `.env` bestand in de root
2. Voeg toe: `USE_LOCAL_TEXT_EXTRACTION=true`
3. Herstart de workflow

---

## Hoe uit te schakelen (terug naar origineel)

### Optie 1: Via Replit Secrets
1. Verwijder de `USE_LOCAL_TEXT_EXTRACTION` secret, of
2. Verander de value naar `false`
3. Herstart de workflow

### Optie 2: Via .env bestand
1. Verwijder de regel `USE_LOCAL_TEXT_EXTRACTION=true`, of
2. Verander naar `USE_LOCAL_TEXT_EXTRACTION=false`
3. Herstart de workflow

---

## BELANGRIJK: MindStudio aanpassing vereist!

Je moet de MindStudio workflow aanpassen om `file_text` te accepteren:

### In MindStudio Dossier_check.flow:

1. **Als je de nieuwe methode (lokale tekst) gebruikt:**
   - De workflow moet een variabele `{{input_json.file_text}}` accepteren
   - Skip de "Extract Text from File" block
   - Gebruik direct `{{input_json.file_text}}` in de analyse

2. **Als je de oude methode (file URL) gebruikt:**
   - De workflow gebruikt `{{input_json.file_url}}`
   - "Extract Text from File" block haalt de tekst op
   - Daarna gaat het naar de analyse

### Aanbevolen MindStudio setup:
Je kunt een **conditional** gebruiken in MindStudio:
- IF `{{input_json.file_text}}` bestaat → gebruik die tekst direct
- ELSE → gebruik `{{input_json.file_url}}` met Extract Text block

---

## Wat gebeurt er technisch?

### OUDE methode (USE_LOCAL_TEXT_EXTRACTION=false of niet ingesteld):
```json
{
  "file_url": "https://jouw-app.replit.dev/api/documents/123/download/document.pdf",
  "file_name": "document.pdf"
}
```
- MindStudio download het bestand via de URL
- MindStudio extract de tekst (dit duurt lang!)
- MindStudio analyseert de tekst

### NIEUWE methode (USE_LOCAL_TEXT_EXTRACTION=true):
```json
{
  "file_text": "De volledige geëxtraheerde tekst van het document...",
  "file_name": "document.pdf"
}
```
- Replit extraheert de tekst lokaal
- MindStudio krijgt alleen de tekst (veel sneller!)
- MindStudio analyseert de tekst direct

---

## Logs checken

Kijk in de logs welke methode wordt gebruikt:

### Nieuwe methode:
```
📝 Using LOCAL text extraction method
📋 Document filename: document.pdf
📋 Extracted text length: 7055 characters
```

### Oude methode:
```
🔗 Using FILE URL method (original)
🔗 Generated download URL for MindStudio: https://...
📋 Document filename: document.pdf
```

---

## Testen

1. Schakel de feature in (USE_LOCAL_TEXT_EXTRACTION=true)
2. Upload een document
3. Check de logs - zie je "📝 Using LOCAL text extraction method"?
4. Werkt de analyse zonder timeout?
5. Zo nee: schakel terug naar origineel (false of verwijder de variabele)
