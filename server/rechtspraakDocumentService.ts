import { parseStringPromise } from 'xml2js';

const CONTENT_BASE_URL = 'https://data.rechtspraak.nl/uitspraken/content';

export interface RechtspraakDocument {
  ecli: string;
  title: string;
  court: string;
  date: string;
  summary: string;
  fullText: string;
  url: string;
}

export interface TextChunk {
  text: string;
  index: number;
  totalChunks: number;
}

function extractTextContent(obj: any): string {
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map(extractTextContent).join(' ');
  if (obj && typeof obj === 'object') {
    if (obj._) return obj._;
    return Object.values(obj).map(extractTextContent).join(' ');
  }
  return '';
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

export async function fetchFullDocument(ecli: string): Promise<RechtspraakDocument> {
  try {
    const url = `${CONTENT_BASE_URL}?id=${encodeURIComponent(ecli)}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/xml'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();
    const result = await parseStringPromise(xmlText, { 
      explicitArray: false,
      mergeAttrs: true,
      trim: true
    });

    const openRechtspraak = result['open-rechtspraak'] || result;
    const rdf = openRechtspraak['rdf:RDF'] || openRechtspraak.RDF;
    const description = Array.isArray(rdf['rdf:Description']) 
      ? rdf['rdf:Description'][0] 
      : rdf['rdf:Description'];

    let fullText = '';
    
    const uitspraak = openRechtspraak.uitspraak || openRechtspraak['rs:uitspraak'];
    const conclusie = openRechtspraak.conclusie || openRechtspraak['rs:conclusie'];
    const inhoudsindicatie = openRechtspraak.inhoudsindicatie || openRechtspraak['rs:inhoudsindicatie'];
    
    const documentContent = uitspraak || conclusie;
    if (documentContent) {
      fullText = extractTextContent(documentContent);
    }

    if (inhoudsindicatie && !fullText.includes(extractTextContent(inhoudsindicatie))) {
      fullText = extractTextContent(inhoudsindicatie) + '\n\n' + fullText;
    }

    fullText = cleanText(fullText);

    const title = extractTextContent(description['dcterms:title'] || description.title || '');
    const date = extractTextContent(description['dcterms:date'] || description.date || '');
    const summary = extractTextContent(description['dcterms:abstract'] || description.abstract || inhoudsindicatie || '');
    const creator = extractTextContent(description['dcterms:creator'] || description.creator || '');

    return {
      ecli,
      title,
      court: creator,
      date,
      summary: cleanText(summary),
      fullText,
      url: `https://uitspraken.rechtspraak.nl/details?id=${ecli}`
    };

  } catch (error) {
    console.error(`❌ Error fetching document ${ecli}:`, error);
    throw new Error(`Failed to fetch document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function chunkText(text: string, maxTokens: number = 1000, overlapTokens: number = 200): TextChunk[] {
  const estimatedCharsPerToken = 4;
  const maxChars = maxTokens * estimatedCharsPerToken;
  const overlapChars = overlapTokens * estimatedCharsPerToken;

  if (text.length <= maxChars) {
    return [{ text, index: 0, totalChunks: 1 }];
  }

  const chunks: TextChunk[] = [];
  let startPos = 0;

  while (startPos < text.length) {
    let endPos = Math.min(startPos + maxChars, text.length);
    
    if (endPos < text.length) {
      const lastPeriod = text.lastIndexOf('.', endPos);
      const lastNewline = text.lastIndexOf('\n', endPos);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > startPos + (maxChars / 2)) {
        endPos = breakPoint + 1;
      }
    }

    const chunkText = text.substring(startPos, endPos).trim();
    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunks.length,
        totalChunks: 0
      });
    }

    startPos = endPos - overlapChars;
    if (startPos >= text.length - overlapChars) break;
  }

  chunks.forEach(chunk => {
    chunk.totalChunks = chunks.length;
  });

  return chunks;
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
