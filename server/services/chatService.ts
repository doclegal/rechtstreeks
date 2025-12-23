import { db } from "../db";
import { cases, caseDocuments, analyses, letters, summons, chatMessages, type CaseDocument, type Letter, type Summons, type ChatMessage } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Build complete case context for MindStudio Chat.flow
 * Includes: case details, documents, RKOS analysis, legal advice, letters, summons
 */
export async function buildCaseContext(caseId: string): Promise<any> {
  console.log(`📋 Building chat context for case ${caseId}`);

  // Fetch case with all related data
  const [caseData] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  
  if (!caseData) {
    throw new Error(`Case ${caseId} not found`);
  }

  // Fetch documents
  const docs = await db.select().from(caseDocuments).where(eq(caseDocuments.caseId, caseId));
  
  // Fetch latest analysis (RKOS + legal advice)
  const analysisRecords = await db
    .select()
    .from(analyses)
    .where(eq(analyses.caseId, caseId))
    .orderBy(desc(analyses.createdAt))
    .limit(1);
  
  const latestAnalysis = analysisRecords[0] || null;

  // Fetch letters
  const letterRecords = await db
    .select()
    .from(letters)
    .where(eq(letters.caseId, caseId))
    .orderBy(desc(letters.createdAt));

  // Fetch summons
  const summonsRecords = await db
    .select()
    .from(summons)
    .where(eq(summons.caseId, caseId))
    .orderBy(desc(summons.createdAt));

  // Extract RKOS analysis
  let rkosAnalysis = null;
  let legalAdvice = null;
  
  if (latestAnalysis) {
    // Check for succesKansAnalysis (RKOS.flow)
    if ((latestAnalysis as any).succesKansAnalysis) {
      rkosAnalysis = (latestAnalysis as any).succesKansAnalysis;
    }
    
    // Check for legalAdviceJson (Create_advice.flow)
    if ((latestAnalysis as any).legalAdviceJson) {
      legalAdvice = (latestAnalysis as any).legalAdviceJson;
    }
    
    // Fallback to legacy rawText parsing if needed
    if (!rkosAnalysis && latestAnalysis.rawText) {
      try {
        const rawData = JSON.parse(latestAnalysis.rawText);
        if (rawData.result?.analysis_json) {
          rkosAnalysis = typeof rawData.result.analysis_json === 'string' 
            ? JSON.parse(rawData.result.analysis_json) 
            : rawData.result.analysis_json;
        }
      } catch (e) {
        console.warn('Could not parse rawText for analysis');
      }
    }
  }

  // Build structured context
  const context = {
    zaakgegevens: {
      case_id: caseData.id,
      title: caseData.title,
      category: caseData.category,
      description: caseData.description,
      claim_amount: caseData.claimAmount,
      status: caseData.status,
      current_step: caseData.currentStep,
      claimant: {
        name: caseData.claimantName,
        address: caseData.claimantAddress,
        city: caseData.claimantCity,
      },
      counterparty: {
        type: caseData.counterpartyType,
        name: caseData.counterpartyName,
        email: caseData.counterpartyEmail,
        phone: caseData.counterpartyPhone,
        address: caseData.counterpartyAddress,
        city: caseData.counterpartyCity,
      },
      user_role: caseData.userRole,
    },
    dossier: {
      documents: docs.map((doc: CaseDocument) => ({
        id: doc.id,
        filename: doc.filename,
        mimetype: doc.mimetype,
        extracted_text: doc.extractedText?.substring(0, 2000), // Limit text to avoid huge payloads
        analysis: doc.documentAnalysis,
      })),
      document_count: docs.length,
    },
    analyse: rkosAnalysis ? {
      type: 'rkos',
      data: rkosAnalysis,
    } : null,
    juridisch_advies: legalAdvice ? {
      type: 'create_advice',
      data: legalAdvice,
    } : null,
    brieven: letterRecords.map((letter: Letter) => ({
      id: letter.id,
      type: letter.briefType,
      status: letter.status,
      created_at: letter.createdAt,
    })),
    dagvaardingen: summonsRecords.map((s: Summons) => ({
      id: s.id,
      status: s.status,
      template_version: s.templateVersion,
      created_at: s.createdAt,
    })),
  };

  console.log(`✅ Chat context built: ${docs.length} docs, ${rkosAnalysis ? 'RKOS' : 'no'} analysis, ${legalAdvice ? 'advice' : 'no advice'}`);
  
  return context;
}

/**
 * Get conversation history for a case
 */
export async function getConversationHistory(caseId: string): Promise<Array<{role: string, content: string}>> {
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.caseId, caseId))
    .orderBy(chatMessages.createdAt);

  return messages.map((msg: ChatMessage) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Save a chat message to the database
 */
export async function saveChatMessage(caseId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  await db.insert(chatMessages).values({
    caseId,
    role,
    content,
  });
}

/**
 * Call MindStudio Chat.flow with case context and conversation history
 */
export async function callChatFlow(
  caseId: string,
  userQuestion: string,
  conversationHistory: Array<{role: string, content: string}>
): Promise<string> {
  console.log(`💬 Calling Chat.flow for case ${caseId}`);
  
  const context = await buildCaseContext(caseId);
  
  const variables = {
    last_question: userQuestion, // The specific question to answer NOW
    input_json: context, // Complete case context
    conversation_history: conversationHistory, // Full conversation for context
  };

  console.log(`📤 Chat.flow variables: ${JSON.stringify({
    last_question: userQuestion,
    context_keys: Object.keys(context),
    history_length: conversationHistory.length,
  })}`);

  // Log API key presence (never log actual key values)
  const hasApiKey = !!process.env.MINDSTUDIO_API_KEY;
  console.log(`🔑 MindStudio config: API key ${hasApiKey ? '✓' : '✗'}`);

  const requestBody = {
    workerId: process.env.MS_AGENT_APP_ID, // Same as RKOS.flow and Create_advice.flow
    variables,
    workflow: "Chat.flow", // Case-sensitive!
    includeBillingCost: true
  };

  console.log("📤 Chat.flow request body:", JSON.stringify(requestBody, null, 2));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

  try {
    const response = await fetch("https://v1.mindstudio-api.com/developer/v2/agents/run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Chat.flow API error:", response.status, errorText);
      throw new Error(`MindStudio API error: ${response.status} - ${errorText}`);
    }

    const flowResult = await response.json();
    console.log("📥 Chat.flow raw response received");
    
    // Extract assistant response from Chat.flow End output
    let assistantResponse = '';
    
    if (flowResult.result) {
      // Chat.flow returns result.chat_response from End step
      const rawResponse = flowResult.result.chat_response 
        || flowResult.result.assistant_response 
        || flowResult.result.answer 
        || flowResult.result.response
        || flowResult.result.text;
      
      // If the response is still a JSON string, try to parse it
      if (typeof rawResponse === 'string') {
        // Check if it looks like JSON
        if (rawResponse.trim().startsWith('{') && rawResponse.includes('chat_response')) {
          try {
            const parsed = JSON.parse(rawResponse);
            assistantResponse = parsed.chat_response || rawResponse;
          } catch (e) {
            // Not valid JSON, use as-is
            assistantResponse = rawResponse;
          }
        } else {
          assistantResponse = rawResponse;
        }
      } else {
        assistantResponse = JSON.stringify(flowResult.result);
      }
    } else if (flowResult.output) {
      assistantResponse = flowResult.output;
    } else {
      assistantResponse = "Sorry, ik kon geen antwoord genereren. Probeer het opnieuw.";
    }

    console.log(`✅ Chat.flow response received: ${assistantResponse.substring(0, 100)}...`);
    
    return assistantResponse;

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error("⏱️ Chat.flow timeout after 2 minutes");
      throw new Error("Chat timeout - de AI-assistent reageert niet binnen 2 minuten");
    }
    
    console.error("❌ Chat.flow error:", error);
    throw error;
  }
}
