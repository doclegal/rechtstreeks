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

  // Missing items aggregator
  const buildMissingList = (data: any) => {
    const missing: any[] = [];

    // Top-level: parties, agreement, procedural
    if (data.parties?.needed === true) {
      missing.push({ id: 'parties', type: 'parties', title: 'Partijen (namen/rol)', reason: 'Namen/rol nodig voor juridische check' });
    }
    if (data.agreement?.needed === true) {
      missing.push({ id: 'agreement', type: 'agreement', title: 'Overeenkomst (type/contract)', reason: 'Type/contract of upload nodig' });
    }
    if (data.procedural?.needed === true) {
      missing.push({ id: 'procedural', type: 'procedural', title: 'Procedueel (spoed/forumkeuze)', reason: 'Geef spoed en forumkeuze aan' });
    }

    // Claims: iterate claims[] and include each where claim.needed === true
    if (data.claims && Array.isArray(data.claims)) {
      data.claims.forEach((claim: any, idx: number) => {
        if (claim.needed === true) {
          missing.push({
            id: `claim-${idx}`,
            type: 'claim',
            title: `Claim – ${claim.type || 'Onbekend'}`,
            reason: 'Specificeer bedrag/handelingen/juridische grondslag',
            claimIndex: idx
          });
        }
        // Fallback: if claim.needed === false but required subfields are null/empty
        else if (claim.needed === false || claim.needed === undefined) {
          const value = claim.value || {};
          const missingSubfields: string[] = [];
          if (!value.principal_eur) missingSubfields.push('bedrag');
          if (!value.what_to_perform) missingSubfields.push('te verrichten');
          if (!value.legal_basis) missingSubfields.push('rechtsgrond');
          
          if (missingSubfields.length > 0) {
            missing.push({
              id: `claim-${idx}`,
              type: 'claim',
              title: `Claim – ${claim.type || 'Onbekend'} (details)`,
              reason: `Ontbrekende details: ${missingSubfields.join(', ')}`,
              claimIndex: idx,
              isFallback: true
            });
          }
        }
      });
    }

    // needed_questions[]: include all entries
    if (data.needed_questions && Array.isArray(data.needed_questions)) {
      data.needed_questions.forEach((question: any) => {
        missing.push({
          id: question.id,
          type: 'question',
          title: question.label,
          reason: question.reason,
          question: question
        });
      });
    }

    return missing;
  };

  const countFilledFields = (data: any) => {
    let count = 0;
    if (data.summary) count++;
    if (data.case_type) count++;
    if (data.parties?.value?.claimant_name || data.parties?.value?.defendant_name) count++;
    if (data.agreement?.exists && data.agreement.exists !== 'onbekend') count++;
    if (data.claims?.length > 0) {
      data.claims.forEach((claim: any) => {
        if (claim.value?.principal_eur || claim.value?.what_to_perform || claim.value?.legal_basis) count++;
      });
    }
    if (data.facts?.timeline?.length > 0) count++;
    if (data.procedural?.value?.urgent !== null || data.procedural?.value?.forum_clause) count++;
    return count;
  };

  const handleSubmitFollowup = async () => {
    if (!onAnalyze || Object.keys(followupAnswers).length === 0) return;
    
    setIsSubmittingFollowup(true);
    try {
      // Call MindStudio with followup_answers according to spec
      // Note: This would need to be implemented to send followup_answers to the backend
      // The backend should then call MindStudio with:
      // {
      //   "input_case_details": "<existing>",
      //   "file_urls": ["<existing + new>"],
      //   "followup_answers": followupAnswers
      // }
      
      // For now, just re-run the regular analysis
      await onAnalyze();
      
      // Clear the answers after successful submission
      setFollowupAnswers({});
    } finally {
      setIsSubmittingFollowup(false);
    }
  };

  // Show triage format if available
  if (isTriageFormat) {
    const missingList = buildMissingList(triageData);
    const filledCount = countFilledFields(triageData);
    const missingCount = missingList.length;
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
                Nog ontbrekende informatie ({missingCount} items)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {missingList.map((item, idx) => (
                <div key={item.id} className="border border-orange-200 rounded-lg p-4 bg-white">
                  <div className="mb-3">
                    <h4 className="font-medium text-orange-800">Ontbreekt: {item.title}</h4>
                    <p className="text-sm text-orange-600">{item.reason}</p>
                  </div>
                  
                  {/* Parties inputs */}
                  {item.type === 'parties' && (
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
                  )}

                  {/* Agreement inputs */}
                  {item.type === 'agreement' && (
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
                  )}

                  {/* Procedural inputs */}
                  {item.type === 'procedural' && (
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
                  )}

                  {/* Claim inputs */}
                  {item.type === 'claim' && (
                    <div className="space-y-2">
                      <Input
                        type="number"
                        placeholder="Hoofdsom (EUR)"
                        value={followupAnswers[`claims.${item.claimIndex}.principal_eur`] || ""}
                        onChange={(e) => updateFollowupAnswer(`claims.${item.claimIndex}.principal_eur`, e.target.value)}
                        data-testid={`input-claim-amount-${item.claimIndex}`}
                      />
                      <Input
                        placeholder="Wat moet de wederpartij doen/nakomen?"
                        value={followupAnswers[`claims.${item.claimIndex}.what_to_perform`] || ""}
                        onChange={(e) => updateFollowupAnswer(`claims.${item.claimIndex}.what_to_perform`, e.target.value)}
                        data-testid={`input-claim-performance-${item.claimIndex}`}
                      />
                      <Input
                        placeholder="Juridische grondslag (artikelen/regels)"
                        value={followupAnswers[`claims.${item.claimIndex}.legal_basis`] || ""}
                        onChange={(e) => updateFollowupAnswer(`claims.${item.claimIndex}.legal_basis`, e.target.value)}
                        data-testid={`input-claim-legal-basis-${item.claimIndex}`}
                      />
                    </div>
                  )}

                  {/* Question inputs */}
                  {item.type === 'question' && (
                    <Textarea
                      placeholder="Uw antwoord..."
                      value={followupAnswers[item.id] || ""}
                      onChange={(e) => updateFollowupAnswer(item.id, e.target.value)}
                      data-testid={`textarea-question-${item.id}`}
                      className="min-h-20"
                    />
                  )}
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
              {missingList.some(item => item.id === 'parties') && (
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