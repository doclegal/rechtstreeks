import { Pinecone } from "@pinecone-database/pinecone";

const INDEX_NAME = "rechtstreeks";
const NAMESPACE = "__default__";

let pineconeClient: Pinecone | null = null;

export interface VectorRecord {
  id: string;
  text: string;
  metadata: {
    ecli: string;
    court?: string;
    date?: string;
    rechtsgebied?: string;
    url?: string;
    chunkIndex?: number;
    totalChunks?: number;
  };
}

export interface SearchQuery {
  text: string;
  filter?: Record<string, any>;
  topK?: number;
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
    
    const searchParams: any = {
      query: {
        topK: query.topK || 10,
        inputs: { text: query.text }
      },
      fields: ['text', 'ecli', 'title', 'court', 'date', 'url', 'chunkIndex', 'totalChunks']
    };

    if (query.filter) {
      searchParams.query.filter = query.filter;
    }

    console.log(`🔎 Pinecone search params:`, JSON.stringify(searchParams, null, 2));
    const response = await namespace.searchRecords(searchParams);
    console.log(`📊 Pinecone response:`, JSON.stringify(response, null, 2));
    
    if (!response.result?.hits || response.result.hits.length === 0) {
      console.log('ℹ️ No results found in Pinecone');
      return [];
    }
    
    const MINIMUM_SCORE = 0.25;
    
    const filteredResults = response.result.hits
      .filter((hit: any) => hit._score >= MINIMUM_SCORE)
      .map((hit: any) => ({
        id: hit._id,
        score: hit._score || 0,
        metadata: hit.fields as VectorRecord['metadata'],
        text: hit.fields?.text
      }));
    
    console.log(`✅ Filtered ${filteredResults.length} results above ${MINIMUM_SCORE} score threshold`);
    return filteredResults;
  } catch (error) {
    console.error("❌ Error searching Pinecone:", error);
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
