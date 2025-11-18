import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Scale, FileText, ExternalLink, Calendar, Building2, Search, Loader2, Sparkles, Settings } from "lucide-react";
import { useActiveCase } from "@/contexts/CaseContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VectorSearchResult {
  id: string;
  score: number;
  adjustedScore?: number;
  scoreBreakdown?: {
    baseScore: number;
    courtBoost: number;
    keywordBonus: number;
  };
  courtType?: string;
  rerankScore?: number;
  ecli: string;
  title?: string;
  court?: string;
  decision_date?: string;
  legal_area?: string;
  procedure_type?: string;
  source_url?: string;
  text?: string;
  ai_feiten?: string;
  ai_geschil?: string;
  ai_beslissing?: string;
  ai_motivering?: string;
  ai_inhoudsindicatie?: string;
}

export default function Jurisprudentie() {
  const { isLoading: authLoading } = useAuth();
  const currentCase = useActiveCase();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [legalArea, setLegalArea] = useState<string | undefined>(undefined);
  const [results, setResults] = useState<VectorSearchResult[]>([]);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  
  const [maxResults, setMaxResults] = useState(10);
  const [scoreThreshold, setScoreThreshold] = useState(0.10);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [requiredKeywords, setRequiredKeywords] = useState("");

  const generateQueryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/pinecone/generate-query', {
        caseId: currentCase?.id
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setSearchQuery(data.query);
      setScoreThreshold(0.30);
      
      if (data.requiredKeywords && Array.isArray(data.requiredKeywords) && data.requiredKeywords.length > 0) {
        setRequiredKeywords(data.requiredKeywords.join(', '));
        toast({
          title: "Zoekvraag gegenereerd",
          description: `AI heeft ${data.requiredKeywords.length} verplichte ${data.requiredKeywords.length === 1 ? 'woord' : 'woorden'} toegevoegd`,
        });
      } else {
        toast({
          title: "Zoekvraag gegenereerd",
          description: "Klik op 'Zoeken' om resultaten te vinden",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij genereren",
        description: error.message || "Kon geen zoekvraag genereren",
        variant: "destructive",
      });
    }
  });

  const searchMutation = useMutation({
    mutationFn: async () => {
      const allKeywords = requiredKeywords.trim() 
        ? requiredKeywords.toLowerCase().split(',').map(k => k.trim()).filter(k => k)
        : [];
      
      const filters: Record<string, any> = {};
      if (legalArea) filters.legal_area = { $eq: legalArea };

      const response = await apiRequest('POST', '/api/pinecone/search', {
        query: searchQuery,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        keywords: allKeywords,
        caseId: currentCase?.id || undefined,
        enableReranking: true
      });
      
      const data = await response.json();
      
      return { 
        results: data.results || [],
        totalCandidates: data.totalCandidates || 0,
        reranked: data.reranked || false,
      };
    },
    onSuccess: (data: any) => {
      setResults(data.results);
      
      const resultCount = data.results.length;
      const totalCandidates = data.totalCandidates || 0;
      const reranked = data.reranked || false;
      
      toast({
        title: "Zoeken voltooid",
        description: `${totalCandidates} kandidaten gevonden, top ${resultCount} geselecteerd${reranked ? ' met AI reranking' : ''}.`,
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

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Geen zoekvraag",
        description: "Voer een zoekvraag in of genereer er een met AI",
        variant: "destructive",
      });
      return;
    }
    
    setResults([]);
    searchMutation.mutate();
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

  return (
    <div className="container mx-auto px-4 py-8">
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

      <Card className="mb-6" data-testid="card-search">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Jurisprudentie Zoeken
          </CardTitle>
          <CardDescription>
            Genereer automatisch een zoekvraag of voer handmatig een vraag in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="searchQuery">Zoekvraag</Label>
            <div className="flex gap-2">
              <Input 
                id="searchQuery"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Bijvoorbeeld: ontbinding huurovereenkomst wegens geluidsoverlast"
                data-testid="input-search-query"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={() => generateQueryMutation.mutate()}
                disabled={generateQueryMutation.isPending || !currentCase}
                data-testid="button-generate-query"
                variant="secondary"
              >
                {generateQueryMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Genereren...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Genereer Zoekvraag
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Klik op "Genereer Zoekvraag" om AI een optimale zoekvraag te laten maken op basis van uw juridisch advies
            </p>
          </div>

          <div>
            <Label htmlFor="requiredKeywords">Verplichte woorden (komma-gescheiden)</Label>
            <Input
              id="requiredKeywords"
              value={requiredKeywords}
              onChange={(e) => setRequiredKeywords(e.target.value)}
              placeholder='Bijvoorbeeld: huurovereenkomst, opzegging'
              data-testid="input-required-keywords"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Alleen resultaten die deze woorden bevatten worden getoond (optioneel)
            </p>
          </div>

          <Collapsible open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full gap-2"
                data-testid="button-toggle-advanced-settings"
              >
                <Settings className="h-4 w-4" />
                Overige instellingen
                <span className="text-xs text-muted-foreground ml-auto">
                  ({showAdvancedSettings ? 'verbergen' : 'tonen'})
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4 border rounded-lg p-4 bg-muted/30">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="maxResults" className="font-semibold">Maximum aantal resultaten</Label>
                  <span className="text-sm font-mono bg-primary/10 px-2 py-1 rounded">{maxResults}</span>
                </div>
                <Slider
                  id="maxResults"
                  min={5}
                  max={50}
                  step={5}
                  value={[maxResults]}
                  onValueChange={(value) => setMaxResults(value[0])}
                  data-testid="slider-max-results"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Toon de top {maxResults} meest relevante resultaten
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="scoreThreshold" className="font-semibold">Relevantie drempel</Label>
                  <span className="text-sm font-mono bg-primary/10 px-2 py-1 rounded">{(scoreThreshold * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  id="scoreThreshold"
                  min={0.10}
                  max={0.30}
                  step={0.01}
                  value={[scoreThreshold]}
                  onValueChange={(value) => setScoreThreshold(value[0])}
                  data-testid="slider-score-threshold"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Minimale similarity score voor resultaten (10% - 30%)
                </p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="legal-area" className="font-semibold">Rechtsgebied</Label>
                <Select value={legalArea} onValueChange={(value) => setLegalArea(value === "all" ? undefined : value)}>
                  <SelectTrigger id="legal-area" data-testid="select-legal-area">
                    <SelectValue placeholder="Alle rechtsgebieden" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle rechtsgebieden</SelectItem>
                    <SelectItem value="Civiel recht">Civiel recht</SelectItem>
                    <SelectItem value="Bestuursrecht">Bestuursrecht</SelectItem>
                    <SelectItem value="Strafrecht">Strafrecht</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Filter op specifiek rechtsgebied (optioneel)
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Button 
            onClick={handleSearch} 
            disabled={searchMutation.isPending || !searchQuery.trim()}
            data-testid="button-search"
            className="w-full"
            size="lg"
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Zoeken...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Zoeken in jurisprudentie
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Top {Math.min(maxResults, results.length)} van {results.length} uitspraken
            </h2>
          </div>

          <div className="space-y-4">
            {results.slice(0, maxResults).map((result, index) => (
              <Card key={result.id} data-testid={`card-result-${index}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">
                        {result.title || result.ecli}
                      </CardTitle>
                      <div className="flex flex-wrap gap-2 mb-2">
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
                        {result.legal_area && (
                          <Badge variant="outline" className="text-xs">
                            <Scale className="h-3 w-3 mr-1" />
                            {result.legal_area}
                          </Badge>
                        )}
                        {result.procedure_type && (
                          <Badge variant="outline" className="text-xs">
                            {result.procedure_type}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {result.ecli}
                      </p>
                    </div>
                    {result.source_url && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        asChild
                        data-testid={`button-view-${index}`}
                      >
                        <a 
                          href={result.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Bekijk op Rechtspraak.nl
                        </a>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-score-${index}`}>
                        Relevantie: {(result.score * 100).toFixed(1)}%
                      </Badge>
                      {result.rerankScore !== undefined && (
                        <Badge variant="default" className="text-xs bg-primary/90" data-testid={`badge-rerank-score-${index}`}>
                          🤖 Rerank: {(result.rerankScore * 100).toFixed(1)}%
                        </Badge>
                      )}
                    </div>

                    {result.text && (
                      <div className="bg-muted/30 p-4 rounded-lg border" data-testid={`section-text-${index}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-4 w-4 text-foreground" />
                          <h4 className="font-semibold text-sm">Uitspraak tekst</h4>
                        </div>
                        <div className="prose prose-sm max-w-none text-sm">
                          <p className="text-foreground whitespace-pre-wrap leading-relaxed" data-testid={`text-content-${index}`}>
                            {result.text}
                          </p>
                        </div>
                      </div>
                    )}

                    {(result.ai_inhoudsindicatie || result.ai_feiten || result.ai_geschil || result.ai_beslissing || result.ai_motivering) && (
                      <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold text-sm">AI Samenvatting</h4>
                        </div>
                        <div className="prose prose-sm max-w-none text-sm">
                          {expandedResult === result.id ? (
                            <div className="space-y-4">
                              {result.ai_inhoudsindicatie && (
                                <div>
                                  <h5 className="font-semibold mb-1">Inhoudsindicatie</h5>
                                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                    {result.ai_inhoudsindicatie}
                                  </p>
                                </div>
                              )}
                              {result.ai_feiten && (
                                <div>
                                  <h5 className="font-semibold mb-1">Feiten</h5>
                                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                    {result.ai_feiten}
                                  </p>
                                </div>
                              )}
                              {result.ai_geschil && (
                                <div>
                                  <h5 className="font-semibold mb-1">Geschil</h5>
                                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                    {result.ai_geschil}
                                  </p>
                                </div>
                              )}
                              {result.ai_beslissing && (
                                <div>
                                  <h5 className="font-semibold mb-1">Beslissing</h5>
                                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                    {result.ai_beslissing}
                                  </p>
                                </div>
                              )}
                              {result.ai_motivering && (
                                <div>
                                  <h5 className="font-semibold mb-1">Motivering</h5>
                                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                    {result.ai_motivering}
                                  </p>
                                </div>
                              )}
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto text-primary"
                                onClick={() => setExpandedResult(null)}
                                data-testid={`button-collapse-${index}`}
                              >
                                Minder tonen
                              </Button>
                            </div>
                          ) : (
                            <div>
                              {(() => {
                                const fullText = [
                                  result.ai_inhoudsindicatie,
                                  result.ai_feiten,
                                  result.ai_geschil,
                                  result.ai_beslissing,
                                  result.ai_motivering
                                ].filter(Boolean).join('\n\n');
                                
                                const lines = fullText.split('\n').filter(l => l.trim());
                                const preview = lines.slice(0, 2).join('\n');
                                
                                return (
                                  <>
                                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                      {preview}
                                    </p>
                                    {lines.length > 2 && (
                                      <Button
                                        variant="link"
                                        size="sm"
                                        className="p-0 h-auto text-primary mt-2"
                                        onClick={() => setExpandedResult(result.id)}
                                        data-testid={`button-expand-${index}`}
                                      >
                                        Verder lezen →
                                      </Button>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!results.length && !searchMutation.isPending && (
        <Card data-testid="card-jurisprudentie-empty">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Zoeken in jurisprudentie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nog geen jurisprudentie gezocht</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Gebruik de zoekopdracht hierboven om relevante rechterlijke uitspraken te vinden.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
