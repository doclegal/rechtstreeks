import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Search, Trash2, Sparkles, BookOpen, Loader2, ChevronDown, ChevronUp, FileText, Plus, X, MessageSquare, BookText } from "lucide-react";
import { useActiveCase } from "@/contexts/CaseContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  const { data: savedData, isLoading: savedDataLoading } = useQuery({
    queryKey: ['/api/wetgeving', currentCase?.id],
    enabled: !!currentCase?.id,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/wetgeving/${currentCase?.id}`);
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

  const groupResultsByArticle = (results: LegislationResult[]): GroupedArticle[] => {
    const grouped = new Map<string, GroupedArticle>();
    
    for (const result of results) {
      const articleNum = result.articleNumber || result.article_number || 'unknown';
      const bwbId = result.bwbId || result.bwb_id || 'unknown';
      const key = `${bwbId}:${articleNum}`;
      
      const lidNumber = result.lid || result.paragraphNumber || result.paragraph_number || '1';
      const sectionTitle = result.sectionTitle || result.section_title || result.structure_path;
      const bronUrl = result.bronUrl || result.bron_url;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          articleKey: key,
          articleNumber: articleNum,
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

  const clearArticleResults = async () => {
    setArticleResults([]);
    setArticleEntries([{ id: '1', regulation: '', articleNumber: '' }]);
    setAiExplanation('');
    
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
    testIdPrefix
  }: {
    article: GroupedArticle;
    index: number;
    expanded: boolean;
    onToggle: () => void;
    testIdPrefix: string;
  }) => {
    const allParagraphs: string[] = [];
    for (const lid of article.leden) {
      const parts = formatLidTextWithParagraphs(lid.text);
      allParagraphs.push(...parts);
    }
    
    return (
      <div 
        className="border rounded-lg p-4 bg-muted/30 space-y-2"
        data-testid={`${testIdPrefix}-${index}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-green-600 hover:bg-green-700 text-white font-mono text-xs">
            Art. {article.articleNumber}
          </Badge>
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
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            data-testid={`button-get-commentary-${testIdPrefix}-${index}`}
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            Commentaar ophalen
          </Button>
        </div>

        {article.sectionTitle && (
          <p className="text-xs text-muted-foreground">
            {article.sectionTitle}
          </p>
        )}

        <p className="text-sm font-semibold">
          Artikel {article.articleNumber.replace(/^7:/, '')}
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
                      testIdPrefix="result-article"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Tekst & Commentaar */}
        <div className="space-y-6">
          <Card data-testid="card-text-commentary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookText className="h-5 w-5" />
                Tekst &amp; Commentaar
              </CardTitle>
              <CardDescription>
                Bekijk wettekst met juridisch commentaar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Selecteer een artikel</p>
                <p className="text-xs">Klik op "Commentaar ophalen" bij een artikel om de tekst en commentaar te bekijken</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
