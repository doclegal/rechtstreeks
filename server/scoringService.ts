import { SEARCH_CONFIG, type CourtType } from '@shared/searchConfig';
import type { SearchResult } from './pineconeService';

export interface ScoredResult extends SearchResult {
  adjustedScore: number;
  scoreBreakdown: {
    baseScore: number;
    courtBoost: number;
    keywordBonus: number;
  };
  courtType: CourtType;
  rerankScore?: number; // Optional Pinecone rerank score (0-1)
}

// Map Pinecone court_level or court to CourtType (with comprehensive matching)
export function mapCourtLevel(courtLevel: string | undefined, courtName?: string): CourtType {
  // Use court_level if available, fallback to court field for older records
  const courtValue = courtLevel || courtName;
  if (!courtValue) return 'Unknown';
  
  // Comprehensive normalization:
  // - Lowercase
  // - Remove Dutch articles (het, de, den, afdeling, etc.)
  // - Keep only alphanumeric chars and spaces (strips ALL punctuation)
  // - Collapse multiple spaces
  const normalized = courtValue
    .toLowerCase()
    .replace(/^(het|de|den|afdeling)\s+/gi, '') // Remove leading articles/prefixes
    .replace(/[^a-z0-9\s]/g, ' ') // Keep only alphanumeric + spaces (strips all punctuation)
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
  
  // === High Courts (HR-level boost: +0.10) ===
  
  // Hoge Raad and variants
  const hogeraadPatterns = [
    'hoge raad',
    /\bhr\b/,
    'hogeraad'
  ];
  
  // Raad van State and variants (administrative supreme court)
  const raadvanstatePatterns = [
    'raad van state',
    'raad v d state',
    'raad vd state',
    /\bcrvb\b/,
    /\brvs\b/,
    'bestuursrechtspraak'
  ];
  
  // Centrale Raad van Beroep (social security/civil service appeals)
  const centraleraadPatterns = [
    'centrale raad van beroep',
    'centrale raad v d beroep',
    'centrale raad vd beroep',
    /\bcbb\b/
  ];
  
  // College van Beroep (disciplinary/professional courts)
  const collegePatterns = [
    'college van beroep',
    /\bcvb\b/
  ];
  
  // Check all high court patterns
  const allHighCourtPatterns = [
    ...hogeraadPatterns,
    ...raadvanstatePatterns,
    ...centraleraadPatterns,
    ...collegePatterns
  ];
  
  for (const pattern of allHighCourtPatterns) {
    if (typeof pattern === 'string' && normalized.includes(pattern)) {
      return 'HR';
    }
    if (pattern instanceof RegExp && pattern.test(normalized)) {
      return 'HR';
    }
  }
  
  // === Appeals Courts (Hof-level boost: +0.05) ===
  const hofPatterns = [
    'gerechtshof',
    /\bhof\b/
  ];
  
  for (const pattern of hofPatterns) {
    if (typeof pattern === 'string' && normalized.includes(pattern)) {
      return 'Hof';
    }
    if (pattern instanceof RegExp && pattern.test(normalized)) {
      return 'Hof';
    }
  }
  
  // === District Courts (Rechtbank-level boost: 0) ===
  const rechtbankPatterns = [
    'rechtbank',
    /\brb\b/,
    'kantonrechter', // Magistrate court (subdivision of district court)
    'kanton'
  ];
  
  for (const pattern of rechtbankPatterns) {
    if (typeof pattern === 'string' && normalized.includes(pattern)) {
      return 'Rechtbank';
    }
    if (pattern instanceof RegExp && pattern.test(normalized)) {
      return 'Rechtbank';
    }
  }
  
  return 'Unknown';
}

// Calculate keyword bonus based on term frequency in result text
export function calculateKeywordBonus(
  result: SearchResult,
  keywords: string[]
): number {
  if (keywords.length === 0) return 0;
  
  // Concatenate all searchable text fields
  const searchText = [
    result.text,
    result.metadata.ai_inhoudsindicatie,
    result.metadata.ai_feiten,
    result.metadata.ai_geschil,
    result.metadata.ai_beslissing,
    result.metadata.ai_motivering,
    result.metadata.title
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  
  // Count matching keywords (case-insensitive, soft match)
  let matchCount = 0;
  for (const keyword of keywords) {
    if (searchText.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }
  
  // Calculate bonus: +0.015 per keyword, capped at +0.045
  const bonus = Math.min(
    matchCount * SEARCH_CONFIG.KEYWORD_BONUS_PER_MATCH,
    SEARCH_CONFIG.MAX_KEYWORD_BONUS
  );
  
  return bonus;
}

// Calculate adjusted score with court weighting and keyword bonus
export function calculateAdjustedScore(
  result: SearchResult,
  keywords: string[] = []
): ScoredResult {
  const courtType = mapCourtLevel(result.metadata.court_level, result.metadata.court);
  const courtBoost = SEARCH_CONFIG.COURT_WEIGHTS[courtType];
  const keywordBonus = calculateKeywordBonus(result, keywords);
  
  // Adjusted score = base Pinecone score + court boost + keyword bonus
  // Bounded to [0, 1] range
  const adjustedScore = Math.max(
    0,
    Math.min(1, result.score + courtBoost + keywordBonus)
  );
  
  return {
    ...result,
    adjustedScore,
    courtType,
    scoreBreakdown: {
      baseScore: result.score,
      courtBoost,
      keywordBonus
    }
  };
}

// Score and sort all results
export function scoreAndSortResults(
  results: SearchResult[],
  keywords: string[] = []
): ScoredResult[] {
  const scored = results.map(result => calculateAdjustedScore(result, keywords));
  
  // Sort by adjusted score descending
  return scored.sort((a, b) => b.adjustedScore - a.adjustedScore);
}
