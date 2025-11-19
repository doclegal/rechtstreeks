import { Pinecone } from "@pinecone-database/pinecone";

const INDEX_NAME = "rechtstreeks-dmacda9";
const INDEX_HOST = "rechtstreeks-dmacda9.svc.aped-4627-b74a.pinecone.io";
const NAMESPACE = "ECLI_NL";
const EMBEDDING_MODEL = "multilingual-e5-large";

let pineconeClient: Pinecone | null = null;

export interface VectorRecord {
  id: string;
  text: string;
  metadata: {
    ecli: string;
    court?: string;
    court_level?: string;
    decision_date?: string;
    legal_area?: string;
    procedure_type?: string;
    source_url?: string;
    title?: string;
    ai_feiten?: string;
    ai_geschil?: string;
    ai_beslissing?: string;
    ai_motivering?: string;
    ai_inhoudsindicatie?: string;
    chunkIndex?: number;
    totalChunks?: number;
  };
}

export interface SearchQuery {
  text: string;
  filter?: Record<string, any>;
  topK?: number;
  scoreThreshold?: number; // Minimum similarity score (e.g., 0.01 = 1%)
  alpha?: number; // 0-1: 0=pure keyword, 1=pure semantic, 0.5=balanced
  namespace?: string; // Optional namespace override (default: ECLI_NL)
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: VectorRecord['metadata'];
  text?: string;
  namespace?: string; // To track which namespace the result came from
}

export interface DualNamespaceSearchResults {
  webSearch: SearchResult[];
  ecliNl: SearchResult[];
  totalResults: number;
}

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY not found in environment");
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

export async function upsertVectors(records: VectorRecord[]): Promise<void> {
  try {
    const pc = getPineconeClient();
    const namespace = pc.index(INDEX_NAME).namespace(NAMESPACE);
    
    const formattedRecords = records.map(record => ({
      id: record.id,
      text: record.text,
      ...record.metadata
    }));

    await namespace.upsertRecords(formattedRecords);
    console.log(`✅ Upserted ${records.length} vectors to Pinecone with integrated embedding`);
  } catch (error) {
    console.error("❌ Error upserting to Pinecone:", error);
    throw error;
  }
}

// DJB2 hash function for sparse vector generation
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash) >>> 0;
}

// Generate sparse vector for keyword matching (Dutch text)
function generateSparseVector(text: string): { indices: number[]; values: number[] } {
  if (!text?.trim()) return { indices: [], values: [] };
  
  const tokens = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9\u00C0-\u024F]+/i)
    .filter(t => t.length >= 3);
  
  if (!tokens.length) return { indices: [], values: [] };
  
  const termFreq = new Map<string, number>();
  tokens.forEach(t => termFreq.set(t, (termFreq.get(t) || 0) + 1));
  
  const maxFreq = Math.max(...Array.from(termFreq.values()));
  const entries = Array.from(termFreq.entries()).map(([term, freq]) => ({
    index: djb2Hash(term),
    value: freq / maxFreq
  }));
  
  entries.sort((a, b) => b.value - a.value);
  const top = entries.slice(0, 1000).sort((a, b) => a.index - b.index);
  
  return {
    indices: top.map(e => e.index),
    values: top.map(e => e.value)
  };
}

export async function searchVectors(query: SearchQuery): Promise<SearchResult[]> {
  try {
    const pc = getPineconeClient();
    const index = pc.index(INDEX_NAME, INDEX_HOST);
    const namespace = query.namespace || NAMESPACE;
    
    console.log(`🔎 Using Pinecone semantic search (dense only)`);
    console.log(`📂 Namespace: ${namespace}`);
    console.log(`📝 Query text: "${query.text.substring(0, 100)}..."`);
    console.log(`🤖 Model: ${EMBEDDING_MODEL}`);
    
    // Generate dense embedding with CORRECT inputType for query
    const embeddingResponse = await pc.inference.embed(
      EMBEDDING_MODEL,
      [query.text],
      { inputType: 'query' }  // CRITICAL: 'query' not 'passage'
    );
    
    const embeddingData: any = embeddingResponse.data[0];
    const denseVector = embeddingData.values;
    console.log(`✅ Dense vector generated (${denseVector.length} dims)`);
    
    // Query with dense vector only (sparse not supported by index)
    const queryParams: any = {
      vector: denseVector,
      topK: query.topK || 20,
      includeMetadata: true,
      includeValues: false
    };
    
    if (query.filter) {
      queryParams.filter = query.filter;
      console.log(`🔍 Applying metadata filter:`, query.filter);
    }
    
    const response = await index.namespace(namespace).query(queryParams);
    
    console.log(`📊 Pinecone response: ${response.matches?.length || 0} total matches`);
    
    if (!response.matches || response.matches.length === 0) {
      console.log('ℹ️ No results found');
      return [];
    }
    
    // Log top scores for debugging
    const topScores = response.matches.slice(0, 5).map((m: any) => m.score?.toFixed(4) || '0');
    console.log(`📊 Top 5 scores: ${topScores.join(', ')}`);
    
    // Apply score threshold filter
    const threshold = query.scoreThreshold !== undefined ? query.scoreThreshold : 0.10;
    
    const allResults = response.matches.map((match: any) => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata as VectorRecord['metadata'],
      text: match.metadata?.text
    }));
    
    const filteredResults = allResults.filter(r => r.score >= threshold);
    
    if (allResults.length > 0) {
      const allScores = allResults.map(r => r.score);
      console.log(`✅ Filtered results: ${filteredResults.length}/${allResults.length} above threshold ${threshold}`);
      console.log(`📊 Score range: ${Math.min(...allScores).toFixed(4)} to ${Math.max(...allScores).toFixed(4)}`);
    }
    
    return filteredResults;
  } catch (error) {
    console.error("❌ Error in semantic search:", error);
    throw error;
  }
}

/**
 * Search both web_search and ECLI_NL namespaces in parallel
 * Returns separate result sets for each namespace
 */
export async function searchDualNamespaces(query: Omit<SearchQuery, 'namespace'>): Promise<DualNamespaceSearchResults> {
  try {
    console.log(`🔍 DUAL NAMESPACE SEARCH: Searching web_search and ECLI_NL in parallel`);
    
    // Execute both searches in parallel
    const [webSearchResults, ecliNlResults] = await Promise.all([
      searchVectors({ ...query, namespace: 'web_search' }).catch(error => {
        console.error('⚠️ Error searching web_search namespace:', error);
        return [] as SearchResult[];
      }),
      searchVectors({ ...query, namespace: 'ECLI_NL' }).catch(error => {
        console.error('⚠️ Error searching ECLI_NL namespace:', error);
        return [] as SearchResult[];
      })
    ]);
    
    // Tag results with their namespace
    const taggedWebSearch = webSearchResults.map(r => ({ ...r, namespace: 'web_search' }));
    const taggedEcliNl = ecliNlResults.map(r => ({ ...r, namespace: 'ECLI_NL' }));
    
    console.log(`✅ DUAL SEARCH COMPLETE:`);
    console.log(`   📂 web_search: ${taggedWebSearch.length} results`);
    console.log(`   📂 ECLI_NL: ${taggedEcliNl.length} results`);
    console.log(`   📊 Total: ${taggedWebSearch.length + taggedEcliNl.length} results`);
    
    return {
      webSearch: taggedWebSearch,
      ecliNl: taggedEcliNl,
      totalResults: taggedWebSearch.length + taggedEcliNl.length
    };
  } catch (error) {
    console.error("❌ Error in dual namespace search:", error);
    throw error;
  }
}

export async function deleteVectors(ids: string[]): Promise<void> {
  try {
    const pc = getPineconeClient();
    const index = pc.index(INDEX_NAME);
    
    await index.namespace(NAMESPACE).deleteMany(ids);
    console.log(`🗑️ Deleted ${ids.length} vectors from Pinecone`);
  } catch (error) {
    console.error("❌ Error deleting from Pinecone:", error);
    throw error;
  }
}

export async function checkIndexExists(): Promise<boolean> {
  try {
    const pc = getPineconeClient();
    const indexes = await pc.listIndexes();
    const exists = indexes.indexes?.some(idx => idx.name === INDEX_NAME) || false;
    
    if (exists) {
      console.log(`✅ Pinecone index '${INDEX_NAME}' found`);
      console.log(`📍 Host: ${INDEX_HOST}`);
      console.log(`📦 Namespace: ${NAMESPACE}`);
      console.log(`🤖 Model: ${EMBEDDING_MODEL}`);
    }
    
    return exists;
  } catch (error) {
    console.error("❌ Error checking Pinecone index:", error);
    return false;
  }
}
