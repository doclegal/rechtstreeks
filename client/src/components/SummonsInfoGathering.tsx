import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Loader2, Sparkles, HelpCircle, Upload, FileText } from "lucide-react";

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
  
  // User responses for missing items
  const [missingItemResponses, setMissingItemResponses] = useState<Record<number, {
    uploadedDocId?: string;
    dontHave: boolean;
  }>>({});
  
  // User "don't know" flags for questions
  const [questionDontKnow, setQuestionDontKnow] = useState<Record<number, boolean>>({});
  
  // Selected claim options
  const [selectedClaims, setSelectedClaims] = useState<Set<number>>(new Set());

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

  // Upload mutation for missing items
  const uploadMutation = useMutation({
    mutationFn: async ({ file, itemIndex }: { file: File; itemIndex: number }) => {
      const formData = new FormData();
      formData.append('files', file);

      const response = await fetch(`/api/cases/${caseId}/uploads`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      return { docId: result.documents?.[0]?.id, itemIndex };
    },
    onSuccess: (data) => {
      setMissingItemResponses(prev => ({
        ...prev,
        [data.itemIndex]: {
          uploadedDocId: data.docId,
          dontHave: false
        }
      }));
      toast({
        title: "Bestand geüpload",
        description: "Het document is succesvol toegevoegd.",
      });
    },
    onError: () => {
      toast({
        title: "Upload mislukt",
        description: "Er ging iets mis bij het uploaden. Probeer opnieuw.",
        variant: "destructive",
      });
    },
  });

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
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Informatie verzamelen
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Klik op "Volledig maken" om te controleren of alle benodigde informatie voor de dagvaarding aanwezig is. 
                  {readinessResult && !readinessResult.ready_for_summons && " Beantwoord de vragen hieronder om door te gaan."}
                </p>
                
                {/* Status badges */}
                {readinessResult && !readinessResult.ready_for_summons && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {readinessResult.dv_missing_items.length > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-200 text-orange-900 dark:bg-orange-900 dark:text-orange-200">
                        {readinessResult.dv_missing_items.length} ontbrekende {readinessResult.dv_missing_items.length === 1 ? 'item' : 'items'}
                      </span>
                    )}
                    {readinessResult.dv_clarifying_questions.length > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200">
                        {readinessResult.dv_clarifying_questions.length} {readinessResult.dv_clarifying_questions.length === 1 ? 'vraag' : 'vragen'}
                      </span>
                    )}
                    {readinessResult.dv_claim_options.length > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-200">
                        {readinessResult.dv_claim_options.length} {readinessResult.dv_claim_options.length === 1 ? 'vordering' : 'vorderingen'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Missing Items - upload or mark as don't have */}
            {readinessResult && !readinessResult.ready_for_summons && readinessResult.dv_missing_items.length > 0 && (
              <div className="space-y-3 pt-4">
                <Label className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                  Ontbrekende informatie
                </Label>
                <div className="space-y-3">
                  {readinessResult.dv_missing_items.map((missingItem, idx) => {
                    const response = missingItemResponses[idx];
                    const isUploaded = !!response?.uploadedDocId;
                    const isDontHave = !!response?.dontHave;
                    
                    return (
                      <div key={idx} className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm font-semibold">{missingItem.item}</Label>
                            {missingItem.why_needed && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {missingItem.why_needed}
                              </p>
                            )}
                          </div>
                          
                          {!isDontHave && !isUploaded && (
                            <div className="flex gap-2">
                              <Input
                                type="file"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    uploadMutation.mutate({ file, itemIndex: idx });
                                  }
                                }}
                                accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                                data-testid={`input-upload-missing-${idx}`}
                                disabled={uploadMutation.isPending}
                              />
                            </div>
                          )}
                          
                          {isUploaded && (
                            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Document geüpload</span>
                            </div>
                          )}
                          
                          {isDontHave && (
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                              <AlertCircle className="h-4 w-4" />
                              <span>Gemarkeerd als "Heb ik niet"</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`dont-have-${idx}`}
                              checked={isDontHave}
                              onCheckedChange={(checked) => {
                                setMissingItemResponses(prev => ({
                                  ...prev,
                                  [idx]: {
                                    dontHave: !!checked,
                                    uploadedDocId: undefined
                                  }
                                }));
                              }}
                              data-testid={`checkbox-dont-have-${idx}`}
                            />
                            <Label htmlFor={`dont-have-${idx}`} className="text-sm cursor-pointer">
                              Heb ik niet
                            </Label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
              </div>
            )}

            {/* Claim Options - select requested relief */}
            {readinessResult && !readinessResult.ready_for_summons && readinessResult.dv_claim_options.length > 0 && (
              <div className="space-y-3 pt-4">
                <Label className="text-sm font-semibold text-green-900 dark:text-green-100">
                  Selecteer vorderingen
                </Label>
                <p className="text-xs text-muted-foreground">
                  Kies één of meerdere vorderingen die u wilt opnemen in de dagvaarding.
                </p>
                <div className="space-y-2">
                  {readinessResult.dv_claim_options.map((claim, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-green-200 dark:border-green-800">
                      <Checkbox
                        id={`claim-${idx}`}
                        checked={selectedClaims.has(idx)}
                        onCheckedChange={(checked) => {
                          setSelectedClaims(prev => {
                            const newSet = new Set(prev);
                            if (checked) {
                              newSet.add(idx);
                            } else {
                              newSet.delete(idx);
                            }
                            return newSet;
                          });
                        }}
                        data-testid={`checkbox-claim-${idx}`}
                      />
                      <Label htmlFor={`claim-${idx}`} className="text-sm cursor-pointer flex-1">
                        {claim}
                      </Label>
                    </div>
                  ))}
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
