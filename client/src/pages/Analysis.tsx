import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useAnalyzeCase, useFullAnalyzeCase } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { PlusCircle, FileSearch, Scale, CheckCircle, XCircle, ArrowRight, FileText, Users, AlertTriangle, AlertCircle, Files, TrendingUp, Info } from "lucide-react";
import { RIcon } from "@/components/RIcon";
import { useActiveCase } from "@/contexts/CaseContext";
import DocumentList from "@/components/DocumentList";
import MissingInfo from "@/components/MissingInfo";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Analysis() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const [kantonCheckResult, setKantonCheckResult] = useState<any>(null);
  const [kantonDialogOpen, setKantonDialogOpen] = useState(false);
  const [nogAanTeLeverenOpen, setNogAanTeLeverenOpen] = useState(false);
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

  // Fetch saved responses to determine which requirements are already answered
  const { data: savedResponsesData } = useQuery({
    queryKey: ['/api/cases', caseId, 'missing-info', 'responses'],
    enabled: !!caseId,
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/missing-info/responses`);
      if (!res.ok) throw new Error('Failed to fetch responses');
      return res.json();
    }
  });

  const savedResponses = savedResponsesData?.responses || [];
  
  // Create a Set of valid document IDs for quick lookup
  const validDocumentIds = new Set((currentCase?.documents || []).map((doc: any) => doc.id));
  
  // Create a Map of saved responses for easy lookup
  // CRITICAL: Filter out document-responses where the document no longer exists
  const savedResponsesMap = new Map<string, any>();
  savedResponses.forEach((response: any) => {
    // If response is a document, validate that the document still exists
    if (response.kind === 'document') {
      if (response.documentId && validDocumentIds.has(response.documentId)) {
        // Document exists - this is a valid response
        savedResponsesMap.set(response.requirementId, response);
      }
      // else: Document was deleted - don't include this response
    } else {
      // Text or not_available responses are always valid
      savedResponsesMap.set(response.requirementId, response);
    }
  });

  const missingRequirements = useMemo(() => {
    const fullAnalysis = currentCase?.fullAnalysis as any;
    const parsedAnalysis = fullAnalysis?.parsedAnalysis;
    const analysis = currentCase?.analysis as any;
    const dataSource = parsedAnalysis || analysis;
    if (!dataSource) return [];
    
    let questionsArray: any[] = [];
    
    // FIRST: Try new normalized structure: missing_info_struct.sections[].items[]
    if (dataSource?.missing_info_struct && 
        Array.isArray(dataSource.missing_info_struct) && 
        dataSource.missing_info_struct.length > 0 &&
        dataSource.missing_info_struct.some((s: any) => s.sections)) {
      dataSource.missing_info_struct.forEach((struct: any) => {
        if (struct.sections && Array.isArray(struct.sections)) {
          struct.sections.forEach((section: any) => {
            if (section.items && Array.isArray(section.items)) {
              questionsArray.push(...section.items);
            }
          });
        }
      });
    } else if (dataSource?.missing_info_struct?.sections && Array.isArray(dataSource.missing_info_struct.sections)) {
      // Alternative structure: missing_info_struct is an object with sections property
      dataSource.missing_info_struct.sections.forEach((section: any) => {
        if (section.items && Array.isArray(section.items)) {
          questionsArray.push(...section.items);
        }
      });
    }
    
    // FALLBACK 1: Try combining missing_essentials and clarifying_questions
    if (questionsArray.length === 0) {
      const missing = dataSource?.missing_essentials || [];
      const clarifying = dataSource?.clarifying_questions || [];
      
      if (Array.isArray(missing) || Array.isArray(clarifying)) {
        questionsArray = [
          ...(Array.isArray(missing) ? missing : []),
          ...(Array.isArray(clarifying) ? clarifying : [])
        ];
      }
    }
    
    // FALLBACK 2: Check for missing_info_for_assessment (old format)
    if (questionsArray.length === 0 && dataSource?.missing_info_for_assessment && Array.isArray(dataSource.missing_info_for_assessment)) {
      questionsArray = dataSource.missing_info_for_assessment;
    }
    
    if (questionsArray.length > 0) {
      return questionsArray.map((item: any, index: number) => {
        let inputKind: 'text' | 'document' | 'both' = 'text';
        if (item.answer_type === 'file_upload') {
          inputKind = 'document';
        } else if (item.answer_type === 'text') {
          inputKind = 'text';
        } else if (item.answer_type === 'multiple_choice') {
          inputKind = 'text';
        }
        
        let description: string | undefined;
        let options: Array<{value: string, label: string}> | undefined;
        
        if (typeof item.expected === 'string') {
          description = item.expected;
        } else if (Array.isArray(item.expected)) {
          options = item.expected.map((opt: string) => ({
            value: opt,
            label: opt
          }));
          description = 'Kies een optie uit de lijst';
        }
        
        return {
          id: item.id || `req-${index}`,
          key: item.key || item.id || `requirement-${index}`,
          label: item.question || item.label || 'Vraag zonder label',
          description: description || item.description || undefined,
          required: item.required !== false,
          inputKind: inputKind,
          acceptMimes: item.accept_mimes || item.acceptMimes || undefined,
          maxLength: item.max_length || item.maxLength || undefined,
          options: options || item.options || undefined,
          examples: typeof item.expected === 'string' ? [item.expected] : item.examples || undefined,
        };
      });
    }
    
    if (dataSource?.evidence?.missing && Array.isArray(dataSource.evidence.missing)) {
      return dataSource.evidence.missing.map((item: any, index: number) => {
        if (typeof item === 'string') {
          return {
            id: `evidence-${index}`,
            key: `evidence-requirement-${index}`,
            label: item,
            description: 'Upload het gevraagde document om uw zaak te versterken',
            required: false,
            inputKind: 'document' as const,
            acceptMimes: undefined,
            maxLength: undefined,
            options: undefined,
            examples: undefined,
          };
        }
        return {
          id: item.id || `evidence-${index}`,
          key: item.key || item.id || `evidence-requirement-${index}`,
          label: item.label || item.name || item.description || 'Ontbrekend bewijs',
          description: item.description || item.reason || 'Upload het gevraagde document',
          required: item.required !== false,
          inputKind: item.input_kind || item.inputKind || 'document' as const,
          acceptMimes: item.accept_mimes || item.acceptMimes || undefined,
          maxLength: item.max_length || item.maxLength || undefined,
          options: item.options || undefined,
          examples: item.examples || undefined,
        };
      });
    }
    
    if (dataSource?.missingDocsJson && Array.isArray(dataSource.missingDocsJson)) {
      return dataSource.missingDocsJson.map((label: string, index: number) => ({
        id: `legacy-${index}`,
        key: `legacy-requirement-${index}`,
        label: label,
        description: undefined,
        required: true,
        inputKind: 'document' as const,
        acceptMimes: undefined,
        maxLength: undefined,
        options: undefined,
        examples: undefined,
      }));
    }
    
    return [];
  }, [currentCase?.analysis, currentCase?.fullAnalysis]);

  const docCount = currentCase?.documents?.length || 0;
  
  // Count only UNANSWERED required requirements
  const requiredCount = missingRequirements.filter((r: any) => {
    if (!r.required) return false;
    // Check if this requirement has been answered
    return !savedResponsesMap.has(r.id);
  }).length;

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
  let userContext = null;
  let procedureContext = null;
  let flags = null;
  let goNogoAdvice = null;
  let readyForSummons = null;
  let extractedTexts = null;
  let allFiles = null;
  let succesKansAnalysis = null;
  
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
      // Use state fallback if database doesn't have it (happens when no full analysis exists yet)
      succesKansAnalysis = (currentCase?.fullAnalysis as any)?.succesKansAnalysis || successChanceResult || null;
    } else if (currentCase?.fullAnalysis?.rawText) {
      const rawData = JSON.parse(currentCase.fullAnalysis.rawText);
      
      // Check if parsedAnalysis exists at top level
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analyse</h2>
          <p className="text-muted-foreground">Juridische analyse van uw zaak</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        <Dialog open={kantonDialogOpen} onOpenChange={setKantonDialogOpen}>
          <DialogTrigger asChild>
            <Card 
              className={`cursor-pointer hover:shadow-lg transition-all relative ${
                kantonSuitable ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 
                kantonNotSuitable ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 
                ''
              }`}
              data-testid="card-kanton-check"
            >
              <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
              <CardHeader>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  kantonSuitable ? 'bg-green-100 dark:bg-green-900/30' : 
                  kantonNotSuitable ? 'bg-red-100 dark:bg-red-900/30' : 
                  'bg-primary/10'
                }`}>
                  {kantonSuitable ? (
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  ) : kantonNotSuitable ? (
                    <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                  ) : (
                    <Scale className="h-8 w-8 text-primary" />
                  )}
                </div>
                <CardTitle className="text-center">Kantonzaak check</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                {parsedKantonCheck ? (
                  <>
                    <Badge 
                      variant={kantonSuitable ? "default" : "destructive"}
                      className="mb-2"
                    >
                      {kantonSuitable ? 'Geschikt' : 'Niet geschikt'}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {parsedKantonCheck.summary || parsedKantonCheck.decision || 'Klik voor details'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">
                      Nog niet gecontroleerd
                    </p>
                    <Badge variant="outline">Klik om te starten</Badge>
                  </>
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

        <Card 
          className="relative"
          data-testid="card-juridische-analyse"
        >
          <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
          <CardHeader>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileSearch className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-center">Juridische analyse</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {fullAnalysis ? (
              <>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Analyse compleet</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Bekijk details hieronder
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Nog niet uitgevoerd
                </p>
                <Button
                  onClick={() => fullAnalyzeMutation.mutate()}
                  disabled={fullAnalyzeMutation.isPending}
                  data-testid="button-start-full-analysis"
                >
                  {fullAnalyzeMutation.isPending ? 'Analyseren...' : 'Start analyse'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link href="/dossier">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow relative" data-testid="card-documenten-analysis">
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Files className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-center">Dossier</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-2xl font-bold text-foreground">{docCount}</p>
              <p className="text-sm text-muted-foreground">
                {docCount === 1 ? 'document' : 'documenten'} geüpload
              </p>
            </CardContent>
          </Card>
        </Link>

        <Dialog open={nogAanTeLeverenOpen} onOpenChange={setNogAanTeLeverenOpen}>
          <DialogTrigger asChild>
            <Card 
              className={`cursor-pointer hover:shadow-lg transition-all relative ${
                currentCase?.fullAnalysis && requiredCount === 0 
                  ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                  : ''
              }`}
              data-testid="card-nog-aan-te-leveren-analysis"
            >
              <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
              <CardHeader>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  currentCase?.fullAnalysis && requiredCount === 0
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-primary/10'
                }`}>
                  <CheckCircle className={`h-8 w-8 ${
                    currentCase?.fullAnalysis && requiredCount === 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-primary'
                  }`} />
                </div>
                <CardTitle className="text-center">Nog aan te leveren</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                {currentCase?.fullAnalysis ? (
                  <>
                    {requiredCount === 0 && (
                      <Badge variant="default" className="mb-2 bg-green-600 dark:bg-green-700">
                        Compleet
                      </Badge>
                    )}
                    <p className="text-2xl font-bold text-foreground">{requiredCount}</p>
                    <p className="text-sm text-muted-foreground">
                      vereiste {requiredCount === 1 ? 'vraag' : 'vragen'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">
                      Nog niet geanalyseerd
                    </p>
                    <Badge variant="outline">Klik om te bekijken</Badge>
                  </>
                )}
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Wat we nog nodig hebben</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <MissingInfo 
                requirements={missingRequirements}
                caseId={currentCase?.id || ""}
                caseDocuments={currentCase?.documents || []}
                onUpdated={() => {
                  refetch();
                  setNogAanTeLeverenOpen(false);
                }}
              />
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

      {/* ANALYSIS STATUS FLAGS */}
      {flags && fullAnalysis && (
        <Card className="mb-6" data-testid="card-analysis-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="h-5 w-5 text-primary" />
              Analyse Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg border-2 ${flags.facts_complete ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {flags.facts_complete ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className="font-semibold text-sm">Feiten</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {flags.facts_complete ? 'Voldoende feiten verzameld' : 'Meer feitelijke informatie nodig'}
                </p>
              </div>

              <div className={`p-4 rounded-lg border-2 ${flags.evidence_complete ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {flags.evidence_complete ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className="font-semibold text-sm">Bewijs</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {flags.evidence_complete ? 'Voldoende bewijs aanwezig' : 'Meer bewijsmateriaal gewenst'}
                </p>
              </div>

              <div className={`p-4 rounded-lg border-2 ${flags.has_legal_basis ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {flags.has_legal_basis ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className="font-semibold text-sm">Juridische grondslag</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {flags.has_legal_basis ? 'Juridische basis aanwezig' : 'Juridische basis onduidelijk'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SUCCESS CHANCE PANEL (RKOS - Redelijke Kans Op Succes) */}
      {fullAnalysis && (
        <Card className={`mb-6 border-2 ${
          succesKansAnalysis 
            ? (succesKansAnalysis.chance_of_success >= 70 
                ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800' 
                : succesKansAnalysis.chance_of_success >= 40
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                  : 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800')
            : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
        }`} data-testid="card-success-chance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span>Kans op succes</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!succesKansAnalysis ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-4">
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
            )}
          </CardContent>
        </Card>
      )}

      {/* FALLBACK: No analysis or incomplete analysis */}
      {!fullAnalysis && currentCase?.fullAnalysis && (
        <Card className="mb-6 bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800" data-testid="card-incomplete-analysis">
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
            <h3 className="font-semibold text-lg mb-2">Analyse onvolledig</h3>
            <p className="text-sm text-muted-foreground">
              De analyse is gestart maar er is nog geen resultaat beschikbaar. Controleer de documenten en eventuele ontbrekende informatie.
            </p>
          </CardContent>
        </Card>
      )}

      {fullAnalysis && (
        <Link href={`/analysis/${caseId}/full`}>
          <Card className="mt-8 cursor-pointer hover:shadow-lg transition-shadow border-primary/20 hover:border-primary/40" data-testid="card-full-analysis">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-6 w-6 text-primary" />
                  Volledige Juridische Analyse
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Klik om de complete juridische analyse te bekijken met alle details over partijen, feiten, juridische grondslag, risico's en aanbevelingen.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" data-testid="badge-has-samenvatting">Samenvatting</Badge>
                <Badge variant="outline" data-testid="badge-has-partijen">Partijen</Badge>
                <Badge variant="outline" data-testid="badge-has-feiten">Feiten</Badge>
                <Badge variant="outline" data-testid="badge-has-juridisch">Juridisch</Badge>
                <Badge variant="outline" data-testid="badge-has-risico">Risico</Badge>
                <Badge variant="outline" data-testid="badge-has-aanbevelingen">Aanbevelingen</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
