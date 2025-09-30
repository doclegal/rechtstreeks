import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import archiver from "archiver";
import { storage } from "../storage";
import { Storage, File } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Object storage client
const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class FileService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || "./uploads";
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async storeFile(caseId: string, file: Express.Multer.File): Promise<string> {
    const fileExtension = path.extname(file.originalname);
    const storageKey = `cases/${caseId}/uploads/${randomUUID()}${fileExtension}`;
    const filePath = path.join(this.uploadDir, storageKey);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, file.buffer);
    
    return storageKey;
  }

  async storeFileToObjectStorage(caseId: string, file: Express.Multer.File): Promise<{ storageKey: string; publicUrl: string }> {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${randomUUID()}${fileExtension}`;
    const objectPath = `cases/${caseId}/uploads/${fileName}`;
    
    // Get private object directory from environment
    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateObjectDir) {
      throw new Error("PRIVATE_OBJECT_DIR not set. Object storage not configured.");
    }
    
    // Parse bucket and path from private object directory
    const { bucketName, objectName } = this.parseObjectPath(`${privateObjectDir}/${objectPath}`);
    
    // Upload file to object storage
    const bucket = objectStorageClient.bucket(bucketName);
    const fileObject = bucket.file(objectName);
    
    await fileObject.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          caseId: caseId,
          uploadedAt: new Date().toISOString()
        }
      }
    });
    
    // Generate signed URL (valid for 24 hours) instead of making public
    // This works even with public access prevention enabled
    const [signedUrl] = await fileObject.getSignedUrl({
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
    
    console.log('✅ Generated signed URL for MindStudio access:', signedUrl);
    
    return {
      storageKey: objectPath,
      publicUrl: signedUrl
    };
  }

  private parseObjectPath(path: string): { bucketName: string; objectName: string } {
    if (!path.startsWith("/")) {
      path = `/${path}`;
    }
    const pathParts = path.split("/");
    if (pathParts.length < 3) {
      throw new Error("Invalid path: must contain at least a bucket name");
    }

    const bucketName = pathParts[1];
    const objectName = pathParts.slice(2).join("/");

    return {
      bucketName,
      objectName,
    };
  }

  async getFile(storageKey: string): Promise<NodeJS.ReadableStream | null> {
    try {
      // First try local file system
      const filePath = path.join(this.uploadDir, storageKey);
      await fs.access(filePath);
      
      const { createReadStream } = await import("fs");
      return createReadStream(filePath);
    } catch {
      // If not found locally, try object storage
      try {
        return await this.getFileFromObjectStorage(storageKey);
      } catch (error) {
        console.error(`Failed to get file from object storage: ${storageKey}`, error);
        return null;
      }
    }
  }

  async getFileFromObjectStorage(storageKey: string): Promise<NodeJS.ReadableStream | null> {
    try {
      const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
      if (!privateObjectDir) {
        console.error("PRIVATE_OBJECT_DIR not set. Object storage not configured.");
        return null;
      }
      
      // Parse bucket and path from private object directory
      const fullPath = `${privateObjectDir}/${storageKey}`;
      const { bucketName, objectName } = this.parseObjectPath(fullPath);
      
      const bucket = objectStorageClient.bucket(bucketName);
      const fileObject = bucket.file(objectName);
      
      // Check if file exists
      const [exists] = await fileObject.exists();
      if (!exists) {
        console.error(`File not found in object storage: ${storageKey}`);
        return null;
      }
      
      // Create read stream from object storage
      return fileObject.createReadStream();
    } catch (error) {
      console.error(`Error getting file from object storage: ${storageKey}`, error);
      return null;
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, storageKey);
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Failed to delete file ${storageKey}:`, error);
      // Don't throw - file might already be deleted or not exist
    }
  }

  // Clean text to ensure UTF-8 compatibility and remove problematic characters
  private cleanTextForDatabase(text: string): string {
    if (!text) return text;
    
    // Remove null bytes and other problematic control characters
    let cleaned = text
      .replace(/\x00/g, '') // Remove null bytes (0x00)
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control chars except \t, \n, \r
      .replace(/\uFEFF/g, '') // Remove BOM (Byte Order Mark)
      .replace(/\uFFFF/g, '') // Remove replacement character
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''); // Remove control characters
    
    // Normalize unicode and trim excess whitespace
    cleaned = cleaned
      .normalize('NFD') // Normalize to decomposed form
      .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks if needed
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    console.log(`🧹 Text cleaned: ${text.length} → ${cleaned.length} characters`);
    
    return cleaned;
  }

  async extractText(file: Express.Multer.File): Promise<string> {
    try {
      const mimetype = file.mimetype.toLowerCase();
      let extractedText = "";
      
      if (mimetype === "application/pdf") {
        extractedText = await this.extractPdfText(file.buffer);
      } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        extractedText = await this.extractDocxText(file.buffer);
      } else if (mimetype === "message/rfc822" || file.originalname.endsWith(".eml")) {
        extractedText = await this.extractEmailText(file.buffer);
      } else if (mimetype.startsWith("image/")) {
        extractedText = `[Afbeelding: ${file.originalname}] - OCR niet beschikbaar in MVP`;
      } else {
        extractedText = `[Bestand: ${file.originalname}] - Tekstextractie niet ondersteund voor ${mimetype}`;
      }
      
      // Clean the extracted text to prevent UTF-8 database errors
      return this.cleanTextForDatabase(extractedText);
      
    } catch (error) {
      console.error("Error extracting text:", error);
      return this.cleanTextForDatabase(`[Fout bij tekstextractie van ${file.originalname}]`);
    }
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    console.log(`🔍 Parsing PDF: ${buffer.length} bytes`);
    
    // Try multiple approaches to extract PDF text reliably
    for (const approach of ['import', 'dynamic-require', 'minimal']) {
      try {
        console.log(`🔄 Trying PDF extraction approach: ${approach}`);
        
        let result: string | null = null;
        
        if (approach === 'import') {
          // Standard dynamic import (can fail due to pdf-parse bug)
          const pdfParse = (await import("pdf-parse")).default;
          const data = await pdfParse(buffer, { max: 0 });
          result = data?.text?.trim() || null;
          
        } else if (approach === 'dynamic-require') {
          // Use createRequire for ES module compatibility
          const { createRequire } = await import('module');
          const require = createRequire(import.meta.url);
          const pdfParse = require("pdf-parse");
          const data = await pdfParse(buffer);
          result = data?.text?.trim() || null;
          
        } else if (approach === 'minimal') {
          // Minimal text extraction from PDF buffer using basic string parsing
          // This is a very basic fallback that looks for readable text in the buffer
          const bufferStr = buffer.toString('latin1');
          const textMatches = bufferStr.match(/\w+[\s\w.,€$£¥₹\d\-:/()]+/g) || [];
          result = textMatches
            .filter(match => match.length > 3 && /[a-zA-Z]/.test(match))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim() || null;
        }
        
        if (result && result.length >= 50) {
          console.log(`✅ PDF parsed successfully with ${approach}: ${result.length} characters`);
          return result;
        } else if (result) {
          console.warn(`⚠️ ${approach} returned minimal content (${result.length} chars): "${result.substring(0, 100)}..."`);
        } else {
          console.warn(`⚠️ ${approach} returned no content`);
        }
        
      } catch (error) {
        console.error(`❌ PDF parsing with ${approach} failed:`, error);
        
        // Skip to next approach unless this is the last one
        if (approach === 'minimal') {
          throw error;
        }
      }
    }
    
    // If all approaches failed or returned minimal content
    return "[Geen leesbare tekst gevonden in PDF - probeer een andere bon of vul handmatig in]";
  }

  private async extractDocxText(buffer: Buffer): Promise<string> {
    try {
      // Import mammoth dynamically
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "[Geen tekst gevonden in DOCX]";
    } catch (error) {
      console.error("DOCX parsing error:", error);
      return "[Fout bij DOCX analyse]";
    }
  }

  private async extractEmailText(buffer: Buffer): Promise<string> {
    try {
      // Import mailparser dynamically
      const { simpleParser } = await import("mailparser");
      const email = await simpleParser(buffer);
      
      const parts = [];
      if (email.subject) parts.push(`Onderwerp: ${email.subject}`);
      if (email.from) parts.push(`Van: ${email.from.text}`);
      if (email.to) parts.push(`Aan: ${email.to.text}`);
      if (email.date) parts.push(`Datum: ${email.date.toLocaleDateString('nl-NL')}`);
      if (email.text) parts.push(`\nInhoud:\n${email.text}`);
      
      return parts.join('\n') || "[Geen inhoud gevonden in email]";
    } catch (error) {
      console.error("Email parsing error:", error);
      return "[Fout bij email analyse]";
    }
  }

  async exportCaseArchive(caseId: string): Promise<Buffer> {
    const caseData = await storage.getCase(caseId);
    if (!caseData) {
      throw new Error("Case not found");
    }

    const documents = await storage.getDocumentsByCase(caseId);
    const letters = await storage.getLettersByCase(caseId);
    const summons = await storage.getSummonsByCase(caseId);
    const events = await storage.getEventsByCase(caseId);

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      // Add case info
      archive.append(JSON.stringify(caseData, null, 2), { name: 'zaak_info.json' });
      
      // Add timeline
      archive.append(JSON.stringify(events, null, 2), { name: 'tijdlijn.json' });

      // Add documents
      documents.forEach(async (doc) => {
        try {
          const fileStream = await this.getFile(doc.storageKey);
          if (fileStream) {
            archive.append(fileStream, { name: `documenten/${doc.filename}` });
          }
        } catch (error) {
          console.error(`Error adding document ${doc.filename}:`, error);
        }
      });

      // Add generated letters and summons
      letters.forEach(async (letter) => {
        if (letter.pdfStorageKey) {
          try {
            const fileStream = await this.getFile(letter.pdfStorageKey);
            if (fileStream) {
              archive.append(fileStream, { name: `brieven/brief_${letter.id}.pdf` });
            }
          } catch (error) {
            console.error(`Error adding letter ${letter.id}:`, error);
          }
        }
      });

      summons.forEach(async (summon) => {
        if (summon.pdfStorageKey) {
          try {
            const fileStream = await this.getFile(summon.pdfStorageKey);
            if (fileStream) {
              archive.append(fileStream, { name: `dagvaardingen/dagvaarding_${summon.id}.pdf` });
            }
          } catch (error) {
            console.error(`Error adding summons ${summon.id}:`, error);
          }
        }
      });

      archive.finalize();
    });
  }
}

export const fileService = new FileService();
