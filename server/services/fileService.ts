import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import archiver from "archiver";
import { storage } from "../storage";

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

  async getFile(storageKey: string): Promise<NodeJS.ReadableStream | null> {
    try {
      const filePath = path.join(this.uploadDir, storageKey);
      await fs.access(filePath);
      
      const { createReadStream } = await import("fs");
      return createReadStream(filePath);
    } catch {
      return null;
    }
  }

  async extractText(file: Express.Multer.File): Promise<string> {
    try {
      const mimetype = file.mimetype.toLowerCase();
      
      if (mimetype === "application/pdf") {
        return await this.extractPdfText(file.buffer);
      } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        return await this.extractDocxText(file.buffer);
      } else if (mimetype === "message/rfc822" || file.originalname.endsWith(".eml")) {
        return await this.extractEmailText(file.buffer);
      } else if (mimetype.startsWith("image/")) {
        return `[Afbeelding: ${file.originalname}] - OCR niet beschikbaar in MVP`;
      }
      
      return `[Bestand: ${file.originalname}] - Tekstextractie niet ondersteund voor ${mimetype}`;
    } catch (error) {
      console.error("Error extracting text:", error);
      return `[Fout bij tekstextractie van ${file.originalname}]`;
    }
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      // Import pdf-parse dynamically
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      return data.text || "[Geen tekst gevonden in PDF]";
    } catch (error) {
      console.error("PDF parsing error:", error);
      return "[Fout bij PDF analyse]";
    }
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
