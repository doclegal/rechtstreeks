import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  AlertTriangle, 
  Scale, 
  Users,
  TrendingUp,
  FileText,
  Play,
  Clock,
  Calendar,
  Euro
} from "lucide-react";

interface AnalysisResultsProps {
  analysis?: {
    factsJson?: any[];
    issuesJson?: any[];
    legalBasisJson?: any[];
    riskNotesJson?: any[];
    missingDocsJson?: any[];
    missingDocuments?: string[];
    rawText?: string;
    billingCost?: string;
  } | null;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
  hasNewInfo?: boolean;
}

export default function AnalysisResults({ analysis, onAnalyze, isAnalyzing = false, hasNewInfo = false }: AnalysisResultsProps) {
  // Try to parse JSON from rawText first
  let parsedAnalysis = null;
  if (analysis?.rawText) {
    try {
      parsedAnalysis = JSON.parse(analysis.rawText);
    } catch (error) {
      console.log('Analysis is not JSON, displaying as text');
    }
  }

  // Show structured JSON output if available
  if (parsedAnalysis) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-green-700 flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Juridische Analyse Voltooid
              </CardTitle>
              {onAnalyze && (
                <Button
                  onClick={onAnalyze}
                  disabled={isAnalyzing || (!!analysis && !hasNewInfo)}
                  variant={hasNewInfo ? "destructive" : "secondary"}
                  size="sm"
                  data-testid="button-start-analysis"
                >
                  {isAnalyzing ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Analyseren...
                    </>
                  ) : hasNewInfo ? (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Nieuwe analyse uitvoeren
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Analyse voltooid
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Basisinformatie */}
        {parsedAnalysis.basisinformatie && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" />
                Zaak Overzicht
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Samenvatting</h4>
                <p className="text-sm text-gray-700">{parsedAnalysis.basisinformatie.samenvatting}</p>
              </div>
              
              {parsedAnalysis.basisinformatie.partijen && (
                <div>
                  <h4 className="font-medium mb-2">Partijen</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded p-3">
                      <h5 className="font-medium text-green-700">Eiser</h5>
                      <p className="text-sm">{parsedAnalysis.basisinformatie.partijen.eiser?.naam}</p>
                      <p className="text-xs text-gray-600">{parsedAnalysis.basisinformatie.partijen.eiser?.rol}</p>
                    </div>
                    <div className="border rounded p-3">
                      <h5 className="font-medium text-red-700">Gedaagde</h5>
                      <p className="text-sm">{parsedAnalysis.basisinformatie.partijen.gedaagde?.naam}</p>
                      <p className="text-xs text-gray-600">{parsedAnalysis.basisinformatie.partijen.gedaagde?.adres || 'Adres onbekend'}</p>
                    </div>
                  </div>
                </div>
              )}

              {parsedAnalysis.basisinformatie.gevorderdResultaat && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Euro className="w-4 h-4" />
                    Gevorderd Bedrag
                  </h4>
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-lg font-medium text-blue-900">
                      € {parsedAnalysis.basisinformatie.gevorderdResultaat.hoofdsom?.toLocaleString()}
                    </p>
                    <p className="text-sm text-blue-700">
                      {parsedAnalysis.basisinformatie.gevorderdResultaat.renteType} vanaf {parsedAnalysis.basisinformatie.gevorderdResultaat.renteVanaf}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Juridische Duiding */}
        {parsedAnalysis.juridischeDuiding && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scale className="w-5 h-5" />
                Juridische Duiding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Rechtbank</h4>
                  <p className="text-sm">{parsedAnalysis.juridischeDuiding.bevoegdeRechtbankLocatie}</p>
                  {parsedAnalysis.juridischeDuiding.isKantonzaak && (
                    <Badge className="mt-1">Kantonzaak</Badge>
                  )}
                </div>
                <div>
                  <h4 className="font-medium mb-2">Kansschatting</h4>
                  <Badge variant={parsedAnalysis.juridischeDuiding.kansinschatting?.kwalitatief === 'Hoog' ? 'default' : 'secondary'}>
                    {parsedAnalysis.juridischeDuiding.kansinschatting?.kwalitatief}
                  </Badge>
                </div>
              </div>
              
              {parsedAnalysis.juridischeDuiding.rechtsgronden && (
                <div>
                  <h4 className="font-medium mb-2">Rechtsgronden</h4>
                  <div className="flex flex-wrap gap-2">
                    {parsedAnalysis.juridischeDuiding.rechtsgronden.map((grond: string, index: number) => (
                      <Badge key={index} variant="outline">{grond}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {parsedAnalysis.juridischeDuiding.kansinschatting?.belangrijksteRedenen && (
                <div>
                  <h4 className="font-medium mb-2">Belangrijkste Redenen</h4>
                  <ul className="text-sm space-y-1">
                    {parsedAnalysis.juridischeDuiding.kansinschatting.belangrijksteRedenen.map((reden: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">•</span>
                        {reden}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Feiten en Bewijs */}
        {parsedAnalysis.feitenEnBewijs && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                Feiten & Bewijs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {parsedAnalysis.feitenEnBewijs.tijdlijn && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Tijdlijn
                  </h4>
                  <div className="space-y-2">
                    {parsedAnalysis.feitenEnBewijs.tijdlijn.map((item: any, index: number) => (
                      <div key={index} className="flex items-start gap-3 p-2 border-l-2 border-blue-200">
                        <div className="text-sm font-medium text-blue-700 min-w-20">
                          {item.datum}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.gebeurtenis}</p>
                          <p className="text-xs text-gray-600">{item.bron}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {parsedAnalysis.feitenEnBewijs.beschikbaarBewijs && (
                <div>
                  <h4 className="font-medium mb-2">Beschikbaar Bewijs</h4>
                  <div className="grid gap-2">
                    {parsedAnalysis.feitenEnBewijs.beschikbaarBewijs.map((bewijs: any, index: number) => (
                      <div key={index} className="border rounded p-3">
                        <p className="font-medium text-sm">{bewijs.type}</p>
                        <p className="text-xs text-gray-700">{bewijs.beschrijving}</p>
                        <Badge variant="outline" className="mt-1 text-xs">{bewijs.relevantie}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Billing cost if available */}
        {analysis?.billingCost && (
          <div className="text-xs text-muted-foreground">
            Analyse kosten: {analysis?.billingCost}
          </div>
        )}
      </div>
    );
  }

  // Fallback to text display if JSON parsing failed but rawText available
  if (analysis?.rawText) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Juridische Analyse Voltooid</span>
            </CardTitle>
            {onAnalyze && (
              <Button
                onClick={onAnalyze}
                disabled={isAnalyzing || (analysis && !hasNewInfo)}
                variant={hasNewInfo ? "destructive" : "secondary"}
                size="sm"
                data-testid="button-start-analysis"
              >
                {isAnalyzing ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Analyseren...
                  </>
                ) : hasNewInfo ? (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Nieuwe analyse uitvoeren
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Analyse voltooid
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">
              {analysis.rawText}
            </pre>
          </div>
          {analysis.billingCost && (
            <div className="mt-4 text-xs text-muted-foreground">
              Analyse kosten: {analysis.billingCost}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // If no analysis yet, show empty state with analyze button
  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>AI Analyse resultaten</span>
            </CardTitle>
            {onAnalyze && (
              <Button
                onClick={onAnalyze}
                disabled={isAnalyzing}
                variant="default"
                size="sm"
                data-testid="button-start-analysis"
              >
                {isAnalyzing ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Analyseren...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start analyse
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="mx-auto h-12 w-12 mb-4 opacity-30" />
            <p>Nog geen analyse uitgevoerd.</p>
            <p className="text-sm">Start de analyse om juridische insights te krijgen.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Defensive rendering - always ensure arrays exist
  const facts = Array.isArray(analysis.factsJson) ? analysis.factsJson : [];
  const issues = Array.isArray(analysis.issuesJson) ? analysis.issuesJson : [];
  const legalBasis = Array.isArray(analysis.legalBasisJson) ? analysis.legalBasisJson : [];
  const riskNotes = Array.isArray(analysis.riskNotesJson) ? analysis.riskNotesJson : [];
  const missingDocs = Array.isArray(analysis.missingDocuments) ? analysis.missingDocuments : 
                      Array.isArray(analysis.missingDocsJson) ? analysis.missingDocsJson : [];

  // Show the analysis section with "Start analyse" button
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>AI Analyse resultaten</span>
          </CardTitle>
          {onAnalyze && (
            <Button
              onClick={onAnalyze}
              disabled={isAnalyzing || (analysis && !hasNewInfo)}
              variant={hasNewInfo ? "destructive" : analysis ? "secondary" : "default"}
              size="sm"
              data-testid="button-start-analysis"
            >
              {isAnalyzing ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Analyseren...
                </>
              ) : analysis && !hasNewInfo ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Analyse voltooid
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  {hasNewInfo ? "Nieuwe analyse uitvoeren" : "Start analyse"}
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Facts */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 flex items-center">
              <CheckCircle className="text-primary mr-2 h-4 w-4" />
              Belangrijkste feiten
            </h3>
            {facts.length > 0 ? (
              <ul className="space-y-2" data-testid="list-facts">
                {facts.map((fact, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                    <span className="text-primary mt-1.5 text-xs">•</span>
                    <span>{typeof fact === 'string' ? fact : fact.detail || fact.label || fact.description || fact.text || JSON.stringify(fact)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Geen feiten geïdentificeerd</p>
            )}
          </div>
          
          {/* Legal Basis */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 flex items-center">
              <Scale className="text-warning mr-2 h-4 w-4" />
              Juridische grondslag
            </h3>
            {legalBasis.length > 0 ? (
              <ul className="space-y-2" data-testid="list-legal-basis">
                {legalBasis.map((basis, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                    <span className="text-primary mt-1.5 text-xs">•</span>
                    <span>{typeof basis === 'string' ? basis : basis.law || basis.article || basis.label || basis.text || JSON.stringify(basis)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Geen juridische grondslag gevonden</p>
            )}
          </div>

          {/* Issues */}
          {issues.length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-3 flex items-center">
                <AlertTriangle className="text-warning mr-2 h-4 w-4" />
                Geïdentificeerde problemen
              </h3>
              <ul className="space-y-2" data-testid="list-issues">
                {issues.map((issue, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                    <span className="text-warning mt-1.5 text-xs">•</span>
                    <span>{typeof issue === 'string' ? issue : issue.issue || issue.description || issue.label || issue.text || JSON.stringify(issue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Risk Assessment */}
        {riskNotes.length > 0 && (
          <div className="mt-6 p-4 bg-accent rounded-lg">
            <h4 className="font-medium text-accent-foreground mb-2 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Risico-inschatting
            </h4>
            <div className="space-y-1" data-testid="risk-assessment">
              {riskNotes.map((note, index) => (
                <p key={index} className="text-sm text-accent-foreground">
                  {typeof note === 'string' ? note : note.description || note.text}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Missing Documents */}
        {missingDocs.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-foreground mb-2 flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Ontbrekende documenten
            </h4>
            <ul className="space-y-1" data-testid="missing-documents">
              {missingDocs.map((doc, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                  <span className="text-primary mt-1.5 text-xs">•</span>
                  <span>{typeof doc === 'string' ? doc : doc.name || doc.label || doc.text || JSON.stringify(doc)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Raw text fallback */}
        {analysis.rawText && (facts.length === 0 || issues.length === 0 || legalBasis.length === 0) && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-foreground mb-2 flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Volledige analyse tekst
            </h4>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="raw-analysis-text">
              {analysis.rawText}
            </div>
          </div>
        )}

        {/* Billing cost if available */}
        {analysis.billingCost && (
          <div className="mt-4 text-xs text-muted-foreground">
            Analyse kosten: {analysis.billingCost}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
