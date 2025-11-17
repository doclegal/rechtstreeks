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
}

// Detect court type from court name
export function detectCourtType(courtName: string | undefined): CourtType {
  if (!courtName) return 'Unknown';
  
  const normalized = courtName.toLowerCase().trim();
  
  // Hoge Raad
  if (/\bhr\b/.test(normalized) || normalized.includes('hoge raad')) {
    return 'HR';
  }
  
  // Gerechtshof
  if (/^hof\b/.test(normalized) || normalized.includes('gerechtshof') || /\bhof\s/.test(normalized)) {
    return 'Hof';
  }
  
  // Rechtbank
  if (normalized.includes('rechtbank') || /\brb\b/.test(normalized)) {
    return 'Rechtbank';
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
  const courtType = detectCourtType(result.metadata.court);
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
