import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useAnalyzeCase, useFullAnalyzeCase, useGenerateLetter, useDeleteLetter, useOrderBailiff } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MissingInfo from "@/components/MissingInfo";
import MissingInfoRefineForm from "@/components/MissingInfoRefineForm";
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
  const [v2Analysis, setV2Analysis] = useState<any>(null); // Second run analysis results
  
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
    // Priority 1: Check fullAnalysis.parsedAnalysis (from full analysis)
    const fullAnalysis = currentCase?.fullAnalysis as any;
    const parsedAnalysis = fullAnalysis?.parsedAnalysis;
    
    // Priority 2: Fall back to analysis (from kanton check)
    const analysis = currentCase?.analysis as any;
    
    // Prefer parsedAnalysis from full analysis, fall back to kanton check analysis
    const dataSource = parsedAnalysis || analysis;
    if (!dataSource) return [];
    
    // Try new format first: missing_info_for_assessment (MindStudio format)
    if (dataSource?.missing_info_for_assessment && Array.isArray(dataSource.missing_info_for_assessment)) {
      return dataSource.missing_info_for_assessment.map((item: any, index: number) => {
        // Map answer_type to inputKind
        let inputKind: 'text' | 'document' | 'both' = 'text';
        if (item.answer_type === 'file_upload') {
          inputKind = 'document';
        } else if (item.answer_type === 'text') {
          inputKind = 'text';
        } else if (item.answer_type === 'multiple_choice') {
          inputKind = 'text'; // multiple_choice uses text input with options
        }
        
        // Parse expected field - can be string (description) or array (options)
        let description: string | undefined;
        let options: Array<{value: string, label: string}> | undefined;
        
        if (typeof item.expected === 'string') {
          description = item.expected;
        } else if (Array.isArray(item.expected)) {
          // Convert string array to {value, label} objects
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
          required: item.required !== false, // default to true
          inputKind: inputKind,
          acceptMimes: item.accept_mimes || item.acceptMimes || undefined,
          maxLength: item.max_length || item.maxLength || undefined,
          options: options || item.options || undefined,
          examples: typeof item.expected === 'string' ? [item.expected] : item.examples || undefined,
        };
      });
    }
    
    // Try MindStudio evidence.missing format
    if (dataSource?.evidence?.missing && Array.isArray(dataSource.evidence.missing)) {
      return dataSource.evidence.missing.map((item: any, index: number) => {
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
      
      {/* Main Content - Case Information */}
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
