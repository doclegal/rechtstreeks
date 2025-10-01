import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useAnalyzeCase, useFullAnalyzeCase, useGenerateLetter, useDeleteLetter, useOrderBailiff } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MissingInfo from "@/components/MissingInfo";
import DocumentList from "@/components/DocumentList";
import AnalysisResults from "@/components/AnalysisResults";
import GeneratedDocuments from "@/components/GeneratedDocuments";
import ProcessTimeline from "@/components/ProcessTimeline";
import CaseInfo from "@/components/CaseInfo";
import DeadlineWarning from "@/components/DeadlineWarning";
import { Link, useLocation } from "wouter";
import { PlusCircle, Headset, MessageSquare, ArrowLeft } from "lucide-react";

export default function MyCase() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: cases, isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [kantonCheckResult, setKantonCheckResult] = useState<any>(null);
  
  // For MVP, we'll use the first case as the main case
  const currentCase = Array.isArray(cases) && cases.length > 0 ? cases[0] : undefined;
  const caseId = currentCase?.id;

  const analyzeMutation = useAnalyzeCase(caseId || "");
  const fullAnalyzeMutation = useFullAnalyzeCase(caseId || "");
  const letterMutation = useGenerateLetter(caseId || "");
  const deleteLetterMutation = useDeleteLetter(caseId || "");
  const bailiffMutation = useOrderBailiff(caseId || "");

  // Transform missing_info_for_assessment to MissingRequirement[] format
  // Must be called before any conditional returns to maintain hook order
  const missingRequirements = useMemo(() => {
    if (!currentCase?.analysis) return [];
    
    const analysis = currentCase.analysis as any;
    
    // Try new format first: missing_info_for_assessment
    if (analysis?.missing_info_for_assessment && Array.isArray(analysis.missing_info_for_assessment)) {
      return analysis.missing_info_for_assessment.map((item: any, index: number) => ({
        id: item.id || `req-${index}`,
        key: item.key || item.id || `requirement-${index}`,
        label: item.label || item.question || 'Vraag zonder label',
        description: item.description || item.reason || undefined,
        required: item.required !== false, // default to true
        inputKind: item.input_kind || item.inputKind || (item.type === 'document' ? 'document' : 'text'),
        acceptMimes: item.accept_mimes || item.acceptMimes || undefined,
        maxLength: item.max_length || item.maxLength || undefined,
        options: item.options || undefined,
        examples: item.examples || undefined,
      }));
    }
    
    // Try MindStudio evidence.missing format
    if (analysis?.evidence?.missing && Array.isArray(analysis.evidence.missing)) {
      return analysis.evidence.missing.map((item: any, index: number) => {
        // evidence.missing items are strings like "Bewijs van waarschuwing aan verkoper"
        if (typeof item === 'string') {
          return {
            id: `evidence-${index}`,
            key: `evidence-requirement-${index}`,
            label: item,
            description: 'Upload het gevraagde document om uw zaak te versterken',
            required: false, // evidence is usually optional
            inputKind: 'document' as const,
            acceptMimes: undefined,
            maxLength: undefined,
            options: undefined,
            examples: undefined,
          };
        }
        // If it's an object, use its properties
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
    
    // Fallback to legacy format: missingDocsJson (string array)
    if (analysis?.missingDocsJson && Array.isArray(analysis.missingDocsJson)) {
      return analysis.missingDocsJson.map((label: string, index: number) => ({
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
  }, [currentCase?.analysis]);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Reset expanded section when navigating back to /my-case
  useEffect(() => {
    if (location === '/my-case' || location === '/') {
      setExpandedSection(null);
    }
  }, [location]);

  // Store kanton check result and refresh case data after successful analysis
  useEffect(() => {
    if (analyzeMutation.isSuccess && analyzeMutation.data) {
      // Store the kanton check result
      if (analyzeMutation.data.kantonCheck) {
        setKantonCheckResult(analyzeMutation.data.kantonCheck);
      }
      
      // Small delay to ensure DB is updated before refetch
      setTimeout(() => {
        refetch();
      }, 500);
    }
  }, [analyzeMutation.isSuccess, analyzeMutation.data, refetch]);

  // Refresh case data after successful full analysis
  useEffect(() => {
    if (fullAnalyzeMutation.isSuccess) {
      // Small delay to ensure DB is updated before refetch
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
          <div className="flex gap-2">
            <Button 
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              size="sm"
              variant={currentCase.analysis ? "outline" : "default"}
              className="flex-1"
            >
              {analyzeMutation.isPending ? "Analyseren..." : currentCase.analysis ? "Heranalyseren" : "Start analyse"}
            </Button>
            <Button 
              onClick={() => toggleSection('analyse')}
              size="sm"
              variant={expandedSection === 'analyse' ? "outline" : "default"}
              className="px-3"
            >
              Open
            </Button>
          </div>
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
          <div className="flex gap-2">
            <Button 
              onClick={() => toggleSection('brief')}
              disabled={!currentCase.analysis}
              size="sm"
              variant={(currentCase.letters?.length || 0) > 0 ? "outline" : "default"}
              className="flex-1"
            >
              {(currentCase.letters?.length || 0) > 0 ? "Nieuwe brief" : "Genereer brief"}
            </Button>
            <Button 
              onClick={() => toggleSection('brief')}
              size="sm"
              variant={expandedSection === 'brief' ? "outline" : "default"}
              className="px-3"
            >
              Open
            </Button>
          </div>
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
              className="flex-1"
            >
              {(currentCase.summons?.length || 0) > 0 ? "Nieuwe dagvaarding" : "Opstellen dagvaarding"}
            </Button>
            <Button 
              onClick={() => toggleSection('dagvaarding')}
              size="sm"
              variant={expandedSection === 'dagvaarding' ? "outline" : "default"}
              className="px-3"
            >
              Open
            </Button>
          </div>
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
            
            {/* Missing Info Section */}
            {missingRequirements.length > 0 && (
              <MissingInfo 
                requirements={missingRequirements}
                caseId={currentCase.id}
                onUpdated={() => refetch()}
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
            <div className="border rounded-lg p-6 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Juridische Analyse Resultaten</h2>
                <Button 
                  onClick={() => setExpandedSection(null)}
                  size="sm"
                  variant="outline"
                >
                  Terug naar Mijn zaak
                </Button>
              </div>
              <AnalysisResults 
                analysis={currentCase.kantonAnalysis || currentCase.analysis}
                fullAnalysis={currentCase.fullAnalysis}
                kantonCheck={kantonCheckResult}
                onAnalyze={() => analyzeMutation.mutate()}
                isAnalyzing={analyzeMutation.isPending}
                hasNewInfo={(() => {
                  const relevantAnalysis = currentCase.kantonAnalysis || currentCase.analysis;
                  if (!relevantAnalysis || !currentCase.updatedAt) return false;
                  if (analyzeMutation.isPending) return false;
                  if (analyzeMutation.isSuccess) return false;
                  
                  const caseUpdated = new Date(currentCase.updatedAt);
                  const analysisCreated = new Date(relevantAnalysis.createdAt);
                  const timeDiff = caseUpdated.getTime() - analysisCreated.getTime();
                  return timeDiff > 1000;
                })()}
                caseId={currentCase.id}
                onFullAnalyze={() => fullAnalyzeMutation.mutate()}
                isFullAnalyzing={fullAnalyzeMutation.isPending}
              />
            </div>
          </div>
        )}

        {/* Expandable Section: Gegenereerde Documenten */}
        {expandedSection === 'brief' && (
          <div className="space-y-6">
            <div className="border rounded-lg p-6 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Gegenereerde Documenten</h2>
                <Button 
                  onClick={() => setExpandedSection(null)}
                  size="sm"
                  variant="outline"
                >
                  Terug naar Mijn zaak
                </Button>
              </div>
              <GeneratedDocuments 
                letters={currentCase.letters || []}
                summons={currentCase.summons || []}
                caseId={currentCase.id}
                onGenerateLetter={(briefType, tone) => {
                  letterMutation.mutate({ briefType, tone });
                }}
                onDeleteLetter={(letterId) => {
                  deleteLetterMutation.mutate(letterId);
                }}
                isGenerating={letterMutation.isPending}
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
                <Button 
                  onClick={() => setExpandedSection(null)}
                  size="sm"
                  variant="outline"
                >
                  Terug naar Mijn zaak
                </Button>
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
