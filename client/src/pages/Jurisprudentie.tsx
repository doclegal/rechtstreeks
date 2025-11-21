import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Search, Trash2, Sparkles, FileText, ExternalLink, Calendar, Building2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useActiveCase } from "@/contexts/CaseContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VectorSearchResult {
  id: string;
  score: number;
  ecli: string;
  court?: string;
  decision_date?: string;
  legal_area?: string;
  text?: string;
  ai_inhoudsindicatie?: string;
  ai_feiten?: string;
  ai_geschil?: string;
  ai_beslissing?: string;
  ai_motivering?: string;
}

interface SavedReference {
  ecli: string;
  court: string;
  explanation: string;
}

export default function Jurisprudentie() {
  const { isLoading: authLoading } = useAuth();
  const currentCase = useActiveCase();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  
  // Persistent results per namespace
  const [ecliNlResults, setEcliNlResults] = useState<VectorSearchResult[]>([]);
  const [webEcliResults, setWebEcliResults] = useState<VectorSearchResult[]>([]);
  
  // Track which results are expanded (by result id)
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  // Query to load saved jurisprudence data
  const { data: savedData, isLoading: savedDataLoading } = useQuery({
    queryKey: ['/api/jurisprudentie', currentCase?.id],
    enabled: !!currentCase?.id,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/jurisprudentie/${currentCase?.id}`);
      const data = await response.json();
      
      // Debug: Log what fields we're getting
      if (data?.searchResults?.ecli_nl?.[0]) {
        console.log('🔍 First ECLI_NL result fields:', Object.keys(data.searchResults.ecli_nl[0]));
        console.log('🔍 Has ai_inhoudsindicatie?', !!data.searchResults.ecli_nl[0].ai_inhoudsindicatie);
      }
      if (data?.searchResults?.web_ecli?.[0]) {
        console.log('🔍 First WEB_ECLI result fields:', Object.keys(data.searchResults.web_ecli[0]));
        console.log('🔍 Has ai_inhoudsindicatie?', !!data.searchResults.web_ecli[0].ai_inhoudsindicatie);
      }
      
      return data;
    }
  });

  // Load saved data into state when it changes
  useEffect(() => {
    if (savedData?.searchResults) {
      setEcliNlResults(savedData.searchResults.ecli_nl || []);
      setWebEcliResults(savedData.searchResults.web_ecli || []);
    }
  }, [savedData]);

  const savedReferences: SavedReference[] = savedData?.references || [];

  // Query to check if legal advice exists for current case
  const { data: hasLegalAdvice = false } = useQuery({
    queryKey: ['/api/cases', currentCase?.id, 'has-legal-advice'],
    enabled: !!currentCase?.id,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/cases/${currentCase?.id}/analyses`);
      const analyses = await response.json();
      return analyses.some((a: any) => a.legalAdviceJson !== null && a.legalAdviceJson !== undefined);
    }
  });

  const searchMutation = useMutation({
    mutationFn: async () => {
      if (!searchQuery.trim()) {
        throw new Error('Voer een zoekvraag in');
      }

      const response = await apiRequest('POST', '/api/pinecone/search', {
        query: searchQuery,
        caseId: currentCase?.id || undefined,
        enableReranking: true
      });
      
      const data = await response.json();
      
      return { 
        webSearchResults: data.webSearchResults || [],
        ecliNlResults: data.ecliNlResults || [],
        totalResults: data.totalResults || 0,
      };
    },
    onSuccess: async (data: any) => {
      setWebEcliResults(data.webSearchResults);
      setEcliNlResults(data.ecliNlResults);
      
      // Save to database
      if (currentCase?.id) {
        try {
          await apiRequest('PATCH', `/api/jurisprudentie/${currentCase.id}/save-search`, {
            ecliNlResults: data.ecliNlResults,
            webEcliResults: data.webSearchResults
          });
          
          // Invalidate cache to reload saved data
          queryClient.invalidateQueries({ 
            queryKey: ['/api/jurisprudentie', currentCase.id] 
          });
        } catch (error) {
          console.error('Failed to save search results:', error);
        }
      }
      
      const webCount = data.webSearchResults.length;
      const ecliCount = data.ecliNlResults.length;
      const totalResults = data.totalResults || 0;
      
      toast({
        title: "Zoeken voltooid",
        description: `${totalResults} resultaten gevonden: ${ecliCount} uit ecli_nl, ${webCount} uit web_ecli`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij zoeken",
        description: error.message || "Kon niet zoeken in database",
        variant: "destructive",
      });
    }
  });

  const autoSearchMutation = useMutation({
    mutationFn: async () => {
      if (!currentCase?.id) {
        throw new Error('Geen actieve zaak geselecteerd');
      }

      if (!hasLegalAdvice) {
        throw new Error('Genereer eerst juridisch advies op de Analyse pagina');
      }

      // Generate query
      const queryResponse = await apiRequest('POST', '/api/pinecone/generate-query', {
        caseId: currentCase.id
      });
      const queryData = await queryResponse.json();
      
      setSearchQuery(queryData.query);

      // Execute search
      const searchResponse = await apiRequest('POST', '/api/pinecone/search', {
        query: queryData.query,
        caseId: currentCase.id,
        enableReranking: true
      });
      
      const searchData = await searchResponse.json();
      
      return { 
        webSearchResults: searchData.webSearchResults || [],
        ecliNlResults: searchData.ecliNlResults || [],
        totalResults: searchData.totalResults || 0,
      };
    },
    onSuccess: async (data: any) => {
      setWebEcliResults(data.webSearchResults);
      setEcliNlResults(data.ecliNlResults);
      
      // Save to database
      if (currentCase?.id) {
        try {
          await apiRequest('PATCH', `/api/jurisprudentie/${currentCase.id}/save-search`, {
            ecliNlResults: data.ecliNlResults,
            webEcliResults: data.webSearchResults
          });
          
          // Invalidate cache to reload saved data
          queryClient.invalidateQueries({ 
            queryKey: ['/api/jurisprudentie', currentCase.id] 
          });
        } catch (error) {
          console.error('Failed to save search results:', error);
        }
      }
      
      const webCount = data.webSearchResults.length;
      const ecliCount = data.ecliNlResults.length;
      const totalResults = data.totalResults || 0;
      
      toast({
        title: "Zoeken voltooid",
        description: `${totalResults} resultaten gevonden: ${ecliCount} uit ecli_nl, ${webCount} uit web_ecli`,
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

  const generateReferencesForNamespaceMutation = useMutation({
    mutationFn: async ({ namespace, results }: { namespace: 'ecli_nl' | 'web_ecli', results: VectorSearchResult[] }) => {
      if (!currentCase?.id) {
        throw new Error('Geen actieve zaak geselecteerd');
      }

      if (results.length === 0) {
        throw new Error('Geen resultaten om verwijzingen voor te genereren');
      }

      const topResults = results.slice(0, 10);
      
      const response = await apiRequest('POST', '/api/jurisprudentie/generate-references', {
        caseId: currentCase.id,
        topResults: topResults.map(r => ({
          id: r.id,
          score: r.score,
          metadata: {
            court: r.court,
            decision_date: r.decision_date,
            legal_area: r.legal_area,
            ai_inhoudsindicatie: r.ai_inhoudsindicatie,
            ai_feiten: r.ai_feiten,
            ai_geschil: r.ai_geschil,
            ai_beslissing: r.ai_beslissing,
            ai_motivering: r.ai_motivering,
          }
        }))
      });
      
      return response.json();
    },
    onSuccess: (data: any) => {
      // Invalidate cache to reload saved references
      queryClient.invalidateQueries({ 
        queryKey: ['/api/jurisprudentie', currentCase?.id] 
      });
      
      const refCount = data.references?.length || 0;
      toast({
        title: refCount > 0 ? "Verwijzingen gegenereerd" : "Geen verwijzingen",
        description: refCount > 0 
          ? `${refCount} relevante ${refCount === 1 ? 'verwijzing' : 'verwijzingen'} gevonden en opgeslagen`
          : data.message || "Geen nuttige verwijzingen naar jurisprudentie gevonden",
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Kon geen verwijzingen genereren";
      const match = errorMessage.match(/\d+:\s*(.+)/);
      const cleanMessage = match ? match[1] : errorMessage;
      
      toast({
        title: "Fout bij genereren",
        description: cleanMessage,
        variant: "destructive",
      });
    }
  });

  const clearNamespaceResultsMutation = useMutation({
    mutationFn: async ({ namespace }: { namespace: 'ecli_nl' | 'web_ecli' }) => {
      if (!currentCase?.id) {
        throw new Error('Geen actieve zaak geselecteerd');
      }

      const response = await apiRequest('PATCH', `/api/jurisprudentie/${currentCase.id}/clear-namespace`, {
        namespace
      });
      
      return { namespace, response: await response.json() };
    },
    onSuccess: (data: any) => {
      if (data.namespace === 'ecli_nl') {
        setEcliNlResults([]);
      } else {
        setWebEcliResults([]);
      }
      
      // Invalidate cache to reload saved data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/jurisprudentie', currentCase?.id] 
      });
      
      toast({
        title: "Resultaten gewist",
        description: `Resultaten uit ${data.namespace} zijn verwijderd`,
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
    console.log('🔘 toggleExpanded called with ID:', resultId);
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      console.log('📂 Current expanded IDs:', Array.from(prev));
      if (newSet.has(resultId)) {
        console.log('✂️ Removing ID from expanded set');
        newSet.delete(resultId);
      } else {
        console.log('➕ Adding ID to expanded set');
        newSet.add(resultId);
      }
      console.log('📂 New expanded IDs:', Array.from(newSet));
      return newSet;
    });
  };

  const NamespaceBlock = ({ 
    namespace, 
    title, 
    results 
  }: { 
    namespace: 'ecli_nl' | 'web_ecli', 
    title: string, 
    results: VectorSearchResult[] 
  }) => (
    <Card data-testid={`card-namespace-${namespace}`}>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{results.length} uitspraken gevonden</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateReferencesForNamespaceMutation.mutate({ namespace, results })}
            disabled={generateReferencesForNamespaceMutation.isPending || results.length === 0}
            data-testid={`button-generate-${namespace}`}
          >
            {generateReferencesForNamespaceMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Genereren...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Genereer verwijzing
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => clearNamespaceResultsMutation.mutate({ namespace })}
            disabled={clearNamespaceResultsMutation.isPending || results.length === 0}
            data-testid={`button-delete-${namespace}`}
          >
            {clearNamespaceResultsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verwijderen...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Verwijder
              </>
            )}
          </Button>
        </div>

        {/* Results List */}
        {results.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>Nog geen resultaten</p>
            <p className="text-sm">Gebruik de zoekfunctie om uitspraken te vinden</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result, index) => {
              return (
              <div 
                key={result.id} 
                className="border rounded-lg p-4 bg-muted/30 space-y-3"
                data-testid={`result-${namespace}-${index}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {result.ecli}
                  </Badge>
                  {result.court && (
                    <Badge variant="secondary" className="text-xs">
                      <Building2 className="h-3 w-3 mr-1" />
                      {result.court}
                    </Badge>
                  )}
                  {result.decision_date && (
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="h-3 w-3 mr-1" />
                      {result.decision_date}
                    </Badge>
                  )}
                </div>

                {/* Samenvatting met secties - ALWAYS SHOW BUTTON FOR DEBUG */}
                <div className="text-sm space-y-2">
                  {result.ai_inhoudsindicatie && (
                    <div>
                      <p className="font-semibold text-foreground">Inhoudsindicatie</p>
                      <p className={`text-muted-foreground whitespace-pre-wrap ${!expandedResults.has(result.id) ? 'line-clamp-2' : ''}`}>
                        {result.ai_inhoudsindicatie}
                      </p>
                    </div>
                  )}
                  
                  {expandedResults.has(result.id) && (
                    <>
                      {result.ai_feiten && (
                        <div>
                          <p className="font-semibold text-foreground">Feiten</p>
                          <p className="text-muted-foreground whitespace-pre-wrap">{result.ai_feiten}</p>
                        </div>
                      )}
                      
                      {result.ai_geschil && (
                        <div>
                          <p className="font-semibold text-foreground">Geschil</p>
                          <p className="text-muted-foreground whitespace-pre-wrap">{result.ai_geschil}</p>
                        </div>
                      )}
                      
                      {result.ai_beslissing && (
                        <div>
                          <p className="font-semibold text-foreground">Beslissing</p>
                          <p className="text-muted-foreground whitespace-pre-wrap">{result.ai_beslissing}</p>
                        </div>
                      )}
                      
                      {result.ai_motivering && (
                        <div>
                          <p className="font-semibold text-foreground">Motivering</p>
                          <p className="text-muted-foreground whitespace-pre-wrap">{result.ai_motivering}</p>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* ALWAYS show button - even if no ai_* fields */}
                  <button
                    onClick={() => toggleExpanded(result.id)}
                    className="inline-flex items-center text-sm font-bold text-primary hover:underline pt-1 bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded"
                    data-testid={`button-toggle-${namespace}-${index}`}
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
                  
                  {/* Fallback text if no ai_* fields */}
                  {!result.ai_inhoudsindicatie && result.text && (
                    <div className="mt-2">
                      <p className="font-medium mb-1">Uitspraak tekst:</p>
                      <p className="text-muted-foreground line-clamp-3">{result.text}</p>
                    </div>
                  )}
                </div>

                <a
                  href={`https://uitspraken.rechtspraak.nl/details?id=${result.ecli}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-primary hover:underline"
                  data-testid={`button-view-full-${namespace}-${index}`}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Bekijk volledige uitspraak
                </a>
              </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Button variant="ghost" asChild className="mb-4" data-testid="button-back-to-analysis">
        <Link href="/analysis">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar analyse
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Jurisprudentie</h1>
        <p className="text-muted-foreground">
          Zoek relevante rechterlijke uitspraken voor {currentCase.title || 'uw zaak'}
        </p>
      </div>

      {/* Saved References Section */}
      {savedReferences.length > 0 && (
        <Card className="mb-6" data-testid="card-saved-references">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Opgeslagen Verwijzingen
            </CardTitle>
            <CardDescription>
              {savedReferences.length} AI-gegenereerde {savedReferences.length === 1 ? 'verwijzing' : 'verwijzingen'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Deze verwijzingen worden automatisch gebruikt bij het genereren van brieven
            </p>
            <div className="space-y-4">
              {savedReferences.map((ref: SavedReference, index: number) => (
                <div 
                  key={index} 
                  className="border rounded-lg p-4 bg-primary/5"
                  data-testid={`saved-reference-${index}`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge variant="default" className="font-mono text-xs">
                      {ref.ecli}
                    </Badge>
                    {ref.court && (
                      <Badge variant="secondary" className="text-xs">
                        <Building2 className="h-3 w-3 mr-1" />
                        {ref.court}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-foreground leading-relaxed">
                    {ref.explanation}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Global Search */}
      <Card className="mb-6" data-testid="card-global-search">
        <CardHeader>
          <CardTitle>Zoeken in beide databases</CardTitle>
          <CardDescription>Zoekt in zowel ecli_nl als web_ecli</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Voer een zoekvraag in..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  searchMutation.mutate();
                }
              }}
              data-testid="input-search-query"
            />
            <Button
              onClick={() => searchMutation.mutate()}
              disabled={searchMutation.isPending || !searchQuery.trim()}
              data-testid="button-manual-search"
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
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">of</p>
            <Button
              onClick={() => autoSearchMutation.mutate()}
              disabled={autoSearchMutation.isPending || !hasLegalAdvice}
              data-testid="button-quick-search"
              variant="default"
            >
              {autoSearchMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Bezig...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Snel zoeken met AI
                </>
              )}
            </Button>
            {!hasLegalAdvice && (
              <p className="text-xs text-muted-foreground mt-2">
                Genereer eerst juridisch advies op de Analyse pagina
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout for namespace blocks on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WEB_ECLI Namespace Block - Shown first */}
        <NamespaceBlock 
          namespace="web_ecli"
          title="Geciteerde uitspraken"
          results={webEcliResults}
        />

        {/* ECLI_NL Namespace Block - Shown second */}
        <NamespaceBlock 
          namespace="ecli_nl"
          title="Mogelijk relevante uitspraken"
          results={ecliNlResults}
        />
      </div>
    </div>
  );
}
