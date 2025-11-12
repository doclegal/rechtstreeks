import { normalizeRechtsgebied, normalizeInstantie, normalizePeriode } from './rechtspraakMappings';
import { parseStringPromise } from 'xml2js';

export interface RechtspraakSearchRequest {
  filters: {
    rechtsgebied?: string | null;
    instantie?: string | null;
    periode?: string | null;
  };
  page?: number;
  page_size?: number;
}

export interface RechtspraakItem {
  ecli: string;
  title: string;
  court: string;
  date: string;
  url: string;
  snippet: string;
  score: number;
}

export interface RechtspraakSearchResponse {
  items: RechtspraakItem[];
  meta: {
    total: number;
    fetch_ms: number;
    source: string;
    applied_filters: Record<string, any>;
    page: number;
    page_size: number;
  };
}

const BASE_URL = 'https://data.rechtspraak.nl/uitspraken/zoeken';
const CONTENT_URL = 'https://data.rechtspraak.nl/uitspraken/content';

function buildSearchUrl(request: RechtspraakSearchRequest): { url: string; appliedFilters: Record<string, any> } {
  const params = new URLSearchParams();
  const appliedFilters: Record<string, any> = {};

  params.set('return', 'DOC');
  
  const pageSize = request.page_size || 25;
  const page = request.page || 1;
  params.set('max', pageSize.toString());
  
  const offset = (page - 1) * pageSize;
  if (offset > 0) {
    params.set('from', offset.toString());
  }

  const rechtsgebiedUri = request.filters?.rechtsgebied ? normalizeRechtsgebied(request.filters.rechtsgebied) : null;
  if (rechtsgebiedUri) {
    params.set('subject', rechtsgebiedUri);
    appliedFilters.rechtsgebied = request.filters?.rechtsgebied;
  }

  const instantieUri = request.filters?.instantie ? normalizeInstantie(request.filters.instantie) : null;
  if (instantieUri) {
    params.set('creator', instantieUri);
    appliedFilters.instantie = request.filters?.instantie;
  }

  const periode = normalizePeriode(request.filters?.periode);
  if (periode) {
    params.append('date', periode.from);
    params.append('date', periode.to);
    appliedFilters.periode = `${periode.from} tot ${periode.to}`;
  }

  params.set('sort', 'DESC');

  const url = `${BASE_URL}?${params.toString()}`;
  return { url, appliedFilters };
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
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

function createSnippet(text: string, maxLength = 280): string {
  if (!text) return '';
  
  text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  let snippet = '';
  
  for (const sentence of sentences) {
    if ((snippet + sentence).length > maxLength) break;
    snippet += sentence;
  }
  
  if (!snippet && text.length > 0) {
    snippet = text.substring(0, maxLength);
    if (text.length > maxLength) snippet += '...';
  }
  
  return snippet.trim();
}

async function parseAtomFeed(xmlText: string): Promise<RechtspraakItem[]> {
  try {
    const result = await parseStringPromise(xmlText, { 
      explicitArray: false,
      mergeAttrs: true,
      trim: true
    });

    const feed = result.feed || result['feed'];
    if (!feed) return [];

    let entries = feed.entry;
    if (!entries) return [];
    if (!Array.isArray(entries)) entries = [entries];

    const items: RechtspraakItem[] = [];

    for (const entry of entries) {
      try {
        const ecli = extractTextContent(entry.id || entry['id']);
        if (!ecli || !ecli.includes('ECLI')) continue;

        const title = extractTextContent(entry.title || entry['title']) || 'Geen titel';
        
        const summary = extractTextContent(entry.summary || entry['summary'] || '');
        const snippet = createSnippet(summary);

        let date = '';
        if (entry.updated) {
          const dateStr = extractTextContent(entry.updated);
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            date = parsedDate.toISOString().split('T')[0];
          }
        }

        let court = 'Onbekend';
        if (entry.author?.name) {
          court = extractTextContent(entry.author.name);
        }

        const url = `https://uitspraken.rechtspraak.nl/#!/details?id=${encodeURIComponent(ecli)}`;

        const score = date ? (new Date(date).getTime() / 1000000000) : 0;

        items.push({
          ecli,
          title,
          court,
          date,
          url,
          snippet,
          score
        });
      } catch (entryError) {
        console.error('Error parsing entry:', entryError);
        continue;
      }
    }

    return items.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('Error parsing Atom feed:', error);
    return [];
  }
}

export async function searchRechtspraak(request: RechtspraakSearchRequest): Promise<RechtspraakSearchResponse> {
  const startTime = Date.now();

  const { url, appliedFilters } = buildSearchUrl(request);
  
  console.log('Rechtspraak API URL:', url);

  try {
    const response = await fetchWithTimeout(url, 10000);

    if (!response.ok) {
      throw new Error(`Upstream API returned ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const items = await parseAtomFeed(xmlText);

    const fetchMs = Date.now() - startTime;

    return {
      items,
      meta: {
        total: items.length,
        fetch_ms: fetchMs,
        source: 'rechtspraak_open_data',
        applied_filters: appliedFilters,
        page: request.page || 1,
        page_size: request.page_size || 25
      }
    };
  } catch (error: any) {
    console.error('Rechtspraak search error:', error);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: Rechtspraak API did not respond in time');
    }
    
    throw error;
  }
}
