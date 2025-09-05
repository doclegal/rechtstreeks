import { type Case, type Analysis, type Template, type CaseDocument } from "@shared/schema";
import Ajv from "ajv";

// In-memory storage for thread results
const THREAD_RESULTS = new Map<string, { 
  status: 'running' | 'done' | 'error', 
  outputText?: string, 
  raw?: any, 
  billingCost?: string 
}>();

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

export class AIService {
  private apiKey: string;
  private provider: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || "";
    this.provider = process.env.LLM_PROVIDER || "openai";
    this.model = process.env.LLM_MODEL || "gpt-3.5-turbo";
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
        facts: analysisResult.facts || [],
        issues: analysisResult.issues || [],
        missing_documents: analysisResult.missing_documents || [],
        claims: analysisResult.claims || [],
        defenses: analysisResult.defenses || [],
        legal_basis: analysisResult.legal_basis || [],
        risk_notes: analysisResult.risk_notes || [],
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

  // NEW: Synchronous version - no callback, direct result
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout for MindStudio

    try {
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
        console.error("Mindstudio API error:", response.status, errorData);
        
        // Check for Cloudflare 524 timeout specifically
        if (response.status === 524 || errorData.includes('Error 524') || errorData.includes('timed out')) {
          throw new Error("MindStudio analyse duurt langer dan verwacht - de AI werkt nog aan uw complexe zaak");
        }
        
        throw new Error(`MindStudio analyse niet beschikbaar: ${response.status} ${response.statusText}`);
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
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error("MindStudio analyse duurt langer dan verwacht - probeer later opnieuw");
      }
      throw error;
    }
  }

  static storeThreadResult(threadId: string, result: { status: 'running' | 'done' | 'error', outputText?: string, raw?: any, billingCost?: string }) {
    THREAD_RESULTS.set(threadId, result);
  }

  static getThreadResult(threadId: string) {
    return THREAD_RESULTS.get(threadId) || { status: 'pending' as const };
  }

  static mindstudioToAppResult(outputText: string | any): AppAnalysisResult {
    // Default empty structure
    const result: AppAnalysisResult = {
      factsJson: [],
      issuesJson: [],
      legalBasisJson: [],
      missingDocuments: [],
      rawText: typeof outputText === 'string' ? outputText : JSON.stringify(outputText)
    };

    try {
      console.log('🔍 Processing MindStudio output:', typeof outputText, outputText);
      
      // If outputText is already an object (new MindStudio format), use it directly
      if (typeof outputText === 'object' && outputText !== null) {
        console.log('📊 Using direct object format from MindStudio');
        
        // Extract data from the structured object
        if (outputText.samenvatting_feiten && Array.isArray(outputText.samenvatting_feiten)) {
          result.factsJson = outputText.samenvatting_feiten.map((fact: string, idx: number) => ({
            label: `Feit ${idx + 1}`,
            detail: fact
          }));
        }
        if (outputText.juridische_analyse && Array.isArray(outputText.juridische_analyse)) {
          result.issuesJson = outputText.juridische_analyse.map((issue: string) => ({
            issue: issue,
            risk: undefined
          }));
        }
        if (outputText.to_do && Array.isArray(outputText.to_do)) {
          result.missingDocuments = outputText.to_do;
        }
        
        // Legal basis from kernredenering if available
        if (outputText.kernredenering && Array.isArray(outputText.kernredenering)) {
          result.legalBasisJson = outputText.kernredenering.map((law: string) => ({
            law: law,
            article: undefined,
            note: undefined
          }));
        }
        
        console.log('✅ Processed structured MindStudio output successfully');
        return result;
      }
      
      // Fallback: Parse the markdown-style output from MindStudio (old format)
      if (typeof outputText !== 'string') {
        console.log('⚠️ OutputText is not string, converting:', outputText);
        outputText = String(outputText);
      }
      
      // Parse Dutch headings and sections
      const sections = outputText.split(/\n\s*\n/);
      
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
