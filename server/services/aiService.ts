import { type Case, type Analysis, type Template } from "@shared/schema";

export class AIService {
  private apiKey: string;
  private provider: string;

  constructor() {
    this.apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
    this.provider = process.env.LLM_PROVIDER || "openai";
  }

  async analyzeCase(caseData: Case, extractedTexts: string[]): Promise<{
    facts: any[];
    issues: any[];
    missing_documents: any[];
    parties: any[];
    claims: any[];
    legal_basis: any[];
    risk_notes: any[];
  }> {
    const prompt = `
Analyseer de volgende Nederlandse juridische zaak. Geef een gestructureerde analyse in het Nederlands.

Zaak titel: ${caseData.title}
Beschrijving: ${caseData.description}
Claim bedrag: €${caseData.claimAmount}
Wederpartij: ${caseData.counterpartyName}

Documenten inhoud:
${extractedTexts.join('\n\n---\n\n')}

Geef een JSON response met de volgende structuur:
{
  "facts": ["feit 1", "feit 2", ...],
  "issues": ["probleem 1", "probleem 2", ...],
  "missing_documents": ["ontbrekend document 1", "ontbrekend document 2", ...],
  "parties": [{"name": "partij naam", "role": "rol", "details": "extra info"}],
  "claims": [{"type": "claim type", "amount": "bedrag", "basis": "juridische basis"}],
  "legal_basis": ["wetsartikel 1", "wetsartikel 2", ...],
  "risk_notes": ["risico 1", "risico 2", ...]
}

Zorg dat alle tekst in het Nederlands is en zakelijk-vriendelijk geformuleerd.
`;

    try {
      const response = await this.callLLM(prompt);
      return JSON.parse(response);
    } catch (error) {
      console.error("Error in AI analysis:", error);
      // Return minimal structure on error
      return {
        facts: ["Analyse kon niet worden voltooid"],
        issues: ["AI analyse fout opgetreden"],
        missing_documents: ["Volledige documentatie vereist"],
        parties: [],
        claims: [],
        legal_basis: [],
        risk_notes: ["Raadpleeg een juridisch expert"]
      };
    }
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

  private async callLLM(prompt: string): Promise<string> {
    if (this.provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4",
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
