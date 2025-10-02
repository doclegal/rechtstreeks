import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { 
  CheckCircle, 
  AlertTriangle, 
  X,
  HelpCircle,
  FileText,
  Users,
  Scale,
  Send
} from "lucide-react";
import { MindStudioAnalysis } from "./MindStudioAnalysis";

interface KantonCheckResult {
  ok: boolean;
  phase?: string;
  decision?: string;
  reason?: string;
  summary?: string;
  parties?: {
    claimant_name?: string | null;
    defendant_name?: string | null;
    relationship?: string | null;
    source?: string;
  };
  basis?: {
    grond?: string | null;
    belang_eur?: number | null;
    bijzondere_regel?: string | null;
  };
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
  fullAnalysis?: {
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
  caseId?: string;
  onFullAnalyze?: () => void;
  isFullAnalyzing?: boolean;
}

export default function AnalysisResults({ 
  analysis, 
  fullAnalysis,
  kantonCheck, 
  onAnalyze, 
  isAnalyzing = false, 
  hasNewInfo = false,
  caseId,
  onFullAnalyze,
  isFullAnalyzing = false
}: AnalysisResultsProps) {
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false);
  
  // Extract kanton check result from rawText if not provided separately
  let parsedKantonCheck = kantonCheck;
  if (!parsedKantonCheck && analysis?.rawText) {
    try {
      const parsed = JSON.parse(analysis.rawText);
      
      // New format: Direct kanton check result
      if (parsed.ok !== undefined) {
        parsedKantonCheck = parsed;
      }
      // Old format: Full MindStudio response - extract from posts
      else if (parsed.thread?.posts) {
        console.log("🔍 Extracting kanton check from MindStudio posts...");
        for (const post of parsed.thread.posts) {
          // Look in debugLog newState variables
          if (post.debugLog?.newState?.variables?.app_response?.value) {
            console.log("🔍 Found app_response in debugLog.newState.variables");
            const responseValue = post.debugLog.newState.variables.app_response.value;
            let appResponse;
            if (typeof responseValue === 'string') {
              appResponse = JSON.parse(responseValue);
            } else {
              appResponse = responseValue;
            }
            if (appResponse.ok !== undefined) {
              parsedKantonCheck = appResponse;
              break;
            }
          }
          // Look in regular message content as fallback
          else if (post.message?.content || post.chatMessage?.content) {
            const content = post.message?.content || post.chatMessage?.content;
            try {
              const contentParsed = JSON.parse(content);
              if (contentParsed.ok !== undefined && contentParsed.phase === 'kanton_check') {
                console.log("🔍 Found app_response in message content");
                parsedKantonCheck = contentParsed;
                break;
              }
            } catch (e) {
              // Ignore parsing errors for message content
            }
          }
        }
      }
    } catch (error) {
      console.log('Could not parse kanton check from rawText:', error);
    }
  }

  const handleQuestionChange = (index: number, value: string) => {
    setQuestionAnswers(prev => ({ ...prev, [index]: value }));
  };

  const handleSubmitAnswers = async () => {
    setIsSubmittingAnswers(true);
    // TODO: Submit answers back to analysis
    console.log('Submitting answers:', questionAnswers);
    setTimeout(() => {
      setIsSubmittingAnswers(false);
      alert('Antwoorden opgeslagen. Voer opnieuw een analyse uit.');
    }, 1000);
  };

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

            {/* Altijd tonen: Summary en Parties */}
            <div className="space-y-4">
              {/* Summary - altijd tonen */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Samenvatting:</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300" data-testid="text-summary">
                  {parsedKantonCheck.summary || 'Geen samenvatting beschikbaar'}
                </p>
              </div>

              {/* Parties - altijd tonen */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Partijen:
                </h4>
                <div className="text-sm text-gray-700 dark:text-gray-300" data-testid="text-parties">
                  {parsedKantonCheck.parties ? (
                    <div className="space-y-1">
                      {parsedKantonCheck.parties.claimant_name && (
                        <div><strong>Eiser:</strong> {parsedKantonCheck.parties.claimant_name}</div>
                      )}
                      {parsedKantonCheck.parties.defendant_name && (
                        <div><strong>Verweerder:</strong> {parsedKantonCheck.parties.defendant_name}</div>
                      )}
                      {parsedKantonCheck.parties.relationship && (
                        <div><strong>Relatie:</strong> {parsedKantonCheck.parties.relationship}</div>
                      )}
                    </div>
                  ) : 'Geen partijen informatie beschikbaar'}
                </div>
              </div>
            </div>

            {/* Conditionale secties gebaseerd op ok en reason */}
            <div className="space-y-4">
              {/* Legal Basis (only for approved cases: ok == true) */}
              {parsedKantonCheck.ok && parsedKantonCheck.basis && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    Juridische Grondslag:
                  </h4>
                  <div className="text-sm text-gray-700 dark:text-gray-300" data-testid="text-legal-basis">
                    <div className="space-y-1">
                      {parsedKantonCheck.basis.grond && (
                        <div><strong>Type:</strong> {parsedKantonCheck.basis.grond}</div>
                      )}
                      {parsedKantonCheck.basis.belang_eur && (
                        <div><strong>Claimbedrag:</strong> €{parsedKantonCheck.basis.belang_eur.toLocaleString()}</div>
                      )}
                      {parsedKantonCheck.basis.bijzondere_regel && (
                        <div><strong>Bijzondere regel:</strong> {parsedKantonCheck.basis.bijzondere_regel}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Rationale (for rejected cases: reason == "not_kantonzaak") */}
              {!parsedKantonCheck.ok && parsedKantonCheck.reason === 'not_kantonzaak' && parsedKantonCheck.rationale && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Waarom niet geschikt:</h4>
                  <p className="text-sm text-red-700 dark:text-red-300" data-testid="text-rationale">
                    {parsedKantonCheck.rationale}
                  </p>
                </div>
              )}

              {/* Questions as Input Fields (for insufficient_info cases: reason == "insufficient_info") */}
              {parsedKantonCheck.reason === 'insufficient_info' && parsedKantonCheck.questions && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Beantwoord de volgende vragen:</h4>
                  <div className="space-y-4">
                    {parsedKantonCheck.questions.map((question: any, index: number) => {
                      const questionText = typeof question === 'string' ? question : question.label || JSON.stringify(question);
                      return (
                        <div key={index} className="space-y-2" data-testid={`question-input-${index}`}>
                          <Label htmlFor={`question-${index}`} className="text-sm font-medium">
                            {questionText}
                          </Label>
                          <Textarea
                            id={`question-${index}`}
                            placeholder="Typ uw antwoord hier..."
                            value={questionAnswers[index] || ''}
                            onChange={(e) => handleQuestionChange(index, e.target.value)}
                            className="min-h-[80px]"
                            data-testid={`textarea-answer-${index}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  
                  <Button 
                    onClick={handleSubmitAnswers}
                    disabled={isSubmittingAnswers || Object.keys(questionAnswers).length === 0}
                    className="w-full"
                    data-testid="button-submit-answers"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmittingAnswers ? 'Verzenden...' : 'Antwoorden Verzenden'}
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex gap-2">
              {parsedKantonCheck.ok ? (
                <Button 
                  className="flex-1" 
                  data-testid="button-start-full-analysis"
                  onClick={() => {
                    if (onFullAnalyze) {
                      onFullAnalyze();
                    } else {
                      alert('Volledige analyse functionaliteit nog niet beschikbaar');
                    }
                  }}
                  disabled={isFullAnalyzing}
                >
                  {isFullAnalyzing ? 'Volledige analyse wordt uitgevoerd...' : 'Start Volledige Analyse'}
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

      {/* Full Analysis Results - Show when available */}
      {fullAnalysis && (
        <>
          {/* Gestructureerde MindStudio Analyse */}
          {(() => {
            // Parse MindStudio structured output from rawText
            let mindstudioAnalysis = null;
            try {
              // FIRST: Check if parsedAnalysis is directly available (new enriched format from backend)
              if ((fullAnalysis as any).parsedAnalysis && typeof (fullAnalysis as any).parsedAnalysis === 'object') {
                mindstudioAnalysis = (fullAnalysis as any).parsedAnalysis;
              }
              // FALLBACK: Parse from rawText if not directly available
              else if (fullAnalysis.rawText) {
                const rawData = JSON.parse(fullAnalysis.rawText);
                
                // Try to get parsedAnalysis from rawText (old format)
                if (rawData.parsedAnalysis && typeof rawData.parsedAnalysis === 'object') {
                  mindstudioAnalysis = rawData.parsedAnalysis;
                }
                // Check if it's a MindStudio response with structured data
                else if (rawData.result && rawData.result.analysis_json) {
                  const resultValue = rawData.result.analysis_json;
                  // Skip if it's a MindStudio template string (contains {{ }})
                  if (typeof resultValue === 'string' && !resultValue.includes('{{')) {
                    mindstudioAnalysis = JSON.parse(resultValue);
                  }
                } else if (rawData.result && rawData.result.output) {
                  // Old format: data.result.output
                  const resultValue = rawData.result.output;
                  if (typeof resultValue === 'string' && !resultValue.includes('{{')) {
                    mindstudioAnalysis = JSON.parse(resultValue);
                  } else if (typeof resultValue === 'object') {
                    mindstudioAnalysis = resultValue;
                  }
                } else if (rawData.analysis_json) {
                  // Direct format: data.analysis_json
                  const resultValue = rawData.analysis_json;
                  if (typeof resultValue === 'string' && !resultValue.includes('{{')) {
                    mindstudioAnalysis = JSON.parse(resultValue);
                  } else if (typeof resultValue === 'object') {
                    mindstudioAnalysis = resultValue;
                  }
                }
              }
            } catch (error) {
              console.warn('Could not parse MindStudio structured output:', error);
            }

            return mindstudioAnalysis && caseId ? (
              <MindStudioAnalysis analysis={mindstudioAnalysis} caseId={caseId} />
            ) : (
              // Fallback to simple display for non-MindStudio or unstructured analyses
              <Card>
                <CardContent className="space-y-4 pt-6">
                  {fullAnalysis.factsJson && fullAnalysis.factsJson.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Feiten & Omstandigheden:</h4>
                      <ul className="space-y-1">
                        {fullAnalysis.factsJson.map((fact: any, index: number) => (
                          <li key={index} className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span data-testid={`text-full-analysis-fact-${index}`}>
                              {fact.label}: {fact.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {fullAnalysis.issuesJson && fullAnalysis.issuesJson.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Juridische Kwesties:</h4>
                      <ul className="space-y-1">
                        {fullAnalysis.issuesJson.map((issue: any, index: number) => (
                          <li key={index} className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span data-testid={`text-full-analysis-issue-${index}`}>
                              {issue.issue} {issue.risk && `(Risico: ${issue.risk})`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {fullAnalysis.legalBasisJson && fullAnalysis.legalBasisJson.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Rechtsgronden:</h4>
                      <ul className="space-y-1">
                        {fullAnalysis.legalBasisJson.map((basis: any, index: number) => (
                          <li key={index} className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span data-testid={`text-full-analysis-legal-${index}`}>
                              {basis.law} {basis.article && `- ${basis.article}`}
                              {basis.note && ` (${basis.note})`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </>
      )}
    </div>
  );
}