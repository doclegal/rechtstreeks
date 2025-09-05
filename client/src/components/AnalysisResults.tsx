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

  // State for followup answers and attachments
  const [followupAnswers, setFollowupAnswers] = useState<Record<string, string>>({});
  const [isSubmittingFollowup, setIsSubmittingFollowup] = useState(false);
  const [attachmentMarkers, setAttachmentMarkers] = useState<string[]>([]);

  // Helper functions
  const updateFollowupAnswer = (key: string, value: string) => {
    setFollowupAnswers(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = (item: any, file: File) => {
    // Extract short excerpt from file (mock implementation)
    const fileName = file.name;
    const fileSize = Math.round(file.size / 1024);
    const excerpt = `${fileName} (${fileSize}KB)`;
    
    // Create attachment marker
    const attachmentMarker = `[Attachment] ${fileName} — ${excerpt}`;
    
    // Add to attachment markers array
    setAttachmentMarkers(prev => [...prev, attachmentMarker]);
    
    // Stage answer for agreement if it's an agreement file
    if (item.type === 'agreement') {
      updateFollowupAnswer('agreement.attachment_note', fileName);
    }
  };

  // Robust Missing Information aggregator
  const buildMissingList = (data: any) => {
    const missing: any[] = [];

    // 1a) Top-level objects with .needed === true: parties, agreement, procedural
    if (data.parties?.needed === true) {
      missing.push({ id: 'parties', type: 'parties', title: 'Partijen (namen/rol)', reason: 'Namen/rol nodig voor juridische check' });
    }
    if (data.agreement?.needed === true) {
      missing.push({ id: 'agreement', type: 'agreement', title: 'Overeenkomst (type/contract)', reason: 'Type/contract of upload nodig' });
    }
    if (data.procedural?.needed === true) {
      missing.push({ id: 'procedural', type: 'procedural', title: 'Procedueel (spoed/forumkeuze)', reason: 'Geef spoed en forumkeuze aan' });
    }

    // 1b) For each claim where claims[i].needed === true
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
      });
    }

    // 1c) needed_questions[] (with default_questions[] as fallback)
    const questions = data.needed_questions || data.default_questions || [];
    if (Array.isArray(questions)) {
      questions.forEach((question: any) => {
        missing.push({
          id: question.id,
          type: 'question',
          title: question.label,
          reason: question.reason,
          question: question
        });
      });
    }

    // Fallback rules: surface missing items even if .needed === false
    
    // agreement.exists is null/empty OR equals "onbekend"
    if (!missing.some(item => item.id === 'agreement')) {
      const agreementExists = data.agreement?.exists;
      if (!agreementExists || agreementExists === 'onbekend') {
        missing.push({ 
          id: 'agreement', 
          type: 'agreement', 
          title: 'Overeenkomst (type/contract)', 
          reason: 'Type/contract of upload nodig',
          isFallback: true
        });
      }
    }

    // procedural.value.urgent is null/empty/"onbekend" OR procedural.value.forum_clause is null/empty
    if (!missing.some(item => item.id === 'procedural')) {
      const proceduralValue = data.procedural?.value || {};
      const urgentMissing = !proceduralValue.urgent || proceduralValue.urgent === 'onbekend';
      const forumMissing = !proceduralValue.forum_clause;
      
      if (urgentMissing || forumMissing) {
        missing.push({
          id: 'procedural',
          type: 'procedural', 
          title: 'Procedueel (spoed/forumkeuze)',
          reason: 'Geef spoed en forumkeuze aan',
          isFallback: true
        });
      }
    }

    // any claim's principal_eur / what_to_perform / legal_basis is null/empty
    if (data.claims && Array.isArray(data.claims)) {
      data.claims.forEach((claim: any, idx: number) => {
        if (!missing.some(item => item.id === `claim-${idx}`)) {
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

    // any timeline entry has date === null → create synthetic question id
    if (data.facts?.timeline && Array.isArray(data.facts.timeline)) {
      data.facts.timeline.forEach((entry: any, idx: number) => {
        if (!entry.date) {
          missing.push({
            id: `facts.timeline.${idx}.date`,
            type: 'timeline-date',
            title: `Tijdlijn item ${idx + 1} - datum ontbreekt`,
            reason: 'Datum nodig voor chronologische volgorde',
            timelineIndex: idx,
            isFallback: true
          });
        }
      });
    }

    return missing;
  };

  // Deterministic "Ingevuld: X" calculation - treat "onbekend" as missing
  const computeFilledRequiredFields = (data: any, inputCaseDetails?: string) => {
    let count = 0;
    
    // parties: claimant_name, defendant_name, relationship (3)
    if (data.parties?.value?.claimant_name && data.parties.value.claimant_name !== 'onbekend') count++;
    if (data.parties?.value?.defendant_name && data.parties.value.defendant_name !== 'onbekend') count++;
    if (data.parties?.value?.relationship && data.parties.value.relationship !== 'onbekend') count++;
    
    // agreement: exists (1) and if schriftelijk, require attachment marker (adds 1)
    if (data.agreement?.exists && data.agreement.exists !== 'onbekend') {
      count++;
      if (data.agreement.exists === 'schriftelijk') {
        // Check for [Attachment] marker in input_case_details
        if (inputCaseDetails && inputCaseDetails.includes('[Attachment]')) {
          count++;
        }
      }
    }
    
    // procedural: urgent, forum_clause (2)
    if (data.procedural?.value?.urgent && data.procedural.value.urgent !== 'onbekend') count++;
    if (data.procedural?.value?.forum_clause && data.procedural.value.forum_clause !== 'onbekend') count++;
    
    // Per claim: principal_eur, what_to_perform, legal_basis (3 per claim)
    if (data.claims && Array.isArray(data.claims)) {
      data.claims.forEach((claim: any) => {
        if (claim.value?.principal_eur && claim.value.principal_eur !== 'onbekend') count++;
        if (claim.value?.what_to_perform && claim.value.what_to_perform !== 'onbekend') count++;
        if (claim.value?.legal_basis && claim.value.legal_basis !== 'onbekend') count++;
      });
    }
    
    return count;
  };

  // Format Euro amounts in Dutch locale
  const formatEuro = (amount: number | null | undefined) => {
    if (!amount) return "–";
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Get confidence style based on thresholds
  const getConfidenceStyle = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    if (percentage >= 80) return { variant: "default" as const, className: "bg-green-100 text-green-800" };
    if (percentage >= 60) return { variant: "secondary" as const, className: "bg-yellow-100 text-yellow-800" };
    return { variant: "outline" as const, className: "bg-gray-100 text-gray-600" };
  };

  const handleSubmitFollowup = async () => {
    if (!onAnalyze || (Object.keys(followupAnswers).length === 0 && attachmentMarkers.length === 0)) return;
    
    setIsSubmittingFollowup(true);
    try {
      // Submit with input_case_details + attachment markers and followup_answers
      // This mimics appending [Attachment] markers to the original case details
      // and sending followup_answers for structured fields
      
      // For now, just re-run the regular analysis
      // In real implementation, this would send:
      // {
      //   input_case_details: "<original text>" + "\n\n" + attachmentMarkers.join("\n"),
      //   followup_answers: followupAnswers
      // }
      await onAnalyze();
      
      // Clear the answers and attachments after successful submission
      setFollowupAnswers({});
      setAttachmentMarkers([]);
    } finally {
      setIsSubmittingFollowup(false);
    }
  };

  // Show triage format if available
  if (isTriageFormat) {
    const missingList = buildMissingList(triageData);
    const filledCount = computeFilledRequiredFields(triageData);
    const missingCount = missingList.length;
    const isIntakeComplete = missingCount === 0;
    const confidenceStyle = triageData.confidence ? getConfidenceStyle(triageData.confidence) : null;

    return (
      <div className="space-y-6">
        {/* Kantonrechter suitability banner */}
        {triageData.jurisdiction && (
          <Card className={`border-2 ${
            triageData.jurisdiction.kanton_geschikt === 'ja' ? 'border-green-500 bg-green-50' :
            triageData.jurisdiction.kanton_geschikt === 'onzeker' ? 'border-yellow-500 bg-yellow-50' :
            'border-red-500 bg-red-50'
          }`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Kantonrechter: 
                <Badge variant={
                  triageData.jurisdiction.kanton_geschikt === 'ja' ? 'default' :
                  triageData.jurisdiction.kanton_geschikt === 'onzeker' ? 'secondary' :
                  'destructive'
                } className={
                  triageData.jurisdiction.kanton_geschikt === 'ja' ? 'bg-green-600 hover:bg-green-700' :
                  triageData.jurisdiction.kanton_geschikt === 'onzeker' ? 'bg-yellow-600 hover:bg-yellow-700' :
                  'bg-red-600 hover:bg-red-700'
                }>
                  {triageData.jurisdiction.kanton_geschikt}
                </Badge>
                <Badge variant="outline">
                  {Math.round(triageData.jurisdiction.confidence * 100)}%
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm" data-testid="jurisdiction-reason">
                {triageData.jurisdiction.reason}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Summary card (plain) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Samenvatting</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4" data-testid="text-summary">
              {triageData.summary || "Samenvatting niet beschikbaar."}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {triageData.case_type || "Onbekend type"}
              </Badge>
              {triageData.confidence && confidenceStyle && (
                <Badge 
                  variant={confidenceStyle.variant} 
                  className={`text-xs ${confidenceStyle.className}`}
                >
                  {Math.round(triageData.confidence * 100)}% zekerheid
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parties card */}
        {triageData.parties && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Partijen
                {triageData.parties.needed && (
                  <Badge variant="destructive" className="text-xs">
                    Ontbreekt
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="font-medium">Eiser:</span>
                  <span data-testid="parties-claimant">
                    {triageData.parties.value?.claimant_name || "–"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Verweerder:</span>
                  <span data-testid="parties-defendant">
                    {triageData.parties.value?.defendant_name || "–"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Relatie:</span>
                  <span data-testid="parties-relationship">
                    {triageData.parties.value?.relationship || "–"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Claims card */}
        {triageData.claims && Array.isArray(triageData.claims) && triageData.claims.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Vorderingen ({triageData.claims.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {triageData.claims.map((claim: any, idx: number) => (
                  <div key={`claim-display-${idx}`} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {claim.type || 'Onbekend'}
                      </Badge>
                      {claim.confidence && (
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(claim.confidence * 100)}%
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">Bedrag:</span>
                        <span>{formatEuro(claim.value?.principal_eur)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Te verrichten:</span>
                        <span className="text-right">{claim.value?.what_to_perform || "–"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Rechtsgrond:</span>
                        <span className="text-right">{claim.value?.legal_basis || "–"}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between font-semibold">
                    <span>Totaal belang:</span>
                    <span data-testid="claims-total">
                      {formatEuro(triageData.claims.reduce((sum: number, claim: any) => 
                        sum + (claim.value?.principal_eur || 0), 0
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Green completion callout with next-step CTA */}
        {isIntakeComplete && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Intake compleet — klaar voor juridische beoordeling.</span>
              </div>
              <Button 
                variant="default" 
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-start-legal-review"
              >
                Juridische beoordeling starten
              </Button>
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
                <div key={`missing-${item.id}-${idx}`} className="border border-orange-200 rounded-lg p-4 bg-white">
                  <div className="mb-3">
                    <h4 className="font-medium text-orange-800">{item.title}</h4>
                    <p className="text-sm text-orange-600">Waarom: {item.reason}</p>
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

                  {/* Timeline date inputs */}
                  {item.type === 'timeline-date' && (
                    <Input
                      type="date"
                      placeholder="Datum (YYYY-MM-DD)"
                      value={followupAnswers[item.id] || ""}
                      onChange={(e) => updateFollowupAnswer(item.id, e.target.value)}
                      data-testid={`input-timeline-date-${item.timelineIndex}`}
                    />
                  )}
                </div>
              ))}

              {/* Submit button */}
              {(Object.keys(followupAnswers).length > 0 || attachmentMarkers.length > 0) && (
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
                      <span className="font-medium">Bedrag:</span> {formatEuro(claim.value?.principal_eur)}
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