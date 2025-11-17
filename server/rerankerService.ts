import { Pinecone } from '@pinecone-database/pinecone';
import { SEARCH_CONFIG } from '@shared/searchConfig';
import type { ScoredResult } from './scoringService';
import crypto from 'crypto';

// Initialize Pinecone client for reranking
let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY not found in environment');
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

// Simple in-memory cache for reranking results
interface CacheEntry {
  results: ScoredResult[];
  timestamp: number;
}

const rerankCache = new Map<string, CacheEntry>();

// Cache version - increment to invalidate old cache entries after model/logic changes
const CACHE_VERSION = 'v2-bge-reranker-m3-metadata-merge';

// Generate cache key based on query, caseId, and filters
function generateCacheKey(
  caseId: string,
  query: string,
  filters?: Record<string, any>
): string {
  const hash = crypto
    .createHash('md5')
    .update(`${CACHE_VERSION}-${caseId}-${query}-${JSON.stringify(filters || {})}`)
    .digest('hex');
  return hash;
}

// Clean expired cache entries
function cleanExpiredCache(): void {
  const now = Date.now();
  const entries = Array.from(rerankCache.entries());
  for (const [key, entry] of entries) {
    if (now - entry.timestamp > SEARCH_CONFIG.RERANK_CACHE_TTL_MS) {
      rerankCache.delete(key);
    }
  }
}

// Truncate text to token limit (more precise for Pinecone reranker)
function truncateText(text: string, maxTokens: number): string {
  // Rough estimate: ~4 characters per token for Dutch text
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + '...';
}

// Format document with metadata for reranking (only include known metadata)
function formatDocumentWithMetadata(candidate: ScoredResult): string {
  const summary = candidate.metadata.ai_inhoudsindicatie || candidate.text || '';
  const truncatedSummary = truncateText(summary, 700); // Leave room for metadata
  
  // Build metadata block - ONLY include fields that have real values
  const metadataLines: string[] = [];
  
  // Court level (most important for legal hierarchy)
  const courtLevel = candidate.metadata.court_level || candidate.metadata.court;
  if (courtLevel) {
    metadataLines.push(`court_level: ${courtLevel}`);
  }
  
  // Legal area
  if (candidate.metadata.legal_area) {
    metadataLines.push(`legal_area: ${candidate.metadata.legal_area}`);
  }
  
  // Decision year
  if (candidate.metadata.decision_date) {
    const year = new Date(candidate.metadata.decision_date).getFullYear();
    if (!isNaN(year)) {
      metadataLines.push(`decision_year: ${year}`);
    }
  }
  
  // ECLI (if present)
  if (candidate.metadata.ecli) {
    metadataLines.push(`ecli: ${candidate.metadata.ecli}`);
  }
  
  // Format: Document text + metadata block (only if metadata exists)
  if (metadataLines.length === 0) {
    return truncatedSummary;
  }
  
  return `${truncatedSummary}

[METADATA]
${metadataLines.join('\n')}`;
}

export interface RerankOptions {
  caseId?: string;
  query: string;
  candidates: ScoredResult[];
  filters?: Record<string, any>;
  enableCache?: boolean;
}

export async function rerankResults(options: RerankOptions): Promise<ScoredResult[]> {
  const {
    caseId = 'unknown',
    query,
    candidates,
    filters,
    enableCache = true
  } = options;
  
  // Check if reranking is enabled
  if (!SEARCH_CONFIG.RERANK_ENABLED) {
    console.log('⚠️ Reranking disabled, returning candidates as-is');
    return candidates;
  }
  
  // Check cache
  if (enableCache) {
    cleanExpiredCache();
    const cacheKey = generateCacheKey(caseId, query, filters);
    const cached = rerankCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < SEARCH_CONFIG.RERANK_CACHE_TTL_MS) {
      console.log('✅ Rerank cache hit');
      return cached.results;
    }
  }
  
  // Limit to top N candidates for cost control
  const candidatesToRerank = candidates.slice(0, SEARCH_CONFIG.RERANK_BATCH_SIZE);
  
  if (candidatesToRerank.length === 0) {
    console.log('⚠️ No candidates to rerank');
    return [];
  }
  
  console.log(`🤖 Reranking ${candidatesToRerank.length} candidates with Pinecone ${SEARCH_CONFIG.RERANK_MODEL}`);
  
  try {
    const pc = getPineconeClient();
    
    // Format documents as Pinecone Document objects with metadata embedded in text + structured metadata
    const documents = candidatesToRerank.map(candidate => {
      // Build structured metadata as Record<string, string> for Pinecone diagnostics
      const metadata: Record<string, string> = {};
      
      // Add court level
      const courtLevel = candidate.metadata.court_level || candidate.metadata.court;
      if (courtLevel) {
        metadata.court_level = courtLevel;
      }
      
      // Add legal area
      if (candidate.metadata.legal_area) {
        metadata.legal_area = candidate.metadata.legal_area;
      }
      
      // Add decision year
      if (candidate.metadata.decision_date) {
        const year = new Date(candidate.metadata.decision_date).getFullYear();
        if (!isNaN(year)) {
          metadata.decision_year = String(year);
        }
      }
      
      // Add ECLI
      if (candidate.metadata.ecli) {
        metadata.ecli = candidate.metadata.ecli;
      }
      
      return {
        id: candidate.id,
        text: formatDocumentWithMetadata(candidate),
        ...(Object.keys(metadata).length > 0 && { metadata }) // Only include if not empty
      };
    });
    
    console.log(`📄 Formatted ${documents.length} documents with metadata (court_level, legal_area, decision_year)`);
    
    // Call Pinecone rerank API (TypeScript SDK uses positional parameters)
    const rerankResponse = await pc.inference.rerank(
      SEARCH_CONFIG.RERANK_MODEL, // model
      query, // query
      documents, // documents as objects with id + text + metadata
      {
        topN: candidatesToRerank.length, // Return all reranked
        returnDocuments: true, // Return documents with metadata for diagnostics
        parameters: {
          truncate: 'END' // Auto-truncate at token limit vs error
        }
      }
    );
    
    if (!rerankResponse.data || rerankResponse.data.length === 0) {
      throw new Error('Empty response from Pinecone reranker');
    }
    
    console.log(`✅ Pinecone reranked ${rerankResponse.data.length} results`);
    console.log(`📊 Top 5 rerank scores: ${rerankResponse.data.slice(0, 5).map(d => d.score.toFixed(4)).join(', ')}`);
    
    // Log metadata from first returned document for verification
    if (rerankResponse.data.length > 0 && rerankResponse.data[0].document) {
      const firstDoc = rerankResponse.data[0].document;
      console.log(`📋 Pinecone returned metadata sample:`, {
        id: firstDoc.id,
        metadata: firstDoc.metadata
      });
    }
    
    // Reorder candidates based on Pinecone rerank scores
    // IMPORTANT: Clone candidates to avoid mutating cached objects
    const reranked: ScoredResult[] = [];
    
    for (const item of rerankResponse.data) {
      const originalIndex = item.index;
      if (originalIndex >= 0 && originalIndex < candidatesToRerank.length) {
        // Deep clone the result (including nested metadata) and add rerank score
        const original = candidatesToRerank[originalIndex];
        
        // Merge Pinecone's structured metadata (if returned) with original metadata
        // This ensures UI diagnostics have access to the reranker-validated metadata
        // IMPORTANT: Use nullish coalescing to prevent overwriting with undefined
        const mergedMetadata = {
          ...original.metadata, // Original Pinecone query metadata
          // Overwrite with reranker's structured metadata if present (fallback to original)
          ...(item.document?.metadata && {
            court_level: item.document.metadata.court_level ?? original.metadata.court_level,
            legal_area: item.document.metadata.legal_area ?? original.metadata.legal_area,
            decision_year: item.document.metadata.decision_year ?? original.metadata.decision_date, // String or original date
            ecli: item.document.metadata.ecli ?? original.metadata.ecli
          })
        };
        
        const result = {
          ...original,
          metadata: mergedMetadata, // Merged metadata for UI diagnostics
          scoreBreakdown: { ...original.scoreBreakdown }, // Deep clone scoreBreakdown
          rerankScore: item.score,
          // Include Pinecone's returned document for debugging
          pineconeDocument: item.document ? {
            id: item.document.id,
            metadata: item.document.metadata
          } : undefined
        };
        reranked.push(result);
      }
    }
    
    // IMPORTANT: Append the remaining candidates (beyond the reranked batch)
    // that were part of the original candidate pool
    const remainingCandidates = candidates.slice(SEARCH_CONFIG.RERANK_BATCH_SIZE);
    const finalResults = [...reranked, ...remainingCandidates];
    
    // Cache the results
    if (enableCache) {
      const cacheKey = generateCacheKey(caseId, query, filters);
      rerankCache.set(cacheKey, {
        results: finalResults,
        timestamp: Date.now()
      });
    }
    
    return finalResults;
    
  } catch (error: any) {
    console.error('❌ Reranking failed:', error.message);
    console.log('⚠️ Falling back to adjusted score ordering');
    
    // Fallback: return candidates sorted by adjusted score
    return candidates;
  }
}
