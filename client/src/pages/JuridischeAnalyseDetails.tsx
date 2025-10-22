import { useAuth } from "@/hooks/useAuth";
import { useFullAnalyzeCase } from "@/hooks/useCase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { PlusCircle, FileSearch, FileText, Users, AlertTriangle, AlertCircle, TrendingUp, ArrowLeft } from "lucide-react";
import { useActiveCase } from "@/contexts/CaseContext";

export default function JuridischeAnalyseDetails() {
  const { user, isLoading: authLoading } = useAuth();
  const currentCase = useActiveCase();
  const fullAnalyzeMutation = useFullAnalyzeCase(currentCase?.id || "");

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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

  let fullAnalysis = null;
  
  try {
    if ((currentCase?.fullAnalysis as any)?.parsedAnalysis && typeof (currentCase.fullAnalysis as any).parsedAnalysis === 'object') {
      fullAnalysis = (currentCase.fullAnalysis as any).parsedAnalysis;
    } else if (currentCase?.fullAnalysis?.rawText) {
      const rawData = JSON.parse(currentCase.fullAnalysis.rawText);
      
      // Check if parsedAnalysis exists at top level
      if (rawData.parsedAnalysis && typeof rawData.parsedAnalysis === 'object') {
        fullAnalysis = rawData.parsedAnalysis;
      }
      // Check in result (new consistent format)
      else if (rawData.result) {
        const result = rawData.result;
        
        if (result.analysis_json) {
          fullAnalysis = typeof result.analysis_json === 'string' ? JSON.parse(result.analysis_json) : result.analysis_json;
        }
      }
      // Check in thread posts (old MindStudio format - fallback)
      else if (rawData.thread?.posts) {
        for (const post of rawData.thread.posts) {
          if (post.debugLog?.newState?.variables?.analysis_json?.value) {
            const parsedValue = post.debugLog.newState.variables.analysis_json.value;
            fullAnalysis = typeof parsedValue === 'string' ? JSON.parse(parsedValue) : parsedValue;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing full analysis:', error);
  }

  if (!fullAnalysis) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button variant="ghost" asChild className="mb-2" data-testid="button-back-to-analysis">
              <Link href="/analysis">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Terug naar overzicht
              </Link>
            </Button>
            <h2 className="text-2xl font-bold text-foreground">Volledige Juridische Analyse</h2>
            <p className="text-muted-foreground">Gedetailleerde analyse van uw zaak</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-6 w-6 text-primary" />
              Volledige Juridische Analyse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <FileSearch className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nog niet uitgevoerd</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Start de volledige juridische analyse om een gedetailleerd overzicht te krijgen van feiten, partijen, juridische grondslag en aanbevelingen.
              </p>
              <Button
                onClick={() => fullAnalyzeMutation.mutate()}
                disabled={fullAnalyzeMutation.isPending}
                size="lg"
                data-testid="button-start-full-analysis"
              >
                {fullAnalyzeMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                    Analyseren...
                  </>
                ) : (
                  'Start volledige analyse'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button variant="ghost" asChild className="mb-2" data-testid="button-back-to-analysis">
            <Link href="/analysis">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Terug naar overzicht
            </Link>
          </Button>
          <h2 className="text-2xl font-bold text-foreground">Volledige Juridische Analyse</h2>
          <p className="text-muted-foreground">Gedetailleerde analyse van uw zaak</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-6 w-6 text-primary" />
              Volledige Juridische Analyse
            </CardTitle>
            <Button
              onClick={() => fullAnalyzeMutation.mutate()}
              disabled={fullAnalyzeMutation.isPending}
              variant="outline"
              data-testid="button-reanalyze"
            >
              {fullAnalyzeMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                  Analyseren...
                </>
              ) : (
                'Opnieuw analyseren'
              )}
            </Button>
          </div>
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

              {fullAnalysis.dispute_frame && (
                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-6">
                    <h4 className="font-semibold text-sm mb-2 text-blue-800 dark:text-blue-200">Geschil Samenvatting</h4>
                    <div className="space-y-2">
                      {fullAnalysis.dispute_frame.claimant_wants && (
                        <div>
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Eiser wil:</p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {fullAnalysis.dispute_frame.claimant_wants}
                          </p>
                        </div>
                      )}
                      {fullAnalysis.dispute_frame.defendant_says && (
                        <div>
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Gedaagde zegt:</p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {fullAnalysis.dispute_frame.defendant_says}
                          </p>
                        </div>
                      )}
                      {fullAnalysis.dispute_frame.core_issue && (
                        <div>
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Kernvraag:</p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {fullAnalysis.dispute_frame.core_issue}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {fullAnalysis.procedure_context && (
                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-6">
                    <h4 className="font-semibold text-sm mb-2 text-blue-800 dark:text-blue-200">Procedure Context</h4>
                    <div className="space-y-2">
                      {fullAnalysis.procedure_context.reasoning && (
                        <div>
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Toelichting:</p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {fullAnalysis.procedure_context.reasoning}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Procedure type:</p>
                        <div className="flex gap-2 flex-wrap">
                          {fullAnalysis.procedure_context.is_kantonzaak !== undefined && (
                            <Badge variant={fullAnalysis.procedure_context.is_kantonzaak ? "default" : "outline"} 
                                   className={fullAnalysis.procedure_context.is_kantonzaak ? "bg-green-600" : ""} 
                                   data-testid="badge-kantonzaak">
                              {fullAnalysis.procedure_context.is_kantonzaak ? 'Kantonzaak' : 'Niet kantonzaak'}
                            </Badge>
                          )}
                          {fullAnalysis.procedure_context.court_type && (
                            <Badge variant="outline" className="border-blue-400" data-testid="badge-court-type">
                              {fullAnalysis.procedure_context.court_type}
                            </Badge>
                          )}
                          {fullAnalysis.procedure_context.confidence_level && (
                            <Badge variant="secondary" data-testid="badge-confidence">
                              {fullAnalysis.procedure_context.confidence_level} zekerheid
                            </Badge>
                          )}
                        </div>
                      </div>
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

            <TabsContent value="partijen" className="space-y-4 pt-6">
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
                      <CardHeader>
                        <CardTitle className="text-lg">Vastgestelde Feiten</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {fullAnalysis.facts.known.map((fact: any, index: number) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                              <div className="flex-1">
                                {fact.label && (
                                  <Badge variant="outline" className="mb-1 text-xs border-green-400">
                                    {fact.label}
                                  </Badge>
                                )}
                                <p className="text-foreground leading-relaxed">
                                  {typeof fact === 'string' ? fact : (fact.fact || fact.description || '')}
                                </p>
                                {fact.source && (
                                  <p className="text-xs text-muted-foreground mt-1">Bron: {fact.source}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {fullAnalysis.facts.disputed && fullAnalysis.facts.disputed.length > 0 && (
                    <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
                      <CardHeader>
                        <CardTitle className="text-lg">Betwiste Feiten</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {fullAnalysis.facts.disputed.map((fact: any, index: number) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <span className="text-orange-600 dark:text-orange-400 mt-0.5">!</span>
                              <div className="flex-1">
                                {fact.label && (
                                  <Badge variant="outline" className="mb-1 text-xs border-orange-400">
                                    {fact.label}
                                  </Badge>
                                )}
                                <p className="text-foreground leading-relaxed">
                                  {typeof fact === 'string' ? fact : (fact.fact || fact.description || '')}
                                </p>
                                {fact.source && (
                                  <p className="text-xs text-muted-foreground mt-1">Bron: {fact.source}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {fullAnalysis.facts.unclear && fullAnalysis.facts.unclear.length > 0 && (
                    <Card className="border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950/30">
                      <CardHeader>
                        <CardTitle className="text-lg">Onduidelijke Feiten</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {fullAnalysis.facts.unclear.map((fact: any, index: number) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <span className="text-gray-600 dark:text-gray-400 mt-0.5">?</span>
                              <div className="flex-1">
                                {fact.label && (
                                  <Badge variant="outline" className="mb-1 text-xs border-gray-400">
                                    {fact.label}
                                  </Badge>
                                )}
                                <p className="text-foreground leading-relaxed">
                                  {typeof fact === 'string' ? fact : (fact.fact || fact.description || '')}
                                </p>
                                {fact.source && (
                                  <p className="text-xs text-muted-foreground mt-1">Bron: {fact.source}</p>
                                )}
                              </div>
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

            <TabsContent value="juridisch" className="space-y-4 pt-6">
              {fullAnalysis.applicable_rules && fullAnalysis.applicable_rules.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Toepasselijke Regels
                  </h3>
                  {fullAnalysis.applicable_rules.map((rule: any, index: number) => (
                    <Card key={index} className="border-l-4 border-primary">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{rule.article || `Artikel ${index + 1}`}</Badge>
                          {rule.source && (
                            <Badge variant="secondary">{rule.source}</Badge>
                          )}
                        </div>
                        {rule.title && (
                          <h4 className="font-semibold text-sm mb-2">{rule.title}</h4>
                        )}
                        {rule.text && (
                          <p className="text-sm text-muted-foreground mb-2">{rule.text}</p>
                        )}
                        {rule.analysis && (
                          <div className="bg-muted/50 rounded-md p-3 mt-3">
                            <p className="text-sm text-foreground">{rule.analysis}</p>
                          </div>
                        )}
                        {rule.notes && (
                          <p className="text-xs text-muted-foreground mt-2 italic">{rule.notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Geen juridische grondslag informatie beschikbaar</p>
                </div>
              )}

              {fullAnalysis.evidence?.provided && fullAnalysis.evidence.provided.length > 0 && (
                <div className="space-y-4 mt-8">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Beschikbaar Bewijs
                  </h3>
                  {fullAnalysis.evidence.provided.map((evidence: any, index: number) => (
                    <Card key={index} className="border-l-4 border-green-500">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950">{evidence.type || 'Bewijs'}</Badge>
                        </div>
                        <p className="text-sm text-foreground">{evidence.description || evidence.item || 'Geen beschrijving'}</p>
                        {evidence.strength && (
                          <div className="mt-2">
                            <span className="text-xs font-medium text-muted-foreground">Bewijskracht: </span>
                            <Badge variant="secondary" className="text-xs">{evidence.strength}</Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="risico" className="space-y-4 pt-6">
              {fullAnalysis.legal_analysis?.weaknesses || fullAnalysis.legal_analysis?.strengths ? (
                <div className="space-y-4">
                  {fullAnalysis.legal_analysis.strengths && fullAnalysis.legal_analysis.strengths.length > 0 && (
                    <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                          Sterke Punten
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {fullAnalysis.legal_analysis.strengths.map((strength: string, index: number) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                              <p className="text-foreground leading-relaxed">{strength}</p>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {fullAnalysis.legal_analysis.weaknesses && fullAnalysis.legal_analysis.weaknesses.length > 0 && (
                    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          Zwakke Punten
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {fullAnalysis.legal_analysis.weaknesses.map((weakness: string, index: number) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <span className="text-red-600 dark:text-red-400 mt-0.5">!</span>
                              <p className="text-foreground leading-relaxed">{weakness}</p>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Geen risico analyse beschikbaar</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="aanbevelingen" className="space-y-4 pt-6">
              {fullAnalysis.go_nogo_advice || fullAnalysis.recommended_claims ? (
                <div className="space-y-4">
                  {fullAnalysis.go_nogo_advice && (
                    <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
                      <CardHeader>
                        <CardTitle className="text-lg">Go/No-Go Advies</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Badge variant={fullAnalysis.go_nogo_advice.proceed_now ? "default" : "outline"} 
                                 className={fullAnalysis.go_nogo_advice.proceed_now ? "bg-green-600" : "bg-orange-500"}>
                            {fullAnalysis.go_nogo_advice.proceed_now ? 'Doorgaan' : 'Nog niet doorgaan'}
                          </Badge>
                        </div>
                        {fullAnalysis.go_nogo_advice.reason && (
                          <p className="text-sm text-foreground">{fullAnalysis.go_nogo_advice.reason}</p>
                        )}
                        {fullAnalysis.go_nogo_advice.conditions_to_proceed && fullAnalysis.go_nogo_advice.conditions_to_proceed.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-2">Voorwaarden om door te gaan:</p>
                            <ul className="space-y-1">
                              {fullAnalysis.go_nogo_advice.conditions_to_proceed.map((condition: string, index: number) => (
                                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <span className="mt-0.5">•</span>
                                  <span>{condition}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {fullAnalysis.recommended_claims && fullAnalysis.recommended_claims.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Aanbevolen Vorderingen</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {fullAnalysis.recommended_claims.map((claim: any, index: number) => (
                            <div key={index} className="border-l-4 border-primary pl-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{claim.type || `Vordering ${index + 1}`}</Badge>
                                {claim.amount && (
                                  <Badge variant="secondary">€ {claim.amount}</Badge>
                                )}
                              </div>
                              {claim.description && (
                                <p className="text-sm text-foreground mb-2">{claim.description}</p>
                              )}
                              {claim.legal_basis && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium">Juridische grondslag:</span> {claim.legal_basis}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Geen aanbevelingen beschikbaar</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
