import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Search, Trash2, Sparkles, FileText, ExternalLink, Calendar, Building2, Loader2, ChevronDown, ChevronUp, Bookmark, BookmarkCheck } from "lucide-react";
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
  court_level?: string;
  decision_date?: string;
  legal_area?: string;
  procedure_type?: string;
  text?: string;
  ai_inhoudsindicatie?: string;
  ai_feiten?: string;
  ai_geschil?: string;
  ai_beslissing?: string;
  ai_motivering?: string;
}

interface SavedJurisprudence {
  id: string;
  userId: string;
  caseId: string;
  ecli: string;
  court: string | null;
  courtLevel: string | null;
  decisionDate: string | null;
  legalArea: string | null;
  procedureType: string | null;
  title: string | null;
  sourceUrl: string | null;
  textFragment: string | null;
  aiFeiten: string | null;
  aiGeschil: string | null;
  aiBeslissing: string | null;
  aiMotivering: string | null;
  aiInhoudsindicatie: string | null;
  searchScore: number | null;
  searchNamespace: string | null;
  searchQuery: string | null;
  userNotes: string | null;
  savedAt: string;
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
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Search results (temporary, not persisted)
  const [ecliNlResults, setEcliNlResults] = useState<VectorSearchResult[]>([]);
  const [webEcliResults, setWebEcliResults] = useState<VectorSearchResult[]>([]);
  
  // Track which results are expanded (by result id or ecli)
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  // Query to load saved jurisprudence from Supabase
  const { data: savedJurisprudenceData, isLoading: savedJurisprudenceLoading } = useQuery({
    queryKey: ['/api/saved-jurisprudence', currentCase?.id],
    enabled: !!currentCase?.id,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/saved-jurisprudence/${currentCase?.id}`);
      return response.json();
    }
  });

  const savedJurisprudence: SavedJurisprudence[] = savedJurisprudenceData?.items || [];

  // Set of ECLIs that are already saved (for quick lookup)
  const savedEclis = new Set(savedJurisprudence.map(item => item.ecli));

  // Query to load saved references (legacy data)
  const { data: savedData, isLoading: savedDataLoading } = useQuery({
    queryKey: ['/api/jurisprudentie', currentCase?.id],
    enabled: !!currentCase?.id,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/jurisprudentie/${currentCase?.id}`);
      return response.json();
    }
  });

  const savedReferences: SavedReference[] = savedData?.references || [];

  // Check if legal advice exists - check Supabase data from case object first
  const hasSupabaseLegalAdvice = !!(
    currentCase?.supabaseLegalAdvice || 
    currentCase?.rkosAnalysis
  );

  // Fallback to local database if no Supabase data
  const { data: hasLocalLegalAdvice = false } = useQuery({
    queryKey: ['/api/cases', currentCase?.id, 'has-legal-advice'],
    enabled: !!currentCase?.id && !hasSupabaseLegalAdvice,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/cases/${currentCase?.id}/analyses`);
      const analyses = await response.json();
      return analyses.some((a: any) => a.legalAdviceJson !== null && a.legalAdviceJson !== undefined);
    }
  });

  // Use Supabase data if available, otherwise use local DB result
  const hasLegalAdvice = hasSupabaseLegalAdvice || hasLocalLegalAdvice;

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
      setShowSearchResults(true);
      
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
      setShowSearchResults(true);
      
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

  // Save jurisprudence mutation
  const saveJurisprudenceMutation = useMutation({
    mutationFn: async ({ result, namespace }: { result: VectorSearchResult, namespace: string }) => {
      if (!currentCase?.id) {
        throw new Error('Geen actieve zaak geselecteerd');
      }

      const response = await apiRequest('POST', '/api/saved-jurisprudence', {
        caseId: currentCase.id,
        ecli: result.ecli,
        court: result.court || null,
        courtLevel: result.court_level || null,
        decisionDate: result.decision_date || null,
        legalArea: result.legal_area || null,
        procedureType: result.procedure_type || null,
        textFragment: result.text || null,
        aiFeiten: result.ai_feiten || null,
        aiGeschil: result.ai_geschil || null,
        aiBeslissing: result.ai_beslissing || null,
        aiMotivering: result.ai_motivering || null,
        aiInhoudsindicatie: result.ai_inhoudsindicatie || null,
        searchScore: result.score || null,
        searchNamespace: namespace,
        searchQuery: searchQuery || null
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/saved-jurisprudence', currentCase?.id] 
      });
      
      toast({
        title: "Uitspraak opgeslagen",
        description: "De uitspraak is toegevoegd aan uw opgeslagen jurisprudentie",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij opslaan",
        description: error.message || "Kon uitspraak niet opslaan",
        variant: "destructive",
      });
    }
  });

  // Delete saved jurisprudence mutation
  const deleteSavedMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/saved-jurisprudence/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/saved-jurisprudence', currentCase?.id] 
      });
      
      toast({
        title: "Uitspraak verwijderd",
        description: "De uitspraak is verwijderd uit uw opgeslagen jurisprudentie",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij verwijderen",
        description: error.message || "Kon uitspraak niet verwijderen",
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

  if (authLoading || savedJurisprudenceLoading || savedDataLoading) {
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

  const toggleExpanded = (id: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Render a saved jurisprudence item
  const SavedJurisprudenceItem = ({ item, index }: { item: SavedJurisprudence, index: number }) => (
    <div 
      className="border rounded-lg p-4 bg-muted/30 space-y-3"
      data-testid={`saved-jurisprudence-${index}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {item.ecli}
          </Badge>
          {item.court && (
            <Badge variant="secondary" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" />
              {item.court}
            </Badge>
          )}
          {item.decisionDate && (
            <Badge variant="outline" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              {item.decisionDate}
            </Badge>
          )}
          {item.searchNamespace && (
            <Badge variant="outline" className="text-xs bg-primary/10">
              {item.searchNamespace}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteSavedMutation.mutate(item.id)}
          disabled={deleteSavedMutation.isPending}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          data-testid={`button-delete-saved-${index}`}
        >
          {deleteSavedMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {item.textFragment && (
        <div className="text-sm space-y-2">
          <p className={`text-muted-foreground whitespace-pre-wrap ${!expandedResults.has(item.id) ? 'line-clamp-3' : ''}`}>
            {item.textFragment}
          </p>
          
          <button
            onClick={() => toggleExpanded(item.id)}
            className="inline-flex items-center text-sm text-primary hover:underline pt-1"
            data-testid={`button-toggle-saved-${index}`}
          >
            {expandedResults.has(item.id) ? (
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
      )}

      <a
        href={`https://uitspraken.rechtspraak.nl/details?id=${item.ecli}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-sm text-primary hover:underline"
        data-testid={`button-view-saved-${index}`}
      >
        <ExternalLink className="h-3 w-3 mr-1" />
        Bekijk volledige uitspraak
      </a>
    </div>
  );

  // Render a search result with save button
  const SearchResultItem = ({ 
    result, 
    index, 
    namespace 
  }: { 
    result: VectorSearchResult, 
    index: number, 
    namespace: 'ecli_nl' | 'web_ecli' 
  }) => {
    const isSaved = savedEclis.has(result.ecli);
    
    return (
      <div 
        className="border rounded-lg p-4 bg-muted/30 space-y-3"
        data-testid={`result-${namespace}-${index}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
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
          <Button
            variant={isSaved ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              if (!isSaved) {
                saveJurisprudenceMutation.mutate({ result, namespace });
              }
            }}
            disabled={isSaved || saveJurisprudenceMutation.isPending}
            data-testid={`button-save-${namespace}-${index}`}
          >
            {saveJurisprudenceMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : isSaved ? (
              <>
                <BookmarkCheck className="h-4 w-4 mr-1" />
                Opgeslagen
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4 mr-1" />
                Opslaan
              </>
            )}
          </Button>
        </div>

        {result.text && (
          <div className="text-sm space-y-2">
            <p className={`text-muted-foreground whitespace-pre-wrap ${!expandedResults.has(result.id) ? 'line-clamp-3' : ''}`}>
              {result.text}
            </p>
            
            <button
              onClick={() => toggleExpanded(result.id)}
              className="inline-flex items-center text-sm text-primary hover:underline pt-1"
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
          </div>
        )}

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
  };

  const SearchResultsBlock = ({ 
    namespace, 
    title, 
    results 
  }: { 
    namespace: 'ecli_nl' | 'web_ecli', 
    title: string, 
    results: VectorSearchResult[] 
  }) => (
    <Card data-testid={`card-search-${namespace}`}>
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
            onClick={() => {
              if (namespace === 'ecli_nl') {
                setEcliNlResults([]);
              } else {
                setWebEcliResults([]);
              }
              // Hide search results if both are empty
              if ((namespace === 'ecli_nl' && webEcliResults.length === 0) ||
                  (namespace === 'web_ecli' && ecliNlResults.length === 0)) {
                setShowSearchResults(false);
              }
            }}
            disabled={results.length === 0}
            data-testid={`button-clear-${namespace}`}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Wis resultaten
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
              <SearchResultItem 
                key={result.id} 
                result={result} 
                index={index} 
                namespace={namespace} 
              />
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

      {/* Saved References Section (Legacy AI-generated references) */}
      {savedReferences.length > 0 && (
        <Card className="mb-6" data-testid="card-saved-references">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI-gegenereerde Verwijzingen
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
                    <a
                      href={`https://uitspraken.rechtspraak.nl/details?id=${ref.ecli}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-80 transition-opacity"
                      data-testid={`link-ecli-${index}`}
                    >
                      <Badge variant="default" className="font-mono text-xs cursor-pointer">
                        {ref.ecli}
                      </Badge>
                    </a>
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

      {/* Saved Jurisprudence Section (From Supabase) */}
      <Card className="mb-6" data-testid="card-saved-jurisprudence">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookmarkCheck className="h-5 w-5" />
            Opgeslagen Uitspraken
          </CardTitle>
          <CardDescription>
            {savedJurisprudence.length} {savedJurisprudence.length === 1 ? 'uitspraak' : 'uitspraken'} opgeslagen voor deze zaak
          </CardDescription>
        </CardHeader>
        <CardContent>
          {savedJurisprudence.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bookmark className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nog geen uitspraken opgeslagen</p>
              <p className="text-sm">Zoek hieronder naar jurisprudentie en sla relevante uitspraken op</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedJurisprudence.map((item, index) => (
                <SavedJurisprudenceItem key={item.id} item={item} index={index} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Section */}
      <Card className="mb-6" data-testid="card-global-search">
        <CardHeader>
          <CardTitle>Zoeken naar jurisprudentie</CardTitle>
          <CardDescription>Zoekt in zowel ecli_nl als web_ecli databases</CardDescription>
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

      {/* Search Results (Only shown after search) */}
      {showSearchResults && (ecliNlResults.length > 0 || webEcliResults.length > 0) && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Zoekresultaten</h2>
          <p className="text-sm text-muted-foreground">
            Klik op "Opslaan" om een uitspraak toe te voegen aan uw opgeslagen jurisprudentie
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* WEB_ECLI Namespace Block - Shown first */}
            <SearchResultsBlock 
              namespace="web_ecli"
              title="Geciteerde uitspraken"
              results={webEcliResults}
            />

            {/* ECLI_NL Namespace Block - Shown second */}
            <SearchResultsBlock 
              namespace="ecli_nl"
              title="Mogelijk relevante uitspraken"
              results={ecliNlResults}
            />
          </div>
        </div>
      )}
    </div>
  );
}
