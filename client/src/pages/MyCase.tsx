import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useAnalyzeCase, useGenerateLetter, useOrderBailiff } from "@/hooks/useCase";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MissingDocuments from "@/components/MissingDocuments";
import DocumentList from "@/components/DocumentList";
import AnalysisResults from "@/components/AnalysisResults";
import GeneratedDocuments from "@/components/GeneratedDocuments";
import ProcessTimeline from "@/components/ProcessTimeline";
import CaseInfo from "@/components/CaseInfo";
import DeadlineWarning from "@/components/DeadlineWarning";
import { 
  SummaryCard, 
  AnalysisCard, 
  Qualifiers, 
  ClaimPanel, 
  RiskPanel, 
  Timeline, 
  Deadlines, 
  BurdenOfProof, 
  Limitations, 
  Conflicts, 
  TodoCtas, 
  OrderedList, 
  Section,
  AnalysisSkeleton
} from "@/components/legal";
import { Link, useLocation } from "wouter";
import { PlusCircle, Headset, MessageSquare, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";

export default function MyCase() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: cases, isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  
  // For MVP, we'll use the first case as the main case
  const currentCase = Array.isArray(cases) && cases.length > 0 ? cases[0] : undefined;
  const caseId = currentCase?.id;

  const analyzeMutation = useAnalyzeCase(caseId || "");
  const letterMutation = useGenerateLetter(caseId || "");
  const bailiffMutation = useOrderBailiff(caseId || "");
  
  // New analysis hook for detailed MindStudio data
  const { 
    data: analysisData, 
    isLoading: analysisLoading, 
    error: analysisError, 
    refresh: refreshAnalysis,
    isRefreshing: isRefreshingAnalysis
  } = useAnalysis({ 
    caseId: caseId || "", 
    enabled: !!caseId && expandedSection === 'analyse' 
  });

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Reset expanded section when navigating back to /my-case
  useEffect(() => {
    if (window.location.pathname === '/my-case' || window.location.pathname === '/') {
      setExpandedSection(null);
    }
  }, [window.location.pathname]);

  // Refresh case data after successful analysis
  useEffect(() => {
    if (analyzeMutation.isSuccess) {
      // Small delay to ensure DB is updated before refetch
      setTimeout(() => {
        refetch();
      }, 500);
    }
  }, [analyzeMutation.isSuccess, refetch]);

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
              <PlusCircle className="mr-2 h-5 w-5" />
              Eerste zaak starten
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const missingDocs = currentCase.analysis?.missingDocsJson || [];

  return (
    <div className="space-y-6">
      <DeadlineWarning caseId={currentCase.id} />
      
      {/* Services Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Service 1: Analyse */}
        <div className="border rounded-lg p-4 bg-white dark:bg-gray-900">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-medium text-sm">Juridische Analyse</h3>
              <p className="text-xs text-muted-foreground">AI-analyse van je geschil</p>
            </div>
            <Badge variant={currentCase.analysis ? "default" : "secondary"} className="text-xs">
              {currentCase.analysis ? "Voltooid" : "Beschikbaar"}
            </Badge>
          </div>
          <Button 
            onClick={() => toggleSection('analyse')}
            size="sm"
            variant={expandedSection === 'analyse' ? "outline" : "default"}
            className="w-full"
          >
            Start
          </Button>
        </div>

        {/* Service 2: Brief */}
        <div className="border rounded-lg p-4 bg-white dark:bg-gray-900">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-medium text-sm">Ingebrekestelling</h3>
              <p className="text-xs text-muted-foreground">Brief naar wederpartij</p>
            </div>
            <Badge variant={(currentCase.letters?.length || 0) > 0 ? "default" : "secondary"} className="text-xs">
              {(currentCase.letters?.length || 0) > 0 ? "Voltooid" : "Beschikbaar"}
            </Badge>
          </div>
          <Button 
            onClick={() => toggleSection('brief')}
            size="sm"
            variant={expandedSection === 'brief' ? "outline" : "default"}
            className="w-full"
          >
            Start
          </Button>
        </div>

        {/* Service 3: Dagvaarding */}
        <div className="border rounded-lg p-4 bg-white dark:bg-gray-900">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-medium text-sm">Dagvaarding</h3>
              <p className="text-xs text-muted-foreground">Rechtbank procedure (optioneel)</p>
            </div>
            <Badge variant={(currentCase.summons?.length || 0) > 0 ? "default" : "secondary"} className="text-xs">
              {(currentCase.summons?.length || 0) > 0 ? "Voltooid" : "Beschikbaar"}
            </Badge>
          </div>
          <Button 
            onClick={() => toggleSection('dagvaarding')}
            size="sm"
            variant={expandedSection === 'dagvaarding' ? "outline" : "default"}
            className="w-full"
          >
            Start
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Show Mijn zaak content when no section is expanded */}
        {!expandedSection && (
          <>
            <CaseInfo 
              caseData={currentCase}
              onExport={() => {
                window.open(`/api/cases/${currentCase.id}/export`, '_blank');
              }}
              onEdit={() => {
                setLocation(`/edit-case/${currentCase.id}`);
              }}
              isFullWidth={true}
            />
            
            {/* Missing Documents Section */}
            {missingDocs.length > 0 && (
              <MissingDocuments 
                missingDocs={missingDocs}
                caseId={currentCase.id}
                onDocumentUploaded={() => refetch()}
              />
            )}

            {/* Documents Section */}
            <DocumentList 
              documents={currentCase.documents || []}
              caseId={currentCase.id}
              onDocumentUploaded={() => refetch()}
            />
          </>
        )}

        {/* Expandable Section: Juridische Analyse */}
        {expandedSection === 'analyse' && (
          <div className="space-y-6">
            {/* Header with actions */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Juridische Analyse</h2>
              <div className="flex gap-2">
                <Button 
                  onClick={() => refreshAnalysis()}
                  disabled={analysisLoading || isRefreshingAnalysis}
                  size="sm"
                  variant={analysisData ? "outline" : "default"}
                >
                  {(analysisLoading || isRefreshingAnalysis) ? "Analyseren..." : analysisData ? "Heranalyseren" : "Start analyse"}
                </Button>
                {analysisError && (
                  <Button 
                    onClick={() => refreshAnalysis()}
                    disabled={analysisLoading || isRefreshingAnalysis}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Opnieuw proberen
                  </Button>
                )}
                <Button 
                  onClick={() => setExpandedSection(null)}
                  size="sm"
                  variant="outline"
                >
                  Terug naar Mijn zaak
                </Button>
              </div>
            </div>

            {/* Loading State */}
            {(analysisLoading || isRefreshingAnalysis) && <AnalysisSkeleton />}
            
            {/* Error State */}
            {analysisError && !analysisLoading && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="space-y-3">
                  <div>
                    <strong>Analyse tijdelijk niet beschikbaar</strong>
                  </div>
                  <div className="text-sm">
                    {analysisError.message.includes('timeout') || analysisError.message.includes('niet beschikbaar') ? (
                      <>
                        <p>MindStudio AI is momenteel overbelast. Dit kan gebeuren tijdens piekuren.</p>
                        <p className="mt-2 font-medium">Wat kunt u doen:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Probeer het over 10-15 minuten opnieuw</li>
                          <li>De analyse wordt bewaard zodra deze succesvol is</li>
                          <li>U kunt intussen documenten uploaden of zaakgegevens aanvullen</li>
                        </ul>
                      </>
                    ) : (
                      <p>Er is een onverwachte fout opgetreden: {analysisError.message}</p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={() => refreshAnalysis()}
                      size="sm"
                      variant="outline"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Nu opnieuw proberen
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Success State */}
            {analysisData && !analysisLoading && (
              <main className="container mx-auto space-y-6">
                {/* Conflicts Warning */}
                <Conflicts items={analysisData.conflicten_in_input} />

                {/* Zaak Overzicht Section */}
                <Section title="Zaak Overzicht">
                  <SummaryCard text={analysisData.samenvatting_feiten} />
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <ClaimPanel 
                      hoofdsom={analysisData.vordering.hoofdsom} 
                      wettelijke_rente={analysisData.vordering.wettelijke_rente} 
                    />
                    <RiskPanel 
                      inschatting={analysisData.kansinschatting.inschatting}
                      redenen={analysisData.kansinschatting.redenen}
                    />
                  </div>
                </Section>

                {/* Juridische Duiding Section */}
                <Section title="Juridische Duiding">
                  <Qualifiers 
                    is_kantonzaak={analysisData.kwalificaties.is_kantonzaak}
                    relatieve_bevoegdheid={analysisData.kwalificaties.relatieve_bevoegdheid}
                    toepasselijk_recht={analysisData.kwalificaties.toepasselijk_recht}
                  />
                </Section>

                {/* Feiten & Bewijs Section */}
                <Section title="Feiten & Bewijs">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Timeline items={analysisData.belangrijke_data.timeline} />
                    <Deadlines items={analysisData.belangrijke_data.deadlines_en_termijnen} />
                  </div>
                  <BurdenOfProof 
                    wie_moet_wat_bewijzen={analysisData.bewijslast.wie_moet_wat_bewijzen}
                    beschikbaar_bewijs={analysisData.bewijslast.beschikbaar_bewijs}
                    ontbrekend_bewijs={analysisData.bewijslast.ontbrekend_bewijs}
                  />
                </Section>

                {/* Verjaring & Klachttermijnen Section */}
                <Section title="Verjaring & Klachttermijnen">
                  <Limitations text={analysisData.verjaring_en_klachttermijnen} />
                </Section>

                {/* Juridische Analyse (Uitgebreid) Section */}
                <Section title="Juridische Analyse (Uitgebreid)">
                  <AnalysisCard text={analysisData.juridische_analyse} />
                </Section>

                {/* Acties Section */}
                <Section title="Acties">
                  <TodoCtas 
                    todos={analysisData.to_do} 
                    ctas={analysisData.cta}
                    onAction={(label) => {
                      toast({
                        title: "Actie geselecteerd",
                        description: `${label} - Deze functie komt binnenkort beschikbaar`,
                      });
                    }}
                  />
                </Section>

                {/* Kernredenering Section */}
                <Section title="Kernredenering">
                  <OrderedList items={analysisData.kernredenering} />
                </Section>
              </main>
            )}

            {/* Fallback: Show old analysis if no new data */}
            {!analysisData && !analysisLoading && !analysisError && (
              <div className="border rounded-lg p-6 bg-white dark:bg-gray-900">
                <AnalysisResults 
                  analysis={currentCase.analysis}
                  onAnalyze={() => analyzeMutation.mutate()}
                  isAnalyzing={analyzeMutation.isPending}
                  hasNewInfo={(() => {
                    if (!currentCase.analysis || !currentCase.updatedAt) return false;
                    if (analyzeMutation.isPending) return false;
                    if (analyzeMutation.isSuccess) return false;
                    
                    const caseUpdated = new Date(currentCase.updatedAt);
                    const analysisCreated = new Date(currentCase.analysis.createdAt);
                    const timeDiff = caseUpdated.getTime() - analysisCreated.getTime();
                    return timeDiff > 1000;
                  })()}
                />
              </div>
            )}
          </div>
        )}

        {/* Expandable Section: Gegenereerde Documenten */}
        {expandedSection === 'brief' && (
          <div className="space-y-6">
            <div className="border rounded-lg p-6 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Ingebrekestelling</h2>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => letterMutation.mutate()}
                    disabled={letterMutation.isPending || !currentCase.analysis}
                    size="sm"
                    variant={(currentCase.letters?.length || 0) > 0 ? "outline" : "default"}
                  >
                    {letterMutation.isPending ? "Genereren..." : (currentCase.letters?.length || 0) > 0 ? "Nieuwe brief" : "Genereer brief"}
                  </Button>
                  <Button 
                    onClick={() => setExpandedSection(null)}
                    size="sm"
                    variant="outline"
                  >
                    Terug naar Mijn zaak
                  </Button>
                </div>
              </div>
              <GeneratedDocuments 
                letters={currentCase.letters || []}
                summons={currentCase.summons || []}
                caseId={currentCase.id}
              />
            </div>
          </div>
        )}

        {/* Expandable Section: Dagvaarding */}
        {expandedSection === 'dagvaarding' && (
          <div className="space-y-6">
            <div className="border rounded-lg p-6 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Dagvaarding</h2>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      toast({
                        title: "Dagvaarding opstellen",
                        description: "Deze functie wordt binnenkort beschikbaar gesteld",
                      });
                    }}
                    disabled={!currentCase.analysis}
                    size="sm"
                    variant={(currentCase.summons?.length || 0) > 0 ? "outline" : "default"}
                  >
                    {(currentCase.summons?.length || 0) > 0 ? "Nieuwe dagvaarding" : "Opstellen dagvaarding"}
                  </Button>
                  <Button 
                    onClick={() => setExpandedSection(null)}
                    size="sm"
                    variant="outline"
                  >
                    Terug naar Mijn zaak
                  </Button>
                </div>
              </div>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Dagvaarding functionaliteit komt binnenkort beschikbaar. 
                  Hier kun je straks je dagvaarding opstellen en indienen bij de rechtbank.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Secondary Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 pt-8 border-t border-border">
        <Link href="/new-case" className="text-muted-foreground hover:text-foreground text-sm font-medium" data-testid="link-new-case-secondary">
          <PlusCircle className="inline mr-2 h-4 w-4" />
          Nieuwe zaak starten
        </Link>
        
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" data-testid="button-contact-support">
            <Headset className="mr-2 h-4 w-4" />
            Contact opnemen
          </Button>
          <span className="text-muted-foreground">|</span>
          <Button variant="ghost" size="sm" data-testid="button-feedback">
            <MessageSquare className="mr-2 h-4 w-4" />
            Feedback geven
          </Button>
        </div>
      </div>
    </div>
  );
}
