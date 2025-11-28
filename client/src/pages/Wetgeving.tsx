import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Search, Trash2, Sparkles, BookOpen, ExternalLink, Loader2, ChevronDown, ChevronUp, Scale, BookText, FileText, Plus, X } from "lucide-react";
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
  title?: string;
  articleNumber?: string;
  paragraphNumber?: string;
  sectionTitle?: string;
  validFrom?: string;
  validTo?: string;
  isCurrent?: boolean;
  text?: string;
  citatie?: string;
  bronUrl?: string | null;
  sourceQuery?: string;
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
  
  // Term search state
  const [searchQuery, setSearchQuery] = useState("");
  const [termResults, setTermResults] = useState<LegislationResult[]>([]);
  const [expandedTermResults, setExpandedTermResults] = useState<Set<string>>(new Set());
  const [mentionedArticles, setMentionedArticles] = useState<string[]>([]);
  const [legalConcepts, setLegalConcepts] = useState<string[]>([]);

  // Multiple article entries state
  const [articleEntries, setArticleEntries] = useState<ArticleEntry[]>([
    { id: '1', regulation: '', articleNumber: '' }
  ]);
  const [articleResults, setArticleResults] = useState<LegislationResult[]>([]);
  const [expandedArticleResults, setExpandedArticleResults] = useState<Set<string>>(new Set());
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
    if (savedData?.searchResults) {
      setTermResults(savedData.searchResults);
    }
    if (savedData?.savedQuery) {
      setSearchQuery(savedData.savedQuery);
    }
  }, [savedData]);

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

  // Add new article entry
  const addArticleEntry = () => {
    const newId = Date.now().toString();
    setArticleEntries([...articleEntries, { id: newId, regulation: '', articleNumber: '' }]);
  };

  // Remove article entry
  const removeArticleEntry = (id: string) => {
    if (articleEntries.length > 1) {
      setArticleEntries(articleEntries.filter(entry => entry.id !== id));
    }
  };

  // Update article entry
  const updateArticleEntry = (id: string, field: 'regulation' | 'articleNumber', value: string) => {
    setArticleEntries(articleEntries.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  // Term search mutation
  const searchMutation = useMutation({
    mutationFn: async () => {
      const queryToSearch = searchQuery.trim();
      if (!queryToSearch) {
        throw new Error('Voer een zoekvraag in');
      }

      const response = await apiRequest('POST', '/api/wetgeving/search', {
        query: queryToSearch,
        topK: 200,  // First-stage retrieval count for reranking
        rerankTopN: 30,
        maxLaws: 10
      });
      
      const data = await response.json();
      return { 
        results: data.results || [], 
        totalResults: data.totalResults || 0,
        usedQuery: queryToSearch
      };
    },
    onSuccess: async (data: any) => {
      setTermResults(data.results);
      
      if (currentCase?.id) {
        try {
          await apiRequest('PATCH', `/api/wetgeving/${currentCase.id}/save-search`, {
            results: data.results,
            query: data.usedQuery
          });
          
          queryClient.invalidateQueries({ 
            queryKey: ['/api/wetgeving', currentCase.id] 
          });
        } catch (error) {
          console.error('Failed to save search results:', error);
        }
      }
      
      toast({
        title: "Zoeken voltooid",
        description: `${data.totalResults} wetsartikelen gevonden`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij zoeken",
        description: error.message || "Kon niet zoeken in wetgeving database",
        variant: "destructive",
      });
    }
  });

  // AI term search mutation
  const autoSearchMutation = useMutation({
    mutationFn: async () => {
      if (!currentCase?.id) {
        throw new Error('Geen actieve zaak geselecteerd');
      }

      if (!hasAnalysis) {
        throw new Error('Genereer eerst een analyse op de Analyse pagina');
      }

      const queryResponse = await apiRequest('POST', '/api/wetgeving/generate-query', {
        caseId: currentCase.id
      });
      const queryData = await queryResponse.json();
      
      setSearchQuery(queryData.query);
      setMentionedArticles(queryData.mentionedArticles || []);
      setLegalConcepts(queryData.legalConcepts || []);

      const searchResponse = await apiRequest('POST', '/api/wetgeving/search', {
        query: queryData.query,
        topK: 200,  // First-stage retrieval count for reranking
        rerankTopN: 30,
        maxLaws: 10
      });
      
      const searchData = await searchResponse.json();
      return { 
        results: searchData.results || [], 
        totalResults: searchData.totalResults || 0,
        generatedQuery: queryData.query
      };
    },
    onSuccess: async (data: any) => {
      setTermResults(data.results);
      
      if (currentCase?.id) {
        try {
          await apiRequest('PATCH', `/api/wetgeving/${currentCase.id}/save-search`, {
            results: data.results,
            query: data.generatedQuery
          });
          
          queryClient.invalidateQueries({ 
            queryKey: ['/api/wetgeving', currentCase.id] 
          });
        } catch (error) {
          console.error('Failed to save search results:', error);
        }
      }
      
      toast({
        title: "Zoeken voltooid",
        description: `${data.totalResults} wetsartikelen gevonden`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij zoeken",
        description: error.message || "Kon geen zoekvraag genereren of zoeken",
        variant: "destructive",
      });
    }
  });

  // Search all article entries
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

  // AI article suggestions mutation - auto-fill ALL articles and search
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

      // Create article entries for all AI suggestions
      const newEntries: ArticleEntry[] = articles.map((art, idx) => ({
        id: `ai-${Date.now()}-${idx}`,
        regulation: art.regulation,
        articleNumber: art.articleNumber,
        reason: art.reason
      }));

      setArticleEntries(newEntries);

      // Search for ALL articles
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

  const clearTermResults = useMutation({
    mutationFn: async () => {
      if (!currentCase?.id) {
        throw new Error('Geen actieve zaak geselecteerd');
      }

      await apiRequest('PATCH', `/api/wetgeving/${currentCase.id}/save-search`, {
        results: [],
        query: ''
      });
      
      return true;
    },
    onSuccess: () => {
      setTermResults([]);
      setSearchQuery('');
      setMentionedArticles([]);
      setLegalConcepts([]);
      
      queryClient.invalidateQueries({ 
        queryKey: ['/api/wetgeving', currentCase?.id] 
      });
      
      toast({
        title: "Resultaten gewist",
        description: "Zoekresultaten zijn verwijderd",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij verwijderen",
        description: error.message || "Kon resultaten niet verwijderen",
        variant: "destructive",
      });
    }
  });

  const clearArticleResults = () => {
    setArticleResults([]);
    setArticleEntries([{ id: '1', regulation: '', articleNumber: '' }]);
    setAiExplanation('');
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

  const toggleExpandedTerm = (resultId: string) => {
    setExpandedTermResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  };

  const toggleExpandedArticle = (resultId: string) => {
    setExpandedArticleResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  };

  const ResultCard = ({ 
    result, 
    index, 
    expanded, 
    onToggle, 
    testIdPrefix 
  }: { 
    result: LegislationResult; 
    index: number; 
    expanded: boolean; 
    onToggle: () => void;
    testIdPrefix: string;
  }) => (
    <div 
      className="border rounded-lg p-4 bg-muted/30 space-y-3"
      data-testid={`${testIdPrefix}-${index}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="font-medium">
          #{result.rank}
        </Badge>
        {result.articleNumber && (
          <Badge variant="secondary" className="font-mono text-xs">
            Art. {result.articleNumber}
          </Badge>
        )}
        {result.title && (
          <Badge variant="outline" className="text-xs max-w-xs truncate">
            <BookText className="h-3 w-3 mr-1 flex-shrink-0" />
            {result.title}
          </Badge>
        )}
        {result.sourceQuery && (
          <Badge variant="default" className="text-xs bg-primary/20 text-primary">
            {result.sourceQuery}
          </Badge>
        )}
        <Badge variant="outline" className="text-xs ml-auto">
          Score: {result.scorePercent}
        </Badge>
      </div>

      {result.citatie && (
        <p className="text-sm font-medium text-foreground">
          {result.citatie}
        </p>
      )}

      {result.text && (
        <div className="text-sm space-y-2">
          <p className={`text-muted-foreground whitespace-pre-wrap ${!expanded ? 'line-clamp-4' : ''}`}>
            {result.text}
          </p>
          
          {result.text.length > 300 && (
            <button
              onClick={onToggle}
              className="inline-flex items-center text-sm text-primary hover:underline pt-1"
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
          )}
        </div>
      )}

      {result.bronUrl && (
        <div className="space-y-2">
          <a
            href={result.bronUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-primary hover:underline"
            data-testid={`button-view-source-${testIdPrefix}-${index}`}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Bekijk op wetten.overheid.nl
          </a>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            data-testid={`button-get-comments-${testIdPrefix}-${index}`}
          >
            Commentaar ophalen
          </Button>
        </div>
      )}
    </div>
  );

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

      {/* Two-column search panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left panel: Term search */}
        <Card data-testid="card-term-search">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Zoeken op termen
            </CardTitle>
            <CardDescription>
              Zoek met zoektermen of juridische concepten
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Bijv. 'huurovereenkomst gebreken'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchMutation.mutate()}
                className="flex-1"
                data-testid="input-search-query"
              />
              <Button
                onClick={() => searchMutation.mutate()}
                disabled={searchMutation.isPending || !searchQuery.trim()}
                data-testid="button-search"
              >
                {searchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => autoSearchMutation.mutate()}
                disabled={autoSearchMutation.isPending || !hasAnalysis}
                className="flex-1"
                data-testid="button-auto-search"
              >
                {autoSearchMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Genereren...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Zoeken
                  </>
                )}
              </Button>
              
              {termResults.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => clearTermResults.mutate()}
                  disabled={clearTermResults.isPending}
                  data-testid="button-clear-term-results"
                >
                  {clearTermResults.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            
            {!hasAnalysis && (
              <p className="text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 inline mr-1" />
                Voer eerst een analyse uit voor AI zoeken
              </p>
            )}

            {/* AI suggestions for term search */}
            {(mentionedArticles.length > 0 || legalConcepts.length > 0) && (
              <div className="border-t pt-4 space-y-3">
                {mentionedArticles.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1">Genoemde artikelen:</p>
                    <div className="flex flex-wrap gap-1">
                      {mentionedArticles.map((article, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {article}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {legalConcepts.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1">Juridische concepten:</p>
                    <div className="flex flex-wrap gap-1">
                      {legalConcepts.map((concept, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {concept}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right panel: Multiple article search */}
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
            {/* Multiple article entry fields */}
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

            {/* Add more button */}
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

            {/* AI explanation */}
            {aiExplanation && (
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">{aiExplanation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-column results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Term search results */}
        <Card data-testid="card-term-results">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Resultaten: Termen
            </CardTitle>
            <CardDescription>
              {termResults.length} artikelen gevonden
            </CardDescription>
          </CardHeader>
          <CardContent>
            {termResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Geen resultaten</p>
                <p className="text-xs">Zoek met termen of AI</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {termResults.map((result, index) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    index={index}
                    expanded={expandedTermResults.has(result.id)}
                    onToggle={() => toggleExpandedTerm(result.id)}
                    testIdPrefix="result-term"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: Article search results */}
        <Card data-testid="card-article-results">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Resultaten: Artikelen
            </CardTitle>
            <CardDescription>
              {articleResults.length} artikelleden gevonden
            </CardDescription>
          </CardHeader>
          <CardContent>
            {articleResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Geen resultaten</p>
                <p className="text-xs">Zoek specifieke artikelen</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {articleResults.map((result, index) => (
                  <ResultCard
                    key={`${result.id}-${index}`}
                    result={result}
                    index={index}
                    expanded={expandedArticleResults.has(result.id)}
                    onToggle={() => toggleExpandedArticle(result.id)}
                    testIdPrefix="result-article"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
