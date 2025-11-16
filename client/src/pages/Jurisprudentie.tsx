import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Scale, FileText, ExternalLink, Calendar, Building2, Search, Loader2, Sparkles } from "lucide-react";
import { useActiveCase } from "@/contexts/CaseContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VectorSearchResult {
  id: string;
  score: number;
  ecli: string;
  title?: string;
  court?: string;
  decision_date?: string;
  legal_area?: string;
  procedure_type?: string;
  source_url?: string;
  text?: string;
}

interface FullDocument {
  ecli: string;
  title: string;
  court: string;
  date: string;
  originalSummary: string;
  aiSummary: string;
  url: string;
}

export default function Jurisprudentie() {
  const { isLoading: authLoading } = useAuth();
  const currentCase = useActiveCase();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [legalArea, setLegalArea] = useState<string | undefined>(undefined);
  const [court, setCourt] = useState<string | undefined>(undefined);
  const [procedureType, setProcedureType] = useState<string | undefined>(undefined);
  const [results, setResults] = useState<VectorSearchResult[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<FullDocument | null>(null);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [loadingEcli, setLoadingEcli] = useState<string | null>(null);

  const searchMutation = useMutation({
    mutationFn: async () => {
      const filters: Record<string, any> = {};
      
      if (legalArea) filters.legal_area = { $eq: legalArea };
      if (court) filters.court = { $eq: court };
      if (procedureType) filters.procedure_type = { $eq: procedureType };

      const response = await apiRequest('POST', '/api/pinecone/search', {
        query: searchQuery,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        topK: 20
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setResults(data.results || []);
      toast({
        title: "Zoekresultaten geladen",
        description: `${data.results?.length || 0} relevante uitspraken gevonden`,
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

  const fetchDocumentMutation = useMutation({
    mutationFn: async (ecli: string) => {
      setLoadingEcli(ecli);
      const response = await apiRequest('GET', `/api/rechtspraak/document/${encodeURIComponent(ecli)}`);
      return response.json();
    },
    onSuccess: (data: FullDocument) => {
      setSelectedDocument(data);
      setIsDocumentDialogOpen(true);
      setLoadingEcli(null);
    },
    onError: (error: any) => {
      setLoadingEcli(null);
      toast({
        title: "Fout bij ophalen document",
        description: error.message || "Kon document niet ophalen",
        variant: "destructive",
      });
    }
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Geen zoekvraag",
        description: "Voer een zoekvraag in om te zoeken",
        variant: "destructive",
      });
      return;
    }
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

      {/* Search form */}
      <Card className="mb-6" data-testid="card-search-filters">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Semantisch zoeken in jurisprudentie
          </CardTitle>
          <CardDescription>
            Doorzoek de volledige tekst van Nederlandse rechterlijke uitspraken met AI-powered semantische zoekopdrachten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="searchQuery">Zoekvraag</Label>
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
                className="text-base"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Beschrijf uw juridische vraag in natuurlijke taal
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="legal-area">Rechtsgebied (optioneel)</Label>
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
              </div>

              <div>
                <Label htmlFor="court">Rechtbank (optioneel)</Label>
                <Select value={court} onValueChange={(value) => setCourt(value === "all" ? undefined : value)}>
                  <SelectTrigger id="court" data-testid="select-court">
                    <SelectValue placeholder="Alle rechtbanken" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle rechtbanken</SelectItem>
                    <SelectItem value="Hoge Raad">Hoge Raad</SelectItem>
                    <SelectItem value="Rechtbank Amsterdam">Rechtbank Amsterdam</SelectItem>
                    <SelectItem value="Rechtbank Rotterdam">Rechtbank Rotterdam</SelectItem>
                    <SelectItem value="Rechtbank Den Haag">Rechtbank Den Haag</SelectItem>
                    <SelectItem value="Rechtbank Utrecht">Rechtbank Utrecht</SelectItem>
                    <SelectItem value="Gerechtshof Amsterdam">Gerechtshof Amsterdam</SelectItem>
                    <SelectItem value="Gerechtshof Den Haag">Gerechtshof Den Haag</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="procedure-type">Procedure type (optioneel)</Label>
                <Select value={procedureType} onValueChange={(value) => setProcedureType(value === "all" ? undefined : value)}>
                  <SelectTrigger id="procedure-type" data-testid="select-procedure-type">
                    <SelectValue placeholder="Alle procedures" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle procedures</SelectItem>
                    <SelectItem value="Bodemzaak">Bodemzaak</SelectItem>
                    <SelectItem value="Kort geding">Kort geding</SelectItem>
                    <SelectItem value="Hoger beroep">Hoger beroep</SelectItem>
                    <SelectItem value="Cassatie">Cassatie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleSearch} 
              disabled={searchMutation.isPending || !searchQuery.trim()}
              data-testid="button-search"
              className="w-full md:w-auto"
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
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {results.length} relevante {results.length === 1 ? 'uitspraak' : 'uitspraken'} gevonden
            </h2>
          </div>

          <div className="space-y-4">
            {results.map((result, index) => (
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
                        <Badge variant="default" className="text-xs">
                          Relevantie: {(result.score * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {result.ecli}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => fetchDocumentMutation.mutate(result.ecli)}
                        disabled={loadingEcli === result.ecli}
                        data-testid={`button-ai-summary-${index}`}
                      >
                        {loadingEcli === result.ecli ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            AI Samenvatting
                          </>
                        )}
                      </Button>
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
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {result.text && (
                  <CardContent>
                    <div className="border-l-2 border-primary pl-3">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {result.text.substring(0, 400)}
                        {result.text.length > 400 && '...'}
                      </p>
                    </div>
                  </CardContent>
                )}
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
                Gebruik de zoekopdracht hierboven om relevante rechterlijke uitspraken te vinden met AI-powered semantische zoekopdrachten.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full text dialog */}
      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {selectedDocument?.title || selectedDocument?.ecli}
            </DialogTitle>
            <DialogDescription>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedDocument?.court && (
                  <Badge variant="secondary" className="text-xs">
                    <Building2 className="h-3 w-3 mr-1" />
                    {selectedDocument.court}
                  </Badge>
                )}
                {selectedDocument?.date && (
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {selectedDocument.date}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-2">
                {selectedDocument?.ecli}
              </p>
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh] mt-4">
            <div className="space-y-6 pr-4">
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Samenvatting</h3>
                </div>
                <div className="prose prose-sm max-w-none text-sm text-muted-foreground space-y-4">
                  {selectedDocument?.originalSummary && 
                   selectedDocument.originalSummary.trim() !== '' && 
                   selectedDocument.originalSummary.trim() !== '-' && (
                    <div className="pb-4 mb-4 border-b border-primary/20">
                      <a 
                        href={selectedDocument.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-red-600 dark:text-red-400 font-mono text-xs hover:underline mb-2 block"
                      >
                        {selectedDocument.ecli}
                      </a>
                      <h4 className="font-semibold text-base mb-2 text-foreground">Inhoudsindicatie</h4>
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {selectedDocument.originalSummary}
                      </p>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {selectedDocument?.aiSummary}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a 
                href={selectedDocument?.url} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open op Rechtspraak.nl
              </a>
            </Button>
            <Button 
              variant="default" 
              onClick={() => setIsDocumentDialogOpen(false)}
              data-testid="button-close-dialog"
            >
              Sluiten
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
