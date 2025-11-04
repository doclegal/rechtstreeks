import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { A4Layout, A4Page, SectionHeading, SectionBody } from "@/components/A4Layout";
import { SectionBlock } from "@/components/SectionBlock";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Scale, FileText, Download, Loader2, AlertTriangle, ArrowLeft, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RIcon } from "@/components/RIcon";
import { useCases, useAnalyzeCase } from "@/hooks/useCase";
import { useActiveCase } from "@/contexts/CaseContext";
import { AskJuristButton } from "@/components/AskJuristButton";
import { UnauthorizedMessage } from "@/components/UnauthorizedMessage";
import { isUnauthorizedError } from "@/lib/authUtils";

// Define the 8 sections in strict order
const SUMMONS_SECTIONS = [
  {
    key: "AANZEGGING",
    name: "Aanzegging / Notice of appearance",
    isFixed: true
  },
  {
    key: "JURISDICTION",
    name: "Bevoegdheid en relatieve competentie",
    isFixed: false
  },
  {
    key: "FACTS",
    name: "Feiten",
    isFixed: false
  },
  {
    key: "LEGAL_GROUNDS",
    name: "Juridisch kader & Rechtsgronden",
    isFixed: false
  },
  {
    key: "DEFENSES",
    name: "Verweer en weerlegging",
    isFixed: false
  },
  {
    key: "EVIDENCE",
    name: "Bewijsaanbod",
    isFixed: false
  },
  {
    key: "CLAIMS",
    name: "Vorderingen / Petitum",
    isFixed: false
  },
  {
    key: "EXHIBITS",
    name: "Producties",
    isFixed: false
  }
];

const FIXED_AANZEGGING_TEXT = `AANZEGGING

Op verzoek van: [Naam eiser]
Wonende te: [Adres eiser]

Hierbij verzoek ik u te verschijnen voor de kantonrechter van de rechtbank [Naam rechtbank], zitting houdende te [Plaats rechtbank], op [Datum zitting] om [Tijdstip zitting] uur, of zoodra daarna als de zaak kan worden behandeld, ter terechtzitting in de zaak tegen:

[Naam gedaagde]
Wonende te: [Adres gedaagde]

De gedaagde wordt verzocht op de hierboven genoemde datum en tijd te verschijnen teneinde te worden gehoord over de tegen hem/haar ingestelde vordering.

Indien gedaagde niet verschijnt, kan verstek worden verleend en kan de vordering zonder diens/haar tegenspraak worden toegewezen.`;

type SectionStatus = "pending" | "generating" | "draft" | "needs_changes" | "approved";

interface SummonsSection {
  id: string;
  summonsId: string;
  sectionKey: string;
  sectionName: string;
  stepOrder: number;
  status: SectionStatus;
  flowName?: string | null;
  feedbackVariableName?: string | null;
  generatedText?: string | null;
  userFeedback?: string | null;
  generationCount: number;
  warningsJson?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

interface Summons {
  id: string;
  caseId: string;
  templateId?: string | null;
  templateVersion?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function SummonsEditor() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isLoading: casesLoading, refetch } = useCases();
  const [summonsId, setSummonsId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [kantonDialogOpen, setKantonDialogOpen] = useState(false);
  const [kantonCheckResult, setKantonCheckResult] = useState<any>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  // Get selected case from localStorage
  const selectedCaseId = localStorage.getItem('selectedCaseId');
  
  // Get current case data
  const currentCase = useActiveCase();
  const caseId = currentCase?.id;
  
  // Kanton check mutation
  const analyzeMutation = useAnalyzeCase(caseId || "");
  
  // Parse kanton check result
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

  // Update kanton check result after mutation
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

  // Fetch or initialize summons for the selected case
  useEffect(() => {
    if (!selectedCaseId || !user || isInitializing || summonsId) return;

    const initializeSummons = async () => {
      try {
        setIsInitializing(true);

        // First, check if a multi-step summons already exists for this case
        const listResponse = await fetch(`/api/cases/${selectedCaseId}/summons-v2`);
        
        if (listResponse.status === 401) {
          setIsUnauthorized(true);
          setIsInitializing(false);
          return;
        }
        
        if (listResponse.ok) {
          const summonsList = await listResponse.json();
          
          // Find most recent in-progress or completed multi-step summons (templateVersion v4-multistep or v5-*)
          const existingSummons = summonsList.find((s: any) => 
            s.templateVersion && (
              s.templateVersion.startsWith('v4-') || 
              s.templateVersion.startsWith('v5-')
            )
          );
          
          if (existingSummons) {
            console.log('✅ Found existing summons, reusing:', existingSummons.id);
            setSummonsId(existingSummons.id);
            setIsInitializing(false);
            return;
          }
        }

        // No existing summons found, create a new one
        console.log('📝 No existing summons found, creating new one');
        const response = await fetch(`/api/cases/${selectedCaseId}/summons-v2/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            templateId: '2190d2b6-13d7-40c0-aab0-c9a0e4045075', // T-01 template ID
            userFields: {}
          })
        });

        if (response.status === 401) {
          setIsUnauthorized(true);
        } else if (response.ok) {
          const data = await response.json();
          setSummonsId(data.summonsId);
        } else {
          const errorData = await response.json().catch(() => ({}));
          toast({
            title: "Error",
            description: errorData.message || "Failed to initialize summons",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Error initializing summons:", error);
        const err = error as Error;
        if (isUnauthorizedError(err)) {
          setIsUnauthorized(true);
        } else {
          toast({
            title: "Error",
            description: "Failed to initialize summons",
            variant: "destructive"
          });
        }
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSummons();
  }, [selectedCaseId, user, toast, summonsId, isInitializing]);

  // Fetch sections for the summons
  const { data: sections, isLoading: sectionsLoading, error: sectionsError } = useQuery<SummonsSection[]>({
    queryKey: ['/api/cases', selectedCaseId, 'summons', summonsId, 'sections'],
    enabled: !!selectedCaseId && !!summonsId && !isUnauthorized,
    queryFn: async () => {
      const response = await fetch(`/api/cases/${selectedCaseId}/summons/${summonsId}/sections`);
      if (response.status === 401) {
        setIsUnauthorized(true);
        throw new Error('401: Unauthorized');
      }
      if (!response.ok) {
        throw new Error('Failed to fetch sections');
      }
      return response.json();
    }
  });
  
  // Check for unauthorized error in sections query
  useEffect(() => {
    if (sectionsError && isUnauthorizedError(sectionsError as Error)) {
      setIsUnauthorized(true);
    }
  }, [sectionsError]);

  // Generate section mutation
  const generateMutation = useMutation({
    mutationFn: async ({ sectionKey, userFeedback }: { sectionKey: string, userFeedback?: string }) => {
      return await apiRequest('POST', `/api/cases/${selectedCaseId}/summons/${summonsId}/sections/${sectionKey}/generate`, {
        userFields: {},
        previousSections: getSectionsContext(),
        userFeedback
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases', selectedCaseId, 'summons', summonsId, 'sections'] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        setIsUnauthorized(true);
      } else {
        toast({
          title: "Generation Error",
          description: error.message || "Failed to generate section",
          variant: "destructive"
        });
      }
    }
  });

  // Approve section mutation
  const approveMutation = useMutation({
    mutationFn: async (sectionKey: string) => {
      return await apiRequest('POST', `/api/cases/${selectedCaseId}/summons/${summonsId}/sections/${sectionKey}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases', selectedCaseId, 'summons', summonsId, 'sections'] });
      toast({
        title: "Section Approved",
        description: "Section has been approved"
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        setIsUnauthorized(true);
      } else {
        toast({
          title: "Approval Error",
          description: error.message || "Failed to approve section",
          variant: "destructive"
        });
      }
    }
  });

  // Reject section mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ sectionKey, feedback }: { sectionKey: string, feedback: string }) => {
      return await apiRequest('POST', `/api/cases/${selectedCaseId}/summons/${summonsId}/sections/${sectionKey}/reject`, {
        feedback
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases', selectedCaseId, 'summons', summonsId, 'sections'] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        setIsUnauthorized(true);
        return;
      }
      toast({
        title: "Rejection Error",
        description: error.message || "Failed to mark section as needs changes",
        variant: "destructive"
      });
    }
  });

  // Get context of approved sections for MindStudio
  const getSectionsContext = () => {
    if (!sections) return {};
    
    const context: Record<string, string> = {};
    sections.forEach(section => {
      if (section.status === "approved" && section.generatedText) {
        context[section.sectionKey] = section.generatedText;
      }
    });
    return context;
  };

  // Check if a section can be generated (gating logic)
  const canGenerateSection = (sectionKey: string, stepOrder: number) => {
    if (!sections || stepOrder === 1) return true; // First section (Aanzegging) is always available
    
    // Special workflow: CLAIMS (7) can be generated after FACTS (3)
    if (sectionKey === "CLAIMS") {
      const factsSection = sections.find(s => s.sectionKey === "FACTS");
      return factsSection?.status === "approved";
    }
    
    // Special workflow: LEGAL_GROUNDS (4) requires BOTH FACTS (3) AND CLAIMS (7)
    if (sectionKey === "LEGAL_GROUNDS") {
      const factsSection = sections.find(s => s.sectionKey === "FACTS");
      const claimsSection = sections.find(s => s.sectionKey === "CLAIMS");
      return factsSection?.status === "approved" && claimsSection?.status === "approved";
    }
    
    // Special workflow: DEFENSES (5) can be generated after LEGAL_GROUNDS (4)
    if (sectionKey === "DEFENSES") {
      const legalGroundsSection = sections.find(s => s.sectionKey === "LEGAL_GROUNDS");
      return legalGroundsSection?.status === "approved";
    }
    
    // Special workflow: EVIDENCE (6) can be generated after DEFENSES (5)
    if (sectionKey === "EVIDENCE") {
      const defensesSection = sections.find(s => s.sectionKey === "DEFENSES");
      return defensesSection?.status === "approved";
    }
    
    // Special workflow: EXHIBITS (8) can be generated after EVIDENCE (6)
    if (sectionKey === "EXHIBITS") {
      const evidenceSection = sections.find(s => s.sectionKey === "EVIDENCE");
      return evidenceSection?.status === "approved";
    }
    
    // Default: sequential workflow (section N requires section N-1)
    const previousSection = sections.find(s => s.stepOrder === stepOrder - 1);
    return previousSection?.status === "approved";
  };

  // Check if all sections are approved
  const allSectionsApproved = () => {
    if (!sections) return false;
    return sections.every(s => s.status === "approved");
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  // Unauthorized state
  if (isUnauthorized) {
    return <UnauthorizedMessage />;
  }

  // No case selected
  if (!selectedCaseId) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive" data-testid="alert-no-case">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Selecteer eerst een zaak om de dagvaarding editor te gebruiken.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Error state
  if (sectionsError) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive" data-testid="alert-sections-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Fout bij het laden van secties: {(sectionsError as Error).message}
          </AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()}>
          Pagina herladen
        </Button>
      </div>
    );
  }

  // Initializing or loading state
  if (isInitializing || sectionsLoading || !sections) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Dagvaarding initialiseren...</p>
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
        <a href="/dashboard">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </a>
      </Button>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3" data-testid="heading-summons-builder">
            <Scale className="h-8 w-8 text-primary" />
            Dagvaarding Opstellen
          </h1>
          <p className="text-muted-foreground">
            Genereer uw dagvaarding sectie voor sectie met AI-ondersteuning
          </p>
        </div>

        <div className="flex gap-2">
          <div className="lg:hidden">
            <AskJuristButton context="Dagvaarding" variant="outline" />
          </div>
          {allSectionsApproved() && (
            <>
              {isPreviewMode && (
                <Button variant="outline" onClick={() => setIsPreviewMode(false)} data-testid="button-back-to-edit">
                  Terug naar bewerken
                </Button>
              )}
              <Button 
                variant="default" 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setIsPreviewMode(true)}
                disabled={isPreviewMode}
                data-testid="button-compile-preview"
              >
                <FileText className="w-4 h-4 mr-2" />
                {isPreviewMode ? "Voorbeeld wordt weergegeven" : "Toon volledig voorbeeld"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KANTONZAAK CHECK STATUS BANNER */}
      <Dialog open={kantonDialogOpen} onOpenChange={setKantonDialogOpen}>
        <Alert 
          className={`mb-6 cursor-pointer transition-all ${
            kantonSuitable ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/30' :
            kantonNotSuitable ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/30' :
            'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/30'
          }`}
          onClick={() => setKantonDialogOpen(true)}
          data-testid="banner-kanton-check"
        >
          <div className="flex items-start gap-4">
            <div className="mt-0.5">
              {kantonSuitable ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : kantonNotSuitable ? (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              ) : analyzeMutation.isPending ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                <Scale className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-semibold text-base">
                  Kantonzaak check
                </h3>
                {parsedKantonCheck && (
                  <Badge 
                    variant={kantonSuitable ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {kantonSuitable ? 'Geschikt voor kantongerecht' : 'Niet geschikt voor kantongerecht'}
                  </Badge>
                )}
              </div>
              {parsedKantonCheck ? (
                <p className="text-sm text-muted-foreground">
                  {parsedKantonCheck.summary || parsedKantonCheck.decision || 'Klik voor volledige details'}
                </p>
              ) : analyzeMutation.isPending ? (
                <p className="text-sm text-muted-foreground">
                  Kantonzaak geschiktheid controleren...
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nog niet gecontroleerd. Klik om te controleren of uw zaak geschikt is voor het kantongerecht.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  analyzeMutation.mutate();
                }}
                disabled={analyzeMutation.isPending}
                data-testid="button-recheck-kanton-inline"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Controleren...
                  </>
                ) : (
                  <>
                    <Scale className="h-4 w-4 mr-2" />
                    {parsedKantonCheck ? 'Opnieuw' : 'Check nu'}
                  </>
                )}
              </Button>
              {parsedKantonCheck && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setKantonDialogOpen(true);
                  }}
                  data-testid="button-view-kanton-details"
                >
                  Details
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </Alert>

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

      {/* A4 Document Layout */}
      <A4Layout>
        {isPreviewMode ? (
          /* Preview Mode - Clean compiled document */
          <A4Page pageNumber={1}>
            <SectionHeading level={1}>DAGVAARDING</SectionHeading>
            <SectionBody>
              {SUMMONS_SECTIONS.map((sectionDef, idx) => {
                const section = sections.find(s => s.sectionKey === sectionDef.key);
                if (!section) return null;

                const text = sectionDef.isFixed 
                  ? FIXED_AANZEGGING_TEXT 
                  : section.generatedText;

                if (!text) return null;

                return (
                  <div key={section.id} className="mb-8" data-testid={`preview-section-${section.sectionKey}`}>
                    <h2 className="text-xl font-bold mb-4">{section.sectionName}</h2>
                    <div className="text-base leading-relaxed whitespace-pre-wrap">
                      {text}
                    </div>
                  </div>
                );
              })}
            </SectionBody>
          </A4Page>
        ) : (
          /* Edit Mode - Interactive sections */
          <A4Page pageNumber={1}>
            <SectionHeading level={1}>DAGVAARDING</SectionHeading>
            <SectionBody>
              {/* Progress indicator */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base">Voortgang</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {sections.filter(s => s.status === "approved").length} van {sections.length} secties goedgekeurd
                  </div>
                </CardContent>
              </Card>

              {/* Render all sections */}
              {SUMMONS_SECTIONS.map((sectionDef, idx) => {
                const section = sections.find(s => s.sectionKey === sectionDef.key);
                
                if (!section) return null;

                // Check if we should show the "Next: Generate Claims" indicator
                // Show it after FACTS (section 3) if FACTS is approved but CLAIMS is not
                const factsSection = sections.find(s => s.sectionKey === "FACTS");
                const claimsSection = sections.find(s => s.sectionKey === "CLAIMS");
                const showClaimsIndicator = 
                  sectionDef.key === "LEGAL_GROUNDS" && // Show before LEGAL_GROUNDS (section 4)
                  factsSection?.status === "approved" && 
                  claimsSection?.status !== "approved";

                // Fixed Aanzegging section
                if (sectionDef.isFixed) {
                  return (
                    <SectionBlock
                      key={section.id}
                      sectionKey={section.sectionKey}
                      sectionName={section.sectionName}
                      stepOrder={section.stepOrder}
                      status="approved"
                      generatedText={FIXED_AANZEGGING_TEXT}
                      isReadOnly={true}
                      onGenerate={async () => {}}
                      onApprove={async () => {}}
                      onNeedsChanges={() => {}}
                      onRevise={async () => {}}
                    />
                  );
                }

                // Dynamic sections
                const isDisabled = !canGenerateSection(section.sectionKey, section.stepOrder);

                const isGenerating = generateMutation.isPending && 
                                    generateMutation.variables?.sectionKey === section.sectionKey;
                
                // Check if this is the CLAIMS section and it should be highlighted
                const isClaimsHighlight = sectionDef.key === "CLAIMS" && showClaimsIndicator;

                return (
                  <div key={section.id}>
                    {/* Show "Next: Generate Claims" indicator before LEGAL_GROUNDS */}
                    {showClaimsIndicator && (
                      <Alert 
                        className="mb-6 bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 border-2"
                        data-testid="alert-next-step-claims"
                      >
                        <ArrowRight className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        <div className="ml-2">
                          <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                            Volgende stap: Genereer eerst Vorderingen
                          </h4>
                          <AlertDescription className="text-amber-800 dark:text-amber-200">
                            Nu de feiten zijn goedgekeurd, moet u eerst <strong>sectie 7 (Vorderingen / Petitum)</strong> genereren voordat u verder gaat met de andere secties. 
                            Scroll naar beneden naar sectie 7 en klik op "Genereer".
                          </AlertDescription>
                        </div>
                      </Alert>
                    )}

                    <div 
                      className={isClaimsHighlight ? "relative" : ""}
                      data-highlight-claims={isClaimsHighlight}
                    >
                      {isClaimsHighlight && (
                        <div className="absolute -inset-2 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg border-2 border-amber-400 dark:border-amber-600 animate-pulse pointer-events-none" />
                      )}
                      <div className="relative">
                        <SectionBlock
                          key={section.id}
                          sectionKey={section.sectionKey}
                          sectionName={section.sectionName}
                          stepOrder={section.stepOrder}
                          status={section.status}
                          generatedText={section.generatedText}
                          userFeedback={section.userFeedback}
                          warnings={section.warningsJson || undefined}
                          disabled={isDisabled}
                          isGenerating={isGenerating}
                          onGenerate={async () => {
                            await generateMutation.mutateAsync({ 
                              sectionKey: section.sectionKey 
                            });
                          }}
                          onApprove={async () => {
                            await approveMutation.mutateAsync(section.sectionKey);
                          }}
                          onNeedsChanges={() => {
                            // The SectionBlock component will handle showing the feedback form
                          }}
                          onRevise={async (feedback) => {
                            await rejectMutation.mutateAsync({
                              sectionKey: section.sectionKey,
                              feedback
                            });
                            // Then regenerate with feedback
                            await generateMutation.mutateAsync({
                              sectionKey: section.sectionKey,
                              userFeedback: feedback
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </SectionBody>
          </A4Page>
        )}
      </A4Layout>
    </div>
  );
}
