import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { caseService } from "./services/caseService";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCaseSchema, insertDocumentSchema, insertInvitationSchema, type CaseStatus, cases, analyses, savedLegislation, caseDocuments } from "@shared/schema";
import { aiService, AIService } from "./services/aiService";
import { fileService } from "./services/fileService";
import { pdfService } from "./services/pdfService";
import { supabaseStorageService } from "./services/supabaseStorageService";
import { supabase } from "./supabaseClient";
import { documentAnalysisService, type MindStudioAnalysis } from "./services/documentAnalysisService";
import { rkosAnalysisService } from "./services/rkosAnalysisService";
import { legalAdviceService } from "./services/legalAdviceService";
import { letterService } from "./services/letterService";
import { savedJurisprudenceService } from "./services/savedJurisprudenceService";
import { savedLegislationService } from "./services/savedLegislationService";
import { mockIntegrations } from "./services/mockIntegrations";
import { db, handleDatabaseError } from "./db";
import { eq, desc, and, sql, gte, or, count, countDistinct } from "drizzle-orm";
import { users, cases as casesTable, caseDocuments as caseDocumentsTable, analyses as analysesTable } from "@shared/schema";
import { getConversationHistory, saveChatMessage, callChatFlow } from "./services/chatService";
import { callInfoQnAFlow, saveQnAPairs, getQnAItems, appendQnAPairs } from "./services/qnaService";
import { validateSummonsV1 } from "@shared/summonsValidation";
import { parseTemplateText, extractTextFromFile, validateParsedTemplate } from "./services/templateParser";
import { sendInvitationEmail } from "./email";
import multer from "multer";
import { z } from "zod";
import { SEARCH_CONFIG } from "@shared/searchConfig";
import { scoreAndSortResults } from "./scoringService";
import { rerankResults } from "./rerankerService";
import { createHash, timingSafeEqual } from "crypto";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB aligned with route validation
});

// Helper function to convert Replit IDs to UUID format
function replitIdToUuid(replitId: string): string {
  const hash = createHash('sha256').update(`replit-user-${replitId}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function ensureUuid(userId: string): string {
  if (isValidUuid(userId)) {
    return userId;
  }
  return replitIdToUuid(userId);
}

// Helper function to generate unique invitation code
function generateInvitationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like O, 0, I, 1
  const segments = 3;
  const segmentLength = 3;
  
  const code = Array.from({ length: segments }, () => {
    return Array.from({ length: segmentLength }, () => 
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }).join('-');
  
  return code; // e.g., "ABC-DEF-123"
}

// Helper function to check if user can access case
function canAccessCase(userId: string, caseData: any): boolean {
  const userUuid = ensureUuid(userId);
  return caseData.ownerUserId === userUuid || caseData.counterpartyUserId === userUuid;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Case routes
  app.post('/api/cases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const caseData = insertCaseSchema.parse({
        ...req.body,
        ownerUserId: userId,
      });
      
      const newCase = await caseService.createCase(caseData);
      
      // Create initial event (optional - may fail if using Supabase for cases)
      try {
        await storage.createEvent({
          caseId: newCase.id,
          actorUserId: userId,
          type: "case_created",
          payloadJson: { caseId: newCase.id },
        });
      } catch (eventError) {
        console.log("Note: Event creation skipped (case stored in Supabase)");
      }
      
      res.json(newCase);
    } catch (error) {
      const dbError = handleDatabaseError(error);
      res.status(dbError.status).json({ message: dbError.message });
    }
  });

  // Helper function to parse fullAnalysis rawText and extract parsedAnalysis + new keys
  function enrichFullAnalysis(fullAnalysis: any) {
    if (!fullAnalysis) return fullAnalysis;
    
    // RKOS-only record: If we only have succesKansAnalysis (from RKOS.flow), build minimal parsedAnalysis from it
    if (fullAnalysis.succesKansAnalysis && !fullAnalysis.analysisJson) {
      const rkos = fullAnalysis.succesKansAnalysis as any;
      return {
        ...fullAnalysis,
        parsedAnalysis: {
          summary: rkos.summary_verdict || rkos.assessment || '',
          case_overview: { parties: [] },
          facts: {
            known: rkos.facts || [],
            disputed: [],
            unclear: []
          },
          legal_analysis: rkos.legal_analysis || {},
          risk_assessment: {
            strengths: rkos.strengths || [],
            weaknesses: rkos.weaknesses || [],
            risks: rkos.risks || []
          },
          recommended_claims: rkos.recommended_claims || [],
          applicable_rules: rkos.applicable_laws || []
        },
        extractedTexts: fullAnalysis.extractedTexts || null,
        allFiles: fullAnalysis.allFiles || null,
        userContext: fullAnalysis.userContext || null,
        procedureContext: fullAnalysis.procedureContext || null,
        succesKansAnalysis: rkos,
        legalAdviceJson: fullAnalysis.legalAdviceJson || null,
        missingInformation: fullAnalysis.missingInformation || rkos.missing_elements || null
      };
    }
    
    // IMPORTANT: If analysisJson is directly available, use it as parsedAnalysis
    // This is the new standard format where parsedAnalysis is stored directly in the DB
    if (fullAnalysis.analysisJson && typeof fullAnalysis.analysisJson === 'object') {
      return {
        ...fullAnalysis,
        parsedAnalysis: fullAnalysis.analysisJson,
        extractedTexts: fullAnalysis.extractedTexts || null,
        allFiles: fullAnalysis.allFiles || null,
        userContext: fullAnalysis.userContext || null,
        procedureContext: fullAnalysis.procedureContext || null,
        flags: fullAnalysis.analysisJson?.flags || null,
        goNogoAdvice: fullAnalysis.analysisJson?.go_nogo_advice || null,
        readyForSummons: fullAnalysis.analysisJson?.ready_for_summons,
        succesKansAnalysis: fullAnalysis.succesKansAnalysis || null,
        legalAdviceJson: fullAnalysis.legalAdviceJson || null,
        missingInformation: fullAnalysis.missingInformation || null
      };
    }
    
    // Fallback: Try to parse from rawText if analysisJson is not available
    if (!fullAnalysis.rawText) return fullAnalysis;
    
    try {
      const data = JSON.parse(fullAnalysis.rawText);
      let parsedAnalysis = null;
      let extractedTexts = null;
      let allFiles = null;
      let userContext = null;
      let procedureContext = null;
      let flags = null;
      let goNogoAdvice = null;
      let readyForSummons = null;
      
      // PRIMARY: Try to get all keys from top level (direct from aiService)
      if (data.parsedAnalysis && typeof data.parsedAnalysis === 'object') {
        parsedAnalysis = data.parsedAnalysis;
      }
      if (data.extractedTexts) extractedTexts = data.extractedTexts;
      if (data.allFiles) allFiles = data.allFiles;
      if (data.userContext) userContext = data.userContext;
      if (data.procedureContext) procedureContext = data.procedureContext;
      if (data.flags) flags = data.flags;
      if (data.goNogoAdvice) goNogoAdvice = data.goNogoAdvice;
      if (data.readyForSummons !== undefined) readyForSummons = data.readyForSummons;
      
      // SECONDARY: Try to get keys from data.result (new consistent MindStudio format)
      if (data.result) {
        if (!parsedAnalysis && data.result.analysis_json) {
          const resultValue = data.result.analysis_json;
          if (typeof resultValue === 'string' && !resultValue.includes('{{')) {
            parsedAnalysis = JSON.parse(resultValue);
          } else if (typeof resultValue === 'object') {
            parsedAnalysis = resultValue;
          }
        }
        if (!extractedTexts && data.result.extracted_texts) {
          extractedTexts = typeof data.result.extracted_texts === 'string' 
            ? JSON.parse(data.result.extracted_texts) 
            : data.result.extracted_texts;
        }
        if (!allFiles && data.result.all_files) {
          allFiles = typeof data.result.all_files === 'string' 
            ? JSON.parse(data.result.all_files) 
            : data.result.all_files;
        }
        if (!userContext && data.result.user_context) {
          userContext = typeof data.result.user_context === 'string' 
            ? JSON.parse(data.result.user_context) 
            : data.result.user_context;
        }
        if (!procedureContext && data.result.procedure_context) {
          procedureContext = typeof data.result.procedure_context === 'string' 
            ? JSON.parse(data.result.procedure_context) 
            : data.result.procedure_context;
        }
        // Try top-level first, then check inside parsedAnalysis
        if (!flags && data.result.flags) {
          flags = typeof data.result.flags === 'string' 
            ? JSON.parse(data.result.flags) 
            : data.result.flags;
        } else if (!flags && parsedAnalysis?.flags) {
          flags = parsedAnalysis.flags;
        }
        if (!goNogoAdvice && data.result.go_nogo_advice) {
          goNogoAdvice = typeof data.result.go_nogo_advice === 'string' 
            ? JSON.parse(data.result.go_nogo_advice) 
            : data.result.go_nogo_advice;
        } else if (!goNogoAdvice && parsedAnalysis?.go_nogo_advice) {
          goNogoAdvice = parsedAnalysis.go_nogo_advice;
        }
        if (readyForSummons === null && data.result.ready_for_summons !== undefined) {
          readyForSummons = data.result.ready_for_summons;
        } else if (readyForSummons === null && parsedAnalysis?.ready_for_summons !== undefined) {
          readyForSummons = parsedAnalysis.ready_for_summons;
        }
      }
      
      // FALLBACK: Extract from MindStudio response structure (old format)
      if (!parsedAnalysis && data.thread?.posts) {
        // Look for analysis_json in thread posts
        for (const post of data.thread.posts) {
          if (!parsedAnalysis && post.debugLog?.newState?.variables?.analysis_json?.value) {
            const responseValue = post.debugLog.newState.variables.analysis_json.value;
            parsedAnalysis = typeof responseValue === 'string' ? JSON.parse(responseValue) : responseValue;
            break;
          }
        }
      }
      // Check data.result (fallback)
      else if (data.result && data.result.analysis_json) {
        const resultValue = data.result.analysis_json;
        if (typeof resultValue === 'string' && !resultValue.includes('{{')) {
          parsedAnalysis = JSON.parse(resultValue);
        } else if (typeof resultValue === 'object') {
          parsedAnalysis = resultValue;
        }
      }
      
      if (parsedAnalysis) {
        return {
          ...fullAnalysis,
          parsedAnalysis,
          extractedTexts,
          allFiles,
          userContext,
          procedureContext,
          flags,
          goNogoAdvice,
          readyForSummons,
          succesKansAnalysis: fullAnalysis.succesKansAnalysis
        };
      }
    } catch (error) {
      // Silently fail - frontend will handle parsing
    }
    
    return fullAnalysis;
  }

  app.get('/api/cases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userCases = await caseService.getCasesForUser(userId);
      
      // For each case, include analysis and other related data
      const casesWithDetails = await Promise.all(
        userCases.map(async (caseData) => {
          // Owner sees all documents, counterparty only sees their own
          const documents = caseData.ownerUserId === ensureUuid(userId)
            ? await storage.getDocumentsByCase(caseData.id)
            : await storage.getDocumentsByCaseForUser(caseData.id, userId);
          const analysis = await storage.getLatestAnalysis(caseData.id);
          const kantonAnalysis = await storage.getAnalysisByType(caseData.id, 'mindstudio-kanton-check');
          let fullAnalysis = await storage.getAnalysisByType(caseData.id, 'mindstudio-full-analysis');
          
          // Enrich fullAnalysis with parsedAnalysis from rawText
          fullAnalysis = enrichFullAnalysis(fullAnalysis);
          
          // Fetch RKOS analysis from Supabase (gracefully handle errors)
          let rkosAnalysis = null;
          try {
            rkosAnalysis = await rkosAnalysisService.getLatestCompletedAnalysis(caseData.id);
          } catch (rkosError) {
            console.warn(`Failed to fetch RKOS for case ${caseData.id}:`, rkosError);
          }
          
          // Fetch legal advice from Supabase (gracefully handle errors)
          let supabaseLegalAdvice = null;
          try {
            supabaseLegalAdvice = await legalAdviceService.getLatestCompletedAdvice(caseData.id);
          } catch (adviceError) {
            console.warn(`Failed to fetch legal advice for case ${caseData.id}:`, adviceError);
          }
          
          const letters = await letterService.getLettersByCaseId(caseData.id);
          const summons = await storage.getSummonsByCase(caseData.id);
          const progress = storage.computeProgress(caseData);
          
          return {
            ...caseData,
            documents,
            analysis,
            kantonAnalysis,
            fullAnalysis,
            rkosAnalysis,
            supabaseLegalAdvice,
            letters,
            summons,
            progress,
          };
        })
      );
      
      res.json(casesWithDetails);
    } catch (error) {
      const dbError = handleDatabaseError(error);
      res.status(dbError.status).json({ message: dbError.message });
    }
  });

  app.get('/api/cases/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await caseService.getCaseById(req.params.id);
      
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      if (!canAccessCase(userId, caseData)) {
        return res.status(403).json({ message: "Unauthorized access to case" });
      }
      
      // Include related data - owner sees all documents, counterparty only sees their own
      const documents = caseData.ownerUserId === ensureUuid(userId)
        ? await storage.getDocumentsByCase(caseData.id)
        : await storage.getDocumentsByCaseForUser(caseData.id, userId);
      const analysis = await storage.getLatestAnalysis(caseData.id);
      const kantonAnalysis = await storage.getAnalysisByType(caseData.id, 'mindstudio-kanton-check');
      let fullAnalysis = await storage.getAnalysisByType(caseData.id, 'mindstudio-full-analysis');
      
      // Enrich fullAnalysis with parsedAnalysis from rawText
      fullAnalysis = enrichFullAnalysis(fullAnalysis);
      
      // Fetch RKOS analysis from Supabase (gracefully handle errors)
      let rkosAnalysis = null;
      try {
        rkosAnalysis = await rkosAnalysisService.getLatestCompletedAnalysis(caseData.id);
      } catch (rkosError) {
        console.warn(`Failed to fetch RKOS for case ${caseData.id}:`, rkosError);
      }
      
      // Fetch legal advice from Supabase (gracefully handle errors)
      let supabaseLegalAdvice = null;
      try {
        supabaseLegalAdvice = await legalAdviceService.getLatestCompletedAdvice(caseData.id);
      } catch (adviceError) {
        console.warn(`Failed to fetch legal advice for case ${caseData.id}:`, adviceError);
      }
      
      const letters = await letterService.getLettersByCaseId(caseData.id);
      const summons = await storage.getSummonsByCase(caseData.id);
      const progress = storage.computeProgress(caseData);
      
      res.json({
        ...caseData,
        documents,
        analysis,
        kantonAnalysis,
        fullAnalysis,
        rkosAnalysis,
        supabaseLegalAdvice,
        letters,
        summons,
        progress,
      });
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ message: "Failed to fetch case" });
    }
  });

  app.patch('/api/cases/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userUuid = ensureUuid(userId);
      const caseData = await caseService.getCaseById(req.params.id);
      
      if (!caseData || caseData.ownerUserId !== userUuid) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const updates = insertCaseSchema.partial().parse(req.body);
      const updatedCase = await caseService.updateCase(req.params.id, updates);
      
      try {
        await storage.createEvent({
          caseId: updatedCase.id,
          actorUserId: userId,
          type: "case_updated",
          payloadJson: updates,
        });
      } catch (eventError) {
        console.log("Event creation skipped (case in Supabase only)");
      }
      
      res.json(updatedCase);
    } catch (error) {
      console.error("Error updating case:", error);
      res.status(500).json({ message: "Failed to update case" });
    }
  });

  // Delete case
  app.delete('/api/cases/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userUuid = ensureUuid(userId);
      const caseData = await caseService.getCaseById(req.params.id);
      
      if (!caseData || caseData.ownerUserId !== userUuid) {
        return res.status(404).json({ message: "Zaak niet gevonden" });
      }
      
      await caseService.deleteCase(req.params.id);
      
      try {
        await storage.createEvent({
          caseId: req.params.id,
          actorUserId: userId,
          type: "case_deleted",
          payloadJson: { title: caseData.title },
        });
      } catch (eventError) {
        console.log("Event creation skipped (case in Supabase only)");
      }
      
      res.json({ success: true, message: "Zaak succesvol verwijderd" });
    } catch (error) {
      console.error("Error deleting case:", error);
      res.status(500).json({ message: "Fout bij het verwijderen van de zaak" });
    }
  });

  // Clear unseen missing items notification
  app.patch('/api/cases/:id/clear-unseen-missing', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await caseService.getCaseById(req.params.id);
      
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      await caseService.updateCase(req.params.id, { hasUnseenMissingItems: false });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing unseen missing items:", error);
      res.status(500).json({ message: "Failed to clear notification" });
    }
  });

  // === INVITATION ROUTES ===
  
  // Send invitation to counterparty
  app.post('/api/cases/:id/invite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await caseService.getCaseById(req.params.id);
      
      if (!caseData) {
        return res.status(404).json({ message: "Zaak niet gevonden" });
      }
      
      // Only owner can send invitations
      if (caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(403).json({ message: "Alleen de eigenaar kan uitnodigingen versturen" });
      }
      
      // Check if counterparty already accepted
      if (caseData.counterpartyUserId) {
        return res.status(400).json({ message: "Wederpartij heeft al een account gekoppeld aan deze zaak" });
      }
      
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is verplicht" });
      }
      
      // Cancel any existing pending invitations for this case
      const existingInvitations = await storage.getInvitationsByCase(caseData.id);
      const pendingInvitations = existingInvitations.filter(inv => inv.status === 'PENDING');
      for (const inv of pendingInvitations) {
        await storage.updateInvitation(inv.id, { status: 'CANCELLED' });
      }
      
      // Generate unique invitation code
      let invitationCode = generateInvitationCode();
      let attempts = 0;
      while (await storage.getInvitationByCode(invitationCode) && attempts < 10) {
        invitationCode = generateInvitationCode();
        attempts++;
      }
      
      // Create invitation (expires in 30 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      const invitation = await storage.createInvitation({
        caseId: caseData.id,
        invitedByUserId: userId,
        invitedEmail: email.toLowerCase(),
        invitationCode,
        status: 'PENDING',
        expiresAt,
      });
      
      // Get inviter info
      const inviter = await storage.getUser(userId);
      const inviterName = inviter?.firstName || inviter?.email?.split('@')[0] || 'Een gebruiker';
      
      // Send invitation email
      const emailResult = await sendInvitationEmail({
        to: email,
        invitationCode: invitation.invitationCode,
        caseTitle: caseData.title,
        inviterName,
      });
      
      if (!emailResult.success) {
        console.warn('⚠️ Failed to send invitation email, but invitation was created:', emailResult.error);
      }
      
      res.json({
        success: true,
        emailSent: emailResult.success,
        invitation: {
          id: invitation.id,
          invitationCode: invitation.invitationCode,
          invitedEmail: invitation.invitedEmail,
          expiresAt: invitation.expiresAt,
        }
      });
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: "Fout bij versturen uitnodiging" });
    }
  });
  
  // Get invitation info by code (public - no auth required)
  app.get('/api/invitations/:code', async (req: any, res) => {
    try {
      const invitation = await storage.getInvitationByCode(req.params.code);
      
      if (!invitation) {
        return res.status(404).json({ message: "Uitnodiging niet gevonden" });
      }
      
      // Check if expired
      if (invitation.status === 'EXPIRED' || new Date() > new Date(invitation.expiresAt)) {
        return res.status(410).json({ message: "Uitnodiging is verlopen" });
      }
      
      if (invitation.status !== 'PENDING') {
        return res.status(400).json({ message: "Uitnodiging is al gebruikt" });
      }
      
      // Get case info
      const caseData = await caseService.getCaseById(invitation.caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Zaak niet gevonden" });
      }
      
      // Return limited case info for the invitation page
      res.json({
        invitation: {
          invitedEmail: invitation.invitedEmail,
          expiresAt: invitation.expiresAt,
        },
        case: {
          id: caseData.id,
          title: caseData.title,
          description: caseData.description,
          category: caseData.category,
          claimAmount: caseData.claimAmount,
          claimantName: caseData.claimantName,
          counterpartyName: caseData.counterpartyName,
          userRole: caseData.userRole, // EISER or GEDAAGDE (from owner's perspective)
        }
      });
    } catch (error) {
      console.error("Error fetching invitation:", error);
      res.status(500).json({ message: "Fout bij ophalen uitnodiging" });
    }
  });
  
  // Accept invitation (requires authentication)
  app.post('/api/invitations/:code/accept', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const invitation = await storage.getInvitationByCode(req.params.code);
      
      if (!invitation) {
        return res.status(404).json({ message: "Uitnodiging niet gevonden" });
      }
      
      // Check if expired
      if (invitation.status === 'EXPIRED' || new Date() > new Date(invitation.expiresAt)) {
        return res.status(410).json({ message: "Uitnodiging is verlopen" });
      }
      
      if (invitation.status !== 'PENDING') {
        return res.status(400).json({ message: "Uitnodiging is al gebruikt" });
      }
      
      // Check if email matches (case-insensitive)
      if (user?.email?.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
        return res.status(403).json({ 
          message: "Deze uitnodiging is verstuurd naar een ander e-mailadres",
          invitedEmail: invitation.invitedEmail,
          yourEmail: user?.email
        });
      }
      
      // Get case
      const caseData = await caseService.getCaseById(invitation.caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Zaak niet gevonden" });
      }
      
      // Check if case already has counterparty
      if (caseData.counterpartyUserId) {
        return res.status(400).json({ message: "Deze zaak heeft al een wederpartij" });
      }
      
      // Link user to case as counterparty
      await caseService.updateCase(caseData.id, {
        counterpartyUserId: userId,
      });
      
      // Mark invitation as accepted
      await storage.updateInvitation(invitation.id, {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        acceptedByUserId: userId,
      });
      
      // Create event
      await storage.createEvent({
        caseId: caseData.id,
        actorUserId: userId,
        type: "counterparty_joined",
        payloadJson: { invitationCode: invitation.invitationCode },
      });
      
      res.json({
        success: true,
        caseId: caseData.id,
        message: "Uitnodiging geaccepteerd! Je bent nu toegevoegd aan de zaak."
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Fout bij accepteren uitnodiging" });
    }
  });
  
  // Approve case description (counterparty only)
  app.patch('/api/cases/:id/approve-description', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await caseService.getCaseById(req.params.id);
      
      if (!caseData) {
        return res.status(404).json({ message: "Zaak niet gevonden" });
      }
      
      // Only counterparty can approve description
      if (caseData.counterpartyUserId !== userId) {
        return res.status(403).json({ message: "Alleen de wederpartij kan de omschrijving goedkeuren" });
      }
      
      await caseService.updateCase(req.params.id, {
        counterpartyDescriptionApproved: true,
      });
      
      await storage.createEvent({
        caseId: caseData.id,
        actorUserId: userId,
        type: "description_approved",
        payloadJson: {},
      });
      
      res.json({ success: true, message: "Zaak omschrijving goedgekeurd" });
    } catch (error) {
      console.error("Error approving description:", error);
      res.status(500).json({ message: "Fout bij goedkeuren omschrijving" });
    }
  });

  // Case deadlines endpoint
  app.get('/api/cases/:id/deadlines', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await caseService.getCaseById(req.params.id);
      
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      if (!canAccessCase(userId, caseData)) {
        return res.status(403).json({ message: "Unauthorized access to case" });
      }
      
      // For now, return empty deadlines. Later this can be enhanced with actual deadline logic
      const deadlines: Array<{ id: string; title: string; date: Date; priority: 'high' | 'medium' | 'low' }> = [];
      
      res.json({ deadlines });
    } catch (error) {
      const dbError = handleDatabaseError(error);
      res.status(dbError.status).json({ message: dbError.message });
    }
  });

  // Negotiation summary endpoint - AI-generated status of negotiation progress
  app.get('/api/cases/:id/negotiation-summary', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await caseService.getCaseById(req.params.id);
      
      if (!caseData) {
        return res.status(404).json({ message: "Zaak niet gevonden" });
      }
      
      if (!canAccessCase(userId, caseData)) {
        return res.status(403).json({ message: "Geen toegang tot deze zaak" });
      }
      
      // Get letters and documents for this case
      const letters = await letterService.getLettersByCaseId(req.params.id);
      const documents = await storage.getDocumentsByCase(req.params.id);
      
      // If no letters, return empty summary
      if (!letters || letters.length === 0) {
        return res.json({
          summary: "Er zijn nog geen brieven verstuurd. Start de onderhandeling door een brief te genereren.",
          timeline: [],
          status: "niet_gestart",
          nextStep: "Genereer een eerste aanmaning of ingebrekestelling"
        });
      }
      
      // Format letters with human-readable dates for AI
      const formatDate = (date: Date | string | null | undefined): string => {
        if (!date) return "onbekende datum";
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
      };
      
      // Sort letters by date (oldest first) to show chronological order
      const sortedLetters = [...letters].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });
      
      // Generate AI summary with detailed letter and document info
      const summary = await aiService.generateNegotiationSummary({
        caseTitle: caseData.title || "Onbekende zaak",
        caseDescription: caseData.description || "",
        claimAmount: caseData.claimAmount?.toString() || "0",
        counterpartyName: caseData.counterpartyName || "Wederpartij",
        letters: sortedLetters.map(l => ({
          briefType: l.briefType || "brief",
          createdAt: formatDate(l.createdAt),
          createdAtISO: l.createdAt || new Date().toISOString(),
          tone: l.tone || "zakelijk",
          status: l.status || "draft",
          html: l.html || undefined
        })),
        documents: documents.map(d => ({
          filename: d.filename || "document",
          extractedText: d.extractedText || undefined,
          createdAt: formatDate(d.createdAt),
          createdAtISO: d.createdAt?.toISOString() || new Date().toISOString(),
          // Include document analysis if available (may indicate if from counterparty)
          documentAnalysis: d.documentAnalysis as any || undefined
        }))
      });
      
      res.json(summary);
    } catch (error) {
      console.error("Error generating negotiation summary:", error);
      res.status(500).json({ message: "Fout bij genereren samenvatting" });
    }
  });

  // Helper function to analyze a single document using Dossier_check.flow
  async function analyzeDocumentWithMindStudio(documentId: string, caseId: string) {
    try {
      console.log(`🔍 Starting document analysis for document ${documentId}`);
      
      // Get document and case data
      const document = await storage.getDocument(documentId);
      const caseData = await caseService.getCaseById(caseId);
      
      if (!document || !caseData) {
        console.error(`❌ Document or case not found for analysis`);
        return;
      }
      
      // Get the full analysis to provide context for document relevance assessment
      let fullAnalysis = await storage.getAnalysisByType(caseId, 'mindstudio-full-analysis');
      if (fullAnalysis) {
        fullAnalysis = enrichFullAnalysis(fullAnalysis);
        console.log(`📊 Found existing legal analysis for case - will include in document check`);
      }
      
      // Update status to analyzing
      await storage.updateDocument(documentId, { analysisStatus: 'analyzing' });
      
      // Check if MindStudio is configured
      if (!process.env.MINDSTUDIO_API_KEY || !process.env.MS_AGENT_APP_ID) {
        console.warn('⚠️ MindStudio not configured, skipping document analysis');
        await storage.updateDocument(documentId, { 
          analysisStatus: 'completed',
          documentAnalysis: {
            document_name: document.filename,
            document_type: 'unknown',
            is_readable: !!document.extractedText,
            belongs_to_case: true,
            summary: 'Automatische analyse niet beschikbaar (MindStudio niet geconfigureerd)',
            tags: [],
            note: null
          }
        });
        return;
      }
      
      // Generate a fresh time-bound signed URL for MindStudio access (1 hour validity)
      // This is secure: URL expires after 1 hour and cannot be reused indefinitely
      let downloadUrl: string;
      
      if (document.storageKey) {
        // Try to generate signed URL from object storage (production-ready)
        const signedUrl = await fileService.generateSignedUrl(document.storageKey, 1);
        
        if (signedUrl) {
          downloadUrl = signedUrl;
          console.log('🔐 Generated time-bound signed URL for MindStudio (1 hour expiry)');
        } else {
          // Fallback to proxy endpoint (dev/testing only)
          const publicBaseUrl = process.env.PUBLIC_BASE_URL 
            || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}` : 'http://localhost:5000');
          const encodedFilename = encodeURIComponent(document.filename);
          downloadUrl = `${publicBaseUrl}/api/documents/${documentId}/download/${encodedFilename}`;
          console.log('⚠️ Falling back to proxy endpoint (object storage unavailable)');
        }
      } else {
        // No storage key, use dev proxy URL
        const publicBaseUrl = process.env.PUBLIC_BASE_URL 
          || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}` : 'http://localhost:5000');
        const encodedFilename = encodeURIComponent(document.filename);
        downloadUrl = `${publicBaseUrl}/api/documents/${documentId}/download/${encodedFilename}`;
        console.log('📋 Using dev proxy URL (no storageKey)');
      }
      
      console.log('🔗 MindStudio download URL:', downloadUrl);
      console.log('📋 Document filename:', document.filename);
      
      // Prepare input JSON with document info, case details, and optional legal analysis
      const inputJsonData: any = {
        file_url: downloadUrl,
        file_name: document.filename
      };
      
      // ALWAYS add case_details - this is essential context for document relevance assessment
      // Build parties array from claimant and counterparty fields
      const parties: Array<{ name: string; role: string }> = [];
      if (caseData.claimantName) {
        parties.push({ name: caseData.claimantName, role: 'EISER' });
      }
      if (caseData.counterpartyName) {
        parties.push({ name: caseData.counterpartyName, role: 'GEDAAGDE' });
      }
      
      inputJsonData.case_details = {
        title: caseData.title || 'Onbekende zaak',
        description: caseData.description || '',
        parties: parties,
        claim_amount: caseData.claimAmount || null
      };
      console.log('📋 Including case_details:', {
        title: inputJsonData.case_details.title,
        parties: inputJsonData.case_details.parties.map((p: any) => `${p.name} (${p.role})`).join(', '),
        has_description: !!inputJsonData.case_details.description,
        claim_amount: inputJsonData.case_details.claim_amount
      });
      
      // Add legal analysis if available to provide context for document relevance assessment
      if (fullAnalysis?.parsedAnalysis) {
        inputJsonData.volledige_analyse = fullAnalysis.parsedAnalysis;
        console.log('📊 Including legal analysis in document check for better context');
        console.log('📋 Analysis includes:', Object.keys(fullAnalysis.parsedAnalysis));
        
        // Debug: Log the actual payload being sent to MindStudio
        const debugPayload = JSON.stringify(inputJsonData, null, 2);
        console.log('🔍 FULL PAYLOAD to MindStudio (first 2000 chars):', debugPayload.substring(0, 2000));
        
        // Check if parties info is present
        if (fullAnalysis.parsedAnalysis.case_overview?.parties) {
          console.log('👥 Parties in analysis:', fullAnalysis.parsedAnalysis.case_overview.parties.map((p: any) => p.name || p.role).join(', '));
        }
      } else {
        console.log('ℹ️  No legal analysis available yet - document will be assessed using case_details only');
      }
      
      console.log('📤 Calling MindStudio Dossier_check.flow for single document');
      
      // MindStudio v2 API call with input_json as JSON string
      const requestBody = {
        appId: process.env.MS_AGENT_APP_ID,
        workflow: 'Dossier_check.flow',
        variables: {
          // input_json must be a JSON STRING (not an object)
          input_json: JSON.stringify(inputJsonData)
        },
        includeBillingCost: true
      };
      
      console.log('📤 Sending to MindStudio with variables:', Object.keys(requestBody.variables));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000); // 3 minutes timeout
      
      const response = await fetch('https://v1.mindstudio-api.com/developer/v2/agents/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ MindStudio API error:", errorText);
        await storage.updateDocument(documentId, { 
          analysisStatus: 'failed',
          documentAnalysis: {
            document_name: document.filename,
            document_type: 'unknown',
            is_readable: !!document.extractedText,
            belongs_to_case: true,
            summary: 'Analyse mislukt. Probeer het later opnieuw.',
            tags: [],
            note: 'MindStudio API error'
          }
        });
        return;
      }
      
      const result = await response.json();
      console.log('✅ MindStudio document analysis result:', result);
      
      // Extract analysis from result
      let analysis = null;
      
      // MindStudio returns the analysis in result.result.result (nested structure)
      if (result.result && result.result.result) {
        const docAnalysis = result.result.result;
        console.log('🔍 DEBUG: docAnalysis:', JSON.stringify(docAnalysis, null, 2));
        
        // Check if we have the expected fields from MindStudio
        if (docAnalysis.document_name || docAnalysis.summary || docAnalysis.relevance_reasoning) {
          console.log(`📄 Processing MindStudio analysis for: ${docAnalysis.document_name || document.filename}`);
          
          // Use relevance_reasoning as fallback for summary if summary is not provided
          const summaryText = docAnalysis.summary 
            || docAnalysis.relevance_reasoning 
            || 'Geen samenvatting beschikbaar';
          
          analysis = {
            document_name: docAnalysis.document_name || document.filename,
            document_type: docAnalysis.document_type || 'unknown',
            is_readable: docAnalysis.is_readable ?? true,
            belongs_to_case: docAnalysis.belongs_to_case ?? true,
            summary: summaryText,
            tags: Array.isArray(docAnalysis.tags) ? docAnalysis.tags : [],
            note: docAnalysis.note || null,
            submitted_by: docAnalysis.submitted_by || 'onbekend',
            evidential_value: docAnalysis.evidential_value || null,
            reasoning: docAnalysis.reasoning || docAnalysis.relevance_reasoning || null
          };
          
          console.log(`✅ Extracted analysis:`, JSON.stringify(analysis, null, 2));
        }
      }
      
      // Save analysis to database
      if (analysis) {
        await storage.updateDocument(documentId, {
          analysisStatus: 'completed',
          documentAnalysis: analysis
        });
        console.log(`✅ Document analysis saved for ${document.filename}`);
      } else {
        await storage.updateDocument(documentId, { 
          analysisStatus: 'completed',
          documentAnalysis: {
            document_name: document.filename,
            document_type: 'unknown',
            is_readable: !!document.extractedText,
            belongs_to_case: true,
            summary: 'Document geüpload',
            tags: [],
            note: null
          }
        });
      }
    } catch (error) {
      console.error(`❌ Error analyzing document ${documentId}:`, error);
      try {
        await storage.updateDocument(documentId, { 
          analysisStatus: 'failed',
          documentAnalysis: {
            document_name: 'Unknown',
            document_type: 'unknown',
            is_readable: false,
            belongs_to_case: true,
            summary: 'Analyse mislukt wegens technische fout',
            tags: [],
            note: 'Internal error'
          }
        });
      } catch (updateError) {
        console.error('Failed to update document with error status:', updateError);
      }
    }
  }

  // Document upload routes - Single file upload only
  app.post('/api/cases/:id/uploads', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const file = req.file as Express.Multer.File;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Store file in object storage (required for production deployments)
      // Local storage is used as backup in dev only
      let storageKey: string;
      let publicUrl = '';
      
      try {
        // Primary: Store in object storage for production compatibility
        const objectStorage = await fileService.storeFileToObjectStorage(caseId, file);
        storageKey = objectStorage.storageKey;
        publicUrl = objectStorage.publicUrl;
        console.log('✅ Stored in object storage:', storageKey);
      } catch (error) {
        console.error('❌ Object storage failed, falling back to local storage (dev only):', error);
        // Fallback to local storage (only works in dev environment)
        storageKey = await fileService.storeFile(caseId, file);
        console.warn('⚠️ Using local storage - this will NOT work in production!');
      }
      
      // Extract text content
      const extractedText = await fileService.extractText(file);
      
      // Save document record
      const document = await storage.createDocument({
        caseId,
        filename: file.originalname,
        storageKey,
        mimetype: file.mimetype,
        sizeBytes: file.size,
        extractedText,
        uploadedByUserId: userId,
        publicUrl: publicUrl || undefined, // Store public URL if available
      });
      
      // Trigger automatic document analysis (async, don't wait)
      analyzeDocumentWithMindStudio(document.id, caseId).catch(err => {
        console.error(`Failed to analyze document ${document.id}:`, err);
      });
      
      // Update case status if this is first upload
      if (caseData.status === "NEW_INTAKE") {
        await caseService.updateCaseStatus(
          caseId, 
          "DOCS_UPLOADED",
          "Analyse",
          "Start analyse"
        );
      } else {
        // Always update case timestamp to trigger analysis button state change
        await caseService.touchCase(caseId);
      }
      
      // Set needsReanalysis flag when new documents are uploaded
      await caseService.updateCase(caseId, { needsReanalysis: true });
      console.log(`🔔 Set needsReanalysis flag - 1 document uploaded`);
      
      // Create event
      await storage.createEvent({
        caseId,
        actorUserId: userId,
        type: "documents_uploaded",
        payloadJson: { count: 1, filenames: [document.filename] },
      });
      
      res.status(201).json([document]);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.get('/api/cases/:id/uploads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await caseService.getCaseById(req.params.id);
      
      // Check if user has access to this case (owner or counterparty)
      if (!caseData || !canAccessCase(userId, caseData)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Owner sees all documents, counterparty only sees their own
      const documents = caseData.ownerUserId === ensureUuid(userId)
        ? await storage.getDocumentsByCase(req.params.id)
        : await storage.getDocumentsByCaseForUser(req.params.id, userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Document delete endpoint
  app.delete('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = req.params.id;
      
      // Get document to verify ownership
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Verify user owns the case
      const caseData = await caseService.getCaseById(document.caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Delete physical file from storage
      try {
        await fileService.deleteFile(document.storageKey);
      } catch (error) {
        console.warn('Failed to delete physical file:', error);
        // Continue with database deletion even if file deletion fails
      }
      
      // Delete document record from database
      await storage.deleteDocument(documentId);
      
      // Update case timestamp to trigger analysis button state change
      await caseService.touchCase(document.caseId);
      
      // Create event
      await storage.createEvent({
        caseId: document.caseId,
        actorUserId: userId,
        type: "document_deleted",
        payloadJson: { filename: document.filename },
      });
      
      res.status(204).send(); // No content
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // === SUPABASE STORAGE DOCUMENT ENDPOINTS ===
  
  // Upload document to Supabase Storage
  app.post('/api/cases/:caseId/documents', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userUuid = ensureUuid(userId);
      const caseId = req.params.caseId;
      const file = req.file as Express.Multer.File;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Verify case exists and belongs to user
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      if (caseData.ownerUserId !== userUuid) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Upload to Supabase Storage
      const { storagePath } = await supabaseStorageService.uploadFile(userUuid, caseId, file);
      
      // Insert record into Supabase case_documents table
      const { data: document, error } = await supabase
        .from('case_documents')
        .insert({
          case_id: caseId,
          user_id: userUuid,
          file_name: file.originalname,
          storage_path: storagePath,
          mime_type: file.mimetype || null,
          size_bytes: file.size || null,
        })
        .select()
        .single();
      
      if (error) {
        console.error("Supabase insert error:", error);
        throw new Error(`Failed to create document record: ${error.message}`);
      }
      
      // Call MindStudio for document analysis
      let analysis: MindStudioAnalysis | null = null;
      let analysisError: string | null = null;
      
      try {
        // Check if MindStudio is configured
        if (process.env.MINDSTUDIO_API_KEY && process.env.MS_AGENT_APP_ID) {
          console.log(`🔍 Starting MindStudio analysis for Supabase document ${document.id}`);
          
          // Generate signed URL for MindStudio access
          const { url: downloadUrl } = await supabaseStorageService.getSignedUrl(storagePath, 3600);
          
          // Prepare input for MindStudio
          const inputJsonData: any = {
            file_url: downloadUrl,
            file_name: file.originalname
          };
          
          // Add case details for context
          const parties: Array<{ name: string; role: string }> = [];
          if (caseData.claimantName) {
            parties.push({ name: caseData.claimantName, role: 'EISER' });
          }
          if (caseData.counterpartyName) {
            parties.push({ name: caseData.counterpartyName, role: 'GEDAAGDE' });
          }
          
          inputJsonData.case_details = {
            title: caseData.title || 'Onbekende zaak',
            description: caseData.description || '',
            parties: parties,
            claim_amount: caseData.claimAmount || null
          };
          
          console.log('📤 Calling MindStudio Dossier_check.flow for Supabase document');
          
          const requestBody = {
            appId: process.env.MS_AGENT_APP_ID,
            workflow: 'Dossier_check.flow',
            variables: {
              input_json: JSON.stringify(inputJsonData)
            },
            includeBillingCost: true
          };
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000);
          
          const response = await fetch('https://v1.mindstudio-api.com/developer/v2/agents/run', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const result = await response.json();
            console.log('✅ MindStudio analysis result received');
            
            // Extract analysis from result
            if (result.result && result.result.result) {
              const docAnalysis = result.result.result;
              
              if (docAnalysis.document_name || docAnalysis.summary) {
                const summaryText = docAnalysis.summary 
                  || docAnalysis.relevance_reasoning 
                  || 'Geen samenvatting beschikbaar';
                
                analysis = {
                  document_name: docAnalysis.document_name || file.originalname,
                  document_type: docAnalysis.document_type || 'unknown',
                  is_readable: docAnalysis.is_readable ?? true,
                  belongs_to_case: docAnalysis.belongs_to_case ?? true,
                  summary: summaryText,
                  tags: Array.isArray(docAnalysis.tags) ? docAnalysis.tags : [],
                  note: docAnalysis.note || null,
                };
                
                console.log(`✅ Extracted MindStudio analysis for ${file.originalname}`);
              }
            }
          } else {
            const errorText = await response.text();
            console.error("❌ MindStudio API error:", errorText);
            analysisError = "MindStudio analysis failed";
          }
        } else {
          console.warn('⚠️ MindStudio not configured, skipping document analysis');
          analysisError = "MindStudio not configured";
        }
      } catch (mindStudioError: any) {
        console.error("❌ Error calling MindStudio:", mindStudioError);
        analysisError = mindStudioError.message || "MindStudio analysis error";
      }
      
      // Persist analysis to document_analyses table if we have one
      let persistedAnalysis = null;
      if (analysis) {
        try {
          persistedAnalysis = await documentAnalysisService.insertAnalysis(
            document.id,
            userUuid,
            analysis
          );
          
          if (persistedAnalysis) {
            console.log(`✅ Analysis persisted to document_analyses for document ${document.id}`);
          } else {
            console.error(`❌ Failed to persist analysis for document ${document.id}`);
          }
        } catch (persistError: any) {
          console.error("❌ Error persisting analysis to Supabase:", persistError);
        }
      }
      
      res.status(201).json({
        success: true,
        document: {
          id: document.id,
          file_name: document.file_name,
          storage_path: document.storage_path,
          mime_type: document.mime_type,
          size_bytes: document.size_bytes,
          created_at: document.created_at,
        },
        analysis: persistedAnalysis ? {
          document_name: persistedAnalysis.document_name,
          document_type: persistedAnalysis.document_type,
          is_readable: persistedAnalysis.is_readable,
          belongs_to_case: persistedAnalysis.belongs_to_case,
          summary: persistedAnalysis.summary,
          tags: persistedAnalysis.tags,
          note: persistedAnalysis.note,
          created_at: persistedAnalysis.created_at,
        } : null,
        analysis_error: analysisError,
      });
    } catch (error: any) {
      console.error("Error uploading document to Supabase:", error);
      res.status(500).json({ message: error.message || "Failed to upload document" });
    }
  });

  // List documents from Supabase
  app.get('/api/cases/:caseId/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userUuid = ensureUuid(userId);
      const caseId = req.params.caseId;
      
      // Verify case exists and user has access
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      if (caseData.ownerUserId !== userUuid && caseData.counterpartyUserId !== userUuid) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Query documents from Supabase
      const { data: documents, error } = await supabase
        .from('case_documents')
        .select('id, file_name, created_at, mime_type, size_bytes')
        .eq('case_id', caseId)
        .eq('user_id', userUuid)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Supabase query error:", error);
        throw new Error(`Failed to fetch documents: ${error.message}`);
      }
      
      if (!documents || documents.length === 0) {
        return res.json([]);
      }
      
      // Fetch analyses for all documents in a single query
      const documentIds = documents.map(doc => doc.id);
      const analysesMap = await documentAnalysisService.getAnalysesByDocumentIds(documentIds, userUuid);
      
      // Combine documents with their analyses
      const documentsWithAnalysis = documents.map(doc => {
        const analysis = analysesMap.get(doc.id);
        return {
          ...doc,
          analysis: analysis ? {
            document_name: analysis.document_name,
            document_type: analysis.document_type,
            is_readable: analysis.is_readable,
            belongs_to_case: analysis.belongs_to_case,
            summary: analysis.summary,
            tags: analysis.tags,
            note: analysis.note,
            created_at: analysis.created_at,
          } : null,
        };
      });
      
      res.json(documentsWithAnalysis);
    } catch (error: any) {
      console.error("Error fetching documents from Supabase:", error);
      res.status(500).json({ message: error.message || "Failed to fetch documents" });
    }
  });

  // Get signed URL for document download
  app.get('/api/documents/:documentId/url', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userUuid = ensureUuid(userId);
      const documentId = req.params.documentId;
      
      // Fetch document from Supabase with case_id for authorization
      const { data: document, error } = await supabase
        .from('case_documents')
        .select('storage_path, user_id, case_id')
        .eq('id', documentId)
        .single();
      
      if (error || !document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Verify user can access the case (owner or counterparty)
      const caseData = await caseService.getCaseById(document.case_id);
      if (!caseData || !canAccessCase(userId, caseData)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get signed URL
      const { url, expiresIn } = await supabaseStorageService.getSignedUrl(document.storage_path, 300);
      
      res.json({ url, expires_in: expiresIn });
    } catch (error: any) {
      console.error("Error generating signed URL:", error);
      res.status(500).json({ message: error.message || "Failed to generate download URL" });
    }
  });

  // Delete document from Supabase Storage
  app.delete('/api/documents/:documentId/supabase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userUuid = ensureUuid(userId);
      const documentId = req.params.documentId;
      
      // Fetch document from Supabase with case_id for authorization
      const { data: document, error: fetchError } = await supabase
        .from('case_documents')
        .select('storage_path, user_id, case_id')
        .eq('id', documentId)
        .single();
      
      if (fetchError || !document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Verify user can access the case (owner or counterparty)
      const caseData = await caseService.getCaseById(document.case_id);
      if (!caseData || !canAccessCase(userId, caseData)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Only owner can delete (not counterparty)
      if (caseData.ownerUserId !== userUuid) {
        return res.status(403).json({ message: "Only case owner can delete documents" });
      }
      
      // Delete from storage
      await supabaseStorageService.deleteFile(document.storage_path);
      
      // Delete database record
      const { error: deleteError } = await supabase
        .from('case_documents')
        .delete()
        .eq('id', documentId);
      
      if (deleteError) {
        console.error("Supabase delete error:", deleteError);
        throw new Error(`Failed to delete document record: ${deleteError.message}`);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting document from Supabase:", error);
      res.status(500).json({ message: error.message || "Failed to delete document" });
    }
  });

  // Re-extract text from existing documents (fix for .txt files)
  app.post('/api/cases/:id/re-extract', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get all documents for this case
      const documents = await storage.getDocumentsByCase(caseId);
      
      let reExtractedCount = 0;
      const results = [];
      
      for (const doc of documents) {
        // Only re-extract if current text indicates extraction failed
        if (doc.extractedText && doc.extractedText.includes('Tekstextractie niet ondersteund')) {
          try {
            // Get file from storage
            const fileStream = await fileService.getFile(doc.storageKey);
            if (!fileStream) {
              console.warn(`File not found for document ${doc.id}`);
              continue;
            }
            
            // Convert stream to buffer
            const chunks: any[] = [];
            for await (const chunk of fileStream) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            
            // Re-extract text with updated logic
            const mockFile: Express.Multer.File = {
              buffer,
              originalname: doc.filename,
              mimetype: doc.mimetype || 'application/octet-stream',
              fieldname: 'file',
              encoding: '7bit',
              size: buffer.length,
              stream: fileStream,
              destination: '',
              filename: doc.filename,
              path: ''
            };
            
            const newExtractedText = await fileService.extractText(mockFile);
            
            // Update document with new extracted text
            await storage.updateDocument(doc.id, { extractedText: newExtractedText });
            
            reExtractedCount++;
            results.push({
              id: doc.id,
              filename: doc.filename,
              oldLength: doc.extractedText.length,
              newLength: newExtractedText.length,
              success: true
            });
            
          } catch (error) {
            console.error(`Failed to re-extract ${doc.filename}:`, error);
            results.push({
              id: doc.id,
              filename: doc.filename,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
      
      res.json({ 
        reExtractedCount, 
        totalDocuments: documents.length,
        results 
      });
      
    } catch (error) {
      console.error("Error re-extracting documents:", error);
      res.status(500).json({ message: "Failed to re-extract documents" });
    }
  });

  // Receipt upload rate limiting (sliding window tracking)
  const receiptRateLimit = new Map<string, { count: number; windowStart: number }>();

  // NEW: Receipt upload and AI extraction endpoint
  app.post('/api/warranty/extract-receipt', isAuthenticated, upload.single('receipt'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file as Express.Multer.File;
      
      if (!file) {
        return res.status(400).json({ message: "Geen bestand geüpload" });
      }

      // Rate limiting: max 5 attempts per user per 10 minutes (sliding window)
      const rateLimitKey = `receipt:${userId}`;
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;
      const currentWindow = receiptRateLimit.get(rateLimitKey) || { count: 0, windowStart: now };
      
      // Reset window if 10 minutes have passed
      if (now - currentWindow.windowStart >= tenMinutes) {
        currentWindow.count = 0;
        currentWindow.windowStart = now;
      }
      
      // Check if limit exceeded
      if (currentWindow.count >= 5) {
        return res.status(429).json({ 
          message: "Te veel extracties. Maximaal 5 pogingen per 10 minuten." 
        });
      }
      
      // Increment attempt counter immediately (before processing)
      currentWindow.count++;
      receiptRateLimit.set(rateLimitKey, currentWindow);

      // Validate file size (10MB max for security)
      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ 
          message: "Bestand te groot. Maximaal 10MB toegestaan." 
        });
      }
      
      // Validate file type (images and PDF)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ 
          message: "Alleen afbeeldingen en PDF bestanden zijn toegestaan voor bonnen (JPG, PNG, GIF, WEBP, PDF)" 
        });
      }

      console.log(`🧾 Processing receipt: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);

      let extractionResult;
      
      if (file.mimetype === 'application/pdf') {
        // Handle PDF files - extract text first
        console.log("📄 Processing PDF receipt");
        const extractedText = await fileService.extractText(file);
        
        if (!extractedText || extractedText.trim().length < 20) {
          return res.status(422).json({ 
            message: "Kon geen tekst uit de PDF extraheren. Probeer een afbeelding van de bon of controleer of de PDF tekst bevat."
          });
        }
        
        // Extract purchase data from PDF text using AI
        extractionResult = await aiService.extractReceiptDataFromText(extractedText);
      } else {
        // Handle image files directly with correct mimetype
        console.log("🖼️ Processing image receipt");
        const base64Image = file.buffer.toString('base64');
        const dataUrl = `data:${file.mimetype};base64,${base64Image}`;
        
        // Extract purchase data using AI Vision
        extractionResult = await aiService.extractReceiptData(dataUrl, file.mimetype);
      }
      
      // Enforce confidence gating (minimum 60% confidence required)
      const minConfidence = 0.6;
      if (!extractionResult.success || (extractionResult.confidence || 0) < minConfidence) {
        const confidenceMsg = extractionResult.confidence !== undefined ? 
          ` (betrouwbaarheid: ${Math.round(extractionResult.confidence * 100)}%, minimaal ${Math.round(minConfidence * 100)}% vereist)` : '';
        return res.status(422).json({ 
          message: `Kon geen betrouwbare gegevens uit de bon extraheren${confidenceMsg}. Probeer een duidelijkere foto of vul handmatig in.`
        });
      }
      
      // Store the original receipt file for reference (optional)
      let receiptStorageKey;
      try {
        receiptStorageKey = await fileService.storeFile('warranty-receipts', file);
      } catch (error) {
        console.warn('Failed to store receipt file:', error);
        // Continue without storing file
      }

      // Rate limit already updated above (on every attempt)
      
      // Return extracted data (without rawText for security)
      res.json({
        success: true,
        extractedData: {
          productName: extractionResult.productName,
          brand: extractionResult.brand,
          model: extractionResult.model,
          purchaseDate: extractionResult.purchaseDate,
          purchasePrice: extractionResult.purchasePrice,
          supplier: extractionResult.supplier,
          category: extractionResult.category,
          warrantyDuration: extractionResult.warrantyDuration,
          description: extractionResult.description,
          confidence: extractionResult.confidence
        },
        filename: file.originalname,
        storageKey: receiptStorageKey,
        message: `Gegevens succesvol geëxtraheerd uit ${file.originalname} (betrouwbaarheid: ${Math.round((extractionResult.confidence || 0) * 100)}%)`
      });
      
    } catch (error) {
      console.error("Error processing receipt:", error);
      
      // Map OpenAI errors to appropriate HTTP status codes
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'insufficient_quota' || error.code === 'rate_limit_exceeded') {
          return res.status(422).json({ 
            message: "OpenAI API quota bereikt. Probeer het later opnieuw of vul de gegevens handmatig in."
          });
        }
        if (error.code === 'invalid_request_error') {
          return res.status(422).json({ 
            message: "Kon de afbeelding niet verwerken. Probeer een andere foto of vul handmatig in."
          });
        }
      }
      
      // Check error message for quota/rate limit indicators
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('quota') || errorMessage.includes('insufficient_quota') || errorMessage.includes('rate limit')) {
        return res.status(422).json({ 
          message: "OpenAI API quota bereikt. Probeer het later opnieuw of vul de gegevens handmatig in."
        });
      }
      
      res.status(500).json({ 
        message: "Er is een fout opgetreden bij het verwerken van de bon. Probeer het opnieuw."
      });
    }
  });

  // Rate limiting for analyses (simple in-memory tracking)
  const analysisRateLimit = new Map<string, number>();

  // Helper function to get missing info responses from events
  async function getMissingInfoSupplementalContext(caseId: string) {
    const events = await storage.getEventsByType(caseId, 'missing_info_provided');
    const supplemental: any = {
      providedAnswers: [],
      providedDocuments: []
    };
    
    for (const event of events) {
      const payload = event.payloadJson as any;
      const responses = payload?.responses || [];
      for (const response of responses) {
        if (response.kind === 'document' && response.documentId) {
          const doc = await storage.getDocument(response.documentId);
          if (doc && doc.extractedText) {
            supplemental.providedDocuments.push({
              requirementId: response.requirementId,
              filename: doc.filename,
              text: doc.extractedText
            });
          }
        } else if (response.value) {
          supplemental.providedAnswers.push({
            requirementId: response.requirementId,
            kind: response.kind,
            value: response.value
          });
        }
      }
    }
    
    return supplemental;
  }

  // Kanton check route - first step to determine if case is suitable
  app.post('/api/cases/:id/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Rate limiting: 1 analysis per case per 2 minutes
      const rateLimitKey = `${caseId}:analyze`;
      const lastAnalysis = analysisRateLimit.get(rateLimitKey) || 0;
      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;
      
      if (now - lastAnalysis < twoMinutes) {
        return res.status(429).json({ 
          message: "Te snel opnieuw geanalyseerd. Wacht 2 minuten tussen analyses." 
        });
      }
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Kanton check with Mindstudio
      if (process.env.MINDSTUDIO_API_KEY && process.env.MINDSTUDIO_WORKER_ID) {
        try {
          // Get user info for analysis
          const user = await storage.getUser(userId);
          const userName = user?.firstName || user?.email?.split('@')[0] || 'Gebruiker';
          
          // Get documents for analysis
          const documents = await storage.getDocumentsByCase(caseId);
          
          console.log('📄 Found documents for kanton check:');
          documents.forEach(doc => {
            console.log(`  - ${doc.filename} (extractedText: ${doc.extractedText ? '✅ Available' : '❌ None'})`);
          });
          
          // Get missing info responses if any
          const supplemental = await getMissingInfoSupplementalContext(caseId);
          
          // Build comprehensive case details including document content
          let caseDetails = `Zaak: ${caseData.title}\n\nOmschrijving: ${caseData.description || 'Geen beschrijving'}\n\nTegenpartij: ${caseData.counterpartyName || 'Onbekend'}\n\nClaim bedrag: €${caseData.claimAmount || '0'}`;
          
          // Add supplemental answers if provided
          if (supplemental.providedAnswers.length > 0) {
            caseDetails += '\n\n=== AANVULLENDE INFORMATIE VAN GEBRUIKER ===\n';
            supplemental.providedAnswers.forEach((answer: any) => {
              caseDetails += `\n${answer.requirementId}: ${answer.value}\n`;
            });
          }
          
          // Add document content directly to case details
          if (documents.length > 0) {
            caseDetails += '\n\n=== GEÜPLOADE DOCUMENTEN ===\n';
            documents.forEach(doc => {
              caseDetails += `\n📄 Document: ${doc.filename}\n`;
              if (doc.extractedText && doc.extractedText.trim()) {
                caseDetails += `Inhoud:\n${doc.extractedText}\n\n`;
              } else {
                caseDetails += `[Geen tekst geëxtraheerd uit dit document]\n\n`;
              }
            });
            console.log('✅ Including document content directly in kanton check');
          }
          
          // Add supplemental documents if provided
          if (supplemental.providedDocuments.length > 0) {
            caseDetails += '\n\n=== AANVULLENDE DOCUMENTEN ===\n';
            supplemental.providedDocuments.forEach((doc: any) => {
              caseDetails += `\n📄 ${doc.filename} (${doc.requirementId}):\n${doc.text}\n\n`;
            });
          }
          
          // Run Kanton check with new method
          const kantonParams = {
            input_name: userName,
            input_case_details: caseDetails
          };
          
          console.log('🚀 Starting Kanton check analysis:', kantonParams);
          
          const kantonResult = await aiService.runKantonCheck(kantonParams);
          
          console.log('🔍 Kanton check result:', kantonResult);
          
          // Save simplified analysis to database with properly structured rawText
          const analysis = await storage.createAnalysis({
            caseId,
            model: 'mindstudio-kanton-check',
            rawText: JSON.stringify({
              ok: kantonResult.ok,
              phase: kantonResult.phase,
              decision: kantonResult.decision,
              summary: kantonResult.summary,
              parties: kantonResult.parties,
              basis: kantonResult.basis,
              rationale: kantonResult.rationale,
              questions: kantonResult.questions,
              billingCost: kantonResult.billingCost
            }, null, 2),
            factsJson: [{ label: 'Samenvatting', detail: kantonResult.summary || 'Geen samenvatting' }],
            issuesJson: kantonResult.ok ? 
              [{ issue: 'Zaak geschikt voor kantongerecht', risk: 'Geen' }] : 
              [{ issue: kantonResult.reason === 'not_kantonzaak' ? 'Niet geschikt voor kantongerecht' : 'Onvoldoende informatie', risk: kantonResult.rationale || 'Zie details' }],
            legalBasisJson: kantonResult.basis ? [{ law: kantonResult.basis }] : [],
            missingDocsJson: kantonResult.questions ? kantonResult.questions.map((q: any) => q.label || q) : [],
            riskNotesJson: []
          });
          
          // Update case status based on kanton check result
          if (kantonResult.ok) {
            await caseService.updateCase(caseId, { 
              status: "ANALYZED" as CaseStatus,
              nextActionLabel: "Start volledige analyse",
            });
          } else {
            await caseService.updateCase(caseId, { 
              status: "DOCS_UPLOADED" as CaseStatus,
              nextActionLabel: kantonResult.reason === 'insufficient_info' ? "Meer informatie toevoegen" : "Zaak niet geschikt",
            });
          }
          
          // Update rate limit
          analysisRateLimit.set(rateLimitKey, now);
          
          return res.json({ 
            analysis,
            kantonCheck: kantonResult,
            status: 'completed'
          });
        } catch (error) {
          console.error("Kanton check failed:", error);
          return res.status(503).json({ 
            message: "Sorry, de kantonzaak controle lukt niet. Mindstudio AI is niet beschikbaar." 
          });
        }
      }
      
      // No Mindstudio available - return error
      return res.status(503).json({ 
        message: "Sorry, de kantonzaak controle lukt niet. Mindstudio AI is niet beschikbaar." 
      });
    } catch (error) {
      console.error("Error analyzing case:", error);
      res.status(500).json({ message: "Analyse mislukt. Probeer het opnieuw." });
    }
  });

  // Full Analysis route - NOW USES RKOS FLOW (this is the ONLY analysis flow)
  app.post('/api/cases/:id/full-analyze', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Rate limiting: 1 full analysis per case per 30 seconds
      const rateLimitKey = `${caseId}:full-analyze`;
      const lastAnalysis = analysisRateLimit.get(rateLimitKey) || 0;
      const now = Date.now();
      const thirtySeconds = 30 * 1000;
      
      if (now - lastAnalysis < thirtySeconds) {
        const waitTime = Math.ceil((thirtySeconds - (now - lastAnalysis)) / 1000);
        return res.status(429).json({ 
          message: `Te snel opnieuw geanalyseerd. Wacht nog ${waitTime} seconden.` 
        });
      }
      
      // Get case data and verify ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Verify MindStudio is available
      if (!process.env.MINDSTUDIO_API_KEY || !process.env.MS_AGENT_APP_ID) {
        return res.status(503).json({ 
          message: "Sorry, de volledige analyse lukt niet. Mindstudio AI is niet beschikbaar." 
        });
      }

      try {
        console.log(`📊 Running RKOS analysis (full-analyze endpoint) for case ${caseId}`);
        
        // Fetch documents from Supabase case_documents table (where they are actually stored)
        const { data: supabaseDocuments, error: docsError } = await supabase
          .from('case_documents')
          .select('id, file_name, storage_path, mime_type, size_bytes, created_at')
          .eq('case_id', caseId)
          .order('created_at', { ascending: false });
        
        if (docsError) {
          console.warn('⚠️ Failed to fetch Supabase documents:', docsError);
        }
        
        const documents = supabaseDocuments || [];
        console.log(`📄 Found ${documents.length} documents from Supabase`);
        
        // Fetch document analyses for all documents
        let documentAnalyses: any[] = [];
        if (documents.length > 0) {
          const documentIds = documents.map((d: any) => d.id);
          const { data: analysesData, error: analysesError } = await supabase
            .from('document_analyses')
            .select('*')
            .in('document_id', documentIds);
          
          if (analysesError) {
            console.warn('⚠️ Failed to fetch document analyses:', analysesError);
          } else {
            documentAnalyses = analysesData || [];
          }
        }
        console.log(`📄 Found ${documentAnalyses.length} document analyses`);
        
        // Fetch latest analysis record (for context)
        const analysisRecords = await db
          .select()
          .from(analyses)
          .where(eq(analyses.caseId, caseId))
          .orderBy(desc(analyses.createdAt))
          .limit(1);
        const latestAnalysis = analysisRecords[0] || null;
        
        // Fetch previous RKOS analysis from Supabase (for context)
        let previousRkos = null;
        try {
          previousRkos = await rkosAnalysisService.getLatestCompletedAnalysis(caseId);
        } catch (e) {
          console.log('No previous RKOS analysis found');
        }

        // Extract parsed analysis from latest analysis record
        const parsedAnalysis = latestAnalysis?.analysisJson as any || null;
        
        // Build comprehensive context for RKOS.flow (matching expected structure)
        const contextPayload = {
          case_id: caseId,
          
          // Complete case data
          case_data: {
            title: caseData.title || 'Zonder titel',
            description: caseData.description || '',
            claim_amount: Number(caseData.claimAmount) || 0,
            status: caseData.status,
            user_role: caseData.userRole || 'EISER',
            claimant_name: caseData.claimantName || '',
            claimant_address: caseData.claimantAddress || '',
            claimant_city: caseData.claimantCity || '',
            counterparty_name: caseData.counterpartyName || '',
            counterparty_type: caseData.counterpartyType || '',
            counterparty_address: caseData.counterpartyAddress || '',
            counterparty_city: caseData.counterpartyCity || '',
            category: caseData.category || '',
          },
          
          // Full analysis sections (from previous analysis if available)
          summary: parsedAnalysis?.summary || caseData.description || '',
          parties: parsedAnalysis?.case_overview?.parties || [],
          facts: parsedAnalysis?.facts || { known: [], disputed: [], unclear: [] },
          legal_analysis: parsedAnalysis?.legal_analysis || {},
          risk_assessment: parsedAnalysis?.risk_assessment || { strengths: [], weaknesses: [], risks: [] },
          recommendations: parsedAnalysis?.recommended_claims || [],
          applicable_rules: parsedAnalysis?.applicable_rules || [],
          
          // Dossier (documents from Supabase with analyses)
          dossier: {
            document_count: documents.length,
            documents: documents.map((doc: any) => {
              // Find matching analysis for this document
              const docAnalysis = documentAnalyses.find((a: any) => a.document_id === doc.id);
              return {
                id: doc.id,
                filename: doc.file_name,
                type: doc.mime_type || 'application/octet-stream',
                size_bytes: doc.size_bytes || 0,
                storage_path: doc.storage_path,
                analysis: docAnalysis ? {
                  document_type: docAnalysis.document_type || 'unknown',
                  summary: docAnalysis.summary || '',
                  tags: docAnalysis.tags || [],
                  is_readable: docAnalysis.is_readable ?? true,
                  belongs_to_case: docAnalysis.belongs_to_case ?? true,
                  note: docAnalysis.note || null,
                } : null,
                has_analysis: !!docAnalysis,
              };
            }),
            extracted_texts: latestAnalysis?.extractedTexts || [],
            all_files: latestAnalysis?.allFiles || [],
          },
          
          // Legal advice (if available)
          legal_advice: latestAnalysis?.legalAdviceJson || null,
          
          // Missing information (if available)
          missing_information: latestAnalysis?.missingInformation || [],
          
          // Jurisprudence references (if available)
          jurisprudence_references: latestAnalysis?.jurisprudenceReferences || [],
          
          // Previous RKOS context (if available)
          previous_rkos: previousRkos ? {
            chance_of_success: previousRkos.chance_of_success,
            confidence_level: previousRkos.confidence_level,
            assessment: previousRkos.assessment,
            strengths: previousRkos.strengths || [],
            weaknesses: previousRkos.weaknesses || [],
            missing_elements: previousRkos.missing_elements || [],
          } : null,
        };

        console.log('📤 Sending to RKOS.flow with comprehensive context:', {
          case_id: contextPayload.case_id,
          document_count: contextPayload.dossier.document_count,
          docs_with_analysis: documentAnalyses.length,
          has_summary: !!contextPayload.summary,
          has_legal_advice: !!contextPayload.legal_advice,
          has_previous_rkos: !!previousRkos,
        });

        // Call MindStudio RKOS.flow FIRST (before any Supabase operations)
        const flowResult = await aiService.runRKOS(contextPayload);

        if (flowResult.error) {
          console.error('❌ RKOS failed:', flowResult.error);
          return res.status(500).json({ 
            message: "RKOS analyse mislukt. Probeer het opnieuw.",
            error: flowResult.error
          });
        }

        console.log('✅ RKOS.flow response received');

        // Parse RKOS result
        let rkosResult = null;
        
        if (flowResult.result?.rkos) {
          rkosResult = flowResult.result.rkos;
        } else if (flowResult.thread?.posts) {
          for (const post of flowResult.thread.posts) {
            if (post.debugLog?.newState?.variables?.rkos?.value) {
              const value = post.debugLog.newState.variables.rkos.value;
              rkosResult = typeof value === 'string' ? JSON.parse(value) : value;
              break;
            }
          }
        } else if (flowResult.thread?.variables?.rkos) {
          const value = flowResult.thread.variables.rkos.value || flowResult.thread.variables.rkos;
          rkosResult = typeof value === 'string' ? JSON.parse(value) : value;
        }

        if (!rkosResult) {
          console.error('❌ No RKOS result');
          return res.status(500).json({ 
            message: "RKOS analyse heeft geen resultaat opgeleverd." 
          });
        }

        console.log('📊 RKOS result:', {
          chance_of_success: rkosResult.chance_of_success,
          confidence_level: rkosResult.confidence_level
        });

        // Save completed RKOS analysis to Supabase
        let completedRkos;
        try {
          completedRkos = await rkosAnalysisService.createCompletedAnalysis(
            { case_id: caseId, user_id: ensureUuid(userId), flow_version: "RKOS.flow" },
            {
              chance_of_success: rkosResult.chance_of_success,
              confidence_level: rkosResult.confidence_level,
              summary_verdict: rkosResult.summary_verdict,
              assessment: rkosResult.assessment,
              facts: rkosResult.facts,
              strengths: rkosResult.strengths,
              weaknesses: rkosResult.weaknesses,
              risks: rkosResult.risks,
              legal_analysis: rkosResult.legal_analysis,
              recommended_claims: rkosResult.recommended_claims,
              applicable_laws: rkosResult.applicable_laws,
              missing_elements: rkosResult.missing_elements,
            },
            flowResult
          );
        } catch (saveError) {
          console.error('❌ Failed to save RKOS analysis to Supabase:', saveError);
          // Continue anyway - return the result even if Supabase save fails
          console.log('⚠️ Continuing without Supabase save');
        }

        console.log(`✅ RKOS analysis completed${completedRkos ? ` in Supabase: ${completedRkos.id}` : ''}`);

        // Update case status
        await caseService.updateCase(caseId, { 
          status: "ANALYZED" as CaseStatus,
          nextActionLabel: "Bekijk volledige analyse",
          hasUnseenMissingItems: rkosResult.missing_elements?.length > 0,
          needsReanalysis: false
        });
        
        // Update rate limit
        analysisRateLimit.set(rateLimitKey, now);
        
        return res.json({ 
          analysis: completedRkos,
          successChance: rkosResult,
          status: 'completed',
          message: 'Volledige analyse (RKOS) succesvol voltooid'
        });
        
      } catch (error) {
        console.error("RKOS analysis failed:", error);
        
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('524') || errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
          return res.status(504).json({ 
            message: "De RKOS analyse duurt te lang (timeout). Probeer het opnieuw." 
          });
        }
        
        return res.status(503).json({ 
          message: "Sorry, de RKOS analyse lukt niet. Mindstudio AI is niet beschikbaar." 
        });
      }
    } catch (error) {
      console.error("Error running RKOS analysis:", error);
      res.status(500).json({ message: "Volledige analyse mislukt. Probeer het opnieuw." });
    }
  });

  // Success Chance (RKOS - Redelijke Kans Op Succes) Assessment
  app.post('/api/cases/:id/success-chance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Get case data and verify ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Verify MindStudio is available
      if (!process.env.MINDSTUDIO_API_KEY || !process.env.MS_AGENT_APP_ID) {
        return res.status(503).json({ 
          message: "Sorry, de kans op succes beoordeling lukt niet. Mindstudio AI is niet beschikbaar." 
        });
      }

      try {
        console.log(`📊 Running success chance assessment for case ${caseId}`);
        
        // Fetch documents from Supabase case_documents table
        const { data: supabaseDocuments, error: docsError } = await supabase
          .from('case_documents')
          .select('id, file_name, storage_path, mime_type, size_bytes, created_at')
          .eq('case_id', caseId)
          .order('created_at', { ascending: false });
        
        if (docsError) {
          console.warn('⚠️ Failed to fetch Supabase documents:', docsError);
        }
        
        const documents = supabaseDocuments || [];
        console.log(`📄 Found ${documents.length} documents from Supabase for success chance`);
        
        // Fetch document analyses for all documents
        let documentAnalyses: any[] = [];
        if (documents.length > 0) {
          const documentIds = documents.map((d: any) => d.id);
          const { data: analysesData, error: analysesError } = await supabase
            .from('document_analyses')
            .select('*')
            .in('document_id', documentIds);
          
          if (analysesError) {
            console.warn('⚠️ Failed to fetch document analyses:', analysesError);
          } else {
            documentAnalyses = analysesData || [];
          }
        }
        console.log(`📄 Found ${documentAnalyses.length} document analyses`);
        
        // Fetch latest analysis record (for context)
        const analysisRecords = await db
          .select()
          .from(analyses)
          .where(eq(analyses.caseId, caseId))
          .orderBy(desc(analyses.createdAt))
          .limit(1);
        const latestAnalysis = analysisRecords[0] || null;
        
        // Fetch previous RKOS analysis from Supabase (for context)
        let previousRkos = null;
        try {
          previousRkos = await rkosAnalysisService.getLatestCompletedAnalysis(caseId);
        } catch (e) {
          console.log('No previous RKOS analysis found');
        }

        // Build comprehensive context for RKOS.flow (same as full-analyze)
        const contextPayload = {
          case_id: caseId,
          
          // Complete case data
          case_data: {
            title: caseData.title || 'Zonder titel',
            description: caseData.description || '',
            claim_amount: Number(caseData.claimAmount) || 0,
            status: caseData.status,
            user_role: caseData.userRole || 'EISER',
            claimant_name: caseData.claimantName || '',
            claimant_address: caseData.claimantAddress || '',
            claimant_city: caseData.claimantCity || '',
            counterparty_name: caseData.counterpartyName || '',
            counterparty_type: caseData.counterpartyType || '',
            counterparty_address: caseData.counterpartyAddress || '',
            counterparty_city: caseData.counterpartyCity || '',
            category: caseData.category || '',
          },
          
          // Dossier (documents from Supabase with analyses)
          dossier: {
            document_count: documents.length,
            documents: documents.map((doc: any) => {
              const docAnalysis = documentAnalyses.find((a: any) => a.document_id === doc.id);
              return {
                id: doc.id,
                filename: doc.file_name,
                type: doc.mime_type || 'application/octet-stream',
                size_bytes: doc.size_bytes || 0,
                storage_path: doc.storage_path,
                analysis: docAnalysis ? {
                  document_type: docAnalysis.document_type || 'unknown',
                  summary: docAnalysis.summary || '',
                  tags: docAnalysis.tags || [],
                  is_readable: docAnalysis.is_readable ?? true,
                  belongs_to_case: docAnalysis.belongs_to_case ?? true,
                  note: docAnalysis.note || null,
                } : null,
                has_analysis: !!docAnalysis,
              };
            })
          },
          
          // Previous analysis context (if available)
          previous_analysis: latestAnalysis ? {
            legal_advice: latestAnalysis.legalAdviceJson || null,
            missing_information: latestAnalysis.missingInformation || null,
            jurisprudence_references: latestAnalysis.jurisprudenceReferences || null,
          } : null,
          
          // Previous RKOS context (if available)
          previous_rkos: previousRkos ? {
            chance_of_success: previousRkos.chance_of_success,
            confidence_level: previousRkos.confidence_level,
            assessment: previousRkos.assessment,
            strengths: previousRkos.strengths,
            weaknesses: previousRkos.weaknesses,
            missing_elements: previousRkos.missing_elements,
          } : null,
        };

        console.log('📤 Sending context to RKOS.flow:', {
          case_id: contextPayload.case_id,
          document_count: contextPayload.dossier.document_count,
          docs_with_analysis: documentAnalyses.length,
          has_previous_analysis: !!latestAnalysis,
          has_previous_rkos: !!previousRkos,
        });

        // Create pending RKOS analysis in Supabase
        const userUuid = ensureUuid(userId);
        let pendingRkos;
        try {
          pendingRkos = await rkosAnalysisService.createPendingAnalysis({
            case_id: caseId,
            user_id: userUuid,
            flow_version: "RKOS.flow"
          });
        } catch (rkosError) {
          console.error('❌ Failed to create pending RKOS analysis:', rkosError);
          return res.status(500).json({ 
            message: "Kon RKOS analyse niet starten. Probeer het opnieuw."
          });
        }

        console.log(`✅ Created pending RKOS analysis: ${pendingRkos.id}`);

        // Call MindStudio RKOS.flow
        const flowResult = await aiService.runRKOS(contextPayload);

        if (flowResult.error) {
          console.error('❌ RKOS call failed:', flowResult.error);
          // Mark RKOS as failed in Supabase (best effort)
          try {
            await rkosAnalysisService.markFailed(pendingRkos.id, flowResult.error);
          } catch (markError) {
            console.error('Failed to mark RKOS as failed:', markError);
          }
          return res.status(500).json({ 
            message: "RKOS analyse mislukt. Probeer het opnieuw.",
            error: flowResult.error
          });
        }

        console.log('✅ RKOS.flow response received');

        // Parse the response
        let rkosResult = null;
        
        // Try result.rkos (new format)
        if (flowResult.result?.rkos) {
          rkosResult = flowResult.result.rkos;
          console.log('📊 Found rkos in result.rkos');
        }
        // Try thread posts (legacy format)
        else if (flowResult.thread?.posts) {
          console.log('🔍 Checking thread posts for rkos variable...');
          for (const post of flowResult.thread.posts) {
            if (post.debugLog?.newState?.variables?.rkos?.value) {
              const value = post.debugLog.newState.variables.rkos.value;
              rkosResult = typeof value === 'string' ? JSON.parse(value) : value;
              console.log('📊 Found rkos in thread posts');
              break;
            }
          }
        }
        // Try thread variables (alternative legacy format)
        else if (flowResult.thread?.variables?.rkos) {
          const value = flowResult.thread.variables.rkos.value || flowResult.thread.variables.rkos;
          rkosResult = typeof value === 'string' ? JSON.parse(value) : value;
          console.log('📊 Found rkos in thread variables');
        }

        if (!rkosResult) {
          console.error('❌ No RKOS result in response');
          console.log('Response structure:', {
            has_result: !!flowResult.result,
            has_thread: !!flowResult.thread,
            result_keys: flowResult.result ? Object.keys(flowResult.result) : [],
            thread_keys: flowResult.thread ? Object.keys(flowResult.thread) : []
          });
          // Mark RKOS as failed in Supabase (best effort)
          try {
            await rkosAnalysisService.markFailed(pendingRkos.id, "No RKOS result in response");
          } catch (markError) {
            console.error('Failed to mark RKOS as failed:', markError);
          }
          return res.status(500).json({ 
            message: "RKOS analyse heeft geen resultaat opgeleverd." 
          });
        }

        console.log('📊 RKOS result:', {
          chance_of_success: rkosResult.chance_of_success,
          confidence_level: rkosResult.confidence_level
        });

        // Mark RKOS as completed in Supabase with all structured fields
        let completedRkos;
        try {
          completedRkos = await rkosAnalysisService.markCompleted(pendingRkos.id, {
            chance_of_success: rkosResult.chance_of_success,
            confidence_level: rkosResult.confidence_level,
            summary_verdict: rkosResult.summary_verdict,
            assessment: rkosResult.assessment,
            facts: rkosResult.facts,
            strengths: rkosResult.strengths,
            weaknesses: rkosResult.weaknesses,
            risks: rkosResult.risks,
            legal_analysis: rkosResult.legal_analysis,
            recommended_claims: rkosResult.recommended_claims,
            applicable_laws: rkosResult.applicable_laws,
            missing_elements: rkosResult.missing_elements,
          }, flowResult);
        } catch (markError) {
          console.error('❌ Failed to save RKOS analysis to Supabase:', markError);
          return res.status(500).json({ 
            message: "RKOS analyse is voltooid maar kon niet worden opgeslagen. Probeer het opnieuw."
          });
        }

        console.log(`✅ RKOS analysis completed in Supabase: ${pendingRkos.id}`);

        // Check if there are missing elements and set flag
        const hasMissingElements = rkosResult.missing_elements && 
                                   Array.isArray(rkosResult.missing_elements) && 
                                   rkosResult.missing_elements.length > 0;
        
        if (hasMissingElements) {
          await caseService.updateCase(caseId, {
            hasUnseenMissingItems: true,
            needsReanalysis: false  // Clear reanalysis flag since we just ran RKOS
          });
          console.log(`🔔 Set hasUnseenMissingItems flag - ${rkosResult.missing_elements.length} items found`);
          console.log(`✅ Cleared needsReanalysis flag - RKOS analysis completed`);
        } else {
          // No missing elements, just clear the reanalysis flag
          await caseService.updateCase(caseId, {
            needsReanalysis: false
          });
          console.log(`✅ Cleared needsReanalysis flag - RKOS analysis completed`);
        }

        res.json({ 
          success: true,
          successChance: rkosResult,
          rkosAnalysisId: completedRkos?.id
        });

      } catch (error) {
        console.error("Success chance assessment failed:", error);
        
        // Check if it's a timeout error
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('524') || errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
          return res.status(504).json({ 
            message: "De kans op succes beoordeling duurt te lang (timeout). Probeer het opnieuw." 
          });
        }
        
        return res.status(503).json({ 
          message: "Sorry, de kans op succes beoordeling lukt niet. Mindstudio AI is niet beschikbaar." 
        });
      }
    } catch (error) {
      console.error("Error running success chance assessment:", error);
      res.status(500).json({ message: "Kans op succes beoordeling mislukt. Probeer het opnieuw." });
    }
  });

  // GET RKOS analyses for a case from Supabase
  app.get('/api/cases/:id/rkos-analyses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify case access
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      if (!canAccessCase(userId, caseData)) {
        return res.status(403).json({ message: "Unauthorized access to case" });
      }
      
      // Fetch all RKOS analyses for this case from Supabase
      const rkosAnalyses = await rkosAnalysisService.getAnalysesByCaseId(caseId);
      
      res.json({
        success: true,
        analyses: rkosAnalyses
      });
    } catch (error) {
      console.error("Error fetching RKOS analyses:", error);
      res.status(500).json({ message: "Fout bij ophalen RKOS analyses" });
    }
  });

  // GET latest completed RKOS analysis for a case
  app.get('/api/cases/:id/rkos-analysis/latest', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify case access
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      if (!canAccessCase(userId, caseData)) {
        return res.status(403).json({ message: "Unauthorized access to case" });
      }
      
      // Fetch latest completed RKOS analysis from Supabase
      const latestRkos = await rkosAnalysisService.getLatestCompletedAnalysis(caseId);
      
      if (!latestRkos) {
        return res.status(404).json({ message: "Geen RKOS analyse gevonden" });
      }
      
      res.json({
        success: true,
        analysis: latestRkos
      });
    } catch (error) {
      console.error("Error fetching latest RKOS analysis:", error);
      res.status(500).json({ message: "Fout bij ophalen RKOS analyse" });
    }
  });

  // Generate Legal Advice - using Create_advice.flow
  app.post('/api/cases/:id/generate-advice', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Get case data and verify ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Verify MindStudio is available
      if (!process.env.MINDSTUDIO_API_KEY || !process.env.MS_AGENT_APP_ID) {
        return res.status(503).json({ 
          message: "Sorry, het juridisch advies kan niet worden gegenereerd. Mindstudio AI is niet beschikbaar." 
        });
      }

      try {
        console.log(`📝 Generating legal advice for case ${caseId}`);
        
        // Try to get full analysis (required for advice generation)
        // Check for either mindstudio-full-analysis OR any analysis with succesKansAnalysis
        let fullAnalysisRecord = await storage.getAnalysisByType(caseId, 'mindstudio-full-analysis');
        let parsedAnalysis = null;
        
        if (fullAnalysisRecord) {
          const fullAnalysisData = enrichFullAnalysis(fullAnalysisRecord);
          parsedAnalysis = fullAnalysisData?.parsedAnalysis;
        }
        
        // If no full analysis record, check if there's an analysis with succesKansAnalysis
        if (!fullAnalysisRecord || !parsedAnalysis) {
          const latestAnalysis = await storage.getLatestAnalysis(caseId);
          if (latestAnalysis && latestAnalysis.succesKansAnalysis) {
            console.log('📊 Using succesKansAnalysis as basis for legal advice');
            fullAnalysisRecord = latestAnalysis;
            // Create minimal parsedAnalysis from available data
            parsedAnalysis = {
              summary: (latestAnalysis.succesKansAnalysis as any)?.summary_verdict || '',
              case_overview: {
                parties: []
              },
              facts: latestAnalysis.factsJson || {},
              legal_analysis: latestAnalysis.analysisJson || {},
              risk_assessment: {
                strengths: (latestAnalysis.succesKansAnalysis as any)?.strengths || [],
                weaknesses: (latestAnalysis.succesKansAnalysis as any)?.weaknesses || []
              },
              recommended_claims: [],
              applicable_rules: []
            };
          }
        }
        
        // NEW: Also check Supabase for RKOS analysis if local checks failed
        if (!parsedAnalysis || !fullAnalysisRecord) {
          console.log('📊 Checking Supabase for RKOS analysis...');
          const supabaseRkos = await rkosAnalysisService.getLatestCompletedAnalysis(caseId);
          if (supabaseRkos) {
            console.log('📊 Using Supabase RKOS analysis as basis for legal advice');
            // Create a synthetic fullAnalysisRecord from Supabase RKOS
            fullAnalysisRecord = {
              id: 0,
              caseId: caseId,
              type: 'supabase-rkos',
              rawText: JSON.stringify(supabaseRkos.raw_payload || {}),
              analysisJson: null,
              factsJson: null,
              missingInformation: supabaseRkos.missing_elements || [],
              succesKansAnalysis: {
                chance: supabaseRkos.chance,
                confidence: supabaseRkos.confidence,
                assessment: supabaseRkos.assessment,
                summary_verdict: supabaseRkos.summary_verdict,
                strengths: supabaseRkos.strengths || [],
                weaknesses: supabaseRkos.weaknesses || [],
                missing_elements: supabaseRkos.missing_elements || [],
                recommendation: supabaseRkos.recommendation
              },
              legalAdviceJson: null,
              createdAt: new Date(supabaseRkos.created_at)
            } as any;
            
            // Build parsedAnalysis from Supabase RKOS
            parsedAnalysis = {
              summary: supabaseRkos.summary_verdict || supabaseRkos.assessment || '',
              case_overview: {
                parties: []
              },
              facts: {},
              legal_analysis: {},
              risk_assessment: {
                strengths: supabaseRkos.strengths || [],
                weaknesses: supabaseRkos.weaknesses || []
              },
              recommended_claims: [],
              applicable_rules: []
            };
          }
        }

        if (!parsedAnalysis || !fullAnalysisRecord) {
          return res.status(400).json({ 
            message: "Er moet eerst een volledige analyse worden uitgevoerd voordat juridisch advies kan worden gegenereerd." 
          });
        }

        // Get all documents for the case (dossier)
        const documents = await storage.getDocumentsByCase(caseId);
        console.log(`📄 Found ${documents.length} documents for legal advice`);

        // Get missing information (from RKOS.flow or consolidated missing_info.flow)
        let missingInformation: any[] = [];
        if (fullAnalysisRecord.missingInformation) {
          missingInformation = fullAnalysisRecord.missingInformation as any[];
          console.log(`📋 Found ${missingInformation.length} items from consolidated missing info check`);
        } else if (fullAnalysisRecord.succesKansAnalysis) {
          // Fallback to RKOS missing_elements if consolidated check hasn't been run
          const succesKans = fullAnalysisRecord.succesKansAnalysis as any;
          if (succesKans.missing_elements && Array.isArray(succesKans.missing_elements)) {
            missingInformation = succesKans.missing_elements;
            console.log(`📋 Found ${missingInformation.length} missing_elements from RKOS.flow`);
          }
        }

        // Build context for Create_advice.flow (same format as RKOS)
        const contextPayload = {
          case_id: caseId,
          case_title: caseData.title || 'Zonder titel',
          case_description: caseData.description || '',
          claim_amount: Number(caseData.claimAmount) || 0,
          
          // Full analysis sections
          summary: parsedAnalysis?.summary || '',
          parties: parsedAnalysis?.case_overview?.parties || [],
          facts: parsedAnalysis?.facts || {},
          legal_analysis: parsedAnalysis?.legal_analysis || {},
          risk_assessment: parsedAnalysis?.risk_assessment || {},
          recommendations: parsedAnalysis?.recommended_claims || [],
          applicable_rules: parsedAnalysis?.applicable_rules || [],
          
          // Missing information (from RKOS or consolidated check)
          missing_information: missingInformation,
          
          // Dossier documents with signed URLs for MindStudio
          dossier: {
            document_count: documents.length,
            documents: await Promise.all(documents.map(async (doc: any) => {
              let url = null;
              
              // Generate signed URL if document is in object storage
              if (doc.storageKey) {
                try {
                  url = await fileService.generateSignedUrl(doc.storageKey, 48); // 48 hours validity
                } catch (error) {
                  console.warn(`⚠️ Could not generate signed URL for ${doc.filename}:`, error);
                }
              }
              
              return {
                filename: doc.filename,
                extracted_text: doc.extractedText || '',
                url: url || undefined, // MindStudio can use this URL for "Extract Text from File" block
              };
            }))
          },
          
          // User role (for context)
          user_role: parsedAnalysis?.user_context?.legal_role || 'claimant'
        };

        console.log('📤 Calling Create_advice.flow with:', {
          case_id: contextPayload.case_id,
          has_summary: !!contextPayload.summary,
          facts_count: Object.keys(contextPayload.facts).length,
          docs_count: contextPayload.dossier.document_count,
          missing_info_count: contextPayload.missing_information.length
        });

        // Call MindStudio Create_advice.flow
        const flowResult = await aiService.runCreateAdvice(contextPayload);

        if (flowResult.error) {
          console.error('❌ Create_advice call failed:', flowResult.error);
          return res.status(500).json({ 
            message: "Juridisch advies generatie mislukt. Probeer het opnieuw.",
            error: flowResult.error
          });
        }

        console.log('✅ Create_advice.flow response received');

        // Parse the response
        let legalAdviceJson = null;
        
        // Try result.legal_advice_json (new format)
        if (flowResult.result?.legal_advice_json) {
          legalAdviceJson = flowResult.result.legal_advice_json;
          console.log('📄 Found legal_advice_json in result');
        }
        // Try thread posts (legacy format)
        else if (flowResult.thread?.posts) {
          console.log('🔍 Checking thread posts for legal_advice_json variable...');
          for (const post of flowResult.thread.posts) {
            if (post.debugLog?.newState?.variables?.legal_advice_json?.value) {
              const value = post.debugLog.newState.variables.legal_advice_json.value;
              legalAdviceJson = typeof value === 'string' ? JSON.parse(value) : value;
              console.log('📄 Found legal_advice_json in thread posts');
              break;
            }
          }
        }
        // Try thread variables (alternative legacy format)
        else if (flowResult.thread?.variables?.legal_advice_json) {
          const value = flowResult.thread.variables.legal_advice_json.value || flowResult.thread.variables.legal_advice_json;
          legalAdviceJson = typeof value === 'string' ? JSON.parse(value) : value;
          console.log('📄 Found legal_advice_json in thread variables');
        }

        if (!legalAdviceJson) {
          console.error('❌ No legal_advice_json in response');
          console.log('Response structure:', {
            has_result: !!flowResult.result,
            has_thread: !!flowResult.thread,
            result_keys: flowResult.result ? Object.keys(flowResult.result) : [],
            thread_keys: flowResult.thread ? Object.keys(flowResult.thread) : []
          });
          return res.status(500).json({ 
            message: "Juridisch advies generatie heeft geen resultaat opgeleverd." 
          });
        }

        console.log('📄 Legal advice sections:', Object.keys(legalAdviceJson));

        // Save to Supabase legal_advice table (ONLY Supabase, not local PostgreSQL)
        try {
          const userUuid = ensureUuid(userId);
          await legalAdviceService.createCompletedAdvice(
            {
              case_id: caseId,
              user_id: userUuid, // Required by Supabase RLS policy
              mindstudio_run_id: flowResult.threadId || null,
              flow_version: "Create_advice.flow",
            },
            {
              het_geschil: legalAdviceJson.het_geschil || null,
              de_feiten: legalAdviceJson.de_feiten || null,
              betwiste_punten: legalAdviceJson.betwiste_punten || null,
              beschikbaar_bewijs: legalAdviceJson.beschikbaar_bewijs || null,
              juridische_duiding: legalAdviceJson.juridische_duiding || null,
              vervolgstappen: legalAdviceJson.vervolgstappen || null,
              samenvatting_advies: legalAdviceJson.samenvatting_advies || null,
              ontbrekend_bewijs: legalAdviceJson.ontbrekend_bewijs || [],
            },
            flowResult
          );
          console.log('✅ Legal advice saved to Supabase legal_advice table');
        } catch (supabaseError) {
          console.error('❌ Failed to save legal advice to Supabase:', supabaseError);
          return res.status(500).json({ 
            message: "Juridisch advies kon niet worden opgeslagen. Probeer het opnieuw." 
          });
        }

        res.json({ 
          success: true,
          legalAdvice: legalAdviceJson
        });

      } catch (error) {
        console.error("Legal advice generation failed:", error);
        
        // Check if it's a timeout error
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('524') || errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
          return res.status(504).json({ 
            message: "Het genereren van juridisch advies duurt te lang (timeout). Probeer het opnieuw." 
          });
        }
        
        return res.status(503).json({ 
          message: "Sorry, het juridisch advies kan niet worden gegenereerd. Mindstudio AI is niet beschikbaar." 
        });
      }
    } catch (error) {
      console.error("Error generating legal advice:", error);
      res.status(500).json({ message: "Juridisch advies generatie mislukt. Probeer het opnieuw." });
    }
  });

  // Missing Info Check - Consolidate missing information from existing analysis
  app.post('/api/cases/:id/missing-info-check', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Get case data and verify ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }

      console.log(`🔍 Extracting missing info from existing analysis for case ${caseId}`);
      
      // Get full analysis to extract missing_elements (from RKOS.flow)
      const fullAnalysisRecord = await storage.getAnalysisByType(caseId, 'mindstudio-full-analysis');
      
      if (!fullAnalysisRecord) {
        return res.status(400).json({ 
          message: "Er moet eerst een analyse worden uitgevoerd voordat een dossier controle kan worden gedaan." 
        });
      }

      const fullAnalysisData = enrichFullAnalysis(fullAnalysisRecord);
      const parsedAnalysis = fullAnalysisData?.parsedAnalysis;

      if (!parsedAnalysis) {
        return res.status(400).json({ 
          message: "Er moet eerst een analyse worden uitgevoerd voordat een dossier controle kan worden gedaan." 
        });
      }

      // Extract missing_elements from RKOS.flow analysis (Kans op succes section)
      const missingElements = parsedAnalysis?.missing_elements || [];
      console.log(`📋 Found ${missingElements.length} missing_elements from RKOS.flow`);

      // Extract ontbrekend_bewijs from Create_advice.flow (section 5 of legal advice)
      const legalAdvice = fullAnalysisRecord.legalAdviceJson as any;
      let ontbrekendBewijs = legalAdvice?.ontbrekend_bewijs || [];
      
      // Parse if it's a string (sometimes stored as JSON string)
      if (typeof ontbrekendBewijs === 'string') {
        try {
          ontbrekendBewijs = JSON.parse(ontbrekendBewijs);
        } catch (e) {
          console.error('❌ Failed to parse ontbrekend_bewijs string:', e);
          ontbrekendBewijs = [];
        }
      }
      
      console.log(`📋 Found ${Array.isArray(ontbrekendBewijs) ? ontbrekendBewijs.length : 0} ontbrekend_bewijs items from Create_advice.flow`);

      // Combine both sources into one array
      const combinedMissingInfo: any[] = [];

      // Add missing_elements from RKOS (these are objects with {title, explanation})
      if (Array.isArray(missingElements)) {
        missingElements.forEach((element: any) => {
          if (typeof element === 'string') {
            // Simple string - convert to object
            combinedMissingInfo.push({
              item: element,
              why_needed: "Noodzakelijk voor het verstevigen van uw zaak.",
              source: "RKOS Analyse"
            });
          } else if (element.title || element.explanation) {
            // Structured object from RKOS
            combinedMissingInfo.push({
              item: element.title || "Ontbrekend element",
              why_needed: element.explanation || "Noodzakelijk voor het verstevigen van uw zaak.",
              source: "RKOS Analyse"
            });
          }
        });
      }

      // Add ontbrekend_bewijs from Legal Advice (these are objects with {item, why_needed})
      if (Array.isArray(ontbrekendBewijs)) {
        ontbrekendBewijs.forEach((bewijs: any) => {
          if (typeof bewijs === 'string') {
            // Simple string - convert to object
            combinedMissingInfo.push({
              item: bewijs,
              why_needed: "Noodzakelijk bewijs volgens juridisch advies.",
              source: "Juridisch Advies"
            });
          } else if (bewijs.item || bewijs.why_needed) {
            // Already in correct format
            combinedMissingInfo.push({
              item: bewijs.item || "Ontbrekend bewijs",
              why_needed: bewijs.why_needed || "Noodzakelijk bewijs volgens juridisch advies.",
              source: "Juridisch Advies"
            });
          }
        });
      }

      console.log(`✅ Combined ${combinedMissingInfo.length} missing information items`);

      // Save to fullAnalysis record for persistence
      await storage.updateAnalysis(fullAnalysisRecord.id, {
        missingInformation: combinedMissingInfo
      });

      res.json({ 
        success: true,
        missingInformation: combinedMissingInfo
      });

    } catch (error) {
      console.error("Error running missing info check:", error);
      res.status(500).json({ message: "Dossier controle mislukt. Probeer het opnieuw." });
    }
  });

  // Dossier check route - check document completeness using Dossier_check.flow
  app.post('/api/cases/:id/dossier-check', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Get case data and verify ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get documents for dossier check
      const documents = await storage.getDocumentsByCase(caseId);
      
      if (documents.length === 0) {
        return res.status(400).json({ 
          message: "Geen documenten gevonden. Upload eerst documenten om het dossier te controleren." 
        });
      }
      
      console.log(`🔍 Running dossier check for case ${caseId} with ${documents.length} documents`);
      
      // Call MindStudio Dossier_check.flow
      if (process.env.MINDSTUDIO_API_KEY && process.env.MS_AGENT_APP_ID) {
        try {
          // Prepare documents with extracted text
          const documentsSummary = documents.map(doc => ({
            filename: doc.filename,
            type: doc.mimetype,
            size: doc.sizeBytes,
            text: doc.extractedText || '[Tekst kon niet worden geëxtraheerd]'
          }));
          
          // Prepare input payload for Dossier_check.flow
          const inputData = {
            case_id: caseId,
            case_title: caseData.title || 'Zonder titel',
            case_description: caseData.description || '',
            category: caseData.category || 'general',
            claim_amount: Number(caseData.claimAmount) || 0,
            document_count: documents.length,
            documents: documentsSummary,
            counterparty: {
              name: caseData.counterpartyName,
              type: caseData.counterpartyType,
              email: caseData.counterpartyEmail,
              phone: caseData.counterpartyPhone,
              address: caseData.counterpartyAddress
            }
          };
          
          console.log("📤 Calling MindStudio Dossier_check.flow");
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout
          
          const response = await fetch('https://v1.mindstudio-api.com/developer/v2/agents/run', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
            },
            body: JSON.stringify({
              appId: process.env.MS_AGENT_APP_ID,
              variables: {
                input_json: inputData  // Send as object, not stringified (MindStudio handles JSON)
              },
              workflow: 'Dossier_check.flow',
              includeBillingCost: true
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ MindStudio API error:", errorText);
            throw new Error(`MindStudio API error: ${response.status}`);
          }
          
          const result = await response.json();
          console.log("✅ Dossier check completed");
          
          // Extract result from MindStudio response - NEW format
          let checkResult: any = {};
          
          try {
            // NEW format: result.result contains { documents, extracted_text, doc_count }
            if (result.result) {
              const mindstudioOutput = result.result;
              
              console.log(`📄 Processed ${mindstudioOutput.doc_count || 0} documents via MindStudio`);
              
              checkResult = {
                success: true,
                doc_count: mindstudioOutput.doc_count || 0,
                documents: mindstudioOutput.documents || [],
                extracted_text: mindstudioOutput.extracted_text || '',
                message: `${mindstudioOutput.doc_count || 0} documenten verwerkt via MindStudio Extract Text from File`
              };
            } else if (result.outputs?.output_json) {
              // Fallback to old format
              checkResult = JSON.parse(result.outputs.output_json);
            } else if (result.outputs?.result) {
              checkResult = result.outputs.result;
            } else {
              checkResult = result.outputs || {};
            }
          } catch (e) {
            console.error("Failed to parse dossier check result:", e);
            checkResult = { 
              raw_result: result.outputs || result.result,
              message: "Dossiercontrole voltooid maar resultaat kon niet worden geparseerd"
            };
          }
          
          // Log event
          await storage.createEvent({
            caseId,
            actorUserId: userId,
            type: "dossier_check_completed",
            payloadJson: { 
              document_count: documents.length,
              completeness: checkResult.completeness || 'onbekend'
            },
          });
          
          return res.json({
            success: true,
            ...checkResult,
            document_count: documents.length
          });
          
        } catch (error) {
          console.error("Dossier check failed:", error);
          
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (errorMsg.includes('abort') || errorMsg.includes('timeout')) {
            return res.status(504).json({ 
              message: "Dossiercontrole duurt te lang (timeout). Probeer het opnieuw met minder documenten." 
            });
          }
          
          return res.status(503).json({ 
            message: "Sorry, de dossiercontrole lukt niet. MindStudio AI is niet beschikbaar." 
          });
        }
      } else {
        // Mock response when MindStudio is not configured
        console.log("🧪 [MOCK] Dossier check - MindStudio not configured");
        return res.json({
          success: true,
          completeness: "75%",
          missing_documents: [
            "Aankoopbevestiging",
            "Bewijs van betaling"
          ],
          recommendations: "Upload de ontbrekende documenten voor een compleet dossier. Dit verhoogt uw kansen op succes.",
          document_count: documents.length,
          mock: true
        });
      }
      
    } catch (error) {
      console.error("Error running dossier check:", error);
      res.status(500).json({ message: "Dossiercontrole mislukt. Probeer het opnieuw." });
    }
  });

  // Second Run Analysis - refine analysis with missing info answers
  app.post('/api/cases/:id/second-run', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Get case data and verify ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Get the previous analysis (v1)
      const prevAnalysis = await storage.getLatestAnalysis(caseId);
      if (!prevAnalysis) {
        return res.status(400).json({ 
          message: "No previous analysis found. Please run full analysis first." 
        });
      }

      // Validate request body types according to contract
      const { 
        missing_info_answers, 
        new_uploads 
      } = req.body;

      // Type validation for missing_info_answers
      if (missing_info_answers && !Array.isArray(missing_info_answers)) {
        return res.status(400).json({ message: "missing_info_answers must be an array" });
      }
      
      if (missing_info_answers) {
        for (const answer of missing_info_answers) {
          if (!answer.question_id || typeof answer.question_id !== 'string') {
            return res.status(400).json({ message: "Each answer must have a question_id string" });
          }
          if (!['text', 'multiple_choice', 'file_upload'].includes(answer.answer_type)) {
            return res.status(400).json({ message: "answer_type must be 'text', 'multiple_choice', or 'file_upload'" });
          }
        }
      }

      // Type validation for new_uploads
      if (new_uploads && !Array.isArray(new_uploads)) {
        return res.status(400).json({ message: "new_uploads must be an array" });
      }

      // Get documents for analysis
      const documents = await storage.getDocumentsByCase(caseId);
      
      // Construct public base URL for document downloads (MindStudio needs publicly accessible URLs)
      const publicBaseUrl = process.env.PUBLIC_BASE_URL || 
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000');
      
      // Prefer publicUrl from object storage (signed URL), fallback to dev URL
      const uploaded_files = documents.map(doc => ({
        name: doc.filename,
        type: doc.mimetype as "application/pdf" | "image/jpeg" | "image/png",
        file_url: doc.publicUrl || `${publicBaseUrl}/api/documents/${doc.id}/download`
      }));

      // Extract prev_analysis_json from previous analysis
      let prev_analysis_json = null;
      try {
        if (prevAnalysis.rawText) {
          const rawData = JSON.parse(prevAnalysis.rawText);
          prev_analysis_json = rawData.parsedAnalysis || rawData;
        }
      } catch (error) {
        console.error("Could not parse previous analysis:", error);
      }

      // Build case_text from case data
      const case_text = `Zaak: ${caseData.title}\n\nOmschrijving: ${caseData.description || 'Geen beschrijving'}\n\nTegenpartij: ${caseData.counterpartyName || 'Onbekend'}\n\nClaim bedrag: €${caseData.claimAmount || '0'}`;

      // Prepare parties array according to contract
      const parties = [
        { name: caseData.counterpartyName || 'Onbekend', role: 'respondent' as const, type: caseData.counterpartyType || undefined }
      ];

      // Run second analysis with MindStudio
      const secondRunResult = await aiService.runFullAnalysis({
        case_id: caseId,
        case_text,
        amount_eur: Number(caseData.claimAmount) || 0,  // Ensure number type
        parties,
        uploaded_files,
        prev_analysis_json: prev_analysis_json ?? null,  // Explicit null if not available
        missing_info_answers: missing_info_answers ?? null,  // Preserve array or null
        new_uploads: new_uploads ?? null  // Preserve array or null
      });

      if (secondRunResult.success) {
        // Store as version 2 analysis
        const analysis = await storage.createAnalysis({
          caseId,
          version: 2,
          model: 'mindstudio-full-analysis-v2',
          rawText: secondRunResult.rawText || '',
          analysisJson: secondRunResult.parsedAnalysis,
          extractedTexts: secondRunResult.extractedTexts,
          missingInfoStruct: secondRunResult.missingInfoStruct,
          allFiles: secondRunResult.allFiles,
          userContext: secondRunResult.userContext,  // User's procedural role + legal role
          procedureContext: secondRunResult.procedureContext,  // Procedural info (kantonzaak, court, confidence)
          prevAnalysisId: prevAnalysis.id,
          missingInfoAnswers: missing_info_answers,
          // Legacy fields for backwards compatibility
          factsJson: secondRunResult.parsedAnalysis?.facts ? [
            ...(secondRunResult.parsedAnalysis.facts.known || []).map((fact: string) => ({ label: 'Vaststaande feiten', detail: fact })),
            ...(secondRunResult.parsedAnalysis.facts.disputed || []).map((fact: string) => ({ label: 'Betwiste feiten', detail: fact }))
          ] : [],
          issuesJson: secondRunResult.parsedAnalysis?.legal_analysis?.legal_issues?.map((issue: string) => ({ issue, risk: 'Zie juridische analyse' })) || [],
          legalBasisJson: [],
          missingDocsJson: [],
          riskNotesJson: secondRunResult.parsedAnalysis?.legal_analysis?.risks || []
        });

        return res.json({
          success: true,
          version: 2,
          analysis_json: secondRunResult.parsedAnalysis,
          extracted_texts: secondRunResult.extractedTexts,
          missing_info_struct: secondRunResult.missingInfoStruct,
          all_files: secondRunResult.allFiles,
          analysisId: analysis.id,
          message: 'Second run analysis completed successfully'
        });
      } else {
        return res.status(500).json({
          message: "Second run analysis failed",
          error: secondRunResult.rawText
        });
      }

    } catch (error) {
      console.error("Error in second run analysis:", error);
      res.status(500).json({ message: "Second run analysis failed. Please try again." });
    }
  });

  // Get missing info responses for a case
  app.get('/api/cases/:id/missing-info/responses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get all missing_info_provided events for this case
      const events = await storage.getEventsByCase(caseId);
      const missingInfoEvents = events.filter((e: any) => e.type === 'missing_info_provided');
      
      if (missingInfoEvents.length === 0) {
        return res.json({ responses: [] });
      }
      
      // Merge all events to get the complete set of responses
      // Later events override earlier ones for the same requirementId
      const responsesMap = new Map<string, any>();
      
      // Sort events by createdAt ASC so newer events override older ones
      missingInfoEvents.sort((a: any, b: any) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      
      // Process each event and merge responses
      for (const event of missingInfoEvents) {
        const payloadJson = event.payloadJson as any;
        const eventResponses = payloadJson?.responses || [];
        
        for (const response of eventResponses) {
          responsesMap.set(response.requirementId, response);
        }
      }
      
      // Convert map back to array
      const responses = Array.from(responsesMap.values());
      
      // Enrich responses with document names
      const enrichedResponses = await Promise.all(
        responses.map(async (response: any) => {
          if (response.kind === 'document' && response.documentId) {
            const doc = await storage.getDocument(response.documentId);
            return {
              ...response,
              documentName: doc?.filename || 'Onbekend document'
            };
          }
          return response;
        })
      );
      
      res.json({ responses: enrichedResponses });
      
    } catch (error) {
      console.error("Error fetching missing info responses:", error);
      res.status(500).json({ message: "Fout bij ophalen van antwoorden" });
    }
  });

  // Missing info responses route - allows users to provide answers/documents for missing requirements
  app.post('/api/cases/:id/missing-info/responses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Import the schema
      const { submitMissingInfoRequestSchema } = await import("@shared/schema");
      
      // Validate request body
      const { responses } = submitMissingInfoRequestSchema.parse(req.body);
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Create event to log the missing info responses
      await storage.createEvent({
        caseId,
        actorUserId: userId,
        type: "missing_info_provided",
        payloadJson: { responses },
      });
      
      // Build supplemental context from responses
      const supplementalContext: any = {
        providedAnswers: [],
        providedDocuments: [],
        notAvailable: []
      };
      
      for (const response of responses) {
        if (response.kind === 'not_available') {
          // User indicated this information is not available
          supplementalContext.notAvailable.push({
            requirementId: response.requirementId
          });
        } else if (response.kind === 'document' && response.documentId) {
          // Get document details
          const doc = await storage.getDocument(response.documentId);
          if (doc && doc.extractedText) {
            supplementalContext.providedDocuments.push({
              requirementId: response.requirementId,
              filename: doc.filename,
              text: doc.extractedText
            });
          }
        } else if (response.value) {
          supplementalContext.providedAnswers.push({
            requirementId: response.requirementId,
            kind: response.kind,
            value: response.value
          });
        }
      }
      
      // Store supplemental context for the next analysis
      // Now automatically trigger RKOS re-analysis to check if all info is complete
      
      console.log(`📊 Missing info responses saved. Triggering automatic RKOS re-analysis for case ${caseId}`);
      
      try {
        // Get fullAnalysis - must exist for RKOS
        const fullAnalysis = await storage.getAnalysisByType(caseId, 'mindstudio-full-analysis');
        
        if (fullAnalysis && fullAnalysis.analysisJson) {
          console.log('✅ Full analysis found, starting RKOS re-analysis...');
          
          // Get all case documents
          const documents = await storage.getDocumentsByCase(caseId);
          
          // Parse fullAnalysis to get all structured data
          let analysisData: any = {};
          try {
            analysisData = typeof fullAnalysis.analysisJson === 'string' 
              ? JSON.parse(fullAnalysis.analysisJson) 
              : fullAnalysis.analysisJson;
          } catch (error) {
            console.error("Error parsing fullAnalysis:", error);
          }
          
          // Prepare input for RKOS.flow including the new supplemental context
          const inputData: any = {
            case_id: caseId,
            case_title: caseData.title || 'Zonder titel',
            case_description: caseData.description || '',
            claim_amount: Number(caseData.claimAmount) || 0,
            
            // Full analysis data
            full_analysis: analysisData,
            
            // NEW: Include supplemental context from user responses
            supplemental_context: supplementalContext,
            
            // Documents
            dossier: {
              document_count: documents.length,
              documents: documents.map(doc => ({
                filename: doc.filename,
                extracted_text: doc.extractedText || ''
              }))
            }
          };
          
          // Call RKOS.flow
          const rkosResult = await aiService.runRKOS(inputData);
          
          if (!rkosResult.error && rkosResult.result) {
            console.log('✅ RKOS re-analysis completed successfully');
            
            // Parse RKOS result
            let rkosData = null;
            try {
              // Check result.rkos first (new format)
              if (rkosResult.result.rkos) {
                rkosData = rkosResult.result.rkos;
              }
              // Check thread posts (MindStudio format)
              else if (rkosResult.thread?.posts) {
                for (const post of rkosResult.thread.posts) {
                  if (post.debugLog?.newState?.variables?.rkos?.value) {
                    const value = post.debugLog.newState.variables.rkos.value;
                    rkosData = typeof value === 'string' ? JSON.parse(value) : value;
                    break;
                  }
                }
              }
            } catch (error) {
              console.error('Error parsing RKOS result:', error);
            }
            
            if (rkosData) {
              // Update fullAnalysis with new RKOS result
              await storage.updateAnalysis(fullAnalysis.id, {
                succesKansAnalysis: rkosData
              });
              
              res.json({ 
                success: true,
                message: "Antwoorden opgeslagen en heranalyse voltooid. Check de Analyse pagina voor de nieuwe resultaten.",
                reanalysisCompleted: true,
                newMissingElements: rkosData.missing_elements || []
              });
            } else {
              console.error('❌ Could not parse RKOS result');
              res.json({ 
                success: true,
                message: "Antwoorden opgeslagen, maar heranalyse data kon niet worden verwerkt.",
                reanalysisCompleted: false
              });
            }
          } else {
            console.error('❌ RKOS re-analysis failed:', rkosResult.error);
            res.json({ 
              success: true,
              message: "Antwoorden opgeslagen, maar heranalyse mislukt. U kunt handmatig een nieuwe analyse starten.",
              reanalysisCompleted: false
            });
          }
        } else {
          console.log('⚠️ No full analysis found, skipping automatic re-analysis');
          // Set needsReanalysis flag since we have new info but can't auto-analyze
          await caseService.updateCase(caseId, { needsReanalysis: true });
          console.log(`🔔 Set needsReanalysis flag - missing info provided but no full analysis yet`);
          res.json({ 
            success: true,
            message: "Antwoorden opgeslagen. Voer eerst een volledige analyse uit.",
            reanalysisCompleted: false
          });
        }
      } catch (reanalysisError) {
        console.error("Error during automatic re-analysis:", reanalysisError);
        // Still return success for saving responses, even if re-analysis failed
        res.json({ 
          success: true,
          message: "Antwoorden opgeslagen, maar heranalyse mislukt. U kunt handmatig een nieuwe analyse starten.",
          reanalysisCompleted: false
        });
      }
      
    } catch (error) {
      console.error("Error processing missing info responses:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Ongeldige antwoorden" });
      }
      res.status(500).json({ message: "Fout bij verwerken van antwoorden" });
    }
  });

  // Chat endpoints - AI conversation per case
  app.get('/api/cases/:id/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get conversation history
      const history = await getConversationHistory(caseId);
      
      res.json({ history });
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  app.delete('/api/cases/:id/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Delete all chat messages for this case
      await storage.deleteChatMessages(caseId);
      console.log(`🗑️ Deleted all chat messages for case ${caseId}`);
      
      res.json({ success: true, message: "Chat geschiedenis gewist" });
      
    } catch (error) {
      console.error("Error deleting chat history:", error);
      res.status(500).json({ message: "Failed to delete chat history" });
    }
  });

  app.post('/api/cases/:id/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { message } = req.body;
      
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ message: "Message is required" });
      }
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      console.log(`💬 Processing chat message for case ${caseId}: ${message.substring(0, 50)}...`);
      
      // Get existing conversation history (WITHOUT the new message yet)
      const existingHistory = await getConversationHistory(caseId);
      
      // Build complete history including the NEW user message for MindStudio
      const completeHistory = [
        ...existingHistory,
        { role: 'user', content: message }
      ];
      
      console.log(`📤 Sending to Chat.flow: ${completeHistory.length} messages in history`);
      
      // Call MindStudio Chat.flow with full context INCLUDING the current user question
      const assistantResponse = await callChatFlow(caseId, message, completeHistory);
      
      // Now save both messages to database
      await saveChatMessage(caseId, 'user', message);
      await saveChatMessage(caseId, 'assistant', assistantResponse);
      
      res.json({ 
        response: assistantResponse,
        success: true
      });
      
    } catch (error: any) {
      console.error("Error processing chat message:", error);
      res.status(500).json({ 
        message: error.message || "Failed to process chat message",
        success: false
      });
    }
  });

  // Q&A endpoints - Generate and fetch case-specific Q&A
  app.get('/api/cases/:id/qna', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get Q&A items
      const items = await getQnAItems(caseId);
      
      res.json({ items });
    } catch (error) {
      console.error("Error fetching Q&A items:", error);
      res.status(500).json({ message: "Failed to fetch Q&A items" });
    }
  });

  app.post('/api/cases/:id/generate-qna', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      console.log(`❓ Generating Q&A for case ${caseId}`);
      
      // Call MindStudio InfoQnA.flow
      const qnaPairs = await callInfoQnAFlow(caseId);
      
      if (qnaPairs.length === 0) {
        return res.status(200).json({ 
          message: "Geen Q&A gegenereerd - mogelijk te weinig informatie in het dossier",
          items: []
        });
      }
      
      // Save Q&A pairs to database (replaces existing)
      const savedItems = await saveQnAPairs(caseId, qnaPairs);
      
      console.log(`✅ Generated and saved ${savedItems.length} Q&A items`);
      
      res.json({ 
        success: true,
        items: savedItems,
        count: savedItems.length
      });
      
    } catch (error: any) {
      console.error("Error generating Q&A:", error);
      res.status(500).json({ 
        message: error.message || "Failed to generate Q&A",
        success: false
      });
    }
  });

  // Generate MORE Q&A (append to existing)
  app.post('/api/cases/:id/generate-more-qna', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      console.log(`➕ Generating MORE Q&A for case ${caseId}`);
      
      // Get existing Q&A items to use as history
      const existingItems = await getQnAItems(caseId);
      const existingQnA = existingItems.map(item => ({
        question: item.question,
        answer: item.answer
      }));
      
      console.log(`📜 Found ${existingQnA.length} existing Q&A items to send as context`);
      
      // Call MindStudio InfoQnA.flow with existing Q&A as history
      const newQnaPairs = await callInfoQnAFlow(caseId, existingQnA);
      
      if (newQnaPairs.length === 0) {
        return res.status(200).json({ 
          message: "Geen nieuwe vragen gegenereerd - mogelijk te weinig nieuwe informatie",
          items: [],
          count: 0
        });
      }
      
      // Append new Q&A pairs to existing ones
      const appendedItems = await appendQnAPairs(caseId, newQnaPairs);
      
      console.log(`✅ Generated and appended ${appendedItems.length} new Q&A items`);
      
      res.json({ 
        success: true,
        items: appendedItems,
        count: appendedItems.length,
        total: existingItems.length + appendedItems.length
      });
      
    } catch (error: any) {
      console.error("Error generating more Q&A:", error);
      res.status(500).json({ 
        message: error.message || "Failed to generate more Q&A",
        success: false
      });
    }
  });

  // Success chance assessment (RKOS - Redelijke Kans Op Succes)
  app.post('/api/cases/:id/success-chance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get fullAnalysis - must exist
      const fullAnalysis = await storage.getAnalysisByType(caseId, 'mindstudio-full-analysis');
      if (!fullAnalysis || !fullAnalysis.analysisJson) {
        return res.status(400).json({ message: "Voer eerst een volledige analyse uit voordat u de kans op succes kunt beoordelen" });
      }
      
      // Get all case documents
      const documents = await storage.getDocumentsByCase(caseId);
      
      // Parse fullAnalysis to get all structured data
      let analysisData: any = {};
      try {
        analysisData = typeof fullAnalysis.analysisJson === 'string' 
          ? JSON.parse(fullAnalysis.analysisJson) 
          : fullAnalysis.analysisJson;
      } catch (error) {
        console.error("Error parsing fullAnalysis:", error);
        return res.status(400).json({ message: "Analyse data is ongeldig" });
      }
      
      // Get userContext and procedureContext
      const userContext = fullAnalysis.userContext || {};
      const procedureContext = fullAnalysis.procedureContext || {};
      
      // Prepare comprehensive input for RKOS.flow
      const inputData: any = {
        // User role and case info
        user_role: userContext.procedural_role || "onbekend",
        case_info: {
          title: caseData.caseTitle || "Onbekend",
          claimant_name: caseData.claimantName,
          claimant_address: caseData.claimantAddress,
          claimant_city: caseData.claimantCity,
          counterparty_name: caseData.counterpartyName,
          counterparty_type: caseData.counterpartyType,
          counterparty_email: caseData.counterpartyEmail,
          counterparty_phone: caseData.counterpartyPhone,
          counterparty_address: caseData.counterpartyAddress,
          counterparty_city: caseData.counterpartyCity,
        },
        
        // Domain classification
        domain: userContext.legal_role || procedureContext.domain || "onbekend",
        
        // Amount claimed or disputed
        amount_eur: analysisData.claims?.total_amount || analysisData.amount || 0,
        
        // Complete analysis data from all tabs
        summary: analysisData.summary || null,
        parties: analysisData.parties || null,
        facts_known: analysisData.facts?.known || [],
        facts_disputed: analysisData.facts?.disputed || [],
        facts_unclear: analysisData.facts?.unclear || [],
        
        // Legal arguments/defenses
        arguments_or_defenses: {
          applicable_rules: analysisData.applicable_rules || [],
          legal_grounds: analysisData.legal_grounds || [],
          defenses: analysisData.defenses || [],
        },
        
        // Evidence
        evidence_full: {
          provided: analysisData.evidence?.provided || [],
          missing: analysisData.evidence?.missing || [],
        },
        
        // Risks and recommendations
        risks: analysisData.risks || [],
        recommendations: analysisData.recommendations || [],
        
        // All documents summary (from Dossier) with signed URLs for MindStudio
        all_documents: await Promise.all(documents.map(async (doc: any) => {
          let url = null;
          
          // Generate signed URL if document is in object storage
          if (doc.storageKey) {
            try {
              url = await fileService.generateSignedUrl(doc.storageKey, 48); // 48 hours validity
            } catch (error) {
              console.warn(`⚠️ Could not generate signed URL for ${doc.filename}:`, error);
            }
          }
          
          return {
            filename: doc.filename,
            extracted_text: doc.extractedText || '',
            document_analysis: doc.documentAnalysis || null,
            url: url || undefined, // MindStudio can use this URL for "Extract Text from File" block
          };
        })),
      };
      
      console.log("🎯 Calling RKOS.flow for success chance assessment...");
      console.log("📊 Input summary:", {
        user_role: inputData.user_role,
        domain: inputData.domain,
        amount_eur: inputData.amount_eur,
        facts_count: inputData.facts_known.length,
        documents_count: inputData.all_documents.length,
        documents_with_urls: inputData.all_documents.filter((d: any) => d.url).length,
      });
      
      // Call MindStudio RKOS.flow
      const mindstudioAppId = process.env.MS_AGENT_APP_ID;
      const mindstudioFlowId = process.env.MS_FLOW_BEVOEGDHEID_ID; // Using same API key
      
      if (!mindstudioAppId || !mindstudioFlowId) {
        console.error("❌ MindStudio credentials not configured");
        return res.status(503).json({ 
          message: "MindStudio is niet correct geconfigureerd. Neem contact op met de beheerder." 
        });
      }
      
      const requestBody = {
        appId: mindstudioAppId,
        workflow: "RKOS.flow",
        variables: {
          input_json: inputData
        }
      };
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000); // 3 minutes timeout
      
      try {
        const mindstudioResponse = await fetch('https://api.mindstudio.ai/developer/v2/apps/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mindstudioFlowId}`
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!mindstudioResponse.ok) {
          const errorText = await mindstudioResponse.text();
          console.error(`❌ MindStudio API error: ${mindstudioResponse.status}`, errorText);
          return res.status(500).json({ message: `MindStudio fout: ${mindstudioResponse.status}` });
        }
        
        const response = await mindstudioResponse.json();
        console.log("✅ RKOS.flow response received");
        
        // Extract rkos data from response.result
        let rkosData = null;
        if (response.result && response.result.rkos) {
          rkosData = typeof response.result.rkos === 'string' 
            ? JSON.parse(response.result.rkos) 
            : response.result.rkos;
        } else if (response.result) {
          // Fallback: check if result itself is the RKOS data
          rkosData = response.result;
        }
        
        if (!rkosData) {
          console.error("❌ No RKOS data in MindStudio response:", JSON.stringify(response).substring(0, 500));
          return res.status(500).json({ message: "Geen succeskans data ontvangen van AI" });
        }
        
        console.log("📊 RKOS result:", {
          chance_of_success: rkosData.chance_of_success,
          confidence_level: rkosData.confidence_level,
        });
        
        // Update the fullAnalysis record with succesKansAnalysis
        await storage.updateAnalysis(fullAnalysis.id, {
          succesKansAnalysis: rkosData
        });
        
        // Check if there are missing elements and set flag
        const hasMissingElements = rkosData.missing_elements && 
                                   Array.isArray(rkosData.missing_elements) && 
                                   rkosData.missing_elements.length > 0;
        
        if (hasMissingElements) {
          await caseService.updateCase(caseId, {
            hasUnseenMissingItems: true,
            needsReanalysis: false  // Clear reanalysis flag since we just ran RKOS
          });
          console.log(`🔔 Set hasUnseenMissingItems flag - ${rkosData.missing_elements.length} items found`);
          console.log(`✅ Cleared needsReanalysis flag - RKOS analysis completed`);
        } else {
          // No missing elements, just clear the reanalysis flag
          await caseService.updateCase(caseId, {
            needsReanalysis: false
          });
          console.log(`✅ Cleared needsReanalysis flag - RKOS analysis completed`);
        }
        
        // Log event
        await storage.createEvent({
          caseId,
          actorUserId: userId,
          type: "success_chance_assessed",
          payloadJson: { result: rkosData },
        });
        
        res.json({
          success: true,
          result: rkosData
        });
        
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error("❌ Error calling RKOS.flow:", error);
        
        if (error.name === 'AbortError') {
          return res.status(504).json({ message: "De beoordeling duurde te lang. Probeer het later opnieuw." });
        }
        
        res.status(500).json({ message: "Fout bij het beoordelen van de kans op succes" });
      }
      
    } catch (error) {
      console.error("Error in success chance assessment:", error);
      res.status(500).json({ message: "Fout bij het uitvoeren van de succeskans beoordeling" });
    }
  });

  // Letter generation routes
  app.post('/api/cases/:id/letter', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { briefType, tone } = req.body;
      
      if (!briefType || !tone) {
        return res.status(400).json({ message: "briefType and tone are required" });
      }
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // First check for RKOS analysis from Supabase (primary source)
      let rkosAnalysis = null;
      try {
        rkosAnalysis = await rkosAnalysisService.getLatestCompletedAnalysis(caseId);
      } catch (rkosError) {
        console.warn("Failed to fetch RKOS from Supabase:", rkosError);
      }
      
      // Also get legal advice from Supabase
      let supabaseLegalAdvice = null;
      try {
        supabaseLegalAdvice = await legalAdviceService.getLatestCompletedAdvice(caseId);
      } catch (adviceError) {
        console.warn("Failed to fetch legal advice from Supabase:", adviceError);
      }
      
      // Fall back to local database only if Supabase has no analysis
      const localAnalysis = await storage.getLatestAnalysis(caseId);
      
      // Require at least one analysis source
      if (!rkosAnalysis && !supabaseLegalAdvice && !localAnalysis) {
        return res.status(400).json({ message: "Case must be analyzed first" });
      }
      
      console.log("📊 Analysis sources - RKOS:", !!rkosAnalysis, "Legal Advice:", !!supabaseLegalAdvice, "Local:", !!localAnalysis);

      // Get all documents with their analyses for the dossier
      const documents = await storage.getDocumentsByCase(caseId);
      const dossier = documents.map((doc: any) => ({
        filename: doc.filename,
        document_type: doc.documentAnalysis?.document_type || "Onbekend",
        summary: doc.documentAnalysis?.summary || "",
        tags: doc.documentAnalysis?.tags || [],
        readability_score: doc.documentAnalysis?.readability_score || null,
        belongs_to_case: doc.documentAnalysis?.belongs_to_case || true,
        note: doc.documentAnalysis?.note || "",
        analysis_status: doc.analysisStatus
      }));

      console.log(`📁 Prepared dossier with ${dossier.length} documents`);

      // Prepare sender information (from case claimant data)
      const sender = {
        name: caseData.claimantName || "Niet opgegeven",
        address: caseData.claimantAddress || "Niet opgegeven",
        postal_code: "",
        city: caseData.claimantCity || "",
        email: req.user.claims.email || ""
      };

      // Prepare recipient information (counterparty)
      const recipient = {
        name: caseData.counterpartyName || "Niet opgegeven",
        address: caseData.counterpartyAddress || "Niet opgegeven", 
        postal_code: "",
        city: caseData.counterpartyCity || ""
      };

      console.log("📝 Generating letter with MindStudio DraftFirstLetter.flow...");
      console.log("Brief type:", briefType);
      console.log("Tone:", tone);

      // Build analysis_json from Supabase data (primary) or fall back to local
      let analysisJson: any = {};
      
      if (rkosAnalysis) {
        // Build from Supabase RKOS analysis
        analysisJson = {
          chance_of_success: rkosAnalysis.chance_of_success,
          confidence_level: rkosAnalysis.confidence_level,
          summary_verdict: rkosAnalysis.summary_verdict,
          assessment: rkosAnalysis.assessment,
          facts: rkosAnalysis.facts || [],
          strengths: rkosAnalysis.strengths || [],
          weaknesses: rkosAnalysis.weaknesses || [],
          risks: rkosAnalysis.risks || [],
          legal_analysis: rkosAnalysis.legal_analysis,
          recommended_claims: rkosAnalysis.recommended_claims,
          applicable_laws: rkosAnalysis.applicable_laws,
          missing_elements: rkosAnalysis.missing_elements,
        };
        console.log("📊 Using RKOS analysis from Supabase");
      }
      
      // Add legal advice data if available
      if (supabaseLegalAdvice) {
        const rawPayload = supabaseLegalAdvice.raw_payload || {};
        analysisJson = {
          ...analysisJson,
          legal_advice: {
            de_feiten: rawPayload.de_feiten,
            het_geschil: rawPayload.het_geschil,
            juridische_duiding: rawPayload.juridische_duiding,
            vervolgstappen: rawPayload.vervolgstappen,
            betwiste_punten: rawPayload.betwiste_punten,
            beschikbaar_bewijs: rawPayload.beschikbaar_bewijs,
            ontbrekend_bewijs: rawPayload.ontbrekend_bewijs,
          }
        };
        console.log("📋 Added legal advice from Supabase");
      }
      
      // Fall back to local analysis if no Supabase data
      if (Object.keys(analysisJson).length === 0 && localAnalysis) {
        analysisJson = localAnalysis.factsJson || {};
        console.log("📊 Using local analysis (fallback)");
      }

      // Fetch jurisprudence references - check local analysis first, then search all
      let jurisprudenceReferences: Array<{ecli: string; court: string; explanation: string}> | undefined = 
        localAnalysis?.jurisprudenceReferences as Array<{ecli: string; court: string; explanation: string}> | undefined;
      
      // If no references found, check all local analyses
      if (!jurisprudenceReferences || jurisprudenceReferences.length === 0) {
        const allAnalyses = await storage.getAnalysesByCase(caseId);
        console.log(`🔍 Checking all ${allAnalyses.length} local analyses for jurisprudence references...`);
        
        for (const analysisItem of allAnalyses) {
          const refs = analysisItem.jurisprudenceReferences as Array<{ecli: string; court: string; explanation: string}> | undefined;
          if (refs && refs.length > 0) {
            jurisprudenceReferences = refs;
            console.log(`✅ Found ${refs.length} jurisprudence references in analysis from ${analysisItem.createdAt}`);
            break;
          }
        }
      }
      
      if (jurisprudenceReferences && jurisprudenceReferences.length > 0) {
        console.log(`📚 Including ${jurisprudenceReferences.length} jurisprudence references in letter`);
      } else {
        console.log("ℹ️ No jurisprudence references available for this case");
      }

      // Call MindStudio DraftFirstLetter.flow
      const letterResult = await aiService.runDraftFirstLetter({
        case_id: caseId,
        case_text: caseData.description || "",
        analysis_json: analysisJson,
        brief_type: briefType,
        sender,
        recipient,
        tone,
        dossier,
        jurisprudence_references: jurisprudenceReferences
      });

      if (!letterResult.success || !letterResult.brief) {
        console.error("❌ Letter generation failed:", letterResult.error);
        return res.status(500).json({ 
          message: "Er ging iets mis bij het genereren van de brief",
          error: letterResult.error 
        });
      }

      console.log("✅ Letter successfully generated from MindStudio");

      // Format current date in Dutch
      const currentDate = new Date().toLocaleDateString('nl-NL', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      // Convert letter structure to professional HTML with complete layout
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              margin: 2cm;
            }
            body { 
              font-family: 'Arial', 'Helvetica', sans-serif; 
              line-height: 1.6; 
              max-width: 100%; 
              margin: 0; 
              padding: 40px;
              color: #1a1a1a;
            }
            .letter-header {
              margin-bottom: 40px;
            }
            .sender-info {
              margin-bottom: 40px;
              font-size: 14px;
            }
            .sender-info .name {
              font-weight: 600;
              margin-bottom: 5px;
            }
            .sender-info .details {
              color: #555;
            }
            .date {
              text-align: right;
              margin-bottom: 30px;
              color: #555;
              font-size: 14px;
            }
            .recipient-info {
              margin-bottom: 40px;
              font-size: 14px;
            }
            .recipient-info .name {
              font-weight: 600;
              margin-bottom: 5px;
            }
            .subject {
              font-weight: 700;
              margin: 30px 0 20px 0;
              font-size: 16px;
              color: #1a1a1a;
            }
            .salutation {
              margin: 30px 0 20px 0;
            }
            .body {
              margin: 20px 0;
              white-space: pre-wrap;
              line-height: 1.8;
            }
            .closing {
              margin-top: 40px;
            }
            .signature {
              margin-top: 50px;
            }
            .signature-name {
              font-weight: 600;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="letter-header">
            <div class="sender-info">
              <div class="name">${sender.name}</div>
              <div class="details">${sender.address}</div>
              ${sender.email ? `<div class="details">${sender.email}</div>` : ''}
            </div>

            <div class="date">${currentDate}</div>

            <div class="recipient-info">
              <div class="name">${recipient.name}</div>
              <div class="details">${recipient.address}</div>
            </div>

            ${letterResult.brief.title ? `<div class="subject">Betreft: ${letterResult.brief.title}</div>` : ''}
          </div>

          <div class="salutation">${letterResult.brief.salutation || ''}</div>
          <div class="body">${letterResult.brief.body || ''}</div>
          <div class="closing">${letterResult.brief.closing || ''}</div>
          <div class="signature">
            <div class="signature-text">${letterResult.brief.signature || ''}</div>
            <div class="signature-name">${sender.name}</div>
          </div>
        </body>
        </html>
      `;

      // Convert to markdown for storage
      const markdown = `# ${letterResult.brief.title}\n\n${letterResult.brief.salutation}\n\n${letterResult.brief.body}\n\n${letterResult.brief.closing}\n\n${letterResult.brief.signature}`;
      
      // Generate PDF
      const pdfStorageKey = await pdfService.generatePDF(html, `letter_${caseId}`);
      
      // Save letter to Supabase only
      const letter = await letterService.createLetter(
        {
          case_id: caseId,
          user_id: ensureUuid(userId),
          brief_type: briefType,
          tone,
        },
        {
          html,
          markdown,
          pdf_storage_key: pdfStorageKey,
          sender_name: sender.name,
          sender_address: sender.address,
          sender_postcode: sender.postal_code,
          sender_city: sender.city,
          recipient_name: recipient.name,
          recipient_address: recipient.address,
          recipient_postcode: recipient.postal_code,
          recipient_city: recipient.city,
          letter_structure: letterResult.brief,
        },
        letterResult.rawPayload
      );
      
      // Update case status (gracefully handle if case is in Supabase only)
      try {
        await caseService.updateCaseStatus(
          caseId,
          "LETTER_DRAFTED",
          "Deurwaarder inschakelen",
          "Inschakelen deurwaarder"
        );
      } catch (statusError) {
        console.log("Case status update skipped (case may be in Supabase only)");
      }
      
      // Create event with letter details (gracefully handle if case is in Supabase only)
      try {
        await storage.createEvent({
          caseId,
          actorUserId: userId,
          type: "letter_drafted",
          payloadJson: { 
            letterId: letter.id,
            briefType,
            tone,
            letterStructure: letterResult.brief
          },
        });
      } catch (eventError) {
        console.log("Event creation skipped (case may be in Supabase only)");
      }
      
      res.json({
        ...letter,
        letterStructure: letterResult.brief // Include the structured letter data in response
      });
    } catch (error) {
      console.error("Error generating letter:", error);
      res.status(500).json({ message: "Failed to generate letter" });
    }
  });

  app.get('/api/cases/:id/letter/:letterId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const letter = await letterService.getLetterById(req.params.letterId);
      
      if (!letter) {
        return res.status(404).json({ message: "Letter not found" });
      }
      
      const caseData = await caseService.getCaseById(letter.caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(403).json({ message: "Unauthorized access" });
      }
      
      res.json(letter);
    } catch (error) {
      console.error("Error fetching letter:", error);
      res.status(500).json({ message: "Failed to fetch letter" });
    }
  });

  app.delete('/api/cases/:id/letter/:letterId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const letterId = req.params.letterId;
      
      const letter = await letterService.getLetterById(letterId);
      
      if (!letter) {
        return res.status(404).json({ message: "Letter not found" });
      }
      
      const caseData = await caseService.getCaseById(letter.caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(403).json({ message: "Unauthorized access" });
      }
      
      // Delete the letter from Supabase
      const deleted = await letterService.deleteLetter(letterId);
      
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete letter" });
      }
      
      // Try to create event for audit trail (non-blocking)
      try {
        await storage.createEvent({
          caseId: letter.caseId,
          actorUserId: userId,
          type: "letter_deleted",
          payloadJson: { 
            letterId
          },
        });
      } catch (eventError) {
        console.warn("Could not create delete event (case may not exist in local db):", eventError);
      }
      
      res.json({ message: "Letter successfully deleted" });
    } catch (error) {
      console.error("Error deleting letter:", error);
      res.status(500).json({ message: "Failed to delete letter" });
    }
  });

  // Summons generation routes
  app.post('/api/cases/:id/summons', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { court } = req.body; // Optional court selection
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const analysis = await storage.getLatestAnalysis(caseId);
      if (!analysis) {
        return res.status(400).json({ message: "Case must be analyzed first" });
      }

      console.log("⚖️ Generating summons with MindStudio GenerateSummons.flow...");

      // Prepare claimant information (from user profile)
      const claimant = {
        name: req.user.claims.name || req.user.claims.email || "Niet opgegeven",
        place: "", // User should provide
        rep_name: req.user.claims.name || req.user.claims.email || "",
        rep_address: "",
        phone: "",
        email: req.user.claims.email || "",
        iban: ""
      };

      // Prepare defendant information (counterparty)
      const defendant = {
        name: caseData.counterpartyName || "Niet opgegeven",
        address: caseData.counterpartyAddress || "Niet opgegeven",
        birthdate: "",
        is_consumer: caseData.counterpartyType === "individual"
      };

      // Call MindStudio GenerateSummons.flow
      const summonsResult = await aiService.runGenerateSummons({
        case_id: caseId,
        case_details: {
          title: caseData.title,
          description: caseData.description,
          category: caseData.category,
          claimAmount: caseData.claimAmount
        },
        analysis_json: analysis.analysisJson || analysis.factsJson || {},
        claimant,
        defendant,
        court
      });

      if (!summonsResult.success || !summonsResult.summonsData) {
        console.error("❌ Summons generation failed:", summonsResult.error);
        return res.status(500).json({
          message: "Er ging iets mis bij het genereren van de dagvaarding",
          error: summonsResult.error
        });
      }

      console.log("✅ Summons successfully generated from MindStudio");

      // The summonsData is the complete SummonsV1 structure
      const summonsData = summonsResult.summonsData;

      // Validate the summons data against SummonsV1 schema
      const validationResult = validateSummonsV1(summonsData);
      
      if (!validationResult.success) {
        console.error("❌ Summons validation failed:", validationResult.errors);
        return res.status(400).json({
          message: "De gegenereerde dagvaarding voldoet niet aan het verwachte formaat",
          validationErrors: validationResult.errors
        });
      }

      console.log("✅ Summons data validated successfully");

      // For now, we'll store the JSON and generate HTML later
      // In a future task, we'll create the HTML template component
      const html = `<html><body><pre>${JSON.stringify(summonsData, null, 2)}</pre></body></html>`;
      const markdown = JSON.stringify(summonsData, null, 2);

      // Generate PDF (placeholder for now)
      const pdfStorageKey = await pdfService.generatePDF(html, `summons_${caseId}`);

      // Save summons with structured JSON data
      const summon = await storage.createSummons({
        caseId,
        templateId: null, // No template, generated by MindStudio
        dataJson: summonsData, // Store the complete SummonsV1 structure
        html,
        markdown,
        pdfStorageKey,
        status: "draft",
      });

      // Update case status
      await caseService.updateCaseStatus(
        caseId,
        "SUMMONS_DRAFTED",
        "Rechtbank",
        "Dossier aanbrengen bij rechtbank"
      );

      // Create event
      await storage.createEvent({
        caseId,
        actorUserId: userId,
        type: "summons_drafted",
        payloadJson: { 
          summonsId: summon.id,
          summonsVersion: summonsData.meta?.template_version 
        },
      });

      res.json({
        ...summon,
        summonsData // Include structured data in response
      });
    } catch (error) {
      console.error("Error generating summons:", error);
      res.status(500).json({ message: "Failed to generate summons" });
    }
  });

  // Get all summons for a case
  app.get('/api/cases/:id/summons', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await caseService.getCaseById(req.params.id);
      
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const summonsList = await storage.getSummonsByCase(req.params.id);
      res.json(summonsList);
    } catch (error) {
      console.error("Error fetching summons:", error);
      res.status(500).json({ message: "Failed to fetch summons" });
    }
  });

  // Get specific summons
  app.get('/api/cases/:id/summons/:summonsId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summons = await storage.getSummons(req.params.summonsId);
      
      if (!summons) {
        return res.status(404).json({ message: "Summons not found" });
      }
      
      const caseData = await caseService.getCaseById(summons.caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(403).json({ message: "Unauthorized access" });
      }
      
      res.json(summons);
    } catch (error) {
      console.error("Error fetching summons:", error);
      res.status(500).json({ message: "Failed to fetch summons" });
    }
  });

  // Delete summons
  app.delete('/api/cases/:id/summons/:summonsId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summonsId = req.params.summonsId;
      
      const summons = await storage.getSummons(summonsId);
      
      if (!summons) {
        return res.status(404).json({ message: "Summons not found" });
      }
      
      const caseData = await caseService.getCaseById(summons.caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(403).json({ message: "Unauthorized access" });
      }
      
      // Delete the summons from storage
      await storage.deleteSummons(summonsId);
      
      // Create event for audit trail
      await storage.createEvent({
        caseId: summons.caseId,
        actorUserId: userId,
        type: "summons_deleted",
        payloadJson: { 
          summonsId
        },
      });
      
      res.json({ message: "Summons successfully deleted" });
    } catch (error) {
      console.error("Error deleting summons:", error);
      res.status(500).json({ message: "Failed to delete summons" });
    }
  });

  // Summons V2 Template-based routes
  // Get all summons V2 for a case
  app.get('/api/cases/:id/summons-v2', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const summonsList = await storage.getSummonsByCase(caseId);
      res.json(summonsList);
    } catch (error) {
      console.error("Error fetching summons v2:", error);
      res.status(500).json({ message: "Failed to fetch summons" });
    }
  });

  // Save summons V2 draft
  app.post('/api/cases/:id/summons-v2/draft', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { userFields, aiFields } = req.body;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Check if draft already exists
      const existingSummons = await storage.getSummonsByCase(caseId);
      const existingDraft = existingSummons.find(s => s.status === 'draft' && s.templateVersion === 'v1');
      
      if (existingDraft) {
        // Update existing draft (not implemented yet, would need updateSummons method)
        return res.status(200).json({ message: "Draft updated", id: existingDraft.id });
      } else {
        // Create new draft
        const summons = await storage.createSummons({
          caseId,
          templateId: "official_model_dagvaarding",
          templateVersion: "v1",
          userFieldsJson: userFields,
          aiFieldsJson: aiFields,
          status: "draft"
        });
        
        await storage.createEvent({
          caseId,
          actorUserId: userId,
          type: "summons_draft_saved",
          payloadJson: { summonsId: summons.id },
        });
        
        res.json({ message: "Draft saved", id: summons.id });
      }
    } catch (error) {
      console.error("Error saving summons draft:", error);
      res.status(500).json({ message: "Failed to save draft" });
    }
  });

  // Helper: Chunk document text into manageable pieces (6000-8000 chars)
  function chunkDocumentText(filename: string, text: string, chunkSize = 7000): Array<{
    filename: string;
    page?: number;
    chunk_index: number;
    total_chunks: number;
    content: string;
  }> {
    if (!text || text.length === 0) return [];
    
    const chunks: Array<{filename: string; chunk_index: number; total_chunks: number; content: string}> = [];
    let position = 0;
    
    while (position < text.length) {
      const chunk = text.substring(position, position + chunkSize);
      chunks.push({
        filename,
        chunk_index: chunks.length,
        total_chunks: 0, // Will be set after
        content: chunk
      });
      position += chunkSize;
    }
    
    // Set total_chunks for all
    const totalChunks = chunks.length;
    chunks.forEach(c => c.total_chunks = totalChunks);
    
    return chunks;
  }

  // Generate summons V2 with AI - using CreateDagvaarding.flow with COMPLETE context (no summarization)
  app.post('/api/cases/:id/summons-v2/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { userFields, templateId } = req.body;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get template configuration if provided
      let template = null;
      if (templateId) {
        template = await storage.getTemplate(templateId);
        if (!template) {
          return res.status(404).json({ message: "Template not found" });
        }
      }
      
      // Check if template is multi-step (has sectionsConfig)
      const isMultiStep = template?.sectionsConfig && Array.isArray(template.sectionsConfig) && template.sectionsConfig.length > 0;
      
      if (isMultiStep) {
        console.log("🔁 Multi-step template detected, creating summons with sections...");
        
        // Create summons record with status "in_progress"
        const summons = await storage.createSummons({
          caseId,
          templateId: templateId || "official_model_dagvaarding",
          templateVersion: template?.version || "v4-multistep",
          userFieldsJson: userFields,
          aiFieldsJson: {},
          status: "in_progress"
        });
        
        // Create section records for each section in sectionsConfig
        for (let i = 0; i < (template!.sectionsConfig as any[]).length; i++) {
          const sectionConfig = (template!.sectionsConfig as any[])[i];
          
          // Aanzegging section is fixed and should be auto-approved
          const isAanzegging = sectionConfig.sectionKey?.toLowerCase() === "aanzegging";
          const aanzeggingText = `AANZEGGING

Op verzoek van: [Naam eiser]
Wonende te: [Adres eiser]

Hierbij verzoek ik u te verschijnen voor de kantonrechter van de rechtbank [Naam rechtbank] op: [Datum zitting] om [Tijd zitting]
ten aanzien van de zaak tegen:

[Naam gedaagde]
Wonende te: [Adres gedaagde]

De gedaagde wordt verzocht op de hierboven genoemde datum en tijd te verschijnen teneinde te worden gehoord over de tegen hem/haar ingestelde vordering.

Indien gedaagde niet verschijnt, kan verstek worden verleend en kan de vordering zonder dienst/haar tegenspraak worden toegewezen.`;
          
          await storage.createSummonsSection({
            summonsId: summons.id,
            sectionKey: sectionConfig.sectionKey,
            sectionName: sectionConfig.sectionName || sectionConfig.sectionKey,
            stepOrder: i + 1,
            flowName: sectionConfig.flowName || null,
            feedbackVariableName: sectionConfig.feedbackVariableName || null,
            status: isAanzegging ? "approved" : "pending",
            generatedText: isAanzegging ? aanzeggingText : null,
            userFeedback: null,
            generationCount: isAanzegging ? 1 : 0
          });
        }
        
        await storage.createEvent({
          caseId,
          actorUserId: userId,
          type: "summons_multistep_started",
          payloadJson: { summonsId: summons.id, templateId },
        });
        
        return res.json({
          success: true,
          message: "Multi-step summons created",
          summonsId: summons.id,
          sectionCount: (template!.sectionsConfig as any[]).length
        });
      }
      
      // Single-step flow continues below
      // Check if template has MindStudio flow configured
      // Explicitly default to CreateDagvaarding.flow if template flow name is missing or empty
      const flowName = (template?.mindstudioFlowName && template.mindstudioFlowName.trim()) 
        ? template.mindstudioFlowName.trim() 
        : "CreateDagvaarding.flow";
      console.log(`🔄 Using MindStudio flow: ${flowName}${template?.mindstudioFlowName ? ' (from template)' : ' (default)'}`);
      
      const analysis = await storage.getLatestAnalysis(caseId);
      if (!analysis) {
        return res.status(400).json({ message: "Case must be analyzed first" });
      }

      // Get case documents with full text
      const documents = await storage.getDocumentsByCase(caseId);
      
      console.log("🤖 Generating dagvaarding with COMPLETE context (no summarization)...");
      
      // Parse analysis data (support both new and old kanton check formats)
      let parsedAnalysis: any = {};
      try {
        if (analysis.analysisJson) {
          parsedAnalysis = analysis.analysisJson;
        } else if (analysis.rawText) {
          const rawData = JSON.parse(analysis.rawText);
          // Try multiple locations: result.analysis_json (full analysis), parsedAnalysis (old format), or root
          parsedAnalysis = rawData.result?.analysis_json || rawData.parsedAnalysis || rawData;
        } else if (analysis.factsJson || analysis.legalBasisJson) {
          // OLD KANTON CHECK FORMAT - convert to new format
          console.log("⚠️ Converting old kanton check format to new format");
          parsedAnalysis = {
            facts: { known: [] },
            legal_analysis: { legal_basis: [] }
          };
          
          // Extract facts from old format and split long sentences into short facts
          if (analysis.factsJson) {
            const oldFacts = Array.isArray(analysis.factsJson) ? analysis.factsJson : [analysis.factsJson];
            const factText = oldFacts.map((f: any) => f.detail || f.label || '').join(' ');
            
            // Split on sentence boundaries and clean up
            const sentences = factText.split(/\.\s+/).filter((s: string) => s.trim().length > 10);
            parsedAnalysis.facts.known = sentences.map((s: string) => s.trim().endsWith('.') ? s.trim() : s.trim() + '.');
          }
          
          // Extract legal basis from old format: [{law: {grond, belang_eur}}]
          if (analysis.legalBasisJson) {
            const oldLegalBasis = Array.isArray(analysis.legalBasisJson) ? analysis.legalBasisJson : [analysis.legalBasisJson];
            oldLegalBasis.forEach((lb: any) => {
              if (lb.law) {
                parsedAnalysis.legal_analysis.legal_basis.push({
                  law: lb.law.grond || 'Consumentenkoop',
                  article: lb.law.belang_eur ? `Belang: € ${lb.law.belang_eur.toLocaleString('nl-NL')}` : '',
                  note: lb.law.bijzondere_regel || ''
                });
              }
            });
          }
        }
      } catch (e) {
        console.error("Failed to parse analysis:", e);
      }

      // BUILD COMPLETE PAYLOAD - NO SUMMARIZATION
      console.log("📦 Building complete context payload (no summarization)...");
      
      // 1. PARTIES - Complete party information
      const parties = {
        claimant: {
          name: userFields.eiser_naam || "Niet opgegeven",
          address: userFields.eiser_adres || "",
          contact: userFields.eiser_email || "",
          type: "individual" // Could be enhanced
        },
        defendant: {
          name: userFields.gedaagde_naam || caseData.counterpartyName || "Niet opgegeven",
          address: userFields.gedaagde_adres || caseData.counterpartyAddress || "",
          contact: caseData.counterpartyEmail || "",
          type: caseData.counterpartyType || "unknown"
        }
      };
      
      // 2. COURT INFO - Complete court details
      const court_info = {
        name: userFields.rechtbank_naam || "Rechtbank Amsterdam",
        location: userFields.rechtbank_locatie || "Amsterdam",
        session_date: userFields.zitting_datum || "",
        session_time: userFields.zitting_tijd || ""
      };
      
      // 3. CLAIMS - All claims with full detail
      const claims_all = [{
        description: caseData.title || "Betaling openstaande vordering",
        amount: caseData.claimAmount ? Number(caseData.claimAmount) : 0,
        details: caseData.description || "",
        legal_basis: parsedAnalysis?.legal_analysis?.legal_basis || []
      }];
      
      // 4. AMOUNTS - Complete financial details
      const amounts_all = {
        principal: caseData.claimAmount ? Number(caseData.claimAmount) : 0,
        interest_rate: userFields.rente_percentage || 0,
        collection_costs: userFields.buitengerechtelijke_incassokosten || 0,
        court_fees: userFields.griffierecht || 0,
        total: 0 // Will be calculated
      };
      
      // 5. USER FIELDS - ALL user-entered fields (complete, no filtering)
      const user_fields_all = { ...userFields };
      
      // 6. FACTS - COMPLETE facts array (no summarization)
      const facts_known_full: string[] = [];
      
      // Add ALL known facts verbatim
      if (parsedAnalysis?.facts?.known) {
        facts_known_full.push(...parsedAnalysis.facts.known);
      }
      
      // Add ALL disputed facts with label
      if (parsedAnalysis?.facts?.disputed) {
        facts_known_full.push(...parsedAnalysis.facts.disputed.map((f: string) => `[BETWIST] ${f}`));
      }
      
      // Add ALL unclear facts with label
      if (parsedAnalysis?.facts?.unclear) {
        facts_known_full.push(...parsedAnalysis.facts.unclear.map((f: string) => `[ONDUIDELIJK] ${f}`));
      }
      
      // Add case context facts
      if (caseData.title) facts_known_full.unshift(`[ZAAKTITEL] ${caseData.title}`);
      if (caseData.description) facts_known_full.push(`[OMSCHRIJVING] ${caseData.description}`);
      if (caseData.claimAmount) facts_known_full.push(`[BEDRAG] € ${Number(caseData.claimAmount).toFixed(2)}`);
      
      // 7. DEFENSES - Complete defense analysis
      const defenses_expected_full: string[] = parsedAnalysis?.legal_analysis?.potential_defenses || [];
      
      // 8. LEGAL BASIS - Complete legal foundation
      const legal_basis_full = parsedAnalysis?.legal_analysis?.legal_basis || [];
      
      // 9. TIMELINE - Complete timeline if available
      const timeline_full: Array<{date: string, actor: string, event: string, raw_text: string}> = [];
      // Could be populated from events table in future
      
      // 10. ANALYSIS - COMPLETE analysis JSON (no filtering)
      const analysis_full = parsedAnalysis;
      
      // 11. COMMUNICATIONS - All messages/letters (future: from letters table)
      const communications_full: Array<{date: string, channel: string, direction: string, raw_text: string}> = [];
      
      // 12. EVIDENCE - Complete evidence registry
      const evidence_full: Array<{id: string, title: string, type: string, source: string, raw_notes: string}> = [];
      if (parsedAnalysis?.evidence?.provided) {
        evidence_full.push(...parsedAnalysis.evidence.provided.map((e: any, idx: number) => ({
          id: `evidence_${idx}`,
          title: e.doc_name || e.source || `Evidence ${idx + 1}`,
          type: e.type || "document",
          source: e.source || "",
          raw_notes: e.notes || ""
        })));
      }
      
      // 13. DOCS FULL - Complete documents with chunking (NO summarization)
      const docs_full: Array<{filename: string, chunk_index: number, total_chunks: number, content: string}> = [];
      for (const doc of documents) {
        if (doc.extractedText && doc.extractedText.length > 0) {
          const chunks = chunkDocumentText(doc.filename, doc.extractedText, 7000);
          docs_full.push(...chunks);
        }
      }
      
      // 14. ATTACHMENTS META - Metadata for all files
      const attachments_meta = documents.map(doc => ({
        name: doc.filename,
        size: doc.sizeBytes || 0,
        mimetype: doc.mimetype || "application/octet-stream"
      }));
      
      // 15. FLAGS - Control flags
      const flags = {
        is_consumer_case: caseData.counterpartyType === "individual",
        avoid_numbers: false,
        dont_invent: true,
        no_html: true,
        no_summarize: true,
        allow_long_context: true,
        strict_no_placeholders: true,  // NEVER use [datum], [bedrag], [Shop in te vullen] etc.
        use_only_case_data: true,      // Only use facts and data from the case files
        leave_blank_if_unknown: false  // Write detailed paragraph about evidentiary gap instead of leaving blank
      };
      
      // 16. STYLE - Writing style preferences  
      const style = {
        tone: "formal",
        paragraph_max_words: 150,
        reference_law_style: "article_number"
      };
      
      // 17. WRITING RULES - Anti-placeholder instruction
      const writing_rules = {
        required_behavior: "Always produce substantive, case-specific legal prose based on the provided data.",
        forbidden_patterns: ["[datum]", "[bedrag]", "[Shop in te vullen]", "[Naam]", "[adres]", "[beschrijving]", "[nummer]", "string"],
        strict_instruction: "Never output literal placeholders or empty arrays. If a concrete detail is missing, write a neutral but detailed paragraph explaining the evidentiary gap, expected documents, and legal relevance."
      };
      
      // Assemble complete payload
      const completePayload = {
        // Meta
        case_id: caseId,
        locale: "nl",
        template_version: "1.3",
        
        // Control flags
        no_summarize: true,
        allow_long_context: true,
        
        // Top-level party names (for quick access)
        eiser_naam: parties.claimant.name,
        gedaagde_naam: parties.defendant.name,
        
        // Complete data (no summarization)
        parties,
        court_info,
        claims_all,
        amounts_all,
        user_fields_all,
        facts_known_full,
        defenses_expected_full,
        legal_basis_full,
        timeline_full,
        analysis_full,
        communications_full,
        evidence_full,
        docs_full,
        attachments_meta,
        flags,
        style,
        writing_rules  // Anti-placeholder instructions
      };
      
      // Log payload stats
      console.log("📊 Complete payload built:");
      console.log(`  - Facts (full): ${facts_known_full.length} items`);
      console.log(`  - Defenses (full): ${defenses_expected_full.length} items`);
      console.log(`  - Legal basis (full): ${legal_basis_full.length} items`);
      console.log(`  - Evidence (full): ${evidence_full.length} items`);
      console.log(`  - Documents (chunked): ${docs_full.length} chunks from ${documents.length} files`);
      console.log(`  - Total payload size: ~${JSON.stringify(completePayload).length} chars`);

      // Call MindStudio with complete context using template's flow configuration
      const result = await aiService.runCreateDagvaarding(completePayload, flowName);

      if (!result.success) {
        throw new Error(result.error || "Failed to generate dagvaarding from MindStudio");
      }

      // Map MindStudio response to AI fields
      let aiFields: Record<string, string> = {};
      
      // If template has returnDataKeys, use dynamic mapping
      if (template?.returnDataKeys && Array.isArray(template.returnDataKeys) && template.returnDataKeys.length > 0) {
        console.log(`🔄 Using dynamic field mapping from template (${template.returnDataKeys.length} fields)`);
        
        // returnDataKeys is array of {key: "field_name_in_template", value: "path.to.mindstudio.data"}
        // The key is what goes in the template {field_name}
        // The value can be a simple key or a path like "sections.grounds.intro"
        for (const mapping of template.returnDataKeys) {
          const templateFieldKey = mapping.key; // The field name used in template like "result_analyses"
          const mindstudioPath = mapping.value || mapping.key; // Path in MindStudio response
          
          // Try to extract value from nested path (e.g., "sections.grounds.intro")
          const pathParts = mindstudioPath.split('.');
          let value: any = result;
          
          for (const part of pathParts) {
            if (value && typeof value === 'object') {
              value = value[part];
            } else {
              break;
            }
          }
          
          // Handle arrays by joining
          if (Array.isArray(value)) {
            aiFields[templateFieldKey] = value.join('\n\n');
          } else if (value !== undefined && value !== null) {
            aiFields[templateFieldKey] = String(value);
          } else {
            aiFields[templateFieldKey] = "";
            console.warn(`⚠️ Could not find value for ${templateFieldKey} at path ${mindstudioPath}`);
          }
        }
      } else {
        // Fallback to hardcoded mapping for legacy templates
        console.log("📝 Using legacy hardcoded field mapping");
        
        if (result.sections) {
          aiFields = {
            inleiding: result.sections.grounds.intro.join('\n\n'),
            overeenkomst_datum: "",
            overeenkomst_omschrijving: result.sections.grounds.assignment_and_work.join('\n\n'),
            algemene_voorwaarden_document: "",
            algemene_voorwaarden_artikelnummer_betaling: "",
            algemene_voorwaarden_betalingstermijn_dagen: "",
            algemene_voorwaarden_rente_percentage: "",
            algemene_voorwaarden_artikelnummer_incasso: "",
            onbetaald_bedrag: result.sections.grounds.invoice.join('\n\n'),
            veertiendagenbrief_datum: "",
            rente_berekening_uitleg: result.sections.grounds.interest_and_collection_costs.join('\n\n'),
            aanmaning_datum: "",
            aanmaning_verzendwijze: "",
            aanmaning_ontvangst_datum: "",
            reactie_gedaagde: result.sections.grounds.defendant_response.join('\n\n'),
            bewijsmiddel_r1: result.sections.evidence.list[0] || "",
            bewijsmiddel_r2: result.sections.evidence.list[1] || "",
            bewijsmiddel_r3: result.sections.evidence.list[2] || "",
            bewijsmiddel_r4: result.sections.evidence.list[3] || "",
            bewijsmiddel_r5: result.sections.evidence.list[4] || "",
            bewijsmiddel_overig: result.sections.evidence.offer_of_proof || "",
            getuigen: result.sections.evidence.witnesses.join(', ') || "Geen getuigen"
          };
        }
      }
      
      // Save generated summons
      const summons = await storage.createSummons({
        caseId,
        templateId: "official_model_dagvaarding",
        templateVersion: result.meta?.template_version || "v1",
        userFieldsJson: userFields,
        aiFieldsJson: aiFields,
        status: "ready"
      });
      
      await storage.createEvent({
        caseId,
        actorUserId: userId,
        type: "summons_generated",
        payloadJson: { 
          summonsId: summons.id,
          mindstudioMeta: result.meta
        },
      });
      
      console.log("✅ Dagvaarding generated successfully with CreateDagvaarding.flow");
      
      res.json({ aiFields, summonsId: summons.id });
    } catch (error) {
      console.error("Error generating summons V2:", error);
      res.status(500).json({ message: (error as Error).message || "Failed to generate summons" });
    }
  });

  // Multi-step summons generation endpoints
  // Get all sections for a summons
  app.get('/api/cases/:caseId/summons/:summonsId/sections', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, summonsId } = req.params;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const summons = await storage.getSummons(summonsId);
      if (!summons || summons.caseId !== caseId) {
        return res.status(404).json({ message: "Summons not found" });
      }
      
      const sections = await storage.getSummonsSections(summonsId);
      res.json(sections);
    } catch (error) {
      console.error("Error fetching summons sections:", error);
      res.status(500).json({ message: "Failed to fetch sections" });
    }
  });

  // Generate a specific section using MindStudio
  app.post('/api/cases/:caseId/summons/:summonsId/sections/:sectionKey/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, summonsId, sectionKey } = req.params;
      const { userFields, previousSections, userFeedback } = req.body;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const summons = await storage.getSummons(summonsId);
      if (!summons || summons.caseId !== caseId) {
        return res.status(404).json({ message: "Summons not found" });
      }
      
      // Get the section
      const section = await storage.getSummonsSectionByKey(summonsId, sectionKey);
      if (!section) {
        return res.status(404).json({ message: "Section not found" });
      }
      
      // Update section status to generating
      await storage.updateSummonsSection(section.id, {
        status: "generating"
      });
      
      // Get template for flow configuration
      const template = summons.templateId ? await storage.getTemplate(summons.templateId) : null;
      
      // Find section config in template
      const sectionsConfig = template?.sectionsConfig as any[];
      const sectionConfig = sectionsConfig?.find((s: any) => s.sectionKey === sectionKey);
      
      if (!sectionConfig || !sectionConfig.flowName) {
        return res.status(400).json({ message: "No MindStudio flow configured for this section" });
      }
      
      const flowName = sectionConfig.flowName;
      const feedbackVariableName = sectionConfig.feedbackVariableName || "user_feedback";
      
      // Get analysis and documents for context
      let analysis = await storage.getLatestAnalysis(caseId);
      const documents = await storage.getDocumentsByCase(caseId);
      
      if (!analysis) {
        return res.status(400).json({ message: "Case must be analyzed first before generating summons sections" });
      }
      
      // Enrich analysis with parsedAnalysis from rawText if needed
      analysis = enrichFullAnalysis(analysis);
      
      // Log analysis enrichment status
      console.log(`📊 Analysis enrichment status:`, {
        hasAnalysisJson: !!analysis.analysisJson,
        hasRawText: !!analysis.rawText,
        analysisJsonType: typeof analysis.analysisJson,
        analysisJsonKeys: analysis.analysisJson ? Object.keys(analysis.analysisJson) : []
      });
      
      // Get all prior approved sections to provide context
      const allSections = await storage.getSummonsSections(summonsId);
      const priorSections = allSections
        .filter(s => s.stepOrder < section.stepOrder && s.status === "approved")
        .sort((a, b) => a.stepOrder - b.stepOrder)
        .map(s => ({
          sectionKey: s.sectionKey,
          sectionName: s.sectionName,
          content: s.generatedText || ""
        }));
      
      // Parse analysis JSON to extract required fields for MindStudio
      let parsedAnalysis: any = {};
      try {
        parsedAnalysis = typeof analysis.analysisJson === 'string' 
          ? JSON.parse(analysis.analysisJson) 
          : analysis.analysisJson || {};
        
        // Log what we extracted from the analysis
        console.log(`📋 Extracted from analysis:`, {
          hasFacts: !!parsedAnalysis?.facts,
          factsKnownCount: parsedAnalysis?.facts?.known?.length || 0,
          factsDisputedCount: parsedAnalysis?.facts?.disputed?.length || 0,
          hasLegalAnalysis: !!parsedAnalysis?.legal_analysis,
          legalIssuesCount: parsedAnalysis?.legal_analysis?.legal_issues?.length || 0,
          hasProcedure: !!parsedAnalysis?.procedure,
          isKantonzaak: parsedAnalysis?.procedure?.is_kantonzaak || false
        });
      } catch (e) {
        console.error('Failed to parse analysis JSON:', e);
        parsedAnalysis = {};
      }
      
      // Extract user name from request (caseData already loaded above)
      const userName = req.user.name || req.user.email || 'Gebruiker';
      
      // Extract city values with fallback chain: database -> analysis -> null
      const eiserCity = caseData.claimantCity || parsedAnalysis?.parties?.claimant?.city || null;
      const gedaagdeCity = caseData.counterpartyCity || parsedAnalysis?.parties?.respondent?.city || parsedAnalysis?.parties?.defendant?.city || null;
      
      // Defensive validation: For jurisdiction sections, require city data
      if (sectionKey === 'JURISDICTION' && (!eiserCity || !gedaagdeCity)) {
        const missingFields = [];
        if (!eiserCity) missingFields.push('woonplaats eiser');
        if (!gedaagdeCity) missingFields.push('woonplaats gedaagde');
        
        return res.status(400).json({ 
          message: `Kan bevoegdheid niet bepalen zonder ${missingFields.join(' en ')}. Vul eerst de ontbrekende gegevens aan bij de zaakgegevens.`,
          missingFields
        });
      }
      
      // Format prior sections as readable text for MindStudio prompt
      const priorSectionsText = priorSections.map(s => 
        `=== ${s.sectionName.toUpperCase()} ===\n${s.content}`
      ).join('\n\n');
      
      // Include previous version of THIS section if regenerating
      const previousVersion = section.generatedText || null;
      const isRegeneration = section.generationCount > 0;
      
      // Build flattened input object that matches MindStudio's expected schema
      const inputData = {
        case_id: caseId,
        case_title: caseData.title,
        amount_eur: Number(caseData.claimAmount) || 0,
        parties: {
          eiser_name: caseData.claimantName || userName,
          eiser_city: eiserCity,
          gedaagde_name: caseData.counterpartyName || 'Onbekend',
          gedaagde_city: gedaagdeCity
        },
        is_kantonzaak: parsedAnalysis?.procedure?.is_kantonzaak || false,
        court_info: parsedAnalysis?.procedure?.court || null,
        facts: parsedAnalysis?.facts || null,
        legal_analysis: parsedAnalysis?.legal_analysis || null,
        prior_sections: priorSections,  // Array of objects (for structured access)
        prior_sections_text: priorSectionsText,  // Formatted string (for prompt)
        user_feedback: userFeedback || "",
        // Include previous generation of THIS section for context
        previous_version: previousVersion,
        is_regeneration: isRegeneration,
        // Include full analysis for any additional fields the flow might need
        full_analysis: parsedAnalysis
      };
      
      // Call MindStudio flow using Apps API
      const mindstudioApiKey = process.env.MINDSTUDIO_API_KEY;
      const mindstudioAppId = process.env.MS_AGENT_APP_ID;
      const useMock = process.env.USE_MINDSTUDIO_SUMMONS_MOCK === 'true';
      
      // Use feedback-specific flow if user provided feedback for DEFENSES section
      let workflowName = flowName || '';
      if (sectionKey === 'DEFENSES' && userFeedback && userFeedback.trim()) {
        workflowName = 'DV_Verweer_feedback.flow';
        console.log(`🔄 Using feedback flow: ${workflowName} (user provided feedback)`);
      }
      
      if (useMock || !mindstudioApiKey || !mindstudioAppId) {
        console.log(`🧪 [MOCK] Generating section ${section.sectionName} with workflow ${workflowName}`);
        
        const mockText = `[MOCK] Gegenereerde tekst voor sectie ${section.sectionName}.\n\nDit is een placeholder tekst die door MindStudio zou worden gegenereerd.\n\nIn productie wordt hier de echte ${workflowName} workflow aangeroepen met:\n- Case ID: ${caseId}\n- Prior sections: ${priorSections.length}\n- User feedback: ${userFeedback ? 'Ja' : 'Nee'}`;
        
        await storage.updateSummonsSection(section.id, {
          status: "draft",
          generatedText: mockText,
          generationCount: (section.generationCount || 0) + 1,
          userFeedback: userFeedback || null
        });
        
        const updatedSection = await storage.getSummonsSection(section.id);
        return res.json(updatedSection);
      }
      
      // Real MindStudio Apps API call
      console.log(`🔄 Calling MindStudio Apps API for section ${section.sectionName}`);
      console.log(`📦 App ID: ${mindstudioAppId}, Workflow: ${workflowName}`);
      console.log(`📦 Input: ${priorSections.length} prior sections, amount: €${inputData.amount_eur}, parties: ${inputData.parties.eiser_name} vs ${inputData.parties.gedaagde_name}`);
      console.log(`🏙️ Cities: Eiser=${inputData.parties.eiser_city}, Gedaagde=${inputData.parties.gedaagde_city}`);
      
      // Log regeneration context
      if (isRegeneration) {
        console.log(`🔄 REGENERATION (generation #${section.generationCount + 1})`);
        if (userFeedback) {
          console.log(`💬 User feedback: "${userFeedback.substring(0, 100)}${userFeedback.length > 100 ? '...' : ''}"`);
        }
        if (previousVersion) {
          console.log(`📄 Previous version length: ${previousVersion.length} chars`);
        }
      }
      
      // Log prior sections for debugging
      if (priorSections.length > 0) {
        console.log(`📋 Prior sections being sent:`);
        priorSections.forEach((ps, idx) => {
          console.log(`   ${idx + 1}. ${ps.sectionName} (${ps.sectionKey}): ${ps.content.substring(0, 100)}...`);
        });
      }
      
      const requestBody = {
        appId: mindstudioAppId,
        workflow: workflowName,
        variables: {
          input_json: inputData  // Send as object, not string
        }
      };
      
      // Log what we're sending to MindStudio
      console.log(`📤 Sending to MindStudio - top-level input_json keys:`, Object.keys(inputData));
      console.log(`📤 Context summary:`, JSON.stringify({
        has_previous_version: !!inputData.previous_version,
        previous_version_length: inputData.previous_version?.length || 0,
        has_user_feedback: !!inputData.user_feedback,
        user_feedback_length: inputData.user_feedback?.length || 0,
        is_regeneration: inputData.is_regeneration,
        facts_known_count: inputData.facts?.known?.length || 0,
        prior_sections_count: inputData.prior_sections?.length || 0
      }, null, 2));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes
      
      try {
        const mindstudioResponse = await fetch('https://api.mindstudio.ai/developer/v2/apps/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mindstudioApiKey}`
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!mindstudioResponse.ok) {
          const errorText = await mindstudioResponse.text();
          throw new Error(`MindStudio API error: ${mindstudioResponse.status} ${errorText}`);
        }
        
        const response = await mindstudioResponse.json();
        
        console.log(`✅ MindStudio response received for section ${section.sectionName}`);
        console.log(`🔍 Response structure:`, JSON.stringify(response, null, 2).substring(0, 500));
        console.log(`🔍 Response.result keys:`, response.result ? Object.keys(response.result) : 'NO RESULT');
        
        // Extract section data from response.result (Apps API returns result object)
        // Expected structure: { result: { jurisdiction_result/section_result/[key]_result: { section, ready, warnings, content, trace } } }
        let generatedText = '';
        let sectionResult = null;
        
        // Try multiple possible keys for the section data
        if (response.result) {
          sectionResult = response.result.section_result 
            || response.result.jurisdiction_result 
            || response.result.facts_result
            || response.result.legal_grounds_result
            || response.result.defenses_result
            || response.result.evidence_result
            || response.result.claims_result
            || response.result.exhibits_result;
          
          // If not found in a wrapper, check if response.result IS the section data directly
          if (!sectionResult && response.result.content && response.result.ready !== undefined) {
            sectionResult = response.result;
            console.log(`🔍 Found sectionResult: YES (direct in result)`);
          } else {
            console.log(`🔍 Found sectionResult:`, sectionResult ? 'YES (in wrapper)' : 'NO');
          }
        }
        
        if (sectionResult) {
          console.log(`🔍 Section result content keys:`, Object.keys(sectionResult.content || {}));
          
          // Format the content for display - combine all sub-paragraphs into one continuous text
          if (sectionResult.content) {
            const parts: string[] = [];
            const content = sectionResult.content;
            
            // Special handling for CLAIMS section (Vorderingen)
            if (content.primary_claims || content.subsidiary_claims || content.more_subsidiary_claims) {
              // Primary claims
              if (Array.isArray(content.primary_claims)) {
                content.primary_claims.forEach((claim: any) => {
                  if (claim.description) {
                    parts.push(`${claim.claim_number}. ${claim.description}`);
                  }
                });
              }
              
              // Subsidiary claims
              if (Array.isArray(content.subsidiary_claims)) {
                content.subsidiary_claims.forEach((claim: any) => {
                  if (claim.description) {
                    parts.push(`${claim.claim_number}. ${claim.description}`);
                  }
                });
              }
              
              // More subsidiary claims
              if (Array.isArray(content.more_subsidiary_claims)) {
                content.more_subsidiary_claims.forEach((claim: any) => {
                  if (claim.description) {
                    parts.push(`${claim.claim_number}. ${claim.description}`);
                  }
                });
              }
              
              // Interest
              if (content.interest?.description) {
                parts.push(content.interest.description);
              }
              
              // Extrajudicial costs
              if (content.extrajudicial_costs?.applicable && content.extrajudicial_costs?.description) {
                parts.push(content.extrajudicial_costs.description);
              }
              
              // Court costs
              if (content.court_costs?.description) {
                parts.push(content.court_costs.description);
              }
              
              // Penalty (dwangsom)
              if (content.penalty?.applicable && content.penalty?.description) {
                parts.push(content.penalty.description);
              }
              
              // Provisional enforcement
              if (content.provisional_enforcement?.applicable && content.provisional_enforcement?.description) {
                parts.push(content.provisional_enforcement.description);
              }
              
              console.log(`📝 Assembled CLAIMS section with ${parts.length} claim parts`);
            }
            
            // Special handling for DEFENSES section (Verweer en weerlegging) - CHECK FIRST before LEGAL_GROUNDS
            if (parts.length === 0 && content.defenses !== undefined) {
              if (content.introduction) {
                parts.push(content.introduction);
              }
              
              if (Array.isArray(content.defenses)) {
                content.defenses.forEach((defense: any) => {
                  if (defense.defense_claim && defense.rebuttal) {
                    parts.push(`**Verweer ${defense.defense_number}:**\n${defense.defense_claim}\n\n**Weerlegging:**\n${defense.rebuttal}`);
                  }
                });
              }
              
              if (content.conclusion) {
                parts.push(content.conclusion);
              }
              
              console.log(`📝 Assembled DEFENSES section with ${parts.length} parts (${content.defenses?.length || 0} defenses)`);
            }
            
            // Special handling for LEGAL_GROUNDS section (Juridisch kader)
            if (parts.length === 0 && (content.applicable_law || content.legal_reasoning)) {
              if (content.introduction) {
                parts.push(content.introduction);
              }
              
              if (Array.isArray(content.applicable_law)) {
                content.applicable_law.forEach((law: any) => {
                  if (law.article && law.title && law.explanation) {
                    parts.push(`**${law.article} - ${law.title}**\n${law.explanation}`);
                  }
                });
              }
              
              if (content.legal_reasoning) {
                parts.push(content.legal_reasoning);
              }
              
              if (content.conclusion) {
                parts.push(content.conclusion);
              }
              
              console.log(`📝 Assembled LEGAL_GROUNDS section with ${parts.length} parts`);
            }
            
            // Special handling for FACTS section (Feiten)
            if (parts.length === 0 && (content.introduction_facts || content.known_facts || content.narrative_paragraph)) {
              if (content.introduction_facts) {
                parts.push(content.introduction_facts);
              }
              
              if (content.narrative_paragraph) {
                parts.push(content.narrative_paragraph);
              }
              
              if (Array.isArray(content.known_facts)) {
                const factsText = content.known_facts.map((fact: string, idx: number) => `${idx + 1}. ${fact}`).join('\n');
                parts.push(factsText);
              }
              
              if (Array.isArray(content.disputed_facts) && content.disputed_facts.length > 0) {
                parts.push("**Betwiste feiten:**");
                const disputedText = content.disputed_facts.map((fact: string, idx: number) => `${idx + 1}. ${fact}`).join('\n');
                parts.push(disputedText);
              }
              
              if (Array.isArray(content.unclear_facts) && content.unclear_facts.length > 0) {
                parts.push("**Onduidelijke feiten:**");
                const unclearText = content.unclear_facts.map((fact: string, idx: number) => `${idx + 1}. ${fact}`).join('\n');
                parts.push(unclearText);
              }
              
              console.log(`📝 Assembled FACTS section with ${parts.length} parts`);
            }
            
            // For jurisdiction section with multiple sub-paragraphs
            if (parts.length === 0 && content.kanton_competence && content.kanton_competence.paragraph) {
              parts.push(content.kanton_competence.paragraph);
            }
            if (content.relative_competence && content.relative_competence.paragraph) {
              parts.push(content.relative_competence.paragraph);
            }
            if (content.conclusion_paragraph) {
              parts.push(content.conclusion_paragraph);
            }
            
            // Fallback to reasoning_paragraph if sub-paragraphs not found
            if (parts.length === 0 && content.reasoning_paragraph) {
              parts.push(content.reasoning_paragraph);
            }
            
            // Check for other common paragraph fields
            if (parts.length === 0 && content.paragraph) {
              parts.push(content.paragraph);
            }
            
            // Check for text field
            if (parts.length === 0 && content.text) {
              parts.push(content.text);
            }
            
            // Add forum clause if present
            if (content.forum_clause && content.forum_clause.text) {
              parts.push(content.forum_clause.text);
            } else if (content.forum_clause_used && content.forum_clause_text) {
              parts.push(content.forum_clause_text);
            }
            
            // Combine all parts with double newlines
            generatedText = parts.join('\n\n');
            console.log(`📝 Assembled ${parts.length} text parts into generatedText (${generatedText.length} chars)`);
            
            // Final fallback: if still no text, look for any string values in content
            if (!generatedText.trim()) {
              console.log('⚠️ No standard paragraph fields found, searching for text in content...');
              const textValues = Object.values(content).filter(v => typeof v === 'string' && v.trim().length > 10);
              if (textValues.length > 0) {
                generatedText = textValues.join('\n\n');
              } else {
                // User-friendly error message instead of JSON
                const warnings = sectionResult.warnings || [];
                generatedText = `⚠️ **Sectie kon niet worden gegenereerd**\n\nDe AI heeft onvoldoende gegevens ontvangen om deze sectie te schrijven.\n\n**Mogelijke oorzaken:**\n${warnings.length > 0 ? warnings.map(w => `- ${w}`).join('\n') : '- Ontbrekende woonplaatsgegevens\n- Ontbrekend claimbedrag\n- MindStudio flow leest verkeerde variabelen'}\n\n**Wat te doen:**\n1. Controleer of alle vereiste gegevens zijn ingevuld (woonplaats eiser en gedaagde)\n2. Controleer de MindStudio flow configuratie\n3. Neem contact op met support als het probleem blijft bestaan`;
              }
            }
          } else {
            // User-friendly error message for missing content
            const warnings = sectionResult.warnings || [];
            generatedText = `⚠️ **Sectie kon niet worden gegenereerd**\n\nDe AI-response bevat geen content.\n\n**Mogelijke oorzaken:**\n${warnings.length > 0 ? warnings.map(w => `- ${w}`).join('\n') : '- MindStudio flow retourneert lege content\n- Variabelen worden niet correct doorgegeven'}\n\n**Wat te doen:**\n1. Vul alle verplichte velden in bij de zaakgegevens\n2. Controleer de MindStudio flow configuratie`;
          }
          
          // Log warnings if any
          if (sectionResult.warnings && sectionResult.warnings.length > 0) {
            console.log(`⚠️ Warnings for section ${section.sectionName}:`, sectionResult.warnings);
          }
        } else {
          // Fallback extraction
          generatedText = response.result?.text || response.result?.output || JSON.stringify(response.result || response, null, 2);
        }
        
        // Extract warnings if any
        const warnings = sectionResult?.warnings || [];
        
        // Update section with generated text and warnings
        console.log(`💾 Saving section ${section.sectionName} with status=draft and ${generatedText.length} chars of text`);
        if (warnings.length > 0) {
          console.log(`⚠️ Saving ${warnings.length} warnings for section ${section.sectionName}`);
        }
        
        await storage.updateSummonsSection(section.id, {
          status: "draft",
          generatedText,
          generationCount: (section.generationCount || 0) + 1,
          userFeedback: userFeedback || null,
          warningsJson: warnings.length > 0 ? warnings : null
        });
        
        const updatedSection = await storage.getSummonsSection(section.id);
        console.log(`✅ Section updated and retrieved, status=${updatedSection?.status}, text length=${updatedSection?.generatedText?.length || 0}`);
        res.json(updatedSection);
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      console.error("Error generating section:", error);
      res.status(500).json({ message: (error as Error).message || "Failed to generate section" });
    }
  });

  // Approve a section
  app.post('/api/cases/:caseId/summons/:summonsId/sections/:sectionKey/approve', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, summonsId, sectionKey } = req.params;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const summons = await storage.getSummons(summonsId);
      if (!summons || summons.caseId !== caseId) {
        return res.status(404).json({ message: "Summons not found" });
      }
      
      const section = await storage.getSummonsSectionByKey(summonsId, sectionKey);
      if (!section) {
        return res.status(404).json({ message: "Section not found" });
      }
      
      // Update section status to approved
      await storage.updateSummonsSection(section.id, {
        status: "approved"
      });
      
      const updatedSection = await storage.getSummonsSection(section.id);
      res.json(updatedSection);
    } catch (error) {
      console.error("Error approving section:", error);
      res.status(500).json({ message: "Failed to approve section" });
    }
  });

  // Reject a section with feedback
  app.post('/api/cases/:caseId/summons/:summonsId/sections/:sectionKey/reject', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, summonsId, sectionKey } = req.params;
      const { feedback } = req.body;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const summons = await storage.getSummons(summonsId);
      if (!summons || summons.caseId !== caseId) {
        return res.status(404).json({ message: "Summons not found" });
      }
      
      const section = await storage.getSummonsSectionByKey(summonsId, sectionKey);
      if (!section) {
        return res.status(404).json({ message: "Section not found" });
      }
      
      // Update section status to needs_changes with feedback
      await storage.updateSummonsSection(section.id, {
        status: "needs_changes",
        userFeedback: feedback
      });
      
      const updatedSection = await storage.getSummonsSection(section.id);
      res.json(updatedSection);
    } catch (error) {
      console.error("Error rejecting section:", error);
      res.status(500).json({ message: "Failed to reject section" });
    }
  });

  // Assemble final dagvaarding when all sections are approved
  app.post('/api/cases/:caseId/summons/:summonsId/assemble', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, summonsId } = req.params;
      const { userFields } = req.body;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const summons = await storage.getSummons(summonsId);
      if (!summons || summons.caseId !== caseId) {
        return res.status(404).json({ message: "Summons not found" });
      }
      
      // Get all sections
      const sections = await storage.getSummonsSections(summonsId);
      
      // Check if all sections are approved
      const allApproved = sections.every(s => s.status === "approved");
      if (!allApproved) {
        return res.status(400).json({ message: "Not all sections are approved yet" });
      }
      
      // Get template
      const template = summons.templateId ? await storage.getTemplate(summons.templateId) : null;
      if (!template || !template.rawTemplateText) {
        return res.status(400).json({ message: "Template not found" });
      }
      
      // Build AI fields from approved sections
      const aiFields: any = {};
      sections.forEach(section => {
        const sectionConfig = (template.sectionsConfig as any[])?.find((s: any) => s.sectionKey === section.sectionKey);
        const aiFieldKey = sectionConfig?.aiFieldKey || section.sectionKey;
        aiFields[aiFieldKey] = section.generatedText || '';
      });
      
      // Replace fields in template text
      let finalText = template.rawTemplateText;
      
      // Replace user fields
      Object.entries(userFields || {}).forEach(([key, value]) => {
        const regex = new RegExp(`\\[${key}\\]`, 'g');
        finalText = finalText.replace(regex, value as string || '');
      });
      
      // Replace AI fields
      Object.entries(aiFields).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}[^}]*\\}`, 'g');
        finalText = finalText.replace(regex, value as string || '');
      });
      
      // Update summons with final assembled text
      await storage.updateSummons(summonsId, {
        userFieldsJson: userFields,
        aiFieldsJson: aiFields,
        markdown: finalText,
        status: "ready"
      });
      
      await storage.createEvent({
        caseId,
        actorUserId: userId,
        type: "summons_assembled",
        payloadJson: { summonsId },
      });
      
      const updatedSummons = await storage.getSummons(summonsId);
      res.json(updatedSummons);
    } catch (error) {
      console.error("Error assembling summons:", error);
      res.status(500).json({ message: "Failed to assemble summons" });
    }
  });

  // MindStudio flow execution for dagvaarding sections
  app.post('/api/mindstudio/run-flow', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { flowName, caseId } = req.body;
      
      if (!flowName) {
        return res.status(400).json({ message: "flowName is required" });
      }
      
      if (!caseId) {
        return res.status(400).json({ message: "caseId is required" });
      }
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get case analysis for context
      const analysis = await storage.getLatestAnalysis(caseId);
      
      // Prepare variables for MindStudio
      const variables: any = {
        case_id: caseId,
        case_title: caseData.title,
        case_description: caseData.description || "",
        case_overview: analysis?.analysisJson || {},
      };
      
      console.log(`🚀 Running MindStudio flow: ${flowName} for case: ${caseId}`);
      
      // Check for API configuration
      if (!process.env.MINDSTUDIO_WORKER_ID || !process.env.MINDSTUDIO_API_KEY) {
        console.warn("⚠️ MindStudio configuration missing, returning mock response");
        
        // Return mock response for development
        return res.json({
          summary: `[MOCK] Dit is een test samenvatting voor ${flowName}. De flow zou hier de inhoud van deze sectie genereren op basis van de case data.`,
          user_feedback: [
            {
              question: "[MOCK] Zijn er aanvullende feiten die u wilt toevoegen?",
              answer: ""
            },
            {
              question: "[MOCK] Zijn er specifieke details die belangrijk zijn voor deze sectie?",
              answer: ""
            }
          ]
        });
      }
      
      const requestBody = {
        workerId: process.env.MINDSTUDIO_WORKER_ID,
        variables,
        workflow: flowName,
        includeBillingCost: true
      };
      
      console.log("📤 MindStudio request:", JSON.stringify(requestBody, null, 2));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes
      
      const response = await fetch('https://v1.mindstudio-api.com/developer/v2/agents/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ MindStudio API error:", response.status, errorText);
        throw new Error(`MindStudio API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("📥 MindStudio response:", JSON.stringify(data, null, 2));
      
      // Parse response from MindStudio
      let flowResponse;
      
      // Try to find the response in various possible locations
      const possibleVarNames = ['summary', 'output', 'result', 'section_data', 'response'];
      
      // First try output.results
      if (data.output?.results) {
        for (const varName of possibleVarNames) {
          if (data.output.results[varName]) {
            const rawValue = data.output.results[varName].value || data.output.results[varName];
            try {
              flowResponse = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
              console.log(`✅ Found ${varName} in output.results`);
              break;
            } catch (e) {
              console.log(`⚠️ Failed to parse ${varName}:`, e);
            }
          }
        }
      }
      
      // If not in output.results, try thread.variables
      if (!flowResponse && data.thread?.variables) {
        for (const varName of possibleVarNames) {
          if (data.thread.variables[varName]) {
            const rawValue = data.thread.variables[varName].value || data.thread.variables[varName];
            try {
              flowResponse = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
              console.log(`✅ Found ${varName} in thread.variables`);
              break;
            } catch (e) {
              console.log(`⚠️ Failed to parse ${varName}:`, e);
            }
          }
        }
      }
      
      if (!flowResponse) {
        console.error("❌ No flow response found in MindStudio output");
        return res.status(500).json({ 
          message: "MindStudio flow completed but returned no parseable response",
          summary: "",
          user_feedback: []
        });
      }
      
      // Ensure response has required fields
      const response_data = {
        summary: flowResponse.summary || flowResponse.text || "",
        user_feedback: flowResponse.user_feedback || flowResponse.questions || []
      };
      
      console.log("✅ Processed flow response:", response_data);
      res.json(response_data);
      
    } catch (error) {
      console.error("Error running MindStudio flow:", error);
      res.status(500).json({ message: "Failed to run MindStudio flow" });
    }
  });

  // Mock integration routes
  app.post('/api/integrations/bailiff/serve', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.body;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Order bailiff service
      const result = await mockIntegrations.orderBailiffService(caseId);
      
      // Update case status
      await caseService.updateCaseStatus(
        caseId,
        "BAILIFF_ORDERED",
        "Betekening voltooid",
        "Wacht op betekening"
      );
      
      // Create event
      await storage.createEvent({
        caseId,
        actorUserId: userId,
        type: "bailiff_ordered",
        payloadJson: result,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error ordering bailiff service:", error);
      res.status(500).json({ message: "Failed to order bailiff service" });
    }
  });

  app.post('/api/integrations/bailiff/callback', async (req, res) => {
    try {
      const { caseId, status } = req.body;
      
      if (status === "served") {
        const caseData = await caseService.getCaseById(caseId);
        if (caseData) {
          await caseService.updateCaseStatus(
            caseId,
            "SERVED",
            "Rechtbank",
            "Dossier aanbrengen bij rechtbank"
          );
          
          await storage.createEvent({
            caseId,
            actorUserId: caseData.ownerUserId,
            type: "documents_served",
            payloadJson: { servedAt: new Date() },
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error processing bailiff callback:", error);
      res.status(500).json({ message: "Failed to process callback" });
    }
  });

  app.post('/api/integrations/court/file', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.body;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Mock court filing
      const result = await mockIntegrations.fileWithCourt(caseId);
      
      // Update case status
      await caseService.updateCaseStatus(
        caseId,
        "FILED",
        "Procedure gestart",
        "Start procedure"
      );
      
      // Create event
      await storage.createEvent({
        caseId,
        actorUserId: userId,
        type: "case_filed",
        payloadJson: result,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error filing with court:", error);
      res.status(500).json({ message: "Failed to file with court" });
    }
  });

  app.post('/api/cases/:id/proceedings/start', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Update case status
      await caseService.updateCaseStatus(
        caseId,
        "PROCEEDINGS_ONGOING",
        "Vervolg procedure",
        "Upload vonnis"
      );
      
      // Create event
      await storage.createEvent({
        caseId,
        actorUserId: userId,
        type: "proceedings_started",
        payloadJson: { startedAt: new Date() },
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error starting proceedings:", error);
      res.status(500).json({ message: "Failed to start proceedings" });
    }
  });

  // Timeline route
  app.get('/api/timeline/:caseId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.caseId;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const timeline = await storage.getCaseTimeline(caseId);
      res.json(timeline);
    } catch (error) {
      console.error("Error fetching timeline:", error);
      res.status(500).json({ message: "Failed to fetch timeline" });
    }
  });

  // Template routes (admin only)
  app.get('/api/templates', isAuthenticated, async (req: any, res) => {
    try {
      const kind = req.query.kind as string;
      const templates = await storage.getTemplates(kind);
      
      // Debug: Check if rawTemplateText is present
      if (templates.length > 0) {
        console.log(`📋 Templates API: Returning ${templates.length} templates`);
        const firstTemplate = templates[0];
        console.log(`   First template keys: ${Object.keys(firstTemplate).join(', ')}`);
        console.log(`   Has rawTemplateText: ${!!firstTemplate.rawTemplateText}, length: ${firstTemplate.rawTemplateText?.length || 0}`);
      }
      
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get('/api/templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const templateId = req.params.id;
      const template = await storage.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post('/api/templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const templateData = req.body;
      const template = await storage.createTemplate(templateData);
      res.json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  // Seed default templates (one-time setup or admin utility)
  app.post('/api/templates/seed', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const templateV2Body = `📄 TEMPLATE – DAGVAARDING KANTONRECHTER

(zonder aanzegging, met vaste teksten en invulvelden)

DAGVAARDING

Datum: [USER_FIELD: datum opmaak]

1. Partijen

Eiser(es):
Naam: [USER_FIELD: naam eiser]
Adres: [USER_FIELD: adres eiser]
Postcode en woonplaats: [USER_FIELD: woonplaats eiser]
Geboortedatum / KvK-nummer (indien van toepassing): [USER_FIELD: geboortedatum of KvK]
Eventueel vertegenwoordigd door: [USER_FIELD: gemachtigde / advocaat / deurwaarder]

tegen

Gedaagde:
Naam: [USER_FIELD: naam gedaagde]
Adres: [USER_FIELD: adres gedaagde]
Postcode en woonplaats: [USER_FIELD: woonplaats gedaagde]
Geboortedatum / KvK-nummer (indien van toepassing): [USER_FIELD: geboortedatum of KvK]

2. Oproep

Aan: [USER_FIELD: naam gedaagde]

U wordt hierbij opgeroepen om te verschijnen ter terechtzitting van de Rechtbank [USER_FIELD: rechtbanknaam], sector kanton, locatie [USER_FIELD: plaats rechtbank],
op [USER_FIELD: datum zitting] om [USER_FIELD: tijdstip] uur.

De zitting zal plaatsvinden in de openbare terechtzitting van de kantonrechter in bovengenoemde rechtbank.

3. Inleiding

Deze dagvaarding heeft betrekking op een geschil tussen eiser(es) en gedaagde met betrekking tot:
[AI_FIELD: korte omschrijving van het geschil in één alinea (zoals: niet-geleverde keuken, huurachterstand, arbeidsgeschil, etc.)]

4. Feiten

Eiser(es) legt aan deze vordering de volgende feiten ten grondslag:

[AI_FIELD: chronologisch feitenrelaas — per feit één genummerde alinea, in neutrale stijl.
Bijvoorbeeld:

Op [datum] hebben partijen een overeenkomst gesloten betreffende [...].

Eiser(es) heeft aan haar verplichtingen voldaan door [...].

Gedaagde is ondanks herhaalde aanmaningen in gebreke gebleven met [...].

De schade die hierdoor is ontstaan bedraagt [...].
]

5. De vordering (Eis)

Eiser(es) vordert dat de kantonrechter bij vonnis, uitvoerbaar bij voorraad, gedaagde veroordeelt tot het volgende:

[AI_FIELD: hoofdeis – bijvoorbeeld betaling van een bedrag van € ... wegens ...]

[AI_FIELD: nevenvordering – wettelijke rente vanaf datum ... tot volledige betaling]

[AI_FIELD: vergoeding van buitengerechtelijke incassokosten of schadeposten]

[AI_FIELD: veroordeling van gedaagde in de proceskosten]

Teneinde te horen veroordelen overeenkomstig bovenstaande vorderingen.

6. Gronden van de vordering (Motivering)

Eiser(es) grondt deze vorderingen op het volgende:

[AI_FIELD: juridische motivering, verwijzingen naar relevante wetsartikelen en beginselen.
Bijvoorbeeld: "De vordering is gebaseerd op artikel 6:74 BW (wanprestatie). Gedaagde is tekortgeschoten in de nakoming van de overeenkomst doordat..."
]

7. Bewijs en producties

Ter onderbouwing van deze vorderingen verwijst eiser(es) naar de volgende producties:

Nr.     Omschrijving productie  Door wie ingebracht
1       [USER_FIELD: naam bestand / document]   Eiser(es)
2       [USER_FIELD: naam bestand / document]   Eiser(es)
3       [AI_FIELD: eventueel aanvullend bewijs of verwijzing naar stukken uit feitenrelaas]     AI

Eiser(es) biedt, voor zover vereist, aan het gestelde te bewijzen met alle middelen rechtens, in het bijzonder door overlegging van bovengenoemde producties en het horen van partijen en getuigen.

8. Reactie van gedaagde (informatie voor leken)

(Deze tekst blijft altijd staan, is wettelijk voorgeschreven in lekenprocedures.)

U kunt schriftelijk of mondeling reageren op deze dagvaarding.

Als u het eens bent met de vordering, hoeft u niets te doen; de rechter kan de vordering dan toewijzen.

Als u het niet eens bent, kunt u verweer voeren tijdens of vóór de zitting.

Verschijnt u niet, dan kan de rechter uitspraak doen zonder uw reactie ("verstek").

Heeft u vragen over de procedure, kijk dan op www.rechtspraak.nl
 of neem contact op met de griffie van de rechtbank.

9. Proceskosten

Eiser(es) verzoekt de kantonrechter om gedaagde te veroordelen in de kosten van de procedure, waaronder begrepen het griffierecht en de kosten van betekening.

10. Slot en ondertekening

Aldus opgemaakt en ondertekend te [USER_FIELD: plaats opmaak], op [USER_FIELD: datum].

[USER_FIELD: Naam gemachtigde of eiser]
[USER_FIELD: Adres gemachtigde / kantooradres]
[USER_FIELD: Handtekening (digitaal of fysiek)]

11. Bijlagen`;

      // Create template v2
      const templateV2 = await storage.createTemplate({
        kind: "summons",
        name: "Dagvaarding Kantonrechter (met vaste teksten)",
        version: "v2",
        bodyMarkdown: templateV2Body,
        fieldsJson: {
          user_fields: [
            "datum opmaak",
            "naam eiser",
            "adres eiser",
            "woonplaats eiser",
            "geboortedatum of KvK",
            "gemachtigde / advocaat / deurwaarder",
            "naam gedaagde",
            "adres gedaagde",
            "woonplaats gedaagde",
            "rechtbanknaam",
            "plaats rechtbank",
            "datum zitting",
            "tijdstip",
            "naam bestand / document",
            "plaats opmaak",
            "Naam gemachtigde of eiser",
            "Adres gemachtigde / kantooradres",
            "Handtekening (digitaal of fysiek)"
          ],
          ai_fields: [
            "korte omschrijving van het geschil",
            "chronologisch feitenrelaas",
            "hoofdeis",
            "nevenvordering",
            "vergoeding kosten",
            "proceskosten",
            "juridische motivering",
            "aanvullend bewijs"
          ]
        },
        isActive: true
      });

      res.json({ success: true, template: templateV2 });
    } catch (error) {
      console.error("Error seeding templates:", error);
      res.status(500).json({ message: "Failed to seed templates" });
    }
  });

  // Parse and register new template from text or file
  app.post('/api/templates/parse', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      let templateText = '';
      
      // Extract text from file or request body
      if (req.file) {
        // File upload
        templateText = await extractTextFromFile(req.file.buffer, req.file.mimetype);
      } else if (req.body.text) {
        // Direct text input
        templateText = req.body.text;
      } else {
        return res.status(400).json({ message: "No template text or file provided" });
      }
      
      // Parse template
      const parsed = parseTemplateText(templateText);
      
      // Validate parsed template
      const validation = validateParsedTemplate(parsed);
      if (!validation.valid) {
        return res.status(400).json({ 
          message: "Template validation failed", 
          errors: validation.errors 
        });
      }
      
      // Create template record
      const templateData = {
        kind: req.body.kind || 'summons',
        name: req.body.name || 'Untitled Template',
        version: req.body.version || 'v1',
        bodyMarkdown: templateText,
        rawTemplateText: templateText,
        userFieldsJson: parsed.userFields.map(f => ({ key: f.key, occurrences: f.occurrences })),
        aiFieldsJson: parsed.aiFields.map(f => ({ key: f.key, occurrences: f.occurrences })),
        fieldOccurrences: parsed.fieldOccurrences,
        isActive: true,
      };
      
      const template = await storage.createTemplate(templateData);
      
      res.json({
        success: true,
        template,
        parsed: {
          totalUserFields: parsed.totalUserFields,
          totalAiFields: parsed.totalAiFields,
          userFields: parsed.userFields,
          aiFields: parsed.aiFields,
        }
      });
    } catch (error) {
      console.error("Error parsing template:", error);
      res.status(500).json({ 
        message: "Failed to parse template",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update MindStudio flow linking for a template
  app.patch('/api/templates/:id/flow', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const templateId = req.params.id;
      const { mindstudioFlowName, mindstudioFlowId, launchVariables, returnDataKeys, sectionsConfig } = req.body;
      
      // Validate input
      if (!mindstudioFlowName && !mindstudioFlowId && !launchVariables && !returnDataKeys && !sectionsConfig) {
        return res.status(400).json({ message: "No flow data provided" });
      }
      
      // Validate flow name is not empty if provided
      if (mindstudioFlowName !== undefined && typeof mindstudioFlowName === 'string' && mindstudioFlowName.trim() === '') {
        return res.status(400).json({ message: "MindStudio flow name cannot be empty" });
      }
      
      // Update template
      const updates: any = {};
      if (mindstudioFlowName !== undefined) updates.mindstudioFlowName = mindstudioFlowName.trim();
      if (mindstudioFlowId !== undefined) updates.mindstudioFlowId = mindstudioFlowId;
      if (launchVariables !== undefined) updates.launchVariables = launchVariables;
      if (returnDataKeys !== undefined) updates.returnDataKeys = returnDataKeys;
      if (sectionsConfig !== undefined) updates.sectionsConfig = sectionsConfig;
      updates.updatedAt = new Date();
      
      const template = await storage.updateTemplate(templateId, updates);
      
      res.json({
        success: true,
        template
      });
    } catch (error) {
      console.error("Error updating template flow:", error);
      res.status(500).json({ 
        message: "Failed to update template flow",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Delete template
  app.delete('/api/templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const templateId = req.params.id;
      
      // Check if template exists
      const template = await storage.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      // Delete template
      await storage.deleteTemplate(templateId);
      
      res.json({
        success: true,
        message: "Template deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ 
        message: "Failed to delete template",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // File download routes
  app.get('/api/files/*', isAuthenticated, async (req: any, res) => {
    try {
      // Extract the full path after /api/files/
      const storageKey = req.params[0];
      
      const fileStream = await fileService.getFile(storageKey);
      
      if (!fileStream) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Set proper content type for PDFs
      if (storageKey.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
      }
      
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Document download route by ID (for MindStudio access)
  // Accept both /api/documents/:id/download and /api/documents/:id/download/:filename
  app.get('/api/documents/:id/download/:filename?', async (req: any, res) => {
    try {
      const documentId = req.params.id;
      const requestedFilename = req.params.filename;
      console.log(`📥 Download request for document: ${documentId}${requestedFilename ? ` (${requestedFilename})` : ''}`);
      
      // Get document from database
      const document = await storage.getDocument(documentId);
      if (!document) {
        console.error(`❌ Document not found: ${documentId}`);
        return res.status(404).json({ message: "Document not found" });
      }
      
      console.log(`✅ Found document: ${document.filename} (${document.mimetype})`);
      
      // Get file stream using storage key
      const fileStream = await fileService.getFile(document.storageKey);
      if (!fileStream) {
        console.error(`❌ File not found in storage: ${document.storageKey}`);
        return res.status(404).json({ message: "File not found in storage" });
      }
      
      console.log(`✅ Streaming file: ${document.filename}`);
      
      // Set appropriate headers for MindStudio (public download)
      res.setHeader('Content-Type', document.mimetype || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      
      fileStream.pipe(res);
    } catch (error) {
      console.error("❌ Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  // Case export route
  app.get('/api/cases/:id/export', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const zipBuffer = await fileService.exportCaseArchive(caseId);
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=zaak_${caseId}.zip`);
      res.send(zipBuffer);
    } catch (error) {
      console.error("Error exporting case:", error);
      res.status(500).json({ message: "Failed to export case" });
    }
  });

  // Mindstudio callback endpoint (no auth needed - external service)
  app.post('/api/mindstudio/callback', async (req, res) => {
    try {
      const payload = req.body;
      console.log('Mindstudio callback received:', JSON.stringify(payload, null, 2));
      
      // Extract threadId and final output
      const threadId = payload.threadId || payload.thread?.id;
      if (!threadId) {
        console.error('No threadId in Mindstudio callback');
        return res.status(400).json({ error: 'No threadId provided' });
      }
      
      // Extract output text from various possible structures
      let outputText = '';
      let billingCost = '';
      
      // Check for direct result field (your Mindstudio Agent uses this)
      if (payload.result) {
        outputText = payload.result;
      } else if (payload.output) {
        outputText = payload.output;
      } else if (payload.messages) {
        // Find latest assistant message
        const messages = Array.isArray(payload.messages) ? payload.messages : [payload.messages];
        const assistantMessage = messages.reverse().find((msg: any) => 
          msg.role === 'assistant' || msg.type === 'assistant'
        );
        outputText = assistantMessage?.content || assistantMessage?.text || '';
      } else if (payload.thread?.messages) {
        const messages = payload.thread.messages;
        const assistantMessage = messages.reverse().find((msg: any) => 
          msg.role === 'assistant' || msg.type === 'assistant'
        );
        outputText = assistantMessage?.content || assistantMessage?.text || '';
      }
      
      if (payload.billingCost) {
        billingCost = payload.billingCost.toString();
      }
      
      // Store result in memory for polling
      AIService.storeThreadResult(threadId, {
        status: 'done',
        outputText,
        raw: payload,
        billingCost
      });
      
      // Also save to database if we can find the case
      try {
        // Find case by threadId (need to extend schema or use other method)
        // For now, we'll process the Mindstudio output and save it
        const processedResult = AIService.mindstudioToAppResult(outputText);
        
        // You might need to store threadId->caseId mapping to save this properly
        console.log('Processed Mindstudio result:', JSON.stringify(processedResult, null, 2));
        
        // TODO: Save to database when we have caseId mapping
      } catch (error) {
        console.error('Error processing Mindstudio result:', error);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error in Mindstudio callback:', error);
      res.status(500).json({ error: 'Callback processing failed' });
    }
  });

  // Mindstudio polling endpoint
  app.get('/api/mindstudio/result', isAuthenticated, async (req, res) => {
    try {
      const threadId = req.query.threadId as string;
      if (!threadId) {
        return res.status(400).json({ error: 'ThreadId required' });
      }
      
      const result = AIService.getThreadResult(threadId);
      
      // If we have a completed result, also process it for the frontend
      if (result.status === 'done' && result.outputText) {
        const processedResult = AIService.mindstudioToAppResult(result.outputText);
        return res.json({
          ...result,
          processedResult,
          billingCost: result.billingCost
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error getting thread result:', error);
      res.status(500).json({ error: 'Failed to get result' });
    }
  });

  // Case analysis endpoint
  app.get('/api/cases/:id/analysis', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get the latest analysis
      const analysis = await storage.getLatestAnalysis(caseId);
      if (!analysis) {
        return res.status(404).json({ message: "No analysis found" });
      }
      
      // Check if we have a finished thread result
      const threadId = (caseData as any).threadId; // Assume we store threadId on case
      if (threadId) {
        const threadResult = AIService.getThreadResult(threadId);
        if (threadResult.status === 'done' && threadResult.outputText) {
          const appResult = AIService.mindstudioToAppResult(threadResult.outputText);
          appResult.billingCost = threadResult.billingCost;
          return res.json(appResult);
        } else if (threadResult.status === 'running') {
          return res.json({ status: 'pending' });
        }
      }
      
      // Try to parse raw_text for newer analysis format first
      let parsedAnalysis = null;
      if (analysis.rawText) {
        try {
          const rawData = JSON.parse(analysis.rawText);
          if (rawData.result?.analysis_json || rawData.analysis_json) {
            parsedAnalysis = rawData.result?.analysis_json || rawData.analysis_json;
          }
        } catch (error) {
          console.log('Could not parse raw_text for newer format:', error);
        }
      }
      
      // If we have parsed analysis with new format, use it
      if (parsedAnalysis) {
        console.log('📊 Analysis API: Returning parsed analysis with case_overview:', !!parsedAnalysis.case_overview);
        console.log('   Parties:', parsedAnalysis.case_overview?.parties?.length || 0);
        const result = {
          // Include new summary structure
          summary: parsedAnalysis.summary || undefined,
          case_overview: parsedAnalysis.case_overview || undefined,
          questions_to_answer: parsedAnalysis.questions_to_answer || [],
          facts: parsedAnalysis.facts || undefined,
          evidence: parsedAnalysis.evidence || undefined,
          missing_info_for_assessment: parsedAnalysis.missing_info_for_assessment || [],
          per_document: parsedAnalysis.per_document || [],
          legal_analysis: parsedAnalysis.legal_analysis || undefined,
          
          // Legacy format for backward compatibility
          factsJson: Array.isArray(analysis.factsJson) ? 
            analysis.factsJson.map((fact: any, idx: number) => ({ 
              label: `Feit ${idx + 1}`, 
              detail: typeof fact === 'string' ? fact : fact.detail || fact.label || fact 
            })) : [],
          issuesJson: Array.isArray(analysis.issuesJson) ? 
            analysis.issuesJson.map((issue: any) => ({ 
              issue: typeof issue === 'string' ? issue : issue.issue || issue.label || issue,
              risk: typeof issue === 'object' ? issue.risk : undefined
            })) : [],
          legalBasisJson: Array.isArray(analysis.legalBasisJson) ? 
            analysis.legalBasisJson.map((basis: any) => ({ 
              law: typeof basis === 'string' ? basis : basis.law || basis.label || basis,
              article: typeof basis === 'object' ? basis.article : undefined,
              note: typeof basis === 'object' ? basis.note : undefined
            })) : [],
          missingDocuments: Array.isArray(analysis.missingDocsJson) ? analysis.missingDocsJson : []
        };
        return res.json(result);
      }
      
      // Fallback to existing analysis structure for old data
      const result = {
        factsJson: Array.isArray(analysis.factsJson) ? 
          analysis.factsJson.map((fact: any, idx: number) => ({ 
            label: `Feit ${idx + 1}`, 
            detail: typeof fact === 'string' ? fact : fact.detail || fact.label || fact 
          })) : [],
        issuesJson: Array.isArray(analysis.issuesJson) ? 
          analysis.issuesJson.map((issue: any) => ({ 
            issue: typeof issue === 'string' ? issue : issue.issue || issue.label || issue,
            risk: typeof issue === 'object' ? issue.risk : undefined
          })) : [],
        legalBasisJson: Array.isArray(analysis.legalBasisJson) ? 
          analysis.legalBasisJson.map((basis: any) => ({ 
            law: typeof basis === 'string' ? basis : basis.law || basis.label || basis,
            article: typeof basis === 'object' ? basis.article : undefined,
            note: typeof basis === 'object' ? basis.note : undefined
          })) : [],
        missingDocuments: Array.isArray(analysis.missingDocsJson) ? analysis.missingDocsJson : []
      };
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching case analysis:', error);
      res.status(500).json({ message: 'Failed to fetch analysis' });
    }
  });

  // Get all analyses for a case (used for jurisprudence references)
  app.get('/api/cases/:id/analyses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const analyses = await storage.getAnalysesByCase(caseId);
      res.json(analyses);
    } catch (error) {
      console.error('Error fetching case analyses:', error);
      res.status(500).json({ message: 'Failed to fetch analyses' });
    }
  });

  // Get saved readiness data for a case
  app.get('/api/cases/:caseId/readiness', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.params;
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Find summons record with readiness data
      const existingSummons = await storage.getSummonsByCase(caseId);
      const summonsRecord = existingSummons.find(s => s.readinessJson);
      
      if (!summonsRecord || !summonsRecord.readinessJson) {
        return res.json({ 
          hasReadinessData: false,
          readinessResult: null,
          userResponses: null
        });
      }
      
      console.log("📋 Retrieved readiness data for case:", caseId);
      
      res.json({
        hasReadinessData: true,
        readinessResult: summonsRecord.readinessJson,
        userResponses: summonsRecord.userResponsesJson || null
      });
      
    } catch (error) {
      console.error('Error fetching readiness data:', error);
      res.status(500).json({ 
        message: 'Failed to fetch readiness data',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Auto-save user responses (PATCH endpoint)
  app.patch('/api/cases/:caseId/readiness', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.params;
      const { userResponses, readinessResult } = req.body;
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Find or create summons record
      const existingSummons = await storage.getSummonsByCase(caseId);
      let summonsRecord = existingSummons.find(s => s.templateId === "official_model_dagvaarding" || s.status === "draft");
      
      if (!summonsRecord) {
        summonsRecord = await storage.createSummons({
          caseId,
          templateId: "official_model_dagvaarding",
          status: "draft",
          readinessJson: readinessResult,
          userResponsesJson: userResponses
        });
        console.log("💾 Auto-save: Created draft summons:", summonsRecord.id);
      } else {
        await storage.updateSummons(summonsRecord.id, {
          readinessJson: readinessResult,
          userResponsesJson: userResponses
        });
        console.log("💾 Auto-save: Updated summons user responses:", summonsRecord.id);
      }
      
      res.json({ success: true });
      
    } catch (error) {
      console.error('Error auto-saving user responses:', error);
      res.status(500).json({ 
        message: 'Failed to auto-save user responses',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Check case readiness with DV_Questions.flow
  app.post('/api/mindstudio/run-questions-flow', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ message: "caseId is required" });
      }
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get analysis data
      const analysis = await storage.getLatestAnalysis(caseId);
      let parsedAnalysis = null;
      
      if (analysis?.rawText) {
        try {
          const rawData = JSON.parse(analysis.rawText);
          parsedAnalysis = rawData.result?.analysis_json || rawData.analysis_json;
          
          // Try to find analysis_json in thread posts
          if (!parsedAnalysis && rawData.thread?.posts) {
            for (const post of rawData.thread.posts) {
              if (post.debugLog?.newState?.variables?.analysis_json?.value) {
                const value = post.debugLog.newState.variables.analysis_json.value;
                parsedAnalysis = typeof value === 'string' ? JSON.parse(value) : value;
                break;
              }
            }
          }
        } catch (error) {
          console.log('Could not parse analysis:', error);
        }
      }
      
      // Determine case type from legal issues
      const legalIssues = parsedAnalysis?.legal_analysis?.legal_issues || [];
      let caseType = "geldvordering";
      let legalDomain = "algemeen";
      
      if (legalIssues.length > 0) {
        const firstIssue = legalIssues[0];
        legalDomain = typeof firstIssue === 'string' 
          ? firstIssue 
          : (firstIssue.issue || firstIssue.area || firstIssue.category || firstIssue.description || "algemeen");
        
        if (legalDomain.toLowerCase().includes('arbeid') || legalDomain.toLowerCase().includes('employment')) {
          caseType = "arbeidsrecht";
        } else if (legalDomain.toLowerCase().includes('huur') || legalDomain.toLowerCase().includes('lease') || legalDomain.toLowerCase().includes('tenancy')) {
          caseType = "huur";
        } else if (legalDomain.toLowerCase().includes('consument') || legalDomain.toLowerCase().includes('consumer')) {
          caseType = "consument";
        }
      }
      
      // Calculate completeness indicators
      const factsKnown = parsedAnalysis?.facts?.known || [];
      const factsUnclear = parsedAnalysis?.facts?.unclear || [];
      const factsComplete = factsKnown.length > 0 && factsUnclear.length === 0;
      
      const evidenceProvided = parsedAnalysis?.evidence?.provided || [];
      const evidenceMissing = parsedAnalysis?.evidence?.missing || [];
      const evidenceComplete = evidenceProvided.length > 0 && evidenceMissing.length === 0;
      
      const legalBasis = parsedAnalysis?.legal_analysis?.legal_basis || [];
      const hasLegalBasis = legalBasis.length > 0;
      
      const risks = parsedAnalysis?.legal_analysis?.risks || [];
      let riskLevel = "low";
      if (risks.length >= 4) riskLevel = "high";
      else if (risks.length >= 2) riskLevel = "medium";
      
      const missingInfo = parsedAnalysis?.missing_info_for_assessment || [];
      
      // Get party names
      const partiesArray = Array.isArray(parsedAnalysis?.case_overview?.parties) 
        ? parsedAnalysis.case_overview.parties 
        : [];
      const claimant = partiesArray.find((p: any) => p.role === 'claimant') || {};
      const defendant = partiesArray.find((p: any) => p.role === 'respondent' || p.role === 'defendant') || {};
      
      // Build input_case_details - platte samenvatting van feiten en claims
      const knownFacts = factsKnown.map((f: any) => 
        typeof f === 'string' ? f : (f.detail || f.label || String(f))
      );
      const claimsSummary = parsedAnalysis?.summary?.claims_brief || caseData.description || "";
      const inputCaseDetails = [
        ...knownFacts,
        claimsSummary
      ].filter(Boolean).join("\n");
      
      // Get user role from case (default to EISER if not set)
      const userRole = caseData.userRole || "EISER";
      const perspectiveText = userRole === "EISER" 
        ? "De gebruiker is de EISER (eisende partij/claimant). Stel vragen en analyseer de zaak vanuit het perspectief van degene die een vordering wil instellen."
        : "De gebruiker is de GEDAAGDE (verwerende partij/defendant). Stel vragen en analyseer de zaak vanuit het perspectief van degene die zich moet verdedigen.";
      
      // Build variables for DV_Questions.flow
      const variables = {
        case_type: caseType,
        legal_domain: legalDomain,
        facts_complete: factsComplete,
        facts_unclear_count: factsUnclear.length,
        missing_info_count: missingInfo.length,
        evidence_complete: evidenceComplete,
        evidence_provided: evidenceProvided.map((ev: any) => ev.doc_name || ev.source || 'Document').slice(0, 10),
        evidence_missing: evidenceMissing.slice(0, 10),
        has_legal_basis: hasLegalBasis,
        legal_basis_count: legalBasis.length,
        risk_level: riskLevel,
        claim_amount: parseFloat(caseData.claimAmount || "0"),
        claims_summary: parsedAnalysis?.summary?.claims_brief || caseData.description || "",
        claimant_name: claimant.name || caseData.title?.split(' vs ')[0] || "Eiser",
        defendant_name: defendant.name || caseData.counterpartyName || "Gedaagde",
        has_full_analysis: !!parsedAnalysis,
        input_case_details: inputCaseDetails,
        // CRITICAL: User role and perspective for correct question context
        user_role: userRole,
        user_perspective: perspectiveText
      };
      
      console.log(`🔍 Running DV_Questions.flow for case: ${caseId}`);
      console.log("📊 Calculated variables:", JSON.stringify(variables, null, 2));
      
      // Check for API configuration
      if (!process.env.MINDSTUDIO_WORKER_ID || !process.env.MINDSTUDIO_API_KEY) {
        console.warn("⚠️ MindStudio configuration missing, returning mock readiness response");
        
        // Mock response based on completeness
        const isReady = factsComplete && evidenceComplete && hasLegalBasis;
        
        return res.json({
          ready_for_summons: isReady,
          next_flow: isReady ? "DV_Complete.flow" : `DV_${caseType}_Questions.flow`,
          dv_missing_items: isReady ? [] : [
            ...(!factsComplete ? [`${factsUnclear.length} onduidelijke feiten`] : []),
            ...(!evidenceComplete ? evidenceMissing.slice(0, 3) : []),
            ...(!hasLegalBasis ? ["Juridische grondslag ontbreekt"] : [])
          ],
          dv_claim_options: [
            { claim: "Hoofdvordering schadevergoeding", amount: variables.claim_amount, feasibility: "hoog" }
          ],
          dv_evidence_plan: {
            required: evidenceMissing.slice(0, 3),
            preferred: ["Schriftelijke overeenkomst", "Correspondentie"]
          },
          dv_clarifying_questions: isReady ? [] : [
            { question: "Kunt u de onduidelijke feiten nader toelichten?", field: "facts_clarification" },
            { question: "Welke vorderingen wilt u precies instellen?", field: "claims_specification" }
          ],
          dv_question_text: "Welke vorderingen wilt u instellen in de dagvaarding?"
        });
      }
      
      // Call MindStudio DV_Questions.flow
      // MindStudio v2 API: Wrap all variables in webhookParams object
      // Normalize user_role to lowercase for MindStudio compatibility
      const normalizedUserRole = userRole.toLowerCase(); // "EISER" → "eiser", "GEDAAGDE" → "gedaagde"
      
      // DV_Questions.flow is now On-demand (API), so send variables directly (no webhookParams wrapper)
      const requestBody = {
        workerId: process.env.MINDSTUDIO_WORKER_ID,
        workflow: 'DV_Questions.flow',
        variables: {
          ...variables,
          user_role: normalizedUserRole,
          user_perspective: normalizedUserRole, // "eiser" or "gedaagde"
          // Add limit fields for MindStudio flow control
          max_questions: 6,
          max_missing_items: 6,
          max_claim_options: 5,
          max_evidence_per_claim: 4
        }
      };
      
      console.log("📤 MindStudio DV_Questions.flow request");
      console.log("📊 Sending variables:", JSON.stringify(requestBody.variables, null, 2));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000); // 3 minutes
      
      const response = await fetch('https://v1.mindstudio-api.com/developer/v2/agents/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MINDSTUDIO_API_KEY}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ MindStudio API error:", response.status, errorText);
        throw new Error(`MindStudio API error: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log("✅ DV_Questions.flow response received:", {
        threadId: data.threadId,
        hasResult: !!data.result,
        hasThread: !!data.thread,
        postsCount: data.thread?.posts?.length || 0
      });
      
      // Parse the response - NEW: Use data.result directly (MindStudio API v2 format)
      let readinessResult = {
        ready_for_summons: false,
        next_flow: "DV_Complete.flow",
        dv_missing_items: [] as any[],
        dv_claim_options: [] as any[],
        dv_evidence_plan: [] as any[],
        dv_clarifying_questions: [] as any[],
        dv_question_text: ""
      };
      
      // MindStudio returns data in data.result (not in thread.posts variables)
      if (data.result) {
        console.log("✅ Found result object with keys:", Object.keys(data.result));
        
        // Extract all dv_* variables from result
        if (data.result.ready_for_summons !== undefined) {
          readinessResult.ready_for_summons = data.result.ready_for_summons === true || data.result.ready_for_summons === 'true';
          console.log("  ✓ ready_for_summons:", readinessResult.ready_for_summons);
        }
        if (data.result.next_flow) {
          readinessResult.next_flow = data.result.next_flow;
          console.log("  ✓ next_flow:", readinessResult.next_flow);
        }
        if (data.result.dv_missing_items) {
          readinessResult.dv_missing_items = Array.isArray(data.result.dv_missing_items) 
            ? data.result.dv_missing_items.filter((item: any) => item && Object.keys(item).length > 0)
            : [];
          console.log("  ✓ dv_missing_items:", readinessResult.dv_missing_items.length, "items");
        }
        if (data.result.dv_claim_options) {
          readinessResult.dv_claim_options = Array.isArray(data.result.dv_claim_options)
            ? data.result.dv_claim_options.filter((item: any) => item && Object.keys(item).length > 0)
            : [];
          console.log("  ✓ dv_claim_options:", readinessResult.dv_claim_options.length, "options (filtered)");
        }
        if (data.result.dv_evidence_plan) {
          readinessResult.dv_evidence_plan = Array.isArray(data.result.dv_evidence_plan)
            ? data.result.dv_evidence_plan.filter((item: any) => item && Object.keys(item).length > 0)
            : [];
          console.log("  ✓ dv_evidence_plan:", readinessResult.dv_evidence_plan.length, "plans (filtered)");
        }
        if (data.result.dv_clarifying_questions) {
          readinessResult.dv_clarifying_questions = Array.isArray(data.result.dv_clarifying_questions)
            ? data.result.dv_clarifying_questions.filter((item: any) => item && Object.keys(item).length > 0)
            : [];
          console.log("  ✓ dv_clarifying_questions:", readinessResult.dv_clarifying_questions.length, "questions (filtered)");
        }
        if (data.result.dv_question_text) {
          readinessResult.dv_question_text = data.result.dv_question_text;
          console.log("  ✓ dv_question_text:", readinessResult.dv_question_text.substring(0, 60) + "...");
        }
      } else {
        console.log("⚠️ No result object found in MindStudio response");
      }
      
      console.log("📋 Readiness check result:", {
        ready: readinessResult.ready_for_summons,
        nextFlow: readinessResult.next_flow,
        missingItemsCount: readinessResult.dv_missing_items.length,
        questionsCount: readinessResult.dv_clarifying_questions.length
      });
      
      // Save readiness data to summons record for persistence
      // First find or create a draft summons for this case
      const existingSummons = await storage.getSummonsByCase(caseId);
      let summonsRecord = existingSummons.find(s => s.templateId === "official_model_dagvaarding" || s.status === "draft");
      
      if (!summonsRecord) {
        // Create a draft summons record to store readiness data
        summonsRecord = await storage.createSummons({
          caseId,
          templateId: "official_model_dagvaarding",
          status: "draft",
          readinessJson: readinessResult,
          userResponsesJson: {}
        });
        console.log("📝 Created draft summons record for readiness data:", summonsRecord.id);
      } else {
        // Update existing summons with readiness data
        await storage.updateSummons(summonsRecord.id, {
          readinessJson: readinessResult
        });
        console.log("📝 Updated summons record with readiness data:", summonsRecord.id);
      }
      
      res.json(readinessResult);
      
    } catch (error) {
      console.error('Error running DV_Questions.flow:', error);
      res.status(500).json({ 
        message: 'Failed to check case readiness',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Submit user responses and re-run DV_Questions.flow
  app.post('/api/mindstudio/submit-user-responses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { 
        caseId, 
        missingItemResponses, 
        questionResponses, 
        // Legacy support (deprecated)
        questionAnswers, 
        questionDontKnow, 
        selectedClaims 
      } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ message: "caseId is required" });
      }
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      console.log(`📤 User submitted responses for case: ${caseId}`);
      console.log("User responses:", { 
        missingItems: Object.keys(missingItemResponses || {}).length,
        questionResponses: Object.keys(questionResponses || {}).length,
        legacyQuestions: Object.keys(questionAnswers || {}).length,
        claims: selectedClaims?.length || 0
      });
      
      // Get analysis data (same logic as run-questions-flow)
      const analysis = await storage.getLatestAnalysis(caseId);
      let parsedAnalysis = null;
      
      if (analysis?.rawText) {
        try {
          const rawData = JSON.parse(analysis.rawText);
          parsedAnalysis = rawData.result?.analysis_json || rawData.analysis_json;
          
          if (!parsedAnalysis && rawData.thread?.posts) {
            for (const post of rawData.thread.posts) {
              if (post.debugLog?.newState?.variables?.analysis_json?.value) {
                const value = post.debugLog.newState.variables.analysis_json.value;
                parsedAnalysis = typeof value === 'string' ? JSON.parse(value) : value;
                break;
              }
            }
          }
        } catch (error) {
          console.log('Could not parse analysis:', error);
        }
      }
      
      // Same calculations as run-questions-flow
      const legalIssues = parsedAnalysis?.legal_analysis?.legal_issues || [];
      let caseType = "geldvordering";
      let legalDomain = "algemeen";
      
      if (legalIssues.length > 0) {
        const firstIssue = legalIssues[0];
        legalDomain = typeof firstIssue === 'string' 
          ? firstIssue 
          : (firstIssue.issue || firstIssue.area || firstIssue.category || firstIssue.description || "algemeen");
        
        if (legalDomain.toLowerCase().includes('arbeid') || legalDomain.toLowerCase().includes('employment')) {
          caseType = "arbeidsrecht";
        } else if (legalDomain.toLowerCase().includes('huur') || legalDomain.toLowerCase().includes('lease') || legalDomain.toLowerCase().includes('tenancy')) {
          caseType = "huur";
        } else if (legalDomain.toLowerCase().includes('consument') || legalDomain.toLowerCase().includes('consumer')) {
          caseType = "consument";
        }
      }
      
      const factsKnown = parsedAnalysis?.facts?.known || [];
      const factsUnclear = parsedAnalysis?.facts?.unclear || [];
      const factsComplete = factsKnown.length > 0 && factsUnclear.length === 0;
      
      const evidenceProvided = parsedAnalysis?.evidence?.provided || [];
      const evidenceMissing = parsedAnalysis?.evidence?.missing || [];
      const evidenceComplete = evidenceProvided.length > 0 && evidenceMissing.length === 0;
      
      const legalBasis = parsedAnalysis?.legal_analysis?.legal_basis || [];
      const hasLegalBasis = legalBasis.length > 0;
      
      const risks = parsedAnalysis?.legal_analysis?.risks || [];
      let riskLevel = "low";
      if (risks.length >= 4) riskLevel = "high";
      else if (risks.length >= 2) riskLevel = "medium";
      
      const missingInfo = parsedAnalysis?.missing_info_for_assessment || [];
      
      const partiesArray = Array.isArray(parsedAnalysis?.case_overview?.parties) 
        ? parsedAnalysis.case_overview.parties 
        : [];
      const claimant = partiesArray.find((p: any) => p.role === 'claimant') || {};
      const defendant = partiesArray.find((p: any) => p.role === 'respondent' || p.role === 'defendant') || {};
      
      const knownFacts = factsKnown.map((f: any) => 
        typeof f === 'string' ? f : (f.detail || f.label || String(f))
      );
      const claimsSummary = parsedAnalysis?.summary?.claims_brief || caseData.description || "";
      const inputCaseDetails = [
        ...knownFacts,
        claimsSummary
      ].filter(Boolean).join("\n");
      
      // Get user role from case (default to EISER if not set)
      const userRole = caseData.userRole || "EISER";
      const perspectiveText = userRole === "EISER" 
        ? "De gebruiker is de EISER (eisende partij/claimant). Stel vragen en analyseer de zaak vanuit het perspectief van degene die een vordering wil instellen."
        : "De gebruiker is de GEDAAGDE (verwerende partij/defendant). Stel vragen en analyseer de zaak vanuit het perspectief van degene die zich moet verdedigen.";
      
      // Build base variables
      const variables: any = {
        case_type: caseType,
        legal_domain: legalDomain,
        facts_complete: factsComplete,
        facts_unclear_count: factsUnclear.length,
        missing_info_count: missingInfo.length,
        evidence_complete: evidenceComplete,
        evidence_provided: evidenceProvided.map((ev: any) => ev.doc_name || ev.source || 'Document').slice(0, 10),
        evidence_missing: evidenceMissing.slice(0, 10),
        has_legal_basis: hasLegalBasis,
        legal_basis_count: legalBasis.length,
        risk_level: riskLevel,
        claim_amount: parseFloat(caseData.claimAmount || "0"),
        claims_summary: parsedAnalysis?.summary?.claims_brief || caseData.description || "",
        claimant_name: claimant.name || caseData.title?.split(' vs ')[0] || "Eiser",
        defendant_name: defendant.name || caseData.counterpartyName || "Gedaagde",
        has_full_analysis: !!parsedAnalysis,
        input_case_details: inputCaseDetails,
        // CRITICAL: User role and perspective for correct question context
        user_role: userRole,
        user_perspective: perspectiveText
      };
      
      // Build user_answers object (matching MindStudio field names from DV_Questions.flow output)
      const user_answers: Record<string, string> = {};
      
      // NEW: Handle questionResponses (with text + upload + dontKnow)
      if (questionResponses && Object.keys(questionResponses).length > 0) {
        Object.entries(questionResponses).forEach(([idx, response]: [string, any]) => {
          if (response.dontKnow) {
            user_answers[`question_${idx}`] = "Weet ik niet";
          } else if (response.textAnswer) {
            user_answers[`question_${idx}`] = String(response.textAnswer);
          } else if (response.uploadedDocId) {
            user_answers[`question_${idx}`] = `Bijgevoegd (doc: ${response.uploadedDocId})`;
          }
        });
      }
      
      // LEGACY: Handle old questionAnswers/questionDontKnow (backwards compatibility)
      if (questionAnswers && Object.keys(questionAnswers).length > 0) {
        Object.entries(questionAnswers).forEach(([key, value]) => {
          if (!user_answers[key]) { // Don't override new format
            user_answers[key] = String(value);
          }
        });
      }
      if (questionDontKnow && Object.keys(questionDontKnow).length > 0) {
        Object.entries(questionDontKnow).forEach(([key, isDontKnow]) => {
          if (isDontKnow && !user_answers[key]) {
            user_answers[key] = "Weet ik niet";
          }
        });
      }
      
      // Handle missing item responses (with text + upload + dontHave)
      if (missingItemResponses && Object.keys(missingItemResponses).length > 0) {
        Object.entries(missingItemResponses).forEach(([idx, response]: [string, any]) => {
          if (response.dontHave) {
            user_answers[`missing_${idx}`] = "Heb ik niet";
          } else if (response.textAnswer) {
            user_answers[`missing_${idx}`] = String(response.textAnswer);
          } else if (response.uploadedDocId) {
            user_answers[`missing_${idx}`] = `Bijgevoegd (doc: ${response.uploadedDocId})`;
          }
        });
      }
      
      // Add selected claims
      if (selectedClaims && selectedClaims.length > 0) {
        user_answers.selected_claims = selectedClaims.join(',');
      }
      
      console.log("📊 User answers for rerun:", JSON.stringify(user_answers, null, 2));
      
      // Check for API configuration
      if (!process.env.MINDSTUDIO_WORKER_ID || !process.env.MINDSTUDIO_API_KEY) {
        console.warn("⚠️ MindStudio configuration missing, returning mock response");
        
        // After user submission, assume ready (mock mode)
        return res.json({
          ready_for_summons: true,
          next_flow: "DV_Complete.flow",
          dv_missing_items: [],
          dv_claim_options: [],
          dv_evidence_plan: [],
          dv_clarifying_questions: [],
          dv_question_text: ""
        });
      }
      
      // Call MindStudio DV_Questions.flow with user responses
      // DV_Questions.flow is now On-demand (API), so send variables directly (no webhookParams wrapper)
      const normalizedUserRole = userRole.toLowerCase(); // "EISER" → "eiser", "GEDAAGDE" → "gedaagde"
      
      const requestBody = {
        workerId: process.env.MINDSTUDIO_WORKER_ID,
        workflow: 'DV_Questions.flow',
        variables: {
          ...variables,  // Spread all base variables
          user_role: normalizedUserRole,
          user_perspective: normalizedUserRole, // "eiser" or "gedaagde"
          user_answers,  // Add user responses for rerun
          rerun_count: 1,  // Track iteration count
          last_snapshot_hash: "user_input_v1",  // Version tracking
          // Add limit fields for MindStudio flow control
          max_questions: 6,
          max_missing_items: 6,
          max_claim_options: 5,
          max_evidence_per_claim: 4
        }
      };
      
      console.log("📤 MindStudio DV_Questions.flow request (with user responses)");
      console.log("📊 Sending variables:", JSON.stringify(requestBody.variables, null, 2));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000);
      
      const response = await fetch('https://v1.mindstudio-api.com/developer/v2/agents/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MINDSTUDIO_API_KEY}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ MindStudio API error:", response.status, errorText);
        throw new Error(`MindStudio API error: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log("✅ DV_Questions.flow response received (after user input)");
      
      // Parse response (same logic as run-questions-flow)
      let readinessResult = {
        ready_for_summons: false,
        next_flow: "DV_Complete.flow",
        dv_missing_items: [] as any[],
        dv_claim_options: [] as any[],
        dv_evidence_plan: [] as any[],
        dv_clarifying_questions: [] as any[],
        dv_question_text: ""
      };
      
      if (data.result) {
        if (data.result.ready_for_summons !== undefined) {
          readinessResult.ready_for_summons = data.result.ready_for_summons === true || data.result.ready_for_summons === 'true';
        }
        if (data.result.next_flow) {
          readinessResult.next_flow = data.result.next_flow;
        }
        if (data.result.dv_missing_items) {
          readinessResult.dv_missing_items = Array.isArray(data.result.dv_missing_items) 
            ? data.result.dv_missing_items.filter((item: any) => item && Object.keys(item).length > 0)
            : [];
        }
        if (data.result.dv_claim_options) {
          readinessResult.dv_claim_options = Array.isArray(data.result.dv_claim_options)
            ? data.result.dv_claim_options.filter((item: any) => item && Object.keys(item).length > 0)
            : [];
        }
        if (data.result.dv_evidence_plan) {
          readinessResult.dv_evidence_plan = Array.isArray(data.result.dv_evidence_plan)
            ? data.result.dv_evidence_plan.filter((item: any) => item && Object.keys(item).length > 0)
            : [];
        }
        if (data.result.dv_clarifying_questions) {
          readinessResult.dv_clarifying_questions = Array.isArray(data.result.dv_clarifying_questions)
            ? data.result.dv_clarifying_questions.filter((item: any) => item && Object.keys(item).length > 0)
            : [];
        }
        if (data.result.dv_question_text) {
          readinessResult.dv_question_text = data.result.dv_question_text;
        }
      }
      
      console.log("📋 Readiness after user input:", {
        ready: readinessResult.ready_for_summons,
        nextFlow: readinessResult.next_flow,
        stillMissingCount: readinessResult.dv_missing_items.length,
        stillQuestionsCount: readinessResult.dv_clarifying_questions.length
      });
      
      // Save updated readiness data AND user responses to summons record
      const existingSummons = await storage.getSummonsByCase(caseId);
      let summonsRecord = existingSummons.find(s => s.templateId === "official_model_dagvaarding" || s.status === "draft");
      
      const userResponsesData = {
        missingItemResponses,
        questionResponses,
        selectedClaims
      };
      
      if (!summonsRecord) {
        summonsRecord = await storage.createSummons({
          caseId,
          templateId: "official_model_dagvaarding",
          status: "draft",
          readinessJson: readinessResult,
          userResponsesJson: userResponsesData
        });
        console.log("📝 Created draft summons with user responses:", summonsRecord.id);
      } else {
        await storage.updateSummons(summonsRecord.id, {
          readinessJson: readinessResult,
          userResponsesJson: userResponsesData
        });
        console.log("📝 Updated summons with readiness data and user responses:", summonsRecord.id);
      }
      
      res.json(readinessResult);
      
    } catch (error) {
      console.error('Error submitting user responses:', error);
      res.status(500).json({ 
        message: 'Failed to process user responses',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Run complete MindStudio flow with case snapshot
  app.post('/api/mindstudio/run-complete-flow', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, flowName } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ message: "caseId is required" });
      }
      
      // Verify case ownership
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get analysis data
      const analysis = await storage.getLatestAnalysis(caseId);
      let parsedAnalysis = null;
      
      if (analysis?.rawText) {
        try {
          const rawData = JSON.parse(analysis.rawText);
          parsedAnalysis = rawData.result?.analysis_json || rawData.analysis_json;
        } catch (error) {
          console.log('Could not parse analysis:', error);
        }
      }
      
      // Get documents
      const documents = await storage.getDocumentsByCase(caseId);
      
      // Build case_snapshot (same logic as build-case-snapshot endpoint)
      const partiesArray = Array.isArray(parsedAnalysis?.case_overview?.parties) 
        ? parsedAnalysis.case_overview.parties 
        : [];
      const claimant = partiesArray.find((p: any) => p.role === 'claimant') || {};
      const defendant = partiesArray.find((p: any) => p.role === 'respondent' || p.role === 'defendant') || {};
      
      const legalIssues = parsedAnalysis?.legal_analysis?.legal_issues || [];
      let caseType = "geldvordering";
      let domainHint = "monetary_claim";
      
      if (legalIssues.some((i: string) => i.toLowerCase().includes('arbeid') || i.toLowerCase().includes('employment'))) {
        caseType = "arbeidsrecht";
        domainHint = "employment";
      } else if (legalIssues.some((i: string) => i.toLowerCase().includes('huur') || i.toLowerCase().includes('lease') || i.toLowerCase().includes('tenancy'))) {
        caseType = "huur";
        domainHint = "tenancy";
      } else if (legalIssues.some((i: string) => i.toLowerCase().includes('consument') || i.toLowerCase().includes('consumer'))) {
        caseType = "consumentenzaken";
        domainHint = "consumer_sale";
      }
      
      const caseSnapshot = {
        meta: {
          case_id: caseId,
          snapshot_version: "1.0",
          created_at: new Date().toISOString(),
          locale: "nl-NL",
          user_role: "claimant"
        },
        routing: {
          case_type: caseType,
          domain_hint: domainHint,
          is_kantonzaak: parsedAnalysis?.case_overview?.is_kantonzaak || false,
          court_info: {}
        },
        parties: {
          eiser: {
            name: claimant.name || caseData.title?.split(' vs ')[0] || "Eiser",
            type: claimant.type || "individual"
          },
          gedaagde: {
            name: defendant.name || caseData.counterpartyName || "Gedaagde",
            type: defendant.type || caseData.counterpartyType || "individual"
          }
        },
        facts: {
          known: parsedAnalysis?.facts?.known || [],
          disputed: parsedAnalysis?.facts?.disputed || [],
          unclear: parsedAnalysis?.facts?.unclear || []
        },
        claims_candidate: [{
          label: "Hoofdvordering",
          basis: parsedAnalysis?.summary?.legal_brief || caseData.description || "",
          amount: parseFloat(caseData.claimAmount || "0"),
          notes: parsedAnalysis?.summary?.claims_brief || ""
        }],
        defenses_expected: parsedAnalysis?.legal_analysis?.potential_defenses || [],
        evidence: {
          have: (parsedAnalysis?.evidence?.provided || []).map((ev: any, idx: number) => ({
            id: `ev-${idx}`,
            type: ev.source || "document",
            title: ev.doc_name || `Bewijs ${idx + 1}`,
            summary: (ev.key_passages || []).join('; ')
          })),
          missing: parsedAnalysis?.evidence?.missing || []
        }
      };
      
      console.log(`🚀 Running complete MindStudio flow: ${flowName || 'DV_Complete.flow'} for case: ${caseId}`);
      
      // Check for API configuration
      if (!process.env.MINDSTUDIO_WORKER_ID || !process.env.MINDSTUDIO_API_KEY) {
        console.warn("⚠️ MindStudio configuration missing, returning mock response");
        
        // Return mock response with all 7 sections
        return res.json({
          feiten: {
            summary: `[MOCK] Samenvatting Feiten: ${parsedAnalysis?.facts?.known?.slice(0, 2).join('; ') || 'Geen feiten beschikbaar'}`,
            user_feedback: [{ question: "Zijn er aanvullende feiten?", answer: "" }]
          },
          verweer: {
            summary: `[MOCK] Verweer: ${parsedAnalysis?.legal_analysis?.potential_defenses?.slice(0, 1).join('; ') || 'Geen verweer beschikbaar'}`,
            user_feedback: [{ question: "Wat is het verweer van gedaagde?", answer: "" }]
          },
          verloop: {
            summary: `[MOCK] Verloop van het geschil: Casus gestart op ${caseData.createdAt ? new Date(caseData.createdAt).toLocaleDateString('nl-NL') : 'onbekend'}`,
            user_feedback: [{ question: "Zijn er verdere ontwikkelingen?", answer: "" }]
          },
          rechtsgronden: {
            summary: `[MOCK] Rechtsgronden: ${parsedAnalysis?.legal_analysis?.legal_basis?.map((b: any) => `${b.law} ${b.article}`).join(', ') || 'BW'}`,
            user_feedback: [{ question: "Zijn er aanvullende wetsartikelen?", answer: "" }]
          },
          vorderingen: {
            summary: `[MOCK] Vorderingen: Hoofdvordering €${caseData.claimAmount || '0'}`,
            user_feedback: [{ question: "Zijn er nevenvorderingen?", answer: "" }]
          },
          slot: {
            summary: `[MOCK] Slot: Eiser vordert toewijzing van de vorderingen`,
            user_feedback: [{ question: "Aanvullende slotopmerkingen?", answer: "" }]
          },
          producties: {
            summary: `[MOCK] Producties: ${documents.length} documenten als bewijs`,
            user_feedback: [{ question: "Ontbreken er bewijsstukken?", answer: "" }]
          }
        });
      }
      
      // CRITICAL: For dagvaarding (summons), user MUST always be EISER (claimant)
      // This ensures MindStudio generates the summons from the correct perspective
      const userRole = "EISER";
      const normalizedUserRole = "eiser"; // Lowercase for MindStudio compatibility
      
      // Call MindStudio with case_snapshot wrapped in webhookParams
      const requestBody = {
        workerId: process.env.MINDSTUDIO_WORKER_ID,
        variables: { 
          webhookParams: {
            case_snapshot: caseSnapshot,
            // CRITICAL: User role and perspective for dagvaarding context
            user_role: normalizedUserRole,
            user_perspective: normalizedUserRole // "eiser"
          }
        },
        workflow: flowName || 'DV_Complete.flow',
        includeBillingCost: true
      };
      
      console.log("📤 MindStudio complete flow request to:", flowName || 'DV_Complete.flow');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes
      
      const response = await fetch('https://v1.mindstudio-api.com/developer/v2/agents/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ MindStudio API error:", response.status, errorText);
        throw new Error(`MindStudio API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("📥 MindStudio complete flow response received");
      
      // Parse response - expect all 7 sections in one response
      let flowResponse;
      
      // Try to find the response in various possible locations
      const possibleVarNames = ['all_sections', 'sections', 'dagvaarding_sections', 'output', 'result'];
      
      // First try output.results
      if (data.output?.results) {
        for (const varName of possibleVarNames) {
          if (data.output.results[varName]) {
            const rawValue = data.output.results[varName].value || data.output.results[varName];
            try {
              flowResponse = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
              console.log(`✅ Found ${varName} in output.results`);
              break;
            } catch (e) {
              console.log(`⚠️ Failed to parse ${varName}:`, e);
            }
          }
        }
      }
      
      // If not in output.results, try thread.variables
      if (!flowResponse && data.thread?.variables) {
        for (const varName of possibleVarNames) {
          if (data.thread.variables[varName]) {
            const rawValue = data.thread.variables[varName].value || data.thread.variables[varName];
            try {
              flowResponse = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
              console.log(`✅ Found ${varName} in thread.variables`);
              break;
            } catch (e) {
              console.log(`⚠️ Failed to parse ${varName}:`, e);
            }
          }
        }
      }
      
      if (!flowResponse) {
        console.error("❌ No flow response found in MindStudio output");
        throw new Error("No valid response from MindStudio flow");
      }
      
      res.json(flowResponse);
    } catch (error) {
      console.error('Error running complete flow:', error);
      res.status(500).json({ message: 'Failed to run complete flow' });
    }
  });

  // Build case snapshot for complete summons generation
  app.get('/api/cases/:id/build-case-snapshot', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Get case data
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData || caseData.ownerUserId !== ensureUuid(userId)) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get analysis data
      const analysis = await storage.getLatestAnalysis(caseId);
      let parsedAnalysis = null;
      
      if (analysis?.rawText) {
        try {
          const rawData = JSON.parse(analysis.rawText);
          parsedAnalysis = rawData.result?.analysis_json || rawData.analysis_json;
        } catch (error) {
          console.log('Could not parse analysis:', error);
        }
      }
      
      // Get documents
      const documents = await storage.getDocumentsByCase(caseId);
      
      // Build case_snapshot according to schema
      const partiesArray = Array.isArray(parsedAnalysis?.case_overview?.parties) 
        ? parsedAnalysis.case_overview.parties 
        : [];
      const claimant = partiesArray.find((p: any) => p.role === 'claimant') || {};
      const defendant = partiesArray.find((p: any) => p.role === 'respondent' || p.role === 'defendant') || {};
      
      // Determine case type and domain
      const legalIssues = parsedAnalysis?.legal_analysis?.legal_issues || [];
      let caseType = "geldvordering";
      let domainHint = "monetary_claim";
      
      if (legalIssues.some((i: string) => i.toLowerCase().includes('arbeid') || i.toLowerCase().includes('employment'))) {
        caseType = "arbeidsrecht";
        domainHint = "employment";
      } else if (legalIssues.some((i: string) => i.toLowerCase().includes('huur') || i.toLowerCase().includes('lease') || i.toLowerCase().includes('tenancy'))) {
        caseType = "huur";
        domainHint = "tenancy";
      } else if (legalIssues.some((i: string) => i.toLowerCase().includes('consument') || i.toLowerCase().includes('consumer'))) {
        caseType = "consumentenzaken";
        domainHint = "consumer_sale";
      }
      
      const caseSnapshot = {
        case_snapshot: {
          meta: {
            case_id: caseId,
            snapshot_version: "1.0",
            created_at: new Date().toISOString(),
            locale: "nl-NL",
            user_role: "claimant"
          },
          routing: {
            case_type: caseType,
            domain_hint: domainHint,
            is_kantonzaak: parsedAnalysis?.case_overview?.is_kantonzaak || false,
            court_info: {}
          },
          parties: {
            eiser: {
              name: claimant.name || caseData.title?.split(' vs ')[0] || "Eiser",
              type: claimant.type || "individual",
              email: caseData.counterpartyEmail || "",
              phone: caseData.counterpartyPhone || "",
              address: caseData.counterpartyAddress || ""
            },
            gedaagde: {
              name: defendant.name || caseData.counterpartyName || "Gedaagde",
              type: defendant.type || caseData.counterpartyType || "individual",
              email: caseData.counterpartyEmail || "",
              phone: caseData.counterpartyPhone || "",
              address: caseData.counterpartyAddress || ""
            },
            relatie: partiesArray.find((p: any) => p.relationship)?.relationship || "onbekend"
          },
          facts: {
            known: parsedAnalysis?.facts?.known || [],
            disputed: parsedAnalysis?.facts?.disputed || [],
            unclear: parsedAnalysis?.facts?.unclear || []
          },
          claims_candidate: [{
            label: "Hoofdvordering",
            basis: parsedAnalysis?.summary?.legal_brief || caseData.description || "",
            amount: parseFloat(caseData.claimAmount || "0"),
            notes: parsedAnalysis?.summary?.claims_brief || ""
          }],
          defenses_expected: parsedAnalysis?.legal_analysis?.potential_defenses || [],
          evidence: {
            have: (parsedAnalysis?.evidence?.provided || []).map((ev: any, idx: number) => ({
              id: `ev-${idx}`,
              type: ev.source || "document",
              title: ev.doc_name || `Bewijs ${idx + 1}`,
              summary: (ev.key_passages || []).join('; '),
              source: "Analyse",
              url_or_ref: ev.doc_url || ""
            })),
            missing: parsedAnalysis?.evidence?.missing || []
          },
          timeline: [],
          constraints: {
            amounts: {
              claim_total: parseFloat(caseData.claimAmount || "0")
            },
            deadlines: {},
            jurisdiction_notes: parsedAnalysis?.case_overview?.is_kantonzaak 
              ? "Kantonzaak - bedrag onder €25.000" 
              : "Rechtbankzaak"
          },
          user_answers_history: (parsedAnalysis?.missing_info_answers || []).map((ans: any) => ({
            q: ans.question || "",
            a: ans.answer || ""
          })),
          attachments_ref: documents.map((doc: any, idx: number) => ({
            id: doc.id || `doc-${idx}`,
            type: doc.mimetype || "application/pdf",
            url_or_ref: `/api/documents/${doc.id}/download`,
            ocr_text_excerpt: doc.extractedText?.substring(0, 200) || ""
          })),
          privacy: {
            pii_level: "med",
            anonymized: false
          },
          ui_state: {
            template_target: "dagvaarding",
            previous_outputs_ref: ""
          },
          router_hint: {
            confidence: 0.8,
            why: `Gebaseerd op ${legalIssues.length} juridische kwesties en claim van €${caseData.claimAmount}`
          },
          needs_clarification: (parsedAnalysis?.questions_to_answer || []).length > 0,
          clarification_questions: (parsedAnalysis?.questions_to_answer || []).slice(0, 5)
        }
      };
      
      console.log('📋 Case snapshot built successfully');
      res.json(caseSnapshot);
    } catch (error) {
      console.error('Error building case snapshot:', error);
      res.status(500).json({ message: 'Failed to build case snapshot' });
    }
  });

  // Pinecone vector endpoints
  const { 
    upsertVectors, 
    searchVectors, 
    searchDualNamespaces, 
    checkIndexExists,
    searchLegislationWithRerank,
    groupResultsByLaw,
    expandLawContext,
    rerankDocuments
  } = await import('./pineconeService');

  // Generate AI-powered jurisprudence search query from legal advice
  app.post('/api/pinecone/generate-query', async (req, res) => {
    try {
      const { caseId } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is required' });
      }

      // Fetch case data from Supabase
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // Fetch latest legal advice from Supabase
      const latestAdvice = await legalAdviceService.getLatestCompletedAdvice(caseId);
      
      if (!latestAdvice) {
        return res.status(404).json({ error: 'No legal advice found for this case' });
      }
      
      console.log(`📋 Found legal advice from Supabase: ${latestAdvice.id}`);

      // Helper to normalize Supabase fields (arrays/objects) to text
      const normalizeField = (field: any): string => {
        if (!field) return '';
        if (typeof field === 'string') return field;
        if (Array.isArray(field)) {
          return field.map(item => typeof item === 'object' ? (item.text || item.beschrijving || JSON.stringify(item)) : String(item)).join('\n');
        }
        if (typeof field === 'object') {
          // Extract common text fields from objects
          if (field.text) return field.text;
          if (field.beschrijving) return field.beschrijving;
          return Object.values(field).filter(v => typeof v === 'string').join('\n') || JSON.stringify(field);
        }
        return String(field);
      };

      // Build comprehensive context for AI with normalized fields
      const adviceText = [
        latestAdvice.het_geschil || '',
        normalizeField(latestAdvice.de_feiten),
        normalizeField(latestAdvice.juridische_duiding),
        normalizeField(latestAdvice.vervolgstappen),
        latestAdvice.samenvatting_advies || ''
      ].filter(Boolean).join('\n\n');

      if (!adviceText.trim()) {
        return res.status(400).json({ error: 'Legal advice is empty' });
      }

      // Generate search query using OpenAI
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      console.log('🤖 Generating jurisprudence search query using AI...');
      console.log(`📄 Legal advice length: ${adviceText.length} chars`);

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert assistant specialized in Dutch civil law and jurisprudence retrieval.

Your job is to:
1. Analyze the complete legal advice (juridisch advies) provided by the user
2. Identify:
   - Key disputed issues (geschilpunten)
   - Legal questions and bottlenecks (juridische knelpunten)
   - Elements that require jurisprudential support
   - Relevant legal norms and statutory articles that might be interpreted by case law
3. Determine the procedural role of the user (eiser or gedaagde) and generate search queries that SUPPORT that party's position
4. Generate a highly accurate search query for a Pinecone vector database containing:
   - AI summaries of Dutch civil judgments
   - Metadata: ECLI, court, court_level, legal_area, decision_date, procedure_type, URL
5. You do NOT have access to the full judgment text; you assume only AI-generated summaries are available to the retrieval system
6. Your goal is to find similar cases or relevant jurisprudence where:
   - Similar disputes were evaluated
   - The court interpreted relevant statutory articles in a way that supports the user's position
   - Factual patterns match and could strengthen the user's argument
   - Legal reasoning could be cited to increase the user's chance of success

SEARCH QUERY guidelines:
- **CRITICAL**: Tailor the search to the user's procedural role:
  * If EISER (claimant): Find cases where similar claims were GRANTED or UPHELD
  * If GEDAAGDE (defendant): Find cases where similar claims were REJECTED or DISMISSED
- Retrieve jurisprudence that STRENGTHENS the user's legal position
- Support arguments that INCREASE the chance of winning the case
- Include key legal concepts, disputed obligations, alleged violations, and relevant BW/Rv articles
- Reference the legal advice sections: het_geschil, de_feiten, juridische_duiding
- Be concise but comprehensive (max 100 words)
- Focus on the legal issues and court interpretations, not just factual similarities
- **IMPORTANT**: Write ONLY natural language - NO search operators like "site:", "AND", "OR", quotes, or special syntax
- The database ONLY contains Dutch court decisions from rechtspraak.nl - no need to specify this
- Use plain Dutch text describing the legal concepts, issues, and articles you want to find

REQUIRED KEYWORDS guidelines (CRITICAL - balance is key):
- Identify 1-3 ESSENTIAL legal terms that MUST appear in relevant case law
- **IMPORTANT**: List keywords in ORDER OF IMPORTANCE (most critical first)
  * The first keyword should be the MOST ESSENTIAL term for this case
  * Subsequent keywords should be progressively less critical but still relevant
  * This ordering matters for the search algorithm's threshold scaling strategy
- Use keywords that are HIGHLY SPECIFIC to the legal issue (not generic words)
- Examples of GOOD keywords:
  * "huurovereenkomst" for rental disputes
  * "merkinbreuk" for trademark infringement
  * "onrechtmatige daad" for tort claims
  * "opzegging" for termination disputes
  * "koopovereenkomst" for purchase agreement issues
  * "dwangsom" for penalty payment disputes
  * "ontbinding" for contract dissolution cases
- Examples of BAD keywords (too generic):
  * "overeenkomst" alone (too broad - millions of cases)
  * "partijen" (appears in almost all cases)
  * "rechter" (appears in all cases)
  * "vorderingen" (too common)
- Only include keywords that meaningfully narrow down results
- If the case is very broad or general, use fewer keywords (even 0-1) to avoid over-filtering
- If the case involves specific legal concepts, use 2-3 precise terms

Return a JSON object with this exact structure:
{
  "query": "the search query text",
  "requiredKeywords": ["keyword1", "keyword2"]
}

Return ONLY valid JSON, nothing else.`
          },
          {
            role: "user",
            content: `Analyze the complete juridisch advies below and generate an optimized search query + required keywords to find jurisprudence that SUPPORTS the user's position.

CASE TITLE: ${caseData.title}
USER PROCEDURAL ROLE: ${caseData.userRole === 'EISER' ? 'EISER (Claimant) - Find cases where similar claims were GRANTED' : 'GEDAAGDE (Defendant) - Find cases where similar claims were REJECTED'}
CLAIM AMOUNT: €${caseData.claimAmount}

COMPLETE JURIDISCH ADVIES:
${adviceText}

Task:
1. Identify the core legal dispute (geschilpunt) from het_geschil and juridische_duiding sections
2. Extract key statutory articles mentioned (BW, Rv, etc.)
3. Determine what factual patterns and legal interpretations would strengthen the user's position as ${caseData.userRole === 'EISER' ? 'claimant' : 'defendant'}
4. Generate ONE search query in PLAIN DUTCH TEXT (no "site:" or other operators) that finds jurisprudence supporting the user's argument
5. Identify 1-3 essential keywords that MUST appear in relevant case law (ordered by importance)

Remember: 
- Focus on finding precedents that INCREASE the user's chance of winning
- Balance keyword specificity - filter irrelevant cases but don't exclude valuable precedents
- Consider the procedural role: ${caseData.userRole === 'EISER' ? 'as claimant, find cases where courts GRANTED similar claims' : 'as defendant, find cases where courts REJECTED or DISMISSED similar claims'}
- DO NOT use search operators - the query should be natural language only
- The database already contains only rechtspraak.nl decisions - no need to specify "site:rechtspraak.nl"`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500
      });

      console.log('🤖 OpenAI response received:', {
        choices: response.choices?.length,
        finishReason: response.choices?.[0]?.finish_reason,
        hasContent: !!response.choices?.[0]?.message?.content
      });

      const responseContent = response.choices[0].message.content?.trim() || '';

      if (!responseContent) {
        console.error('❌ Empty response from OpenAI:', response);
        throw new Error('AI returned empty response. Please try again.');
      }

      // Parse JSON response
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(responseContent);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', responseContent);
        throw new Error('AI returned invalid JSON. Please try again.');
      }

      const generatedQuery = parsedResponse.query || '';
      const requiredKeywords = Array.isArray(parsedResponse.requiredKeywords) 
        ? parsedResponse.requiredKeywords.filter((k: any) => typeof k === 'string' && k.trim())
        : [];

      if (!generatedQuery) {
        throw new Error('AI did not generate a search query. Please try again.');
      }

      console.log(`✅ Generated search query: "${generatedQuery.substring(0, 100)}..."`);
      console.log(`🔑 Required keywords: ${requiredKeywords.length > 0 ? requiredKeywords.join(', ') : 'none'}`);

      res.json({
        query: generatedQuery,
        requiredKeywords: requiredKeywords,
        caseTitle: caseData.title,
        userRole: caseData.userRole
      });

    } catch (error: any) {
      console.error('Error generating search query:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to generate search query' 
      });
    }
  });

  // Semantic search in Pinecone vector database with dual namespace support
  app.post('/api/pinecone/search', async (req, res) => {
    try {
      const { query, filters, keywords = [], caseId, enableReranking = true } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      console.log(`🔍 DUAL NAMESPACE SEARCH STRATEGY`);
      console.log(`📝 Query: "${query.substring(0, 50)}..."`);
      console.log(`🔑 Keywords for bonus: ${keywords.length > 0 ? keywords.join(', ') : 'none'}`);
      if (filters) {
        console.log(`📋 Filters:`, JSON.stringify(filters, null, 2));
      }
      
      // Step 1: Search both namespaces in parallel
      const dualResults = await searchDualNamespaces({
        text: query,
        filter: filters,
        topK: SEARCH_CONFIG.DEFAULT_TOP_K,
        scoreThreshold: SEARCH_CONFIG.DEFAULT_SCORE_THRESHOLD
      });

      console.log(`📊 Total results: ${dualResults.totalResults} (WEB_ECLI: ${dualResults.webSearch.length}, ECLI_NL: ${dualResults.ecliNl.length})`);
      
      // Helper function to process results from a single namespace
      const processNamespaceResults = async (rawResults: any[], namespaceLabel: string) => {
        if (rawResults.length === 0) {
          return { finalResults: [], reranked: false };
        }
        
        // Step 2: Apply adjusted scoring (base + court boost + keyword bonus)
        const scoredResults = scoreAndSortResults(rawResults, keywords);
        console.log(`📊 ${namespaceLabel} score breakdown (top 3):`);
        scoredResults.slice(0, 3).forEach((r, i) => {
          console.log(`  ${i+1}. ${r.courtType || 'N/A'} | Base: ${r.scoreBreakdown.baseScore.toFixed(3)}, Court: +${r.scoreBreakdown.courtBoost.toFixed(3)}, Keywords: +${r.scoreBreakdown.keywordBonus.toFixed(3)} = ${r.adjustedScore.toFixed(3)}`);
        });
        
        // Step 3: Select top candidates for potential reranking
        const topCandidates = scoredResults.slice(0, SEARCH_CONFIG.RERANK_CANDIDATE_COUNT);
        
        // Step 4: Optional LLM reranking of top candidates
        let finalResults = topCandidates;
        let reranked = false;
        
        if (enableReranking && topCandidates.length > 0) {
          console.log(`🤖 ${namespaceLabel}: Attempting to rerank top ${Math.min(topCandidates.length, SEARCH_CONFIG.RERANK_BATCH_SIZE)} candidates...`);
          const rerankedResults = await rerankResults({
            caseId,
            query,
            candidates: topCandidates,
            filters,
            enableCache: true
          });
          
          if (rerankedResults.length > 0) {
            finalResults = rerankedResults;
            reranked = true;
            console.log(`✅ ${namespaceLabel}: Reranking successful`);
          }
        }
        
        return { finalResults, reranked };
      };
      
      // Process both namespaces
      const [webSearchProcessed, ecliNlProcessed] = await Promise.all([
        processNamespaceResults(dualResults.webSearch, 'WEB_ECLI'),
        processNamespaceResults(dualResults.ecliNl, 'ECLI_NL')
      ]);
      
      // Step 5: Format results for display
      const formatResults = (results: any[]) => {
        return results.slice(0, SEARCH_CONFIG.MAX_RESULTS_DISPLAY).map(result => ({
          id: result.id,
          score: result.score,
          adjustedScore: result.adjustedScore,
          scoreBreakdown: result.scoreBreakdown,
          courtType: result.courtType,
          rerankScore: result.rerankScore,
          namespace: result.namespace, // Include namespace tag
          ecli: result.metadata?.ecli,
          title: result.metadata?.title,
          court: result.metadata?.court,
          decision_date: result.metadata?.decision_date,
          legal_area: result.metadata?.legal_area,
          procedure_type: result.metadata?.procedure_type,
          source_url: result.metadata?.source_url,
          text: result.text,
          ai_feiten: result.metadata?.ai_feiten,
          ai_geschil: result.metadata?.ai_geschil,
          ai_beslissing: result.metadata?.ai_beslissing,
          ai_motivering: result.metadata?.ai_motivering,
          ai_inhoudsindicatie: result.metadata?.ai_inhoudsindicatie
        }));
      };

      const formattedWebSearch = formatResults(webSearchProcessed.finalResults);
      const formattedEcliNl = formatResults(ecliNlProcessed.finalResults);

      console.log(`✅ Returning ${formattedWebSearch.length} WEB_ECLI + ${formattedEcliNl.length} ECLI_NL results`);

      res.json({
        query,
        webSearchResults: formattedWebSearch,
        ecliNlResults: formattedEcliNl,
        totalResults: formattedWebSearch.length + formattedEcliNl.length,
        webSearchReranked: webSearchProcessed.reranked,
        ecliNlReranked: ecliNlProcessed.reranked,
        strategy: 'dual-namespace-with-scoring'
      });

    } catch (error: any) {
      console.error('Error in Pinecone search:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to search Pinecone' 
      });
    }
  });

  // Generate jurisprudence references - AI analysis of top judgments
  app.post('/api/jurisprudentie/generate-references', async (req, res) => {
    try {
      const { caseId, topResults } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is required' });
      }

      if (!Array.isArray(topResults) || topResults.length === 0) {
        return res.status(400).json({ error: 'Top results array is required' });
      }

      console.log(`📋 Generating references for case ${caseId} with ${topResults.length} judgments`);

      // Fetch case data from Supabase
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // Fetch legal advice from Supabase
      const legalAdviceRecord = await legalAdviceService.getLatestCompletedAdvice(caseId);
      
      if (!legalAdviceRecord) {
        return res.status(404).json({ error: 'Geen juridisch advies gevonden voor deze zaak' });
      }

      console.log(`📌 Using legal advice ${legalAdviceRecord.id} from Supabase`);

      // Build comprehensive legal advice text from Supabase record
      const formatField = (field: any): string => {
        if (!field) return '';
        if (typeof field === 'string') return field;
        if (Array.isArray(field)) return field.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join('\n');
        return JSON.stringify(field, null, 2);
      };

      const adviceText = [
        'HET GESCHIL:',
        legalAdviceRecord.het_geschil || '',
        '\nDE FEITEN:',
        formatField(legalAdviceRecord.de_feiten),
        '\nJURIDISCHE DUIDING:',
        formatField(legalAdviceRecord.juridische_duiding),
        '\nVERVOLGSTAPPEN:',
        formatField(legalAdviceRecord.vervolgstappen),
        '\nSAMENVATTING ADVIES:',
        legalAdviceRecord.samenvatting_advies || ''
      ].filter(Boolean).join('\n\n');

      // Limit to top 5 judgments
      const top5Results = topResults.slice(0, 5);
      console.log(`🔍 Fetching full texts for top ${top5Results.length} judgments...`);

      // Fetch all judgment texts
      const { fetchMultipleJudgmentTexts } = await import('./rechtspraakService');
      const eclis = top5Results.map((r: any) => r.id);
      const judgmentResults = await fetchMultipleJudgmentTexts(eclis);

      // Filter out judgments without full text
      const validJudgments = judgmentResults
        .filter(j => j.fullText && j.fullText.length > 100)
        .map((j, index) => {
          const result = top5Results.find((r: any) => r.id === j.ecli);
          return {
            ecli: j.ecli,
            fullText: j.fullText,
            metadata: result?.metadata || {},
            score: result?.score || 0
          };
        });

      console.log(`✅ Found ${validJudgments.length} judgments with full text`);

      if (validJudgments.length === 0) {
        return res.json({
          references: [],
          message: 'Geen volledige uitspraken beschikbaar voor analyse'
        });
      }

      // Prepare judgments text for AI
      const judgmentsText = validJudgments.map((j, index) => {
        const court = j.metadata.court || 'Onbekend';
        const date = j.metadata.decision_date || 'Onbekend';
        const summary = j.metadata.ai_inhoudsindicatie || 'Geen samenvatting beschikbaar';
        const fullTextSafe = j.fullText || '';
        
        return `
========================================
UITSPRAAK ${index + 1}: ${j.ecli}
Rechtbank: ${court}
Datum: ${date}
Samenvatting: ${summary}

VOLLEDIGE TEKST:
${fullTextSafe.substring(0, 8000)} ${fullTextSafe.length > 8000 ? '...[tekst ingekort]' : ''}
========================================
        `.trim();
      }).join('\n\n');

      // Call OpenAI to generate references
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      console.log('🤖 Calling OpenAI to analyze judgments and generate references...');

      const systemPrompt = `Je bent een Nederlandse juridische analist gespecialiseerd in het analyseren van jurisprudentie.

Je taak is om relevante rechtspraak te identificeren die de juridische positie van de gebruiker kan versterken.

Voor elke relevante uitspraak moet je:
1. Het ECLI nummer vermelden
2. De instantie (rechtbank/hof) vermelden
3. In één duidelijke alinea uitleggen:
   - Wat er in de uitspraak werd besloten (kernpunt)
   - Waarom dit relevant is voor de zaak van de gebruiker
   - Hoe dit de positie van de gebruiker versterkt

Als een uitspraak NIET nuttig is voor de zaak (bijvoorbeeld: contradictoir, niet relevant, of verzwakt de positie), laat deze dan WEG.

Geef je antwoord als een JSON array met objecten in dit formaat:
{
  "references": [
    {
      "ecli": "ECLI:NL:HR:2023:123",
      "court": "Hoge Raad",
      "explanation": "In deze uitspraak oordeelde de Hoge Raad dat... Dit is relevant voor uw zaak omdat... Dit versterkt uw positie doordat..."
    }
  ]
}

Als er GEEN nuttige verwijzingen zijn, geef dan:
{
  "references": [],
  "message": "Geen nuttige verwijzingen naar jurisprudentie gevonden"
}`;

      const userPrompt = `JURIDISCH ADVIES VOOR DEZE ZAAK:
${adviceText}

GEVONDEN UITSPRAKEN:
${judgmentsText}

Analyseer deze uitspraken en identificeer alleen die uitspraken die de juridische positie van de gebruiker kunnen versterken. Negeer uitspraken die niet relevant zijn of de positie verzwakken.`;

      const response = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const aiResponse = JSON.parse(response.choices[0].message.content || '{"references": []}');
      console.log(`✅ AI generated ${aiResponse.references?.length || 0} references`);

      // References are returned to the frontend - user can save them via saved_jurisprudence if needed
      res.json(aiResponse);

    } catch (error: any) {
      console.error('Error generating references:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij genereren van verwijzingen' 
      });
    }
  });

  // Clear jurisprudence search results and references for a case
  app.post('/api/jurisprudentie/clear-data', async (req, res) => {
    try {
      const { caseId } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is required' });
      }

      console.log(`🗑️ Clearing jurisprudence data for case ${caseId}`);

      // Find the analysis with jurisprudence data
      const analysisRecords = await db
        .select()
        .from(analyses)
        .where(eq(analyses.caseId, caseId))
        .orderBy(desc(analyses.createdAt));

      // Clear jurisprudence data from all analyses that have it
      let clearedCount = 0;
      for (const analysis of analysisRecords) {
        if (analysis.jurisprudenceReferences || analysis.jurisprudenceSearchResults) {
          await db
            .update(analyses)
            .set({ 
              jurisprudenceReferences: null,
              jurisprudenceSearchResults: null
            })
            .where(eq(analyses.id, analysis.id));
          clearedCount++;
        }
      }

      console.log(`✅ Cleared jurisprudence data from ${clearedCount} analyses`);

      res.json({ 
        success: true, 
        clearedCount,
        message: 'Jurisprudence data cleared successfully' 
      });

    } catch (error: any) {
      console.error('Error clearing jurisprudence data:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij wissen van jurisprudentie data' 
      });
    }
  });

  // Get saved jurisprudence data for a case
  app.get('/api/jurisprudentie/:caseId', async (req, res) => {
    try {
      const { caseId } = req.params;
      
      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is required' });
      }

      console.log(`📖 Fetching saved jurisprudence data for case ${caseId}`);

      // Find ALL analyses for this case
      const analysisRecords = await db
        .select()
        .from(analyses)
        .where(eq(analyses.caseId, caseId))
        .orderBy(desc(analyses.createdAt));

      if (!analysisRecords || analysisRecords.length === 0) {
        console.log('⚠️  No analysis found for case');
        return res.json({
          searchResults: { ecli_nl: [], web_ecli: [] },
          references: []
        });
      }

      // Find the FIRST analysis that has jurisprudence data (regardless of age)
      const analysisWithData = analysisRecords.find((a: any) => 
        (a.jurisprudenceSearchResults && a.jurisprudenceSearchResults !== null && 
         (typeof a.jurisprudenceSearchResults === 'object' && !Array.isArray(a.jurisprudenceSearchResults) &&
          (a.jurisprudenceSearchResults.ecli_nl?.length > 0 || a.jurisprudenceSearchResults.web_ecli?.length > 0))) ||
        (a.jurisprudenceReferences && Array.isArray(a.jurisprudenceReferences) && a.jurisprudenceReferences.length > 0)
      );

      if (!analysisWithData) {
        console.log('⚠️  No jurisprudence data found in any analysis');
        return res.json({
          searchResults: { ecli_nl: [], web_ecli: [] },
          references: []
        });
      }

      console.log(`✅ Found jurisprudence data in analysis ${analysisWithData.id}`);

      // Parse search results - handle both old format (array) and new format (object with namespaces)
      let searchResults = analysisWithData.jurisprudenceSearchResults || { ecli_nl: [], web_ecli: [] };
      
      // If old format (array), return empty for now - user will need to search again
      if (Array.isArray(searchResults)) {
        console.log('⚠️  Old format detected, returning empty');
        searchResults = { ecli_nl: [], web_ecli: [] };
      }

      console.log(`✅ Returning: ecli_nl=${searchResults.ecli_nl?.length || 0}, web_ecli=${searchResults.web_ecli?.length || 0}, references=${analysisWithData.jurisprudenceReferences?.length || 0}`);

      res.json({
        searchResults: searchResults,
        references: analysisWithData.jurisprudenceReferences || []
      });

    } catch (error: any) {
      console.error('Error fetching jurisprudence data:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij ophalen van jurisprudentie data' 
      });
    }
  });

  // Save search results to database
  app.patch('/api/jurisprudentie/:caseId/save-search', async (req, res) => {
    try {
      const { caseId } = req.params;
      const { ecliNlResults, webEcliResults } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is required' });
      }

      console.log(`💾 Saving search results for case ${caseId}: ecli_nl=${ecliNlResults?.length || 0}, web_ecli=${webEcliResults?.length || 0}`);

      // Find the latest analysis
      let analysisRecords = await db
        .select()
        .from(analyses)
        .where(eq(analyses.caseId, caseId))
        .orderBy(desc(analyses.createdAt));

      let latestAnalysis;
      let dataAlreadySaved = false;

      if (!analysisRecords || analysisRecords.length === 0) {
        // No analysis exists - create a basic one to store jurisprudence data
        console.log('⚠️  No analysis found, creating new analysis record for jurisprudence storage');
        const newAnalysis = await db
          .insert(analyses)
          .values({
            caseId: caseId,
            jurisprudenceSearchResults: {
              ecli_nl: ecliNlResults || [],
              web_ecli: webEcliResults || []
            }
          })
          .returning();
        
        latestAnalysis = newAnalysis[0];
        dataAlreadySaved = true; // Data was saved during insert
      } else {
        latestAnalysis = analysisRecords[0];
      }

      // Save search results in namespaced structure (only if not already saved)
      if (!dataAlreadySaved) {
        await db
          .update(analyses)
          .set({ 
            jurisprudenceSearchResults: {
              ecli_nl: ecliNlResults || [],
              web_ecli: webEcliResults || []
            }
          })
          .where(eq(analyses.id, latestAnalysis.id));
      }

      console.log('✅ Search results saved to database');

      res.json({ 
        success: true,
        message: 'Search results saved successfully' 
      });

    } catch (error: any) {
      console.error('Error saving search results:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij opslaan van zoekresultaten' 
      });
    }
  });

  // Clear namespace-specific results
  app.patch('/api/jurisprudentie/:caseId/clear-namespace', async (req, res) => {
    try {
      const { caseId } = req.params;
      const { namespace } = req.body;
      
      if (!caseId || !namespace) {
        return res.status(400).json({ error: 'Case ID and namespace are required' });
      }

      if (namespace !== 'ecli_nl' && namespace !== 'web_ecli') {
        return res.status(400).json({ error: 'Invalid namespace. Must be ecli_nl or web_ecli' });
      }

      console.log(`🗑️ Clearing ${namespace} results for case ${caseId}`);

      // Find the latest analysis with jurisprudence data
      const analysisRecords = await db
        .select()
        .from(analyses)
        .where(eq(analyses.caseId, caseId))
        .orderBy(desc(analyses.createdAt));

      const latestWithData = analysisRecords.find((a: any) => 
        a.jurisprudenceSearchResults && a.jurisprudenceSearchResults !== null
      );

      if (!latestWithData) {
        return res.json({ success: true, message: 'No data to clear' });
      }

      // Get current search results
      let currentSearchResults = latestWithData.jurisprudenceSearchResults || { ecli_nl: [], web_ecli: [] };
      
      // Handle old format
      if (Array.isArray(currentSearchResults)) {
        currentSearchResults = { ecli_nl: [], web_ecli: [] };
      }

      // Clear only the specified namespace
      const updatedSearchResults = {
        ...currentSearchResults,
        [namespace]: []
      };

      await db
        .update(analyses)
        .set({ 
          jurisprudenceSearchResults: updatedSearchResults
        })
        .where(eq(analyses.id, latestWithData.id));

      console.log(`✅ Cleared ${namespace} results`);

      res.json({ 
        success: true,
        message: `Results from ${namespace} cleared successfully` 
      });

    } catch (error: any) {
      console.error('Error clearing namespace results:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij wissen van namespace resultaten' 
      });
    }
  });

  // ============================================
  // SAVED JURISPRUDENCE (Supabase) ROUTES
  // ============================================

  // Get saved jurisprudence for a case
  app.get('/api/saved-jurisprudence/:caseId', isAuthenticated, async (req: any, res) => {
    try {
      const { caseId } = req.params;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Niet ingelogd' });
      }

      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is vereist' });
      }

      console.log(`📚 Fetching saved jurisprudence for case ${caseId}`);
      
      const savedItems = await savedJurisprudenceService.getSavedForCase(caseId, userId);
      
      console.log(`✅ Found ${savedItems.length} saved jurisprudence items`);
      
      res.json({ items: savedItems });
    } catch (error: any) {
      console.error('Error fetching saved jurisprudence:', error);
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Kon opgeslagen uitspraken niet ophalen' 
      });
    }
  });

  // Save a jurisprudence item
  app.post('/api/saved-jurisprudence', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ error: 'Niet ingelogd' });
      }

      const { 
        caseId, 
        ecli, 
        court, 
        courtLevel,
        decisionDate, 
        legalArea, 
        procedureType,
        title,
        sourceUrl,
        textFragment,
        aiFeiten,
        aiGeschil,
        aiBeslissing,
        aiMotivering,
        aiInhoudsindicatie,
        searchScore,
        searchNamespace,
        searchQuery
      } = req.body;

      if (!caseId || !ecli) {
        return res.status(400).json({ error: 'Case ID en ECLI zijn vereist' });
      }

      console.log(`💾 Saving jurisprudence ${ecli} for case ${caseId}`);

      const saved = await savedJurisprudenceService.saveJurisprudence({
        userId,
        caseId,
        ecli,
        court,
        courtLevel,
        decisionDate,
        legalArea,
        procedureType,
        title,
        sourceUrl,
        textFragment,
        aiFeiten,
        aiGeschil,
        aiBeslissing,
        aiMotivering,
        aiInhoudsindicatie,
        searchScore,
        searchNamespace,
        searchQuery
      });

      console.log(`✅ Saved jurisprudence with id ${saved.id}`);

      res.json({ success: true, item: saved });
    } catch (error: any) {
      console.error('Error saving jurisprudence:', error);
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Kon uitspraak niet opslaan' 
      });
    }
  });

  // Delete a saved jurisprudence item by ID
  app.delete('/api/saved-jurisprudence/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Niet ingelogd' });
      }

      if (!id) {
        return res.status(400).json({ error: 'ID is vereist' });
      }

      console.log(`🗑️ Deleting saved jurisprudence ${id}`);
      
      await savedJurisprudenceService.deleteSavedJurisprudence(id, userId);
      
      console.log(`✅ Deleted saved jurisprudence ${id}`);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting saved jurisprudence:', error);
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Kon uitspraak niet verwijderen' 
      });
    }
  });

  // Delete a saved jurisprudence item by case ID and ECLI
  app.delete('/api/saved-jurisprudence/:caseId/ecli/:ecli', isAuthenticated, async (req: any, res) => {
    try {
      const { caseId, ecli } = req.params;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Niet ingelogd' });
      }

      if (!caseId || !ecli) {
        return res.status(400).json({ error: 'Case ID en ECLI zijn vereist' });
      }

      const decodedEcli = decodeURIComponent(ecli);
      
      console.log(`🗑️ Deleting saved jurisprudence ${decodedEcli} from case ${caseId}`);
      
      await savedJurisprudenceService.deleteByEcli(caseId, decodedEcli, userId);
      
      console.log(`✅ Deleted saved jurisprudence ${decodedEcli}`);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting saved jurisprudence by ECLI:', error);
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Kon uitspraak niet verwijderen' 
      });
    }
  });

  // ============================================
  // SAVED LEGISLATION (Supabase) ROUTES
  // ============================================

  // Get saved legislation for a case
  app.get('/api/saved-legislation/:caseId', isAuthenticated, async (req: any, res) => {
    try {
      const { caseId } = req.params;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Niet ingelogd' });
      }

      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is vereist' });
      }

      console.log(`📚 Fetching saved legislation for case ${caseId}`);
      
      const savedItems = await savedLegislationService.getSavedForCase(caseId, userId);
      
      console.log(`✅ Found ${savedItems.length} saved legislation items`);
      
      res.json({ items: savedItems });
    } catch (error: any) {
      console.error('Error fetching saved legislation:', error);
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Kon opgeslagen artikelen niet ophalen' 
      });
    }
  });

  // Save a legislation item
  app.post('/api/saved-legislation', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ error: 'Niet ingelogd' });
      }

      const { 
        caseId, 
        bwbId, 
        articleNumber,
        lawTitle,
        boekNummer,
        boekTitel,
        titelNummer,
        titelNaam,
        articleText,
        validFrom,
        wettenLink,
        commentaryShortIntro,
        commentarySystematiek,
        commentaryKernbegrippen,
        commentaryReikwijdte,
        jurisprudenceRefs,
        onlineSources
      } = req.body;

      if (!caseId || !bwbId || !articleNumber) {
        return res.status(400).json({ error: 'Case ID, BWB ID en artikel nummer zijn vereist' });
      }

      console.log(`💾 Saving legislation ${bwbId} art. ${articleNumber} for case ${caseId}`);

      const saved = await savedLegislationService.saveLegislation({
        userId,
        caseId,
        bwbId,
        articleNumber,
        lawTitle,
        boekNummer,
        boekTitel,
        titelNummer,
        titelNaam,
        articleText,
        validFrom,
        wettenLink,
        commentaryShortIntro,
        commentarySystematiek,
        commentaryKernbegrippen,
        commentaryReikwijdte,
        jurisprudenceRefs,
        onlineSources
      });

      console.log(`✅ Saved legislation with id ${saved.id}`);

      res.json({ success: true, item: saved });
    } catch (error: any) {
      console.error('Error saving legislation:', error);
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Kon artikel niet opslaan' 
      });
    }
  });

  // Delete a saved legislation item by ID
  app.delete('/api/saved-legislation/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Niet ingelogd' });
      }

      if (!id) {
        return res.status(400).json({ error: 'ID is vereist' });
      }

      console.log(`🗑️ Deleting saved legislation ${id}`);
      
      await savedLegislationService.deleteSavedLegislation(id, userId);
      
      console.log(`✅ Deleted saved legislation ${id}`);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting saved legislation:', error);
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Kon artikel niet verwijderen' 
      });
    }
  });

  // Delete a saved legislation item by case ID and article
  app.delete('/api/saved-legislation/:caseId/article/:bwbId/:articleNumber', isAuthenticated, async (req: any, res) => {
    try {
      const { caseId, bwbId, articleNumber } = req.params;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Niet ingelogd' });
      }

      if (!caseId || !bwbId || !articleNumber) {
        return res.status(400).json({ error: 'Case ID, BWB ID en artikel nummer zijn vereist' });
      }

      const decodedBwbId = decodeURIComponent(bwbId);
      const decodedArticleNumber = decodeURIComponent(articleNumber);
      
      console.log(`🗑️ Deleting saved legislation ${decodedBwbId} art. ${decodedArticleNumber} from case ${caseId}`);
      
      await savedLegislationService.deleteByArticle(caseId, decodedBwbId, decodedArticleNumber, userId);
      
      console.log(`✅ Deleted saved legislation ${decodedBwbId} art. ${decodedArticleNumber}`);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting saved legislation by article:', error);
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Kon artikel niet verwijderen' 
      });
    }
  });

  // Check Pinecone connection
  app.get('/api/rechtspraak/pinecone-status', async (req, res) => {
    try {
      const exists = await checkIndexExists();
      res.json({ 
        connected: exists,
        indexName: 'rechtstreeks',
        status: exists ? 'ready' : 'index not found'
      });
    } catch (error: any) {
      res.status(500).json({ 
        connected: false,
        error: error.message || 'Failed to connect to Pinecone'
      });
    }
  });

  // Fetch full judgment text from Rechtspraak.nl API
  const { fetchJudgmentText, fetchMultipleJudgmentTexts } = await import('./rechtspraakService');

  app.post('/api/rechtspraak/fetch-judgment', async (req, res) => {
    try {
      const { ecli } = req.body;

      if (!ecli || typeof ecli !== 'string') {
        return res.status(400).json({ error: 'ECLI is required' });
      }

      const result = await fetchJudgmentText(ecli);
      res.json(result);
    } catch (error: any) {
      console.error('Error fetching judgment text:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to fetch judgment text' 
      });
    }
  });

  // Fetch full judgment texts for multiple ECLIs
  app.post('/api/rechtspraak/fetch-judgments-batch', async (req, res) => {
    try {
      const { eclis } = req.body;

      if (!Array.isArray(eclis) || eclis.length === 0) {
        return res.status(400).json({ error: 'Array of ECLIs is required' });
      }

      if (eclis.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 ECLIs per batch request' });
      }

      const results = await fetchMultipleJudgmentTexts(eclis);
      res.json({ results });
    } catch (error: any) {
      console.error('Error fetching judgment texts:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to fetch judgment texts' 
      });
    }
  });

  // ============================================
  // WETGEVING (LEGISLATION) ENDPOINTS
  // ============================================

  // Search for legislation in Pinecone with multi-stage retrieval + rerank
  app.post('/api/wetgeving/search', async (req, res) => {
    try {
      const { 
        query, 
        caseId,
        topK = 200,           // First-stage retrieval count
        rerankTopN = 30,      // Reranked results count  
        maxLaws = 10,         // Max laws to return
        maxArticlesPerLaw = 20, // Max articles per law
        expandContext = true  // Whether to expand context (all leden, nearby articles)
      } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      console.log(`\n========================================`);
      console.log(`📜 WETGEVING SEARCH WITH RERANK PIPELINE`);
      console.log(`========================================`);
      console.log(`📝 Query: "${query.substring(0, 150)}..."`);
      console.log(`⚙️ Config: topK=${topK}, rerankTopN=${rerankTopN}, maxLaws=${maxLaws}`);
      
      // STEP 1: Build enhanced query string
      // Include case context if available
      let enhancedQuery = query;
      
      if (caseId) {
        try {
          const [caseData] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
          if (caseData) {
            const analysisRecords = await db
              .select()
              .from(analyses)
              .where(eq(analyses.caseId, caseId))
              .orderBy(desc(analyses.createdAt))
              .limit(1);
            
            const latestAnalysis = analysisRecords[0];
            
            let contextParts: string[] = [query];
            
            if (caseData.title) {
              contextParts.push(`Zaak: ${caseData.title}`);
            }
            
            if (latestAnalysis?.legalAdviceJson) {
              const advice: any = latestAnalysis.legalAdviceJson;
              if (advice.summary) {
                contextParts.push(`Samenvatting: ${advice.summary.substring(0, 300)}`);
              }
            }
            
            if (latestAnalysis?.succesKansAnalysis) {
              const analysis: any = latestAnalysis.succesKansAnalysis;
              if (analysis.juridisch_kader) {
                contextParts.push(`Juridisch kader: ${analysis.juridisch_kader.substring(0, 300)}`);
              }
            }
            
            enhancedQuery = contextParts.join('\n\n');
            console.log(`📋 Enhanced query with case context (${enhancedQuery.length} chars)`);
          }
        } catch (e) {
          console.log(`⚠️ Could not fetch case context: ${e}`);
        }
      }
      
      // Add focus instruction for reranking
      enhancedQuery += '\n\nFocus: vind de meest relevante wetsartikelen en bepalingen.';
      
      // STEP 2-4: First-stage retrieval + rerank
      const rerankedResults = await searchLegislationWithRerank(
        enhancedQuery,
        topK,
        rerankTopN
      );
      
      if (rerankedResults.length === 0) {
        return res.json({
          query,
          laws: [],
          flatResults: [],
          totalLaws: 0,
          totalArticles: 0,
          namespace: 'laws-current'
        });
      }
      
      // STEP 5: Group by law (bwb_id) and score
      const groupedLaws = groupResultsByLaw(rerankedResults, maxLaws, maxArticlesPerLaw);
      
      // STEP 6: Context expansion (optional)
      if (expandContext && groupedLaws.length > 0) {
        console.log(`\n--- STAGE 6: Context expansion ---`);
        
        for (const law of groupedLaws.slice(0, 5)) { // Expand top 5 laws
          const topArticleNumbers = Array.from(new Set(
            law.articles.slice(0, 5).map(a => a.articleNumber).filter(Boolean)
          ));
          
          if (topArticleNumbers.length > 0) {
            try {
              const expandedResults = await expandLawContext(law.bwbId, topArticleNumbers);
              
              // Merge expanded results into existing articles
              const existingIds = new Set(law.articles.map(a => a.id));
              for (const expanded of expandedResults) {
                if (!existingIds.has(expanded.id)) {
                  law.articles.push({
                    articleNumber: expanded.metadata.article_number || '',
                    lid: expanded.metadata.lid,
                    score: expanded.score,
                    rerankScore: 0, // Expanded results don't have rerank score
                    text: expanded.text || expanded.metadata.text || '',
                    boekNummer: expanded.metadata.boek_nummer,
                    titelNummer: expanded.metadata.titel_nummer,
                    hoofdstukNummer: expanded.metadata.hoofdstuk_nummer,
                    structurePath: expanded.metadata.structure_path,
                    isCurrent: expanded.metadata.is_current,
                    validFrom: expanded.metadata.valid_from,
                    id: expanded.id
                  });
                  existingIds.add(expanded.id);
                }
              }
              
              // Re-sort articles by articleNumber then lid for logical order
              law.articles.sort((a, b) => {
                const artCompare = (a.articleNumber || '').localeCompare(b.articleNumber || '', undefined, { numeric: true });
                if (artCompare !== 0) return artCompare;
                return (a.lid || '').localeCompare(b.lid || '', undefined, { numeric: true });
              });
              
            } catch (e) {
              console.log(`⚠️ Context expansion failed for ${law.bwbId}: ${e}`);
            }
          }
        }
      }
      
      // STEP 7: Format final output for UI
      console.log(`\n--- STAGE 7: Final assembly ---`);
      
      const formattedLaws = groupedLaws.map((law, lawIdx) => ({
        rank: lawIdx + 1,
        bwbId: law.bwbId,
        title: law.title,
        lawCode: law.lawCode,
        lawScore: law.lawScore,
        lawScorePercent: (law.lawScore * 100).toFixed(1) + '%',
        bronUrl: `https://wetten.overheid.nl/${law.bwbId}`,
        articleCount: law.articles.length,
        articles: law.articles.map((article, artIdx) => ({
          rank: artIdx + 1,
          id: article.id,
          articleNumber: article.articleNumber,
          lid: article.lid,
          score: article.score,
          rerankScore: article.rerankScore,
          scorePercent: (article.rerankScore * 100).toFixed(1) + '%',
          text: article.text,
          textPreview: article.text?.substring(0, 300) + (article.text?.length > 300 ? '...' : ''),
          boekNummer: article.boekNummer,
          titelNummer: article.titelNummer,
          hoofdstukNummer: article.hoofdstukNummer,
          structurePath: article.structurePath,
          isCurrent: article.isCurrent,
          validFrom: article.validFrom,
          citatie: article.articleNumber 
            ? `art. ${article.articleNumber}${article.lid ? ` lid ${article.lid}` : ''} ${law.title}`
            : law.title,
          bronUrl: `https://wetten.overheid.nl/${law.bwbId}#${article.articleNumber || ''}`
        }))
      }));
      
      // Also create flat results list for backward compatibility
      const flatResults = formattedLaws.flatMap(law => 
        law.articles.map(article => ({
          ...article,
          lawTitle: law.title,
          lawBwbId: law.bwbId,
          lawScore: law.lawScore
        }))
      );
      
      const totalArticles = formattedLaws.reduce((sum, law) => sum + law.articles.length, 0);
      
      console.log(`\n✅ WETGEVING SEARCH COMPLETE`);
      console.log(`📊 ${formattedLaws.length} laws, ${totalArticles} total articles`);
      
      // Create results array for frontend compatibility (expects 'results' field)
      const results = flatResults.slice(0, 50).map(article => ({
        id: article.id,
        title: article.lawTitle,
        article_number: article.articleNumber,
        lid: article.lid,
        text: article.text,
        textPreview: article.textPreview,
        score: article.rerankScore || article.score,
        scorePercent: article.scorePercent,
        citatie: article.citatie,
        bronUrl: article.bronUrl,
        bwb_id: article.lawBwbId,
        boek_nummer: article.boekNummer,
        titel_nummer: article.titelNummer,
        hoofdstuk_nummer: article.hoofdstukNummer,
        structure_path: article.structurePath,
        is_current: article.isCurrent,
        valid_from: article.validFrom
      }));

      res.json({
        query,
        enhancedQuery: enhancedQuery.substring(0, 500),
        results,  // Frontend expects this field
        totalResults: results.length, // Frontend expects this field
        laws: formattedLaws,
        flatResults: flatResults.slice(0, 50),
        totalLaws: formattedLaws.length,
        totalArticles,
        namespace: 'laws-current',
        pipeline: {
          firstStageTopK: topK,
          rerankTopN,
          maxLaws,
          maxArticlesPerLaw,
          expandContext
        }
      });

    } catch (error: any) {
      console.error('Error in wetgeving search:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to search legislation' 
      });
    }
  });

  // Generate AI-powered legislation search query from case analysis
  app.post('/api/wetgeving/generate-query', async (req, res) => {
    try {
      const { caseId } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is required' });
      }

      // Fetch case data from Supabase
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // Fetch analysis data from Supabase
      const latestRkos = await rkosAnalysisService.getLatestCompletedAnalysis(caseId);
      const latestAdvice = await legalAdviceService.getLatestCompletedAdvice(caseId);
      
      if (!latestRkos && !latestAdvice) {
        return res.status(404).json({ error: 'Geen analyse gevonden voor deze zaak. Voer eerst een analyse uit.' });
      }
      
      console.log(`📋 Generating legislation search query for case ${caseId}`);

      // Build context from available Supabase analysis data
      let contextParts: string[] = [];
      
      // Add legal advice if available
      if (latestAdvice) {
        contextParts.push(
          latestAdvice.het_geschil || '',
          Array.isArray(latestAdvice.de_feiten) ? latestAdvice.de_feiten.join('\n') : (latestAdvice.de_feiten || ''),
          typeof latestAdvice.juridische_duiding === 'object' ? JSON.stringify(latestAdvice.juridische_duiding) : (latestAdvice.juridische_duiding || ''),
          latestAdvice.samenvatting_advies || ''
        );
      }
      
      // Add RKOS analysis if available
      if (latestRkos) {
        if (latestRkos.applicable_laws && Array.isArray(latestRkos.applicable_laws) && latestRkos.applicable_laws.length > 0) {
          contextParts.push(`Toepasselijke wetten: ${latestRkos.applicable_laws.join(', ')}`);
        }
        if (latestRkos.strengths && latestRkos.strengths.length > 0) {
          const strengthsStr = latestRkos.strengths.map((s: any) => typeof s === 'object' ? s.text || JSON.stringify(s) : s).join('; ');
          contextParts.push(`Sterke punten: ${strengthsStr}`);
        }
      }
      
      // Add case description
      if (caseData.description) {
        contextParts.push(`Zaakbeschrijving: ${caseData.description}`);
      }

      const analysisText = contextParts.filter(Boolean).join('\n\n');

      if (!analysisText.trim()) {
        return res.status(400).json({ error: 'Geen analyse inhoud beschikbaar' });
      }

      // Generate search query using OpenAI
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      console.log('🤖 Generating legislation search query using AI...');
      console.log(`📄 Analysis context length: ${analysisText.length} chars`);

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Je bent een ervaren Nederlandse juridische zoekexpert. Je taak is om een KORTE en GERICHTE zoekopdracht te maken voor een vectordatabase met Nederlandse wetgeving.

ANALYSE INSTRUCTIES:
1. Lees de zaak zorgvuldig en identificeer het KERNPROBLEEM
2. Bepaal welk rechtsgebied centraal staat (verbintenissen, huur, koop, arbeid, etc.)
3. Identificeer de juridische concepten die relevant zijn

ZOEKOPDRACHT REGELS (STRIKT):
- Maximaal 30 woorden
- ALLEEN juridische termen en concepten
- GEEN persoonsgegevens (namen, bedrijfsnamen, plaatsen)
- GEEN wetsartikelnummers (geen "art. 6:74" of "7:201 BW")
- GEEN datums of bedragen
- Focus op juridische kernbegrippen die in wetteksten voorkomen

VOORBEELDEN GOEDE ZOEKOPDRACHTEN:
- "wanprestatie tekortkoming verbintenis schadevergoeding ontbinding overeenkomst"
- "huurovereenkomst gebreken onderhoud verhuurder herstelverplichting"
- "koopovereenkomst non-conformiteit ontbinding dwaling"

Genereer een JSON response met:
{
  "query": "Korte zoekopdracht (max 30 woorden, alleen juridische termen)",
  "suggestedFilters": ["Relevante wetboeken, bijv. 'Burgerlijk Wetboek Boek 6'"],
  "mentionedArticles": ["Artikelen die in de analyse worden genoemd"],
  "legalConcepts": ["Kernbegrippen uit de zaak"]
}`
          },
          {
            role: "user",
            content: `Analyseer deze juridische zaak en genereer een korte, gerichte zoekopdracht voor wetgeving. Focus alleen op juridische concepten, geen persoonsgegevens of artikelnummers:\n\n${analysisText}`
          }
        ],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: "json_object" }
      });

      const responseContent = response.choices[0].message.content;
      if (!responseContent) {
        throw new Error('AI returned empty response');
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseContent);
      } catch (e) {
        console.error('❌ Failed to parse JSON response:', responseContent);
        throw new Error('AI returned invalid JSON. Please try again.');
      }

      const generatedQuery = parsedResponse.query || '';
      const suggestedFilters = Array.isArray(parsedResponse.suggestedFilters) 
        ? parsedResponse.suggestedFilters 
        : [];
      const mentionedArticles = Array.isArray(parsedResponse.mentionedArticles)
        ? parsedResponse.mentionedArticles
        : [];
      const legalConcepts = Array.isArray(parsedResponse.legalConcepts)
        ? parsedResponse.legalConcepts
        : [];

      if (!generatedQuery) {
        throw new Error('AI did not generate a search query. Please try again.');
      }

      console.log(`✅ Generated legislation query: "${generatedQuery.substring(0, 100)}..."`);
      console.log(`📚 Suggested filters: ${suggestedFilters.join(', ') || 'none'}`);
      console.log(`📖 Mentioned articles: ${mentionedArticles.join(', ') || 'none'}`);

      res.json({
        query: generatedQuery,
        suggestedFilters,
        mentionedArticles,
        legalConcepts,
        caseTitle: caseData.title
      });

    } catch (error: any) {
      console.error('Error generating legislation query:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to generate legislation search query' 
      });
    }
  });

  // Generate AI-powered specific regulation and article suggestions from case analysis
  app.post('/api/wetgeving/generate-articles', async (req, res) => {
    try {
      const { caseId } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is required' });
      }

      // Fetch case data from Supabase
      const caseData = await caseService.getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // Fetch analysis data from Supabase
      const latestRkos = await rkosAnalysisService.getLatestCompletedAnalysis(caseId);
      const latestAdvice = await legalAdviceService.getLatestCompletedAdvice(caseId);
      
      if (!latestRkos && !latestAdvice) {
        return res.status(404).json({ error: 'Geen analyse gevonden voor deze zaak. Voer eerst een analyse uit.' });
      }
      
      console.log(`📋 Generating specific article suggestions for case ${caseId}`);

      // Build context from available Supabase analysis data
      let contextParts: string[] = [];
      
      // Add legal advice if available
      if (latestAdvice) {
        contextParts.push(
          latestAdvice.het_geschil || '',
          Array.isArray(latestAdvice.de_feiten) ? latestAdvice.de_feiten.join('\n') : (latestAdvice.de_feiten || ''),
          typeof latestAdvice.juridische_duiding === 'object' ? JSON.stringify(latestAdvice.juridische_duiding) : (latestAdvice.juridische_duiding || ''),
          latestAdvice.samenvatting_advies || ''
        );
      }
      
      // Add RKOS analysis if available
      if (latestRkos) {
        if (latestRkos.applicable_laws && Array.isArray(latestRkos.applicable_laws) && latestRkos.applicable_laws.length > 0) {
          contextParts.push(`Toepasselijke wetten: ${latestRkos.applicable_laws.join(', ')}`);
        }
        if (latestRkos.strengths && latestRkos.strengths.length > 0) {
          const strengthsStr = latestRkos.strengths.map((s: any) => typeof s === 'object' ? s.text || JSON.stringify(s) : s).join('; ');
          contextParts.push(`Sterke punten: ${strengthsStr}`);
        }
      }
      
      // Add case description
      if (caseData.description) {
        contextParts.push(`Zaakbeschrijving: ${caseData.description}`);
      }

      const analysisText = contextParts.filter(Boolean).join('\n\n');

      if (!analysisText.trim()) {
        return res.status(400).json({ error: 'Geen analyse inhoud beschikbaar' });
      }

      // Generate article suggestions using OpenAI
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      console.log('🤖 Generating specific article suggestions using AI...');
      console.log(`📄 Analysis context length: ${analysisText.length} chars`);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Je bent een Nederlandse juridische expert gespecialiseerd in het identificeren van relevante wetsartikelen.

Je taak is om op basis van een juridische analyse specifieke wetsartikelen te identificeren die onderzocht moeten worden.

Analyseer de analyse zorgvuldig en identificeer:
1. Welke specifieke wetsartikelen expliciet worden genoemd
2. Welke wetsartikelen impliciet relevant zijn op basis van de juridische concepten
3. Welke wetboeken en regelingen betrokken zijn

BELANGRIJK:
- Noem altijd de volledige naam van de regeling (bijv. "Burgerlijk Wetboek Boek 7" niet "BW7")
- Gebruik het artikelnummer formaat zoals gebruikt in de wet (bijv. "7:201" voor huurrecht, "6:74" voor verbintenissenrecht)
- Maximaal 5 artikelen suggereren, focus op de meest relevante
- Geef bij elk artikel een korte uitleg waarom het relevant is

Genereer een JSON response met:
{
  "articles": [
    {
      "regulation": "Volledige naam van de regeling (bijv. 'Burgerlijk Wetboek Boek 7')",
      "articleNumber": "Artikelnummer (bijv. '7:201' of '204')",
      "reason": "Korte uitleg waarom dit artikel relevant is"
    }
  ],
  "explanation": "Algemene toelichting over de gekozen artikelen"
}`
          },
          {
            role: "user",
            content: `Analyseer de volgende juridische analyse en identificeer de meest relevante wetsartikelen die specifiek opgezocht moeten worden:\n\n${analysisText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      });

      const responseContent = response.choices[0].message.content;
      if (!responseContent) {
        throw new Error('AI returned empty response');
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseContent);
      } catch (e) {
        console.error('❌ Failed to parse JSON response:', responseContent);
        throw new Error('AI returned invalid JSON. Please try again.');
      }

      const articles = Array.isArray(parsedResponse.articles) 
        ? parsedResponse.articles 
        : [];
      const explanation = parsedResponse.explanation || '';

      if (articles.length === 0) {
        throw new Error('AI did not identify any specific articles. Please try again.');
      }

      console.log(`✅ Generated ${articles.length} article suggestions`);
      articles.forEach((art: any, idx: number) => {
        console.log(`   ${idx + 1}. ${art.regulation} art. ${art.articleNumber}`);
      });

      res.json({
        articles,
        explanation,
        caseTitle: caseData.title
      });

    } catch (error: any) {
      console.error('Error generating article suggestions:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to generate article suggestions' 
      });
    }
  });

  // Search for specific legislation articles by regulation and article number
  // Uses bwb_id + article_number for EXACT metadata filtering
  // Returns all variants (Verdrag, Uitvoeringsreglement, Protocol) with boek_titel distinction
  app.post('/api/wetgeving/search-article', async (req, res) => {
    try {
      const { regulation, articleNumber, topK = 50 } = req.body;
      
      if (!regulation || typeof regulation !== 'string') {
        return res.status(400).json({ error: 'Regelingnaam is verplicht' });
      }
      
      if (!articleNumber || typeof articleNumber !== 'string') {
        return res.status(400).json({ error: 'Artikelnummer is verplicht' });
      }

      console.log(`📜 SPECIFIC ARTICLE SEARCH (bwb_id + article_number strategy)`);
      console.log(`📚 Regulation: "${regulation}"`);
      console.log(`📖 Article: "${articleNumber}"`);
      
      // Parse article number - handle formats like "art. 7:800", "7:201", "91", "2.20 lid 2 sub b", etc.
      let articleNumClean = articleNumber.replace(/^art\.?\s*/i, '').trim();
      let bookNumber: string | null = null;
      let articleBase: string = articleNumClean;
      
      // Remove "lid X", "sub Y", "onder X" parts for base matching
      articleBase = articleNumClean
        .replace(/\s+lid\s+\d+(\s+sub\s+\w+)?/gi, '')
        .replace(/\s+sub\s+\w+/gi, '')
        .replace(/\s+onder\s+\w+/gi, '')
        .trim();
      
      // Check if format is "book:article" (e.g., "7:800" for BW)
      // ONLY apply book parsing for Burgerlijk Wetboek - other laws like AWB use X:Y as the full article number
      const regulationLowerForBookCheck = regulation.toLowerCase();
      const isBurgerlijkWetboek = regulationLowerForBookCheck.includes('burgerlijk wetboek') || 
                                   regulationLowerForBookCheck.includes('bw boek') ||
                                   regulationLowerForBookCheck.match(/\bbw\s*\d/);
      
      const colonMatch = articleNumClean.match(/^(\d+):(\d+\w*)$/);
      if (colonMatch && isBurgerlijkWetboek) {
        // For Burgerlijk Wetboek: "7:800" means Book 7, Article 800
        bookNumber = colonMatch[1];
        articleBase = colonMatch[2];
        console.log(`📖 Parsed as Book ${bookNumber}, Article ${articleBase} (Burgerlijk Wetboek format)`);
      } else if (colonMatch) {
        // For other laws like AWB: "3:4" is the full article number, not book:article
        console.log(`📖 Article "${articleBase}" contains colon but NOT Burgerlijk Wetboek - keeping full article number`);
      }
      
      console.log(`📖 Article base for EXACT match: "${articleBase}"`);
      
      // STEP 1: First, find the bwb_id for this regulation
      // Do a semantic search to find matching documents and extract their bwb_id
      const searchText = `artikel ${articleBase} ${regulation}`;
      console.log(`🔍 Step 1: Finding bwb_id for regulation "${regulation}"`);
      
      // Check if user specified a specific book number in the regulation name
      // E.g., "Burgerlijk Wetboek Boek 7" -> requiredBookNumber = "7"
      const regulationLower = regulation.toLowerCase();
      const bookMatch = regulationLower.match(/boek\s+(\d+)/i);
      const requiredBookNumber = bookMatch ? bookMatch[1] : null;
      
      if (requiredBookNumber) {
        console.log(`📖 User specified Boek ${requiredBookNumber} - will only match this book`);
      } else {
        console.log(`📖 No specific book number specified - will match any book`);
      }
      
      let bwbId: string | null = null;
      
      // Search with just article_number filter first to find the bwb_id
      const discoveryResults = await searchVectors({
        text: searchText,
        topK: 50, // Higher topK to find specific book
        scoreThreshold: 0,
        namespace: 'laws-current',
        filter: {
          article_number: { $eq: articleBase },
          is_current: { $eq: true }
        }
      });
      
      console.log(`📊 Discovery search returned ${discoveryResults.length} results`);
      
      // Find the bwb_id that matches the regulation name
      const stopWords = ['de', 'het', 'van', 'inzake', 'en', 'over', 'artikel', 'artikelen', 'wet', 'verdrag', 'boek'];
      const regulationWords = regulationLower
        .split(/\s+/)
        .map(w => w.replace(/[^a-z0-9-]/gi, ''))
        .filter(w => w.length > 2 && !stopWords.includes(w));
      
      console.log(`📊 Regulation keywords: ${JSON.stringify(regulationWords)}`);
      
      // Find bwb_id from results that match the regulation name
      for (const result of discoveryResults) {
        const resultTitle = String(result.metadata?.title || '').toLowerCase();
        const resultBoekTitel = String(result.metadata?.boek_titel || '').toLowerCase();
        const combinedText = `${resultTitle} ${resultBoekTitel}`;
        
        // Check if all regulation words are present (excluding book number)
        const matchesAll = regulationWords.every(word => combinedText.includes(word));
        
        if (!matchesAll) continue;
        
        // If user specified a book number, require EXACT match
        if (requiredBookNumber) {
          // Title must contain "boek X" where X is the exact book number
          const titleBookMatch = combinedText.match(/boek\s+(\d+)/);
          const titleBookNumber = titleBookMatch ? titleBookMatch[1] : null;
          
          if (titleBookNumber !== requiredBookNumber) {
            console.log(`  ❌ Skipping "${resultTitle.substring(0, 40)}" - book ${titleBookNumber} != required ${requiredBookNumber}`);
            continue;
          }
          console.log(`  ✅ Matched book ${requiredBookNumber}: "${resultTitle.substring(0, 40)}"`);
        }
        
        if (result.metadata?.bwb_id) {
          bwbId = result.metadata.bwb_id;
          console.log(`✅ Found matching bwb_id: ${bwbId} from title: "${resultTitle.substring(0, 50)}"`);
          break;
        }
      }
      
      if (!bwbId) {
        console.log(`⚠️ Could not find bwb_id for regulation "${regulation}"`);
        // Return empty results - no matching regulation found
        return res.json({
          regulation,
          articleNumber,
          parsedArticle: { bookNumber, articleBase },
          results: [],
          totalResults: 0,
          searchType: 'exact',
          namespace: 'laws-current',
          message: `Geen wet/verdrag gevonden met naam "${regulation}"`
        });
      }
      
      // STEP 2: Now search with EXACT bwb_id + article_number filter
      console.log(`🔍 Step 2: Searching with bwb_id="${bwbId}" + article_number="${articleBase}"`);
      
      const results = await searchVectors({
        text: searchText,
        topK: topK,
        scoreThreshold: 0,
        namespace: 'laws-current',
        filter: {
          bwb_id: { $eq: bwbId },
          article_number: { $eq: articleBase },
          is_current: { $eq: true }
        }
      });
      
      console.log(`📊 Exact bwb_id + article_number filter returned ${results.length} results`);
      
      // Debug: Log sample results with boek_titel
      if (results.length > 0) {
        const sampleArticles = results.slice(0, 5).map((r: any) => ({
          article: r.metadata?.article_number,
          bwbId: r.metadata?.bwb_id,
          boekTitel: r.metadata?.boek_titel?.substring(0, 30),
          sectionTitle: r.metadata?.section_title?.substring(0, 30)
        }));
        console.log(`📊 Sample results:`, JSON.stringify(sampleArticles, null, 2));
      }
      
      // Sort by boek_nummer then chunk_index to group variants together
      results.sort((a: any, b: any) => {
        const boekA = a.metadata?.boek_nummer || '';
        const boekB = b.metadata?.boek_nummer || '';
        if (boekA !== boekB) return boekA.localeCompare(boekB);
        
        const chunkA = a.metadata?.chunk_index || 0;
        const chunkB = b.metadata?.chunk_index || 0;
        return chunkA - chunkB;
      });

      // Format results with boek_titel and section_title for variant display
      const formattedResults = results.map((result: any, idx: number) => {
        const realArticleNumber = result.metadata?.article_number;
        const displayNumber = bookNumber ? `${bookNumber}:${realArticleNumber}` : realArticleNumber;
        
        // boek_titel tells us which part: Verdrag, Uitvoeringsreglement, Protocol
        const boekTitel = result.metadata?.boek_titel || result.metadata?.title || '';
        const boekNummer = result.metadata?.boek_nummer || '';
        const sectionTitle = result.metadata?.section_title || '';
        
        console.log(`  📝 Result ${idx + 1}: art. ${realArticleNumber} | ${boekTitel.substring(0, 40)} | ${sectionTitle.substring(0, 30)}`);
        
        return {
          id: result.id,
          rank: idx + 1,
          score: result.score,
          scorePercent: (result.score * 100).toFixed(1) + '%',
          bwbId: result.metadata?.bwb_id,
          title: result.metadata?.title,
          articleNumber: realArticleNumber,
          displayArticleNumber: realArticleNumber,
          // New fields for variant display
          boekTitel: boekTitel,
          boekNummer: boekNummer,
          sectionTitle: sectionTitle,
          structurePath: result.metadata?.structure_path,
          paragraphNumber: result.metadata?.paragraph_number,
          validFrom: result.metadata?.valid_from,
          validTo: result.metadata?.valid_to,
          isCurrent: result.metadata?.is_current ?? true,
          text: result.text || result.metadata?.text,
          chunkIndex: result.metadata?.chunk_index,
          citatie: `art. ${displayNumber} ${boekTitel || result.metadata?.title || ''}`,
          bronUrl: result.metadata?.bwb_id 
            ? `https://wetten.overheid.nl/${result.metadata.bwb_id}`
            : null
        };
      });

      // Determine if these are exact matches or related articles
      const isExactMatch = formattedResults.length > 0;
      const searchType = isExactMatch ? 'exact' : 'related';
      
      res.json({
        regulation,
        articleNumber,
        parsedArticle: { bookNumber, articleBase },
        bwbId: bwbId,
        results: formattedResults,
        totalResults: formattedResults.length,
        searchType,
        namespace: 'laws-current'
      });

    } catch (error: any) {
      console.error('Error in specific article search:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij zoeken naar specifiek artikel' 
      });
    }
  });

  // Gemeente codes for DSO API
  const GEMEENTEN = [
    { naam: "Amsterdam", code: "gm0363" },
    { naam: "Rotterdam", code: "gm0599" },
    { naam: "Den Haag", code: "gm0518" },
    { naam: "Utrecht", code: "gm0344" },
    { naam: "Eindhoven", code: "gm0772" },
    { naam: "Groningen", code: "gm0014" },
    { naam: "Tilburg", code: "gm0855" },
    { naam: "Almere", code: "gm0034" },
    { naam: "Breda", code: "gm0758" },
    { naam: "Nijmegen", code: "gm0268" },
    { naam: "Apeldoorn", code: "gm0200" },
    { naam: "Arnhem", code: "gm0202" },
    { naam: "Haarlem", code: "gm0392" },
    { naam: "Enschede", code: "gm0153" },
    { naam: "Haarlemmermeer", code: "gm0394" },
    { naam: "Amersfoort", code: "gm0307" },
    { naam: "Zaanstad", code: "gm0479" },
    { naam: "'s-Hertogenbosch", code: "gm0796" },
    { naam: "Zwolle", code: "gm0193" },
    { naam: "Leiden", code: "gm0546" },
    { naam: "Leeuwarden", code: "gm0080" },
    { naam: "Maastricht", code: "gm0935" },
    { naam: "Dordrecht", code: "gm0505" },
    { naam: "Zoetermeer", code: "gm0637" },
    { naam: "Deventer", code: "gm0150" },
    { naam: "Delft", code: "gm0503" },
    { naam: "Venlo", code: "gm0983" },
    { naam: "Alkmaar", code: "gm0361" },
    { naam: "Emmen", code: "gm0114" },
    { naam: "Westland", code: "gm1783" },
    { naam: "Sittard-Geleen", code: "gm1883" },
    { naam: "Helmond", code: "gm0794" },
    { naam: "Hilversum", code: "gm0402" },
    { naam: "Heerlen", code: "gm0917" },
    { naam: "Oss", code: "gm0828" },
    { naam: "Amstelveen", code: "gm0362" },
    { naam: "Roosendaal", code: "gm1674" },
    { naam: "Purmerend", code: "gm0439" },
    { naam: "Schiedam", code: "gm0606" },
    { naam: "Spijkenisse", code: "gm0612" },
    { naam: "Lelystad", code: "gm0995" },
    { naam: "Alphen aan den Rijn", code: "gm0484" },
    { naam: "Gouda", code: "gm0513" },
    { naam: "Hoorn", code: "gm0405" },
    { naam: "Almelo", code: "gm0141" },
    { naam: "Vlaardingen", code: "gm0622" },
    { naam: "Bergen op Zoom", code: "gm0748" },
    { naam: "Assen", code: "gm0106" },
    { naam: "Capelle aan den IJssel", code: "gm0502" },
    { naam: "Nieuwegein", code: "gm0356" },
  ];

  // Get list of available gemeenten
  app.get('/api/wetgeving/gemeenten', (req, res) => {
    res.json(GEMEENTEN);
  });

  // Search local legislation via DSO API
  // Note: The DSO Presenteren API v8 doesn't support text search (zoekterm)
  // Instead, we fetch all regelingen and filter client-side, or use geo-search
  app.post('/api/wetgeving/search-local', async (req, res) => {
    try {
      const { query, gemeenteCode, gemeenteNaam } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Zoekopdracht is verplicht' });
      }
      
      if (!gemeenteCode || typeof gemeenteCode !== 'string') {
        return res.status(400).json({ error: 'Gemeente is verplicht' });
      }

      const DSO_API_KEY = process.env.DSO_API_KEY;
      // Try pre-production first (some API keys only work there)
      const DSO_BASE_URL = process.env.DSO_BASE_URL || "https://service.pre.omgevingswet.overheid.nl/publiek/omgevingsdocumenten/api/presenteren/v8";
      
      if (!DSO_API_KEY) {
        return res.status(500).json({ error: 'DSO API key niet geconfigureerd' });
      }

      console.log(`🏛️ DSO API SEARCH`);
      console.log(`🔍 Query: "${query}"`);
      console.log(`🏛️ Gemeente: "${gemeenteNaam}" (${gemeenteCode})`);
      
      // Fetch all regelingen (the API doesn't support text search)
      // We'll filter results based on the query text afterward
      const searchUrl = `${DSO_BASE_URL}/regelingen`;
      console.log(`📡 Calling: ${searchUrl}`);
      
      const response = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/hal+json',
          'X-Api-Key': DSO_API_KEY
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`DSO API error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ 
          error: `DSO API fout: ${response.status}`,
          details: errorText
        });
      }
      
      const data = await response.json();
      let regelingen = data._embedded?.regelingen || [];
      
      console.log(`📊 Found ${regelingen.length} total regelingen`);
      
      // Log available gemeente codes and titles for debugging
      const availableCodes = [...new Set(regelingen.map((r: any) => r.bevoegdGezag?.code).filter(Boolean))];
      console.log(`📊 Available bevoegdGezag codes: ${availableCodes.slice(0, 10).join(', ') || '(none)'}${availableCodes.length > 10 ? '...' : ''}`);
      
      // Extract gemeente names from titles (e.g., "Omgevingsplan gemeente Groningen")
      const gemeenteNamesInTitles = regelingen
        .map((r: any) => {
          const titel = r.officieleTitel || r.citeerTitel || '';
          const match = titel.match(/gemeente\s+([A-Za-z\s\-']+)/i);
          return match ? match[1].trim() : null;
        })
        .filter(Boolean);
      const uniqueGemeenten = [...new Set(gemeenteNamesInTitles)];
      console.log(`📊 Gemeenten in titels: ${uniqueGemeenten.join(', ') || '(none)'}`);
      
      // Filter by gemeente - use multiple matching strategies
      const gemeenteCodeLower = gemeenteCode.toLowerCase();
      const gemeenteNaamLower = (gemeenteNaam || '').toLowerCase();
      
      const filteredByGemeente = regelingen.filter((r: any) => {
        const bgCode = (r.bevoegdGezag?.code || '').toLowerCase();
        const bgNaam = (r.bevoegdGezag?.naam || r.bevoegdGezag?.waarde || '').toLowerCase();
        const titel = (r.officieleTitel || r.citeerTitel || '').toLowerCase();
        
        // Match on:
        // 1. bevoegdGezag code matches gemeente code
        // 2. bevoegdGezag naam contains gemeente name
        // 3. Title contains "gemeente [naam]" (e.g., "Omgevingsplan gemeente Heerlen")
        return bgCode === gemeenteCodeLower || 
               (gemeenteNaamLower && bgNaam.includes(gemeenteNaamLower)) ||
               (gemeenteNaamLower && titel.includes(`gemeente ${gemeenteNaamLower}`)) ||
               (gemeenteNaamLower && titel.includes(gemeenteNaamLower));
      });
      
      console.log(`📊 After gemeente filter: ${filteredByGemeente.length} regelingen (looking for "${gemeenteNaamLower}")`);
      
      // Always use gemeente-filtered results (strict filtering)
      regelingen = filteredByGemeente;
      
      // Filter by query text in title or type
      if (query.trim()) {
        const queryLower = query.toLowerCase();
        regelingen = regelingen.filter((r: any) => {
          const titel = (r.officieleTitel || r.citeerTitel || '').toLowerCase();
          // type can be an object or string, handle both cases
          const typeStr = typeof r.type === 'string' ? r.type : (r.type?.waarde || '');
          const type = typeStr.toLowerCase();
          return titel.includes(queryLower) || type.includes(queryLower);
        });
        console.log(`📊 After query filter: ${regelingen.length} regelingen`);
      }
      
      // Format results
      const formattedResults = regelingen.map((regeling: any, idx: number) => ({
        id: regeling.identificatie,
        rank: idx + 1,
        titel: regeling.officieleTitel || regeling.citeerTitel || 'Onbekende regeling',
        citeerTitel: regeling.citeerTitel,
        type: regeling.type,
        bevoegdGezag: regeling.bevoegdGezag?.naam,
        bevoegdGezagCode: regeling.bevoegdGezag?.code,
        publicatiedatum: regeling.publicatiedatum,
        inwerkingtreding: regeling.datumInwerkingtreding,
        links: regeling._links
      }));

      res.json({
        query,
        gemeenteCode,
        results: formattedResults,
        totalResults: formattedResults.length
      });

    } catch (error: any) {
      console.error('Error in DSO API search:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij zoeken via DSO API' 
      });
    }
  });

  // Get document text from DSO API
  app.post('/api/wetgeving/document-text', async (req, res) => {
    try {
      const { identificatie } = req.body;
      
      if (!identificatie || typeof identificatie !== 'string') {
        return res.status(400).json({ error: 'Document identificatie is verplicht' });
      }

      const DSO_API_KEY = process.env.DSO_API_KEY;
      const DSO_BASE_URL = process.env.DSO_BASE_URL || "https://service.pre.omgevingswet.overheid.nl/publiek/omgevingsdocumenten/api/presenteren/v8";
      
      if (!DSO_API_KEY) {
        return res.status(500).json({ error: 'DSO API key niet geconfigureerd' });
      }

      console.log(`📄 DSO API GET DOCUMENT TEXT`);
      console.log(`🔍 Identificatie: "${identificatie}"`);
      
      // Convert identificatie to URL format (/ becomes _)
      const urlId = identificatie.replace(/\//g, '_');
      
      // Get metadata first to get tekststructuur link
      const metaUrl = `${DSO_BASE_URL}/regelingen/${urlId}`;
      console.log(`📡 Getting metadata: ${metaUrl}`);
      
      const metaResponse = await fetch(metaUrl, {
        headers: {
          'Accept': 'application/hal+json',
          'X-Api-Key': DSO_API_KEY
        }
      });
      
      if (!metaResponse.ok) {
        const errorText = await metaResponse.text();
        console.error(`DSO API metadata error: ${metaResponse.status} - ${errorText}`);
        return res.status(metaResponse.status).json({ 
          error: `DSO API fout bij ophalen metadata: ${metaResponse.status}`,
          details: errorText
        });
      }
      
      const meta = await metaResponse.json();
      
      // Check if tekststructuur link exists
      if (!meta._links?.tekststructuur?.href) {
        return res.status(404).json({ 
          error: 'Geen tekststructuur beschikbaar voor dit document'
        });
      }
      
      // Get full text via tekststructuur
      const tekstUrl = meta._links.tekststructuur.href;
      console.log(`📡 Getting text: ${tekstUrl}`);
      
      const tekstResponse = await fetch(tekstUrl, {
        headers: {
          'Accept': 'application/hal+json',
          'X-Api-Key': DSO_API_KEY
        }
      });
      
      if (!tekstResponse.ok) {
        const errorText = await tekstResponse.text();
        console.error(`DSO API tekst error: ${tekstResponse.status} - ${errorText}`);
        return res.status(tekstResponse.status).json({ 
          error: `DSO API fout bij ophalen tekst: ${tekstResponse.status}`,
          details: errorText
        });
      }
      
      const tekstData = await tekstResponse.json();
      
      // Parse text structure to readable format
      function parseTextStructure(data: any): { markdown: string, sections: any[] } {
        const parts: string[] = [];
        const sections: any[] = [];
        
        function extractText(obj: any): string {
          if (!obj) return '';
          if (typeof obj === 'string') return obj;
          if (obj.waarde) return obj.waarde;
          return '';
        }
        
        function processComponent(component: any, depth = 0) {
          // Build header
          const headerParts = [component.label, component.nummer, extractText(component.opschrift)]
            .filter(Boolean);
          const header = headerParts.join(' ');
          
          if (header) {
            parts.push('#'.repeat(Math.min(depth + 1, 6)) + ' ' + header);
            sections.push({
              level: depth,
              header,
              label: component.label,
              nummer: component.nummer
            });
          }
          
          // Extract content (contains XML, strip tags)
          if (component.inhoud) {
            const cleanText = component.inhoud
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (cleanText) {
              parts.push(cleanText);
            }
          }
          
          // Recursively process nested components
          const children = component._embedded?.tekststructuurDocumentComponenten || [];
          children.forEach((child: any) => processComponent(child, depth + 1));
        }
        
        const topComponents = tekstData._embedded?.tekststructuurDocumentComponenten || [];
        topComponents.forEach((c: any) => processComponent(c, 0));
        
        return {
          markdown: parts.join('\n\n'),
          sections
        };
      }
      
      const parsed = parseTextStructure(tekstData);
      
      res.json({
        identificatie,
        titel: meta.officieleTitel || meta.citeerTitel || 'Onbekend document',
        citeerTitel: meta.citeerTitel,
        bevoegdGezag: meta.bevoegdGezag?.naam,
        publicatiedatum: meta.publicatiedatum,
        markdown: parsed.markdown,
        sections: parsed.sections
      });

    } catch (error: any) {
      console.error('Error getting document text:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij ophalen document tekst' 
      });
    }
  });

  // Generate AI query for local legislation based on case context
  app.post('/api/wetgeving/generate-local-query', async (req, res) => {
    try {
      const { caseId } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is verplicht' });
      }

      // Get case details and analysis
      const caseData = await db
        .select()
        .from(cases)
        .where(eq(cases.id, caseId))
        .limit(1);

      if (!caseData || caseData.length === 0) {
        return res.status(404).json({ error: 'Zaak niet gevonden' });
      }

      const currentCase = caseData[0];

      // Get latest analysis
      const analysisRecords = await db
        .select()
        .from(analyses)
        .where(eq(analyses.caseId, caseId))
        .orderBy(desc(analyses.createdAt))
        .limit(1);

      const analysis = analysisRecords?.[0];
      
      // Build context from case and analysis
      let context = `Zaak: ${currentCase.title || 'Onbekend'}\n`;
      context += `Type: ${currentCase.category || 'Onbekend'}\n`;
      
      if (currentCase.description) {
        context += `Samenvatting: ${currentCase.description}\n`;
      }
      
      if (analysis) {
        const rkos = (analysis as any).succesKansAnalysis;
        if (rkos) {
          if (typeof rkos === 'object' && rkos.advice) {
            context += `\nJuridisch advies:\n${rkos.advice}`;
          }
        }
      }

      console.log(`🤖 Generating local legislation query for case ${caseId}`);
      
      // Use OpenAI to generate a search query AND determine the municipality
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Je bent een Nederlandse juridisch expert. Je analyseert juridische zaken om te bepalen:
1. Welke gemeente relevant is voor lokale wetgeving (omgevingsplannen, verordeningen)
2. Een effectieve zoekopdracht voor lokale regelgeving

Bepaal de GEMEENTE (niet de plaats) waar het geschil zich afspeelt. Dit is de gemeente wiens lokale regels van toepassing zijn. Let op:
- Een stad kan onderdeel zijn van een grotere gemeente
- Kijk naar waar het object/de situatie zich bevindt, niet waar partijen wonen
- Bij twijfel, noem geen gemeente

Geef je antwoord in exact dit JSON formaat:
{
  "municipality": "naam van de gemeente of null indien onbekend",
  "query": "korte zoekopdracht van 5-10 woorden"
}

Geef ALLEEN de JSON terug, geen uitleg.`
          },
          {
            role: 'user',
            content: `Analyseer deze zaak en bepaal de relevante gemeente en zoekopdracht voor lokale wetgeving:\n\n${context}`
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || '{}';
      
      let generatedQuery = '';
      let municipality = '';
      
      try {
        // Parse JSON response
        const parsed = JSON.parse(responseText);
        generatedQuery = parsed.query || '';
        municipality = parsed.municipality || '';
        if (municipality === 'null' || municipality === null) {
          municipality = '';
        }
      } catch (e) {
        // Fallback: use the text as query if JSON parsing fails
        generatedQuery = responseText.replace(/[{}"]/g, '').trim();
      }
      
      console.log(`📝 Generated query: "${generatedQuery}"`);
      console.log(`🏛️ Determined municipality: "${municipality}"`);
      
      // Try to match municipality to gemeente code
      let gemeenteCode = '';
      if (municipality) {
        const municipalityLower = municipality.toLowerCase().trim();
        const matchedGemeente = GEMEENTEN.find(g => 
          g.naam.toLowerCase() === municipalityLower ||
          g.naam.toLowerCase().includes(municipalityLower) ||
          municipalityLower.includes(g.naam.toLowerCase())
        );
        if (matchedGemeente) {
          gemeenteCode = matchedGemeente.code;
          console.log(`✅ Matched to gemeente code: ${gemeenteCode}`);
        }
      }

      res.json({
        query: generatedQuery,
        municipality: municipality,
        gemeenteCode: gemeenteCode,
        context: context.substring(0, 200)
      });

    } catch (error: any) {
      console.error('Error generating local query:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij genereren van zoekopdracht' 
      });
    }
  });

  // Get saved wetgeving data for a case
  app.get('/api/wetgeving/:caseId', async (req, res) => {
    try {
      const { caseId } = req.params;
      
      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is required' });
      }

      // Find latest analysis with wetgeving data
      const analysisRecords = await db
        .select()
        .from(analyses)
        .where(eq(analyses.caseId, caseId))
        .orderBy(desc(analyses.createdAt));

      if (!analysisRecords || analysisRecords.length === 0) {
        return res.json({ searchResults: [], savedQuery: null });
      }

      // Find latest analysis that has legislation data
      const latestWithData = analysisRecords.find((a: any) => 
        a.legislationSearchResults && a.legislationSearchResults !== null
      );

      if (!latestWithData) {
        return res.json({ searchResults: [], savedQuery: null, articleEntries: [] });
      }

      const legislationData = (latestWithData as any).legislationSearchResults || {};

      res.json({
        searchResults: legislationData.results || [],
        savedQuery: legislationData.query || null,
        articleEntries: legislationData.articleEntries || [],
        lastSearchDate: legislationData.searchDate || null
      });

    } catch (error: any) {
      console.error('Error fetching wetgeving data:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij ophalen van wetgeving data' 
      });
    }
  });

  // Save wetgeving search results
  app.patch('/api/wetgeving/:caseId/save-search', async (req, res) => {
    try {
      const { caseId } = req.params;
      const { results, query, articleEntries } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is required' });
      }

      console.log(`💾 Saving ${results?.length || 0} legislation results for case ${caseId}`);

      // Find the latest analysis for this case
      const analysisRecords = await db
        .select()
        .from(analyses)
        .where(eq(analyses.caseId, caseId))
        .orderBy(desc(analyses.createdAt));

      if (!analysisRecords || analysisRecords.length === 0) {
        return res.status(404).json({ error: 'Geen analyse gevonden voor deze zaak' });
      }

      const latestAnalysis = analysisRecords[0];

      // Save legislation search results
      await db
        .update(analyses)
        .set({ 
          legislationSearchResults: {
            results: results || [],
            query: query || '',
            articleEntries: articleEntries || [],
            searchDate: new Date().toISOString()
          }
        })
        .where(eq(analyses.id, latestAnalysis.id));

      console.log('✅ Legislation search results saved to database');

      res.json({ 
        success: true,
        message: 'Wetgeving zoekresultaten opgeslagen' 
      });

    } catch (error: any) {
      console.error('Error saving legislation results:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij opslaan van wetgeving resultaten' 
      });
    }
  });

  // Get article commentary
  app.post('/api/wetgeving/commentary', async (req, res) => {
    try {
      const { bwbId, articleNumber, caseContext, forceRefresh } = req.body;
      
      if (!bwbId || !articleNumber) {
        return res.status(400).json({ 
          error: 'bwbId en articleNumber zijn verplicht' 
        });
      }
      
      console.log(`📚 Generating commentary for ${bwbId} art. ${articleNumber}${forceRefresh ? ' (force refresh)' : ''}`);
      
      const { getArticleCommentary } = await import('./services/commentaryService');
      
      const result = await getArticleCommentary(bwbId, articleNumber, caseContext, forceRefresh === true);
      
      res.json(result);
      
    } catch (error: any) {
      console.error('Error generating commentary:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij genereren van commentaar' 
      });
    }
  });

  // Get saved legislation for a case (from Supabase)
  app.get('/api/wetgeving/:caseId/saved', isAuthenticated, async (req, res) => {
    try {
      const { caseId } = req.params;
      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id;
      
      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is required' });
      }
      
      // Verify case ownership via Supabase
      const caseRecord = await caseService.getCaseByIdForUser(caseId, userId);
      
      if (!caseRecord) {
        return res.status(404).json({ error: 'Case not found' });
      }

      const savedItems = await savedLegislationService.getSavedForCase(caseId, userId);

      console.log(`📖 Retrieved ${savedItems.length} saved legislation items for case ${caseId} (Supabase)`);
      
      res.json(savedItems);
      
    } catch (error: any) {
      console.error('Error getting saved legislation:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij ophalen van opgeslagen wetgeving' 
      });
    }
  });

  // Save a legislation article (upsert) to Supabase
  app.post('/api/wetgeving/:caseId/saved', isAuthenticated, async (req, res) => {
    try {
      const { caseId } = req.params;
      const { article, commentary, sources } = req.body;
      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id;
      
      if (!caseId || !article) {
        return res.status(400).json({ error: 'Case ID and article are required' });
      }

      // Verify case ownership via Supabase
      const caseRecord = await caseService.getCaseByIdForUser(caseId, userId);
      
      if (!caseRecord) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // Save to Supabase using the service
      const result = await savedLegislationService.saveLegislation(
        caseId,
        userId,
        article,
        commentary,
        sources
      );
      
      res.json({ 
        success: true, 
        id: result.id,
        articleKey: result.articleKey,
        message: result.isUpdate ? 'Artikel bijgewerkt' : 'Artikel opgeslagen' 
      });
      
    } catch (error: any) {
      console.error('Error saving legislation:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij opslaan van wetgeving' 
      });
    }
  });

  // Delete a saved legislation article by articleKey (from Supabase)
  app.delete('/api/wetgeving/:caseId/saved/:articleKey', isAuthenticated, async (req, res) => {
    try {
      const { caseId, articleKey } = req.params;
      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id;
      
      if (!caseId || !articleKey) {
        return res.status(400).json({ error: 'Case ID and Article Key are required' });
      }
      
      // Verify case ownership via Supabase
      const caseRecord = await caseService.getCaseByIdForUser(caseId, userId);
      
      if (!caseRecord) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // Decode the articleKey (it's URL encoded)
      const decodedKey = decodeURIComponent(articleKey);

      await savedLegislationService.deleteSavedLegislation(caseId, decodedKey, userId);
      
      res.json({ 
        success: true, 
        articleKey: decodedKey,
        message: 'Artikel verwijderd' 
      });
      
    } catch (error: any) {
      console.error('Error deleting saved legislation:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij verwijderen van wetgeving' 
      });
    }
  });

  // Delete all saved legislation for a case (from Supabase)
  app.delete('/api/wetgeving/:caseId/saved', isAuthenticated, async (req, res) => {
    try {
      const { caseId } = req.params;
      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id;
      
      if (!caseId) {
        return res.status(400).json({ error: 'Case ID is required' });
      }
      
      // Verify case ownership via Supabase
      const caseRecord = await caseService.getCaseByIdForUser(caseId, userId);
      
      if (!caseRecord) {
        return res.status(404).json({ error: 'Case not found' });
      }

      const count = await savedLegislationService.deleteAllForCase(caseId, userId);
      
      res.json({ 
        success: true, 
        deletedCount: count,
        message: 'Alle artikelen verwijderd' 
      });
      
    } catch (error: any) {
      console.error('Error deleting all saved legislation:', error);
      res.status(500).json({ 
        error: error.message || 'Fout bij verwijderen van wetgeving' 
      });
    }
  });

  // === PCC (Project Command Center) ENDPOINTS ===
  // These endpoints are protected with a Bearer token for external monitoring systems
  
  // Helper to validate PCC Bearer token (uses constant-time comparison)
  function validatePccToken(req: any, res: any): boolean {
    const pccToken = process.env.PCC_FEED_TOKEN;
    if (!pccToken) {
      res.status(500).json({ error: 'PCC_FEED_TOKEN not configured' });
      return false;
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return false;
    }
    
    const token = authHeader.substring(7);
    
    // Use constant-time comparison to prevent timing attacks
    const tokenBuffer = Buffer.from(token);
    const pccTokenBuffer = Buffer.from(pccToken);
    
    if (tokenBuffer.length !== pccTokenBuffer.length || !timingSafeEqual(tokenBuffer, pccTokenBuffer)) {
      res.status(401).json({ error: 'Invalid token' });
      return false;
    }
    
    return true;
  }
  
  // GET /api/pcc/status - PCC Status Schema v1 endpoint
  // Field documentation:
  // - Real data: schema_version, project, environment.*, build.version, maturity.*, capabilities.*, integrations.*, health.*, links.*, generated_at
  // - Null/placeholder: build.last_deploy_at, build.git_commit_sha (needs env vars), last_major_change (hardcoded)
  app.get('/api/pcc/status', async (req, res) => {
    if (!validatePccToken(req, res)) return;
    
    try {
      const nodeEnv = process.env.NODE_ENV || 'development';
      const appEnv = process.env.APP_ENV || nodeEnv;
      const isProduction = appEnv === 'production' || nodeEnv === 'production';
      
      let dbOk = false;
      let lastErrorAt: string | null = null;
      
      // Check database connectivity using Drizzle query builder
      try {
        await db.select({ value: count() }).from(users).limit(1);
        dbOk = true;
      } catch (dbError: any) {
        dbOk = false;
        lastErrorAt = new Date().toISOString();
        console.error('PCC status: DB check failed:', dbError.message);
      }
      
      // Check Supabase connectivity
      let authOk = false;
      try {
        const { data, error } = await supabase.from('cases').select('id').limit(1);
        if (error) {
          authOk = false;
          lastErrorAt = lastErrorAt || new Date().toISOString();
          console.error('PCC status: Supabase check failed:', error.message);
        } else {
          authOk = true;
        }
      } catch (supaError: any) {
        authOk = false;
        lastErrorAt = lastErrorAt || new Date().toISOString();
        console.error('PCC status: Supabase check failed:', supaError.message);
      }
      
      // Check AI service (OpenAI/Azure)
      let aiOk: boolean | null = null;
      try {
        const hasAiKey = !!(process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY);
        aiOk = hasAiKey;
      } catch {
        aiOk = false;
      }
      
      const appVersion = process.env.APP_VERSION || '1.0.0';
      const lastDeployAt = process.env.DEPLOY_TIMESTAMP || null;
      const gitCommitSha = process.env.GIT_COMMIT_SHA || null;
      
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : process.env.BASE_URL || null;
      
      // Capabilities based on actual codebase implementation
      const coreFlows = [
        {
          id: 'case_management',
          name: 'Case Management',
          status: 'DONE' as const,
          user_accessible: true,
          description: 'Create, view, edit, and manage legal cases with status tracking',
          last_updated_at: null,
          notes: null
        },
        {
          id: 'document_upload',
          name: 'Document Upload',
          status: 'DONE' as const,
          user_accessible: true,
          description: 'Upload and store case documents (PDF, Word, images) to Supabase storage',
          last_updated_at: null,
          notes: null
        },
        {
          id: 'ai_case_analysis',
          name: 'AI Case Analysis',
          status: 'DONE' as const,
          user_accessible: true,
          description: 'AI-powered analysis of case documents and legal merit assessment',
          last_updated_at: null,
          notes: 'Uses OpenAI/MindStudio for RKOS analysis'
        },
        {
          id: 'summons_drafting',
          name: 'Summons Drafting',
          status: 'DONE' as const,
          user_accessible: true,
          description: 'Generate court summons (dagvaarding) from case data and templates',
          last_updated_at: null,
          notes: null
        },
        {
          id: 'legal_letter_generation',
          name: 'Legal Letter Generation',
          status: 'DONE' as const,
          user_accessible: true,
          description: 'AI-assisted generation of legal letters and correspondence',
          last_updated_at: null,
          notes: null
        }
      ];
      
      const supportingFeatures = [
        {
          id: 'jurisprudence_search',
          name: 'Jurisprudence Search',
          status: 'DONE' as const,
          user_accessible: true,
          description: 'Search and retrieve relevant case law from rechtspraak.nl',
          last_updated_at: null,
          notes: null
        },
        {
          id: 'legislation_lookup',
          name: 'Legislation Lookup',
          status: 'DONE' as const,
          user_accessible: true,
          description: 'Search and reference Dutch legislation from wetten.nl',
          last_updated_at: null,
          notes: null
        },
        {
          id: 'counterparty_invitations',
          name: 'Counterparty Invitations',
          status: 'DONE' as const,
          user_accessible: true,
          description: 'Invite counterparties to view and respond to cases',
          last_updated_at: null,
          notes: null
        },
        {
          id: 'warranty_tracking',
          name: 'Warranty Tracking',
          status: 'PARTIAL' as const,
          user_accessible: true,
          description: 'Track warranty periods and product guarantees',
          last_updated_at: null,
          notes: 'Basic implementation, needs refinement'
        },
        {
          id: 'chat_assistant',
          name: 'Chat Assistant',
          status: 'DONE' as const,
          user_accessible: true,
          description: 'AI chat assistant for legal Q&A within case context',
          last_updated_at: null,
          notes: null
        }
      ];
      
      const adminTools = [
        {
          id: 'user_management',
          name: 'User Management',
          status: 'PARTIAL' as const,
          user_accessible: false,
          description: 'Admin interface for managing users',
          last_updated_at: null,
          notes: 'Basic user listing available via database'
        }
      ];
      
      const limitations = [
        'No built-in payment processing',
        'Single language support (Dutch only)',
        'No offline mode',
        'Rate limits on AI analysis calls'
      ];
      
      // Integrations
      const integrations = {
        supabase: {
          used: true,
          auth_used: false,
          rls_used: true
        },
        ai: {
          provider: 'openai',
          deployments: [
            {
              name: 'gpt-4o',
              model: 'gpt-4o',
              purpose: 'Case analysis and legal document generation',
              status: aiOk ? 'operational' : 'error',
              last_error_at: null
            }
          ]
        },
        github: {
          repo: 'rechtstreeks/rechtstreeks-ai',
          status: 'connected'
        },
        other: [] as Array<{ name: string; status: string }>
      };
      
      const blockers: Array<{ title: string; severity: string; details: string; created_at: string }> = [];
      
      const response = {
        schema_version: 'pcc_status_v1',
        project: 'rechtstreeks',
        environment: {
          name: isProduction ? 'production' : 'dev',
          base_url: baseUrl,
          is_live: isProduction
        },
        build: {
          version: appVersion,
          last_deploy_at: lastDeployAt,
          git_commit_sha: gitCommitSha
        },
        maturity: {
          product_stage: 'beta' as const,
          user_stage: 'friendly_testers' as const,
          revenue_stage: 'none' as const
        },
        capabilities: {
          core_flows: coreFlows,
          supporting_features: supportingFeatures,
          admin_tools: adminTools,
          limitations
        },
        integrations,
        health: {
          api_ok: true,
          db_ok: dbOk,
          auth_ok: authOk,
          ai_ok: aiOk,
          last_error_at: lastErrorAt
        },
        blockers,
        last_major_change: {
          date: '2024-12-23',
          summary: 'Added PCC status feed endpoint with schema v1 compliance'
        },
        links: {
          app_home: baseUrl,
          admin_home: baseUrl ? `${baseUrl}/admin` : null,
          repo: 'https://github.com/rechtstreeks/rechtstreeks-ai',
          docs: null
        },
        generated_at: new Date().toISOString()
      };
      
      res.json(response);
    } catch (error: any) {
      console.error('PCC status endpoint error:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });
  
  // GET /api/pcc/metrics - Metrics endpoint with range parameter
  // Field documentation:
  // - Real data: kpis.users_total, kpis.active_users, kpis.cases_total, kpis.cases_created, kpis.documents_uploaded, kpis.ai_runs
  // - Null placeholders: kpis.conversion_rate, errors.error_count, errors.error_rate, funnel (no analytics/events table yet)
  app.get('/api/pcc/metrics', async (req, res) => {
    if (!validatePccToken(req, res)) return;
    
    try {
      const range = req.query.range === '30d' ? '30d' : '7d';
      const daysBack = range === '30d' ? 30 : 7;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      
      let usersTotal: number | null = null;
      let activeUsers: number | null = null;
      let casesTotal: number | null = null;
      let casesCreated: number | null = null;
      let documentsUploaded: number | null = null;
      let aiRuns: number | null = null;
      let errorCount: number | null = null;
      let lastErrorAt: string | null = null;
      let queryError: string | null = null;
      
      try {
        // Use Drizzle query builder with proper parameterization
        
        // Total users
        const totalUsersResult = await db.select({ value: count() }).from(users);
        usersTotal = Number(totalUsersResult[0]?.value) || 0;
        
        // Active users in range (users who created or updated cases)
        const activeUsersResult = await db
          .select({ value: countDistinct(casesTable.ownerUserId) })
          .from(casesTable)
          .where(or(
            gte(casesTable.createdAt, startDate),
            gte(casesTable.updatedAt, startDate)
          ));
        activeUsers = Number(activeUsersResult[0]?.value) || 0;
        
        // Total cases
        const totalCasesResult = await db.select({ value: count() }).from(casesTable);
        casesTotal = Number(totalCasesResult[0]?.value) || 0;
        
        // Cases created in range
        const casesCreatedResult = await db
          .select({ value: count() })
          .from(casesTable)
          .where(gte(casesTable.createdAt, startDate));
        casesCreated = Number(casesCreatedResult[0]?.value) || 0;
        
        // Documents uploaded in range
        const docsResult = await db
          .select({ value: count() })
          .from(caseDocumentsTable)
          .where(gte(caseDocumentsTable.createdAt, startDate));
        documentsUploaded = Number(docsResult[0]?.value) || 0;
        
        // AI runs (analyses) in range
        const aiResult = await db
          .select({ value: count() })
          .from(analysesTable)
          .where(gte(analysesTable.createdAt, startDate));
        aiRuns = Number(aiResult[0]?.value) || 0;
        
      } catch (kpiError: any) {
        console.error('PCC metrics: KPI query failed:', kpiError.message);
        lastErrorAt = new Date().toISOString();
        queryError = kpiError.message;
      }
      
      const response = {
        project: 'rechtstreeks',
        range,
        kpis: {
          users_total: usersTotal,
          active_users: activeUsers,
          cases_total: casesTotal,
          cases_created: casesCreated,
          documents_uploaded: documentsUploaded,
          ai_runs: aiRuns,
          conversion_rate: null // Not tracked yet - no funnel/events table
        },
        errors: {
          error_count: errorCount, // Not tracked yet - no errors table
          error_rate: null, // Not tracked yet
          last_error_at: lastErrorAt,
          ...(queryError && { query_error: queryError })
        },
        funnel: {} // Not tracked yet - could add step counts with events table in future
      };
      
      res.json(response);
    } catch (error: any) {
      console.error('PCC metrics endpoint error:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

  // ============================================================
  // PCC Pull Endpoints (lightweight, for PCC refresh mechanism)
  // These endpoints are at /pcc/* (no /api prefix) and return
  // simple response formats that PCC expects for its pull/refresh.
  // Authentication via Bearer token (same as /api/pcc/* endpoints).
  // ============================================================

  // GET /pcc/status - Lightweight status for PCC pull
  // Returns: {"status": "operational", "uptime": 99.9}
  app.get('/pcc/status', async (req, res) => {
    if (!validatePccToken(req, res)) return;
    
    try {
      let status = 'operational';
      let uptime = 100.0;
      
      // Check database connectivity
      try {
        await db.select({ value: count() }).from(users).limit(1);
      } catch (dbError: any) {
        status = 'degraded';
        uptime = 95.0;
        console.error('PCC pull status: DB check failed:', dbError.message);
      }
      
      // Check Supabase connectivity
      try {
        const { error } = await supabase.from('cases').select('id').limit(1);
        if (error) {
          status = status === 'degraded' ? 'down' : 'degraded';
          uptime = status === 'down' ? 0 : 90.0;
        }
      } catch (supaError: any) {
        status = status === 'degraded' ? 'down' : 'degraded';
        uptime = status === 'down' ? 0 : 90.0;
        console.error('PCC pull status: Supabase check failed:', supaError.message);
      }
      
      res.json({
        status,
        uptime
      });
    } catch (error: any) {
      console.error('PCC pull status endpoint error:', error);
      res.json({ status: 'error', uptime: 0 });
    }
  });

  // GET /pcc/metrics - Lightweight metrics for PCC pull
  // Returns: {"avg_response_ms": 45, "error_rate": 0.1}
  app.get('/pcc/metrics', async (req, res) => {
    if (!validatePccToken(req, res)) return;
    
    try {
      // Measure a simple DB query to estimate response time
      const startTime = Date.now();
      try {
        await db.select({ value: count() }).from(users).limit(1);
      } catch {
        // Ignore errors for timing purposes
      }
      const avgResponseMs = Date.now() - startTime;
      
      // Error rate is not tracked yet, return 0
      const errorRate = 0;
      
      res.json({
        avg_response_ms: avgResponseMs,
        error_rate: errorRate
      });
    } catch (error: any) {
      console.error('PCC pull metrics endpoint error:', error);
      res.json({ avg_response_ms: 0, error_rate: 1.0 });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
