import { db } from './db';
import { judgmentTexts } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Service for fetching full judgment texts from Rechtspraak.nl Open Data API
 * Documentation: https://www.rechtspraak.nl/Uitspraken/Paginas/Open-Data.aspx
 */

interface JudgmentFetchResult {
  ecli: string;
  fullText: string | null;
  xmlContent: string | null;
  error: string | null;
}

/**
 * Extract full text from Rechtspraak.nl XML response
 */
function extractFullTextFromXml(xmlContent: string): string | null {
  try {
    // Remove namespace prefixes for easier parsing
    const cleanXml = xmlContent.replace(/\s+xmlns[^=]*="[^"]*"/g, '');
    
    // Extract text from <uitspraak> section (most common)
    let match = cleanXml.match(/<uitspraak[^>]*>([\s\S]*?)<\/uitspraak>/i);
    if (match) {
      // Remove all XML tags and get just the text
      const text = match[1]
        .replace(/<[^>]+>/g, ' ')  // Remove tags
        .replace(/\s+/g, ' ')       // Normalize whitespace
        .trim();
      return text || null;
    }

    // Try <conclusie> section (for conclusions/opinions)
    match = cleanXml.match(/<conclusie[^>]*>([\s\S]*?)<\/conclusie>/i);
    if (match) {
      const text = match[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text || null;
    }

    // Fallback: try to extract from entire document
    const textMatch = cleanXml.match(/<text[^>]*>([\s\S]*?)<\/text>/i);
    if (textMatch) {
      const text = textMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text || null;
    }

    console.warn('⚠️ No <uitspraak>, <conclusie>, or <text> section found in XML');
    return null;
  } catch (error) {
    console.error('❌ Error extracting text from XML:', error);
    return null;
  }
}

/**
 * Fetch full judgment text from Rechtspraak.nl API
 * @param ecli - ECLI identifier (e.g., "ECLI:NL:HR:2023:1234")
 * @returns Full text or null if not available
 */
export async function fetchJudgmentText(ecli: string): Promise<JudgmentFetchResult> {
  try {
    console.log(`🔍 Fetching judgment text for ${ecli}...`);

    // Check if we already have it cached
    const cached = await db
      .select()
      .from(judgmentTexts)
      .where(eq(judgmentTexts.ecli, ecli))
      .limit(1);

    if (cached.length > 0) {
      console.log(`✅ Found cached judgment text for ${ecli}`);
      return {
        ecli,
        fullText: cached[0].fullText,
        xmlContent: cached[0].xmlContent,
        error: cached[0].fetchError,
      };
    }

    // Fetch from Rechtspraak.nl API
    const url = `https://data.rechtspraak.nl/uitspraken/content?id=${ecli}`;
    console.log(`📥 Fetching from ${url}...`);
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorMsg = `API returned ${response.status}: ${response.statusText}`;
      console.error(`❌ ${errorMsg}`);
      
      // Cache the error
      await db.insert(judgmentTexts).values({
        ecli,
        fullText: null,
        xmlContent: null,
        fetchError: errorMsg,
      });

      return {
        ecli,
        fullText: null,
        xmlContent: null,
        error: errorMsg,
      };
    }

    const xmlContent = await response.text();
    console.log(`📄 Received XML (${xmlContent.length} chars)`);

    // Extract full text
    const fullText = extractFullTextFromXml(xmlContent);
    
    if (fullText) {
      console.log(`✅ Extracted full text (${fullText.length} chars)`);
    } else {
      console.warn(`⚠️ Could not extract full text from XML`);
    }

    // Cache the result
    await db.insert(judgmentTexts).values({
      ecli,
      fullText,
      xmlContent,
      fetchError: null,
    });

    return {
      ecli,
      fullText,
      xmlContent,
      error: null,
    };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    console.error(`❌ Error fetching judgment text for ${ecli}:`, error);

    // Cache the error
    try {
      await db.insert(judgmentTexts).values({
        ecli,
        fullText: null,
        xmlContent: null,
        fetchError: errorMsg,
      });
    } catch (dbError) {
      console.error('❌ Error caching fetch error:', dbError);
    }

    return {
      ecli,
      fullText: null,
      xmlContent: null,
      error: errorMsg,
    };
  }
}

/**
 * Fetch full judgment texts for multiple ECLIs in parallel
 * @param eclis - Array of ECLI identifiers
 * @returns Array of fetch results
 */
export async function fetchMultipleJudgmentTexts(eclis: string[]): Promise<JudgmentFetchResult[]> {
  console.log(`📚 Fetching ${eclis.length} judgment texts...`);
  const results = await Promise.all(eclis.map(ecli => fetchJudgmentText(ecli)));
  const successCount = results.filter(r => r.fullText !== null).length;
  console.log(`✅ Successfully fetched ${successCount}/${eclis.length} judgment texts`);
  return results;
}
