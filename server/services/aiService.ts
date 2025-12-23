import { type Case, type Analysis, type Template, type CaseDocument } from "@shared/schema";
import Ajv from "ajv";
import OpenAI from "openai";
import { createMindStudioService, MindStudioService } from "./mindStudioService";

// In-memory storage for thread results
const THREAD_RESULTS = new Map<string, { 
  status: 'running' | 'done' | 'error', 
  outputText?: string, 
  raw?: any, 
  billingCost?: string 
}>();

export interface KantonCheckResult {
  ok: boolean;
  phase?: string;
  decision?: string;
  reason?: string;
  summary?: string;
  parties?: any;
  basis?: string;
  rationale?: string;
  questions?: any[];
  rawText?: string;
  billingCost?: string;
}

export interface AppAnalysisResult {
  factsJson: Array<{ label: string; detail?: string }>;
  issuesJson: Array<{ issue: string; risk?: string }>;
  legalBasisJson: Array<{ law: string; article?: string; note?: string }>;
  missingDocuments?: string[];
  rawText?: string;
  billingCost?: string;
}

// JSON schema for legal analysis validation
const analysisSchema = {
  type: "object",
  required: ["facts", "issues", "missing_documents", "claims", "defenses", "legal_basis", "risk_notes"],
  properties: {
    facts: { type: "array", items: { type: "string" } },
    issues: { type: "array", items: { type: "string" } },
    missing_documents: { type: "array", items: { type: "string" } },
    claims: { type: "array", items: { type: "string" } },
    defenses: { type: "array", items: { type: "string" } },
    legal_basis: { type: "array", items: { type: "string" } },
    risk_notes: { type: "array", items: { type: "string" } }
  },
  additionalProperties: false
};

const ajv = new Ajv();
const validateAnalysis = ajv.compile(analysisSchema);

export interface ReceiptExtractResult {
  success: boolean;
  productName?: string;
  brand?: string;
  model?: string;
  purchaseDate?: string;
  purchasePrice?: string;
  supplier?: string;
  category?: string;
  warrantyDuration?: string;
  description?: string;
  confidence?: number;
  rawText?: string;
}

export class AIService {
  private apiKey: string;
  private provider: string;
  private model: string;
  private openai: OpenAI;
  private mindStudio: MindStudioService | null;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || "";
    this.provider = process.env.LLM_PROVIDER || "openai";
    this.model = process.env.LLM_MODEL || "gpt-3.5-turbo";
    this.mindStudio = createMindStudioService();
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    this.openai = new OpenAI({ apiKey: this.apiKey });
  }

  async analyzeLegalCase(caseData: Case, documents: CaseDocument[]): Promise<{
    facts: string[];
    issues: string[];
    missing_documents: string[];
    claims: string[];
    defenses: string[];
    legal_basis: string[];
    risk_notes: string[];
    latency: number;
    tokens: number;
  }> {
    const startTime = Date.now();

    // System prompt in Dutch
    const systemPrompt = "Je bent een juridische analyse-agent voor Nederlandse kantonzaken (consument/MKB). Wees feitelijk, conservatief en expliciet over onzekerheden. Geef uitsluitend geldig JSON volgens het schema. Gebruik géén vrije tekst.";

    // User payload with intake and documents
    const userPayload = {
      intake: {
        summary: caseData.description || "Geen samenvatting beschikbaar",
        claim_amount: caseData.claimAmount || "0",
        counterparty_type: caseData.counterpartyType || "onbekend"
      },
      documents: documents.map(doc => ({
        id: doc.id,
        type: this.getDocumentType(doc.mimetype),
        text: this.truncateText(doc.extractedText || "", 15000)
      })),
      questions: [
        "Vat de feiten en posities samen.",
        "Welke stukken ontbreken (checklist, concreet en beknopt)?",
        "Welke vorderingen en verweren zijn aannemelijk?",
        "Welke juridische grondslagen (artikelen/regels) zijn waarschijnlijk relevant? (korte labels, geen citaten).",
        "Risico's en onzekerheden (kort, 1-5 bullets)."
      ]
    };

    try {
      // For demo purposes, return mock analysis if OpenAI quota is exceeded
      const response = await this.callLLMWithJSONResponse(systemPrompt, JSON.stringify(userPayload));
      const analysisResult = JSON.parse(response);
      
      // Validate against schema
      const isValid = validateAnalysis(analysisResult);
      if (!isValid) {
        console.error("Analysis validation failed:", validateAnalysis.errors);
        throw new Error("Invalid analysis JSON schema");
      }

      const latency = Date.now() - startTime;
      
      return {
        facts: Array.isArray(analysisResult.facts) ? analysisResult.facts : [],
        issues: Array.isArray(analysisResult.issues) ? analysisResult.issues : [],
        missing_documents: Array.isArray(analysisResult.missing_documents) ? analysisResult.missing_documents : [],
        claims: Array.isArray(analysisResult.claims) ? analysisResult.claims : [],
        defenses: Array.isArray(analysisResult.defenses) ? analysisResult.defenses : [],
        legal_basis: Array.isArray(analysisResult.legal_basis) ? analysisResult.legal_basis : [],
        risk_notes: Array.isArray(analysisResult.risk_notes) ? analysisResult.risk_notes : [],
        latency,
        tokens: this.estimateTokens(response) // Simplified token estimation
      };
    } catch (error) {
      console.error("Error in legal case analysis:", error);
      throw new Error("Analyse mislukt. Mindstudio AI is niet beschikbaar.");
    }
  }

  private getDocumentType(mimetype: string): string {
    if (mimetype.includes("pdf")) return "pdf";
    if (mimetype.includes("word") || mimetype.includes("docx")) return "docx";
    if (mimetype.includes("message")) return "eml";
    if (mimetype.includes("image")) return "image";
    return "unknown";
  }

  private truncateText(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars) + "... [afgekapt]";
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 4 characters per token for Dutch text
    return Math.ceil(text.length / 4);
  }

  public getModel(): string {
    return this.model;
  }

  async draftLetter(caseData: Case, analysis: Analysis, template: Template): Promise<{
    html: string;
    markdown: string;
  }> {
    const prompt = `
Stel een professionele ingebrekestelling brief op in het Nederlands voor de volgende zaak:

Zaak: ${caseData.title}
Eisende partij: ${caseData.ownerUserId} 
Verwerende partij: ${caseData.counterpartyName}
Claim bedrag: €${caseData.claimAmount}

Feiten uit analyse:
${JSON.stringify(analysis.factsJson, null, 2)}

Juridische grondslag:
${JSON.stringify(analysis.legalBasisJson, null, 2)}

Template basis:
${template.bodyMarkdown}

Genereer:
1. Een markdown versie van de brief
2. Een HTML versie geschikt voor PDF conversie

Gebruik zakelijke, maar vriendelijke toon. Volg Nederlandse juridische conventies.
Vermeld duidelijk de eis, de termijn voor betaling (14 dagen), en de gevolgen bij niet-nakoming.

Geef response als JSON:
{
  "markdown": "markdown inhoud hier",
  "html": "HTML inhoud hier met styling"
}
`;

    try {
      const response = await this.callLLM(prompt);
      const result = JSON.parse(response);
      return {
        html: result.html || "<p>Fout bij genereren brief</p>",
        markdown: result.markdown || "# Fout bij genereren brief"
      };
    } catch (error) {
      console.error("Error drafting letter:", error);
      return {
        html: "<p>Er is een fout opgetreden bij het genereren van de brief.</p>",
        markdown: "# Fout bij genereren brief\n\nEr is een technische fout opgetreden."
      };
    }
  }

  async draftSummons(caseData: Case, analysis: Analysis, template: Template): Promise<{
    html: string;
    markdown: string;
  }> {
    const prompt = `
Stel een dagvaarding op volgens Nederlandse kantongerecht structuur voor:

Zaak: ${caseData.title}
Eisende partij: ${caseData.ownerUserId}
Verwerende partij: ${caseData.counterpartyName}
Eis: €${caseData.claimAmount}

Analyse gegevens:
Feiten: ${JSON.stringify(analysis.factsJson, null, 2)}
Juridische grondslag: ${JSON.stringify(analysis.legalBasisJson, null, 2)}

Structuur volgens Nederlands recht:
1. Partijen (eiser en verweerder met adresgegevens)
2. Feiten
3. Eis (hoofdsom + rente + kosten)
4. Juridische grondslag (wetsartikelen)
5. Producties (bewijsstukken)
6. Aanzegging (verschijning rechtbank)

Template:
${template.bodyMarkdown}

Geef JSON response:
{
  "markdown": "markdown dagvaarding",
  "html": "HTML voor PDF met juridische opmaak"
}
`;

    try {
      const response = await this.callLLM(prompt);
      const result = JSON.parse(response);
      return {
        html: result.html || "<p>Fout bij genereren dagvaarding</p>",
        markdown: result.markdown || "# Fout bij genereren dagvaarding"
      };
    } catch (error) {
      console.error("Error drafting summons:", error);
      return {
        html: "<p>Er is een fout opgetreden bij het genereren van de dagvaarding.</p>",
        markdown: "# Fout bij genereren dagvaarding\n\nEr is een technische fout opgetreden."
      };
    }
  }

  // NEW: Extract purchase data from receipt text (for PDF receipts)
  async extractReceiptDataFromText(extractedText: string): Promise<ReceiptExtractResult> {
    try {
      console.log("🧾 Starting receipt extraction from PDF text");
      
      const systemPrompt = `Je bent een expert in het analyseren van Nederlandse aankoopbonnen en facturen. 
Extraheer de volgende informatie uit de geüploade factuur/bon tekst:

BELANGRIJK - NEDERLANDSE PRIJSFORMATTERING:
- Nederlandse prijzen gebruiken komma als decimaalscheidingsteken: 35,49 = €35.49 (NIET €3549!)
- 272,99 = €272.99, 17,79 = €17.79, etc.
- Converteer altijd naar correcte eurobedragen met punt als decimaal voor JSON

MULTI-PRODUCT HANDLING:
- Als er MEERDERE producten zijn: selecteer het DUURSTE product als hoofdproduct
- Andere producten vermelden in "description" met prijzen tussen haakjes
- Bijvoorbeeld: "BlueBuilt Stofzuigerzakken (€29.99)"

VELDEN:
- Productnaam (hoofdproduct - duurste als er meerdere zijn)
- Merk/fabrikant indien zichtbaar
- Model indien zichtbaar  
- Aankoopdatum (datum van aankoop in YYYY-MM-DD formaat)
- Aankoopprijs (van hoofdproduct - numerieke waarde met punt als decimaal, zonder €-teken)
- Leverancier/winkel (naam van de winkel/bedrijf)
- Productcategorie (kies uit: "electronics", "appliances", "clothing", "tools", "automotive", "home", "sports", "other")
- Garantieduur (standaard "2 jaar" tenzij anders vermeld)
- Extra beschrijving (andere producten met prijzen)

Geef de output als JSON in deze exacte structuur:
{
  "productName": "string of null",
  "brand": "string of null",
  "model": "string of null", 
  "purchaseDate": "YYYY-MM-DD of null",
  "purchasePrice": "numerieke string met punt als decimaal of null",
  "supplier": "string of null",
  "category": "electronics/appliances/clothing/tools/automotive/home/sports/other of null",
  "warrantyDuration": "2 jaar",
  "description": "andere producten met prijzen tussen haakjes of null",
  "confidence": 0.85
}

VOORBEELD MULTI-PRODUCT:
Als factuur heeft:
- BlueBuilt Stofzuigerzakken €29,99
- Bosch Serie 8 stofzuiger €243,00

Dan wordt hoofdproduct: "Bosch Serie 8 stofzuiger" (€243.00)
Beschrijving: "BlueBuilt Stofzuigerzakken (€29.99)"

Tekst van de factuur/bon:
${extractedText}`;

      // Use standard GPT model for text-based extraction
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", 
        messages: [
          {
            role: "user",
            content: systemPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const aiContent = response.choices[0].message.content;
      if (!aiContent) {
        throw new Error("No content returned from OpenAI");
      }

      const parsed = JSON.parse(aiContent);
      
      // Validate and normalize the response
      const result = this.validateReceiptExtraction(parsed);
      
      console.log("✅ PDF Receipt extraction result:", { success: result.success, confidence: result.confidence });
      
      return result;

    } catch (error) {
      console.error("❌ PDF Receipt extraction failed:", error);
      
      // Check if this is a quota/rate limit error and try MindStudio fallback
      if (this.isQuotaError(error) && this.mindStudio) {
        console.log("🔄 OpenAI quota exceeded, trying MindStudio fallback for PDF...");
        try {
          const mindstudioResult = await this.mindStudio.extractReceiptData({
            type: 'text',
            content: extractedText,
            filename: 'receipt.pdf'
          });
          
          // Convert MindStudio result to our format
          return {
            success: mindstudioResult.confidence >= 60,
            confidence: mindstudioResult.confidence,
            productName: mindstudioResult.productName || undefined,
            brand: undefined,
            model: undefined,
            purchaseDate: mindstudioResult.purchaseDate || undefined,
            purchasePrice: mindstudioResult.purchasePrice?.toString() || undefined,
            supplier: mindstudioResult.storeName || undefined,
            category: this.mapCategoryFromMindStudio(mindstudioResult.category) || undefined,
            warrantyDuration: undefined,
            description: undefined,
            rawText: `MindStudio extraction: ${JSON.stringify(mindstudioResult)}`
          };
        } catch (mindstudioError) {
          console.error("❌ MindStudio fallback also failed:", mindstudioError);
        }
      }
      
      return {
        success: false,
        confidence: 0,
        rawText: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // NEW: Extract purchase data from receipt image using OpenAI Vision
  async extractReceiptData(dataUrl: string, mimetype?: string): Promise<ReceiptExtractResult> {
    try {
      console.log("🧾 Starting receipt extraction with OpenAI Vision");
      
      const systemPrompt = `Je bent een expert in het analyseren van Nederlandse aankoopbonnen en facturen. 
Extraheer de volgende informatie uit de geüploade afbeelding van een aankoopbon/factuur:

BELANGRIJK - NEDERLANDSE PRIJSFORMATTERING:
- Nederlandse prijzen gebruiken komma als decimaalscheidingsteken: 35,49 = €35.49 (NIET €3549!)
- 272,99 = €272.99, 17,79 = €17.79, etc.
- Converteer altijd naar correcte eurobedragen met punt als decimaal voor JSON

MULTI-PRODUCT HANDLING:
- Als er MEERDERE producten zijn: selecteer het DUURSTE product als hoofdproduct
- Andere producten vermelden in "description" met prijzen tussen haakjes
- Bijvoorbeeld: "BlueBuilt Stofzuigerzakken (€29.99)"

VELDEN:
- Productnaam (hoofdproduct - duurste als er meerdere zijn)
- Merk/fabrikant indien zichtbaar
- Model indien zichtbaar  
- Aankoopdatum (datum van aankoop in YYYY-MM-DD formaat)
- Aankoopprijs (van hoofdproduct - numerieke waarde met punt als decimaal, zonder €-teken)
- Leverancier/winkel (naam van de winkel/bedrijf)
- Productcategorie (kies uit: "electronics", "appliances", "clothing", "tools", "automotive", "home", "sports", "other")
- Garantieduur (standaard "2 jaar" tenzij anders vermeld)
- Extra beschrijving (andere producten met prijzen)

Geef de output als JSON in deze exacte structuur:
{
  "productName": "string of null",
  "brand": "string of null",
  "model": "string of null", 
  "purchaseDate": "YYYY-MM-DD of null",
  "purchasePrice": "numerieke string met punt als decimaal of null",
  "supplier": "string of null",
  "category": "electronics/appliances/clothing/tools/automotive/home/sports/other of null",
  "warrantyDuration": "2 jaar",
  "description": "andere producten met prijzen tussen haakjes of null",
  "confidence": 0.85
}

VOORBEELD MULTI-PRODUCT:
Als factuur heeft:
- BlueBuilt Stofzuigerzakken €29,99
- Bosch Serie 8 stofzuiger €243,00

Dan wordt hoofdproduct: "Bosch Serie 8 stofzuiger" (€243.00)
Beschrijving: "BlueBuilt Stofzuigerzakken (€29.99)"

Als informatie niet duidelijk leesbaar is, gebruik null. 
Geef een confidence score tussen 0 en 1 voor de kwaliteit van de extractie.
Confidence > 0.7 = goede extractie, < 0.5 = onbetrouwbaar.`;

      // Use gpt-4o-mini which supports vision and is more reliable than gpt-5
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyseer deze aankoopbon en extraheer de aankoopgegevens volgens het JSON schema."
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const aiContent = response.choices[0].message.content;
      if (!aiContent) {
        throw new Error("No content returned from OpenAI");
      }

      const parsed = JSON.parse(aiContent);
      
      // Validate and normalize the response
      const result = this.validateReceiptExtraction(parsed);
      
      console.log("✅ Receipt extraction result:", { success: result.success, confidence: result.confidence });
      
      return result;

    } catch (error) {
      console.error("❌ Receipt extraction failed:", error);
      
      // Check if this is a quota/rate limit error and try MindStudio fallback
      if (this.isQuotaError(error) && this.mindStudio) {
        console.log("🔄 OpenAI quota exceeded, trying MindStudio fallback for image...");
        try {
          const mindstudioResult = await this.mindStudio.extractReceiptData({
            type: 'image',
            content: dataUrl,
            filename: 'receipt-image'
          });
          
          // Convert MindStudio result to our format
          return {
            success: mindstudioResult.confidence >= 60,
            confidence: mindstudioResult.confidence,
            productName: mindstudioResult.productName || undefined,
            brand: undefined,
            model: undefined,
            purchaseDate: mindstudioResult.purchaseDate || undefined,
            purchasePrice: mindstudioResult.purchasePrice?.toString() || undefined,
            supplier: mindstudioResult.storeName || undefined,
            category: this.mapCategoryFromMindStudio(mindstudioResult.category) || undefined,
            warrantyDuration: undefined,
            description: undefined,
            rawText: `MindStudio extraction: ${JSON.stringify(mindstudioResult)}`
          };
        } catch (mindstudioError) {
          console.error("❌ MindStudio fallback also failed:", mindstudioError);
        }
      }
      
      return {
        success: false,
        confidence: 0,
        rawText: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // NEW: Validate and normalize receipt extraction results
  private validateReceiptExtraction(parsed: any): ReceiptExtractResult {
    try {
      // Validate confidence score
      const confidence = typeof parsed.confidence === 'number' ? 
        Math.max(0, Math.min(1, parsed.confidence)) : 0;
      
      // If confidence is too low, mark as unsuccessful
      if (confidence < 0.5) {
        return {
          success: false,
          confidence,
          rawText: "Low confidence extraction - please try a clearer image"
        };
      }

      // Normalize and validate fields
      const result: ReceiptExtractResult = {
        success: true,
        confidence,
        productName: this.normalizeString(parsed.productName),
        brand: this.normalizeString(parsed.brand),
        model: this.normalizeString(parsed.model),
        purchaseDate: this.normalizeDateString(parsed.purchaseDate),
        purchasePrice: this.normalizePriceString(parsed.purchasePrice),
        supplier: this.normalizeString(parsed.supplier),
        category: this.normalizeCategoryString(parsed.category),
        warrantyDuration: this.normalizeString(parsed.warrantyDuration),
        description: this.normalizeString(parsed.description)
      };

      // Check if we have at least some useful data
      const hasUsefulData = !!(result.productName || result.supplier || result.purchasePrice);
      if (!hasUsefulData) {
        return {
          success: false,
          confidence: 0,
          rawText: "No useful data extracted from receipt"
        };
      }

      return result;

    } catch (error) {
      return {
        success: false,
        confidence: 0,
        rawText: `Validation error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // Helper methods for normalization
  private normalizeString(value: any): string | undefined {
    if (typeof value === 'string' && value.trim() && value.toLowerCase() !== 'null') {
      return value.trim();
    }
    return undefined;
  }

  private normalizeDateString(value: any): string | undefined {
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Validate it's a real date
      const date = new Date(value);
      if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= new Date().getFullYear() + 1) {
        return value;
      }
    }
    return undefined;
  }

  private normalizePriceString(value: any): string | undefined {
    if (typeof value === 'string' || typeof value === 'number') {
      let numStr = String(value);
      
      // Handle Dutch comma decimal format: 35,49 -> 35.49
      // But avoid replacing thousands separators like 1.234,56
      if (numStr.includes(',')) {
        // If there are both dots and commas, assume comma is decimal (European format)
        if (numStr.includes('.') && numStr.includes(',')) {
          // 1.234,56 -> remove dots (thousands), replace comma with dot
          numStr = numStr.replace(/\./g, '').replace(',', '.');
        } else {
          // Just comma: 35,49 -> 35.49
          numStr = numStr.replace(',', '.');
        }
      }
      
      // Remove currency symbols and spaces
      numStr = numStr.replace(/[€$£¥₹\s]/g, '');
      
      const num = parseFloat(numStr);
      if (!isNaN(num) && num >= 0 && num < 100000) { // Reasonable price range
        return num.toFixed(2);
      }
    }
    return undefined;
  }

  private normalizeCategoryString(value: any): string | undefined {
    const validCategories = ["electronics", "appliances", "clothing", "tools", "automotive", "home", "sports", "other"];
    if (typeof value === 'string' && validCategories.includes(value.toLowerCase())) {
      return value.toLowerCase();
    }
    return undefined;
  }

  // Helper method to detect OpenAI quota/rate limit errors
  private isQuotaError(error: any): boolean {
    if (!error) return false;
    
    // Check for OpenAI rate limit status codes
    if (error.status === 429) return true;
    
    // Check for quota exceeded error messages
    const message = error.message?.toLowerCase() || '';
    return message.includes('quota') || 
           message.includes('rate limit') || 
           message.includes('insufficient_quota') ||
           message.includes('429');
  }

  // Helper method to map MindStudio categories to our system categories
  private mapCategoryFromMindStudio(category: string): string | undefined {
    if (!category) return undefined;
    
    const categoryMap: Record<string, string> = {
      'Elektronica': 'electronics',
      'Huishoudelijk': 'appliances',
      'Kleding': 'clothing',
      'Gereedschap': 'tools',
      'Auto': 'automotive',
      'Huis': 'home',
      'Sport': 'sports',
      'Anders': 'other'
    };
    
    return categoryMap[category] || 'other';
  }

  private async callLLMWithJSONResponse(systemPrompt: string, userContent: string): Promise<string> {
    // Skip Mindstudio here - use the async runMindstudioAnalysis method instead
    // This prevents conflicts between sync and async Mindstudio calls

    if (this.provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system", 
              content: systemPrompt
            },
            { role: "user", content: userContent }
          ],
          temperature: 0.1, // Low temperature for consistent legal analysis
          response_format: { type: "json_object" }, // Force JSON output
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    }
    
    throw new Error(`Unsupported LLM provider: ${this.provider}`);
  }

  async runMindstudioAnalysis(params: { input_name: string; input_case_details: string; file_url?: string }): Promise<{ threadId: string }> {
    const variables: any = {
      input_name: params.input_name,
      input_case_details: params.input_case_details
    };
    
    // Add file_url if provided
    if (params.file_url) {
      variables.file_url = params.file_url;
    }

    // Set timeout to 10 minutes for long-running MindStudio analyses
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes

    const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        workerId: process.env.MINDSTUDIO_WORKER_ID,
        variables,
        workflow: process.env.MINDSTUDIO_WORKFLOW || "Main.flow",
        callbackUrl: `${process.env.PUBLIC_BASE_URL}/api/mindstudio/callback`,
        includeBillingCost: true
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Mindstudio API error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    
    if (!data.threadId) {
      throw new Error("No threadId received from Mindstudio");
    }

    // Store initial running state
    THREAD_RESULTS.set(data.threadId, { status: 'running' });
    
    return { threadId: data.threadId };
  }

  // NEW: Kanton check - determine if case is suitable for kantongerecht
  async runKantonCheck(params: { input_name: string; input_case_details: string; file_url?: string }): Promise<KantonCheckResult> {
    const variables: any = {
      input_name: params.input_name,
      input_case_details: params.input_case_details
    };
    
    // Add file_url if provided
    if (params.file_url) {
      variables.file_url = params.file_url;
    }

    console.log("Starting Kanton check analysis:", {
      has_input_name: !!variables.input_name,
      has_case_details: !!variables.input_case_details,
      has_file_url: !!variables.file_url
    });

    // Log API key presence (never log actual key values)
    const hasApiKey = !!process.env.MINDSTUDIO_API_KEY;
    const hasWorkerId = !!process.env.MINDSTUDIO_WORKER_ID;
    console.log(`🔑 MindStudio config: API key ${hasApiKey ? '✓' : '✗'}, Worker ID ${hasWorkerId ? '✓' : '✗'}`);

    const requestBody = {
      workerId: process.env.MINDSTUDIO_WORKER_ID,
      variables,
      workflow: process.env.MINDSTUDIO_WORKFLOW || "Main.flow",
      // NO callbackUrl = synchronous response
      includeBillingCost: true
    };

    console.log("📤 Request body:", JSON.stringify(requestBody, null, 2));

    // Set timeout to 10 minutes for long-running MindStudio analyses
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes

    const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Mindstudio API error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    console.log("🔍 Raw result from MindStudio:", typeof data.app_response, data.app_response);
    
    if (!data.threadId) {
      throw new Error("No threadId received from Mindstudio");
    }

    // Parse the {{app_response}} from MindStudio thread variables
    let appResponse;
    try {
      console.log("🔍 DEBUG: Starting response parsing");
      console.log("🔍 DEBUG: data.thread?.variables:", !!data.thread?.variables);
      console.log("🔍 DEBUG: data.thread?.posts:", !!data.thread?.posts);
      
      // Primary: Check in debugLog newState variables (newer MindStudio response format)
      if (data.thread?.posts) {
        console.log("🔍 Searching in thread posts for app_response...");
        for (const post of data.thread.posts) {
          // Look in debugLog newState variables
          if (post.debugLog?.newState?.variables?.app_response?.value) {
            console.log("🔍 Found app_response in debugLog.newState.variables");
            const responseValue = post.debugLog.newState.variables.app_response.value;
            if (typeof responseValue === 'string') {
              appResponse = JSON.parse(responseValue);
            } else {
              appResponse = responseValue;
            }
            break;
          }
          // Look in regular message content as fallback
          else if (post.message?.content || post.chatMessage?.content) {
            const content = post.message?.content || post.chatMessage?.content;
            try {
              const parsed = JSON.parse(content);
              if (parsed.ok !== undefined && parsed.phase === 'kanton_check') {
                console.log("🔍 Found app_response in message content");
                appResponse = parsed;
                break;
              }
            } catch (e) {
              // Not JSON, continue
            }
          }
        }
      }
      
      // Secondary: Look in thread variables for the app_response value
      if (!appResponse && data.thread?.variables?.app_response?.value) {
        const responseValue = data.thread.variables.app_response.value;
        console.log("🔍 Found app_response in thread.variables.app_response.value:", typeof responseValue);
        
        if (typeof responseValue === 'string') {
          appResponse = JSON.parse(responseValue);
        } else {
          appResponse = responseValue;
        }
      }
      // Tertiary: Check if app_response is directly available at root level  
      else if (!appResponse && data.app_response) {
        console.log("🔍 Found app_response at root level:", typeof data.app_response);
        if (typeof data.app_response === 'string') {
          appResponse = JSON.parse(data.app_response);
        } else {
          appResponse = data.app_response;
        }
      }
      
      // If still no response, create a fallback based on the original MindStudio logic
      if (!appResponse) {
        console.log("🔍 No app_response found, using fallback extraction from thread data");
        
        // Create fallback response - this should not happen but provides safety
        appResponse = {
          ok: false,
          phase: 'kanton_check',
          decision: false,
          summary: 'Geen samenvatting beschikbaar',
          parties: {
            claimant_name: null,
            defendant_name: null,
            relationship: null
          },
          basis: {
            grond: null,
            belang_eur: null
          },
          reason: 'Response parsing failed - app_response not found in MindStudio response'
        };
      }
      
      console.log("✅ Parsed app_response:", appResponse);
      
      // Normalize belang_eur to number if it came as string
      if (appResponse?.basis?.belang_eur && typeof appResponse.basis.belang_eur === 'string') {
        const numericAmount = parseFloat(appResponse.basis.belang_eur);
        if (!isNaN(numericAmount)) {
          appResponse.basis.belang_eur = numericAmount;
          console.log("🔄 Normalized belang_eur from string to number:", numericAmount);
        }
      }
      
    } catch (error) {
      console.error("Failed to parse app_response:", error, data.app_response);
      throw new Error("Invalid JSON response from kanton check");
    }

    return {
      ...appResponse,
      rawText: JSON.stringify(data, null, 2),
      billingCost: data.billingCost
    };
  }

  // Full Analysis - second phase after successful kanton check
  async runFullAnalysis(params: {
    case_id: string;
    case_text: string;
    amount_eur?: number;
    parties: Array<{ 
      name: string; 
      role: "claimant" | "respondent" | "third_party" | "unknown"; 
      type?: string 
    }>;
    is_kantonzaak?: boolean;
    contract_present?: boolean;
    forum_clause_text?: string | null;
    uploaded_files: Array<{
      name: string;
      type: "application/pdf" | "image/jpeg" | "image/png";
      file_url: string;
    }>;
    // Second run parameters
    prev_analysis_json?: object | null;
    missing_info_answers?: Array<{
      question_id: string;
      answer_type: "text" | "multiple_choice" | "file_upload";
      answer_text?: string;
      answer_choice?: string;
      answer_files?: Array<{
        name: string;
        type: "application/pdf" | "image/jpeg" | "image/png";
        file_url: string;
      }>;
    }> | null;
    new_uploads?: Array<{
      name: string;
      type: "application/pdf" | "image/jpeg" | "image/png";
      file_url: string;
    }> | null;
  }): Promise<{
    success: boolean;
    threadId?: string;
    result?: any;
    parsedAnalysis?: any;  // analysis_json
    extractedTexts?: any;  // extracted_texts
    missingInfoStruct?: any;  // missing_info_struct  
    allFiles?: any;  // all_files
    userContext?: any;  // user_context (procedural role + legal role)
    procedureContext?: any;  // procedure_context (kantonzaak, court, confidence)
    rawText?: string;
    billingCost?: string;
  }> {
    console.log("🚀 Starting Full Analysis with params:", {
      case_id: params.case_id,
      case_text_length: params.case_text?.length || 0,
      amount_eur: params.amount_eur,
      parties: params.parties,
      is_kantonzaak: params.is_kantonzaak,
      contract_present: params.contract_present,
      forum_clause_text: params.forum_clause_text,
      uploaded_files_count: params.uploaded_files?.length || 0
    });

    // Prepare launch variables for MindStudio - strict types per contract
    const variables: any = {
      case_id: params.case_id,
      case_text: params.case_text,
      amount_eur: typeof params.amount_eur === 'number' ? params.amount_eur : 0,  // Ensure number type
      parties: params.parties || [],
      uploaded_files: params.uploaded_files || [],
      // Use ?? instead of || to preserve explicit null values (null ?? default only uses default if null/undefined)
      prev_analysis_json: params.prev_analysis_json ?? null,
      missing_info_answers: params.missing_info_answers ?? null,
      new_uploads: params.new_uploads ?? null
    };

    console.log("📤 Full Analysis variables: case_id=%s, text_length=%d, files=%d", 
      variables.case_id, variables.case_text?.length || 0, variables.uploaded_files?.length || 0);

    // Log API key presence (never log actual key values)
    const hasApiKey = !!process.env.MINDSTUDIO_API_KEY;
    console.log(`🔑 MindStudio config: API key ${hasApiKey ? '✓' : '✗'}`);

    const requestBody = {
      workerId: process.env.MINDSTUDIO_WORKER_ID,
      variables,
      workflow: "FullAnalysis.flow", // Different workflow for full analysis
      includeBillingCost: true
    };

    console.log("📤 Full Analysis request body:", JSON.stringify(requestBody, null, 2));

    try {
      // Set timeout to 10 minutes for long-running MindStudio analyses
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes
      
      const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        console.error("❌ MindStudio API error:", response.status, response.statusText, errorData);
        throw new Error(`Mindstudio API error: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const data = await response.json();
      console.log("✅ Full Analysis response received:", {
        threadId: data.threadId,
        hasResult: !!data.result,
        billingCost: data.billingCost
      });

      if (!data.threadId) {
        throw new Error("No threadId received from Mindstudio");
      }

      // Parse the structured MindStudio output - NEW consistent structure
      // All keys now come directly from data.result as top-level properties
      let parsedAnalysis = null;  // analysis_json
      let missingInfoStruct = null;  // missing_info_struct
      let extractedTexts = null;  // extracted_texts
      let allFiles = null;  // all_files
      let userContext = null;  // user_context (procedural role + legal role)
      let procedureContext = null;  // procedure_context (kantonzaak, court, confidence)
      let flags = null;  // flags (facts_complete, evidence_complete, has_legal_basis)
      let goNogoAdvice = null;  // go_nogo_advice (proceed_now, reason, conditions, hitl_flag)
      let readyForSummons = null;  // ready_for_summons
      
      try {
        console.log("🔍 Parsing MindStudio response - new consistent structure");
        
        // PRIMARY: Get all keys directly from data.result (new consistent format)
        if (data.result) {
          // analysis_json
          if (data.result.analysis_json) {
            const resultValue = data.result.analysis_json;
            if (typeof resultValue === 'string' && !resultValue.includes('{{')) {
              parsedAnalysis = JSON.parse(resultValue);
            } else if (typeof resultValue === 'object') {
              parsedAnalysis = resultValue;
            }
            console.log("✅ Found analysis_json in data.result");
          }
          
          // missing_info_struct
          if (data.result.missing_info_struct) {
            const resultValue = data.result.missing_info_struct;
            if (typeof resultValue === 'string' && !resultValue.includes('{{')) {
              missingInfoStruct = JSON.parse(resultValue);
            } else if (typeof resultValue === 'object') {
              missingInfoStruct = resultValue;
            }
            console.log("✅ Found missing_info_struct in data.result");
          }
          
          // extracted_texts (with summaries and bullets)
          if (data.result.extracted_texts) {
            const resultValue = data.result.extracted_texts;
            extractedTexts = typeof resultValue === 'string' ? JSON.parse(resultValue) : resultValue;
            console.log("✅ Found extracted_texts in data.result");
          }
          
          // all_files
          if (data.result.all_files) {
            const resultValue = data.result.all_files;
            allFiles = typeof resultValue === 'string' ? JSON.parse(resultValue) : resultValue;
            console.log("✅ Found all_files in data.result");
          }
          
          // user_context - Handle both object and invalid "[object Object]" string
          if (data.result.user_context) {
            const resultValue = data.result.user_context;
            if (typeof resultValue === 'string' && resultValue === '[object Object]') {
              console.log("⚠️ Skipping invalid '[object Object]' string for user_context - will use fallback");
            } else if (typeof resultValue === 'string' && !resultValue.includes('{{')) {
              userContext = JSON.parse(resultValue);
              console.log("✅ Found user_context in data.result (parsed from string)");
            } else if (typeof resultValue === 'object') {
              userContext = resultValue;
              console.log("✅ Found user_context in data.result (object)");
            }
          }
          
          // procedure_context - Handle both object and invalid "[object Object]" string
          if (data.result.procedure_context) {
            const resultValue = data.result.procedure_context;
            if (typeof resultValue === 'string' && resultValue === '[object Object]') {
              console.log("⚠️ Skipping invalid '[object Object]' string for procedure_context - will use fallback");
            } else if (typeof resultValue === 'string' && !resultValue.includes('{{')) {
              procedureContext = JSON.parse(resultValue);
              console.log("✅ Found procedure_context in data.result (parsed from string)");
            } else if (typeof resultValue === 'object') {
              procedureContext = resultValue;
              console.log("✅ Found procedure_context in data.result (object)");
            }
          }
          
          // flags (NEW) - Handle both object and invalid "[object Object]" string
          if (data.result.flags) {
            const resultValue = data.result.flags;
            // Skip invalid "[object Object]" strings from MindStudio
            if (typeof resultValue === 'string' && resultValue === '[object Object]') {
              console.log("⚠️ Skipping invalid '[object Object]' string for flags - will use fallback");
            } else if (typeof resultValue === 'string' && !resultValue.includes('{{')) {
              flags = JSON.parse(resultValue);
              console.log("✅ Found flags in data.result (parsed from string)");
            } else if (typeof resultValue === 'object') {
              flags = resultValue;
              console.log("✅ Found flags in data.result (object)");
            }
          }
          
          // go_nogo_advice (NEW) - Handle both object and invalid "[object Object]" string
          if (data.result.go_nogo_advice) {
            const resultValue = data.result.go_nogo_advice;
            // Skip invalid "[object Object]" strings from MindStudio
            if (typeof resultValue === 'string' && resultValue === '[object Object]') {
              console.log("⚠️ Skipping invalid '[object Object]' string for go_nogo_advice - will use fallback");
            } else if (typeof resultValue === 'string' && !resultValue.includes('{{')) {
              goNogoAdvice = JSON.parse(resultValue);
              console.log("✅ Found go_nogo_advice in data.result (parsed from string)");
            } else if (typeof resultValue === 'object') {
              goNogoAdvice = resultValue;
              console.log("✅ Found go_nogo_advice in data.result (object)");
            }
          }
          
          // ready_for_summons (NEW)
          if (data.result.ready_for_summons !== undefined) {
            readyForSummons = data.result.ready_for_summons;
            console.log("✅ Found ready_for_summons in data.result:", readyForSummons);
          }
          
          // case_id (for verification)
          if (data.result.case_id) {
            console.log("✅ Verified case_id in data.result:", data.result.case_id);
          }
        }
        
        // FALLBACK: Check legacy locations if not found in data.result
        if (!parsedAnalysis && data.thread?.posts) {
          console.log("⚠️ Using fallback - searching in thread posts (legacy)");
          for (const post of data.thread.posts) {
            if (!parsedAnalysis && post.debugLog?.newState?.variables?.analysis_json?.value) {
              const responseValue = post.debugLog.newState.variables.analysis_json.value;
              parsedAnalysis = typeof responseValue === 'string' ? JSON.parse(responseValue) : responseValue;
              console.log("✅ Found analysis_json in debugLog (fallback)");
              break;
            }
          }
        }
        
        if (parsedAnalysis) {
          console.log("📊 Parsed MindStudio analysis structure:", Object.keys(parsedAnalysis));
          
          // CRITICAL: If missing_info_struct was found, use it to populate missing_info_for_assessment
          if (missingInfoStruct && Array.isArray(missingInfoStruct) && missingInfoStruct.length > 0) {
            console.log("🔧 Using missing_info_struct to populate missing_info_for_assessment");
            parsedAnalysis.missing_info_for_assessment = missingInfoStruct;
          } else if (missingInfoStruct) {
            console.log("⚠️ missing_info_struct found but not in expected format:", typeof missingInfoStruct);
          }
          
          // Normalize amount_eur to number if it came as string
          if (parsedAnalysis.case_overview?.amount_eur && typeof parsedAnalysis.case_overview.amount_eur === 'string') {
            const numericAmount = parseFloat(parsedAnalysis.case_overview.amount_eur);
            if (!isNaN(numericAmount)) {
              parsedAnalysis.case_overview.amount_eur = numericAmount;
              console.log("🔄 Normalized amount_eur from string to number:", numericAmount);
            }
          }
          
          // Add fallback content for empty arrays
          parsedAnalysis = this.addFallbackContent(parsedAnalysis, params.case_text);
        } else {
          console.warn("⚠️ No analysis_json found in MindStudio response");
        }
      } catch (error) {
        console.warn("⚠️ Could not parse MindStudio structured output:", error);
      }

      return {
        success: true,
        threadId: data.threadId,
        result: data.result,
        parsedAnalysis,  // analysis_json
        extractedTexts,  // extracted_texts (now with summaries and bullets)
        missingInfoStruct,  // missing_info_struct
        allFiles,  // all_files
        userContext,  // user_context (procedural role + legal role)
        procedureContext,  // procedure_context (kantonzaak, court, confidence)
        flags,  // flags (NEW - facts_complete, evidence_complete, has_legal_basis)
        goNogoAdvice,  // go_nogo_advice (NEW - proceed_now, reason, conditions, hitl_flag)
        readyForSummons,  // ready_for_summons (NEW - boolean)
        rawText: JSON.stringify(data, null, 2),
        billingCost: data.billingCost
      };

    } catch (error) {
      console.error("❌ Full Analysis failed:", error);
      return {
        success: false,
        parsedAnalysis: null,
        rawText: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // Add fallback content for empty arrays in MindStudio analysis
  private addFallbackContent(analysis: any, caseText: string): any {
    console.log("🔧 Adding fallback content for empty arrays...");
    
    // Extract key info from case text for intelligent fallbacks
    const isRentalCase = caseText.toLowerCase().includes('huur') || caseText.toLowerCase().includes('verhuur');
    const isDepositCase = caseText.toLowerCase().includes('borg') || caseText.toLowerCase().includes('waarborgsom');
    const isContractCase = caseText.toLowerCase().includes('contract') || caseText.toLowerCase().includes('overeenkomst');
    
    // Fallback for facts arrays
    if (!analysis.facts) analysis.facts = {};
    
    if (!analysis.facts.known || analysis.facts.known.length === 0) {
      analysis.facts.known = [
        "Partijen hadden een overeenkomst gesloten",
        "Er is een geschil ontstaan over nakoming van verplichtingen",
        "Eiser vordert schadevergoeding of terugbetaling"
      ];
      
      if (isRentalCase) {
        analysis.facts.known.push("Een huurovereenkomst was aangegaan voor een bepaalde periode");
      }
      if (isDepositCase) {
        analysis.facts.known.push("Een borg was gestort bij aanvang van de overeenkomst");
      }
    }
    
    if (!analysis.facts.disputed || analysis.facts.disputed.length === 0) {
      analysis.facts.disputed = [
        "De mate waarin verplichtingen zijn nagekomen",
        "De omvang van eventuele schade of gebreken",
        "De redelijkheid van gestelde eisen"
      ];
      
      if (isDepositCase) {
        analysis.facts.disputed.push("Of borg terecht wordt ingehouden");
      }
    }
    
    if (!analysis.facts.unclear || analysis.facts.unclear.length === 0) {
      analysis.facts.unclear = [
        "Exacte communicatie tussen partijen",
        "Specifieke afspraken over kwaliteitseisen",
        "Tijdlijn van gebeurtenissen en waarschuwingen"
      ];
    }
    
    // Fallback for evidence arrays
    if (!analysis.evidence) analysis.evidence = {};
    
    if (!analysis.evidence.provided || analysis.evidence.provided.length === 0) {
      analysis.evidence.provided = [
        {
          source: "document",
          doc_name: "Overzicht geüploade documenten",
          doc_url: "",
          key_passages: ["Zie bijgevoegde documenten voor details"]
        }
      ];
    }
    
    if (!analysis.evidence.missing || analysis.evidence.missing.length === 0) {
      analysis.evidence.missing = [
        "Oorspronkelijke overeenkomst of contract",
        "Correspondentie tussen partijen",
        "Bewijs van geleden schade of kosten"
      ];
    }
    
    // Fallback for legal_analysis arrays
    if (!analysis.legal_analysis) analysis.legal_analysis = {};
    
    if (!analysis.legal_analysis.legal_issues || analysis.legal_analysis.legal_issues.length === 0) {
      analysis.legal_analysis.legal_issues = [
        "Nakoming van contractuele verplichtingen",
        "Bewijslast voor gestelde feiten",
        "Hoogte van vordering en schadevergoeding"
      ];
      
      if (isRentalCase) {
        analysis.legal_analysis.legal_issues.push("Huurrechtelijke bepalingen en huurdersrechten");
      }
    }
    
    if (!analysis.legal_analysis.potential_defenses || analysis.legal_analysis.potential_defenses.length === 0) {
      analysis.legal_analysis.potential_defenses = [
        "Verweer dat verplichtingen wel zijn nagekomen",
        "Betwisting van de hoogte van de vordering"
      ];
      
      if (isDepositCase) {
        analysis.legal_analysis.potential_defenses.push("Onredelijke borgaftrek door verhuurder");
      }
    }
    
    if (!analysis.legal_analysis.risks || analysis.legal_analysis.risks.length === 0) {
      analysis.legal_analysis.risks = [
        "Mogelijk verlies bij onvoldoende bewijs",
        "Proceskosten bij verliezende partij"
      ];
    }
    
    if (!analysis.legal_analysis.legal_basis || analysis.legal_analysis.legal_basis.length === 0) {
      analysis.legal_analysis.legal_basis = [
        {
          law: "Burgerlijk Wetboek Boek 6",
          article: "Art. 6:74 BW",
          note: "Wederkerige overeenkomsten en bewijslast"
        },
        {
          law: "Burgerlijk Wetboek Boek 6", 
          article: "Art. 6:162 BW",
          note: "Onrechtmatige daad en schadevergoeding"
        }
      ];
      
      if (isRentalCase) {
        analysis.legal_analysis.legal_basis.push({
          law: "Burgerlijk Wetboek Boek 7",
          article: "Art. 7:206 BW",
          note: "Huurovereenkomst bepalingen"
        });
      }
      
      if (isContractCase) {
        analysis.legal_analysis.legal_basis.push({
          law: "Burgerlijk Wetboek Boek 6",
          article: "Art. 6:248 BW", 
          note: "Nakoming van verbintenissen"
        });
      }
    }
    
    if (!analysis.legal_analysis.next_actions || analysis.legal_analysis.next_actions.length === 0) {
      analysis.legal_analysis.next_actions = [
        "Verzamel alle relevante documenten en correspondentie",
        "Stel een ingebrekestelling op met redelijke termijn",
        "Overweeg minnelijke schikking voordat naar rechter",
        "Bereid juridische procedure voor bij kantonrechter"
      ];
    }
    
    console.log("✅ Fallback content added for empty arrays");
    return analysis;
  }

  // OLD: Synchronous version - no callback, direct result
  async runSynchronousMindstudioAnalysis(params: { input_name: string; input_case_details: string; file_url?: string }): Promise<{ 
    result: string; 
    threadId: string; 
    billingCost?: string; 
  }> {
    const variables: any = {
      input_name: params.input_name,
      input_case_details: params.input_case_details
    };
    
    // Add file_url if provided
    if (params.file_url) {
      variables.file_url = params.file_url;
    }

    console.log("Starting SYNCHRONOUS Mindstudio analysis:", variables);

    // Set timeout to 10 minutes for long-running MindStudio analyses
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes

    const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        workerId: process.env.MINDSTUDIO_WORKER_ID,
        variables,
        workflow: process.env.MINDSTUDIO_WORKFLOW || "Main.flow",
        // NO callbackUrl = synchronous response
        includeBillingCost: true
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Mindstudio API error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    
    if (!data.threadId) {
      throw new Error("No threadId received from Mindstudio");
    }

    // In synchronous mode, result should be available immediately
    return {
      result: data.result || '',
      threadId: data.threadId,
      billingCost: data.billingCost
    };
  }

  static storeThreadResult(threadId: string, result: { status: 'running' | 'done' | 'error', outputText?: string, raw?: any, billingCost?: string }) {
    THREAD_RESULTS.set(threadId, result);
  }

  static getThreadResult(threadId: string) {
    return THREAD_RESULTS.get(threadId) || { status: 'pending' as const };
  }

  static mindstudioToAppResult(outputData: any): AppAnalysisResult {
    // Default empty structure
    const result: AppAnalysisResult = {
      factsJson: [],
      issuesJson: [],
      legalBasisJson: [],
      missingDocuments: [],
      rawText: typeof outputData === 'string' ? outputData : JSON.stringify(outputData, null, 2)
    };

    try {
      // Handle both old text format and new JSON format
      if (typeof outputData === 'string') {
        // Legacy text parsing
        const sections = outputData.split(/\n\s*\n/);
        
        for (const section of sections) {
          const lines = section.split('\n').map(l => l.trim()).filter(l => l);
          if (lines.length === 0) continue;
          
          const heading = lines[0].toLowerCase();
          const content = lines.slice(1);
          
          if (heading.includes('feiten') || heading.includes('samenvatting')) {
            result.factsJson = content.map((item, idx) => ({
              label: `Feit ${idx + 1}`,
              detail: item.replace(/^[•\-*]\s*/, '')
            }));
          } else if (heading.includes('juridische') || heading.includes('geschilpunt') || heading.includes('kwestie')) {
            result.issuesJson = content.map(item => ({
              issue: item.replace(/^[•\-*]\s*/, ''),
              risk: undefined
            }));
          } else if (heading.includes('wetsartikelen') || heading.includes('rechtsgrond') || heading.includes('juridische grondslag')) {
            result.legalBasisJson = content.map(item => ({
              law: item.replace(/^[•\-*]\s*/, ''),
              article: undefined,
              note: undefined
            }));
          } else if (heading.includes('ontbrekende') && heading.includes('document')) {
            result.missingDocuments = content.map(item => item.replace(/^[•\-*]\s*/, ''));
          }
        }
      } else if (outputData && typeof outputData === 'object') {
        // New JSON format from MindStudio triage
        let triageData = outputData.output_triage_flow || outputData;
        
        // MindStudio sometimes returns nested objects as strings, parse them
        if (triageData.full_json && typeof triageData.full_json === 'object') {
          triageData = triageData.full_json;
        }
        
        // Parse any string-encoded objects
        Object.keys(triageData).forEach(key => {
          if (typeof triageData[key] === 'string' && triageData[key].startsWith('[object Object]')) {
            console.log(`Warning: ${key} is string "[object Object]", checking full_json`);
          }
        });
        
        // Extract facts from timeline and summary
        if (triageData.summary) {
          result.factsJson.push({
            label: 'Samenvatting',
            detail: triageData.summary
          });
        }
        
        if (triageData.facts && triageData.facts.timeline && Array.isArray(triageData.facts.timeline)) {
          triageData.facts.timeline.forEach((item: any, idx: number) => {
            result.factsJson.push({
              label: `Timeline ${idx + 1}`,
              detail: `${item.date || 'Datum onbekend'}: ${item.event || 'Gebeurtenis niet beschreven'}`
            });
          });
        }
        
        // Extract claims as issues
        if (triageData.claims && Array.isArray(triageData.claims)) {
          result.issuesJson = triageData.claims.map((claim: any) => ({
            issue: `${claim.type || 'Onbekend type'}: ${claim.value?.what_to_perform || 'Beschrijving ontbreekt'}`,
            risk: claim.confidence ? `${Math.round(claim.confidence * 100)}% zekerheid` : undefined
          }));
        }
        
        // Legal basis from case type and claims
        if (triageData.case_type) {
          result.legalBasisJson.push({
            law: `Zaaktype: ${triageData.case_type}`,
            article: undefined,
            note: triageData.confidence ? `Zekerheid: ${Math.round(triageData.confidence * 100)}%` : undefined
          });
        }
        
        // Missing documents from needed questions
        if (triageData.needed_questions && Array.isArray(triageData.needed_questions)) {
          result.missingDocuments = triageData.needed_questions
            .filter((q: any) => q.needed)
            .map((q: any) => q.label || 'Onbekende vraag');
        }
        
        // Store the full triage data for the frontend
        (result as any).triageData = triageData;
      }
      
      // Ensure arrays are never empty - add fallback content
      if (result.factsJson.length === 0) {
        result.factsJson = [{ label: 'Analyse', detail: 'Zie volledige tekst hieronder' }];
      }
      if (result.issuesJson.length === 0) {
        result.issuesJson = [{ issue: 'Zie volledige analyse voor details', risk: undefined }];
      }
      if (result.legalBasisJson.length === 0) {
        result.legalBasisJson = [{ law: 'Zie volledige analyse voor juridische grondslag', article: undefined, note: undefined }];
      }
      
    } catch (error) {
      console.error('Error parsing Mindstudio output:', error);
      // Fallback: put everything in facts
      result.factsJson = [{ label: 'Analyse Resultaat', detail: 'Zie volledige tekst hieronder' }];
      result.issuesJson = [{ issue: 'Parsing fout opgetreden', risk: 'Bekijk de volledige tekst' }];
      result.legalBasisJson = [{ law: 'Zie volledige analyse', article: undefined, note: undefined }];
    }
    
    return result;
  }

  private async callMindstudioAgent(systemPrompt: string, userContent: string, requireJson: boolean = false): Promise<string> {
    const variables = {
      systemPrompt,
      userPrompt: userContent,
      requireJsonOutput: requireJson
    };

    const response = await fetch("https://api.mindstudio.ai/developer/v2/apps/run", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        workerId: process.env.MINDSTUDIO_WORKER_ID,
        variables,
        workflow: process.env.MINDSTUDIO_WORKFLOW || "Main.flow",
        version: process.env.MINDSTUDIO_VERSION || "published"
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Mindstudio API error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    
    // Extract the response from Mindstudio's response format
    // Adjust this based on your Agent's actual output structure
    if (data.output && typeof data.output === 'string') {
      return data.output;
    } else if (data.result && typeof data.result === 'string') {
      return data.result;
    } else if (typeof data === 'string') {
      return data;
    } else {
      throw new Error("Unexpected Mindstudio response format");
    }
  }

  private async callLLM(prompt: string): Promise<string> {
    // First try Mindstudio Agent if configured
    if (process.env.MINDSTUDIO_API_KEY && process.env.MINDSTUDIO_WORKER_ID) {
      try {
        const systemPrompt = "Je bent een Nederlandse juridische expert. Geef altijd nauwkeurige, professionele adviezen in het Nederlands.";
        return await this.callMindstudioAgent(systemPrompt, prompt, false);
      } catch (error) {
        console.error("Mindstudio call failed, falling back to OpenAI:", error);
      }
    }

    if (this.provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system", 
              content: "Je bent een Nederlandse juridische expert. Geef altijd nauwkeurige, professionele adviezen in het Nederlands."
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    }
    
    throw new Error(`Unsupported LLM provider: ${this.provider}`);
  }

  /**
   * Generate legal letter using MindStudio DraftFirstLetter.flow
   * @param params - All required variables for letter generation
   * @returns Generated letter JSON structure
   */
  async runDraftFirstLetter(params: {
    case_id: string;
    case_text: string;
    analysis_json: any;
    brief_type: string;
    sender: {
      name: string;
      address: string;
      postal_code: string;
      city: string;
      email: string;
    };
    recipient: {
      name: string;
      address: string;
      postal_code: string;
      city: string;
    };
    tone: string;
    dossier: Array<{
      filename: string;
      document_type: string;
      summary: string;
      tags: string[];
      readability_score: number | null;
      belongs_to_case: boolean;
      note: string;
      analysis_status: string | null;
    }>;
    jurisprudence_references?: Array<{
      ecli: string;
      court: string;
      explanation: string;
    }>;
  }): Promise<{
    success: boolean;
    brief?: {
      title: string;
      salutation: string;
      body: string;
      closing: string;
      signature: string;
    };
    error?: string;
  }> {
    console.log("🔮 Calling MindStudio DraftFirstLetter.flow...");

    const variables = {
      case_id: params.case_id,
      case_text: params.case_text,
      analysis_json: params.analysis_json,
      brief_type: params.brief_type,
      sender: params.sender,
      recipient: params.recipient,
      tone: params.tone,
      dossier: params.dossier,
      jurisprudence_references: params.jurisprudence_references || []
    };

    console.log("📤 DraftFirstLetter variables (sending objects, not JSON strings):");
    console.log("   - case_id:", params.case_id);
    console.log("   - brief_type:", params.brief_type);
    console.log("   - tone:", params.tone);
    console.log("   - analysis_json:", typeof params.analysis_json === 'object' ? 'Object' : typeof params.analysis_json);
    console.log("   - sender:", typeof params.sender === 'object' ? 'Object' : typeof params.sender);
    console.log("   - recipient:", typeof params.recipient === 'object' ? 'Object' : typeof params.recipient);
    console.log("   - dossier:", Array.isArray(params.dossier) ? `Array[${params.dossier.length}]` : typeof params.dossier);
    console.log("   - jurisprudence_references:", Array.isArray(params.jurisprudence_references) ? `Array[${params.jurisprudence_references.length}]` : 'Not provided');

    const requestBody = {
      workerId: process.env.MINDSTUDIO_WORKER_ID,
      variables,
      workflow: "DraftFirstLetter.flow",
      includeBillingCost: true
    };

    // Set timeout to 10 minutes for long-running MindStudio analyses
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes

    const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ MindStudio DraftFirstLetter error:", errorData);
      return {
        success: false,
        error: `MindStudio API error: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    console.log("📥 DraftFirstLetter raw response:", JSON.stringify(data, null, 2));

    // Parse the response from MindStudio thread variables
    try {
      let letterResponse;
      const possibleVarNames = ['brief_response', 'draft_letter', 'daft_letter', 'letter_output', 'brief', 'output'];

      // Try to find the letter response in thread posts
      if (data.thread?.posts) {
        console.log("🔍 Searching in thread posts for letter response...");
        for (const post of data.thread.posts) {
          // Try all possible variable names
          for (const varName of possibleVarNames) {
            // Look in debugLog newState variables
            if (post.debugLog?.newState?.variables?.[varName]?.value) {
              const rawValue = post.debugLog.newState.variables[varName].value;
              try {
                letterResponse = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
                console.log(`✅ Found ${varName} in debugLog.newState.variables`);
                break;
              } catch (e) {
                console.log(`⚠️ Failed to parse ${varName} from debugLog.newState.variables:`, e);
              }
            }
            // Fallback: Look in outputs
            if (post.debugLog?.newState?.outputs?.[varName]) {
              const rawValue = post.debugLog.newState.outputs[varName];
              try {
                letterResponse = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
                console.log(`✅ Found ${varName} in debugLog.newState.outputs`);
                break;
              } catch (e) {
                console.log(`⚠️ Failed to parse ${varName} from debugLog.newState.outputs:`, e);
              }
            }
          }
          if (letterResponse) break;
        }
      }

      // Fallback: Check in thread.variables directly
      if (!letterResponse && data.thread?.variables) {
        console.log("🔍 Searching in thread.variables for letter response...");
        for (const varName of possibleVarNames) {
          if (data.thread.variables[varName]) {
            const rawValue = data.thread.variables[varName].value || data.thread.variables[varName];
            try {
              letterResponse = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
              console.log(`✅ Found ${varName} in thread.variables`);
              break;
            } catch (e) {
              console.log(`⚠️ Failed to parse ${varName} from thread.variables:`, e);
            }
          }
        }
      }

      if (!letterResponse) {
        console.error("❌ No letter response found in any expected location");
        console.log("Available thread variables:", Object.keys(data.thread?.variables || {}));
        return {
          success: false,
          error: "No valid letter response from MindStudio - check variable names"
        };
      }

      // Check if letterResponse has the expected structure
      if (!letterResponse.brief || !letterResponse.brief.title) {
        console.error("❌ Letter response missing 'brief' structure:", letterResponse);
        return {
          success: false,
          error: "Invalid letter structure from MindStudio"
        };
      }

      console.log("✅ Successfully parsed letter response:", letterResponse);
      
      return {
        success: true,
        brief: letterResponse.brief
      };

    } catch (error) {
      console.error("❌ Error parsing MindStudio letter response:", error);
      return {
        success: false,
        error: `Failed to parse letter response: ${error}`
      };
    }
  }

  async runCreateDagvaarding(params: any, flowName: string = "CreateDagvaarding.flow"): Promise<{
    success: boolean;
    sections?: {
      grounds: {
        intro: string[];
        assignment_and_work: string[];
        terms_and_conditions: string[];
        invoice: string[];
        interest_and_collection_costs: string[];
        defendant_response: string[];
      };
      evidence: {
        list: string[];
        offer_of_proof: string;
        witnesses: string[];
      };
      orders_requested_text: string[];
    };
    meta?: {
      template_version: string;
      language: string;
    };
    error?: string;
  }> {
    console.log(`⚖️ Calling MindStudio ${flowName} with COMPLETE context...`);

    // Check if this is the new complete payload format or old format
    const isCompletePayload = params.no_summarize === true && params.parties && params.docs_full;
    
    let variables;
    
    if (isCompletePayload) {
      // NEW FORMAT: Pass entire complete payload as-is
      variables = params;
      console.log("📤 Sending COMPLETE context (no summarization):");
      console.log(`  - Facts (full): ${params.facts_known_full?.length || 0} items`);
      console.log(`  - Documents (chunked): ${params.docs_full?.length || 0} chunks`);
      console.log(`  - Evidence (full): ${params.evidence_full?.length || 0} items`);
      console.log(`  - Analysis (full): ${params.analysis_full ? 'included' : 'missing'}`);
      console.log(`  - Total payload size: ~${JSON.stringify(params).length} chars`);
    } else {
      // OLD FORMAT: Legacy compatibility
      variables = {
        case_id: params.case_id,
        locale: params.locale,
        template_version: params.template_version,
        inhoud_subject: params.inhoud_subject,
        flag_is_consumer_case: params.flag_is_consumer_case,
        eiser_naam: params.eiser_naam,
        gedaagde_naam: params.gedaagde_naam,
        facts_known: params.facts_known,
        defenses_expected: params.defenses_expected,
        legal_basis_refs: params.legal_basis_refs,
        evidence_names: params.evidence_names,
        docs_extracts: params.docs_extracts,
        tone: params.tone,
        no_html: params.no_html,
        paragraph_max_words: params.paragraph_max_words,
        dont_invent: params.dont_invent,
        avoid_numbers: params.avoid_numbers,
        reference_law_style: params.reference_law_style
      };
      console.log("📤 Sending legacy format (summarized)");
    }

    const requestBody = {
      workerId: process.env.MINDSTUDIO_WORKER_ID,
      variables,
      workflow: flowName,
      includeBillingCost: true
    };

    // Set timeout to 10 minutes for long-running MindStudio generation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);

    try {
      const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        console.error("❌ MindStudio CreateDagvaarding error:", errorData);
        return {
          success: false,
          error: `MindStudio API error: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      console.log("📥 CreateDagvaarding raw response:", JSON.stringify(data, null, 2));

      // Parse the response - look for result in various possible locations
      let resultData;
      
      // Try multiple variable names that MindStudio might use
      const possibleVarNames = ['result', 'generate_result', 'output', 'response'];
      
      // Check output.results first
      for (const varName of possibleVarNames) {
        if (data.output?.results?.[varName]) {
          const rawValue = data.output.results[varName].value || data.output.results[varName];
          try {
            resultData = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
            console.log(`✅ Found ${varName} in output.results`);
            break;
          } catch (e) {
            console.log(`⚠️ Failed to parse ${varName} from output.results`);
          }
        }
      }
      
      // Check thread.variables if not found
      if (!resultData) {
        for (const varName of possibleVarNames) {
          if (data.thread?.variables?.[varName]) {
            const rawValue = data.thread.variables[varName].value || data.thread.variables[varName];
            try {
              resultData = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
              console.log(`✅ Found ${varName} in thread.variables`);
              break;
            } catch (e) {
              console.log(`⚠️ Failed to parse ${varName} from thread.variables`);
            }
          }
        }
      }
      
      // Also check data.result directly (new MindStudio format)
      if (!resultData && data.result) {
        try {
          const rawValue = data.result.result || data.result;
          resultData = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
          console.log("✅ Found result in data.result");
        } catch (e) {
          console.log("⚠️ Failed to parse data.result");
        }
      }

      if (!resultData || !resultData.sections) {
        console.error("❌ No valid result found in CreateDagvaarding response");
        console.log("Available in output.results:", Object.keys(data.output?.results || {}));
        console.log("Available in thread.variables:", Object.keys(data.thread?.variables || {}));
        return {
          success: false,
          error: "MindStudio CreateDagvaarding.flow returned no valid result. Check workflow output variable."
        };
      }

      return {
        success: true,
        sections: resultData.sections,
        meta: resultData.meta
      };

    } catch (error) {
      clearTimeout(timeoutId);
      console.error("❌ CreateDagvaarding error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  async runGenerateSummons(params: {
    case_id: string;
    case_details: any;
    analysis_json: any;
    claimant: {
      name: string;
      place: string;
      rep_name?: string;
      rep_address?: string;
      phone?: string;
      email?: string;
      iban?: string;
    };
    defendant: {
      name: string;
      address: string;
      birthdate?: string;
      is_consumer: boolean;
    };
    court?: {
      name?: string;
      location?: string;
    };
  }): Promise<{
    success: boolean;
    summonsData?: any;
    error?: string;
  }> {
    // Development mock fallback when MindStudio flow is not configured
    if (process.env.USE_MINDSTUDIO_SUMMONS_MOCK === 'true') {
      console.log("🧪 Using mock summons data (USE_MINDSTUDIO_SUMMONS_MOCK=true)");
      
      const mockSummonsData = {
        meta: {
          template_version: "v1.0-mock",
          language: "nl"
        },
        court: {
          name: params.court?.name || "Rechtbank Amsterdam",
          visit_address: "Parnassusweg 220, 1076 AV Amsterdam",
          postal_address: "Postbus 1312, 1000 BH Amsterdam",
          hearing_day: "dinsdag",
          hearing_date: "15 januari 2025",
          hearing_time: "10:00 uur"
        },
        parties: {
          claimant: {
            name: params.claimant.name,
            place: params.claimant.place,
            rep_name: params.claimant.rep_name || "",
            rep_address: params.claimant.rep_address || "",
            phone: params.claimant.phone || "",
            email: params.claimant.email || "",
            iban: params.claimant.iban || "",
            dossier: `ZAAK-${params.case_id.substring(0, 8)}`
          },
          defendant: {
            name: params.defendant.name,
            address: params.defendant.address,
            birthdate: params.defendant.birthdate || "",
            is_consumer: params.defendant.is_consumer !== false
          }
        },
        case: {
          subject: "Vordering tot betaling hoofdsom, rente en kosten",
          amount_eur: 5000.00,
          interest: {
            type: "wettelijke handelsrente",
            from_date: "1 oktober 2024"
          },
          interim_sum_eur: 5250.00,
          costs: {
            salaris_gemachtigde_eur: 1200.00,
            dagvaarding_eur: 98.00
          },
          total_to_date_eur: 6548.00
        },
        sections: {
          full_claim_items: [
            { label: "Hoofdsom vordering", amount_eur: 5000.00 },
            { label: "Wettelijke handelsrente", amount_eur: 250.00 },
            { label: "Buitengerechtelijke incassokosten", amount_eur: 450.00 },
            { label: "Salaris gemachtigde", amount_eur: 1200.00 },
            { label: "Kosten dagvaarding", amount_eur: 98.00 }
          ],
          orders_requested: [
            "Gedaagde te veroordelen tot betaling van € 6.548,- aan eiser",
            "Met veroordeling van gedaagde in de proceskosten",
            "Dit vonnis uitvoerbaar bij voorraad te verklaren"
          ],
          grounds: {
            intro: [
              "Eiser heeft werkzaamheden verricht voor gedaagde op basis van een overeenkomst van opdracht.",
              "De overeengekomen werkzaamheden zijn conform afspraak uitgevoerd en opgeleverd."
            ],
            assignment_and_work: [
              "Op of omstreeks 1 juli 2024 hebben partijen een overeenkomst gesloten waarbij eiser werkzaamheden zou verrichten voor gedaagde.",
              "Eiser heeft de overeengekomen werkzaamheden conform afspraak uitgevoerd en in augustus 2024 opgeleverd.",
              "Gedaagde heeft de oplevering geaccepteerd en is akkoord gegaan met de gefactureerde bedragen."
            ],
            terms_and_conditions: [
              "Op de overeenkomst zijn de algemene voorwaarden van eiser van toepassing.",
              "In deze voorwaarden is onder meer bepaald dat betaling dient plaats te vinden binnen 30 dagen na factuurdatum."
            ],
            invoice: [
              "Eiser heeft op 15 augustus 2024 een factuur gezonden aan gedaagde voor een bedrag van € 5.000,-.",
              "De betalingstermijn van 30 dagen is verstreken op 15 september 2024.",
              "Ondanks meerdere aanmaningen heeft gedaagde niet betaald."
            ],
            interest_and_collection_costs: [
              "Eiser heeft recht op wettelijke handelsrente vanaf de datum van opeisbaarheid (16 september 2024).",
              "Eiser heeft buitengerechtelijke incassokosten gemaakt conform het Besluit vergoeding voor buitengerechtelijke incassokosten."
            ],
            defendant_response: [
              "Gedaagde heeft op de aanmaningen niet of onvoldoende gereageerd.",
              "Er is geen dispuut over de kwaliteit van de werkzaamheden of de hoogte van de factuur."
            ],
            evidence: {
              list: [
                "Overeenkomst van opdracht d.d. 1 juli 2024",
                "Factuur nr. 2024-0815 d.d. 15 augustus 2024",
                "Aanmaningsbrief d.d. 20 september 2024",
                "Ingebrekestelling d.d. 1 oktober 2024"
              ],
              offer_of_proof: "Eiser biedt aan om bovengenoemde documenten in het geding te brengen en, indien nodig, bewijs te leveren door middel van getuigen.",
              witnesses: [
                "De heer/mevrouw [naam], werkzaam bij eiser, bekend met de uitvoering van de werkzaamheden",
                "De heer/mevrouw [naam], betrokken bij de contractonderhandelingen"
              ]
            }
          }
        },
        signoff: {
          place: params.claimant.place || "Amsterdam",
          date: new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }),
          representative: params.claimant.rep_name || params.claimant.name
        }
      };
      
      return {
        success: true,
        summonsData: mockSummonsData
      };
    }
    
    console.log("⚖️ Calling MindStudio GenerateSummons.flow...");

    const variables = {
      case_id: params.case_id,
      case_details: JSON.stringify(params.case_details),
      analysis_json: JSON.stringify(params.analysis_json),
      claimant: JSON.stringify(params.claimant),
      defendant: JSON.stringify(params.defendant),
      court: JSON.stringify(params.court || {}),
    };

    console.log("📤 GenerateSummons variables:", variables);

    const requestBody = {
      workerId: process.env.MINDSTUDIO_WORKER_ID,
      variables,
      workflow: "GenerateSummons.flow",
      includeBillingCost: true
    };

    // Set timeout to 10 minutes for long-running MindStudio summons generation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes

    const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ MindStudio GenerateSummons error:", errorData);
      return {
        success: false,
        error: `MindStudio API error: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    console.log("📥 GenerateSummons raw response:", JSON.stringify(data, null, 2));

    // Parse the response from MindStudio thread variables
    try {
      let summonsResponse;
      
      // Try to find the summons data in various possible locations
      const possibleVarNames = [
        'summons_data',
        'summonsData', 
        'summons',
        'output',
        'result'
      ];

      // First try output/results (preferred location)
      if (data.output?.results) {
        console.log("🔍 Checking output.results for summons response...");
        for (const varName of possibleVarNames) {
          if (data.output.results[varName]) {
            const rawValue = data.output.results[varName].value || data.output.results[varName];
            try {
              summonsResponse = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
              console.log(`✅ Found ${varName} in output.results`);
              break;
            } catch (e) {
              console.log(`⚠️ Failed to parse ${varName} from output.results:`, e);
            }
          }
        }
      }

      // If not in output.results, try thread.variables
      if (!summonsResponse && data.thread?.variables) {
        console.log("🔍 Searching in thread.variables for summons response...");
        for (const varName of possibleVarNames) {
          if (data.thread.variables[varName]) {
            const rawValue = data.thread.variables[varName].value || data.thread.variables[varName];
            try {
              summonsResponse = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
              console.log(`✅ Found ${varName} in thread.variables`);
              break;
            } catch (e) {
              console.log(`⚠️ Failed to parse ${varName} from thread.variables:`, e);
            }
          }
        }
      }

      if (!summonsResponse) {
        console.error("❌ No summons response found in any expected location");
        console.log("Available output.results:", Object.keys(data.output?.results || {}));
        console.log("Available thread variables:", Object.keys(data.thread?.variables || {}));
        return {
          success: false,
          error: "MindStudio GenerateSummons.flow returned no summons payload. Verify workflow variables (expected: summons_data/summonsData/output/result containing SummonsV1 JSON). Set USE_MINDSTUDIO_SUMMONS_MOCK=true for development."
        };
      }

      // Validate that summonsResponse has expected SummonsV1 structure
      if (!summonsResponse.meta || !summonsResponse.court || !summonsResponse.parties) {
        console.error("❌ Summons response missing required SummonsV1 structure:", summonsResponse);
        return {
          success: false,
          error: "Invalid summons structure from MindStudio - missing required fields (meta, court, parties)"
        };
      }

      console.log("✅ Successfully parsed summons response:", summonsResponse);
      
      return {
        success: true,
        summonsData: summonsResponse
      };

    } catch (error) {
      console.error("❌ Error parsing MindStudio summons response:", error);
      return {
        success: false,
        error: `Failed to parse summons response: ${error}`
      };
    }
  }

  // RKOS - Redelijke Kans Op Succes (Reasonable Chance of Success) Assessment
  async runRKOS(input_json: any): Promise<{ result?: any; thread?: any; error?: string }> {
    console.log("📊 Calling MindStudio RKOS.flow...");

    const variables = {
      input_json: input_json  // Send as object, not stringified (MindStudio handles JSON)
    };

    console.log("📤 RKOS variables:", {
      case_id: input_json.case_id,
      has_summary: !!input_json.summary,
      has_parties: !!input_json.parties,
      facts_count: input_json.facts?.length || 0,
      docs_count: input_json.dossier?.document_count || 0
    });

    const requestBody = {
      workerId: process.env.MS_AGENT_APP_ID,
      variables,
      workflow: "RKOS.flow",
      includeBillingCost: true
    };

    // Set timeout to 3 minutes for RKOS assessment
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000);

    try {
      const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        console.error("❌ MindStudio RKOS error:", errorData);
        return {
          error: `MindStudio API error: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      console.log("📥 RKOS raw response received");

      // Return the full data - let the caller parse it
      return {
        result: data.output?.results || data.result,
        thread: data.thread
      };

    } catch (error) {
      clearTimeout(timeoutId);
      console.error("❌ Error calling MindStudio RKOS:", error);
      return {
        error: `Failed to call RKOS: ${error}`
      };
    }
  }

  // Create Advice - Generate full legal advice using Create_advice.flow
  async runCreateAdvice(input_json: any): Promise<{ result?: any; thread?: any; error?: string }> {
    console.log("📝 Calling MindStudio Create_advice.flow...");

    const variables = {
      input_json: input_json  // Send as object, not stringified (MindStudio handles JSON)
    };

    console.log("📤 Create_advice variables:", {
      case_id: input_json.case_id,
      has_summary: !!input_json.summary,
      has_parties: !!input_json.parties,
      facts_count: input_json.facts?.length || 0,
      docs_count: input_json.dossier?.document_count || 0
    });

    const requestBody = {
      workerId: process.env.MS_AGENT_APP_ID,
      variables,
      workflow: "Create_advice.flow",
      includeBillingCost: true
    };

    // Set timeout to 5 minutes for legal advice generation (longer text output)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

    try {
      const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        console.error("❌ MindStudio Create_advice error:", errorData);
        return {
          error: `MindStudio API error: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      console.log("📥 Create_advice raw response received");

      // Return the full data - let the caller parse it
      return {
        result: data.output?.results || data.result,
        thread: data.thread
      };

    } catch (error) {
      clearTimeout(timeoutId);
      console.error("❌ Error calling MindStudio Create_advice:", error);
      return {
        error: `Failed to call Create_advice: ${error}`
      };
    }
  }

  // Summarize jurisprudence with structured output
  async summarizeJurisprudence(fullText: string, ecli: string): Promise<{
    summary: string;
    error?: string;
  }> {
    console.log(`📝 Summarizing jurisprudence: ${ecli}`);

    const systemPrompt = `Je bent een juridische assistent die Nederlandse rechterlijke uitspraken samenvat voor leken. 
    
Maak een heldere, gestructureerde samenvatting van 250-500 woorden met de volgende secties:

## Feiten
Een beknopt overzicht van de relevante feiten en achtergrond van de zaak.

## Geschil
Wat was het juridische geschil? Waar ging de procedure over?

## Beslissing
Wat heeft de rechter besloten?

## Motivering
Waarom heeft de rechter zo besloten? Welke juridische overwegingen waren belangrijk?

Gebruik duidelijke, begrijpelijke taal zonder juridisch jargon. Focus op de kernpunten.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Vat deze uitspraak samen:\n\n${fullText.substring(0, 12000)}` }
        ],
        temperature: 0.3,
        max_tokens: 800
      });

      const summary = response.choices[0]?.message?.content || "";
      
      if (!summary) {
        throw new Error("No summary generated");
      }

      console.log(`✅ Summary generated for ${ecli} (${summary.split(' ').length} words)`);
      
      return { summary };

    } catch (error) {
      console.error("❌ Error summarizing jurisprudence:", error);
      return {
        summary: "",
        error: `Failed to summarize: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Missing Info Check - Consolidate missing information from RKOS and Create_advice flows
  async runMissingInfo(input_json: any): Promise<{ result?: any; thread?: any; error?: string }> {
    console.log("🔍 Calling MindStudio Missing_info.flow...");

    // Send individual fields as separate variables (MindStudio doesn't handle nested objects well)
    const variables = {
      case_id: input_json.case_id,
      case_title: input_json.case_title,
      missing_elements: JSON.stringify(input_json.missing_elements || []),
      ontbrekend_bewijs: JSON.stringify(input_json.ontbrekend_bewijs || [])
    };

    console.log("📤 Missing Info variables:", {
      case_id: input_json.case_id,
      missing_elements_count: input_json.missing_elements?.length || 0,
      ontbrekend_bewijs_count: input_json.ontbrekend_bewijs?.length || 0
    });
    
    console.log("🔍 DEBUG ontbrekend_bewijs as string:", variables.ontbrekend_bewijs.substring(0, 300));

    const requestBody = {
      workerId: process.env.MS_AGENT_APP_ID,
      variables,
      workflow: "Missing_info.flow",
      includeBillingCost: true
    };

    // Set timeout to 2 minutes for missing info consolidation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2 * 60 * 1000);

    try {
      const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        console.error("❌ MindStudio missing_info error:", errorData);
        return {
          error: `MindStudio API error: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      console.log("📥 Missing Info raw response received");

      // Return the full data - let the caller parse it
      return {
        result: data.output?.results || data.result,
        thread: data.thread
      };

    } catch (error) {
      clearTimeout(timeoutId);
      console.error("❌ Error calling MindStudio missing_info:", error);
      return {
        error: `Failed to call missing_info: ${error}`
      };
    }
  }
  // NEW: Generate negotiation status summary
  async generateNegotiationSummary(params: {
    caseTitle: string;
    caseDescription: string;
    claimAmount: string;
    counterpartyName: string;
    letters: Array<{ briefType: string; createdAt: string; createdAtISO?: string; tone: string; status?: string; html?: string }>;
    documents: Array<{ filename: string; extractedText?: string; createdAt: string; createdAtISO?: string; documentAnalysis?: any }>;
  }): Promise<{ summary: string; timeline: Array<{ date: string; action: string }>; status: string; nextStep?: string }> {
    try {
      const systemPrompt = `Je bent een juridische assistent die de EXACTE stand van zaken van een onderhandeling samenvat.

Je krijgt een lijst van verstuurde brieven MET hun exacte datums en types, en documenten uit het dossier (die mogelijk reacties van de wederpartij bevatten).

ANALYSEER ZORGVULDIG:
1. BRIEVEN: Bekijk elk type brief (INGEBREKESTELLING, LAATSTE_AANMANING, INFORMATIEVERZOEK, etc.) en de exacte datum
2. DOCUMENTEN: Check of er documenten zijn die reacties van de wederpartij kunnen zijn (kijk naar bestandsnamen en inhoud)
3. CHRONOLOGIE: Wat is er eerst gestuurd, wat daarna, en is er reactie gekomen?

STRUCTUUR VAN DE SAMENVATTING (3 delen in vloeiende tekst):

DEEL 1 - GESCHIL (1 zin): Wat is het geschil? Noem de wederpartij bij naam.
Voorbeeld: "U heeft een geschil met Van Loon Installatietechniek B.V. over een onterecht ontslag op staande voet."

DEEL 2 - COMMUNICATIE (1-2 zinnen): Noem SPECIFIEK welke brieven op welke datum zijn verstuurd. Vermeld of er reactie is gekomen.
Voorbeeld: "Op 18 november heeft u een Laatste Aanmaning verstuurd. Op 24 november volgde een Informatieverzoek. Er is nog geen reactie ontvangen."

DEEL 3 - WIE IS AAN ZET (1 zin): Duidelijk aangeven wie nu actie moet ondernemen.
Begin met: "We wachten nu op reactie van [wederpartij]..." OF "U bent aan zet om..."

STATUS BEPALING:
- "in_afwachting": Laatste actie was een brief van ons, we wachten op reactie wederpartij
- "lopend": Er is recente correspondentie van beide kanten
- "geen_reactie": Meerdere brieven verstuurd zonder enige reactie
- "opgelost": Zaak is afgerond (schikking, betaling, intrekking)
- "geescaleerd": Verwezen naar rechtbank/deurwaarder

BELANGRIJK VOOR nextStep:
- Noem ALTIJD de EXACTE DATUM van de laatste brief (bijv. "van 24 november")
- Beschrijf KORT wat er in die brief werd geëist/verzocht (lees de inhoud!)
- Voorbeeld: "We wachten op reactie van Bedrijf X op het informatieverzoek van 24 november waarin werd verzocht om het ontslag in te trekken en aan de loondoorbetalingsverplichting te voldoen."

Geef je antwoord in het Nederlands als JSON:
{
  "summary": "[GESCHIL] + [COMMUNICATIE met exacte datums] + [WIE IS AAN ZET]",
  "timeline": [
    { "date": "YYYY-MM-DD", "action": "Type brief of reactie met korte beschrijving" }
  ],
  "status": "in_afwachting|lopend|geen_reactie|opgelost|geescaleerd",
  "nextStep": "We wachten op reactie van [wederpartij] op [type brief] van [DATUM] waarin [KORTE SAMENVATTING VAN WAT ER GEËIST/VERZOCHT WERD]."
}`;

      // Include letter content (stripped of HTML tags) for AI analysis
      const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Provide detailed letter info with exact dates (in Dutch format) and full content
      const lettersSummary = params.letters.map((l, index) => ({
        volgorde: index + 1,
        type: l.briefType,
        datum: l.createdAt, // Already in Dutch format (e.g., "24 november 2024")
        toon: l.tone,
        status: l.status || "verstuurd",
        inhoud: l.html ? stripHtml(l.html).substring(0, 3000) : ''
      }));

      // Provide detailed document info including analysis (may identify counterparty responses)
      const documentsSummary = params.documents.slice(0, 10).map(d => {
        const analysis = d.documentAnalysis || {};
        return {
          bestandsnaam: d.filename,
          datum_toegevoegd: d.createdAt, // Already in Dutch format
          // Include AI analysis summary if available (helps identify document purpose)
          analyse_samenvatting: analysis.summary || null,
          document_type: analysis.type || null,
          mogelijk_van_wederpartij: analysis.belongsToCase === false ? true : null,
          inhoud: d.extractedText ? d.extractedText.substring(0, 1500) : ''
        };
      });

      const userContent = JSON.stringify({
        zaak: {
          titel: params.caseTitle,
          beschrijving: params.caseDescription,
          vorderingsbedrag: params.claimAmount,
          wederpartij: params.counterpartyName
        },
        verstuurde_brieven_chronologisch: lettersSummary,
        documenten_in_dossier: documentsSummary,
        instructie: "Bekijk de brieven in chronologische volgorde. Check de documenten op mogelijke reacties van de wederpartij."
      });

      const response = await this.callLLMWithJSONResponse(systemPrompt, userContent);
      
      // Defensive JSON parsing with validation
      let result: any;
      try {
        result = JSON.parse(response);
      } catch (parseError) {
        console.error("Failed to parse negotiation summary response as JSON:", parseError);
        return {
          summary: "De AI-samenvatting kon niet worden verwerkt. Probeer het later opnieuw.",
          timeline: [],
          status: "onbekend"
        };
      }

      // Validate and normalize the result
      // Use 'onbekend' for any unrecognized status to surface potential issues
      const validStatuses = ['in_afwachting', 'lopend', 'geen_reactie', 'opgelost', 'geescaleerd', 'niet_gestart'];
      const status = validStatuses.includes(result.status) ? result.status : 'onbekend';

      // Validate and sanitize timeline entries - ensure both date and action are non-empty
      // Also validate date format (must be a valid calendar date)
      const rawTimeline = Array.isArray(result.timeline) ? result.timeline : [];
      const validTimeline = rawTimeline
        .filter((entry: any) => entry && typeof entry === 'object')
        .map((entry: any) => ({
          date: typeof entry.date === 'string' ? entry.date.trim() : '',
          action: typeof entry.action === 'string' ? entry.action.trim() : ''
        }))
        .filter((entry: { date: string; action: string }) => {
          if (!entry.date || !entry.action) return false;
          // Validate date is a valid calendar date using Date object
          const dateObj = new Date(entry.date);
          const isValidDate = !isNaN(dateObj.getTime());
          // Additional check: ensure it's a reasonable date (not in distant past/future)
          const year = dateObj.getFullYear();
          const isReasonableYear = year >= 2000 && year <= 2100;
          return isValidDate && isReasonableYear;
        });

      return {
        summary: typeof result.summary === 'string' ? result.summary : "Geen samenvatting beschikbaar",
        timeline: validTimeline,
        status,
        nextStep: typeof result.nextStep === 'string' ? result.nextStep : undefined
      };
    } catch (error) {
      console.error("Error generating negotiation summary:", error);
      return {
        summary: "Er is een fout opgetreden bij het genereren van de samenvatting.",
        timeline: [],
        status: "onbekend"
      };
    }
  }
}

export const aiService = new AIService();
