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
import { PlusCircle, FileSearch, Scale, CheckCircle, XCircle, ArrowRight, FileText, Users, AlertTriangle, AlertCircle, Files } from "lucide-react";
import { RIcon } from "@/components/RIcon";
import { useActiveCase } from "@/contexts/CaseContext";
import DocumentList from "@/components/DocumentList";
import MissingInfo from "@/components/MissingInfo";
import { useQuery } from "@tanstack/react-query";

export default function Analysis() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const [kantonCheckResult, setKantonCheckResult] = useState<any>(null);
  const [kantonDialogOpen, setKantonDialogOpen] = useState(false);
  const [documentenOpen, setDocumentenOpen] = useState(false);
  const [nogAanTeLeverenOpen, setNogAanTeLeverenOpen] = useState(false);
  const [location, setLocation] = useLocation();
  
  const currentCase = useActiveCase();
  const caseId = currentCase?.id;

  const analyzeMutation = useAnalyzeCase(caseId || "");
  const fullAnalyzeMutation = useFullAnalyzeCase(caseId || "");

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
  const savedResponsesMap = new Map<string, any>();
  savedResponses.forEach((response: any) => {
    savedResponsesMap.set(response.requirementId, response);
  });

  const missingRequirements = useMemo(() => {
    const fullAnalysis = currentCase?.fullAnalysis as any;
    const parsedAnalysis = fullAnalysis?.parsedAnalysis;
    const analysis = currentCase?.analysis as any;
    const dataSource = parsedAnalysis || analysis;
    if (!dataSource) return [];
    
    // Check for missing_info_for_assessment (new format) OR missing_essentials + clarifying_questions (alternative format)
    let questionsArray = dataSource?.missing_info_for_assessment;
    
    if (!questionsArray || !Array.isArray(questionsArray)) {
      // Try combining missing_essentials and clarifying_questions
      const missing = dataSource?.missing_essentials || [];
      const clarifying = dataSource?.clarifying_questions || [];
      
      if (Array.isArray(missing) || Array.isArray(clarifying)) {
        questionsArray = [
          ...(Array.isArray(missing) ? missing : []),
          ...(Array.isArray(clarifying) ? clarifying : [])
        ];
      }
    }
    
    if (questionsArray && Array.isArray(questionsArray) && questionsArray.length > 0) {
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
        <Dialog open={documentenOpen} onOpenChange={setDocumentenOpen}>
          <DialogTrigger asChild>
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
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Geüploade documenten</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <DocumentList 
                documents={currentCase?.documents || []}
                caseId={currentCase?.id || ""}
                onDocumentUploaded={() => refetch()}
              />
            </div>
          </DialogContent>
        </Dialog>

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

      {/* GO/NO-GO ADVICE PANEL */}
      {goNogoAdvice && fullAnalysis && (
        <Card className={`mb-6 border-2 ${goNogoAdvice.proceed_now ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'}`} data-testid="card-go-nogo-advice">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {goNogoAdvice.proceed_now ? (
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              )}
              <span>Advies: {goNogoAdvice.proceed_now ? 'Doorgaan' : 'Nog niet doorgaan'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {goNogoAdvice.reason && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Reden</h4>
                <p className="text-sm" data-testid="text-gonogo-reason">{goNogoAdvice.reason}</p>
              </div>
            )}

            {goNogoAdvice.conditions_to_proceed && goNogoAdvice.conditions_to_proceed.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Voorwaarden om door te gaan</h4>
                <ul className="list-disc list-inside space-y-1">
                  {goNogoAdvice.conditions_to_proceed.map((condition: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground">{condition}</li>
                  ))}
                </ul>
              </div>
            )}

            {goNogoAdvice.hitl_flag && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Menselijke beoordeling aanbevolen
                  </span>
                </div>
                <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                  Deze zaak heeft extra aandacht nodig van een juridisch expert voordat u doorgaat.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* EXTRACTED TEXTS SECTION */}
      {extractedTexts && Array.isArray(extractedTexts) && extractedTexts.length > 0 && (
        <Card className="mb-6" data-testid="card-extracted-texts">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Files className="h-5 w-5 text-primary" />
              Document Samenvattingen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {extractedTexts.map((doc: any, idx: number) => (
                <div key={idx} className="border-b last:border-b-0 pb-4 last:pb-0">
                  <h4 className="font-semibold text-sm mb-2 text-primary">
                    {doc.filename || `Document ${idx + 1}`}
                  </h4>
                  
                  {doc.summary && (
                    <div className="mb-3">
                      <p className="text-sm text-muted-foreground italic">
                        {doc.summary}
                      </p>
                    </div>
                  )}

                  {doc.bullets && Array.isArray(doc.bullets) && doc.bullets.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        Belangrijkste punten
                      </h5>
                      <ul className="list-disc list-inside space-y-1">
                        {doc.bullets.map((bullet: string, bulletIdx: number) => (
                          <li key={bulletIdx} className="text-sm">{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-6 w-6 text-primary" />
              Volledige Juridische Analyse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="samenvatting" className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 mb-10">
                <TabsTrigger value="samenvatting" data-testid="tab-samenvatting">Samenvatting</TabsTrigger>
                <TabsTrigger value="partijen" data-testid="tab-partijen">Partijen</TabsTrigger>
                <TabsTrigger value="feiten" data-testid="tab-feiten">Feiten</TabsTrigger>
                <TabsTrigger value="juridisch" data-testid="tab-juridisch">Juridisch</TabsTrigger>
                <TabsTrigger value="risico" data-testid="tab-risico">Risico</TabsTrigger>
                <TabsTrigger value="aanbevelingen" data-testid="tab-aanbevelingen">Aanbevelingen</TabsTrigger>
              </TabsList>

              <TabsContent value="samenvatting" className="space-y-4 pt-6">
                {fullAnalysis.summary && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Zaak Samenvatting
                    </h3>
                    {fullAnalysis.summary.facts_brief && (
                      <Card>
                        <CardContent className="pt-6">
                          <h4 className="font-semibold text-sm mb-2">Feiten</h4>
                          <p className="text-sm text-foreground leading-relaxed">
                            {fullAnalysis.summary.facts_brief}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                    {fullAnalysis.summary.claims_brief && (
                      <Card>
                        <CardContent className="pt-6">
                          <h4 className="font-semibold text-sm mb-2">Vordering</h4>
                          <p className="text-sm text-foreground leading-relaxed">
                            {fullAnalysis.summary.claims_brief}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                    {fullAnalysis.summary.defenses_brief && (
                      <Card>
                        <CardContent className="pt-6">
                          <h4 className="font-semibold text-sm mb-2">Verweer</h4>
                          <p className="text-sm text-foreground leading-relaxed">
                            {fullAnalysis.summary.defenses_brief}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                    {fullAnalysis.summary.legal_brief && (
                      <Card>
                        <CardContent className="pt-6">
                          <h4 className="font-semibold text-sm mb-2">Juridisch Perspectief</h4>
                          <p className="text-sm text-foreground leading-relaxed">
                            {fullAnalysis.summary.legal_brief}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="partijen" className="space-y-4 pt-6">
                {/* User Context & Procedure Context */}
                {(userContext || procedureContext) && (
                  <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 mb-6">
                    <CardContent className="pt-6">
                      <h3 className="text-lg font-semibold mb-4 text-blue-900 dark:text-blue-100 flex items-center gap-2">
                        <Scale className="h-5 w-5" />
                        Uw Procedurepositie
                      </h3>
                      <div className="space-y-3">
                        {userContext && (
                          <div>
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Procedurerole:</p>
                            <div className="flex gap-2 flex-wrap">
                              {userContext.procedural_role && (
                                <Badge variant="default" className="bg-blue-600" data-testid="badge-procedural-role">
                                  {userContext.procedural_role === 'eiser' ? 'EISER (Eisende partij)' : 
                                   userContext.procedural_role === 'gedaagde' ? 'GEDAAGDE (Verwerende partij)' : 
                                   userContext.procedural_role}
                                </Badge>
                              )}
                              {userContext.legal_role && (
                                <Badge variant="outline" className="border-blue-400" data-testid="badge-legal-role">
                                  {userContext.legal_role}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        {procedureContext && (
                          <div>
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Procedure type:</p>
                            <div className="flex gap-2 flex-wrap">
                              {procedureContext.is_kantonzaak !== undefined && (
                                <Badge variant={procedureContext.is_kantonzaak ? "default" : "outline"} 
                                       className={procedureContext.is_kantonzaak ? "bg-green-600" : ""} 
                                       data-testid="badge-kantonzaak">
                                  {procedureContext.is_kantonzaak ? 'Kantonzaak' : 'Niet kantonzaak'}
                                </Badge>
                              )}
                              {procedureContext.court_type && (
                                <Badge variant="outline" className="border-blue-400" data-testid="badge-court-type">
                                  {procedureContext.court_type}
                                </Badge>
                              )}
                              {procedureContext.confidence_level && (
                                <Badge variant="secondary" data-testid="badge-confidence">
                                  {procedureContext.confidence_level} zekerheid
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {fullAnalysis.case_overview?.parties && fullAnalysis.case_overview.parties.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Betrokken Partijen
                    </h3>
                    {fullAnalysis.case_overview.parties.map((party: any, index: number) => (
                      <Card key={index} className="border-l-4 border-primary">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{party.role || 'Partij'}</Badge>
                            <h4 className="font-semibold text-sm" data-testid={`text-party-name-${index}`}>
                              {party.name || 'Onbekend'}
                            </h4>
                          </div>
                          {party.description && (
                            <p className="text-sm text-muted-foreground">
                              {party.description}
                            </p>
                          )}
                          {party.type && (
                            <p className="text-sm text-muted-foreground mt-1">
                              <span className="font-medium">Type:</span> {party.type}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Geen partijen informatie beschikbaar</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="feiten" className="space-y-4 pt-6">
                {fullAnalysis.facts ? (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Relevante Feiten
                    </h3>
                    
                    {fullAnalysis.facts.known && fullAnalysis.facts.known.length > 0 && (
                      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                        <CardContent className="pt-6">
                          <h4 className="font-semibold text-sm mb-3 text-green-800 dark:text-green-200">Vaststaande Feiten</h4>
                          <ul className="space-y-2">
                            {fullAnalysis.facts.known.map((fact: string, index: number) => (
                              <li key={index} className="flex gap-3" data-testid={`fact-known-${index}`}>
                                <span className="text-green-600 dark:text-green-400 font-bold mt-0.5">&bull;</span>
                                <p className="text-sm text-green-900 dark:text-green-100">{fact}</p>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {fullAnalysis.facts.disputed && fullAnalysis.facts.disputed.length > 0 && (
                      <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
                        <CardContent className="pt-6">
                          <h4 className="font-semibold text-sm mb-3 text-orange-800 dark:text-orange-200">Betwiste Feiten</h4>
                          <ul className="space-y-2">
                            {fullAnalysis.facts.disputed.map((fact: string, index: number) => (
                              <li key={index} className="flex gap-3" data-testid={`fact-disputed-${index}`}>
                                <span className="text-orange-600 dark:text-orange-400 font-bold mt-0.5">&bull;</span>
                                <p className="text-sm text-orange-900 dark:text-orange-100">{fact}</p>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {fullAnalysis.facts.unclear && fullAnalysis.facts.unclear.length > 0 && (
                      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30">
                        <CardContent className="pt-6">
                          <h4 className="font-semibold text-sm mb-3 text-yellow-800 dark:text-yellow-200">Onduidelijke Feiten</h4>
                          <ul className="space-y-2">
                            {fullAnalysis.facts.unclear.map((fact: string, index: number) => (
                              <li key={index} className="flex gap-3" data-testid={`fact-unclear-${index}`}>
                                <span className="text-yellow-600 dark:text-yellow-400 font-bold mt-0.5">&bull;</span>
                                <p className="text-sm text-yellow-900 dark:text-yellow-100">{fact}</p>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Geen feiten informatie beschikbaar</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="juridisch" className="space-y-6 pt-6">
                {/* Applicable Rules from new MindStudio structure */}
                {fullAnalysis.applicable_rules && fullAnalysis.applicable_rules.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Scale className="h-5 w-5 text-primary" />
                      Toepasselijke Wetsartikelen
                    </h3>
                    <div className="space-y-3">
                      {fullAnalysis.applicable_rules.map((rule: any, index: number) => (
                        <Card key={index} data-testid={`applicable-rule-${index}`} className="border-l-4 border-blue-500">
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                              <Badge variant="outline" className="border-blue-400">{rule.article || 'Art.'}</Badge>
                              <div className="flex-1">
                                <p className="font-semibold text-sm mb-1">{rule.label || 'Wetsartikel'}</p>
                                {rule.notes && (
                                  <p className="text-sm text-muted-foreground">{rule.notes}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Claims */}
                {fullAnalysis.recommended_claims && fullAnalysis.recommended_claims.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Aanbevolen Vorderingen
                    </h3>
                    <div className="space-y-3">
                      {fullAnalysis.recommended_claims.map((claim: any, index: number) => (
                        <Card key={index} data-testid={`recommended-claim-${index}`} className="border-l-4 border-green-500">
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                              <Badge className="bg-green-600">#{claim.order || index + 1}</Badge>
                              <div className="flex-1">
                                <p className="font-semibold text-sm mb-1">{claim.label || 'Vordering'}</p>
                                {claim.why && (
                                  <p className="text-sm text-muted-foreground">{claim.why}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evidence Section */}
                {fullAnalysis.evidence && (fullAnalysis.evidence.provided?.length > 0 || fullAnalysis.evidence.missing?.length > 0) && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Files className="h-5 w-5 text-primary" />
                      Bewijs
                    </h3>
                    
                    {fullAnalysis.evidence.provided && fullAnalysis.evidence.provided.length > 0 && (
                      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 mb-4">
                        <CardContent className="pt-6">
                          <h4 className="font-semibold text-sm mb-3 text-green-800 dark:text-green-200">Aanwezig Bewijs</h4>
                          <ul className="space-y-2">
                            {fullAnalysis.evidence.provided.map((ev: any, index: number) => (
                              <li key={index} className="flex gap-3" data-testid={`evidence-provided-${index}`}>
                                <span className="text-green-600 dark:text-green-400 font-bold mt-0.5">✓</span>
                                <div className="flex-1">
                                  <p className="text-sm text-green-900 dark:text-green-100 font-medium">
                                    {ev.doc_name || ev.ref_document || 'Document'}
                                  </p>
                                  {ev.key_passages && ev.key_passages.length > 0 && (
                                    <ul className="mt-1 ml-4 text-xs text-green-800 dark:text-green-200">
                                      {ev.key_passages.map((passage: string, i: number) => (
                                        <li key={i}>• {passage}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {fullAnalysis.evidence.missing && fullAnalysis.evidence.missing.length > 0 && (
                      <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
                        <CardContent className="pt-6">
                          <h4 className="font-semibold text-sm mb-3 text-orange-800 dark:text-orange-200">Ontbrekend Bewijs</h4>
                          <ul className="space-y-2">
                            {fullAnalysis.evidence.missing.map((item: string, index: number) => (
                              <li key={index} className="flex gap-3" data-testid={`evidence-missing-${index}`}>
                                <span className="text-orange-600 dark:text-orange-400 font-bold mt-0.5">⚠</span>
                                <p className="text-sm text-orange-900 dark:text-orange-100">{item}</p>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Missing Essentials */}
                {fullAnalysis.missing_essentials && fullAnalysis.missing_essentials.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      Ontbrekende Essentiële Informatie
                    </h3>
                    <div className="space-y-3">
                      {fullAnalysis.missing_essentials.map((item: any, index: number) => (
                        <Card key={index} data-testid={`missing-essential-${index}`} className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                              <Badge variant="outline" className="border-amber-500">{item.priority || 'medium'}</Badge>
                              <div className="flex-1">
                                <p className="font-semibold text-sm mb-1">{item.item || 'Item'}</p>
                                {item.why_needed && (
                                  <p className="text-sm text-muted-foreground">{item.why_needed}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {!fullAnalysis.applicable_rules && !fullAnalysis.recommended_claims && !fullAnalysis.evidence && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Scale className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Geen juridische informatie beschikbaar</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="risico" className="space-y-4 pt-6">
                {fullAnalysis.legal_analysis?.risks && fullAnalysis.legal_analysis.risks.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      Risicobeoordeling
                    </h3>
                    <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
                      <CardContent className="pt-6">
                        <ul className="space-y-3">
                          {fullAnalysis.legal_analysis.risks.map((risk: any, index: number) => (
                            <li key={index} className="flex gap-3" data-testid={`risk-item-${index}`}>
                              <span className="text-orange-600 dark:text-orange-400 font-bold mt-0.5">&bull;</span>
                              <div className="flex-1">
                                <p className="text-sm text-orange-900 dark:text-orange-100">
                                  {typeof risk === 'string' ? risk : risk.risk || JSON.stringify(risk)}
                                </p>
                                {typeof risk === 'object' && risk.severity && (
                                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                                    <strong>Ernst:</strong> {risk.severity}
                                  </p>
                                )}
                                {typeof risk === 'object' && risk.mitigation && (
                                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                                    <strong>Mitigatie:</strong> {risk.mitigation}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Geen risico informatie beschikbaar</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="aanbevelingen" className="space-y-4 pt-6">
                {fullAnalysis.legal_analysis?.next_actions && fullAnalysis.legal_analysis.next_actions.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-200">
                      <CheckCircle className="h-5 w-5" />
                      Aanbevolen Vervolgstappen
                    </h3>
                    <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
                      <CardContent className="pt-6">
                        <ul className="space-y-3">
                          {fullAnalysis.legal_analysis.next_actions.map((action: any, index: number) => (
                            <li key={index} className="flex gap-3" data-testid={`recommendation-${index}`}>
                              <span className="text-blue-600 dark:text-blue-400 font-bold">{index + 1}.</span>
                              <div className="flex-1">
                                <p className="text-sm text-blue-900 dark:text-blue-100">
                                  {typeof action === 'string' ? action : action.action || JSON.stringify(action)}
                                </p>
                                {typeof action === 'object' && action.reason && (
                                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                    <strong>Reden:</strong> {action.reason}
                                  </p>
                                )}
                                {typeof action === 'object' && action.priority && (
                                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                    <strong>Prioriteit:</strong> {action.priority}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Geen aanbevelingen beschikbaar</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end mt-6 pt-6 border-t">
              <Button
                onClick={() => fullAnalyzeMutation.mutate()}
                disabled={fullAnalyzeMutation.isPending}
                data-testid="button-reanalyze"
              >
                {fullAnalyzeMutation.isPending ? 'Analyseren...' : 'Opnieuw analyseren'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
