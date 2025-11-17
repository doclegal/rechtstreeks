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
    
    // Alpha parameter: 0=keyword, 1=semantic, default=0.6 (favor semantic slightly)
    const alpha = query.alpha !== undefined ? query.alpha : 0.6;
    
    console.log(`🔎 Hybrid search with alpha=${alpha} (${alpha}=semantic, ${1-alpha}=keyword)`);
    
    // Generate both dense (semantic) and sparse (keyword) embeddings
    let denseEmbedding: any;
    let sparseEmbedding: any;
    
    try {
      // Dense embedding for semantic search
      const denseResponse = await pc.inference.embed(
        "llama-text-embed-v2",
        [query.text],
        { inputType: "query", truncate: "END" }
      );
      const denseData: any = denseResponse.data[0];
      denseEmbedding = denseData.values;
      
      // Sparse embedding for keyword search
      const sparseResponse = await pc.inference.embed(
        "pinecone-sparse-english-v0",
        [query.text],
        { inputType: "query", truncate: "END" }
      );
      const sparseData: any = sparseResponse.data[0];
      sparseEmbedding = {
        indices: sparseData.indices || [],
        values: sparseData.values || []
      };
      
      console.log(`✅ Generated dense embedding (${denseEmbedding.length} dims) and sparse embedding (${sparseEmbedding.indices.length} terms)`);
    } catch (embedError: any) {
      console.warn(`⚠️ Hybrid search failed, falling back to simple semantic search:`, embedError.message);
      
      // Fallback to simple search if hybrid fails
      const searchParams: any = {
        query: {
          topK: query.topK || 10,
          inputs: { text: query.text }
        },
        fields: ['text', 'ecli', 'title', 'court', 'decision_date', 'legal_area', 'procedure_type', 'source_url', 'ai_feiten', 'ai_geschil', 'ai_beslissing', 'ai_motivering', 'ai_inhoudsindicatie', 'chunkIndex', 'totalChunks']
      };

      if (query.filter) {
        searchParams.query.filter = query.filter;
      }

      const response = await namespace.searchRecords(searchParams);
      
      if (!response.result?.hits || response.result.hits.length === 0) {
        console.log('ℹ️ No results found');
        return [];
      }
      
      const MINIMUM_SCORE = 0.03;
      const filteredResults = response.result.hits
        .filter((hit: any) => hit._score >= MINIMUM_SCORE)
        .map((hit: any) => ({
          id: hit._id,
          score: hit._score || 0,
          metadata: hit.fields as VectorRecord['metadata'],
          text: hit.fields?.text
        }));
      
      console.log(`✅ Fallback search: ${filteredResults.length} results above ${MINIMUM_SCORE} threshold`);
      return filteredResults;
    }
    
    // Apply alpha weighting
    const weightedDense = denseEmbedding.map((v: number) => v * alpha);
    const weightedSparse = {
      indices: sparseEmbedding.indices,
      values: sparseEmbedding.values.map((v: number) => v * (1 - alpha))
    };
    
    // Query with hybrid vectors
    const index = pc.Index(INDEX_NAME);
    const queryParams: any = {
      topK: query.topK || 10,
      vector: weightedDense,
      includeMetadata: true,
      includeValues: false
    };
    
    // Only include sparse vector if it has values
    if (weightedSparse.indices.length > 0 && weightedSparse.values.length > 0) {
      queryParams.sparseVector = weightedSparse;
      console.log(`🔎 Querying with hybrid vectors (dense: ${weightedDense.length} dims, sparse: ${weightedSparse.indices.length} terms)`);
    } else {
      console.log(`🔎 Querying with dense-only vector (sparse embedding was empty)`);
    }
    
    if (query.filter) {
      queryParams.filter = query.filter;
    }
    
    const response = await index.namespace(NAMESPACE).query(queryParams);
    
    if (!response.matches || response.matches.length === 0) {
      console.log('ℹ️ No results found in hybrid search');
      return [];
    }
    
    const MINIMUM_SCORE = 0.03;
    
    const filteredResults = response.matches
      .filter((match: any) => match.score >= MINIMUM_SCORE)
      .map((match: any) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as VectorRecord['metadata'],
        text: match.metadata?.text
      }));
    
    console.log(`✅ Hybrid search: ${filteredResults.length} results above ${MINIMUM_SCORE} threshold`);
    return filteredResults;
  } catch (error) {
    console.error("❌ Error in hybrid search:", error);
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
