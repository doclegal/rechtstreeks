import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Scale, FileText, ExternalLink, Calendar, Building2, Search, Loader2 } from "lucide-react";
import { useActiveCase } from "@/contexts/CaseContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RechtspraakItem {
  ecli: string;
  title: string;
  court: string;
  date: string;
  url: string;
  snippet: string;
  score: number;
}

interface RechtspraakSearchResponse {
  items: RechtspraakItem[];
  meta: {
    total: number;
    fetch_ms: number;
    source: string;
    applied_filters: Record<string, any>;
    page: number;
    page_size: number;
  };
}

export default function Jurisprudentie() {
  const { isLoading: authLoading } = useAuth();
  const currentCase = useActiveCase();
  const { toast } = useToast();
  
  const [rechtsgebied, setRechtsgebied] = useState<string | undefined>(undefined);
  const [instantie, setInstantie] = useState<string | undefined>(undefined);
  const [periode, setPeriode] = useState<string>("laatste 5 jaar");
  const [results, setResults] = useState<RechtspraakSearchResponse | null>(null);

  const searchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/rechtspraak/search', {
        filters: {
          rechtsgebied: rechtsgebied || null,
          instantie: instantie || null,
          periode: periode || null
        }
      });
      return response.json();
    },
    onSuccess: (data: RechtspraakSearchResponse) => {
      setResults(data);
      toast({
        title: "Zoekresultaten geladen",
        description: `${data.items.length} relevante uitspraken gevonden`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij zoeken",
        description: error.message || "Kon jurisprudentie niet ophalen",
        variant: "destructive",
      });
    }
  });

  const handleSearch = () => {
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
          Relevante uitspraken van Rechtspraak.nl voor {currentCase.title || 'uw zaak'}
        </p>
      </div>

      {/* Search filters */}
      <Card className="mb-6" data-testid="card-search-filters">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filteren in jurisprudentie
          </CardTitle>
          <CardDescription>
            Vind rechterlijke uitspraken met filters (periode, rechtsgebied, instantie)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="rechtsgebied">Rechtsgebied (optioneel)</Label>
                <Select value={rechtsgebied} onValueChange={(value) => setRechtsgebied(value === "all" ? undefined : value)}>
                  <SelectTrigger id="rechtsgebied" data-testid="select-rechtsgebied">
                    <SelectValue placeholder="Alle rechtsgebieden" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle rechtsgebieden</SelectItem>
                    <SelectItem value="civielrecht">Civiel recht</SelectItem>
                    <SelectItem value="bestuursrecht">Bestuursrecht</SelectItem>
                    <SelectItem value="strafrecht">Strafrecht</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="instantie">Instantie (optioneel)</Label>
                <Select value={instantie} onValueChange={(value) => setInstantie(value === "all" ? undefined : value)}>
                  <SelectTrigger id="instantie" data-testid="select-instantie">
                    <SelectValue placeholder="Alle instanties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle instanties</SelectItem>
                    <SelectItem value="hoge raad">Hoge Raad</SelectItem>
                    <SelectItem value="gerechtshof amsterdam">Gerechtshof Amsterdam</SelectItem>
                    <SelectItem value="gerechtshof arnhem-leeuwarden">Gerechtshof Arnhem-Leeuwarden</SelectItem>
                    <SelectItem value="gerechtshof den haag">Gerechtshof Den Haag</SelectItem>
                    <SelectItem value="gerechtshof 's-hertogenbosch">Gerechtshof 's-Hertogenbosch</SelectItem>
                    <SelectItem value="rechtbank amsterdam">Rechtbank Amsterdam</SelectItem>
                    <SelectItem value="rechtbank rotterdam">Rechtbank Rotterdam</SelectItem>
                    <SelectItem value="rechtbank den haag">Rechtbank Den Haag</SelectItem>
                    <SelectItem value="rechtbank midden-nederland">Rechtbank Midden-Nederland</SelectItem>
                    <SelectItem value="rechtbank noord-nederland">Rechtbank Noord-Nederland</SelectItem>
                    <SelectItem value="rechtbank oost-brabant">Rechtbank Oost-Brabant</SelectItem>
                    <SelectItem value="rechtbank zeeland-west-brabant">Rechtbank Zeeland-West-Brabant</SelectItem>
                    <SelectItem value="rechtbank limburg">Rechtbank Limburg</SelectItem>
                    <SelectItem value="rechtbank gelderland">Rechtbank Gelderland</SelectItem>
                    <SelectItem value="rechtbank overijssel">Rechtbank Overijssel</SelectItem>
                    <SelectItem value="centrale raad van beroep">Centrale Raad van Beroep</SelectItem>
                    <SelectItem value="college van beroep voor het bedrijfsleven">College van Beroep voor het Bedrijfsleven</SelectItem>
                    <SelectItem value="raad van state">Raad van State</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="periode">Periode</Label>
                <Select value={periode} onValueChange={setPeriode}>
                  <SelectTrigger id="periode" data-testid="select-periode">
                    <SelectValue placeholder="Laatste 5 jaar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="laatste 3 dagen">Laatste 3 dagen</SelectItem>
                    <SelectItem value="afgelopen week">Afgelopen week</SelectItem>
                    <SelectItem value="afgelopen maand">Afgelopen maand</SelectItem>
                    <SelectItem value="afgelopen jaar">Afgelopen jaar</SelectItem>
                    <SelectItem value="laatste 3 jaar">Laatste 3 jaar</SelectItem>
                    <SelectItem value="laatste 5 jaar">Laatste 5 jaar</SelectItem>
                    <SelectItem value="laatste 10 jaar">Laatste 10 jaar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleSearch} 
              disabled={searchMutation.isPending}
              data-testid="button-search"
              className="w-full md:w-auto"
            >
              {searchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uitspraken ophalen...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Uitspraken ophalen
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {results.items.length} {results.items.length === 1 ? 'uitspraak' : 'uitspraken'} gevonden
            </h2>
            <p className="text-sm text-muted-foreground">
              Gezocht in {results.meta.fetch_ms}ms
            </p>
          </div>

          {results.items.length === 0 ? (
            <Card data-testid="card-no-results">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Geen resultaten gevonden</h3>
                  <p className="text-sm text-muted-foreground">
                    Probeer andere zoektermen of filters
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {results.items.map((item, index) => (
                <Card key={item.ecli} data-testid={`card-result-${index}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">
                          {item.title || 'Geen titel'}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">
                            <Building2 className="h-3 w-3 mr-1" />
                            {item.court || 'Onbekend'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {item.date || 'Geen datum'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          {item.ecli}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        asChild
                        data-testid={`button-view-${index}`}
                      >
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </CardHeader>
                  {item.snippet && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {item.snippet}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {!results && !searchMutation.isPending && (
        <Card data-testid="card-jurisprudentie-empty">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Overzicht rechtspraak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nog geen jurisprudentie gezocht</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Gebruik de zoekopdracht hierboven om relevante rechterlijke uitspraken van Rechtspraak.nl te vinden die van toepassing zijn op uw zaak.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
