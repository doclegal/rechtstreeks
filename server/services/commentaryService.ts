import OpenAI from "openai";
import { searchVectors } from "../pineconeService";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const commentaryCache = new Map<string, { result: CommentaryResult; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface ArticleViewModel {
  id: string;
  lawTitle: string;
  boekNummer?: string;
  boekTitel?: string;
  titelNummer?: string;
  titelNaam?: string;
  articleNumber: string;
  validFrom?: string;
  text: string;
  bwbId: string;
  wettenLink: string;
}

export interface IssueAnalysis {
  provision_summary: string;
  key_issues: Array<{
    name: string;
    description: string;
    priority: string;
  }>;
  related_provisions: string[];
  search_questions: string[];
  suggested_legal_area: string;
}

export interface OnlineSource {
  title: string;
  url: string;
  source_type: string;
  relevance: number;
  snippet: string;
}

export interface JurisprudenceItem {
  ecli: string;
  court: string;
  court_level: string;
  decision_date: string;
  legal_area: string;
  procedure_type: string;
  source_url: string;
  summary: string;
  title: string;
}

export interface CommentaryResult {
  article: ArticleViewModel;
  commentary: {
    article_title: string;
    article_wetten_link: string;
    short_intro: string;
    systematiek: string;
    kernbegrippen: Array<{
      term: string;
      explanation: string;
      nuances?: string;
    }>;
    reikwijdte_en_beperkingen: string;
    belangrijkste_rechtspraak: Array<{
      ecli: string;
      court: string;
      date: string;
      summary: string;
      importance: string;
      source_url: string;
    }>;
    online_bronnen: Array<{
      title: string;
      url: string;
      source_type: string;
      used_for: string;
    }>;
    disclaimers: string[];
  };
  sources: {
    wettenLink: string;
    jurisprudence: JurisprudenceItem[];
    onlineSources: OnlineSource[];
  };
  generatedAt: string;
}

export async function fetchArticleFromPinecone(
  bwbId: string,
  articleNumber: string
): Promise<ArticleViewModel | null> {
  try {
    console.log(`📖 Fetching article: bwb_id=${bwbId}, article_number=${articleNumber}`);
    
    const results = await searchVectors({
      text: `artikel ${articleNumber} ${bwbId}`,
      topK: 50,
      scoreThreshold: 0,
      namespace: 'laws-current',
      filter: {
        bwb_id: { $eq: bwbId },
        article_number: { $eq: articleNumber },
        is_current: { $eq: true }
      }
    });
    
    if (results.length === 0) {
      console.log(`⚠️ No article found for ${bwbId} art. ${articleNumber}`);
      return null;
    }
    
    const allLeden = results.sort((a, b) => {
      const lidA = parseInt((a.metadata as any)?.lid || '1');
      const lidB = parseInt((b.metadata as any)?.lid || '1');
      return lidA - lidB;
    });
    
    const firstResult = allLeden[0];
    const meta = firstResult.metadata as any;
    
    const combinedText = allLeden.map(r => r.text || (r.metadata as any)?.text || '').join('\n\n');
    
    const validFrom = meta.valid_from || '';
    const wettenLink = `https://wetten.overheid.nl/${bwbId}${validFrom ? `/${validFrom}` : ''}#Artikel${articleNumber}`;
    
    return {
      id: firstResult.id,
      lawTitle: meta.title || 'Onbekende wet',
      boekNummer: meta.boek_nummer,
      boekTitel: meta.boek_titel,
      titelNummer: meta.titel_nummer,
      titelNaam: meta.titel_naam,
      articleNumber: articleNumber,
      validFrom: validFrom,
      text: combinedText,
      bwbId: bwbId,
      wettenLink: wettenLink
    };
  } catch (error) {
    console.error('Error fetching article from Pinecone:', error);
    throw error;
  }
}

export async function analyzeProvision(
  article: ArticleViewModel,
  caseContext?: {
    disputeType?: string;
    relevantFacts?: string;
    legalBasis?: string;
    keyQuestions?: string;
  }
): Promise<IssueAnalysis> {
  try {
    console.log(`🔍 Analyzing provision: ${article.lawTitle} art. ${article.articleNumber}`);
    
    const contextInfo = caseContext ? `
ZAAKCONTEXT:
- Type geschil: ${caseContext.disputeType || 'Niet gespecificeerd'}
- Relevante feiten: ${caseContext.relevantFacts || 'Niet gespecificeerd'}
- Juridische grondslag: ${caseContext.legalBasis || 'Niet gespecificeerd'}
- Kernvragen: ${caseContext.keyQuestions || 'Niet gespecificeerd'}

Analyseer de bepaling in het licht van deze concrete zaak.
` : '';

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Je bent een Nederlandse juridische expert die wetsartikelen analyseert voor Tekst & Commentaar-stijl uitleg.
Analyseer de bepaling en geef een gestructureerde JSON respons.
${contextInfo ? 'Focus je analyse op de specifieke zaakcontext die is gegeven.' : 'Geef een algemene analyse.'}
Formuleer zoekquery's die geschikt zijn voor het vinden van relevante rechtspraak en doctrine.`
        },
        {
          role: "user",
          content: `Analyseer het volgende wetsartikel:

WET: ${article.lawTitle}
${article.boekTitel ? `BOEK: ${article.boekNummer} - ${article.boekTitel}` : ''}
${article.titelNaam ? `TITEL: ${article.titelNummer} - ${article.titelNaam}` : ''}
ARTIKEL: ${article.articleNumber}

TEKST:
${article.text}

${contextInfo}

Geef je analyse als JSON met de volgende structuur:
{
  "provision_summary": "korte neutrale samenvatting van de bepaling",
  "key_issues": [
    {"name": "issue naam", "description": "beschrijving", "priority": "hoog/midden/laag"}
  ],
  "related_provisions": ["art. X:XX BW", ...],
  "search_questions": ["zoekquery 1", "zoekquery 2", ...],
  "suggested_legal_area": "Civiel recht; Verbintenissenrecht"
}`
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content;
    if (!content) throw new Error('No response from OpenAI');
    
    const analysis = JSON.parse(content) as IssueAnalysis;
    console.log(`✅ Provision analysis complete: ${analysis.key_issues?.length || 0} key issues identified`);
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing provision:', error);
    throw error;
  }
}

export async function searchWebSources(
  searchQuestions: string[],
  articleRef: string
): Promise<OnlineSource[]> {
  const serperApiKey = process.env.SERPER_API_KEY;
  if (!serperApiKey) {
    console.log('⚠️ SERPER_API_KEY not configured, skipping web search');
    return [];
  }
  
  try {
    console.log(`🔍 Searching web for ${searchQuestions.length} queries`);
    
    const queries = searchQuestions.slice(0, 3).map(q => 
      `${q} ${articleRef} Nederlands recht juridisch`
    );
    
    const allResults: OnlineSource[] = [];
    
    for (const query of queries) {
      try {
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: query,
            gl: 'nl',
            hl: 'nl',
            num: 5
          })
        });
        
        if (!response.ok) {
          console.error(`Serper API error: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        for (const result of data.organic || []) {
          const sourceType = categorizeSource(result.link);
          if (sourceType !== 'irrelevant') {
            allResults.push({
              title: result.title || '',
              url: result.link || '',
              source_type: sourceType,
              relevance: 0.8,
              snippet: result.snippet || ''
            });
          }
        }
      } catch (err) {
        console.error('Error in Serper query:', err);
      }
    }
    
    const uniqueResults = allResults.filter((result, index, self) =>
      index === self.findIndex(r => r.url === result.url)
    );
    
    const filtered = await filterQualitySources(uniqueResults);
    
    console.log(`✅ Web search complete: ${filtered.length} quality sources found`);
    return filtered.slice(0, 8);
  } catch (error) {
    console.error('Error in web search:', error);
    return [];
  }
}

function categorizeSource(url: string): string {
  const domain = url.toLowerCase();
  
  if (domain.includes('.edu') || domain.includes('universiteit') || 
      domain.includes('university') || domain.includes('uu.nl') ||
      domain.includes('uva.nl') || domain.includes('rug.nl') ||
      domain.includes('leidenuniv.nl') || domain.includes('tilburguniversity.edu')) {
    return 'university';
  }
  if (domain.includes('advocaat') || domain.includes('law') || 
      domain.includes('juridisch') || domain.includes('advocaten')) {
    return 'law_firm';
  }
  if (domain.includes('rechtspraak.nl')) {
    return 'court';
  }
  if (domain.includes('overheid.nl') || domain.includes('rijksoverheid.nl')) {
    return 'government';
  }
  if (domain.includes('navigator.nl') || domain.includes('wolterskluwer') ||
      domain.includes('sdu.nl') || domain.includes('legaldutch')) {
    return 'legal_publisher';
  }
  if (domain.includes('blog') || domain.includes('artikel')) {
    return 'blog';
  }
  if (domain.includes('wikipedia')) {
    return 'irrelevant';
  }
  
  return 'other';
}

async function filterQualitySources(sources: OnlineSource[]): Promise<OnlineSource[]> {
  const qualityTypes = ['university', 'law_firm', 'court', 'government', 'legal_publisher'];
  
  const highQuality = sources.filter(s => qualityTypes.includes(s.source_type));
  const other = sources.filter(s => !qualityTypes.includes(s.source_type) && s.source_type !== 'irrelevant');
  
  return [...highQuality, ...other.slice(0, 3)];
}

export async function searchJurisprudence(
  articleRef: string,
  analysis: IssueAnalysis
): Promise<JurisprudenceItem[]> {
  try {
    console.log(`⚖️ Searching jurisprudence for: ${articleRef}`);
    
    const queryParts = [
      articleRef,
      analysis.provision_summary,
      ...analysis.key_issues.map(i => i.name),
      analysis.suggested_legal_area
    ];
    const queryText = queryParts.filter(Boolean).join(' ');
    
    const [ecliResults, webEcliResults] = await Promise.all([
      searchVectors({
        text: queryText,
        topK: 20,
        scoreThreshold: 0.5,
        namespace: 'ECLI_NL',
        filter: {
          court_level: { $in: ['Hoge Raad', 'Gerechtshof'] }
        }
      }).catch(() => []),
      searchVectors({
        text: queryText,
        topK: 20,
        scoreThreshold: 0.5,
        namespace: 'WEB_ECLI',
        filter: {
          court_level: { $in: ['Hoge Raad', 'Gerechtshof'] }
        }
      }).catch(() => [])
    ]);
    
    const allResults = [...ecliResults, ...webEcliResults];
    
    const uniqueByEcli = new Map<string, any>();
    for (const result of allResults) {
      const meta = result.metadata as any;
      const ecli = meta.ecli || result.id;
      if (!uniqueByEcli.has(ecli) || result.score > uniqueByEcli.get(ecli).score) {
        uniqueByEcli.set(ecli, result);
      }
    }
    
    const sorted = Array.from(uniqueByEcli.values()).sort((a, b) => {
      const metaA = a.metadata as any;
      const metaB = b.metadata as any;
      
      const levelA = metaA.court_level === 'Hoge Raad' ? 0 : 1;
      const levelB = metaB.court_level === 'Hoge Raad' ? 0 : 1;
      if (levelA !== levelB) return levelA - levelB;
      
      return b.score - a.score;
    });
    
    const jurisprudence: JurisprudenceItem[] = sorted.slice(0, 10).map(result => {
      const meta = result.metadata as any;
      return {
        ecli: meta.ecli || result.id,
        court: meta.court || 'Onbekend',
        court_level: meta.court_level || 'Onbekend',
        decision_date: meta.decision_date || '',
        legal_area: meta.legal_area || '',
        procedure_type: meta.procedure_type || '',
        source_url: meta.source_url || `https://uitspraken.rechtspraak.nl/details?id=${meta.ecli || result.id}`,
        summary: result.text || meta.ai_inhoudsindicatie || meta.text || '',
        title: meta.title || 'Geen titel'
      };
    });
    
    console.log(`✅ Jurisprudence search complete: ${jurisprudence.length} cases found`);
    return jurisprudence;
  } catch (error) {
    console.error('Error searching jurisprudence:', error);
    return [];
  }
}

export async function generateCommentary(
  article: ArticleViewModel,
  analysis: IssueAnalysis,
  onlineSources: OnlineSource[],
  jurisprudence: JurisprudenceItem[]
): Promise<CommentaryResult['commentary']> {
  try {
    console.log(`✍️ Generating commentary for: ${article.lawTitle} art. ${article.articleNumber}`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Je bent een expert in Nederlands recht en schrijft Tekst & Commentaar-stijl uitleg voor wetsartikelen.
Schrijf professioneel, helder en in het Nederlands.
Verwijs ALLEEN naar de ECLI-nummers die in de input worden gegeven. Verzin NOOIT zelf ECLI-nummers.
Alle tekst moet in het Nederlands zijn.`
        },
        {
          role: "user",
          content: `Genereer een Tekst & Commentaar uitleg voor het volgende artikel:

ARTIKEL INFORMATIE:
- Wet: ${article.lawTitle}
- Artikel: ${article.articleNumber}
- Link: ${article.wettenLink}
${article.boekTitel ? `- Boek: ${article.boekNummer} - ${article.boekTitel}` : ''}
${article.titelNaam ? `- Titel: ${article.titelNummer} - ${article.titelNaam}` : ''}

WETTEKST:
${article.text}

ANALYSE:
${JSON.stringify(analysis, null, 2)}

BESCHIKBARE RECHTSPRAAK (gebruik ALLEEN deze ECLI's):
${jurisprudence.length > 0 ? jurisprudence.map(j => 
  `- ${j.ecli} (${j.court}, ${j.decision_date}): ${j.summary?.substring(0, 200)}...`
).join('\n') : 'Geen rechtspraak beschikbaar'}

ONLINE BRONNEN:
${onlineSources.length > 0 ? onlineSources.map(s => 
  `- ${s.title} (${s.source_type}): ${s.url}`
).join('\n') : 'Geen online bronnen beschikbaar'}

Geef je antwoord als JSON met deze structuur:
{
  "article_title": "Art. X:XX BW - [Korte titel]",
  "article_wetten_link": "${article.wettenLink}",
  "short_intro": "Korte introductie over de functie van de bepaling",
  "systematiek": "Uitleg over de plaats en rol van het artikel in het wettelijk systeem",
  "kernbegrippen": [
    {"term": "begrip", "explanation": "uitleg", "nuances": "eventuele nuances"}
  ],
  "reikwijdte_en_beperkingen": "Reikwijdte en belangrijkste beperkingen",
  "belangrijkste_rechtspraak": [
    {"ecli": "ECLI:...", "court": "rechtbank", "date": "datum", "summary": "samenvatting", "importance": "belang", "source_url": "url"}
  ],
  "online_bronnen": [
    {"title": "titel", "url": "url", "source_type": "type", "used_for": "waarvoor gebruikt"}
  ],
  "disclaimers": ["disclaimer teksten"]
}`
        }
      ],
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content;
    if (!content) throw new Error('No response from OpenAI');
    
    const commentary = JSON.parse(content);
    console.log(`✅ Commentary generated successfully`);
    
    return commentary;
  } catch (error) {
    console.error('Error generating commentary:', error);
    throw error;
  }
}

export async function getArticleCommentary(
  bwbId: string,
  articleNumber: string,
  caseContext?: {
    disputeType?: string;
    relevantFacts?: string;
    legalBasis?: string;
    keyQuestions?: string;
  },
  forceRefresh: boolean = false
): Promise<CommentaryResult> {
  const cacheKey = `${bwbId}:${articleNumber}`;
  
  if (!forceRefresh) {
    const cached = commentaryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      console.log(`📋 Returning cached commentary for ${cacheKey}`);
      return cached.result;
    }
  }
  
  console.log(`\n📚 GENERATING COMMENTARY: ${bwbId} art. ${articleNumber}`);
  console.log('='.repeat(50));
  
  const article = await fetchArticleFromPinecone(bwbId, articleNumber);
  if (!article) {
    throw new Error(`Artikel ${articleNumber} niet gevonden in ${bwbId}`);
  }
  
  const articleRef = `art. ${articleNumber} ${article.lawTitle}`;
  
  const analysis = await analyzeProvision(article, caseContext);
  
  const [onlineSources, jurisprudence] = await Promise.all([
    searchWebSources(analysis.search_questions, articleRef),
    searchJurisprudence(articleRef, analysis)
  ]);
  
  const commentary = await generateCommentary(article, analysis, onlineSources, jurisprudence);
  
  console.log('='.repeat(50));
  console.log(`✅ COMMENTARY COMPLETE for ${articleRef}\n`);
  
  const result: CommentaryResult = {
    article,
    commentary,
    sources: {
      wettenLink: article.wettenLink,
      jurisprudence,
      onlineSources
    },
    generatedAt: new Date().toISOString()
  };
  
  commentaryCache.set(cacheKey, { result, timestamp: Date.now() });
  console.log(`💾 Commentary cached for ${cacheKey}`);
  
  return result;
}

export function clearCommentaryCache(bwbId?: string, articleNumber?: string): void {
  if (bwbId && articleNumber) {
    const cacheKey = `${bwbId}:${articleNumber}`;
    commentaryCache.delete(cacheKey);
    console.log(`🗑️ Cleared cache for ${cacheKey}`);
  } else {
    commentaryCache.clear();
    console.log('🗑️ Cleared all commentary cache');
  }
}
