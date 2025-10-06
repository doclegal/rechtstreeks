import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useAnalyzeCase, useFullAnalyzeCase } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AnalysisResults from "@/components/AnalysisResults";
import { Link } from "wouter";
import { ArrowLeft, FileSearch, Scale } from "lucide-react";

export default function Analysis() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: cases, isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const [kantonCheckResult, setKantonCheckResult] = useState<any>(null);
  
  const currentCase = Array.isArray(cases) && cases.length > 0 ? cases[0] : undefined;
  const caseId = currentCase?.id;

  const analyzeMutation = useAnalyzeCase(caseId || "");
  const fullAnalyzeMutation = useFullAnalyzeCase(caseId || "");

  useEffect(() => {
    if (analyzeMutation.isSuccess && analyzeMutation.data) {
      if (analyzeMutation.data.kantonCheck) {
        setKantonCheckResult(analyzeMutation.data.kantonCheck);
      }
      setTimeout(() => {
        refetch();
      }, 500);
    }
  }, [analyzeMutation.isSuccess, analyzeMutation.data, refetch]);

  useEffect(() => {
    if (fullAnalyzeMutation.isSuccess) {
      setTimeout(() => {
        refetch();
      }, 500);
    }
  }, [fullAnalyzeMutation.isSuccess, refetch]);

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
              Eerste zaak starten
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <FileSearch className="h-8 w-8 text-primary" />
            Analyse
          </h1>
          <p className="text-muted-foreground">
            Juridische analyse en kanton check voor uw zaak
          </p>
        </div>
      </div>

      {/* Case Context Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Zaak: {currentCase.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Wederpartij:</span>{" "}
              <span className="font-medium">{currentCase.counterpartyName}</span>
            </div>
            {currentCase.claimAmount && (
              <div>
                <span className="text-muted-foreground">Bedrag:</span>{" "}
                <span className="font-medium">€ {currentCase.claimAmount}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Section */}
      {currentCase.analysis || currentCase.fullAnalysis ? (
        <AnalysisResults 
          analysis={currentCase.kantonAnalysis || currentCase.analysis}
          fullAnalysis={currentCase.fullAnalysis}
          kantonCheck={kantonCheckResult}
          onAnalyze={() => analyzeMutation.mutate()}
          isAnalyzing={analyzeMutation.isPending}
          hasNewInfo={(() => {
            const relevantAnalysis = currentCase.kantonAnalysis || currentCase.analysis;
            if (!relevantAnalysis || !currentCase.updatedAt) return false;
            if (analyzeMutation.isPending) return false;
            if (analyzeMutation.isSuccess) return false;
            
            const caseUpdated = new Date(currentCase.updatedAt);
            const analysisCreated = new Date(relevantAnalysis.createdAt);
            const timeDiff = caseUpdated.getTime() - analysisCreated.getTime();
            return timeDiff > 1000;
          })()}
          caseId={currentCase.id}
          onFullAnalyze={() => fullAnalyzeMutation.mutate()}
          isFullAnalyzing={fullAnalyzeMutation.isPending}
        />
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileSearch className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Nog geen analyse uitgevoerd
              </h3>
              <p className="text-muted-foreground mb-6">
                Upload eerst documenten bij "Mijn Zaak" en voer een analyse uit.
              </p>
              <Button asChild data-testid="button-go-to-case">
                <Link href="/my-case">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Naar Mijn Zaak
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
