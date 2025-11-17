import { Pinecone } from "@pinecone-database/pinecone";

const INDEX_NAME = "rechtstreeks";
const NAMESPACE = "ECLI_NL";

let pineconeClient: Pinecone | null = null;

export interface VectorRecord {
  id: string;
  text: string;
  metadata: {
    ecli: string;
    court?: string;
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
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: VectorRecord['metadata'];
  text?: string;
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

export async function searchVectors(query: SearchQuery): Promise<SearchResult[]> {
  try {
    const pc = getPineconeClient();
    const namespace = pc.index(INDEX_NAME).namespace(NAMESPACE);
    
    console.log(`🔎 Using Pinecone integrated semantic search (llama-text-embed-v2)`);
    console.log(`📝 Query text: "${query.text.substring(0, 100)}..."`);
    
    // Use Pinecone's integrated query pipeline (same as upsert)
    // This ensures embedding consistency between indexing and searching
    const searchParams: any = {
      query: {
        topK: query.topK || 20,
        inputs: { text: query.text }
      },
      fields: ['text', 'ecli', 'title', 'court', 'decision_date', 'legal_area', 'procedure_type', 'source_url', 'ai_feiten', 'ai_geschil', 'ai_beslissing', 'ai_motivering', 'ai_inhoudsindicatie', 'chunkIndex', 'totalChunks']
    };

    if (query.filter) {
      searchParams.query.filter = query.filter;
      console.log(`🔍 Applying metadata filter:`, query.filter);
    }

    const response = await namespace.searchRecords(searchParams);
    
    console.log(`📊 Pinecone response: ${response.result?.hits?.length || 0} total hits`);
    
    if (!response.result?.hits || response.result.hits.length === 0) {
      console.log('ℹ️ No results found');
      return [];
    }
    
    // Log top scores for debugging
    const topScores = response.result.hits.slice(0, 5).map((h: any) => h._score?.toFixed(4) || '0');
    console.log(`📊 Top 5 scores: ${topScores.join(', ')}`);
    
    // Apply score threshold filter
    const threshold = query.scoreThreshold !== undefined ? query.scoreThreshold : 0.01;
    const allResults = response.result.hits.map((hit: any) => ({
      id: hit._id,
      score: hit._score || 0,
      metadata: hit.fields as VectorRecord['metadata'],
      text: hit.fields?.text
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
    return indexes.indexes?.some(idx => idx.name === INDEX_NAME) || false;
  } catch (error) {
    console.error("❌ Error checking Pinecone index:", error);
    return false;
  }
}
