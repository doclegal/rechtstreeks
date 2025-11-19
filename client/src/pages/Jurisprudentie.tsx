import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Search, Trash2, Sparkles, FileText, ExternalLink, Calendar, Building2, Loader2 } from "lucide-react";
import { useActiveCase } from "@/contexts/CaseContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  fullText?: string | null;
  fullTextError?: string | null;
}

export default function Jurisprudentie() {
  const { isLoading: authLoading } = useAuth();
  const currentCase = useActiveCase();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  
  // Persistent results per namespace
  const [ecliNlResults, setEcliNlResults] = useState<VectorSearchResult[]>([]);
  const [webEcliResults, setWebEcliResults] = useState<VectorSearchResult[]>([]);
  
  // Dialog state for showing full judgment text
  const [fullTextDialogOpen, setFullTextDialogOpen] = useState(false);
  const [selectedJudgment, setSelectedJudgment] = useState<VectorSearchResult | null>(null);

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
    onSuccess: (data: any) => {
      setWebEcliResults(data.webSearchResults);
      setEcliNlResults(data.ecliNlResults);
      
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
    onSuccess: (data: any) => {
      setWebEcliResults(data.webSearchResults);
      setEcliNlResults(data.ecliNlResults);
      
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
          }
        }))
      });
      
      return response.json();
    },
    onSuccess: (data: any) => {
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
      return { namespace };
    },
    onSuccess: (data: any) => {
      if (data.namespace === 'ecli_nl') {
        setEcliNlResults([]);
      } else {
        setWebEcliResults([]);
      }
      
      toast({
        title: "Resultaten gewist",
        description: `Resultaten uit ${data.namespace} zijn verwijderd`,
      });
    }
  });

  const handleFetchFullText = async (result: VectorSearchResult) => {
    try {
      const response = await apiRequest('POST', '/api/rechtspraak/fetch-judgment', { ecli: result.ecli });
      const data = await response.json();

      const updatedResult = {
        ...result,
        fullText: data.fullText,
        fullTextError: data.error,
      };

      setSelectedJudgment(updatedResult);
      setFullTextDialogOpen(true);

      if (!data.fullText) {
        toast({
          title: "Volledige tekst niet beschikbaar",
          description: data.error || "Kon de volledige tekst niet ophalen",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      const errorResult = {
        ...result,
        fullTextError: error.message || "Fout bij ophalen",
      };

      setSelectedJudgment(errorResult);
      setFullTextDialogOpen(true);

      toast({
        title: "Fout bij ophalen",
        description: error.message || "Kon de volledige tekst niet ophalen",
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
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

  const NamespaceBlock = ({ 
    namespace, 
    title, 
    results 
  }: { 
    namespace: 'ecli_nl' | 'web_ecli', 
    title: string, 
    results: VectorSearchResult[] 
  }) => (
    <Card className="mb-6" data-testid={`card-namespace-${namespace}`}>
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
            {results.map((result, index) => (
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

                {/* Uitspraak tekst */}
                {result.ai_inhoudsindicatie && (
                  <div className="text-sm">
                    <p className="font-medium mb-1">Inhoudsindicatie:</p>
                    <p className="text-muted-foreground">{result.ai_inhoudsindicatie}</p>
                  </div>
                )}

                {result.text && !result.ai_inhoudsindicatie && (
                  <div className="text-sm">
                    <p className="font-medium mb-1">Uitspraak tekst:</p>
                    <p className="text-muted-foreground line-clamp-3">{result.text}</p>
                  </div>
                )}

                <Button
                  variant="link"
                  size="sm"
                  onClick={() => handleFetchFullText(result)}
                  className="p-0 h-auto"
                  data-testid={`button-view-full-${namespace}-${index}`}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Bekijk volledige uitspraak
                </Button>
              </div>
            ))}
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

      {/* ECLI_NL Namespace Block */}
      <NamespaceBlock 
        namespace="ecli_nl"
        title="Uitspraken uit ecli_nl"
        results={ecliNlResults}
      />

      {/* WEB_ECLI Namespace Block */}
      <NamespaceBlock 
        namespace="web_ecli"
        title="Uitspraken uit web_ecli"
        results={webEcliResults}
      />

      {/* Full Text Dialog */}
      <Dialog open={fullTextDialogOpen} onOpenChange={setFullTextDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Volledige uitspraak
            </DialogTitle>
            {selectedJudgment && (
              <DialogDescription className="space-y-2">
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="font-mono">
                    {selectedJudgment.ecli}
                  </Badge>
                  {selectedJudgment.court && (
                    <Badge variant="secondary">
                      <Building2 className="h-3 w-3 mr-1" />
                      {selectedJudgment.court}
                    </Badge>
                  )}
                  {selectedJudgment.decision_date && (
                    <Badge variant="outline">
                      <Calendar className="h-3 w-3 mr-1" />
                      {selectedJudgment.decision_date}
                    </Badge>
                  )}
                </div>
              </DialogDescription>
            )}
          </DialogHeader>
          
          <div className="mt-4">
            {selectedJudgment?.fullTextError ? (
              <div className="text-center py-8">
                <p className="text-destructive mb-2">Fout bij ophalen van volledige tekst</p>
                <p className="text-sm text-muted-foreground">{selectedJudgment.fullTextError}</p>
              </div>
            ) : selectedJudgment?.fullText ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {selectedJudgment.fullText}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-sm text-muted-foreground">Volledige tekst laden...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
