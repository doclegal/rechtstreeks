import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCaseSchema, insertDocumentSchema, type CaseStatus } from "@shared/schema";
import { aiService } from "./services/aiService";
import { fileService } from "./services/fileService";
import { pdfService } from "./services/pdfService";
import { mockIntegrations } from "./services/mockIntegrations";
import multer from "multer";
import { z } from "zod";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
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
      console.error("Error creating case:", error);
      res.status(500).json({ message: "Failed to create case" });
    }
  });

  app.get('/api/cases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userCases = await storage.getCasesByUser(userId);
      res.json(userCases);
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ message: "Failed to fetch cases" });
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
      const letters = await storage.getLettersByCase(caseData.id);
      const summons = await storage.getSummonsByCase(caseData.id);
      const progress = storage.computeProgress(caseData);
      
      res.json({
        ...caseData,
        documents,
        analysis,
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
        // Store file
        const storageKey = await fileService.storeFile(caseId, file);
        
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

  // Rate limiting for analyses (simple in-memory tracking)
  const analysisRateLimit = new Map<string, number>();

  // Analysis routes
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
      
      // Get all documents for analysis
      const documents = await storage.getDocumentsByCase(caseId);
      
      // Perform AI analysis with new method
      const analysisResult = await aiService.analyzeLegalCase(caseData, documents);
      
      // Save analysis to database
      const analysis = await storage.createAnalysis({
        caseId,
        model: aiService.getModel(), // Get model from service
        factsJson: analysisResult.facts,
        issuesJson: analysisResult.issues,
        missingDocsJson: analysisResult.missing_documents,
        legalBasisJson: analysisResult.legal_basis,
        riskNotesJson: analysisResult.risk_notes,
      });
      
      // Update case status to ANALYZED
      await storage.updateCase(caseId, {
        status: "ANALYZED",
        nextActionLabel: "Genereer brief"
      });
      
      // Create event with performance metrics (no PII)
      await storage.createEvent({
        caseId,
        actorUserId: userId,
        type: "CASE_ANALYZED",
        payloadJson: { 
          analysisId: analysis.id,
          latency: analysisResult.latency,
          tokens: analysisResult.tokens,
          model: aiService.getModel()
        },
      });
      
      // Update rate limit
      analysisRateLimit.set(rateLimitKey, now);
      
      res.json({
        id: analysis.id,
        facts: analysisResult.facts,
        issues: analysisResult.issues,
        missing_documents: analysisResult.missing_documents,
        claims: analysisResult.claims,
        defenses: analysisResult.defenses,
        legal_basis: analysisResult.legal_basis,
        risk_notes: analysisResult.risk_notes,
        createdAt: analysis.createdAt
      });
    } catch (error) {
      console.error("Error analyzing case:", error);
      res.status(500).json({ message: "Analyse mislukt. Probeer het opnieuw." });
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

  const httpServer = createServer(app);
  return httpServer;
}
