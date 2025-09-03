import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useAnalyzeCase, useGenerateLetter, useOrderBailiff } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProgressBar from "@/components/ProgressBar";
import StepChips from "@/components/StepChips";
import MissingDocuments from "@/components/MissingDocuments";
import DocumentList from "@/components/DocumentList";
import AnalysisResults from "@/components/AnalysisResults";
import GeneratedDocuments from "@/components/GeneratedDocuments";
import ProcessTimeline from "@/components/ProcessTimeline";
import CaseInfo from "@/components/CaseInfo";
import DeadlineWarning from "@/components/DeadlineWarning";
import { Link, useLocation } from "wouter";
import { PlusCircle, Headset, MessageSquare, ArrowLeft } from "lucide-react";

export default function MyCase() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: cases, isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // For MVP, we'll use the first case as the main case
  const currentCase = cases && cases.length > 0 ? cases[0] : undefined;
  const caseId = currentCase?.id;

  const analyzeMutation = useAnalyzeCase(caseId || "");
  const letterMutation = useGenerateLetter(caseId || "");
  const bailiffMutation = useOrderBailiff(caseId || "");

  // Refresh case data after successful analysis
  useEffect(() => {
    if (analyzeMutation.isSuccess) {
      // Small delay to ensure DB is updated before refetch
      setTimeout(() => {
        refetch();
      }, 500);
    }
  }, [analyzeMutation.isSuccess, refetch]);

  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [user, authLoading, toast]);

  const getStepNumber = (status: string): number => {
    const stepMap: Record<string, number> = {
      "NEW_INTAKE": 1,
      "DOCS_UPLOADED": 2,
      "ANALYZED": 2, // Keep same step - analysis happens on overview
      "LETTER_DRAFTED": 3, // Move up from 4 to 3
      "BAILIFF_ORDERED": 4, // Move up from 5 to 4
      "SERVED": 5, // Move up from 6 to 5
      "SUMMONS_DRAFTED": 5, // Keep same as SERVED
      "FILED": 6, // Move up from 7 to 6
      "PROCEEDINGS_ONGOING": 7, // Move up from 8 to 7
      "JUDGMENT": 8, // Move up from 9 to 8
    };
    return stepMap[status] || 1;
  };

  const getNextAction = (status: string) => {
    const actionMap: Record<string, { label: string; action: () => void; disabled?: boolean }> = {
      "NEW_INTAKE": {
        label: "Upload je documenten",
        action: () => {/* Document upload will be handled by MissingDocuments component */}
      },
      "DOCS_UPLOADED": {
        label: "Genereer ingebrekestelling",
        action: () => letterMutation.mutate(),
        disabled: !currentCase.analysis
      },
      "ANALYZED": {
        label: "Genereer ingebrekestelling", 
        action: () => letterMutation.mutate()
      },
      "LETTER_DRAFTED": {
        label: "Inschakelen deurwaarder",
        action: () => bailiffMutation.mutate()
      },
      "BAILIFF_ORDERED": {
        label: "Wacht op betekening",
        action: () => {},
        disabled: true
      },
      "SERVED": {
        label: "Dossier aanbrengen bij rechtbank",
        action: () => {
          toast({
            title: "Mock functionaliteit",
            description: "Rechtbank integratie wordt gesimuleerd",
          });
        }
      },
      "FILED": {
        label: "Start procedure",
        action: () => {
          toast({
            title: "Mock functionaliteit", 
            description: "Procedure start wordt gesimuleerd",
          });
        }
      },
      "PROCEEDINGS_ONGOING": {
        label: "Upload vonnis",
        action: () => {/* Document upload */}
      },
      "JUDGMENT": {
        label: "Nieuwe zaak starten",
        action: () => window.location.href = "/new-case"
      }
    };
    
    return actionMap[status] || actionMap["NEW_INTAKE"];
  };

  if (authLoading || casesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  if (!currentCase) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">Geen actieve zaak</h2>
          <p className="text-muted-foreground mb-6">
            U heeft nog geen zaak aangemaakt. Begin met het opstarten van uw eerste juridische zaak.
          </p>
          <Button asChild size="lg" data-testid="button-create-first-case">
            <Link href="/new-case">
              <PlusCircle className="mr-2 h-5 w-5" />
              Eerste zaak starten
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentStepNumber = getStepNumber(currentCase.status);
  const nextAction = getNextAction(currentCase.status);
  const missingDocs = currentCase.analysis?.missingDocsJson || [];

  return (
    <div className="space-y-6">
      <DeadlineWarning caseId={currentCase.id} />
      
      {/* Compact Progress Header */}
      <div className="bg-white dark:bg-gray-900 border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="text-xs" data-testid="badge-current-step">
              Stap {currentStepNumber}/8
            </Badge>
            <div className="flex-1 min-w-48">
              <ProgressBar progress={currentCase.progress || 0} className="h-2" />
            </div>
          </div>
          
          <Button 
            onClick={nextAction.action}
            disabled={nextAction.disabled || analyzeMutation.isPending || letterMutation.isPending || bailiffMutation.isPending}
            size="sm"
            data-testid="button-next-action"
          >
            {analyzeMutation.isPending ? "Analyseren..." :
             letterMutation.isPending ? "Brief genereren..." :
             bailiffMutation.isPending ? "Deurwaarder inschakelen..." :
             nextAction.label}
          </Button>
        </div>
      </div>

      {/* Main Content - Full Width */}
      <div className="space-y-6">
        <Tabs defaultValue="mijn-zaak" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="mijn-zaak" data-testid="tab-case-details">Mijn zaak</TabsTrigger>
            <TabsTrigger value="analysis" data-testid="tab-analysis">Juridische analyse</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-generated-documents">Gegenereerde documenten</TabsTrigger>
            <TabsTrigger value="uitleg" data-testid="tab-explanation">Uitleg</TabsTrigger>
          </TabsList>
            
            <TabsContent value="mijn-zaak" className="mt-6">
              <div className="space-y-6">
                <CaseInfo 
                  caseData={currentCase}
                  onExport={() => {
                    window.open(`/api/cases/${currentCase.id}/export`, '_blank');
                  }}
                  onEdit={() => {
                    setLocation(`/edit-case/${currentCase.id}`);
                  }}
                  isFullWidth={true}
                />
                
                {/* Documents Section */}
                <DocumentList 
                  documents={currentCase.documents || []}
                  caseId={currentCase.id}
                  onDocumentUploaded={() => refetch()}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="analysis" className="space-y-6 mt-6">
              {/* Missing Documents */}
              {missingDocs.length > 0 && (
                <MissingDocuments 
                  missingDocs={missingDocs}
                  caseId={currentCase.id}
                  onDocumentUploaded={() => refetch()}
                />
              )}

              {/* Analysis Results - Always show with analyze button */}
              <AnalysisResults 
                analysis={currentCase.analysis}
                onAnalyze={() => analyzeMutation.mutate()}
                isAnalyzing={analyzeMutation.isPending}
                hasNewInfo={(() => {
                  // Check if case was updated after the last analysis
                  if (!currentCase.analysis || !currentCase.updatedAt) return false;
                  
                  // If analysis is currently running, don't show as having new info
                  if (analyzeMutation.isPending) return false;
                  
                  // If we just successfully analyzed, don't show new info for a moment
                  if (analyzeMutation.isSuccess) return false;
                  
                  const caseUpdated = new Date(currentCase.updatedAt);
                  const analysisCreated = new Date(currentCase.analysis.createdAt);
                  
                  // Analysis is outdated if case was updated after analysis creation (with 1 second buffer)
                  const timeDiff = caseUpdated.getTime() - analysisCreated.getTime();
                  return timeDiff > 1000; // 1 second buffer to account for timing differences
                })()}
              />
            </TabsContent>
            
            <TabsContent value="documents" className="space-y-6 mt-6">
              {/* Generated Documents */}
              <GeneratedDocuments 
                letters={currentCase.letters || []}
                summons={currentCase.summons || []}
                caseId={currentCase.id}
              />
            </TabsContent>
            
            <TabsContent value="uitleg" className="mt-6">
              <ProcessTimeline currentStep={currentStepNumber} />
            </TabsContent>
          </Tabs>
      </div>

      {/* Secondary Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 pt-8 border-t border-border">
        <Link href="/new-case" className="text-muted-foreground hover:text-foreground text-sm font-medium" data-testid="link-new-case-secondary">
          <PlusCircle className="inline mr-2 h-4 w-4" />
          Nieuwe zaak starten
        </Link>
        
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" data-testid="button-contact-support">
            <Headset className="mr-2 h-4 w-4" />
            Contact opnemen
          </Button>
          <span className="text-muted-foreground">|</span>
          <Button variant="ghost" size="sm" data-testid="button-feedback">
            <MessageSquare className="mr-2 h-4 w-4" />
            Feedback geven
          </Button>
        </div>
      </div>
    </div>
  );
}
