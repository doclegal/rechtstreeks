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
import { PlusCircle, FileSearch, Scale, CheckCircle, XCircle, ArrowRight, FileText, Users, AlertTriangle } from "lucide-react";
import { RIcon } from "@/components/RIcon";
import { useActiveCase } from "@/contexts/CaseContext";

export default function Analysis() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const [kantonCheckResult, setKantonCheckResult] = useState<any>(null);
  const [kantonDialogOpen, setKantonDialogOpen] = useState(false);
  const [location, setLocation] = useLocation();
  
  const currentCase = useActiveCase();
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
  
  try {
    if ((currentCase?.fullAnalysis as any)?.parsedAnalysis && typeof (currentCase.fullAnalysis as any).parsedAnalysis === 'object') {
      fullAnalysis = (currentCase.fullAnalysis as any).parsedAnalysis;
      userContext = (currentCase?.fullAnalysis as any)?.userContext || null;
      procedureContext = (currentCase?.fullAnalysis as any)?.procedureContext || null;
    } else if (currentCase?.fullAnalysis?.rawText) {
      const rawData = JSON.parse(currentCase.fullAnalysis.rawText);
      
      // Check if parsedAnalysis exists at top level
      if (rawData.parsedAnalysis && typeof rawData.parsedAnalysis === 'object') {
        fullAnalysis = rawData.parsedAnalysis;
        userContext = rawData.userContext || null;
        procedureContext = rawData.procedureContext || null;
      }
      // Check in result.analysis_json
      else if (rawData.result?.analysis_json) {
        const analysisJson = rawData.result.analysis_json;
        fullAnalysis = typeof analysisJson === 'string' ? JSON.parse(analysisJson) : analysisJson;
        userContext = rawData.userContext || rawData.result?.user_context || null;
        procedureContext = rawData.procedureContext || rawData.result?.procedure_context || null;
      }
      // Check in thread posts (MindStudio format)
      else if (rawData.thread?.posts) {
        for (const post of rawData.thread.posts) {
          // Look for analysis_json variable (correct name)
          if (post.debugLog?.newState?.variables?.analysis_json?.value) {
            const parsedValue = post.debugLog.newState.variables.analysis_json.value;
            fullAnalysis = typeof parsedValue === 'string' ? JSON.parse(parsedValue) : parsedValue;
          }
          // Look for user_context
          if (post.debugLog?.newState?.variables?.user_context?.value) {
            const parsedValue = post.debugLog.newState.variables.user_context.value;
            userContext = typeof parsedValue === 'string' ? JSON.parse(parsedValue) : parsedValue;
          }
          // Look for procedure_context
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
                {fullAnalysis.legal_analysis?.what_is_the_dispute && (
                  <Card>
                    <CardContent className="pt-6">
                      <h4 className="font-semibold text-sm mb-2">Kern van het geschil</h4>
                      <p className="text-sm text-foreground">
                        {fullAnalysis.legal_analysis.what_is_the_dispute}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {fullAnalysis.legal_analysis?.legal_issues && fullAnalysis.legal_analysis.legal_issues.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Scale className="h-5 w-5 text-primary" />
                      Juridische Kwesties
                    </h3>
                    <div className="space-y-4">
                      {fullAnalysis.legal_analysis.legal_issues.map((issue: string, index: number) => (
                        <Card key={index} data-testid={`legal-issue-${index}`}>
                          <CardContent className="pt-6">
                            <p className="text-sm text-foreground">{issue}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {fullAnalysis.legal_analysis?.preliminary_assessment && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Scale className="h-5 w-5 text-primary" />
                      Voorlopige Beoordeling
                    </h3>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-foreground whitespace-pre-line" data-testid="text-legal-assessment">
                          {fullAnalysis.legal_analysis.preliminary_assessment}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {fullAnalysis.legal_analysis?.potential_defenses && fullAnalysis.legal_analysis.potential_defenses.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Scale className="h-5 w-5 text-primary" />
                      Mogelijke Verweren
                    </h3>
                    <ul className="space-y-2">
                      {fullAnalysis.legal_analysis.potential_defenses.map((defense: string, index: number) => (
                        <li key={index} className="flex gap-3">
                          <span className="text-primary font-bold mt-0.5">&bull;</span>
                          <p className="text-sm text-foreground">{defense}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!fullAnalysis.legal_analysis && (
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
                          {fullAnalysis.legal_analysis.risks.map((risk: string, index: number) => (
                            <li key={index} className="flex gap-3" data-testid={`risk-item-${index}`}>
                              <span className="text-orange-600 dark:text-orange-400 font-bold mt-0.5">&bull;</span>
                              <p className="text-sm text-orange-900 dark:text-orange-100">{risk}</p>
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
                          {fullAnalysis.legal_analysis.next_actions.map((action: string, index: number) => (
                            <li key={index} className="flex gap-3" data-testid={`recommendation-${index}`}>
                              <span className="text-blue-600 dark:text-blue-400 font-bold">{index + 1}.</span>
                              <p className="text-sm text-blue-900 dark:text-blue-100">{action}</p>
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
