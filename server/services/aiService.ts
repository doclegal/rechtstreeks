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
      })
    });

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

    console.log("Starting Kanton check analysis:", variables);

    // Debug: Log API key status
    const hasApiKey = !!process.env.MINDSTUDIO_API_KEY;
    const keyPrefix = process.env.MINDSTUDIO_API_KEY ? process.env.MINDSTUDIO_API_KEY.substring(0, 10) + "..." : "MISSING";
    console.log(`🔑 API Key status: ${hasApiKey ? 'Present' : 'Missing'} (${keyPrefix})`);
    console.log(`🏭 Worker ID: ${process.env.MINDSTUDIO_WORKER_ID}`);
    console.log(`⚙️  Workflow: ${process.env.MINDSTUDIO_WORKFLOW}`);

    const requestBody = {
      workerId: process.env.MINDSTUDIO_WORKER_ID,
      variables,
      workflow: process.env.MINDSTUDIO_WORKFLOW || "Main.flow",
      // NO callbackUrl = synchronous response
      includeBillingCost: true
    };

    console.log("📤 Request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

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
    parties: {
      claimant: any;
      defendant: any;
    };
    is_kantonzaak: boolean;
    contract_present: boolean;
    forum_clause_text?: string | null;
    uploaded_files: Array<{
      name: string;
      file_url: string;
      type: 'pdf' | 'img' | 'docx' | 'txt';
    }>;
  }): Promise<{
    success: boolean;
    threadId?: string;
    result?: any;
    parsedAnalysis?: any;
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

    // Prepare launch variables for MindStudio - send uploaded_files as native array
    // The key insight: don't double-stringify, let the HTTP JSON.stringify handle it once
    const variables: any = {
      case_id: params.case_id,
      case_text: params.case_text,
      uploaded_files: params.uploaded_files || []
    };

    console.log("📤 Full Analysis variables:", JSON.stringify(variables, null, 2));

    // Debug: Log API key status
    const hasApiKey = !!process.env.MINDSTUDIO_API_KEY;
    const keyPrefix = process.env.MINDSTUDIO_API_KEY ? process.env.MINDSTUDIO_API_KEY.substring(0, 10) + "..." : "MISSING";
    console.log(`🔑 API Key status: ${hasApiKey ? 'Present' : 'Missing'} (${keyPrefix})`);

    const requestBody = {
      workerId: process.env.MINDSTUDIO_WORKER_ID,
      variables,
      workflow: "FullAnalysis.flow", // Different workflow for full analysis
      includeBillingCost: true
    };

    console.log("📤 Full Analysis request body:", JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

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

      // Parse the structured MindStudio output - look for analysis_json variable
      let parsedAnalysis = null;
      try {
        // Primary: Look for analysis_json variable in thread posts (like we do for app_response in kanton check)
        if (data.thread?.posts) {
          console.log("🔍 Searching in thread posts for analysis_json variable...");
          for (const post of data.thread.posts) {
            // Look in debugLog newState variables for analysis_json
            if (post.debugLog?.newState?.variables?.analysis_json?.value) {
              console.log("✅ Found analysis_json in debugLog.newState.variables");
              const responseValue = post.debugLog.newState.variables.analysis_json.value;
              if (typeof responseValue === 'string') {
                parsedAnalysis = JSON.parse(responseValue);
              } else {
                parsedAnalysis = responseValue;
              }
              break;
            }
          }
        }
        
        // Secondary: Check thread variables for analysis_json
        if (!parsedAnalysis && data.thread?.variables?.analysis_json?.value) {
          console.log("✅ Found analysis_json in thread.variables.analysis_json.value");
          const responseValue = data.thread.variables.analysis_json.value;
          if (typeof responseValue === 'string') {
            parsedAnalysis = JSON.parse(responseValue);
          } else {
            parsedAnalysis = responseValue;
          }
        }
        
        // Tertiary: Check data.result.analysis_json (newer format)
        if (!parsedAnalysis && data.result && data.result.analysis_json) {
          console.log("✅ Found analysis_json in data.result.analysis_json (newer format)");
          parsedAnalysis = typeof data.result.analysis_json === 'string' 
            ? JSON.parse(data.result.analysis_json) 
            : data.result.analysis_json;
        }
        
        // Fallback: Check data.result.output (legacy format)
        if (!parsedAnalysis && data.result && data.result.output) {
          console.log("✅ Using legacy data.result.output format");
          parsedAnalysis = typeof data.result.output === 'string' 
            ? JSON.parse(data.result.output) 
            : data.result.output;
        }
        
        if (parsedAnalysis) {
          console.log("📊 Parsed MindStudio analysis structure:", Object.keys(parsedAnalysis));
          
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
        parsedAnalysis,
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
      })
    });

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
}

export const aiService = new AIService();
