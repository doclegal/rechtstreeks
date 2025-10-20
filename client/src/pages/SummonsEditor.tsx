import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { A4Layout, A4Page, SectionHeading, SectionBody } from "@/components/A4Layout";
import { SectionBlock } from "@/components/SectionBlock";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Scale, FileText, Download, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const [summonsId, setSummonsId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Get selected case from localStorage
  const selectedCaseId = localStorage.getItem('selectedCaseId');

  // Fetch or initialize summons for the selected case
  useEffect(() => {
    if (!selectedCaseId || !user || isInitializing || summonsId) return;

    const initializeSummons = async () => {
      try {
        setIsInitializing(true);

        // First, check if a multi-step summons already exists for this case
        const checkResponse = await fetch(`/api/cases/${selectedCaseId}`);
        if (checkResponse.ok) {
          const caseData = await checkResponse.json();
          
          // Try to find existing multi-step summons
          // This would require adding an endpoint to get summons by case
          // For now, we'll always create a new one if summonsId is not set
        }

        // Initialize new summons with the template
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

        if (response.ok) {
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
        toast({
          title: "Error",
          description: "Failed to initialize summons",
          variant: "destructive"
        });
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSummons();
  }, [selectedCaseId, user, toast, summonsId, isInitializing]);

  // Fetch sections for the summons
  const { data: sections, isLoading: sectionsLoading, error: sectionsError } = useQuery<SummonsSection[]>({
    queryKey: ['/api/cases', selectedCaseId, 'summons', summonsId, 'sections'],
    enabled: !!selectedCaseId && !!summonsId,
    queryFn: async () => {
      const response = await fetch(`/api/cases/${selectedCaseId}/summons/${summonsId}/sections`);
      if (!response.ok) {
        throw new Error('Failed to fetch sections');
      }
      return response.json();
    }
  });

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
      toast({
        title: "Generation Error",
        description: error.message || "Failed to generate section",
        variant: "destructive"
      });
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
      toast({
        title: "Approval Error",
        description: error.message || "Failed to approve section",
        variant: "destructive"
      });
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
  const canGenerateSection = (stepOrder: number) => {
    if (!sections || stepOrder === 1) return true; // First section (Aanzegging) is always available
    
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3" data-testid="heading-summons-builder">
            <Scale className="h-8 w-8 text-primary" />
            Dagvaarding Opstellen
          </h1>
          <p className="text-muted-foreground">
            Genereer uw dagvaarding sectie voor sectie met AI-ondersteuning
          </p>
        </div>

        {allSectionsApproved() && (
          <div className="flex gap-2">
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
          </div>
        )}
      </div>

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
                const isDisabled = !canGenerateSection(section.stepOrder);

                return (
                  <SectionBlock
                    key={section.id}
                    sectionKey={section.sectionKey}
                    sectionName={section.sectionName}
                    stepOrder={section.stepOrder}
                    status={section.status}
                    generatedText={section.generatedText}
                    userFeedback={section.userFeedback}
                    disabled={isDisabled}
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
                );
              })}
            </SectionBody>
          </A4Page>
        )}
      </A4Layout>
    </div>
  );
}
