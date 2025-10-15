import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useFullAnalyzeCase } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useParams } from "wouter";
import { ArrowLeft, FileSearch, AlertTriangle, Scale, Users, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function FullAnalysis() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: cases, isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const params = useParams();
  const caseId = params.id;
  
  const currentCase = Array.isArray(cases) && cases.length > 0 ? cases.find(c => c.id === caseId) : undefined;
  const fullAnalyzeMutation = useFullAnalyzeCase(caseId || "");

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
      // Check in thread posts (MindStudio format)
      else if (rawData.thread?.posts) {
        for (const post of rawData.thread.posts) {
          // Look for analysis_json variable
          if (post.debugLog?.newState?.variables?.analysis_json?.value) {
            const parsedValue = post.debugLog.newState.variables.analysis_json.value;
            fullAnalysis = typeof parsedValue === 'string' ? JSON.parse(parsedValue) : parsedValue;
          }
          // Legacy: Look for parsed_analysis
          if (!fullAnalysis && post.debugLog?.newState?.variables?.parsed_analysis?.value) {
            const parsedValue = post.debugLog.newState.variables.parsed_analysis.value;
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
    console.log('Could not parse full analysis:', error);
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
          <h2 className="text-2xl font-bold text-foreground mb-4">Zaak niet gevonden</h2>
          <Button asChild size="lg">
            <Link href="/analysis">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Terug naar Analyse
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild data-testid="button-back-to-analysis">
          <Link href="/analysis">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Juridische analyse</h2>
          <p className="text-muted-foreground">{currentCase.title}</p>
        </div>
      </div>

      {fullAnalysis ? (
        <div className="space-y-6">
          {fullAnalysis.case_summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Samenvatting
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground" data-testid="text-case-summary">
                  {fullAnalysis.case_summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* User Context & Procedure Context */}
          {(userContext || procedureContext) && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <Scale className="h-5 w-5" />
                  Uw Procedurepositie
                </CardTitle>
              </CardHeader>
              <CardContent>
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

          {fullAnalysis.parties && fullAnalysis.parties.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Partijen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {fullAnalysis.parties.map((party: any, index: number) => (
                    <div key={index} className="border-l-4 border-primary pl-4">
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
                      {party.legal_position && (
                        <p className="text-sm text-muted-foreground mt-1">
                          <span className="font-medium">Positie:</span> {party.legal_position}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {fullAnalysis.facts && fullAnalysis.facts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Relevante feiten
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {fullAnalysis.facts.map((fact: any, index: number) => (
                    <li key={index} className="flex gap-3" data-testid={`fact-item-${index}`}>
                      <span className="text-primary font-bold mt-0.5">&bull;</span>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">
                          {typeof fact === 'string' ? fact : fact.description || fact.fact}
                        </p>
                        {typeof fact === 'object' && fact.source && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Bron: {fact.source}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {fullAnalysis.legal_issues && fullAnalysis.legal_issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  Juridische kwesties
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {fullAnalysis.legal_issues.map((issue: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4" data-testid={`legal-issue-${index}`}>
                      <h4 className="font-semibold text-sm mb-2">
                        {typeof issue === 'string' ? issue : issue.issue || issue.title}
                      </h4>
                      {typeof issue === 'object' && issue.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {issue.description}
                        </p>
                      )}
                      {typeof issue === 'object' && issue.legal_basis && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Juridische grondslag:</p>
                          <p className="text-sm">{issue.legal_basis}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {fullAnalysis.legal_assessment && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  Juridische beoordeling
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-line" data-testid="text-legal-assessment">
                  {fullAnalysis.legal_assessment}
                </p>
              </CardContent>
            </Card>
          )}

          {fullAnalysis.risk_assessment && (
            <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                  <AlertTriangle className="h-5 w-5" />
                  Risicobeoordeling
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-orange-900 dark:text-orange-100 whitespace-pre-line" data-testid="text-risk-assessment">
                  {fullAnalysis.risk_assessment}
                </p>
              </CardContent>
            </Card>
          )}

          {fullAnalysis.recommendations && fullAnalysis.recommendations.length > 0 && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
              <CardHeader>
                <CardTitle className="text-blue-800 dark:text-blue-200">Aanbevelingen</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {fullAnalysis.recommendations.map((rec: any, index: number) => (
                    <li key={index} className="flex gap-3" data-testid={`recommendation-${index}`}>
                      <span className="text-blue-600 dark:text-blue-400 font-bold mt-0.5">{index + 1}.</span>
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        {typeof rec === 'string' ? rec : rec.recommendation || rec.action}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" asChild data-testid="button-back">
              <Link href="/analysis">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Terug naar overzicht
              </Link>
            </Button>
            <Button
              onClick={() => fullAnalyzeMutation.mutate()}
              disabled={fullAnalyzeMutation.isPending}
              data-testid="button-reanalyze"
            >
              {fullAnalyzeMutation.isPending ? 'Analyseren...' : 'Opnieuw analyseren'}
            </Button>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileSearch className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Nog geen analyse uitgevoerd
              </h3>
              <p className="text-muted-foreground mb-6">
                Start de juridische analyse om een volledig overzicht te krijgen van uw zaak.
              </p>
              <Button
                onClick={() => fullAnalyzeMutation.mutate()}
                disabled={fullAnalyzeMutation.isPending}
                size="lg"
                data-testid="button-start-full-analysis"
              >
                {fullAnalyzeMutation.isPending ? 'Analyseren...' : 'Start analyse'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
