import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StepChips from "@/components/StepChips";
import MissingDocuments from "@/components/MissingDocuments";
import DocumentList from "@/components/DocumentList";
import AnalysisResults from "@/components/AnalysisResults";
import GeneratedDocuments from "@/components/GeneratedDocuments";
import ProcessTimeline from "@/components/ProcessTimeline";
import { ArrowLeft, ArrowRight, Home, Brain, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function StepView() {
  const [match, params] = useRoute("/step/:stepId");
  const { user, isLoading: authLoading } = useAuth();
  const { data: cases, isLoading: casesLoading } = useCases();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const stepId = parseInt(params?.stepId || "1");
  const currentCase = Array.isArray(cases) && cases.length > 0 ? cases[0] : undefined;
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Start analysis mutation - now returns threadId for async processing
  const analysisMutation = useMutation({
    mutationFn: async () => {
      if (!currentCase) throw new Error("Geen zaak gevonden");
      const response = await apiRequest("POST", `/api/cases/${currentCase.id}/analyze`, {});
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.threadId) {
        // Mindstudio async analysis started
        setThreadId(data.threadId);
        setIsPolling(true);
        toast({
          title: "Analyse gestart",
          description: "AI analyse is gestart. Dit kan 1-15 seconden duren...",
        });
      } else {
        // Fallback sync analysis completed
        setAnalysisResult(data);
        toast({
          title: "Analyse voltooid",
          description: "Uw zaak is succesvol geanalyseerd door AI.",
        });
      }
      // Refresh cases to get updated status
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
    },
    onError: (error: any) => {
      console.error("Analysis error:", error);
      setIsPolling(false);
      toast({
        title: "Analyse mislukt",
        description: error.message || "Er is een fout opgetreden bij de analyse.",
        variant: "destructive",
      });
    },
  });

  // Polling for Mindstudio results
  useEffect(() => {
    if (!threadId || !isPolling) return;

    const pollResult = async () => {
      try {
        const response = await apiRequest("GET", `/api/mindstudio/result?threadId=${threadId}`, {});
        const result = await response.json();
        
        if (result.status === 'done') {
          setIsPolling(false);
          
          // Use the processed result directly from Mindstudio
          if (result.processedResult) {
            setAnalysisResult({
              id: threadId,
              caseId: currentCase?.id || '',
              model: 'mindstudio-agent',
              factsJson: result.processedResult.factsJson,
              issuesJson: result.processedResult.issuesJson,
              legalBasisJson: result.processedResult.legalBasisJson,
              missingDocsJson: result.processedResult.missingDocuments,
              riskNotesJson: [],
              createdAt: new Date().toISOString(),
              rawText: result.outputText || '',
              billingCost: result.billingCost || '$0'
            });
          }
          
          // Update case status
          await queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
          
          toast({
            title: "Analyse voltooid",
            description: "Uw zaak is succesvol geanalyseerd door Mindstudio AI.",
          });
        } else if (result.status === 'error') {
          setIsPolling(false);
          toast({
            title: "Analyse mislukt",
            description: "Er is een fout opgetreden bij de AI analyse.",
            variant: "destructive",
          });
        }
        // Continue polling if status is still 'running' or 'pending'
      } catch (error) {
        console.error('Polling error:', error);
        setIsPolling(false);
        toast({
          title: "Verbindingsfout",
          description: "Kon analyseresultaat niet ophalen.",
          variant: "destructive",
        });
      }
    };

    const interval = setInterval(pollResult, 1500); // Poll every 1.5 seconds
    
    return () => clearInterval(interval);
  }, [threadId, isPolling, currentCase, queryClient, toast]);

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

  const handleStepClick = (step: number) => {
    window.location.href = `/step/${step}`;
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 1:
        return {
          title: "Stap 1: Indienen stukken",
          content: currentCase ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Documenten uploaden</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Upload alle relevante documenten voor uw zaak. Ondersteunde formaten: PDF, DOCX, JPG, PNG, EML.
                  </p>
                  <Badge variant="outline">Zaak ID: {currentCase.id}</Badge>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Geen zaak gevonden. <Link href="/new-case" className="text-primary underline">Maak een nieuwe zaak aan</Link>.
            </div>
          )
        };
      case 2:
        return {
          title: "Stap 2: AI Analyse",
          content: currentCase ? (
            <div className="space-y-6">
              {/* Start Analysis Button */}
              {!analysisResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      Start AI Analyse
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      Laat AI uw intake en documenten analyseren om feiten, juridische grondslagen en risico's te identificeren.
                    </p>
                    <Button 
                      onClick={() => analysisMutation.mutate()}
                      disabled={analysisMutation.isPending || isPolling}
                      className="w-full sm:w-auto"
                      data-testid="button-start-analysis"
                    >
                      {analysisMutation.isPending || isPolling ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {isPolling ? 'AI analyse loopt...' : 'Analyseren...'}
                        </>
                      ) : (
                        <>
                          <Brain className="w-4 h-4 mr-2" />
                          Start analyse
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Analysis Results */}
              {analysisResult && (
                <div className="space-y-4">
                  {/* Facts Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Feiten
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysisResult.facts?.map((fact: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <Badge variant="outline" className="mt-0.5">{index + 1}</Badge>
                            <span className="text-sm">{fact}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Issues Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        Juridische Kwesties
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysisResult.issues?.map((issue: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <Badge variant="secondary" className="mt-0.5">{index + 1}</Badge>
                            <span className="text-sm">{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Missing Documents Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Ontbrekende Documenten
                        <Button variant="outline" size="sm" className="ml-auto">
                          Upload ontbrekende stukken
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysisResult.missing_documents?.map((doc: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <Badge variant="destructive" className="mt-0.5">{index + 1}</Badge>
                            <span className="text-sm">{doc}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Next Step */}
                  <Card className="border-green-200 bg-green-50">
                    <CardHeader>
                      <CardTitle className="text-green-800">Volgende stap</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-green-700 mb-3">Analyse voltooid! U kunt nu een brief genereren.</p>
                      <Link href="/step/3">
                        <Button variant="default" data-testid="button-next-step-generate-letter">
                          Genereer brief
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Geen zaak gevonden.
            </div>
          )
        };
      case 3:
        return {
          title: "Stap 3: Brief genereren",
          content: currentCase ? (
            <Card>
              <CardHeader>
                <CardTitle>Gegenereerde brieven</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Hier vindt u alle gegenereerde brieven voor uw zaak.
                </p>
                <Badge variant="outline">Brieven voor zaak {currentCase.id}</Badge>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Geen zaak gevonden.
            </div>
          )
        };
      case 4:
        return {
          title: "Stap 4: Deurwaarder inschakelen",
          content: (
            <Card>
              <CardHeader>
                <CardTitle>Deurwaarder inschakelen</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  In deze stap schakelt u een deurwaarder in voor de formele betekening van uw brief.
                </p>
                <Badge variant="outline">Mock functionaliteit</Badge>
              </CardContent>
            </Card>
          )
        };
      case 5:
        return {
          title: "Stap 5: Betekening",
          content: (
            <Card>
              <CardHeader>
                <CardTitle>Wachten op betekening</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  De deurwaarder zal de brief formeel betekenen aan de wederpartij.
                </p>
              </CardContent>
            </Card>
          )
        };
      case 6:
        return {
          title: "Stap 6: Rechtbank",
          content: currentCase ? (
            <Card>
              <CardHeader>
                <CardTitle>Dagvaarding bij rechtbank</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Genereer en dien de dagvaarding in bij de rechtbank.
                </p>
                <Badge variant="outline">Dagvaarding voor zaak {currentCase.id}</Badge>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Dagvaarding bij rechtbank</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Genereer en dien de dagvaarding in bij de rechtbank.
                </p>
              </CardContent>
            </Card>
          )
        };
      case 7:
        return {
          title: "Stap 7: Procedure",
          content: (
            <Card>
              <CardHeader>
                <CardTitle>Rechtbankprocedure</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  De rechtbankprocedure is gestart. Volg de ontwikkelingen.
                </p>
              </CardContent>
            </Card>
          )
        };
      case 8:
        return {
          title: "Stap 8: Vervolg procedure",
          content: (
            <Card>
              <CardHeader>
                <CardTitle>Procedure loopt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  De procedure is gaande. Wacht op verder bericht van de rechtbank.
                </p>
              </CardContent>
            </Card>
          )
        };
      case 9:
        return {
          title: "Stap 9: Vonnis",
          content: (
            <Card>
              <CardHeader>
                <CardTitle>Vonnis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Het vonnis is uitgesproken. Upload het vonnis voor archivering.
                </p>
              </CardContent>
            </Card>
          )
        };
      default:
        return {
          title: "Onbekende stap",
          content: (
            <div className="text-center py-8 text-muted-foreground">
              Stap niet gevonden.
            </div>
          )
        };
    }
  };

  if (authLoading || casesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  const stepContent = getStepContent(stepId);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/my-case">
              <Button variant="outline" size="sm" data-testid="button-back-to-overview">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Terug naar overzicht
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-home">
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
            </Link>
          </div>
          
          <div className="flex items-center space-x-2">
            {stepId > 1 && (
              <Link href={`/step/${stepId - 1}`}>
                <Button variant="outline" size="sm" data-testid="button-previous-step">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Vorige
                </Button>
              </Link>
            )}
            {stepId < 9 && (
              <Link href={`/step/${stepId + 1}`}>
                <Button variant="outline" size="sm" data-testid="button-next-step">
                  Volgende
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Step Navigation */}
        <Card>
          <CardHeader>
            <CardTitle>Stappen overzicht</CardTitle>
          </CardHeader>
          <CardContent>
            <StepChips currentStep={stepId} onStepClick={handleStepClick} />
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>{stepContent.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {stepContent.content}
          </CardContent>
        </Card>

        {/* Timeline */}
        {currentCase && (
          <Card>
            <CardHeader>
              <CardTitle>Tijdlijn</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Hier ziet u de tijdlijn van uw zaak met alle belangrijke gebeurtenissen.
              </p>
              <Badge variant="outline" className="mt-4">Zaak {currentCase.id}</Badge>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}