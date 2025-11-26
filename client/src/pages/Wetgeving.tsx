import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Search, Trash2, Sparkles, BookOpen, ExternalLink, Loader2, ChevronDown, ChevronUp, Scale, BookText } from "lucide-react";
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
}

export default function Wetgeving() {
  const { isLoading: authLoading } = useAuth();
  const currentCase = useActiveCase();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LegislationResult[]>([]);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [mentionedArticles, setMentionedArticles] = useState<string[]>([]);
  const [legalConcepts, setLegalConcepts] = useState<string[]>([]);

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
      setSearchResults(savedData.searchResults);
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

  const searchMutation = useMutation({
    mutationFn: async () => {
      const queryToSearch = searchQuery.trim();
      if (!queryToSearch) {
        throw new Error('Voer een zoekvraag in');
      }

      const response = await apiRequest('POST', '/api/wetgeving/search', {
        query: queryToSearch,
        topK: 15
      });
      
      const data = await response.json();
      return { 
        results: data.results || [], 
        totalResults: data.totalResults || 0,
        usedQuery: queryToSearch
      };
    },
    onSuccess: async (data: any) => {
      setSearchResults(data.results);
      
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
        topK: 15
      });
      
      const searchData = await searchResponse.json();
      return { 
        results: searchData.results || [], 
        totalResults: searchData.totalResults || 0,
        generatedQuery: queryData.query
      };
    },
    onSuccess: async (data: any) => {
      setSearchResults(data.results);
      
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

  const clearResultsMutation = useMutation({
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
      setSearchResults([]);
      setSearchQuery('');
      setMentionedArticles([]);
      setLegalConcepts([]);
      
      queryClient.invalidateQueries({ 
        queryKey: ['/api/wetgeving', currentCase?.id] 
      });
      
      toast({
        title: "Resultaten gewist",
        description: "Alle zoekresultaten zijn verwijderd",
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

  const toggleExpanded = (resultId: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
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

      {(mentionedArticles.length > 0 || legalConcepts.length > 0) && (
        <Card className="mb-6" data-testid="card-ai-suggestions">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5" />
              AI Suggesties
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mentionedArticles.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Genoemde artikelen:</p>
                <div className="flex flex-wrap gap-2">
                  {mentionedArticles.map((article, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      <BookText className="h-3 w-3 mr-1" />
                      {article}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {legalConcepts.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Juridische concepten:</p>
                <div className="flex flex-wrap gap-2">
                  {legalConcepts.map((concept, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      <Scale className="h-3 w-3 mr-1" />
                      {concept}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6" data-testid="card-search">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Zoeken in wetgeving
          </CardTitle>
          <CardDescription>
            Zoek naar relevante wetsartikelen uit het Burgerlijk Wetboek en andere Nederlandse wetgeving
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Bijv. 'huurovereenkomst gebreken onderhoud' of 'artikel 7:204 BW'"
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
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Zoeken...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Zoeken
                </>
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
                  Genereer zoekopdracht met AI
                </>
              )}
            </Button>
            
            {searchResults.length > 0 && (
              <Button
                variant="outline"
                onClick={() => clearResultsMutation.mutate()}
                disabled={clearResultsMutation.isPending}
                data-testid="button-clear-results"
              >
                {clearResultsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Wissen
                  </>
                )}
              </Button>
            )}
          </div>
          
          {!hasAnalysis && (
            <p className="text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 inline mr-1" />
              Voer eerst een analyse uit om automatisch een zoekopdracht te laten genereren
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-results">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Zoekresultaten
          </CardTitle>
          <CardDescription>
            {searchResults.length} wetsartikelen gevonden
          </CardDescription>
        </CardHeader>
        <CardContent>
          {searchResults.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg mb-2">Nog geen resultaten</p>
              <p className="text-sm">Gebruik de zoekfunctie om relevante wetsartikelen te vinden</p>
            </div>
          ) : (
            <div className="space-y-4">
              {searchResults.map((result, index) => (
                <div 
                  key={result.id} 
                  className="border rounded-lg p-4 bg-muted/30 space-y-3"
                  data-testid={`result-legislation-${index}`}
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
                      <p className={`text-muted-foreground whitespace-pre-wrap ${!expandedResults.has(result.id) ? 'line-clamp-4' : ''}`}>
                        {result.text}
                      </p>
                      
                      {result.text.length > 300 && (
                        <button
                          onClick={() => toggleExpanded(result.id)}
                          className="inline-flex items-center text-sm text-primary hover:underline pt-1"
                          data-testid={`button-toggle-${index}`}
                        >
                          {expandedResults.has(result.id) ? (
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
                    <a
                      href={result.bronUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-primary hover:underline"
                      data-testid={`button-view-source-${index}`}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Bekijk op wetten.overheid.nl
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
