import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  AlertTriangle, 
  X,
  HelpCircle,
  FileText,
  Users,
  Scale
} from "lucide-react";

interface KantonCheckResult {
  ok: boolean;
  phase?: string;
  decision?: string;
  reason?: string;
  summary?: string;
  parties?: any;
  basis?: string;
  rationale?: string;
  questions?: any[];
  rawText?: string;
  billingCost?: string;
}

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
  kantonCheck?: KantonCheckResult;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
  hasNewInfo?: boolean;
}

export default function AnalysisResults({ 
  analysis, 
  kantonCheck, 
  onAnalyze, 
  isAnalyzing = false, 
  hasNewInfo = false 
}: AnalysisResultsProps) {
  
  // Extract kanton check result from rawText if not provided separately
  let parsedKantonCheck = kantonCheck;
  if (!parsedKantonCheck && analysis?.rawText) {
    try {
      const parsed = JSON.parse(analysis.rawText);
      if (parsed.ok !== undefined) {
        parsedKantonCheck = parsed;
      }
    } catch (error) {
      console.log('Could not parse kanton check from rawText');
    }
  }

  // If no analysis yet, show analyze button
  if (!analysis) {
    return (
      <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
            <Scale className="h-5 w-5" />
            Juridische Analyse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Laat ons eerst controleren of uw zaak geschikt is voor behandeling door het kantongerecht.
            </p>
            
            <Button 
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="w-full"
              data-testid="button-start-analysis"
            >
              {isAnalyzing ? 'Analyseren...' : 'Start Kantonzaak Controle'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If analysis exists but no kanton check data, show error
  if (!parsedKantonCheck) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertTriangle className="h-5 w-5" />
            Analyse Fout
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-700 dark:text-red-300">
            Er is een probleem opgetreden bij de analyse. Probeer het opnieuw.
          </p>
          
          <Button 
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="mt-4 w-full"
            variant="outline"
            data-testid="button-retry-analysis"
          >
            {isAnalyzing ? 'Analyseren...' : 'Opnieuw Proberen'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show kanton check results
  return (
    <div className="space-y-6">
      {/* Main Result Card */}
      <Card className={`${
        parsedKantonCheck.ok 
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
          : parsedKantonCheck.reason === 'insufficient_info'
            ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30'
            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
      }`}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${
            parsedKantonCheck.ok 
              ? 'text-green-800 dark:text-green-200'
              : parsedKantonCheck.reason === 'insufficient_info'
                ? 'text-yellow-800 dark:text-yellow-200'
                : 'text-red-800 dark:text-red-200'
          }`}>
            {parsedKantonCheck.ok ? (
              <CheckCircle className="h-5 w-5" />
            ) : parsedKantonCheck.reason === 'insufficient_info' ? (
              <HelpCircle className="h-5 w-5" />
            ) : (
              <X className="h-5 w-5" />
            )}
            Kantonzaak Controle Resultaat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status Badge */}
            <Badge 
              variant={parsedKantonCheck.ok ? "default" : "secondary"}
              className={`${
                parsedKantonCheck.ok 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : parsedKantonCheck.reason === 'insufficient_info'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}
            >
              {parsedKantonCheck.ok 
                ? 'Geschikt voor Kantongerecht'
                : parsedKantonCheck.reason === 'insufficient_info'
                  ? 'Meer Informatie Nodig'
                  : 'Niet Geschikt voor Kantongerecht'
              }
            </Badge>

            {/* Summary */}
            {parsedKantonCheck.summary && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Samenvatting:</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300" data-testid="text-summary">
                  {parsedKantonCheck.summary}
                </p>
              </div>
            )}

            {/* Parties */}
            {parsedKantonCheck.parties && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Partijen:
                </h4>
                <div className="text-sm text-gray-700 dark:text-gray-300" data-testid="text-parties">
                  {typeof parsedKantonCheck.parties === 'string' 
                    ? parsedKantonCheck.parties
                    : JSON.stringify(parsedKantonCheck.parties, null, 2)
                  }
                </div>
              </div>
            )}

            {/* Legal Basis (only for approved cases) */}
            {parsedKantonCheck.ok && parsedKantonCheck.basis && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Juridische Grondslag:
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300" data-testid="text-legal-basis">
                  {parsedKantonCheck.basis}
                </p>
              </div>
            )}

            {/* Rationale (for rejected cases) */}
            {!parsedKantonCheck.ok && parsedKantonCheck.reason === 'not_kantonzaak' && parsedKantonCheck.rationale && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Waarom niet geschikt:</h4>
                <p className="text-sm text-red-700 dark:text-red-300" data-testid="text-rationale">
                  {parsedKantonCheck.rationale}
                </p>
              </div>
            )}

            {/* Missing Info Questions */}
            {parsedKantonCheck.reason === 'insufficient_info' && parsedKantonCheck.questions && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Benodigde Informatie:</h4>
                <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                  {parsedKantonCheck.questions.map((question: any, index: number) => (
                    <li key={index} className="flex items-start gap-2" data-testid={`question-${index}`}>
                      <span className="text-yellow-500 mt-1">•</span>
                      <span>{typeof question === 'string' ? question : question.label || JSON.stringify(question)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* Action Buttons */}
            <div className="flex gap-2">
              {parsedKantonCheck.ok ? (
                <Button 
                  className="flex-1" 
                  data-testid="button-start-full-analysis"
                  onClick={() => {
                    // TODO: Implement full analysis after kanton check approval
                    alert('Volledige analyse functionaliteit wordt binnenkort toegevoegd');
                  }}
                >
                  Start Volledige Analyse
                </Button>
              ) : parsedKantonCheck.reason === 'insufficient_info' ? (
                <Button 
                  variant="outline" 
                  className="flex-1"
                  data-testid="button-add-more-info"
                  onClick={() => {
                    // TODO: Implement adding more documents/info
                    alert('Upload meer documenten of voeg aanvullende informatie toe');
                  }}
                >
                  Meer Informatie Toevoegen
                </Button>
              ) : (
                <div className="text-sm text-red-600 dark:text-red-400">
                  Deze zaak is niet geschikt voor behandeling via onze platform.
                </div>
              )}

              <Button 
                variant="outline" 
                onClick={onAnalyze}
                disabled={isAnalyzing}
                data-testid="button-recheck-kanton"
              >
                {isAnalyzing ? 'Controleren...' : 'Opnieuw Controleren'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Raw Analysis Details (Collapsible) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" />
            Technische Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <details className="text-xs">
            <summary className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded">
              Toon ruwe analyse data
            </summary>
            <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto" data-testid="text-raw-data">
              {parsedKantonCheck.rawText || JSON.stringify(parsedKantonCheck, null, 2)}
            </pre>
          </details>
          
          {parsedKantonCheck.billingCost && (
            <div className="mt-2 text-xs text-gray-500">
              Kosten: {parsedKantonCheck.billingCost}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}