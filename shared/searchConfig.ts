// Search scoring configuration
export const SEARCH_CONFIG = {
  // Pinecone query settings
  DEFAULT_TOP_K: 200,
  DEFAULT_SCORE_THRESHOLD: 0.12,
  
  // Court weighting (added to base Pinecone score)
  COURT_WEIGHTS: {
    'HR': 0.10,      // Hoge Raad
    'Hof': 0.05,     // Gerechtshof
    'Rechtbank': 0,  // Rechtbank
    'Unknown': -0.05 // Unknown court type
  } as const,
  
  // Keyword bonus settings
  KEYWORD_BONUS_PER_MATCH: 0.015,
  MAX_KEYWORD_BONUS: 0.045, // Cap at 3 keywords
  
  // Candidate selection
  RERANK_CANDIDATE_COUNT: 40, // Top N for consideration
  RERANK_BATCH_SIZE: 20,      // Send top N to LLM reranker
  
  // Reranking settings
  RERANK_ENABLED: true,
  RERANK_MODEL: 'gpt-4o-mini',
  RERANK_MAX_EXCERPT_TOKENS: 700,
  RERANK_CACHE_TTL_MS: 15 * 60 * 1000, // 15 minutes
  
  // UI display
  MAX_RESULTS_DISPLAY: 10
} as const;

export type CourtType = keyof typeof SEARCH_CONFIG.COURT_WEIGHTS;
