import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Loader2, Sparkles, HelpCircle } from "lucide-react";

interface SummonsInfoGatheringProps {
  caseId: string;
  templateId: string;
}

interface SectionData {
  summary?: string;
  user_feedback?: Array<{
    question: string;
    answer: string;
  }>;
}

interface SectionsState {
  feiten?: SectionData;
  verweer?: SectionData;
  verloop?: SectionData;
  rechtsgronden?: SectionData;
  vorderingen?: SectionData;
  slot?: SectionData;
  producties?: SectionData;
}

interface ClarifyingQuestion {
  question: string;
  reason: string;
  expected_evidence: string[];
}

interface MissingItem {
  item: string;
  why_needed: string;
  priority: string;
}

interface ReadinessResult {
  ready_for_summons: boolean;
  next_flow: string;
  dv_missing_items: MissingItem[];
  dv_claim_options: any[];
  dv_evidence_plan: any;
  dv_clarifying_questions: ClarifyingQuestion[];
  dv_question_text: string;
}

export function SummonsInfoGathering({ caseId, templateId }: SummonsInfoGatheringProps) {
  const { toast } = useToast();
  const [sections, setSections] = useState<SectionsState>({});
  const [isCheckingReadiness, setIsCheckingReadiness] = useState(false);
  const [isGeneratingComplete, setIsGeneratingComplete] = useState(false);
  const [readinessResult, setReadinessResult] = useState<ReadinessResult | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});

  // Fetch case analysis for summary
  const { data: analysis } = useQuery<any>({
    queryKey: ["/api/cases", caseId, "analysis"],
    queryFn: async () => {
      const response = await fetch(`/api/cases/${caseId}/analysis`);
      if (!response.ok) throw new Error("Failed to fetch analysis");
      return response.json();
    },
    enabled: !!caseId,
  });

  // Extract summary info from analysis
  const caseOverview = analysis?.case_overview || {};
  const legalAnalysis = analysis?.legal_analysis || {};
  
  // Parties can be either an array or an object
  const partiesArray = Array.isArray(caseOverview.parties) ? caseOverview.parties : [];
  const claimant = partiesArray.find((p: any) => p.role === 'claimant') || 
                   caseOverview.parties?.claimant || {};
  const defendant = partiesArray.find((p: any) => p.role === 'respondent' || p.role === 'defendant') || 
                    caseOverview.parties?.defendant || {};
  
  const legalIssues = Array.isArray(legalAnalysis.legal_issues) 
    ? legalAnalysis.legal_issues 
    : (typeof legalAnalysis.legal_issues === 'string' ? [legalAnalysis.legal_issues] : []);

  // Try multiple sources for case subject
  const caseSubject = 
    caseOverview.summary || 
    caseOverview.title || 
    analysis?.summary?.facts_brief ||
    analysis?.summary?.legal_brief ||
    "Niet beschikbaar";
  const claimantName = claimant.name || "Eiser onbekend";
  const defendantName = defendant.name || "Gedaagde onbekend";
  const legalDomain = legalIssues.length > 0 
    ? legalIssues.map((issue: any) => typeof issue === 'string' ? issue : (issue.area || issue.category || issue)).filter(Boolean).join(", ")
    : "Niet gespecificeerd";

  // Section display names
  const sectionDisplayNames = {
    feiten: "Feiten",
    verweer: "Verweer",
    verloop: "Verloop geschil",
    rechtsgronden: "Rechtsgronden",
    vorderingen: "Vorderingen",
    slot: "Slot",
    producties: "Producties",
  };

  // Step 1: Check readiness with DV_Questions.flow
  const checkReadinessMutation = useMutation({
    mutationFn: async () => {
      setIsCheckingReadiness(true);
      
      const response = await apiRequest("POST", `/api/mindstudio/run-questions-flow`, {
        caseId
      });

      const data = await response.json();
      return data as ReadinessResult;
    },
    onSuccess: (data) => {
      setReadinessResult(data);
      setIsCheckingReadiness(false);
      
      if (data.ready_for_summons) {
        // Directly proceed to DV_Complete.flow with the next_flow from response
        toast({
          title: "Zaak is compleet",
          description: "Alle benodigde informatie is aanwezig. Dagvaarding wordt nu gegenereerd...",
        });
        // Pass next_flow and answers directly to avoid stale state
        runCompleteFlowMutation.mutate({ 
          nextFlow: data.next_flow, 
          userAnswers: {} 
        });
      } else {
        // Show clarifying questions
        toast({
          title: "Aanvullende informatie nodig",
          description: `${data.dv_missing_items.length} items ontbreken. Beantwoord de vragen hieronder.`,
        });
      }
    },
    onError: (error: any) => {
      setIsCheckingReadiness(false);
      toast({
        title: "Fout bij readiness check",
        description: error.message || "Er ging iets mis bij het controleren van de zaak.",
        variant: "destructive",
      });
    },
  });

  // Step 2: Run complete flow with answers
  const runCompleteFlowMutation = useMutation({
    mutationFn: async (params?: { nextFlow?: string; userAnswers?: Record<string, string> }) => {
      setIsGeneratingComplete(true);
      
      // Use passed params or fallback to state
      const flowName = params?.nextFlow || readinessResult?.next_flow || "DV_Complete.flow";
      const answers = params?.userAnswers || questionAnswers;
      
      const payload: any = {
        caseId,
        flowName
      };
      
      if (Object.keys(answers).length > 0) {
        payload.userAnswers = answers;
      }
      
      const response = await apiRequest("POST", `/api/mindstudio/run-complete-flow`, payload);

      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      setSections(data);
      setIsGeneratingComplete(false);
      
      // Reset all state after successful generation
      setQuestionAnswers({});
      setReadinessResult(null);
      
      toast({
        title: "Dagvaarding gegenereerd",
        description: "Alle secties zijn succesvol ingevuld.",
      });
    },
    onError: (error: any) => {
      setIsGeneratingComplete(false);
      toast({
        title: "Fout",
        description: error.message || "Er ging iets mis bij het genereren van de dagvaarding.",
        variant: "destructive",
      });
    },
  });

  const handleStartWorkflow = () => {
    // Start with readiness check
    checkReadinessMutation.mutate();
  };

  const handleProceedWithAnswers = () => {
    // User has answered questions, now run complete flow with answers
    if (readinessResult) {
      // Snapshot answers at click time to prevent stale data during mutation
      const answersSnapshot = { ...questionAnswers };
      runCompleteFlowMutation.mutate({ 
        nextFlow: readinessResult.next_flow, 
        userAnswers: answersSnapshot 
      });
    }
  };

  const handleAnswerChange = (sectionKey: string, questionIndex: number, answer: string) => {
    setSections(prev => {
      const section = prev[sectionKey as keyof SectionsState];
      if (!section?.user_feedback) return prev;

      const updatedFeedback = [...section.user_feedback];
      updatedFeedback[questionIndex] = {
        ...updatedFeedback[questionIndex],
        answer,
      };

      return {
        ...prev,
        [sectionKey]: {
          ...section,
          user_feedback: updatedFeedback,
        },
      };
    });
  };

  const allSectionsCompleted = Object.keys(sectionDisplayNames).every(
    key => sections[key as keyof SectionsState]?.summary
  );

  return (
    <div className="space-y-6">
      {/* Case Summary */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle>Overzicht Zaak</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-sm font-semibold text-muted-foreground">Onderwerp geschil</Label>
            <p className="text-base mt-1" data-testid="text-case-subject">{caseSubject}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold text-muted-foreground">Eiser</Label>
              <p className="text-base mt-1" data-testid="text-claimant-name">{claimantName}</p>
            </div>
            <div>
              <Label className="text-sm font-semibold text-muted-foreground">Gedaagde</Label>
              <p className="text-base mt-1" data-testid="text-defendant-name">{defendantName}</p>
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold text-muted-foreground">Rechtsgebied</Label>
            <p className="text-base mt-1" data-testid="text-legal-domain">{legalDomain}</p>
          </div>
        </CardContent>
      </Card>

      {/* Info message and Complete button */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
        <CardContent className="py-6">
          <div className="space-y-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Informatie verzamelen
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Klik op "Volledig maken" om te controleren of alle benodigde informatie voor de dagvaarding aanwezig is. 
                  {readinessResult && !readinessResult.ready_for_summons && " Beantwoord de vragen hieronder om door te gaan."}
                </p>
              </div>
            </div>

            {/* Show missing items if available */}
            {readinessResult && !readinessResult.ready_for_summons && readinessResult.dv_missing_items.length > 0 && (
              <div className="bg-orange-100 dark:bg-orange-950 p-3 rounded-lg">
                <Label className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-2 block">
                  Ontbrekende informatie
                </Label>
                <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                  {readinessResult.dv_missing_items.map((missingItem, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-orange-600 dark:text-orange-400">•</span>
                      <span>
                        <strong>{missingItem.item}</strong>
                        {missingItem.why_needed && (
                          <span className="text-xs block text-orange-700 dark:text-orange-300 mt-0.5">
                            ({missingItem.why_needed})
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Show clarifying questions */}
            {readinessResult && !readinessResult.ready_for_summons && readinessResult.dv_clarifying_questions.length > 0 && (
              <div className="space-y-4 pt-2">
                <Label className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Beantwoord de volgende vragen:
                </Label>
                {readinessResult.dv_clarifying_questions.map((q, idx) => (
                  <div key={idx} className="space-y-2">
                    <Label className="text-sm flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-blue-600" />
                      {q.question}
                    </Label>
                    {q.reason && (
                      <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">
                        ({q.reason})
                      </p>
                    )}
                    <Textarea
                      value={questionAnswers[`question_${idx}`] || ""}
                      onChange={(e) => setQuestionAnswers(prev => ({ ...prev, [`question_${idx}`]: e.target.value }))}
                      placeholder="Uw antwoord..."
                      className="min-h-[80px]"
                      data-testid={`input-clarifying-${idx}`}
                    />
                    {q.expected_evidence && q.expected_evidence.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Verwacht bewijs: {q.expected_evidence.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
                
                <div className="flex justify-center pt-2">
                  <Button 
                    onClick={handleProceedWithAnswers}
                    disabled={isGeneratingComplete}
                    size="lg"
                    className="gap-2"
                    data-testid="button-proceed-with-answers"
                  >
                    {isGeneratingComplete ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Dagvaarding wordt gegenereerd...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Doorgaan naar genereren
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Initial button - only show when no readiness check done yet */}
            {!readinessResult && !allSectionsCompleted && (
              <div className="flex justify-center pt-2">
                <Button 
                  onClick={handleStartWorkflow}
                  disabled={isCheckingReadiness || isGeneratingComplete}
                  size="lg"
                  className="gap-2"
                  data-testid="button-complete-all"
                >
                  {isCheckingReadiness ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Zaak wordt gecontroleerd...
                    </>
                  ) : isGeneratingComplete ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Dagvaarding wordt gegenereerd...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Volledig maken
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sections - only show when data is available */}
      {Object.keys(sections).length > 0 && (
        <>
          <div className="pt-4">
            <h3 className="text-lg font-semibold mb-4">Verzamelde informatie</h3>
          </div>

          {Object.entries(sectionDisplayNames).map(([sectionKey, displayName]) => {
            const sectionData = sections[sectionKey as keyof SectionsState];
            
            if (!sectionData) return null;

            return (
              <Card key={sectionKey} data-testid={`card-section-${sectionKey}`}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CardTitle>{displayName}</CardTitle>
                    {sectionData.summary && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" data-testid={`icon-completed-${sectionKey}`} />
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Summary */}
                  {sectionData.summary && (
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <Label className="text-sm font-semibold mb-2 block">Samenvatting</Label>
                      <p className="text-sm whitespace-pre-wrap" data-testid={`text-summary-${sectionKey}`}>
                        {sectionData.summary}
                      </p>
                    </div>
                  )}

                  {/* User Feedback Questions */}
                  {sectionData.user_feedback && sectionData.user_feedback.length > 0 && (
                    <div className="space-y-4">
                      <Label className="text-sm font-semibold">Aanvullende vragen</Label>
                      {sectionData.user_feedback.map((item, index) => (
                        <div key={index} className="space-y-2">
                          <Label className="text-sm">{item.question}</Label>
                          <Textarea
                            value={item.answer}
                            onChange={(e) => handleAnswerChange(sectionKey, index, e.target.value)}
                            placeholder="Uw antwoord..."
                            className="min-h-[80px]"
                            data-testid={`input-feedback-${sectionKey}-${index}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {/* Submit button - only show when all sections are completed */}
      {allSectionsCompleted && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950">
          <CardContent className="py-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <h4 className="text-lg font-semibold text-green-900 dark:text-green-100">
                  Alle informatie verzameld
                </h4>
              </div>
              <p className="text-sm text-green-800 dark:text-green-200">
                U heeft alle secties voltooid. U kunt nu de dagvaarding samenstellen.
              </p>
              <Button size="lg" className="mt-4" data-testid="button-assemble-summons">
                Dagvaarding samenstellen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
