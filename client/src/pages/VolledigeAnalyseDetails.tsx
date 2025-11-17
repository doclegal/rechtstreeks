import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FileSearch, CheckCircle, AlertTriangle, Info, Lightbulb } from "lucide-react";
import { useActiveCase } from "@/contexts/CaseContext";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function VolledigeAnalyseDetails() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const currentCase = useActiveCase();
  const caseId = currentCase?.id;

  const successChanceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/cases/${caseId}/full-analyze`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: "Volledige analyse uitgevoerd",
        description: "De RKOS analyse is succesvol voltooid",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij analyse",
        description: error.message || "Kon RKOS analyse niet uitvoeren",
        variant: "destructive",
      });
    },
  });

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

  let succesKansAnalysis = null;
  
  if ((currentCase?.fullAnalysis as any)?.succesKansAnalysis) {
    succesKansAnalysis = (currentCase.fullAnalysis as any).succesKansAnalysis;
  }

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
            U heeft nog geen zaak aangemaakt.
          </p>
          <Button asChild size="lg" data-testid="button-create-first-case">
            <Link href="/new-case">Eerste zaak starten</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setLocation("/analysis")}
        className="mb-2"
        data-testid="button-back-to-analysis"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Terug naar Analyse
      </Button>

      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Volledige analyse</h2>
          <p className="text-muted-foreground">{currentCase.title}</p>
        </div>

        {succesKansAnalysis ? (
          <div className="space-y-6">
            {succesKansAnalysis.assessment && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSearch className="h-5 w-5 text-primary" />
                    Beoordeling
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed" data-testid="text-success-assessment">
                    {succesKansAnalysis.assessment}
                  </p>
                </CardContent>
              </Card>
            )}

            {succesKansAnalysis.strengths && succesKansAnalysis.strengths.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    Sterke punten
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {succesKansAnalysis.strengths.map((strength: any, idx: number) => (
                      <div key={idx} className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4">
                        {typeof strength === 'string' ? (
                          <p className="text-sm leading-relaxed">{strength}</p>
                        ) : (
                          <>
                            <p className="text-sm font-medium mb-1">{strength.point}</p>
                            {strength.why_it_matters && (
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {strength.why_it_matters}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {succesKansAnalysis.weaknesses && succesKansAnalysis.weaknesses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    Zwakke punten
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {succesKansAnalysis.weaknesses.map((weakness: any, idx: number) => (
                      <div key={idx} className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4">
                        {typeof weakness === 'string' ? (
                          <p className="text-sm leading-relaxed">{weakness}</p>
                        ) : (
                          <>
                            <p className="text-sm font-medium mb-1">{weakness.point}</p>
                            {weakness.why_it_matters && (
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {weakness.why_it_matters}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {succesKansAnalysis.missing_elements && succesKansAnalysis.missing_elements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Ontbrekende elementen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {succesKansAnalysis.missing_elements.map((element: any, idx: number) => (
                      <div key={idx} className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
                        {typeof element === 'string' ? (
                          <p className="text-sm leading-relaxed">{element}</p>
                        ) : (
                          <>
                            <p className="text-sm font-medium mb-1">
                              {element.item || element.point}
                            </p>
                            {(element.why_needed || element.why_it_matters) && (
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {element.why_needed || element.why_it_matters}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {succesKansAnalysis.recommendations && succesKansAnalysis.recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    Aanbevelingen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {succesKansAnalysis.recommendations.map((rec: any, idx: number) => (
                      <div key={idx} className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4">
                        {typeof rec === 'string' ? (
                          <p className="text-sm leading-relaxed">{rec}</p>
                        ) : (
                          <>
                            <p className="text-sm font-medium mb-1">{rec.point}</p>
                            {rec.why_it_matters && (
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {rec.why_it_matters}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => successChanceMutation.mutate()}
                disabled={successChanceMutation.isPending}
                data-testid="button-rerun-full-analysis"
              >
                {successChanceMutation.isPending ? 'Analyseren...' : 'Opnieuw analyseren'}
              </Button>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileSearch className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nog niet uitgevoerd</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Start de volledige analyse om een uitgebreide AI-beoordeling 
                  van uw zaak te krijgen.
                </p>
                <Button
                  onClick={() => successChanceMutation.mutate()}
                  disabled={successChanceMutation.isPending}
                  data-testid="button-start-full-analysis"
                >
                  {successChanceMutation.isPending ? 'Analyseren...' : 'Start volledige analyse'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
