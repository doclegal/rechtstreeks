import { Pinecone } from "@pinecone-database/pinecone";

const INDEX_NAME = "rechtstreeks";
const INDEX_HOST = "rechtstreeks.svc.aped-4627-b74a.pinecone.io";
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
 * Search both WEB_ECLI and ECLI_NL namespaces in parallel
 * Returns separate result sets for each namespace
 */
export async function searchDualNamespaces(query: Omit<SearchQuery, 'namespace'>): Promise<DualNamespaceSearchResults> {
  try {
    console.log(`🔍 DUAL NAMESPACE SEARCH: Searching WEB_ECLI and ECLI_NL in parallel`);
    
    // Execute both searches in parallel
    const [webSearchResults, ecliNlResults] = await Promise.all([
      searchVectors({ ...query, namespace: 'WEB_ECLI' }).catch(error => {
        console.error('⚠️ Error searching WEB_ECLI namespace:', error);
        return [] as SearchResult[];
      }),
      searchVectors({ ...query, namespace: 'ECLI_NL' }).catch(error => {
        console.error('⚠️ Error searching ECLI_NL namespace:', error);
        return [] as SearchResult[];
      })
    ]);
    
    // Tag results with their namespace
    const taggedWebSearch = webSearchResults.map(r => ({ ...r, namespace: 'WEB_ECLI' }));
    const taggedEcliNl = ecliNlResults.map(r => ({ ...r, namespace: 'ECLI_NL' }));
    
    console.log(`✅ DUAL SEARCH COMPLETE:`);
    console.log(`   📂 WEB_ECLI: ${taggedWebSearch.length} results`);
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

export interface RerankDocument {
  id: string;
  text: string;
}

export interface RerankResult {
  id: string;
  score: number;
  text: string;
  index: number;
}

export async function rerankDocuments(
  query: string,
  documents: RerankDocument[],
  topN: number = 30
): Promise<RerankResult[]> {
  try {
    const pc = getPineconeClient();
    
    console.log(`🔄 RERANKING with bge-reranker-v2-m3`);
    console.log(`📝 Query: "${query.substring(0, 100)}..."`);
    console.log(`📚 Documents to rerank: ${documents.length}`);
    console.log(`🎯 Top N: ${topN}`);
    
    if (documents.length === 0) {
      console.log('⚠️ No documents to rerank');
      return [];
    }
    
    const response = await pc.inference.rerank(
      "bge-reranker-v2-m3",
      query,
      documents.map(d => ({ id: d.id, text: d.text })),
      { topN, returnDocuments: true }
    );
    
    const results: RerankResult[] = (response.data || []).map((item: any) => ({
      id: item.document?.id || documents[item.index]?.id || '',
      score: item.score || 0,
      text: item.document?.text || documents[item.index]?.text || '',
      index: item.index
    }));
    
    console.log(`✅ Reranking complete: ${results.length} results`);
    if (results.length > 0) {
      console.log(`📊 Top 5 rerank scores: ${results.slice(0, 5).map(r => r.score.toFixed(4)).join(', ')}`);
    }
    
    return results;
  } catch (error) {
    console.error("❌ Error in reranking:", error);
    throw error;
  }
}

export interface LegislationSearchResult {
  id: string;
  score: number;
  rerankScore?: number;
  metadata: {
    bwb_id?: string;
    title?: string;
    law_code?: string;
    boek_nummer?: string;
    boek_titel?: string;
    titel_nummer?: string;
    titel_naam?: string;
    hoofdstuk_nummer?: string;
    article_number?: string;
    lid?: string;
    structure_path?: string;
    text?: string;
    is_current?: boolean;
    valid_from?: string;
    chunk_index?: number;
    total_chunks?: number;
    type?: string;
  };
  text?: string;
}

export async function searchLegislationWithRerank(
  query: string,
  topK: number = 200,
  rerankTopN: number = 30,
  maxDocsForRerank: number = 100  // Max documents for Pinecone bge-reranker-v2-m3 (limit: 100)
): Promise<LegislationSearchResult[]> {
  try {
    console.log(`\n📜 LEGISLATION SEARCH WITH RERANK PIPELINE`);
    console.log(`📝 Query: "${query.substring(0, 150)}..."`);
    
    console.log(`\n--- STAGE 1: First-stage retrieval (top_k=${topK}) ---`);
    const firstStageResults = await searchVectors({
      text: query,
      topK: topK,
      scoreThreshold: 0,
      namespace: 'laws-current'
    });
    
    console.log(`📊 First-stage retrieved ${firstStageResults.length} results`);
    
    if (firstStageResults.length === 0) {
      console.log('⚠️ No results from first-stage retrieval');
      return [];
    }
    
    // Use all first-stage results up to maxDocsForRerank limit
    const docsToRerank = Math.min(firstStageResults.length, maxDocsForRerank);
    
    console.log(`\n--- STAGE 2: Prepare documents for reranking (${docsToRerank} docs) ---`);
    const documentsForRerank: RerankDocument[] = firstStageResults.slice(0, docsToRerank).map(result => {
      const meta = result.metadata as any;
      const lawTitle = meta?.title || 'Onbekende wet';
      const boek = meta?.boek_nummer ? `Boek ${meta.boek_nummer}` : '';
      const titel = meta?.titel_nummer ? `Titel ${meta.titel_nummer}` : '';
      const art = meta?.article_number ? `Art. ${meta.article_number}` : '';
      const lid = meta?.lid ? `lid ${meta.lid}` : '';
      
      const contextParts = [lawTitle, boek, titel, art, lid].filter(Boolean);
      const contextHeader = contextParts.join(', ');
      
      const text = `${contextHeader}\n\n${result.text || meta?.text || ''}`;
      
      return {
        id: result.id,
        text: text.substring(0, 8000)
      };
    });
    
    console.log(`📚 Prepared ${documentsForRerank.length} documents for reranking`);
    
    console.log(`\n--- STAGE 3: Rerank with bge-reranker-v2-m3 ---`);
    const rerankedResults = await rerankDocuments(query, documentsForRerank, rerankTopN);
    
    console.log(`\n--- STAGE 4: Map reranked results back to original metadata ---`);
    const resultMap = new Map(firstStageResults.map(r => [r.id, r]));
    
    const finalResults: LegislationSearchResult[] = rerankedResults.map(reranked => {
      const original = resultMap.get(reranked.id);
      const meta = original?.metadata as any || {};
      
      return {
        id: reranked.id,
        score: original?.score || 0,
        rerankScore: reranked.score,
        metadata: {
          bwb_id: meta.bwb_id,
          title: meta.title,
          law_code: meta.law_code,
          boek_nummer: meta.boek_nummer,
          boek_titel: meta.boek_titel,
          titel_nummer: meta.titel_nummer,
          titel_naam: meta.titel_naam,
          hoofdstuk_nummer: meta.hoofdstuk_nummer,
          article_number: meta.article_number,
          lid: meta.lid,
          structure_path: meta.structure_path,
          text: meta.text,
          is_current: meta.is_current,
          valid_from: meta.valid_from,
          chunk_index: meta.chunk_index,
          total_chunks: meta.total_chunks,
          type: meta.type
        },
        text: original?.text || meta.text
      };
    });
    
    console.log(`✅ Final results: ${finalResults.length} reranked legislation chunks`);
    
    return finalResults;
  } catch (error) {
    console.error("❌ Error in legislation search with rerank:", error);
    throw error;
  }
}

export interface GroupedLawResult {
  bwbId: string;
  title: string;
  lawCode?: string;
  lawScore: number;
  articles: {
    articleNumber: string;
    lid?: string;
    score: number;
    rerankScore: number;
    text: string;
    boekNummer?: string;
    titelNummer?: string;
    hoofdstukNummer?: string;
    structurePath?: string;
    isCurrent?: boolean;
    validFrom?: string;
    id: string;
  }[];
}

export function groupResultsByLaw(
  results: LegislationSearchResult[],
  maxLaws: number = 10,
  maxArticlesPerLaw: number = 20
): GroupedLawResult[] {
  console.log(`\n--- STAGE 5: Group results by law (bwb_id) ---`);
  
  const lawGroups = new Map<string, {
    title: string;
    lawCode?: string;
    articles: LegislationSearchResult[];
    maxRerankScore: number;
  }>();
  
  for (const result of results) {
    const bwbId = result.metadata.bwb_id || 'unknown';
    const title = result.metadata.title || 'Onbekende wet';
    
    if (!lawGroups.has(bwbId)) {
      lawGroups.set(bwbId, {
        title,
        lawCode: result.metadata.law_code,
        articles: [],
        maxRerankScore: result.rerankScore || 0
      });
    }
    
    const group = lawGroups.get(bwbId)!;
    group.articles.push(result);
    if ((result.rerankScore || 0) > group.maxRerankScore) {
      group.maxRerankScore = result.rerankScore || 0;
    }
  }
  
  console.log(`📊 Found ${lawGroups.size} unique laws`);
  
  const sortedLaws = Array.from(lawGroups.entries())
    .sort((a, b) => b[1].maxRerankScore - a[1].maxRerankScore)
    .slice(0, maxLaws);
  
  console.log(`📋 Top ${sortedLaws.length} laws by rerank score:`);
  sortedLaws.forEach(([bwbId, group], idx) => {
    console.log(`   ${idx + 1}. ${group.title} (score: ${group.maxRerankScore.toFixed(4)}, ${group.articles.length} articles)`);
  });
  
  const groupedResults: GroupedLawResult[] = sortedLaws.map(([bwbId, group]) => {
    const sortedArticles = group.articles
      .sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0))
      .slice(0, maxArticlesPerLaw)
      .map(article => ({
        articleNumber: article.metadata.article_number || '',
        lid: article.metadata.lid,
        score: article.score,
        rerankScore: article.rerankScore || 0,
        text: article.text || article.metadata.text || '',
        boekNummer: article.metadata.boek_nummer,
        titelNummer: article.metadata.titel_nummer,
        hoofdstukNummer: article.metadata.hoofdstuk_nummer,
        structurePath: article.metadata.structure_path,
        isCurrent: article.metadata.is_current,
        validFrom: article.metadata.valid_from,
        id: article.id
      }));
    
    return {
      bwbId,
      title: group.title,
      lawCode: group.lawCode,
      lawScore: group.maxRerankScore,
      articles: sortedArticles
    };
  });
  
  return groupedResults;
}

export async function expandLawContext(
  bwbId: string,
  articleNumbers: string[],
  topK: number = 50
): Promise<LegislationSearchResult[]> {
  console.log(`\n--- STAGE 6: Context expansion for ${bwbId} ---`);
  console.log(`📖 Target articles: ${articleNumbers.join(', ')}`);
  
  const expandedResults: LegislationSearchResult[] = [];
  
  for (const articleNumber of articleNumbers) {
    try {
      const articleResults = await searchVectors({
        text: `artikel ${articleNumber}`,
        topK: 20,
        scoreThreshold: 0,
        namespace: 'laws-current',
        filter: {
          bwb_id: { $eq: bwbId },
          article_number: { $eq: articleNumber },
          is_current: { $eq: true }
        }
      });
      
      console.log(`   📄 Article ${articleNumber}: found ${articleResults.length} chunks (all leden)`);
      
      for (const result of articleResults) {
        const meta = result.metadata as any;
        expandedResults.push({
          id: result.id,
          score: result.score,
          metadata: {
            bwb_id: meta.bwb_id,
            title: meta.title,
            law_code: meta.law_code,
            boek_nummer: meta.boek_nummer,
            boek_titel: meta.boek_titel,
            titel_nummer: meta.titel_nummer,
            titel_naam: meta.titel_naam,
            hoofdstuk_nummer: meta.hoofdstuk_nummer,
            article_number: meta.article_number,
            lid: meta.lid,
            structure_path: meta.structure_path,
            text: meta.text,
            is_current: meta.is_current,
            valid_from: meta.valid_from,
            chunk_index: meta.chunk_index,
            total_chunks: meta.total_chunks,
            type: meta.type
          },
          text: result.text || meta.text
        });
      }
    } catch (error) {
      console.error(`   ⚠️ Error expanding article ${articleNumber}:`, error);
    }
  }
  
  const uniqueResults = Array.from(
    new Map(expandedResults.map(r => [r.id, r])).values()
  );
  
  console.log(`✅ Context expansion complete: ${uniqueResults.length} total chunks`);
  
  return uniqueResults;
}
