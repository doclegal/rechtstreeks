import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  AlertTriangle, 
  Scale, 
  Users,
  TrendingUp,
  FileText,
  Play,
  Clock
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
  // Show simple text output first for easier testing - ALWAYS show rawText if available
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
