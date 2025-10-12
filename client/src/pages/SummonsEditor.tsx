import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { useActiveCase } from "@/contexts/CaseContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Scale, PlusCircle, FileText, AlertCircle, Loader2, Download } from "lucide-react";
import { SummonsTemplateV2 } from "@/components/SummonsTemplateV2";
import { SummonsTemplateV1 } from "@/components/SummonsTemplateV1";
import { SummonsTemplateV3 } from "@/components/SummonsTemplateV3";
import { DynamicTemplateRenderer } from "@/components/DynamicTemplateRenderer";
import { TemplateDetailView } from "@/components/TemplateDetailView";
import { MultiStepSummonsWorkflow } from "@/components/MultiStepSummonsWorkflow";
import { UserFields, AIFields, userFieldsSchema } from "@shared/summonsFields";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";

export default function SummonsEditor() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading } = useCases();
  const { toast } = useToast();
  const currentCase = useActiveCase();
  const caseId = currentCase?.id;

  const [userFields, setUserFields] = useState<Partial<UserFields>>({});
  const [aiFields, setAIFields] = useState<Partial<AIFields>>({});
  const [activeTab, setActiveTab] = useState<"template" | "form">("form");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);

  // Fetch available templates
  const { data: templates, isLoading: templatesLoading } = useQuery<any[]>({
    queryKey: ["/api/templates", "summons"],
    queryFn: async () => {
      const response = await fetch("/api/templates?kind=summons");
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  });

  // Set default template when templates load or when selected template no longer exists
  useEffect(() => {
    if (templates && templates.length > 0) {
      if (!selectedTemplateId) {
        // No template selected, select first one
        setSelectedTemplateId(templates[0].id);
      } else if (!templates.find(t => t.id === selectedTemplateId)) {
        // Selected template no longer exists (e.g., was deleted), select first available
        setSelectedTemplateId(templates[0].id);
      }
    }
  }, [templates, selectedTemplateId]);

  // Fetch existing summons for this case
  const { data: existingSummons } = useQuery<any[]>({
    queryKey: ["/api/cases", caseId, "summons-v2"],
    enabled: !!caseId,
    retry: false,
  });

  // Load existing data if available
  useEffect(() => {
    if (existingSummons && Array.isArray(existingSummons) && existingSummons.length > 0) {
      const latest = existingSummons[0];
      if (latest.userFieldsJson) {
        setUserFields(latest.userFieldsJson);
      }
      if (latest.aiFieldsJson) {
        setAIFields(latest.aiFieldsJson);
      }
    }
  }, [existingSummons]);

  // Pre-fill user fields from case data
  useEffect(() => {
    if (currentCase && Object.keys(userFields).length === 0) {
      setUserFields({
        eiser_naam: "Rechtstreeks.ai B.V.",
        eiser_plaats: "Amsterdam",
        gedaagde_naam: currentCase.defendantName || "",
        gedaagde_adres: currentCase.defendantAddress || "",
        onderwerp: currentCase.title || "",
        ...userFields
      });
    }
  }, [currentCase]);

  const handleUserFieldChange = (key: keyof UserFields, value: string | number) => {
    // Convert to number if field expects a number
    const numericFields = ['hoofdsom', 'rente_bedrag', 'incassokosten', 'salaris_gemachtigde', 'kosten_dagvaarding'];
    const finalValue = numericFields.includes(key) && typeof value === 'string' 
      ? (value === '' ? 0 : parseFloat(value) || 0)
      : value;
    setUserFields(prev => ({ ...prev, [key]: finalValue }));
  };

  const handleSaveDraft = async () => {
    try {
      const response = await apiRequest("POST", `/api/cases/${caseId}/summons-v2/draft`, {
        userFields,
        aiFields
      });
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "summons-v2"] });
        toast({
          title: "Concept opgeslagen",
          description: "Uw wijzigingen zijn opgeslagen",
        });
      }
    } catch (error) {
      toast({
        title: "Opslaan mislukt",
        description: "Er is een fout opgetreden bij het opslaan",
        variant: "destructive",
      });
    }
  };

  const handleGenerate = async () => {
    // Validate user fields
    const validation = userFieldsSchema.safeParse(userFields);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: "Velden niet compleet",
        description: `${firstError.path[0]}: ${firstError.message}`,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Send user fields and template ID to MindStudio
      const response = await apiRequest("POST", `/api/cases/${caseId}/summons-v2/generate`, {
        userFields,
        templateId: selectedTemplateId
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Check if this is a multi-step workflow (response has summonsId but no aiFields)
        if (data.summonsId && !data.aiFields) {
          // Multi-step workflow started
          queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "summons-v2"] });
          
          toast({
            title: "7-Stappen Workflow gestart",
            description: `${data.sectionCount} secties zijn klaar om gegenereerd te worden.`,
          });
        } else {
          // Single-step workflow - update AI fields
          setAIFields(data.aiFields);
          
          queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "summons-v2"] });
          
          toast({
            title: "Dagvaarding gegenereerd",
            description: "AI heeft de ontbrekende secties ingevuld",
          });
          
          // Switch to template view
          setActiveTab("template");
        }
      } else {
        throw new Error(data.message || "Generatie mislukt");
      }
    } catch (error: any) {
      toast({
        title: "Generatie mislukt",
        description: error.message || "Er is een fout opgetreden bij het genereren",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    window.print();
  };

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

  const hasAnalysis = !!(currentCase as any).analysis || !!(currentCase as any).fullAnalysis;

  if (!hasAnalysis) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Scale className="h-8 w-8 text-primary" />
            Dagvaarding
          </h1>
          <p className="text-muted-foreground">
            Genereer de officiële dagvaarding voor uw juridische procedure
          </p>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Nog geen analyse beschikbaar
              </h3>
              <p className="text-muted-foreground mb-6">
                Upload eerst documenten en voer een analyse uit voordat u een dagvaarding kunt genereren.
              </p>
              <Button asChild data-testid="button-go-to-case">
                <Link href="/my-case">
                  Naar Mijn Zaak
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Scale className="h-8 w-8 text-primary" />
            Dagvaarding Editor
          </h1>
          <p className="text-muted-foreground">
            Vul de gegevens in en genereer een officiële dagvaarding
          </p>
        </div>
        
        {selectedTemplateId && templates && (() => {
          const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
          const isMultiStep = selectedTemplate?.sectionsConfig && Array.isArray(selectedTemplate.sectionsConfig) && selectedTemplate.sectionsConfig.length > 0;
          
          // Don't show single-step buttons for multi-step templates
          if (isMultiStep) {
            return null;
          }
          
          return (
            <div className="flex gap-3">
              <Button onClick={handleSaveDraft} variant="outline" data-testid="button-save-draft">
                <FileText className="h-4 w-4 mr-2" />
                Concept opslaan
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating} data-testid="button-generate">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Genereren...
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Genereer dagvaarding
                  </>
                )}
              </Button>
              <Button onClick={handleDownloadPDF} variant="outline" data-testid="button-download-pdf">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          );
        })()}
      </div>

      {/* Template Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="template-select">Kies dagvaarding template</Label>
            <Select 
              value={selectedTemplateId} 
              onValueChange={setSelectedTemplateId}
              disabled={templatesLoading}
            >
              <SelectTrigger id="template-select" data-testid="select-template">
                <SelectValue placeholder="Selecteer een template..." />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id} data-testid={`template-option-${template.version}`}>
                    {template.name} ({template.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplateId && templates && (
              <p className="text-sm text-muted-foreground mt-2">
                Geselecteerd: {templates.find(t => t.id === selectedTemplateId)?.name}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Template Detail View */}
      {selectedTemplateId && templates && templates.find(t => t.id === selectedTemplateId) && (user as any)?.role === 'admin' && (
        <TemplateDetailView 
          template={templates.find(t => t.id === selectedTemplateId)!}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
          }}
        />
      )}

      {selectedTemplateId && templates && (() => {
        const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
        const isMultiStep = selectedTemplate?.sectionsConfig && Array.isArray(selectedTemplate.sectionsConfig) && selectedTemplate.sectionsConfig.length > 0;
        const hasSummons = existingSummons && existingSummons.length > 0;
        
        // Multi-step workflow - if summons exists, show workflow with toggle for template preview
        if (isMultiStep && hasSummons) {
          return (
            <>
              {!showTemplatePreview && (
                <Card className="border-primary mb-4">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Actieve workflow voor deze template. Klik op "Bekijk Template" om de volledige dagvaarding tekst te zien.
                      </p>
                      <Button variant="outline" onClick={() => setShowTemplatePreview(true)} data-testid="button-view-template">
                        <FileText className="h-4 w-4 mr-2" />
                        Bekijk Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {showTemplatePreview && (
                <>
                  {/* Info box */}
                  <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 mb-4">
                    <CardContent className="py-4">
                      <div className="flex gap-3 items-center justify-between">
                        <div className="flex gap-3">
                          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                              Template Voorbeeld
                            </h4>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              Dit is de volledige dagvaarding template. Klik op "Terug naar Workflow" om door te gaan.
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" onClick={() => setShowTemplatePreview(false)}>
                          Terug naar Workflow
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Template Preview */}
                  <Card className="mb-4">
                    <CardContent className="py-6">
                      {selectedTemplate?.rawTemplateText && (
                        <DynamicTemplateRenderer
                          templateText={selectedTemplate.rawTemplateText}
                          userFields={userFields}
                          aiFields={{}}
                          onUserFieldChange={(key, value) => setUserFields(prev => ({ ...prev, [key]: value }))}
                          editable={true}
                        />
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
              
              {!showTemplatePreview && (
                <MultiStepSummonsWorkflow
                  caseId={caseId!}
                  summonsId={existingSummons[0].id}
                  templateId={selectedTemplateId}
                />
              )}
            </>
          );
        }
        
        // Multi-step workflow - if no summons exists, show template preview with start button
        if (isMultiStep && (!existingSummons || existingSummons.length === 0)) {
          return (
            <>
              {/* Info box */}
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                <CardContent className="py-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                        7-Stappen Dagvaarding Workflow
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Vul eerst de <strong>gele gebruikersvelden</strong> in hieronder. Start daarna de workflow om de <strong>7 AI-secties</strong> stap voor stap te laten genereren en goed te keuren.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Template Preview */}
              <Card>
                <CardContent className="py-6">
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Gele velden</strong> zijn gebruikersvelden die u nu kunt invullen. <strong>Oranje AI-velden</strong> worden stap voor stap gegenereerd na het starten van de workflow.
                    </p>
                  </div>
                  {selectedTemplate?.rawTemplateText ? (
                    <DynamicTemplateRenderer
                      templateText={selectedTemplate.rawTemplateText}
                      userFields={userFields}
                      aiFields={{}}
                      onUserFieldChange={(key, value) => setUserFields(prev => ({ ...prev, [key]: value }))}
                      editable={true}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        Template tekst wordt geladen... (Template ID: {selectedTemplateId})
                      </p>
                      {selectedTemplate && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Debug: Template naam: {selectedTemplate.name}, heeft rawTemplateText: {selectedTemplate.rawTemplateText ? 'ja' : 'nee'}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Start Workflow Button */}
              <Card className="border-primary">
                <CardContent className="py-8 text-center">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Klaar om te starten?
                  </h3>
                  <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                    Controleer of alle gele velden zijn ingevuld. Klik dan op de knop om de 7-stappen workflow te starten.
                  </p>
                  <Button onClick={handleGenerate} disabled={isGenerating} size="lg" data-testid="button-start-multistep">
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Workflow starten...
                      </>
                    ) : (
                      <>
                        <PlusCircle className="h-5 w-5 mr-2" />
                        Start 7-Stappen Workflow
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </>
          );
        }
        
        // Single-step workflow
        return (
          <>
            {/* Info box */}
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
              <CardContent className="py-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                      Hoe werkt het?
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Vul de <strong>blauwe velden</strong> (uw gegevens) in. De <strong>gele velden</strong> worden automatisch door AI gegenereerd op basis van uw zaakanalyse. Alle vaste tekst blijft ongewijzigd volgens het officiële Model dagvaarding.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dagvaarding Editor */}
            <div className="mt-6">
              <Card>
                <CardContent className="py-6">
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Gele velden</strong> kun je direct invullen in de dagvaarding hieronder. Klik op een geel veld om te bewerken. <strong>Gele velden met AI-tekst</strong> worden automatisch gegenereerd wanneer u op "Genereer dagvaarding" klikt.
                    </p>
                  </div>
                  {(() => {
                    // Use dynamic renderer if template has rawTemplateText
                    if (selectedTemplate?.rawTemplateText) {
                      return (
                        <DynamicTemplateRenderer
                          templateText={selectedTemplate.rawTemplateText}
                          userFields={userFields}
                          aiFields={aiFields}
                          onUserFieldChange={(key, value) => setUserFields(prev => ({ ...prev, [key]: value }))}
                          editable={true}
                        />
                      );
                    }
                    
                    // Fall back to versioned templates for legacy support
                    if (selectedTemplate?.version === 'v1') {
                      return (
                        <SummonsTemplateV1
                          userFields={userFields}
                          aiFields={aiFields}
                          onUserFieldChange={handleUserFieldChange}
                          editable={true}
                          templateId={selectedTemplateId}
                        />
                      );
                    } else if (selectedTemplate?.version === 'v3') {
                      return (
                        <SummonsTemplateV3
                          userFields={userFields}
                          aiFields={aiFields}
                          onUserFieldChange={handleUserFieldChange}
                          editable={true}
                        />
                      );
                    } else {
                      return (
                        <SummonsTemplateV2
                          userFields={userFields}
                          aiFields={aiFields}
                          onUserFieldChange={handleUserFieldChange}
                          editable={true}
                        />
                      );
                    }
                  })()}
                </CardContent>
              </Card>
            </div>
          </>
        );
      })()}
    </div>
  );
}
