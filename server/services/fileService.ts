import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import archiver from "archiver";
import { storage } from "../storage";
import { Client } from "@replit/object-storage";
import { Readable } from "stream";

// Replit Object Storage client (lazy initialization to avoid startup crash)
let objectStorageClient: Client | null = null;

function getObjectStorageClient(): Client | null {
  if (objectStorageClient) return objectStorageClient;
  
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    console.warn('⚠️ Object storage not configured (no DEFAULT_OBJECT_STORAGE_BUCKET_ID)');
    return null;
  }
  
  try {
    objectStorageClient = new Client();
    console.log('✅ Object storage client initialized');
    return objectStorageClient;
  } catch (error) {
    console.error('❌ Failed to initialize object storage client:', error);
    return null;
  }
}

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
    const client = getObjectStorageClient();
    if (!client) {
      throw new Error("Object storage not configured");
    }
    
    const fileExtension = path.extname(file.originalname);
    const fileName = `${randomUUID()}${fileExtension}`;
    const objectPath = `.private/cases/${caseId}/uploads/${fileName}`;
    
    console.log(`📤 Uploading to object storage: ${objectPath}`);
    
    // Upload file to Replit Object Storage using SDK
    const result = await client.uploadFromBytes(
      objectPath,
      file.buffer
    );
    
    if (!result.ok) {
      console.error(`❌ Object storage upload failed:`, result.error);
      throw new Error(`Failed to upload to object storage: ${result.error.message}`);
    }
    
    console.log('✅ Uploaded to object storage successfully');
    
    // Return storage path (publicUrl will be empty - we use proxy endpoint instead)
    // The download endpoint will stream the file from object storage
    return {
      storageKey: objectPath,
      publicUrl: '' // Proxy endpoint will handle downloads
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
      const client = getObjectStorageClient();
      if (!client) {
        console.error("Object storage not configured");
        return null;
      }
      
      console.log(`📥 Downloading from object storage: ${storageKey}`);
      
      // Download file from Replit Object Storage using SDK
      const result = await client.downloadAsBytes(storageKey);
      
      if (!result.ok) {
        console.error(`❌ Object storage download failed:`, result.error);
        return null;
      }
      
      console.log('✅ Downloaded from object storage successfully');
      
      // Convert Uint8Array to Node.js readable stream
      const buffer = Buffer.from(result.value);
      return Readable.from(buffer);
    } catch (error) {
      console.error(`Error getting file from object storage: ${storageKey}`, error);
      return null;
    }
  }

  async generateSignedUrl(storageKey: string, expiresInHours: number = 1): Promise<string | null> {
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
      
      // Generate signed URL (valid for specified hours, default 1 hour)
      const [signedUrl] = await fileObject.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInHours * 60 * 60 * 1000,
      });
      
      console.log(`✅ Generated signed URL for ${storageKey} (valid for ${expiresInHours}h)`);
      
      return signedUrl;
    } catch (error) {
      console.error(`Error generating signed URL for ${storageKey}:`, error);
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
      } else if (mimetype === "text/plain" || file.originalname.endsWith(".txt")) {
        // Extract plain text files directly
        extractedText = file.buffer.toString('utf-8');
        console.log(`📄 Plain text file extracted: ${extractedText.length} characters`);
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
          // Extract text from PDF stream objects only (not metadata/structure)
          const bufferStr = buffer.toString('latin1');
          
          // Extract text from PDF stream objects between "stream" and "endstream"
          const streamMatches = bufferStr.match(/stream\s+([\s\S]+?)\s+endstream/gi) || [];
          const streamTexts = streamMatches.map(s => 
            s.replace(/^stream\s+/i, '').replace(/\s+endstream$/i, '')
          );
          
          // Also extract text from direct text objects (between parentheses or angle brackets)
          const textObjects = bufferStr.match(/\(([^)]{10,})\)/g) || [];
          const cleanedTexts = textObjects.map(t => t.slice(1, -1));
          
          // Combine and filter for meaningful text (Dutch/English words)
          const allText = [...streamTexts, ...cleanedTexts].join(' ');
          const words = allText.match(/[a-zA-Z]{3,}[\s\w.,€$£¥₹\d\-:/()]*[a-zA-Z]{2,}/g) || [];
          
          result = words
            .filter(word => word.length > 5 && !/^(obj|endobj|stream|endstream|Type|Pages|Catalog)$/i.test(word))
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
