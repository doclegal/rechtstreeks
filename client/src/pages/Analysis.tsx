import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useAnalyzeCase, useFullAnalyzeCase } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { PlusCircle, FileSearch, Scale, CheckCircle, XCircle, ArrowRight, FileText, Users, AlertTriangle, AlertCircle, TrendingUp, Info, ArrowLeft } from "lucide-react";
import { RIcon } from "@/components/RIcon";
import { useActiveCase } from "@/contexts/CaseContext";
import DocumentList from "@/components/DocumentList";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Analysis() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const [kantonCheckResult, setKantonCheckResult] = useState<any>(null);
  const [kantonDialogOpen, setKantonDialogOpen] = useState(false);
  const [fullAnalysisDialogOpen, setFullAnalysisDialogOpen] = useState(false);
  const [successChanceDialogOpen, setSuccessChanceDialogOpen] = useState(false);
  const [successChanceResult, setSuccessChanceResult] = useState<any>(null);
  const [location, setLocation] = useLocation();
  
  const currentCase = useActiveCase();
  const caseId = currentCase?.id;

  const analyzeMutation = useAnalyzeCase(caseId || "");
  const fullAnalyzeMutation = useFullAnalyzeCase(caseId || "");

  // Success chance assessment mutation
  const successChanceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/cases/${caseId}/success-chance`);
      return response.json();
    },
    onSuccess: (data) => {
      // Save the success chance result in state (so it persists even without full analysis in DB)
      if (data.successChance) {
        setSuccessChanceResult(data.successChance);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: "Kans op succes beoordeeld",
        description: "De AI heeft uw zaak beoordeeld",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij beoordeling",
        description: error.message || "Kon kans op succes niet beoordelen",
        variant: "destructive",
      });
    },
  });

  // Reset success chance state when case changes
  useEffect(() => {
    setSuccessChanceResult(null);
  }, [caseId]);

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

  let parsedKantonCheck = kantonCheckResult;
  if (!parsedKantonCheck && currentCase?.analysis?.rawText) {
    try {
      const parsed = JSON.parse(currentCase.analysis.rawText);
      if (parsed.ok !== undefined) {
        parsedKantonCheck = parsed;
      } else if (parsed.thread?.posts) {
        for (const post of parsed.thread.posts) {
          if (post.debugLog?.newState?.variables?.app_response?.value) {
            const responseValue = post.debugLog.newState.variables.app_response.value;
            let appResponse;
            if (typeof responseValue === 'string') {
              appResponse = JSON.parse(responseValue);
            } else {
              appResponse = responseValue;
            }
            if (appResponse.ok !== undefined) {
              parsedKantonCheck = appResponse;
              break;
            }
          }
        }
      }
    } catch (error) {
      console.log('Could not parse kanton check from rawText:', error);
    }
  }

  const kantonSuitable = parsedKantonCheck?.ok === true;
  const kantonNotSuitable = parsedKantonCheck?.ok === false;

  let fullAnalysis = null;
  let legalAdviceFull = null;
  let userContext = null;
  let procedureContext = null;
  let flags = null;
  let goNogoAdvice = null;
  let readyForSummons = null;
  let extractedTexts = null;
  let allFiles = null;
  let succesKansAnalysis = null;
  
  // ALWAYS check for succesKansAnalysis first, even if there's no parsedAnalysis
  if ((currentCase?.fullAnalysis as any)?.succesKansAnalysis) {
    succesKansAnalysis = (currentCase.fullAnalysis as any).succesKansAnalysis;
  }
  
  try {
    if ((currentCase?.fullAnalysis as any)?.parsedAnalysis && typeof (currentCase.fullAnalysis as any).parsedAnalysis === 'object') {
      fullAnalysis = (currentCase.fullAnalysis as any).parsedAnalysis;
      userContext = (currentCase?.fullAnalysis as any)?.userContext || null;
      procedureContext = (currentCase?.fullAnalysis as any)?.procedureContext || null;
      // Try top-level first, then fallback to parsedAnalysis
      flags = (currentCase?.fullAnalysis as any)?.flags || fullAnalysis?.flags || null;
      goNogoAdvice = (currentCase?.fullAnalysis as any)?.goNogoAdvice || fullAnalysis?.go_nogo_advice || null;
      readyForSummons = (currentCase?.fullAnalysis as any)?.readyForSummons ?? fullAnalysis?.ready_for_summons;
      extractedTexts = (currentCase?.fullAnalysis as any)?.extractedTexts || null;
      allFiles = (currentCase?.fullAnalysis as any)?.allFiles || null;
    } else if (currentCase?.fullAnalysis?.rawText) {
      const rawData = JSON.parse(currentCase.fullAnalysis.rawText);
      
      // NEW FORMAT: Check for legal_advice_full first
      if (rawData.legal_advice_full) {
        legalAdviceFull = rawData.legal_advice_full;
      } else if (rawData.result?.legal_advice_full) {
        legalAdviceFull = rawData.result.legal_advice_full;
      }
      
      // OLD FORMAT: Check if parsedAnalysis exists at top level
      if (rawData.parsedAnalysis && typeof rawData.parsedAnalysis === 'object') {
        fullAnalysis = rawData.parsedAnalysis;
        userContext = rawData.userContext || null;
        procedureContext = rawData.procedureContext || null;
        // Try top-level first, then fallback to parsedAnalysis
        flags = rawData.flags || fullAnalysis?.flags || null;
        goNogoAdvice = rawData.goNogoAdvice || fullAnalysis?.go_nogo_advice || null;
        readyForSummons = rawData.readyForSummons ?? fullAnalysis?.ready_for_summons;
        extractedTexts = rawData.extractedTexts || null;
        allFiles = rawData.allFiles || null;
      }
      // Check in result (new consistent format)
      else if (rawData.result) {
        const result = rawData.result;
        
        if (result.analysis_json) {
          fullAnalysis = typeof result.analysis_json === 'string' ? JSON.parse(result.analysis_json) : result.analysis_json;
        }
        userContext = result.user_context || null;
        procedureContext = result.procedure_context || null;
        // Try top-level first, then fallback to fullAnalysis (parsed analysis_json)
        flags = result.flags || fullAnalysis?.flags || null;
        goNogoAdvice = result.go_nogo_advice || fullAnalysis?.go_nogo_advice || null;
        readyForSummons = result.ready_for_summons ?? fullAnalysis?.ready_for_summons;
        extractedTexts = result.extracted_texts || null;
        allFiles = result.all_files || null;
      }
      // Check in thread posts (old MindStudio format - fallback)
      else if (rawData.thread?.posts) {
        for (const post of rawData.thread.posts) {
          if (post.debugLog?.newState?.variables?.analysis_json?.value) {
            const parsedValue = post.debugLog.newState.variables.analysis_json.value;
            fullAnalysis = typeof parsedValue === 'string' ? JSON.parse(parsedValue) : parsedValue;
          }
          if (post.debugLog?.newState?.variables?.user_context?.value) {
            const parsedValue = post.debugLog.newState.variables.user_context.value;
            userContext = typeof parsedValue === 'string' ? JSON.parse(parsedValue) : parsedValue;
          }
          if (post.debugLog?.newState?.variables?.procedure_context?.value) {
            const parsedValue = post.debugLog.newState.variables.procedure_context.value;
            procedureContext = typeof parsedValue === 'string' ? JSON.parse(parsedValue) : parsedValue;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing full analysis:', error);
  }

  // Final fallback for success chance if not in database (e.g., before full analysis exists)
  if (!succesKansAnalysis && successChanceResult) {
    succesKansAnalysis = successChanceResult;
  }

  // DEBUG: Log fullAnalysis to help diagnose empty data issue
  if (fullAnalysis) {
    console.log('🔍 DEBUG fullAnalysis:', {
      hasApplicableRules: !!fullAnalysis.applicable_rules,
      applicableRulesLength: fullAnalysis.applicable_rules?.length,
      hasFactsKnown: !!fullAnalysis.facts?.known,
      factsKnownLength: fullAnalysis.facts?.known?.length,
      hasEvidence: !!fullAnalysis.evidence,
      evidenceProvidedLength: fullAnalysis.evidence?.provided?.length,
      fullAnalysisKeys: Object.keys(fullAnalysis),
      flags,
      goNogoAdvice,
      readyForSummons
    });
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

  return (
    <div className="space-y-6">
      <Button 
        variant="ghost" 
        size="sm" 
        asChild 
        className="mb-2"
        data-testid="button-back-to-dashboard"
      >
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Link>
      </Button>
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analyse</h2>
          <p className="text-muted-foreground">Juridische analyse van uw zaak</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        
        {/* KANTONZAAK CHECK CARD */}
        <Dialog open={kantonDialogOpen} onOpenChange={setKantonDialogOpen}>
          <DialogTrigger asChild>
            <Card 
              className={`cursor-pointer hover:shadow-lg transition-all relative h-full ${
                kantonSuitable ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 
                kantonNotSuitable ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 
                ''
              }`}
              data-testid="card-kanton-check"
            >
              <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  {kantonSuitable ? (
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : kantonNotSuitable ? (
                    <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  ) : (
                    <Scale className="h-6 w-6 text-primary" />
                  )}
                  Kantonzaak check
                </CardTitle>
              </CardHeader>
              <CardContent>
                {parsedKantonCheck ? (
                  <div className="space-y-2 text-sm">
                    <div>
                      <Badge 
                        variant={kantonSuitable ? "default" : "destructive"}
                        className="mb-2"
                      >
                        {kantonSuitable ? 'Geschikt' : 'Niet geschikt'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {parsedKantonCheck.summary || parsedKantonCheck.decision || 'Klik voor details'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground mb-2">
                      Nog niet gecontroleerd
                    </p>
                    <Badge variant="outline">Klik om te starten</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Kantonzaak check</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {parsedKantonCheck ? (
                <>
                  <div className={`p-4 rounded-lg ${
                    kantonSuitable ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' : 
                    'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      {kantonSuitable ? (
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                      )}
                      <h3 className="font-semibold text-lg">
                        {kantonSuitable ? 'Geschikt voor kantongerecht' : 'Niet geschikt voor kantongerecht'}
                      </h3>
                    </div>
                    <p className="text-sm" data-testid="text-kanton-decision">
                      {parsedKantonCheck.decision || parsedKantonCheck.summary || 'Geen beslissing beschikbaar'}
                    </p>
                  </div>

                  {parsedKantonCheck.reason && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Reden</h4>
                      <p className="text-sm text-muted-foreground" data-testid="text-kanton-reason">
                        {parsedKantonCheck.reason}
                      </p>
                    </div>
                  )}

                  {parsedKantonCheck.rationale && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Toelichting</h4>
                      <p className="text-sm text-muted-foreground">
                        {parsedKantonCheck.rationale}
                      </p>
                    </div>
                  )}

                  {parsedKantonCheck.parties && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm border-b pb-2">Partijen</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {parsedKantonCheck.parties.claimant_name && (
                          <div>
                            <span className="text-muted-foreground">Eiser:</span>{' '}
                            <span className="font-medium">{parsedKantonCheck.parties.claimant_name}</span>
                          </div>
                        )}
                        {parsedKantonCheck.parties.defendant_name && (
                          <div>
                            <span className="text-muted-foreground">Gedaagde:</span>{' '}
                            <span className="font-medium">{parsedKantonCheck.parties.defendant_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {parsedKantonCheck.basis && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm border-b pb-2">Grondslag</h4>
                      <div className="text-sm space-y-1">
                        {parsedKantonCheck.basis.grond && (
                          <div>
                            <span className="text-muted-foreground">Grond:</span>{' '}
                            <span>{parsedKantonCheck.basis.grond}</span>
                          </div>
                        )}
                        {parsedKantonCheck.basis.belang_eur !== null && parsedKantonCheck.basis.belang_eur !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Belang:</span>{' '}
                            <span>€ {parsedKantonCheck.basis.belang_eur.toLocaleString('nl-NL')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={() => {
                      analyzeMutation.mutate();
                    }}
                    disabled={analyzeMutation.isPending}
                    data-testid="button-recheck-kanton"
                  >
                    {analyzeMutation.isPending ? 'Controleren...' : 'Opnieuw controleren'}
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <Scale className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nog niet gecontroleerd</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Start de kantonzaak controle om te zien of uw zaak geschikt is voor het kantongerecht.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => {
                      analyzeMutation.mutate();
                    }}
                    disabled={analyzeMutation.isPending}
                    data-testid="button-start-kanton-check"
                  >
                    {analyzeMutation.isPending ? 'Controleren...' : 'Start check'}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* VOLLEDIGE ANALYSE CARD */}
        <Dialog open={fullAnalysisDialogOpen} onOpenChange={setFullAnalysisDialogOpen}>
          <DialogTrigger asChild>
            <Card 
              className={`cursor-pointer hover:shadow-lg transition-all relative h-full ${
                fullAnalysis ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : ''
              }`}
              data-testid="card-full-analysis"
            >
              <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  {fullAnalysis ? (
                    <CheckCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <FileSearch className="h-6 w-6 text-primary" />
                  )}
                  Volledige analyse
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fullAnalysis ? (
                  <div className="space-y-2 text-sm">
                    <div>
                      <Badge variant="default" className="mb-2 bg-blue-600 dark:bg-blue-700">
                        Voltooid
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      Uitgebreide analyse beschikbaar
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground mb-2">
                      Nog niet uitgevoerd
                    </p>
                    <Badge variant="outline">Klik om te starten</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Volledige analyse</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {succesKansAnalysis ? (
                <>
                  <div className={`p-4 rounded-lg ${
                    succesKansAnalysis.chance_of_success >= 70 
                      ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' 
                      : succesKansAnalysis.chance_of_success >= 40
                        ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'
                        : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      {succesKansAnalysis.chance_of_success >= 70 ? (
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      ) : succesKansAnalysis.chance_of_success >= 40 ? (
                        <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                      )}
                      <div>
                        <h3 className="font-semibold text-lg">
                          Kans op succes: {succesKansAnalysis.chance_of_success}%
                        </h3>
                        <Badge variant={succesKansAnalysis.confidence_level === 'high' ? 'default' : succesKansAnalysis.confidence_level === 'medium' ? 'secondary' : 'outline'}>
                          {succesKansAnalysis.confidence_level === 'high' ? 'Hoog vertrouwen' : succesKansAnalysis.confidence_level === 'medium' ? 'Gemiddeld vertrouwen' : 'Laag vertrouwen'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {succesKansAnalysis.assessment && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Beoordeling</h4>
                      <p className="text-sm text-muted-foreground" data-testid="text-success-assessment">
                        {succesKansAnalysis.assessment}
                      </p>
                    </div>
                  )}

                  {succesKansAnalysis.strengths && succesKansAnalysis.strengths.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm border-b pb-2">Sterke punten</h4>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        {succesKansAnalysis.strengths.map((strength: any, idx: number) => (
                          <li key={idx} className="text-muted-foreground">
                            {typeof strength === 'string' ? strength : strength.point || JSON.stringify(strength)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {succesKansAnalysis.weaknesses && succesKansAnalysis.weaknesses.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm border-b pb-2">Zwakke punten</h4>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        {succesKansAnalysis.weaknesses.map((weakness: any, idx: number) => (
                          <li key={idx} className="text-muted-foreground">
                            {typeof weakness === 'string' ? weakness : weakness.point || JSON.stringify(weakness)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {succesKansAnalysis.missing_elements && succesKansAnalysis.missing_elements.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm border-b pb-2">Ontbrekende elementen</h4>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        {succesKansAnalysis.missing_elements.map((element: any, idx: number) => (
                          <li key={idx} className="text-muted-foreground">
                            {typeof element === 'string' ? element : element.point || JSON.stringify(element)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {succesKansAnalysis.recommendations && succesKansAnalysis.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm border-b pb-2">Aanbevelingen</h4>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        {succesKansAnalysis.recommendations.map((rec: any, idx: number) => (
                          <li key={idx} className="text-muted-foreground">
                            {typeof rec === 'string' ? rec : rec.point || JSON.stringify(rec)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={() => {
                      successChanceMutation.mutate();
                    }}
                    disabled={successChanceMutation.isPending}
                    data-testid="button-rerun-full-analysis"
                  >
                    {successChanceMutation.isPending ? 'Analyseren...' : 'Opnieuw analyseren'}
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <FileSearch className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nog niet uitgevoerd</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Start de volledige analyse om een uitgebreide AI-beoordeling van uw zaak te krijgen. Dit is nodig voor het genereren van juridisch advies.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => {
                      successChanceMutation.mutate();
                    }}
                    disabled={successChanceMutation.isPending}
                    data-testid="button-start-full-analysis-dialog"
                  >
                    {successChanceMutation.isPending ? 'Analyseren...' : 'Start volledige analyse'}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* JURIDISCHE ANALYSE CARD */}
        {(fullAnalysis || legalAdviceFull) ? (
          <Link href="/analyse-details">
            <Card 
              className="relative cursor-pointer hover:shadow-lg transition-shadow h-full"
              data-testid="card-juridische-analyse"
            >
              <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <FileSearch className="h-6 w-6 text-primary" />
                  Juridisch advies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <Badge variant="default" className="mb-2 bg-green-600 dark:bg-green-700">
                      Advies beschikbaar
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Klik voor volledig advies
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card 
            className="relative h-full"
            data-testid="card-juridische-analyse"
          >
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileSearch className="h-6 w-6 text-primary" />
                Juridisch advies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground mb-4">
                  Nog niet opgesteld
                </p>
                <Button
                  onClick={() => fullAnalyzeMutation.mutate()}
                  disabled={fullAnalyzeMutation.isPending}
                  data-testid="button-start-full-analysis"
                >
                  {fullAnalyzeMutation.isPending ? 'Adviseren...' : 'Stel advies op'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KANS OP SUCCES CARD */}
        <Dialog open={successChanceDialogOpen} onOpenChange={setSuccessChanceDialogOpen}>
          <DialogTrigger asChild>
            <Card 
              className={`cursor-pointer hover:shadow-lg transition-all relative h-full ${
                (fullAnalysis || legalAdviceFull) 
                  ? (succesKansAnalysis 
                      ? (succesKansAnalysis.chance_of_success >= 70 
                          ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                          : succesKansAnalysis.chance_of_success >= 40
                            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                            : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800')
                      : '')
                  : ''
              }`}
              data-testid="card-success-chance"
            >
              <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  Kans op succes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(fullAnalysis || legalAdviceFull) ? (
                  succesKansAnalysis ? (
                    <div className="space-y-2 text-sm">
                      <div className="text-4xl font-bold mb-1">
                        {succesKansAnalysis.chance_of_success}%
                      </div>
                      <Badge variant={succesKansAnalysis.confidence_level === 'high' ? 'default' : succesKansAnalysis.confidence_level === 'medium' ? 'secondary' : 'outline'}>
                        {succesKansAnalysis.confidence_level === 'high' ? 'Hoog vertrouwen' : succesKansAnalysis.confidence_level === 'medium' ? 'Gemiddeld vertrouwen' : 'Laag vertrouwen'}
                      </Badge>
                      <p className="text-muted-foreground mt-2">
                        Klik voor volledige analyse
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground mb-2">
                        Nog niet beoordeeld
                      </p>
                      <Badge variant="outline">Klik om te beoordelen</Badge>
                    </div>
                  )
                ) : (
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      Eerst juridische analyse uitvoeren
                    </p>
                    <Badge variant="outline">Niet beschikbaar</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Kans op succes</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {(fullAnalysis || legalAdviceFull) ? (
                !succesKansAnalysis ? (
                  <div className="text-center py-4">
                    <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nog niet beoordeeld</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Laat de AI uw kans op succes beoordelen op basis van de volledige analyse en alle documenten.
                    </p>
                    <Button 
                      onClick={() => successChanceMutation.mutate()}
                      disabled={successChanceMutation.isPending}
                      data-testid="button-check-success-chance"
                    >
                      {successChanceMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Aan het beoordelen...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Check mijn kans op succes
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Main Success Percentage */}
                    <div className="text-center py-4 border-b">
                      <div className="text-5xl font-bold mb-2">
                        {succesKansAnalysis.chance_of_success}%
                      </div>
                      <Badge variant={succesKansAnalysis.confidence_level === 'high' ? 'default' : succesKansAnalysis.confidence_level === 'medium' ? 'secondary' : 'outline'}>
                        {succesKansAnalysis.confidence_level === 'high' ? 'Hoog vertrouwen' : succesKansAnalysis.confidence_level === 'medium' ? 'Gemiddeld vertrouwen' : 'Laag vertrouwen'}
                      </Badge>
                    </div>

                    {/* Summary Verdict */}
                    {succesKansAnalysis.summary_verdict && (
                      <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                        <h4 className="font-semibold text-sm mb-2">Beoordeling</h4>
                        <p className="text-sm" data-testid="text-verdict">{succesKansAnalysis.summary_verdict}</p>
                      </div>
                    )}

                    {/* Strengths */}
                    {succesKansAnalysis.strengths && succesKansAnalysis.strengths.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          Sterke punten
                        </h4>
                        <div className="space-y-2">
                          {succesKansAnalysis.strengths.map((strength: any, idx: number) => (
                            <div key={idx} className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                              <p className="text-sm font-medium mb-1">{strength.point}</p>
                              <p className="text-xs text-muted-foreground">{strength.why_it_matters}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weaknesses */}
                    {succesKansAnalysis.weaknesses && succesKansAnalysis.weaknesses.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          Zwakke punten
                        </h4>
                        <div className="space-y-2">
                          {succesKansAnalysis.weaknesses.map((weakness: any, idx: number) => (
                            <div key={idx} className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                              <p className="text-sm font-medium mb-1">{weakness.point}</p>
                              <p className="text-xs text-muted-foreground">{weakness.why_it_matters}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing Elements */}
                    {succesKansAnalysis.missing_elements && succesKansAnalysis.missing_elements.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          Ontbrekende elementen
                        </h4>
                        <div className="space-y-2">
                          {succesKansAnalysis.missing_elements.map((element: any, idx: number) => (
                            <div key={idx} className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                              <p className="text-sm font-medium mb-1">{element.item}</p>
                              <p className="text-xs text-muted-foreground">{element.why_needed}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Advice for User */}
                    {succesKansAnalysis.advice_for_user && (
                      <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-4 border border-primary/20">
                        <h4 className="font-semibold text-sm mb-2">Advies</h4>
                        <p className="text-sm">{succesKansAnalysis.advice_for_user}</p>
                      </div>
                    )}

                    {/* Refresh Button */}
                    <div className="text-center pt-2">
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => successChanceMutation.mutate()}
                        disabled={successChanceMutation.isPending}
                        data-testid="button-recheck-success-chance"
                      >
                        {successChanceMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2"></div>
                            Opnieuw beoordelen...
                          </>
                        ) : (
                          'Opnieuw beoordelen'
                        )}
                      </Button>
                    </div>
                  </>
                )
              ) : (
                <div className="text-center py-8">
                  <FileSearch className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Juridische analyse vereist</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    U moet eerst een juridische analyse uitvoeren voordat de kans op succes kan worden beoordeeld.
                  </p>
                  <Button
                    onClick={() => {
                      setSuccessChanceDialogOpen(false);
                    }}
                    variant="outline"
                  >
                    Sluiten
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* READY FOR SUMMONS BANNER */}
      {readyForSummons && (
        <div className="bg-green-50 dark:bg-green-950/30 border-2 border-green-500 dark:border-green-700 rounded-lg p-4 mb-6" data-testid="banner-ready-for-summons">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-1">
                Klaar voor dagvaarding
              </h3>
              <p className="text-sm text-green-800 dark:text-green-200">
                De zaak is compleet genoeg om een dagvaarding op te stellen. U kunt doorgaan naar de dagvaarding sectie.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
