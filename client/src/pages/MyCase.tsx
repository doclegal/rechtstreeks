import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useAnalyzeCase, useGenerateLetter, useOrderBailiff } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const missingDocs = currentCase.analysis?.missingDocsJson || [];

  return (
    <div className="space-y-6">
      <DeadlineWarning caseId={currentCase.id} />
      
      {/* Services Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Service 1: Analyse */}
        <div className="border rounded-lg p-4 bg-white dark:bg-gray-900">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-medium text-sm">Juridische Analyse</h3>
              <p className="text-xs text-muted-foreground">AI-analyse van je geschil</p>
            </div>
            <Badge variant={currentCase.analysis ? "default" : "secondary"} className="text-xs">
              {currentCase.analysis ? "Voltooid" : "Beschikbaar"}
            </Badge>
          </div>
          <Button 
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            size="sm"
            variant={currentCase.analysis ? "outline" : "default"}
            className="w-full"
          >
            {analyzeMutation.isPending ? "Analyseren..." : currentCase.analysis ? "Heranalyseren" : "Start analyse"}
          </Button>
        </div>

        {/* Service 2: Brief */}
        <div className="border rounded-lg p-4 bg-white dark:bg-gray-900">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-medium text-sm">Ingebrekestelling</h3>
              <p className="text-xs text-muted-foreground">Brief naar wederpartij</p>
            </div>
            <Badge variant={(currentCase.letters?.length || 0) > 0 ? "default" : "secondary"} className="text-xs">
              {(currentCase.letters?.length || 0) > 0 ? "Voltooid" : "Beschikbaar"}
            </Badge>
          </div>
          <Button 
            onClick={() => letterMutation.mutate()}
            disabled={letterMutation.isPending || !currentCase.analysis}
            size="sm"
            variant={(currentCase.letters?.length || 0) > 0 ? "outline" : "default"}
            className="w-full"
          >
            {letterMutation.isPending ? "Genereren..." : (currentCase.letters?.length || 0) > 0 ? "Nieuwe brief" : "Genereer brief"}
          </Button>
        </div>

        {/* Service 3: Dagvaarding */}
        <div className="border rounded-lg p-4 bg-white dark:bg-gray-900">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-medium text-sm">Dagvaarding</h3>
              <p className="text-xs text-muted-foreground">Rechtbank procedure (optioneel)</p>
            </div>
            <Badge variant={(currentCase.summons?.length || 0) > 0 ? "default" : "secondary"} className="text-xs">
              {(currentCase.summons?.length || 0) > 0 ? "Voltooid" : "Beschikbaar"}
            </Badge>
          </div>
          <Button 
            onClick={() => {
              toast({
                title: "Dagvaarding opstellen",
                description: "Deze functie wordt binnenkort beschikbaar gesteld",
              });
            }}
            disabled={!currentCase.analysis}
            size="sm"
            variant={(currentCase.summons?.length || 0) > 0 ? "outline" : "default"}
            className="w-full"
          >
            {(currentCase.summons?.length || 0) > 0 ? "Nieuwe dagvaarding" : "Opstellen dagvaarding"}
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
              <ProcessTimeline currentStep={1} />
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
