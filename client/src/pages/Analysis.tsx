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
import { PlusCircle, FileSearch, Scale, CheckCircle, XCircle, ArrowRight, FileText, Users, AlertTriangle, AlertCircle, TrendingUp, Info, ArrowLeft, Lightbulb } from "lucide-react";
import { RIcon } from "@/components/RIcon";
import { useActiveCase } from "@/contexts/CaseContext";
import DocumentList from "@/components/DocumentList";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AskJuristButton } from "@/components/AskJuristButton";

export default function Analysis() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const [adviceDialogOpen, setAdviceDialogOpen] = useState(false);
  const [legalAdviceDialogOpen, setLegalAdviceDialogOpen] = useState(false);
  const [location, setLocation] = useLocation();
  
  const currentCase = useActiveCase();
  const caseId = currentCase?.id;

  const renderFieldValue = (value: any): React.ReactNode => {
    if (!value) return null;
    
    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground italic">Geen items</span>;
      }
      
      return (
        <div className="space-y-3">
          {value.map((item, index) => {
            if (typeof item === 'object' && item !== null) {
              // Special handling for bewijs items with 'document' and 'belang' fields
              if ('document' in item && 'belang' in item) {
                return (
                  <div key={index} className="pl-4 border-l-2 border-primary/30">
                    <div className="font-medium text-sm mb-1">📄 {item.document}</div>
                    <div className="text-sm">{item.belang}</div>
                  </div>
                );
              }
              // Generic object display
              return (
                <div key={index} className="pl-4 border-l-2 border-muted">
                  {Object.entries(item).map(([key, val]) => (
                    <div key={key}>
                      <span className="font-medium">{key}:</span> {String(val)}
                    </div>
                  ))}
                </div>
              );
            }
            // Simple array item (string/number)
            return <div key={index} className="pl-4">• {String(item)}</div>;
          })}
        </div>
      );
    }
    
    // Handle objects
    if (typeof value === 'object') {
      return <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(value, null, 2)}</pre>;
    }
    
    // Handle strings
    return <span className="whitespace-pre-wrap">{String(value)}</span>;
  };

  const analyzeMutation = useAnalyzeCase(caseId || "");
  const fullAnalyzeMutation = useFullAnalyzeCase(caseId || "");

  // Legal advice generation mutation
  const generateAdviceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/cases/${caseId}/generate-advice`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: "Juridisch advies gegenereerd",
        description: "Het advies is beschikbaar om te bekijken",
      });
      refetch();
      setAdviceDialogOpen(false);
      // Open the legal advice dialog to show the generated advice
      setTimeout(() => {
        setLegalAdviceDialogOpen(true);
      }, 500);
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij genereren advies",
        description: error.message || "Het advies kon niet worden gegenereerd",
        variant: "destructive",
      });
    },
  });

  // Success chance assessment mutation
  const successChanceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/cases/${caseId}/success-chance`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: "Volledige analyse uitgevoerd",
        description: "De AI heeft uw zaak geanalyseerd",
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

  useEffect(() => {
    if (analyzeMutation.isSuccess && analyzeMutation.data) {
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

  let fullAnalysis = null;
  let legalAdviceFull = null;
  let legalAdviceJson = null;
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
  
  // Check for legalAdviceJson (new format from Create_advice.flow)
  if ((currentCase?.fullAnalysis as any)?.legalAdviceJson) {
    legalAdviceJson = (currentCase.fullAnalysis as any).legalAdviceJson;
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="flex items-start">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Analyse</h2>
            <p className="text-muted-foreground">Juridische analyse van uw zaak</p>
          </div>
        </div>
        <div className="flex items-start lg:hidden">
          <AskJuristButton context="Analyse" variant="outline" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        
        {/* VOLLEDIGE ANALYSE CARD */}
        <Link href="/volledige-analyse">
          <Card 
            className={`cursor-pointer hover:shadow-lg transition-shadow relative h-full ${currentCase?.needsReanalysis ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20' : ''}`}
            data-testid="card-full-analysis"
          >
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileSearch className={`h-6 w-6 ${currentCase?.needsReanalysis ? 'text-blue-600 dark:text-blue-400' : 'text-primary'}`} />
                Volledige analyse
                {currentCase?.needsReanalysis && (
                  <Badge className="ml-auto bg-blue-500 hover:bg-blue-600 text-white">
                    Nieuw
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="font-medium">{fullAnalysis ? 'Analyse voltooid' : 'Nog niet uitgevoerd'}</span>
                </div>
                {succesKansAnalysis && (
                  <div>
                    <span className="text-muted-foreground">Kans op succes:</span>{" "}
                    <span className="font-medium">{succesKansAnalysis.chance_of_success}%</span>
                  </div>
                )}
                {!fullAnalysis && (
                  <div>
                    <span className="text-muted-foreground">Actie:</span>{" "}
                    <span className="font-medium">Klik om te bekijken</span>
                  </div>
                )}
                {currentCase?.needsReanalysis && (
                  <div className="flex items-start gap-2 mt-3 p-2 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-300 dark:border-blue-700">
                    <AlertCircle className="h-4 w-4 text-blue-700 dark:text-blue-300 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                      Nieuwe documenten of informatie toegevoegd! Heranalyse aanbevolen.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* JURIDISCHE ANALYSE CARD */}
        <Dialog open={legalAdviceDialogOpen} onOpenChange={setLegalAdviceDialogOpen}>
          <DialogTrigger asChild>
            <Card 
              className="relative cursor-pointer hover:shadow-lg transition-shadow h-full"
              data-testid="card-juridische-analyse"
            >
              <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Lightbulb className="h-6 w-6 text-primary" />
                  Juridisch advies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <span className="font-medium">{(legalAdviceFull || legalAdviceJson) ? 'Advies beschikbaar' : 'Nog niet opgesteld'}</span>
                  </div>
                  {!(legalAdviceFull || legalAdviceJson) && !(succesKansAnalysis || fullAnalysis) && (
                    <div>
                      <span className="text-muted-foreground">Vereist:</span>{" "}
                      <span className="font-medium">Eerst volledige analyse</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Actie:</span>{" "}
                    <span className="font-medium">{(legalAdviceFull || legalAdviceJson) ? 'Klik voor volledig advies' : 'Klik om op te stellen'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Juridisch Advies</DialogTitle>
            </DialogHeader>
            {(legalAdviceFull || legalAdviceJson) ? (
              <div className="space-y-4 mt-4">
                <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-gray-900 p-6 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-4">
                    <strong>Zaak:</strong> {currentCase?.title || 'Onbekend'}
                  </p>
                  <div data-testid="text-legal-advice-content">
                    {legalAdviceJson ? (
                      <div className="space-y-6">
                        <h2 className="text-lg font-bold">JURIDISCH ADVIES</h2>
                        {legalAdviceJson.samenvatting_advies && (
                          <div>
                            <h3 className="font-semibold mb-2">Samenvatting Advies</h3>
                            <div>{renderFieldValue(legalAdviceJson.samenvatting_advies)}</div>
                          </div>
                        )}
                        {legalAdviceJson.vervolgstappen && (
                          <div>
                            <h3 className="font-semibold mb-2">Vervolgstappen</h3>
                            <div>{renderFieldValue(legalAdviceJson.vervolgstappen)}</div>
                          </div>
                        )}
                        {legalAdviceJson.het_geschil && (
                          <div>
                            <h3 className="font-semibold mb-2">Het Geschil</h3>
                            <div>{renderFieldValue(legalAdviceJson.het_geschil)}</div>
                          </div>
                        )}
                        {legalAdviceJson.de_feiten && (
                          <div>
                            <h3 className="font-semibold mb-2">De Feiten</h3>
                            <div>{renderFieldValue(legalAdviceJson.de_feiten)}</div>
                          </div>
                        )}
                        {legalAdviceJson.betwiste_punten && (
                          <div>
                            <h3 className="font-semibold mb-2">Betwiste Punten</h3>
                            <div>{renderFieldValue(legalAdviceJson.betwiste_punten)}</div>
                          </div>
                        )}
                        {legalAdviceJson.beschikbaar_bewijs && (
                          <div>
                            <h3 className="font-semibold mb-2">Beschikbaar Bewijs</h3>
                            <div>{renderFieldValue(legalAdviceJson.beschikbaar_bewijs)}</div>
                          </div>
                        )}
                        {legalAdviceJson.ontbrekend_bewijs && (
                          <div>
                            <h3 className="font-semibold mb-2">Ontbrekend Bewijs</h3>
                            <div>{renderFieldValue(legalAdviceJson.ontbrekend_bewijs)}</div>
                          </div>
                        )}
                        {legalAdviceJson.juridische_duiding && (
                          <div>
                            <h3 className="font-semibold mb-2">Juridische Duiding</h3>
                            <div>{renderFieldValue(legalAdviceJson.juridische_duiding)}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{legalAdviceFull}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Het systeem genereert een uitgebreid juridisch advies op basis van de volledige analyse van uw zaak.
                </p>
                {!(succesKansAnalysis || fullAnalysis) ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      U moet eerst een volledige analyse uitvoeren voordat u een juridisch advies kunt opstellen.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {generateAdviceMutation.isPending && (
                      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          AI genereert uw juridisch advies... Dit kan enkele minuten duren.
                        </p>
                      </div>
                    )}
                    <Button
                      onClick={() => generateAdviceMutation.mutate()}
                      disabled={generateAdviceMutation.isPending}
                      data-testid="button-generate-advice-dialog"
                      className="w-full"
                    >
                      {generateAdviceMutation.isPending ? 'Adviseren...' : 'Stel advies op'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* READY FOR SUMMONS BANNER */}
      {readyForSummons && (
        <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6" data-testid="banner-ready-for-summons">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground mb-1">
                Klaar voor dagvaarding
              </h3>
              <p className="text-sm text-muted-foreground">
                De zaak is compleet genoeg om een dagvaarding op te stellen. U kunt doorgaan naar de dagvaarding sectie.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
