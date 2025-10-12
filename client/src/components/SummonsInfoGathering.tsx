import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

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

export function SummonsInfoGathering({ caseId, templateId }: SummonsInfoGatheringProps) {
  const { toast } = useToast();
  const [sections, setSections] = useState<SectionsState>({});
  const [loadingSection, setLoadingSection] = useState<string | null>(null);

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
  // The API returns the analysis directly (not nested in analysisJson)
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

  const caseSubject = caseOverview.summary || caseOverview.title || "Niet beschikbaar";
  const claimantName = claimant.name || "Eiser onbekend";
  const defendantName = defendant.name || "Gedaagde onbekend";
  const legalDomain = legalIssues.length > 0 
    ? legalIssues.map((issue: any) => typeof issue === 'string' ? issue : (issue.area || issue.category || issue)).filter(Boolean).join(", ")
    : "Niet gespecificeerd";

  // MindStudio flow configurations
  const flowConfigs = {
    feiten: { flowName: "DV_Feiten.flow", displayName: "Feiten" },
    verweer: { flowName: "DV_Verweer.flow", displayName: "Verweer" },
    verloop: { flowName: "DV_Verloop.flow", displayName: "Verloop geschil" },
    rechtsgronden: { flowName: "DV_Rechtsgronden.flow", displayName: "Rechtsgronden" },
    vorderingen: { flowName: "DV_Vorderingen.flow", displayName: "Vorderingen" },
    slot: { flowName: "DV_Slot.flow", displayName: "Slot" },
    producties: { flowName: "DV_Producties.flow", displayName: "Producties" },
  };

  const runFlowMutation = useMutation({
    mutationFn: async ({ sectionKey, flowName }: { sectionKey: string; flowName: string }) => {
      setLoadingSection(sectionKey);
      
      // Call MindStudio flow
      const response = await apiRequest("POST", `/api/mindstudio/run-flow`, {
        flowName,
        caseId,
        // Add any additional context needed by the flow
      });

      const data = await response.json();
      return { sectionKey, data };
    },
    onSuccess: ({ sectionKey, data }) => {
      // Expected JSON structure from MindStudio:
      // {
      //   "summary": "Samenvatting van de sectie inhoud...",
      //   "user_feedback": [
      //     { "question": "Vraag 1?", "answer": "" },
      //     { "question": "Vraag 2?", "answer": "" }
      //   ]
      // }
      
      setSections(prev => ({
        ...prev,
        [sectionKey]: {
          summary: data.summary || "",
          user_feedback: data.user_feedback || [],
        },
      }));
      
      setLoadingSection(null);
      
      toast({
        title: "Sectie voltooid",
        description: `${flowConfigs[sectionKey as keyof typeof flowConfigs].displayName} is succesvol ingevuld.`,
      });
    },
    onError: (error: any) => {
      setLoadingSection(null);
      toast({
        title: "Fout",
        description: error.message || "Er ging iets mis bij het starten van de flow.",
        variant: "destructive",
      });
    },
  });

  const handleRunFlow = (sectionKey: keyof typeof flowConfigs) => {
    const config = flowConfigs[sectionKey];
    runFlowMutation.mutate({ sectionKey, flowName: config.flowName });
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

      {/* Info message */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Informatie verzamelen
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Klik op "Volledig maken" bij elke sectie om de benodigde informatie te verzamelen. 
                Vul daarna de vragen in die verschijnen.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      {Object.entries(flowConfigs).map(([sectionKey, config]) => {
        const sectionData = sections[sectionKey as keyof SectionsState];
        const isCompleted = !!sectionData?.summary;
        const isLoading = loadingSection === sectionKey;

        return (
          <Card key={sectionKey} data-testid={`card-section-${sectionKey}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>{config.displayName}</CardTitle>
                  {isCompleted && (
                    <CheckCircle2 className="h-5 w-5 text-green-600" data-testid={`icon-completed-${sectionKey}`} />
                  )}
                </div>
                {!isCompleted && (
                  <Button 
                    onClick={() => handleRunFlow(sectionKey as keyof typeof flowConfigs)}
                    disabled={isLoading}
                    data-testid={`button-complete-${sectionKey}`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Bezig...
                      </>
                    ) : (
                      "Volledig maken"
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            
            {sectionData && (
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
            )}
          </Card>
        );
      })}

      {/* Submit button - only show when all sections are completed */}
      {Object.keys(flowConfigs).every(key => sections[key as keyof SectionsState]?.summary) && (
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
