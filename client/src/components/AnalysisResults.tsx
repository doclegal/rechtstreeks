import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
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
  Euro,
  Upload,
  Check,
  X
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

  // Check for triage data in the parsed analysis
  const triageData = parsedAnalysis?.full_json || parsedAnalysis?.output_triage_flow || parsedAnalysis;
  const isTriageFormat = triageData && (triageData.case_type || triageData.summary || triageData.parties);

  // State for followup answers
  const [followupAnswers, setFollowupAnswers] = useState<Record<string, string>>({});
  const [isSubmittingFollowup, setIsSubmittingFollowup] = useState(false);

  // Helper functions
  const updateFollowupAnswer = (key: string, value: string) => {
    setFollowupAnswers(prev => ({ ...prev, [key]: value }));
  };

  const countFilledFields = (data: any) => {
    let count = 0;
    if (data.summary) count++;
    if (data.case_type) count++;
    if (data.parties?.value?.claimant_name || data.parties?.value?.defendant_name) count++;
    if (data.agreement?.exists !== 'onbekend') count++;
    if (data.claims?.length > 0) count++;
    if (data.facts?.timeline?.length > 0) count++;
    if (data.procedural?.value?.urgent !== null || data.procedural?.value?.forum_clause) count++;
    return count;
  };

  const countMissingFields = (data: any) => {
    let count = 0;
    if (data.parties?.needed) count++;
    if (data.agreement?.needed) count++;
    if (data.procedural?.needed) count++;
    if (data.claims?.some((c: any) => c.needed)) count += data.claims.filter((c: any) => c.needed).length;
    if (data.needed_questions?.length > 0) count += data.needed_questions.length;
    return count;
  };

  const handleSubmitFollowup = async () => {
    if (!onAnalyze || Object.keys(followupAnswers).length === 0) return;
    
    setIsSubmittingFollowup(true);
    try {
      // This would need to be implemented to call the analysis with followup_answers
      await onAnalyze(); // For now, just re-run analysis
    } finally {
      setIsSubmittingFollowup(false);
    }
  };

  // Show triage format if available
  if (isTriageFormat) {
    const filledCount = countFilledFields(triageData);
    const missingCount = countMissingFields(triageData);
    const isIntakeComplete = missingCount === 0;

    return (
      <div className="space-y-6">
        {/* A. Header strip */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-green-800 mb-1">
                Eerste juridische triage voltooid
              </h2>
              <p className="text-sm text-green-700">
                Dit is de eerste analyse: hieronder zie je het zaaktype, een samenvatting en wat nog ontbreekt.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {triageData.case_type && (
                <Badge variant="secondary" className="text-sm font-medium" data-testid="badge-case-type">
                  {triageData.case_type}
                </Badge>
              )}
              {triageData.confidence && (
                <Badge variant="outline" className="text-sm" data-testid="badge-confidence">
                  {Math.round(triageData.confidence * 100)}% zekerheid
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* B. Summary card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Samenvatting</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4" data-testid="text-summary">
              {triageData.summary || "Geen samenvatting beschikbaar"}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {triageData.case_type || "Onbekend type"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {triageData.confidence ? `${Math.round(triageData.confidence * 100)}% zekerheid` : "Onbekende zekerheid"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* C. Completeness chips row */}
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <Badge variant="default" className="bg-green-100 text-green-800">
            <Check className="w-3 h-3 mr-1" />
            Ingevuld: {filledCount} velden
          </Badge>
          <Badge variant={missingCount > 0 ? "destructive" : "default"} className={missingCount === 0 ? "bg-green-100 text-green-800" : ""}>
            {missingCount > 0 ? (
              <AlertTriangle className="w-3 h-3 mr-1" />
            ) : (
              <Check className="w-3 h-3 mr-1" />
            )}
            {missingCount > 0 ? `Ontbreekt: ${missingCount} items` : "Compleet"}
          </Badge>
        </div>

        {/* Green completion callout */}
        {isIntakeComplete && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Intake compleet — klaar voor juridische beoordeling.</span>
            </div>
          </div>
        )}

        {/* D. Missing information (prominent section) */}
        {missingCount > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Nog ontbrekende informatie
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Missing parties */}
              {triageData.parties?.needed && (
                <div className="border border-orange-200 rounded-lg p-4 bg-white">
                  <div className="mb-3">
                    <h4 className="font-medium text-orange-800">Ontbreekt: Partijen (namen/rol)</h4>
                    <p className="text-sm text-orange-600">Namen/rol nodig voor juridische check</p>
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="Naam eiser"
                      value={followupAnswers["parties.claimant_name"] || ""}
                      onChange={(e) => updateFollowupAnswer("parties.claimant_name", e.target.value)}
                      data-testid="input-claimant-name"
                    />
                    <Input
                      placeholder="Naam verweerder"
                      value={followupAnswers["parties.defendant_name"] || ""}
                      onChange={(e) => updateFollowupAnswer("parties.defendant_name", e.target.value)}
                      data-testid="input-defendant-name"
                    />
                    <Input
                      placeholder="Relatie (bijv. huurder-verhuurder)"
                      value={followupAnswers["parties.relationship"] || ""}
                      onChange={(e) => updateFollowupAnswer("parties.relationship", e.target.value)}
                      data-testid="input-relationship"
                    />
                  </div>
                </div>
              )}

              {/* Missing agreement */}
              {triageData.agreement?.needed && (
                <div className="border border-orange-200 rounded-lg p-4 bg-white">
                  <div className="mb-3">
                    <h4 className="font-medium text-orange-800">Ontbreekt: Overeenkomst (type/contract)</h4>
                    <p className="text-sm text-orange-600">Type/contract of upload nodig</p>
                  </div>
                  <div className="space-y-2">
                    <Select
                      value={followupAnswers["agreement.exists"] || ""}
                      onValueChange={(value) => updateFollowupAnswer("agreement.exists", value)}
                    >
                      <SelectTrigger data-testid="select-agreement-type">
                        <SelectValue placeholder="Selecteer type overeenkomst" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="schriftelijk">Schriftelijk</SelectItem>
                        <SelectItem value="mondeling">Mondeling</SelectItem>
                        <SelectItem value="geen">Geen</SelectItem>
                        <SelectItem value="onbekend">Onbekend</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 p-2 border border-dashed border-gray-300 rounded">
                      <Upload className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">Contract upload (nog niet geïmplementeerd)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Missing procedural */}
              {triageData.procedural?.needed && (
                <div className="border border-orange-200 rounded-lg p-4 bg-white">
                  <div className="mb-3">
                    <h4 className="font-medium text-orange-800">Ontbreekt: Procedueel (spoed/forumkeuze)</h4>
                    <p className="text-sm text-orange-600">Geef spoed en forumkeuze aan</p>
                  </div>
                  <div className="space-y-2">
                    <Select
                      value={followupAnswers["procedural.urgent"] || ""}
                      onValueChange={(value) => updateFollowupAnswer("procedural.urgent", value)}
                    >
                      <SelectTrigger data-testid="select-urgent">
                        <SelectValue placeholder="Is dit spoedeisend?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ja">Ja</SelectItem>
                        <SelectItem value="nee">Nee</SelectItem>
                        <SelectItem value="onbekend">Onbekend</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Forumkeuze (bepaling of 'geen')"
                      value={followupAnswers["procedural.forum_clause"] || ""}
                      onChange={(e) => updateFollowupAnswer("procedural.forum_clause", e.target.value)}
                      data-testid="input-forum-clause"
                    />
                  </div>
                </div>
              )}

              {/* Missing questions */}
              {triageData.needed_questions?.map((question: any, idx: number) => (
                <div key={idx} className="border border-orange-200 rounded-lg p-4 bg-white">
                  <div className="mb-3">
                    <h4 className="font-medium text-orange-800">{question.label}</h4>
                    <p className="text-sm text-orange-600">Waarom: {question.reason}</p>
                  </div>
                  <Textarea
                    placeholder="Uw antwoord..."
                    value={followupAnswers[question.id] || ""}
                    onChange={(e) => updateFollowupAnswer(question.id, e.target.value)}
                    data-testid={`textarea-question-${idx}`}
                    className="min-h-20"
                  />
                </div>
              ))}

              {/* Submit button */}
              {Object.keys(followupAnswers).length > 0 && (
                <div className="pt-4 border-t border-orange-200">
                  <Button
                    onClick={handleSubmitFollowup}
                    disabled={isSubmittingFollowup}
                    className="w-full"
                    data-testid="button-submit-followup"
                  >
                    {isSubmittingFollowup ? (
                      <>
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                        Analyseren...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Ontbrekende info indienen
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* E. Detailed sections (below Missing info) */}
        
        {/* Partijen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5" />
              Partijen
              {triageData.parties?.needed && (
                <Badge variant="destructive" className="text-xs">
                  <X className="w-3 h-3 mr-1" />
                  Ontbreekt
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div data-testid="party-claimant">
                <p className="font-medium">Eiser</p>
                <p className="text-gray-600">{triageData.parties?.value?.claimant_name || "(onbekend)"}</p>
              </div>
              <div data-testid="party-defendant">
                <p className="font-medium">Verweerder</p>
                <p className="text-gray-600">{triageData.parties?.value?.defendant_name || "(onbekend)"}</p>
              </div>
              <div data-testid="party-relationship">
                <p className="font-medium">Relatie</p>
                <p className="text-gray-600">{triageData.parties?.value?.relationship || "(onbekend)"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claims */}
        {triageData.claims && Array.isArray(triageData.claims) && triageData.claims.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Euro className="w-5 h-5" />
                Vorderingen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {triageData.claims.map((claim: any, idx: number) => (
                <div key={idx} className="border rounded p-3 space-y-2" data-testid={`detailed-claim-${idx}`}>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" data-testid={`detailed-claim-type-${idx}`}>
                      {claim.type || 'Onbekend type'}
                    </Badge>
                    {claim.confidence && (
                      <Badge variant="outline" className="text-xs">
                        {Math.round(claim.confidence * 100)}%
                      </Badge>
                    )}
                    {claim.needed && (
                      <Badge variant="destructive" className="text-xs">
                        <X className="w-3 h-3 mr-1" />
                        Ontbreekt
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <p data-testid={`detailed-claim-amount-${idx}`}>
                      <span className="font-medium">Bedrag:</span> {claim.value?.principal_eur ? `€ ${claim.value.principal_eur.toLocaleString()}` : "–"}
                    </p>
                    <p data-testid={`detailed-claim-performance-${idx}`}>
                      <span className="font-medium">Te verrichten:</span> {claim.value?.what_to_perform || "–"}
                    </p>
                    <p data-testid={`detailed-claim-legal-basis-${idx}`}>
                      <span className="font-medium">Rechtsgrond:</span> {claim.value?.legal_basis || "–"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Euro className="w-5 h-5" />
                Vorderingen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500" data-testid="no-claims">
                Geen vorderingen gedetecteerd.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Ruwe data (ontwikkelaars) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5" />
              Ruwe data (ontwikkelaars)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <details className="cursor-pointer">
              <summary className="text-sm font-medium mb-2">Klik om JSON data te tonen</summary>
              <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap" data-testid="detailed-raw-json">
                {JSON.stringify(triageData, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Legacy format fallback
  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-blue-700 flex items-center gap-2">
            <Scale className="w-5 h-5" />
            Juridische Analyse
          </CardTitle>
        </CardHeader>
        <CardContent>
          {onAnalyze && (
            <Button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              variant="default"
              className="w-full"
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
                  Start juridische analyse
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-green-700 flex items-center gap-2">
            <Scale className="w-5 h-5" />
            Analyse Resultaten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap">
            {analysis.rawText || "Geen resultaten beschikbaar"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}