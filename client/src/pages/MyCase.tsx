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
  const currentCase = cases?.[0];
  const caseId = currentCase?.id;

  const analyzeMutation = useAnalyzeCase(caseId || "");
  const letterMutation = useGenerateLetter(caseId || "");
  const bailiffMutation = useOrderBailiff(caseId || "");

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
      "ANALYZED": 3,
      "LETTER_DRAFTED": 4,
      "BAILIFF_ORDERED": 5,
      "SERVED": 6,
      "SUMMONS_DRAFTED": 6,
      "FILED": 7,
      "PROCEEDINGS_ONGOING": 8,
      "JUDGMENT": 9,
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
        label: "Start analyse",
        action: () => analyzeMutation.mutate()
      },
      "ANALYZED": {
        label: "Genereer brief",
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
    <div className="space-y-8">
      <DeadlineWarning caseId={currentCase.id} />
      
      {/* Hero Card */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          {/* Status Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div className="mb-4 lg:mb-0">
              <div className="flex items-center space-x-3 mb-2">
                <Badge className="bg-primary text-primary-foreground" data-testid="badge-current-step">
                  Stap {currentStepNumber} van 9
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Je zit nu bij: {currentCase.currentStep || "Indienen stukken"}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-case-title">
                {currentCase.title}
              </h1>
              <p className="text-muted-foreground mt-1" data-testid="text-case-description">
                {currentCase.description}
              </p>
            </div>
            
            <div className="flex flex-col items-start lg:items-end">
              <span className="text-sm text-muted-foreground mb-2">Volgende stap:</span>
              <Button 
                onClick={nextAction.action}
                disabled={nextAction.disabled || analyzeMutation.isPending || letterMutation.isPending || bailiffMutation.isPending}
                data-testid="button-next-action"
              >
                {analyzeMutation.isPending ? "Analyseren..." :
                 letterMutation.isPending ? "Brief genereren..." :
                 bailiffMutation.isPending ? "Deurwaarder inschakelen..." :
                 nextAction.label}
              </Button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <ProgressBar progress={currentCase.progress || 0} className="mb-6" />
          
          {/* Step Chips */}
          <StepChips 
            currentStep={currentStepNumber} 
            onStepClick={(step) => {
              setLocation(`/step/${step}`);
            }}
          />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" data-testid="tab-overview">Overzicht</TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents">Documenten</TabsTrigger>
              <TabsTrigger value="uitleg" data-testid="tab-explanation">Uitleg</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Missing Documents */}
              {missingDocs.length > 0 && (
                <MissingDocuments 
                  missingDocs={missingDocs}
                  caseId={currentCase.id}
                  onDocumentUploaded={() => refetch()}
                />
              )}

              {/* Analysis Results */}
              {console.log('Analysis data debug:', currentCase.analysis)}
              {currentCase.analysis ? (
                <AnalysisResults analysis={currentCase.analysis} />
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">
                      Nog geen analyse beschikbaar. Start een analyse in Stap 2.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Generated Documents */}
              <GeneratedDocuments 
                letters={currentCase.letters || []}
                summons={currentCase.summons || []}
                caseId={currentCase.id}
              />
            </TabsContent>
            
            <TabsContent value="documents" className="mt-6">
              <DocumentList 
                documents={currentCase.documents || []}
                caseId={currentCase.id}
                onDocumentUploaded={() => refetch()}
              />
            </TabsContent>
            
            <TabsContent value="uitleg" className="mt-6">
              <ProcessTimeline currentStep={currentStepNumber} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <CaseInfo 
            caseData={currentCase}
            onExport={() => {
              window.open(`/api/cases/${currentCase.id}/export`, '_blank');
            }}
            onEdit={() => {
              toast({
                title: "Bewerken",
                description: "Zaak bewerken functionaliteit wordt binnenkort toegevoegd",
              });
            }}
          />
        </div>
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
