import OpenAI from 'openai';
import { SEARCH_CONFIG } from '@shared/searchConfig';
import type { ScoredResult } from './scoringService';
import crypto from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Simple in-memory cache for reranking results
interface CacheEntry {
  results: ScoredResult[];
  timestamp: number;
}

const rerankCache = new Map<string, CacheEntry>();

// Generate cache key based on query, caseId, and filters
function generateCacheKey(
  caseId: string,
  query: string,
  filters?: Record<string, any>
): string {
  const hash = crypto
    .createHash('md5')
    .update(`${caseId}-${query}-${JSON.stringify(filters || {})}`)
    .digest('hex');
  return hash;
}

// Clean expired cache entries
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of rerankCache.entries()) {
    if (now - entry.timestamp > SEARCH_CONFIG.RERANK_CACHE_TTL_MS) {
      rerankCache.delete(key);
    }
  }
}

// Truncate text to approximate token limit
function truncateText(text: string, maxTokens: number): string {
  // Rough estimate: ~4 characters per token
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + '...';
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
  
  console.log(`🤖 Reranking ${candidatesToRerank.length} candidates with ${SEARCH_CONFIG.RERANK_MODEL}`);
  
  try {
    // Build prompt with candidates
    const candidatesText = candidatesToRerank.map((candidate, idx) => {
      const excerpt = truncateText(
        candidate.metadata.ai_inhoudsindicatie || candidate.text || '',
        SEARCH_CONFIG.RERANK_MAX_EXCERPT_TOKENS
      );
      
      return `
[${idx + 1}] ECLI: ${candidate.metadata.ecli}
Court: ${candidate.metadata.court} (${candidate.courtType})
Date: ${candidate.metadata.decision_date}
Score: ${candidate.adjustedScore.toFixed(3)} (base: ${candidate.scoreBreakdown.baseScore.toFixed(3)}, court: +${candidate.scoreBreakdown.courtBoost.toFixed(3)}, keywords: +${candidate.scoreBreakdown.keywordBonus.toFixed(3)})
Title: ${candidate.metadata.title}
Summary: ${excerpt}
`.trim();
    }).join('\n\n---\n\n');
    
    const response = await openai.chat.completions.create({
      model: SEARCH_CONFIG.RERANK_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a Dutch legal research expert. You will receive a search query and ${candidatesToRerank.length} candidate jurisprudence results.

Your task: Rerank these candidates by TRUE LEGAL RELEVANCE to the query, considering:
1. How well the case addresses the legal issues in the query
2. The quality and precedential value of the decision
3. Court hierarchy (Hoge Raad > Gerechtshof > Rechtbank)
4. How applicable the reasoning is to the query's context

Return a JSON array with the candidate numbers in order of relevance (most relevant first).
Include a brief rationale (1-2 sentences) for each ranking.

Format:
{
  "rankings": [
    {"candidate": 1, "rationale": "Most relevant because..."},
    {"candidate": 3, "rationale": "Second most relevant because..."},
    ...
  ]
}

CRITICAL: Return ONLY valid JSON, nothing else.`
        },
        {
          role: 'user',
          content: `SEARCH QUERY: ${query}

CANDIDATES:
${candidatesText}

Rerank these ${candidatesToRerank.length} candidates by legal relevance. Return JSON only.`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
      temperature: 0.3
    });
    
    const content = response.choices[0].message.content?.trim();
    if (!content) {
      throw new Error('Empty response from reranker');
    }
    
    const parsed = JSON.parse(content);
    const rankings = parsed.rankings || [];
    
    if (!Array.isArray(rankings) || rankings.length === 0) {
      throw new Error('Invalid rankings format');
    }
    
    console.log(`✅ Reranked ${rankings.length} results`);
    
    // Reorder candidates based on rankings
    const reranked: ScoredResult[] = [];
    const used = new Set<number>();
    
    for (const { candidate } of rankings) {
      const idx = candidate - 1; // Convert 1-indexed to 0-indexed
      if (idx >= 0 && idx < candidatesToRerank.length && !used.has(idx)) {
        reranked.push(candidatesToRerank[idx]);
        used.add(idx);
      }
    }
    
    // Add any missing candidates at the end (fallback)
    for (let i = 0; i < candidatesToRerank.length; i++) {
      if (!used.has(i)) {
        reranked.push(candidatesToRerank[i]);
      }
    }
    
    // Cache the results
    if (enableCache) {
      const cacheKey = generateCacheKey(caseId, query, filters);
      rerankCache.set(cacheKey, {
        results: reranked,
        timestamp: Date.now()
      });
    }
    
    return reranked;
    
  } catch (error: any) {
    console.error('❌ Reranking failed:', error.message);
    console.log('⚠️ Falling back to adjusted score ordering');
    
    // Fallback: return candidates sorted by adjusted score
    return candidates;
  }
}
