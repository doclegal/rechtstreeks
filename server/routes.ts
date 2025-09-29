import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCaseSchema, insertDocumentSchema, type CaseStatus } from "@shared/schema";
import { aiService, AIService } from "./services/aiService";
import { fileService } from "./services/fileService";
import { pdfService } from "./services/pdfService";
import { mockIntegrations } from "./services/mockIntegrations";
import { handleDatabaseError } from "./db";
import multer from "multer";
import { z } from "zod";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB aligned with route validation
});

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
      
      const newCase = await storage.createCase(caseData);
      
      // Create initial event
      await storage.createEvent({
        caseId: newCase.id,
        actorUserId: userId,
        type: "case_created",
        payloadJson: { caseId: newCase.id },
      });
      
      res.json(newCase);
    } catch (error) {
      const dbError = handleDatabaseError(error);
      res.status(dbError.status).json({ message: dbError.message });
    }
  });

  app.get('/api/cases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userCases = await storage.getCasesByUser(userId);
      
      // For each case, include analysis and other related data
      const casesWithDetails = await Promise.all(
        userCases.map(async (caseData) => {
          const documents = await storage.getDocumentsByCase(caseData.id);
          const analysis = await storage.getLatestAnalysis(caseData.id);
          const kantonAnalysis = await storage.getAnalysisByType(caseData.id, 'mindstudio-kanton-check');
          const fullAnalysis = await storage.getAnalysisByType(caseData.id, 'mindstudio-full-analysis');
          const letters = await storage.getLettersByCase(caseData.id);
          const summons = await storage.getSummonsByCase(caseData.id);
          const progress = storage.computeProgress(caseData);
          
          return {
            ...caseData,
            documents,
            analysis,
            kantonAnalysis,
            fullAnalysis,
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
      const caseData = await storage.getCase(req.params.id);
      
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      if (caseData.ownerUserId !== userId) {
        return res.status(403).json({ message: "Unauthorized access to case" });
      }
      
      // Include related data
      const documents = await storage.getDocumentsByCase(caseData.id);
      const analysis = await storage.getLatestAnalysis(caseData.id);
      const kantonAnalysis = await storage.getAnalysisByType(caseData.id, 'mindstudio-kanton-check');
      const fullAnalysis = await storage.getAnalysisByType(caseData.id, 'mindstudio-full-analysis');
      const letters = await storage.getLettersByCase(caseData.id);
      const summons = await storage.getSummonsByCase(caseData.id);
      const progress = storage.computeProgress(caseData);
      
      res.json({
        ...caseData,
        documents,
        analysis,
        kantonAnalysis,
        fullAnalysis,
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
      const caseData = await storage.getCase(req.params.id);
      
      if (!caseData || caseData.ownerUserId !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const updates = insertCaseSchema.partial().parse(req.body);
      const updatedCase = await storage.updateCase(req.params.id, updates);
      
      await storage.createEvent({
        caseId: updatedCase.id,
        actorUserId: userId,
        type: "case_updated",
        payloadJson: updates,
      });
      
      res.json(updatedCase);
    } catch (error) {
      console.error("Error updating case:", error);
      res.status(500).json({ message: "Failed to update case" });
    }
  });

  // Case deadlines endpoint
  app.get('/api/cases/:id/deadlines', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await storage.getCase(req.params.id);
      
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      if (caseData.ownerUserId !== userId) {
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

  // Document upload routes
  app.post('/api/cases/:id/uploads', isAuthenticated, upload.array('files'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const files = req.files as Express.Multer.File[];
      
      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const uploadedDocs = [];
      
      for (const file of files) {
        // Store file in both local storage and object storage
        const storageKey = await fileService.storeFile(caseId, file);
        
        let publicUrl = '';
        try {
          // Also store in object storage for public access
          const objectStorage = await fileService.storeFileToObjectStorage(caseId, file);
          publicUrl = objectStorage.publicUrl;
        } catch (error) {
          console.warn('Failed to store file in object storage:', error);
          // Continue with local storage only
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
        
        uploadedDocs.push(document);
      }
      
      // Update case status if this is first upload
      if (caseData.status === "NEW_INTAKE") {
        await storage.updateCaseStatus(
          caseId, 
          "DOCS_UPLOADED",
          "Analyse",
          "Start analyse"
        );
      } else {
        // Always update case timestamp to trigger analysis button state change
        await storage.touchCase(caseId);
      }
      
      // Create event
      await storage.createEvent({
        caseId,
        actorUserId: userId,
        type: "documents_uploaded",
        payloadJson: { count: uploadedDocs.length, filenames: uploadedDocs.map(d => d.filename) },
      });
      
      res.json(uploadedDocs);
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({ message: "Failed to upload documents" });
    }
  });

  app.get('/api/cases/:id/uploads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await storage.getCase(req.params.id);
      
      if (!caseData || caseData.ownerUserId !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const documents = await storage.getDocumentsByCase(req.params.id);
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
      const caseData = await storage.getCase(document.caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
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
      await storage.touchCase(document.caseId);
      
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
      
      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
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
          
          // Build comprehensive case details including document content
          let caseDetails = `Zaak: ${caseData.title}\n\nOmschrijving: ${caseData.description || 'Geen beschrijving'}\n\nTegenpartij: ${caseData.counterpartyName || 'Onbekend'}\n\nClaim bedrag: €${caseData.claimAmount || '0'}`;
          
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
            await storage.updateCase(caseId, { 
              status: "ANALYZED" as CaseStatus,
              nextActionLabel: "Start volledige analyse",
            });
          } else {
            await storage.updateCase(caseId, { 
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

  // Full Analysis route - second phase after successful kanton check
  app.post('/api/cases/:id/full-analyze', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Rate limiting: 1 full analysis per case per 5 minutes
      const rateLimitKey = `${caseId}:full-analyze`;
      const lastAnalysis = analysisRateLimit.get(rateLimitKey) || 0;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (now - lastAnalysis < fiveMinutes) {
        return res.status(429).json({ 
          message: "Te snel opnieuw geanalyseerd. Wacht 5 minuten tussen volledige analyses." 
        });
      }
      
      // Get case data and verify ownership
      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Check if case has been analyzed (kanton check passed)
      const latestAnalysis = await storage.getLatestAnalysis(caseId);
      if (!latestAnalysis) {
        return res.status(400).json({ 
          message: "Case must be analyzed first. Please run kanton check first." 
        });
      }

      // Verify MindStudio is available
      if (!process.env.MINDSTUDIO_API_KEY || !process.env.MINDSTUDIO_WORKER_ID) {
        return res.status(503).json({ 
          message: "Sorry, de volledige analyse lukt niet. Mindstudio AI is niet beschikbaar." 
        });
      }

      try {
        // Get user info
        const user = await storage.getUser(userId);
        const userName = user?.firstName || user?.email?.split('@')[0] || 'Gebruiker';
        
        // Get documents for analysis - convert to file URLs
        const documents = await storage.getDocumentsByCase(caseId);
        console.log('📄 Found documents for full analysis:', documents.length);
        
        const uploaded_files = documents.map(doc => ({
          name: doc.filename,
          file_url: doc.storageKey ? `${process.env.PUBLIC_BASE_URL || 'https://localhost:5000'}/api/documents/${doc.id}/download` : '',
          type: doc.filename.toLowerCase().endsWith('.pdf') ? 'pdf' as const :
                doc.filename.toLowerCase().endsWith('.docx') ? 'docx' as const :
                doc.filename.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/) ? 'img' as const : 'txt' as const
        }));

        // Check if there's a successful kanton check analysis
        // Look for any analysis that contains kanton check results (ok: true)
        const allAnalyses = await storage.getAnalysesByCase(caseId);
        let hasSuccessfulKantonCheck = false;
        let kantonCheckResult = null;
        
        for (const analysis of allAnalyses) {
          try {
            if (analysis.rawText) {
              const parsed = JSON.parse(analysis.rawText);
              if (parsed.ok === true && parsed.phase === 'kanton_check') {
                hasSuccessfulKantonCheck = true;
                kantonCheckResult = parsed;
                break;
              }
            }
          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }

        // For now, allow full analysis without strict kanton check validation
        // This removes the blocking behavior while keeping the check logic for future use
        if (!hasSuccessfulKantonCheck) {
          console.log('⚠️ No successful kanton check found, but allowing full analysis to proceed');
          // Set default values for kantonCheckResult
          kantonCheckResult = { ok: true, phase: 'kanton_check' };
        }

        // Prepare analysis parameters
        const fullAnalysisParams = {
          case_id: caseId,
          case_text: `Zaak: ${caseData.title}\n\nOmschrijving: ${caseData.description || 'Geen beschrijving'}\n\nTegenpartij: ${caseData.counterpartyName || 'Onbekend'}\n\nClaim bedrag: €${caseData.claimAmount || '0'}`,
          amount_eur: Number(caseData.claimAmount) || 0,
          parties: {
            claimant: {
              name: userName,
              type: 'individual'
            },
            defendant: {
              name: caseData.counterpartyName || 'Onbekend',
              type: 'individual'
            }
          },
          is_kantonzaak: kantonCheckResult?.ok || false,
          contract_present: documents.some(doc => 
            doc.filename.toLowerCase().includes('contract') || 
            doc.filename.toLowerCase().includes('overeenkomst') ||
            doc.filename.toLowerCase().includes('voorwaarden')
          ),
          forum_clause_text: null, // TODO: Extract from documents if present
          uploaded_files
        };

        console.log('🚀 Starting full analysis with params:', {
          case_id: fullAnalysisParams.case_id,
          case_text_length: fullAnalysisParams.case_text.length,
          amount_eur: fullAnalysisParams.amount_eur,
          is_kantonzaak: fullAnalysisParams.is_kantonzaak,
          contract_present: fullAnalysisParams.contract_present,
          uploaded_files_count: fullAnalysisParams.uploaded_files.length
        });
        
        // Run full analysis with MindStudio
        const fullAnalysisResult = await aiService.runFullAnalysis(fullAnalysisParams);
        
        console.log('🔍 Full analysis result:', fullAnalysisResult);
        
        if (fullAnalysisResult.success) {
          // Parse structured MindStudio analysis output
          const analysisData = fullAnalysisResult.parsedAnalysis;
          
          // Create a new analysis record with structured data from MindStudio
          const analysis = await storage.createAnalysis({
            caseId,
            model: 'mindstudio-full-analysis',
            rawText: fullAnalysisResult.rawText || JSON.stringify(fullAnalysisResult, null, 2),
            factsJson: analysisData?.facts ? [
              ...(analysisData.facts.known || []).map((fact: string) => ({ label: 'Vaststaande feiten', detail: fact })),
              ...(analysisData.facts.disputed || []).map((fact: string) => ({ label: 'Betwiste feiten', detail: fact })),
              ...(analysisData.facts.unclear || []).map((fact: string) => ({ label: 'Onduidelijke feiten', detail: fact }))
            ] : [{ label: 'Volledige Analyse', detail: 'Analyse uitgevoerd met alle documenten en context' }],
            issuesJson: analysisData?.legal_analysis?.legal_issues ? 
              analysisData.legal_analysis.legal_issues.map((issue: string) => ({ issue, risk: 'Zie juridische analyse' })) :
              [{ issue: 'Volledige juridische analyse voltooid', risk: 'Zie gedetailleerde resultaten' }],
            legalBasisJson: analysisData?.legal_analysis ? [{
              what_is_the_dispute: analysisData.legal_analysis.what_is_the_dispute || '',
              preliminary_assessment: analysisData.legal_analysis.preliminary_assessment || '',
              potential_defenses: analysisData.legal_analysis.potential_defenses || [],
              next_actions: analysisData.legal_analysis.next_actions || []
            }] : [],
            missingDocsJson: analysisData?.evidence?.missing || [],
            riskNotesJson: analysisData?.legal_analysis?.risks || []
          });
          
          // Update case status to indicate full analysis is complete
          await storage.updateCase(caseId, { 
            status: "ANALYZED" as CaseStatus,
            nextActionLabel: "Bekijk volledige analyse resultaten",
          });
          
          // Update rate limit
          analysisRateLimit.set(rateLimitKey, now);
          
          return res.json({ 
            analysis,
            fullAnalysisResult,
            status: 'completed',
            message: 'Volledige analyse succesvol voltooid'
          });
        } else {
          return res.status(500).json({ 
            message: "Volledige analyse mislukt. Probeer het opnieuw.",
            error: fullAnalysisResult.rawText
          });
        }
        
      } catch (error) {
        console.error("Full analysis failed:", error);
        return res.status(503).json({ 
          message: "Sorry, de volledige analyse lukt niet. Mindstudio AI is niet beschikbaar." 
        });
      }
    } catch (error) {
      console.error("Error running full analysis:", error);
      res.status(500).json({ message: "Volledige analyse mislukt. Probeer het opnieuw." });
    }
  });

  // Letter generation routes
  app.post('/api/cases/:id/letter', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const analysis = await storage.getLatestAnalysis(caseId);
      if (!analysis) {
        return res.status(400).json({ message: "Case must be analyzed first" });
      }
      
      // Get template
      const templates = await storage.getTemplates("letter");
      const template = templates[0]; // Use first active template
      
      if (!template) {
        return res.status(400).json({ message: "No letter template available" });
      }
      
      // Generate letter content
      const { html, markdown } = await aiService.draftLetter(caseData, analysis, template);
      
      // Generate PDF
      const pdfStorageKey = await pdfService.generatePDF(html, `letter_${caseId}`);
      
      // Save letter
      const letter = await storage.createLetter({
        caseId,
        templateId: template.id,
        html,
        markdown,
        pdfStorageKey,
        status: "draft",
      });
      
      // Update case status
      await storage.updateCaseStatus(
        caseId,
        "LETTER_DRAFTED",
        "Deurwaarder inschakelen",
        "Inschakelen deurwaarder"
      );
      
      // Create event
      await storage.createEvent({
        caseId,
        actorUserId: userId,
        type: "letter_drafted",
        payloadJson: { letterId: letter.id },
      });
      
      res.json(letter);
    } catch (error) {
      console.error("Error generating letter:", error);
      res.status(500).json({ message: "Failed to generate letter" });
    }
  });

  app.get('/api/cases/:id/letter/:letterId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const letter = await storage.getLetter(req.params.letterId);
      
      if (!letter) {
        return res.status(404).json({ message: "Letter not found" });
      }
      
      const caseData = await storage.getCase(letter.caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }
      
      res.json(letter);
    } catch (error) {
      console.error("Error fetching letter:", error);
      res.status(500).json({ message: "Failed to fetch letter" });
    }
  });

  // Summons generation routes
  app.post('/api/cases/:id/summons', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const analysis = await storage.getLatestAnalysis(caseId);
      if (!analysis) {
        return res.status(400).json({ message: "Case must be analyzed first" });
      }
      
      // Get template
      const templates = await storage.getTemplates("summons");
      const template = templates[0];
      
      if (!template) {
        return res.status(400).json({ message: "No summons template available" });
      }
      
      // Generate summons content
      const { html, markdown } = await aiService.draftSummons(caseData, analysis, template);
      
      // Generate PDF
      const pdfStorageKey = await pdfService.generatePDF(html, `summons_${caseId}`);
      
      // Save summons
      const summon = await storage.createSummons({
        caseId,
        templateId: template.id,
        html,
        markdown,
        pdfStorageKey,
        status: "draft",
      });
      
      // Update case status
      await storage.updateCaseStatus(
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
        payloadJson: { summonsId: summon.id },
      });
      
      res.json(summon);
    } catch (error) {
      console.error("Error generating summons:", error);
      res.status(500).json({ message: "Failed to generate summons" });
    }
  });

  // Mock integration routes
  app.post('/api/integrations/bailiff/serve', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.body;
      
      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Order bailiff service
      const result = await mockIntegrations.orderBailiffService(caseId);
      
      // Update case status
      await storage.updateCaseStatus(
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
        const caseData = await storage.getCase(caseId);
        if (caseData) {
          await storage.updateCaseStatus(
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
      
      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Mock court filing
      const result = await mockIntegrations.fileWithCourt(caseId);
      
      // Update case status
      await storage.updateCaseStatus(
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
      
      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Update case status
      await storage.updateCaseStatus(
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
      
      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
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
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
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

  // File download routes
  app.get('/api/files/:storageKey', isAuthenticated, async (req: any, res) => {
    try {
      const storageKey = req.params.storageKey;
      const fileStream = await fileService.getFile(storageKey);
      
      if (!fileStream) {
        return res.status(404).json({ message: "File not found" });
      }
      
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Document download route by ID (for MindStudio access)
  app.get('/api/documents/:id/download', async (req: any, res) => {
    try {
      const documentId = req.params.id;
      
      // Get document from database
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Get file stream using storage key
      const fileStream = await fileService.getFile(document.storageKey);
      if (!fileStream) {
        return res.status(404).json({ message: "File not found in storage" });
      }
      
      // Set appropriate headers for MindStudio
      res.setHeader('Content-Type', document.mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  // Case export route
  app.get('/api/cases/:id/export', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
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
      
      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.ownerUserId !== userId) {
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

  const httpServer = createServer(app);
  return httpServer;
}
