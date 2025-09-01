import puppeteer from "puppeteer";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

export class PDFService {
  private outputDir: string;

  constructor() {
    this.outputDir = process.env.PDF_OUTPUT_DIR || "./pdfs";
    this.ensureOutputDir();
  }

  private async ensureOutputDir() {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }

  async generatePDF(html: string, filename: string): Promise<string> {
    let browser;
    
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set Dutch locale and proper styling
      const styledHtml = `
        <!DOCTYPE html>
        <html lang="nl">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: 'Times New Roman', serif; 
              font-size: 12pt; 
              line-height: 1.6; 
              margin: 2cm;
              color: #333;
            }
            h1, h2, h3 { color: #1a365d; margin-top: 1em; }
            .letterhead { text-align: center; margin-bottom: 2em; border-bottom: 1px solid #ccc; padding-bottom: 1em; }
            .signature-block { margin-top: 3em; }
            table { width: 100%; border-collapse: collapse; margin: 1em 0; }
            th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
            th { background-color: #f5f5f5; }
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `;
      
      await page.setContent(styledHtml, { waitUntil: 'networkidle0' });
      
      const storageKey = `pdfs/${randomUUID()}_${filename}.pdf`;
      const outputPath = path.join(this.outputDir, storageKey);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      
      await page.pdf({
        path: outputPath,
        format: 'A4',
        margin: {
          top: '2cm',
          right: '2cm',
          bottom: '2cm',
          left: '2cm'
        },
        printBackground: true
      });
      
      return storageKey;
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw new Error("Failed to generate PDF");
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

export const pdfService = new PDFService();
