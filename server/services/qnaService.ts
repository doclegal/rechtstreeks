import { db } from "../db";
import { cases, caseDocuments, analyses, qnaItems, type QnaItem } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Build complete case context for MindStudio InfoQnA.flow
 * Same context as Chat.flow: case details, documents, RKOS analysis, legal advice
 */
export async function buildQnAContext(caseId: string): Promise<any> {
  console.log(`📋 Building Q&A context for case ${caseId}`);

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
      documents: docs.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        mimetype: doc.mimetype,
        extracted_text: doc.extractedText?.substring(0, 2000), // Limit text
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
  };

  console.log(`✅ Q&A context built: ${docs.length} docs, ${rkosAnalysis ? 'RKOS' : 'no'} analysis, ${legalAdvice ? 'advice' : 'no advice'}`);
  
  return context;
}

/**
 * Call MindStudio InfoQnA.flow to generate Q&A pairs
 * Returns array of {question, answer} objects
 */
export async function callInfoQnAFlow(caseId: string): Promise<Array<{question: string, answer: string}>> {
  console.log(`❓ Calling InfoQnA.flow for case ${caseId}`);
  
  const context = await buildQnAContext(caseId);
  
  const variables = {
    input_json: context, // Complete case context
  };

  console.log(`📤 InfoQnA.flow variables: ${JSON.stringify({
    context_keys: Object.keys(context),
  })}`);

  const requestBody = {
    workerId: process.env.MS_AGENT_APP_ID, // Same as RKOS.flow, Chat.flow, Create_advice.flow
    variables,
    workflow: "InfoQnA.flow", // Case-sensitive!
    includeBillingCost: true
  };

  console.log("📤 InfoQnA.flow request body:", JSON.stringify(requestBody, null, 2));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout

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
      console.error("❌ InfoQnA.flow API error:", response.status, errorText);
      throw new Error(`MindStudio API error: ${response.status} - ${errorText}`);
    }

    const flowResult = await response.json();
    console.log("📥 InfoQnA.flow raw response received");
    
    // Extract Q&A pairs from InfoQnA.flow End output
    // Expected format: result.qna_pairs as array of {question, answer}
    let qnaPairs: Array<{question: string, answer: string}> = [];
    
    if (flowResult.result?.qna_pairs) {
      const rawPairs = flowResult.result.qna_pairs;
      
      // Handle if it's a JSON string
      if (typeof rawPairs === 'string') {
        try {
          qnaPairs = JSON.parse(rawPairs);
        } catch (e) {
          console.error('Could not parse qna_pairs JSON string');
        }
      } else if (Array.isArray(rawPairs)) {
        qnaPairs = rawPairs;
      }
    } else if (flowResult.result?.qna_items) {
      // Alternative field name
      const rawItems = flowResult.result.qna_items;
      if (typeof rawItems === 'string') {
        try {
          qnaPairs = JSON.parse(rawItems);
        } catch (e) {
          console.error('Could not parse qna_items JSON string');
        }
      } else if (Array.isArray(rawItems)) {
        qnaPairs = rawItems;
      }
    }

    if (!Array.isArray(qnaPairs) || qnaPairs.length === 0) {
      console.warn("⚠️ No Q&A pairs generated");
      return [];
    }

    console.log(`✅ InfoQnA.flow generated ${qnaPairs.length} Q&A pairs`);
    
    return qnaPairs;

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error("⏱️ InfoQnA.flow timeout after 3 minutes");
      throw new Error("Q&A generatie timeout - de AI-service reageert niet binnen 3 minuten");
    }
    
    console.error("❌ InfoQnA.flow error:", error);
    throw error;
  }
}

/**
 * Save Q&A pairs to database (replace existing for case)
 */
export async function saveQnAPairs(caseId: string, pairs: Array<{question: string, answer: string}>): Promise<QnaItem[]> {
  console.log(`💾 Saving ${pairs.length} Q&A pairs for case ${caseId}`);
  
  // Delete existing Q&A items for this case
  await db.delete(qnaItems).where(eq(qnaItems.caseId, caseId));
  
  // Insert new Q&A pairs
  const insertedItems: QnaItem[] = [];
  
  for (let i = 0; i < pairs.length; i++) {
    const [item] = await db.insert(qnaItems).values({
      caseId,
      question: pairs[i].question,
      answer: pairs[i].answer,
      order: i,
    }).returning();
    
    insertedItems.push(item);
  }
  
  console.log(`✅ Saved ${insertedItems.length} Q&A items`);
  return insertedItems;
}

/**
 * Get Q&A items for a case
 */
export async function getQnAItems(caseId: string): Promise<QnaItem[]> {
  return await db
    .select()
    .from(qnaItems)
    .where(eq(qnaItems.caseId, caseId))
    .orderBy(qnaItems.order);
}
