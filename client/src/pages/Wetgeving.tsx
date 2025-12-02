import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Search, Trash2, Sparkles, BookOpen, Loader2, ChevronDown, ChevronUp, FileText, Plus, X, MessageSquare, BookText, Save, Check } from "lucide-react";
import { useActiveCase } from "@/contexts/CaseContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SavedLegislationItem {
  id: string;
  caseId: string;
  bwbId: string;
  articleNumber: string;
  articleKey: string;
  lawTitle: string | null;
  articleText: string | null;
  wettenLink: string | null;
  boekNummer: string | null;
  boekTitel: string | null;
  validFrom: string | null;
  leden: any;
  commentary: any;
  commentarySources: any;
  commentaryGeneratedAt: string | null;
  searchScore: string | null;
  searchRank: number | null;
  createdAt: string;
}

interface LegislationResult {
  id: string;
  rank: number;
  score: number;
  scorePercent: string;
  bwbId?: string;
  bwb_id?: string;
  title?: string;
  articleNumber?: string;
  article_number?: string;
  displayArticleNumber?: string; // User's searched article number (preserves precision like "2.20")
  paragraphNumber?: string;
  paragraph_number?: string;
  lid?: string;
  sectionTitle?: string;
  section_title?: string;
  structure_path?: string;
  validFrom?: string;
  valid_from?: string;
  validTo?: string;
  isCurrent?: boolean;
  is_current?: boolean;
  text?: string;
  citatie?: string;
  bronUrl?: string | null;
  bron_url?: string | null;
  sourceQuery?: string;
}

interface GroupedArticle {
  articleKey: string;
  articleNumber: string;
  displayArticleNumber: string; // User's searched value (preserves precision like "2.20")
  title: string;
  bwbId: string;
  bronUrl: string | null;
  bestScore: number;
  bestScorePercent: string;
  bestRank: number;
  sourceQuery?: string;
  sectionTitle?: string;
  leden: {
    lid: string;
    text: string;
    score: number;
  }[];
}

interface ArticleEntry {
  id: string;
  regulation: string;
  articleNumber: string;
  reason?: string;
}

interface ArticleSuggestion {
  regulation: string;
  articleNumber: string;
  reason: string;
}

interface CommentaryResult {
  article: {
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
  };
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
    jurisprudence: Array<{
      ecli: string;
      court: string;
      source_url: string;
    }>;
    onlineSources: Array<{
      title: string;
      url: string;
      source_type: string;
    }>;
  };
  generatedAt: string;
}

export default function Wetgeving() {
  const { isLoading: authLoading } = useAuth();
  const currentCase = useActiveCase();
  const { toast } = useToast();

  const [articleEntries, setArticleEntries] = useState<ArticleEntry[]>([
    { id: '1', regulation: '', articleNumber: '' }
  ]);
  const [articleResults, setArticleResults] = useState<LegislationResult[]>([]);
  const [expandedGroupedArticles, setExpandedGroupedArticles] = useState<Set<string>>(new Set());
  const [aiExplanation, setAiExplanation] = useState("");
  const [isSearchingAll, setIsSearchingAll] = useState(false);
  const [selectedCommentary, setSelectedCommentary] = useState<CommentaryResult | null>(null);
  const [loadingCommentaryFor, setLoadingCommentaryFor] = useState<string | null>(null);
  const [savedArticleKeys, setSavedArticleKeys] = useState<Set<string>>(new Set());
  const initialCommentaryLoadedRef = useRef(false);

  const { data: savedData, isLoading: savedDataLoading } = useQuery({
    queryKey: ['/api/wetgeving', currentCase?.id],
    enabled: !!currentCase?.id,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/wetgeving/${currentCase?.id}`);
      return response.json();
    }
  });

  const { data: savedLegislation = [], isLoading: savedLegislationLoading } = useQuery<SavedLegislationItem[]>({
    queryKey: ['/api/wetgeving', currentCase?.id, 'saved'],
    enabled: !!currentCase?.id,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/wetgeving/${currentCase?.id}/saved`);
      return response.json();
    }
  });

  useEffect(() => {
    if (savedData?.searchResults && savedData.searchResults.length > 0) {
      setArticleResults(savedData.searchResults);
    }
    if (savedData?.articleEntries && savedData.articleEntries.length > 0) {
      setArticleEntries(savedData.articleEntries);
    }
  }, [savedData]);

  const savedLegislationLength = savedLegislation.length;
  const savedLegislationKeysString = savedLegislation.map(item => item.articleKey).join(',');

  useEffect(() => {
    const keys = savedLegislationKeysString.split(',').filter(k => k);
    setSavedArticleKeys(new Set(keys));
  }, [savedLegislationKeysString]);

  useEffect(() => {
    if (!initialCommentaryLoadedRef.current && savedLegislationLength > 0) {
      const firstWithCommentary = savedLegislation.find(item => item.commentary);
      if (firstWithCommentary) {
        initialCommentaryLoadedRef.current = true;
        const commentaryResult: CommentaryResult = {
          article: {
            id: firstWithCommentary.id,
            lawTitle: firstWithCommentary.lawTitle || '',
            boekNummer: firstWithCommentary.boekNummer || undefined,
            boekTitel: firstWithCommentary.boekTitel || undefined,
            articleNumber: firstWithCommentary.articleNumber,
            validFrom: firstWithCommentary.validFrom || undefined,
            text: firstWithCommentary.articleText || '',
            bwbId: firstWithCommentary.bwbId,
            wettenLink: firstWithCommentary.wettenLink || `https://wetten.overheid.nl/${firstWithCommentary.bwbId}`
          },
          commentary: firstWithCommentary.commentary,
          sources: firstWithCommentary.commentarySources || { wettenLink: '', jurisprudence: [], onlineSources: [] },
          generatedAt: firstWithCommentary.commentaryGeneratedAt || new Date().toISOString()
        };
        setSelectedCommentary(commentaryResult);
      }
    }
  }, [savedLegislationLength, savedLegislation]);

  const saveLegislationMutation = useMutation({
    mutationFn: async ({ article, commentary, sources }: { article: any; commentary?: any; sources?: any }) => {
      const response = await apiRequest('POST', `/api/wetgeving/${currentCase?.id}/saved`, {
        article,
        commentary,
        sources
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/wetgeving', currentCase?.id, 'saved'] });
      toast({
        title: "Artikel opgeslagen",
        description: data.message || "Het artikel is bewaard voor deze zaak",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij opslaan",
        description: error.message || "Kon artikel niet opslaan",
        variant: "destructive",
      });
    }
  });

  const deleteLegislationMutation = useMutation({
    mutationFn: async (articleKey: string) => {
      const encodedKey = encodeURIComponent(articleKey);
      const response = await apiRequest('DELETE', `/api/wetgeving/${currentCase?.id}/saved/${encodedKey}`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/wetgeving', currentCase?.id, 'saved'] });
      toast({
        title: "Artikel verwijderd",
        description: data.message || "Het artikel is verwijderd",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij verwijderen",
        description: error.message || "Kon artikel niet verwijderen",
        variant: "destructive",
      });
    }
  });

  const groupResultsByArticle = (results: LegislationResult[]): GroupedArticle[] => {
    const grouped = new Map<string, GroupedArticle>();
    
    for (const result of results) {
      const articleNum = result.articleNumber || result.article_number || 'unknown';
      const displayNum = result.displayArticleNumber || articleNum; // Use display number if available
      const bwbId = result.bwbId || result.bwb_id || 'unknown';
      const key = `${bwbId}:${articleNum}`;
      
      const lidNumber = result.lid || result.paragraphNumber || result.paragraph_number || '1';
      const sectionTitle = result.sectionTitle || result.section_title || result.structure_path;
      const bronUrl = result.bronUrl || result.bron_url;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          articleKey: key,
          articleNumber: articleNum,
          displayArticleNumber: displayNum, // Preserve user's searched value
          title: result.title || '',
          bwbId: bwbId,
          bronUrl: bronUrl || null,
          bestScore: result.score,
          bestScorePercent: result.scorePercent,
          bestRank: result.rank,
          sourceQuery: result.sourceQuery,
          sectionTitle: sectionTitle,
          leden: []
        });
      }
      
      const article = grouped.get(key)!;
      
      if (result.score > article.bestScore) {
        article.bestScore = result.score;
        article.bestScorePercent = result.scorePercent;
        article.bestRank = result.rank;
      }
      
      if (!article.sectionTitle && sectionTitle) {
        article.sectionTitle = sectionTitle;
      }
      
      const existingLid = article.leden.find(l => l.lid === lidNumber);
      if (!existingLid && result.text) {
        article.leden.push({
          lid: lidNumber,
          text: result.text,
          score: result.score
        });
      }
    }
    
    const groupedArray = Array.from(grouped.values());
    for (const article of groupedArray) {
      article.leden.sort((a: { lid: string }, b: { lid: string }) => {
        const numA = parseInt(a.lid) || 0;
        const numB = parseInt(b.lid) || 0;
        return numA - numB;
      });
    }
    
    return groupedArray.sort((a, b) => a.bestRank - b.bestRank);
  };

  const groupedArticleResults = groupResultsByArticle(articleResults);

  const { data: hasAnalysis = false } = useQuery({
    queryKey: ['/api/cases', currentCase?.id, 'has-analysis'],
    enabled: !!currentCase?.id,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/cases/${currentCase?.id}/analyses`);
      const analyses = await response.json();
      return analyses.some((a: any) => 
        (a.legalAdviceJson !== null && a.legalAdviceJson !== undefined) ||
        (a.succesKansAnalysis !== null && a.succesKansAnalysis !== undefined)
      );
    }
  });

  const addArticleEntry = () => {
    const newId = Date.now().toString();
    setArticleEntries([...articleEntries, { id: newId, regulation: '', articleNumber: '' }]);
  };

  const removeArticleEntry = (id: string) => {
    if (articleEntries.length > 1) {
      setArticleEntries(articleEntries.filter(entry => entry.id !== id));
    }
  };

  const updateArticleEntry = (id: string, field: 'regulation' | 'articleNumber', value: string) => {
    setArticleEntries(articleEntries.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const saveSearchResults = async (results: LegislationResult[], entries: ArticleEntry[]) => {
    if (!currentCase?.id) return;
    
    try {
      await apiRequest('PATCH', `/api/wetgeving/${currentCase.id}/save-search`, {
        results: results,
        articleEntries: entries
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ['/api/wetgeving', currentCase.id] 
      });
    } catch (error) {
      console.error('Failed to save search results:', error);
    }
  };

  const searchAllArticles = async () => {
    const validEntries = articleEntries.filter(e => e.regulation.trim() && e.articleNumber.trim());
    
    if (validEntries.length === 0) {
      toast({
        title: "Geen artikelen om te zoeken",
        description: "Vul tenminste één regeling en artikelnummer in",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingAll(true);
    const allResults: LegislationResult[] = [];

    try {
      for (const entry of validEntries) {
        const response = await apiRequest('POST', '/api/wetgeving/search-article', {
          regulation: entry.regulation.trim(),
          articleNumber: entry.articleNumber.trim(),
          topK: 200
        });
        
        const data = await response.json();
        const resultsWithSource = (data.results || []).map((r: LegislationResult) => ({
          ...r,
          sourceQuery: `${entry.regulation} art. ${entry.articleNumber}`
        }));
        allResults.push(...resultsWithSource);
      }

      setArticleResults(allResults);
      
      await saveSearchResults(allResults, validEntries);
      
      toast({
        title: "Zoeken voltooid",
        description: `${allResults.length} artikelleden gevonden voor ${validEntries.length} artikel(en)`,
      });
    } catch (error: any) {
      toast({
        title: "Fout bij zoeken",
        description: error.message || "Kon artikelen niet vinden",
        variant: "destructive",
      });
    } finally {
      setIsSearchingAll(false);
    }
  };

  const generateArticlesMutation = useMutation({
    mutationFn: async () => {
      if (!currentCase?.id) {
        throw new Error('Geen actieve zaak geselecteerd');
      }

      if (!hasAnalysis) {
        throw new Error('Genereer eerst een analyse op de Analyse pagina');
      }

      const response = await apiRequest('POST', '/api/wetgeving/generate-articles', {
        caseId: currentCase.id
      });
      
      return response.json();
    },
    onSuccess: async (data: any) => {
      const articles: ArticleSuggestion[] = data.articles || [];
      setAiExplanation(data.explanation || '');
      
      if (articles.length === 0) {
        toast({
          title: "Geen artikelen gevonden",
          description: "AI kon geen specifieke artikelen identificeren",
        });
        return;
      }

      const newEntries: ArticleEntry[] = articles.map((art, idx) => ({
        id: `ai-${Date.now()}-${idx}`,
        regulation: art.regulation,
        articleNumber: art.articleNumber,
        reason: art.reason
      }));

      setArticleEntries(newEntries);

      setIsSearchingAll(true);
      const allResults: LegislationResult[] = [];

      try {
        for (const entry of newEntries) {
          const response = await apiRequest('POST', '/api/wetgeving/search-article', {
            regulation: entry.regulation.trim(),
            articleNumber: entry.articleNumber.trim(),
            topK: 200
          });
          
          const searchData = await response.json();
          const resultsWithSource = (searchData.results || []).map((r: LegislationResult) => ({
            ...r,
            sourceQuery: `${entry.regulation} art. ${entry.articleNumber}`
          }));
          allResults.push(...resultsWithSource);
        }

        setArticleResults(allResults);
        
        await saveSearchResults(allResults, newEntries);
        
        toast({
          title: "Artikelen geïdentificeerd en gezocht",
          description: `${articles.length} artikelen gevonden, ${allResults.length} resultaten totaal`,
        });
      } catch (error) {
        console.error('Error searching articles:', error);
        toast({
          title: "Artikelen geïdentificeerd",
          description: `${articles.length} artikelen ingevuld. Er was een fout bij het zoeken.`,
        });
      } finally {
        setIsSearchingAll(false);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij genereren",
        description: error.message || "Kon geen artikelen identificeren",
        variant: "destructive",
      });
    }
  });

  const fetchCommentary = async (article: GroupedArticle) => {
    const key = article.articleKey;
    setLoadingCommentaryFor(key);
    
    try {
      const response = await apiRequest('POST', '/api/wetgeving/commentary', {
        bwbId: article.bwbId,
        articleNumber: article.articleNumber
      });
      
      const data = await response.json();
      setSelectedCommentary(data);
      
      saveLegislationMutation.mutate({
        article: {
          ...article,
          text: data.article?.text || article.leden.map((l: any) => l.text).join('\n'),
          lawTitle: data.article?.lawTitle || article.title,
          wettenLink: data.article?.wettenLink || article.bronUrl,
          boekNummer: data.article?.boekNummer,
          boekTitel: data.article?.boekTitel,
          validFrom: data.article?.validFrom
        },
        commentary: data.commentary,
        sources: data.sources
      });
      
      toast({
        title: "Commentaar geladen en opgeslagen",
        description: `Tekst & Commentaar voor Art. ${article.displayArticleNumber} is beschikbaar en bewaard`,
      });
    } catch (error: any) {
      toast({
        title: "Fout bij laden",
        description: error.message || "Kon commentaar niet ophalen",
        variant: "destructive",
      });
    } finally {
      setLoadingCommentaryFor(null);
    }
  };

  const saveArticleWithoutCommentary = async (article: GroupedArticle) => {
    saveLegislationMutation.mutate({
      article: {
        ...article,
        text: article.leden.map((l: any) => l.text).join('\n'),
        lawTitle: article.title,
        wettenLink: article.bronUrl
      }
    });
  };

  const deleteArticle = async (articleKey: string) => {
    if (savedArticleKeys.has(articleKey)) {
      deleteLegislationMutation.mutate(articleKey);
    }
  };

  const loadSavedCommentary = (savedItem: SavedLegislationItem) => {
    if (!savedItem.commentary) {
      toast({
        title: "Geen commentaar",
        description: "Dit artikel heeft nog geen opgeslagen commentaar. Klik op 'Commentaar ophalen' om commentaar te genereren.",
        variant: "default",
      });
      return;
    }

    const commentaryResult: CommentaryResult = {
      article: {
        id: savedItem.id,
        lawTitle: savedItem.lawTitle || '',
        boekNummer: savedItem.boekNummer || undefined,
        boekTitel: savedItem.boekTitel || undefined,
        articleNumber: savedItem.articleNumber,
        validFrom: savedItem.validFrom || undefined,
        text: savedItem.articleText || '',
        bwbId: savedItem.bwbId,
        wettenLink: savedItem.wettenLink || `https://wetten.overheid.nl/${savedItem.bwbId}`
      },
      commentary: savedItem.commentary,
      sources: savedItem.commentarySources || { wettenLink: '', jurisprudence: [], onlineSources: [] },
      generatedAt: savedItem.commentaryGeneratedAt || new Date().toISOString()
    };

    setSelectedCommentary(commentaryResult);
    
    toast({
      title: "Opgeslagen commentaar geladen",
      description: `Commentaar voor Art. ${savedItem.articleNumber} wordt getoond`,
    });
  };

  const savedArticlesWithCommentary = useMemo(() => 
    savedLegislation.filter(item => item.commentary), [savedLegislation]);
  const savedArticlesWithoutCommentary = useMemo(() => 
    savedLegislation.filter(item => !item.commentary), [savedLegislation]);

  const clearArticleResults = async () => {
    setArticleResults([]);
    setArticleEntries([{ id: '1', regulation: '', articleNumber: '' }]);
    setAiExplanation('');
    setSelectedCommentary(null);
    
    if (currentCase?.id) {
      try {
        await apiRequest('PATCH', `/api/wetgeving/${currentCase.id}/save-search`, {
          results: [],
          articleEntries: []
        });
        
        queryClient.invalidateQueries({ 
          queryKey: ['/api/wetgeving', currentCase.id] 
        });
      } catch (error) {
        console.error('Failed to clear search results:', error);
      }
    }
  };

  if (authLoading || savedDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  if (!currentCase) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">Geen actieve zaak</h2>
          <p className="text-muted-foreground mb-6">
            U heeft nog geen zaak aangemaakt.
          </p>
          <Button asChild size="lg" data-testid="button-create-first-case">
            <Link href="/new-case">
              Eerste zaak starten
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const toggleExpandedGrouped = (articleKey: string) => {
    setExpandedGroupedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleKey)) {
        newSet.delete(articleKey);
      } else {
        newSet.add(articleKey);
      }
      return newSet;
    });
  };

  const extractCleanLidText = (text: string): string => {
    if (!text) return '';
    
    let cleaned = text;
    
    const pathMatch = cleaned.match(/^(Boek\s+\d+[^>]*(?:\s*>\s*[^>]+)*\s*Artikel\s+[\d:]+\s*Lid\s+\d+\s*)/i);
    if (pathMatch) {
      cleaned = cleaned.substring(pathMatch[1].length);
    }
    
    cleaned = cleaned.replace(/^(\d+)\s+Lid\s+\d+\s+(\d+)\s+/i, '$2 ');
    
    cleaned = cleaned.replace(/^Lid\s+\d+\s+/i, '');
    
    return cleaned.trim();
  };
  
  const formatLidTextWithParagraphs = (text: string): string[] => {
    if (!text) return [];
    
    const cleaned = extractCleanLidText(text);
    
    const parts = cleaned.split(/(?=\d+\s+[A-Z])/);
    
    if (parts.length <= 1) {
      return [cleaned];
    }
    
    return parts.filter(p => p.trim().length > 0);
  };

  const GroupedArticleCard = ({
    article,
    index,
    expanded,
    onToggle,
    onGetCommentary,
    isLoadingCommentary,
    testIdPrefix,
    isSaved,
    onSave,
    onDelete,
    isSaving,
    isDeleting
  }: {
    article: GroupedArticle;
    index: number;
    expanded: boolean;
    onToggle: () => void;
    onGetCommentary: () => void;
    isLoadingCommentary: boolean;
    testIdPrefix: string;
    isSaved: boolean;
    onSave: () => void;
    onDelete: () => void;
    isSaving: boolean;
    isDeleting: boolean;
  }) => {
    const allParagraphs: string[] = [];
    for (const lid of article.leden) {
      const parts = formatLidTextWithParagraphs(lid.text);
      allParagraphs.push(...parts);
    }
    
    return (
      <div 
        className={`border rounded-lg p-4 space-y-2 ${isSaved ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800' : 'bg-muted/30'}`}
        data-testid={`${testIdPrefix}-${index}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-green-600 hover:bg-green-700 text-white font-mono text-xs">
            Art. {article.displayArticleNumber}
          </Badge>
          {isSaved && (
            <Badge variant="outline" className="text-xs border-green-500 text-green-600">
              <Check className="h-3 w-3 mr-1" />
              Opgeslagen
            </Badge>
          )}
          {article.title && (
            article.bronUrl ? (
              <a href={article.bronUrl} target="_blank" rel="noopener noreferrer">
                <Badge variant="secondary" className="text-xs hover:bg-primary/20 cursor-pointer">
                  {article.title}
                </Badge>
              </a>
            ) : (
              <Badge variant="secondary" className="text-xs">
                {article.title}
              </Badge>
            )
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={onGetCommentary}
            disabled={isLoadingCommentary}
            data-testid={`button-get-commentary-${testIdPrefix}-${index}`}
          >
            {isLoadingCommentary ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <MessageSquare className="h-3 w-3 mr-1" />
            )}
            {isLoadingCommentary ? 'Laden...' : 'Commentaar ophalen'}
          </Button>
          
          {!isSaved ? (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={onSave}
              disabled={isSaving}
              data-testid={`button-save-${testIdPrefix}-${index}`}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              {isSaving ? 'Opslaan...' : 'Opslaan'}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2 text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={isDeleting}
              data-testid={`button-delete-${testIdPrefix}-${index}`}
            >
              {isDeleting ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3 mr-1" />
              )}
              {isDeleting ? 'Verwijderen...' : 'Verwijderen'}
            </Button>
          )}
        </div>

        {article.sectionTitle && (
          <p className="text-xs text-muted-foreground">
            {article.sectionTitle}
          </p>
        )}

        <p className="text-sm font-semibold">
          Artikel {article.displayArticleNumber.replace(/^7:/, '')}
        </p>

        {expanded && (
          <div className="text-sm text-muted-foreground space-y-2">
            {allParagraphs.map((para, idx) => (
              <p key={`${article.articleKey}-para-${idx}`}>
                {para}
              </p>
            ))}
          </div>
        )}

        <button
          onClick={onToggle}
          className="inline-flex items-center text-sm text-primary hover:underline"
          data-testid={`button-toggle-${testIdPrefix}-${index}`}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Minder tonen
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Lees verder
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Button variant="ghost" asChild className="mb-4" data-testid="button-back-to-analysis">
        <Link href="/analysis">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar analyse
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Wetgeving</h1>
        <p className="text-muted-foreground">
          Zoek relevante wetsartikelen voor {currentCase.title || 'uw zaak'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Article search + results */}
        <div className="space-y-6">
          {/* Article search panel */}
          <Card data-testid="card-article-search">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Zoeken op artikelen
              </CardTitle>
              <CardDescription>
                Zoek specifieke regelingen en artikelen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {articleEntries.map((entry, idx) => (
                  <div key={entry.id} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Regeling (bijv. Burgerlijk Wetboek Boek 7)"
                        value={entry.regulation}
                        onChange={(e) => updateArticleEntry(entry.id, 'regulation', e.target.value)}
                        className="text-sm"
                        data-testid={`input-regulation-${idx}`}
                      />
                      <Input
                        placeholder="Artikel (bijv. 7:201)"
                        value={entry.articleNumber}
                        onChange={(e) => updateArticleEntry(entry.id, 'articleNumber', e.target.value)}
                        className="text-sm"
                        data-testid={`input-article-${idx}`}
                      />
                    </div>
                    {articleEntries.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeArticleEntry(entry.id)}
                        className="shrink-0 h-9 w-9"
                        data-testid={`button-remove-entry-${idx}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={addArticleEntry}
                className="w-full text-xs"
                data-testid="button-add-entry"
              >
                <Plus className="h-3 w-3 mr-1" />
                Artikel toevoegen
              </Button>
              
              <div className="flex gap-2">
                <Button
                  onClick={searchAllArticles}
                  disabled={isSearchingAll || articleEntries.every(e => !e.regulation.trim() || !e.articleNumber.trim())}
                  className="flex-1"
                  data-testid="button-search-all-articles"
                >
                  {isSearchingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Zoeken...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Zoek alle artikelen
                    </>
                  )}
                </Button>
                
                {articleResults.length > 0 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={clearArticleResults}
                    data-testid="button-clear-article-results"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => generateArticlesMutation.mutate()}
                disabled={generateArticlesMutation.isPending || isSearchingAll || !hasAnalysis}
                className="w-full"
                data-testid="button-generate-articles"
              >
                {generateArticlesMutation.isPending || isSearchingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {generateArticlesMutation.isPending ? 'Identificeren...' : 'Zoeken...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Artikelen identificeren
                  </>
                )}
              </Button>

              {!hasAnalysis && (
                <p className="text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 inline mr-1" />
                  Voer eerst een analyse uit voor AI identificatie
                </p>
              )}

              {aiExplanation && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">{aiExplanation}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Article search results */}
          <Card data-testid="card-article-results">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5" />
                Resultaten
              </CardTitle>
              <CardDescription>
                {groupedArticleResults.length} artikelen gevonden ({articleResults.length} leden)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groupedArticleResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Geen resultaten</p>
                  <p className="text-xs">Zoek specifieke artikelen of gebruik AI</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {groupedArticleResults.map((article, index) => (
                    <GroupedArticleCard
                      key={article.articleKey}
                      article={article}
                      index={index}
                      expanded={expandedGroupedArticles.has(article.articleKey)}
                      onToggle={() => toggleExpandedGrouped(article.articleKey)}
                      onGetCommentary={() => fetchCommentary(article)}
                      isLoadingCommentary={loadingCommentaryFor === article.articleKey}
                      testIdPrefix="result-article"
                      isSaved={savedArticleKeys.has(article.articleKey)}
                      onSave={() => saveArticleWithoutCommentary(article)}
                      onDelete={() => deleteArticle(article.articleKey)}
                      isSaving={saveLegislationMutation.isPending}
                      isDeleting={deleteLegislationMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saved articles section */}
          {savedLegislation.length > 0 && (
            <Card data-testid="card-saved-articles">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Save className="h-5 w-5" />
                  Opgeslagen Artikelen
                  <Badge variant="secondary" className="ml-2">{savedLegislation.length}</Badge>
                </CardTitle>
                <CardDescription>
                  {savedArticlesWithCommentary.length} met commentaar, {savedArticlesWithoutCommentary.length} zonder
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {savedLegislation.map((item, index) => (
                    <div 
                      key={item.id}
                      className={`border rounded-lg p-3 ${item.commentary ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800' : 'bg-muted/30'}`}
                      data-testid={`saved-article-${index}`}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge className="bg-green-600 hover:bg-green-700 text-white font-mono text-xs">
                          Art. {item.articleNumber}
                        </Badge>
                        {item.lawTitle && (
                          <Badge variant="secondary" className="text-xs truncate max-w-[200px]">
                            {item.lawTitle}
                          </Badge>
                        )}
                        {item.commentary && (
                          <Badge variant="outline" className="text-xs border-green-500 text-green-600">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Commentaar
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {item.commentary ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => loadSavedCommentary(item)}
                            data-testid={`button-load-saved-commentary-${index}`}
                          >
                            <BookText className="h-3 w-3 mr-1" />
                            Bekijk commentaar
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => {
                              const groupedArticle: GroupedArticle = {
                                articleKey: item.articleKey,
                                articleNumber: item.articleNumber,
                                displayArticleNumber: item.articleNumber, // Use stored value for saved items
                                title: item.lawTitle || '',
                                bwbId: item.bwbId,
                                bronUrl: item.wettenLink,
                                bestScore: 0,
                                bestScorePercent: '0%',
                                bestRank: 0,
                                leden: item.leden || []
                              };
                              fetchCommentary(groupedArticle);
                            }}
                            disabled={loadingCommentaryFor === item.articleKey}
                            data-testid={`button-fetch-commentary-saved-${index}`}
                          >
                            {loadingCommentaryFor === item.articleKey ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <MessageSquare className="h-3 w-3 mr-1" />
                            )}
                            {loadingCommentaryFor === item.articleKey ? 'Laden...' : 'Commentaar ophalen'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                          onClick={() => deleteArticle(item.articleKey)}
                          disabled={deleteLegislationMutation.isPending}
                          data-testid={`button-delete-saved-${index}`}
                        >
                          {deleteLegislationMutation.isPending ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3 mr-1" />
                          )}
                          Verwijderen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Tekst & Commentaar */}
        <div className="space-y-6">
          <Card data-testid="card-text-commentary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BookText className="h-5 w-5" />
                  Tekst &amp; Commentaar
                </CardTitle>
                {selectedCommentary && (
                  <div className="flex items-center gap-2">
                    {savedArticleKeys.has(`${selectedCommentary.article.bwbId}:${selectedCommentary.article.articleNumber}`) ? (
                      <Badge variant="outline" className="text-xs border-green-500 text-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Opgeslagen
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          saveLegislationMutation.mutate({
                            article: {
                              articleKey: `${selectedCommentary.article.bwbId}:${selectedCommentary.article.articleNumber}`,
                              articleNumber: selectedCommentary.article.articleNumber,
                              title: selectedCommentary.article.lawTitle,
                              bwbId: selectedCommentary.article.bwbId,
                              bronUrl: selectedCommentary.article.wettenLink,
                              text: selectedCommentary.article.text,
                              lawTitle: selectedCommentary.article.lawTitle,
                              wettenLink: selectedCommentary.article.wettenLink,
                              boekNummer: selectedCommentary.article.boekNummer,
                              boekTitel: selectedCommentary.article.boekTitel,
                              validFrom: selectedCommentary.article.validFrom,
                              bestScore: 0,
                              bestScorePercent: '0%',
                              bestRank: 0,
                              leden: []
                            },
                            commentary: selectedCommentary.commentary,
                            sources: selectedCommentary.sources
                          });
                        }}
                        disabled={saveLegislationMutation.isPending}
                        data-testid="button-save-commentary"
                      >
                        {saveLegislationMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3 mr-1" />
                        )}
                        Opslaan
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <CardDescription>
                {selectedCommentary 
                  ? selectedCommentary.commentary.article_title
                  : 'Bekijk wettekst met juridisch commentaar'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedCommentary ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Selecteer een artikel</p>
                  <p className="text-xs">Klik op "Commentaar ophalen" bij een artikel om de tekst en commentaar te bekijken</p>
                </div>
              ) : (
                <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
                  {/* Article text section */}
                  <div className="border rounded-lg p-4 bg-muted/20">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm">Wettekst</h3>
                      <a 
                        href={selectedCommentary.article.wettenLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                        data-testid="link-wetten-overheid"
                      >
                        <FileText className="h-3 w-3" />
                        Bekijk op wetten.overheid.nl
                      </a>
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {selectedCommentary.article.lawTitle}
                        </Badge>
                        {selectedCommentary.article.boekTitel && (
                          <Badge variant="secondary" className="text-xs">
                            Boek {selectedCommentary.article.boekNummer}: {selectedCommentary.article.boekTitel}
                          </Badge>
                        )}
                        {selectedCommentary.article.validFrom && (
                          <Badge variant="outline" className="text-xs">
                            Geldig vanaf: {selectedCommentary.article.validFrom}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap font-mono bg-background p-3 rounded border">
                        {selectedCommentary.article.text}
                      </p>
                    </div>
                  </div>

                  {/* Commentary sections */}
                  <div className="space-y-4">
                    {/* Short intro */}
                    {selectedCommentary.commentary.short_intro && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Inleiding</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedCommentary.commentary.short_intro}
                        </p>
                      </div>
                    )}

                    {/* Systematiek */}
                    {selectedCommentary.commentary.systematiek && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Systematiek</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedCommentary.commentary.systematiek}
                        </p>
                      </div>
                    )}

                    {/* Kernbegrippen */}
                    {selectedCommentary.commentary.kernbegrippen?.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Kernbegrippen</h4>
                        <div className="space-y-2">
                          {selectedCommentary.commentary.kernbegrippen.map((begrip, idx) => (
                            <div key={idx} className="border-l-2 border-primary/30 pl-3">
                              <p className="font-medium text-sm">{begrip.term}</p>
                              <p className="text-sm text-muted-foreground">{begrip.explanation}</p>
                              {begrip.nuances && (
                                <p className="text-xs text-muted-foreground italic mt-1">{begrip.nuances}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reikwijdte en beperkingen */}
                    {selectedCommentary.commentary.reikwijdte_en_beperkingen && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Reikwijdte en beperkingen</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedCommentary.commentary.reikwijdte_en_beperkingen}
                        </p>
                      </div>
                    )}

                    {/* Belangrijkste rechtspraak */}
                    {selectedCommentary.commentary.belangrijkste_rechtspraak?.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Belangrijkste rechtspraak</h4>
                        <div className="space-y-2">
                          {selectedCommentary.commentary.belangrijkste_rechtspraak.map((caseItem, idx) => (
                            <div key={idx} className="border rounded p-2 bg-muted/20">
                              <div className="flex items-center gap-2 mb-1">
                                <a 
                                  href={caseItem.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-mono text-primary hover:underline"
                                  data-testid={`link-ecli-${idx}`}
                                >
                                  {caseItem.ecli}
                                </a>
                                <Badge variant="outline" className="text-xs">
                                  {caseItem.court}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{caseItem.date}</span>
                              </div>
                              <p className="text-sm">{caseItem.summary}</p>
                              {caseItem.importance && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <strong>Belang:</strong> {caseItem.importance}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Online bronnen */}
                    {selectedCommentary.commentary.online_bronnen?.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Online bronnen</h4>
                        <div className="space-y-1">
                          {selectedCommentary.commentary.online_bronnen.map((bron, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <a 
                                href={bron.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex-1"
                                data-testid={`link-source-${idx}`}
                              >
                                {bron.title}
                              </a>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {bron.source_type}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Disclaimers */}
                    {selectedCommentary.commentary.disclaimers?.length > 0 && (
                      <div className="border-t pt-4 mt-4">
                        <p className="text-xs text-muted-foreground">
                          {selectedCommentary.commentary.disclaimers.join(' ')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Clear button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCommentary(null)}
                    className="w-full"
                    data-testid="button-clear-commentary"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Commentaar sluiten
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
