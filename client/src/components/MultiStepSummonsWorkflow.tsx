import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, FileText, AlertCircle, Download } from "lucide-react";

type SectionStatus = "pending" | "generating" | "ready_for_review" | "approved" | "rejected";

interface SummonsSection {
  id: string;
  sectionKey: string;
  status: SectionStatus;
  generatedText?: string;
  userFeedback?: string;
}

interface MultiStepSummonsWorkflowProps {
  caseId: string;
  summonsId: string;
  templateId: string;
}

const SECTION_LABELS: Record<string, string> = {
  VORDERINGEN: "1. Vorderingen",
  FEITEN: "2. Feiten",
  RECHTSGRONDEN: "3. Rechtsgronden",
  VERLOOP: "4. Verloop van de Zaak",
  VERWEER: "5. Verweer",
  PETITUM: "6. Petitum",
  PRODUCTIES_SAMENVATTING: "7. Producties (Samenvatting)"
};

const SECTION_ORDER = [
  "VORDERINGEN",
  "FEITEN",
  "RECHTSGRONDEN",
  "VERLOOP",
  "VERWEER",
  "PETITUM",
  "PRODUCTIES_SAMENVATTING"
];

export function MultiStepSummonsWorkflow({ caseId, summonsId, templateId }: MultiStepSummonsWorkflowProps) {
  const { toast } = useToast();
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});

  // Fetch sections status
  const { data: sections, isLoading: sectionsLoading } = useQuery<SummonsSection[]>({
    queryKey: ["/api/cases", caseId, "summons", summonsId, "sections"],
    refetchInterval: (query) => {
      // Auto-refresh while any section is generating
      const data = query.state.data;
      const isGenerating = data?.some((s: SummonsSection) => s.status === "generating");
      return isGenerating ? 2000 : false;
    }
  });

  // Generate section mutation
  const generateSectionMutation = useMutation({
    mutationFn: async (sectionKey: string) => {
      const response = await apiRequest("POST", `/api/cases/${caseId}/summons/${summonsId}/sections/${sectionKey}/generate`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate section");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "summons", summonsId, "sections"] });
      toast({
        title: "Sectie wordt gegenereerd",
        description: "De AI is bezig met het genereren van de tekst...",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Genereren mislukt",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Approve section mutation
  const approveSectionMutation = useMutation({
    mutationFn: async (sectionKey: string) => {
      const response = await apiRequest("POST", `/api/cases/${caseId}/summons/${summonsId}/sections/${sectionKey}/approve`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to approve section");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "summons", summonsId, "sections"] });
      toast({
        title: "Sectie goedgekeurd",
        description: "De sectie is goedgekeurd en toegevoegd aan de dagvaarding.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Goedkeuren mislukt",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Reject section mutation
  const rejectSectionMutation = useMutation({
    mutationFn: async ({ sectionKey, feedback }: { sectionKey: string; feedback: string }) => {
      const response = await apiRequest("POST", `/api/cases/${caseId}/summons/${summonsId}/sections/${sectionKey}/reject`, {
        feedback
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reject section");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "summons", summonsId, "sections"] });
      setFeedbackText(prev => ({ ...prev, [variables.sectionKey]: "" }));
      toast({
        title: "Sectie afgekeurd",
        description: "De sectie wordt opnieuw gegenereerd met uw feedback.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Afkeuren mislukt",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Assemble final document mutation
  const assembleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/cases/${caseId}/summons/${summonsId}/assemble`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to assemble document");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "summons-v2"] });
      toast({
        title: "Dagvaarding samengesteld",
        description: "De volledige dagvaarding is klaar en kan worden gedownload.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Samenstellen mislukt",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}/summons-v2/${summonsId}/pdf`);
      if (!response.ok) throw new Error("Failed to download PDF");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dagvaarding-${caseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "PDF gedownload",
        description: "De dagvaarding is gedownload als PDF",
      });
    } catch (error) {
      toast({
        title: "Download mislukt",
        description: error instanceof Error ? error.message : "Onbekende fout",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: SectionStatus) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Te genereren</Badge>;
      case "generating":
        return <Badge variant="outline"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Genereren...</Badge>;
      case "ready_for_review":
        return <Badge variant="default" className="bg-yellow-500">Te beoordelen</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Goedgekeurd</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Afgekeurd</Badge>;
      default:
        return null;
    }
  };

  const allApproved = sections && sections.every(s => s.status === "approved");
  const hasRejected = sections && sections.some(s => s.status === "rejected");

  if (sectionsLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">Secties laden...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Overview */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                7-Stappen Dagvaarding Proces
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                Elke sectie wordt stap voor stap door AI gegenereerd. U kunt elke sectie goedkeuren of afkeuren met feedback voor verbetering.
              </p>
              <div className="grid grid-cols-7 gap-2">
                {SECTION_ORDER.map((sectionKey, idx) => {
                  const section = sections?.find(s => s.sectionKey === sectionKey);
                  const status = section?.status || "pending";
                  return (
                    <div 
                      key={sectionKey} 
                      className={`h-2 rounded-full transition-colors ${
                        status === "approved" ? "bg-green-600" :
                        status === "ready_for_review" ? "bg-yellow-500" :
                        status === "generating" ? "bg-blue-500 animate-pulse" :
                        status === "rejected" ? "bg-red-600" :
                        "bg-gray-300 dark:bg-gray-700"
                      }`}
                      title={`Stap ${idx + 1}: ${status}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      {SECTION_ORDER.map((sectionKey, idx) => {
        const section = sections?.find(s => s.sectionKey === sectionKey);
        if (!section) return null;

        return (
          <Card key={section.id} data-testid={`section-card-${sectionKey}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {SECTION_LABELS[sectionKey] || sectionKey}
                </CardTitle>
                {getStatusBadge(section.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Generate Button */}
              {(section.status === "pending" || section.status === "rejected") && (
                <Button
                  onClick={() => generateSectionMutation.mutate(sectionKey)}
                  disabled={generateSectionMutation.isPending}
                  data-testid={`button-generate-${sectionKey}`}
                >
                  {generateSectionMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Genereren...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      {section.status === "rejected" ? "Opnieuw genereren" : "Genereer sectie"}
                    </>
                  )}
                </Button>
              )}

              {/* Generated Text Preview */}
              {section.generatedText && (
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Gegenereerde tekst:</h4>
                  <div className="text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {section.generatedText}
                  </div>
                </div>
              )}

              {/* Review Actions */}
              {section.status === "ready_for_review" && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => approveSectionMutation.mutate(sectionKey)}
                    disabled={approveSectionMutation.isPending}
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    data-testid={`button-approve-${sectionKey}`}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Goedkeuren
                  </Button>
                  <div className="flex-1 flex gap-2">
                    <Textarea
                      placeholder="Optionele feedback voor verbetering..."
                      value={feedbackText[sectionKey] || ""}
                      onChange={(e) => setFeedbackText(prev => ({ ...prev, [sectionKey]: e.target.value }))}
                      className="flex-1 min-h-[40px] h-[40px]"
                      data-testid={`input-feedback-${sectionKey}`}
                    />
                    <Button
                      onClick={() => rejectSectionMutation.mutate({ sectionKey, feedback: feedbackText[sectionKey] || "" })}
                      disabled={rejectSectionMutation.isPending}
                      variant="destructive"
                      data-testid={`button-reject-${sectionKey}`}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Afkeuren
                    </Button>
                  </div>
                </div>
              )}

              {/* Previous Feedback Display */}
              {section.userFeedback && section.status === "rejected" && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 p-3 rounded-lg">
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Uw feedback:</p>
                      <p className="text-sm text-amber-800 dark:text-amber-200">{section.userFeedback}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Final Assembly Button */}
      {allApproved && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950">
          <CardContent className="py-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">
                  Alle secties goedgekeurd!
                </h3>
                <p className="text-green-800 dark:text-green-200 mb-4">
                  U kunt nu de volledige dagvaarding samenstellen en downloaden als PDF.
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => assembleMutation.mutate()}
                  disabled={assembleMutation.isPending}
                  size="lg"
                  data-testid="button-assemble-final"
                >
                  {assembleMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Samenstellen...
                    </>
                  ) : (
                    <>
                      <FileText className="h-5 w-5 mr-2" />
                      Dagvaarding samenstellen
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  variant="outline"
                  size="lg"
                  data-testid="button-download-pdf-final"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
