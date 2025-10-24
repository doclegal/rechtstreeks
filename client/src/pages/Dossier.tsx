import { useAuth } from "@/hooks/useAuth";
import { useActiveCase } from "@/contexts/CaseContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DocumentList from "@/components/DocumentList";
import MissingInfo from "@/components/MissingInfo";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FileText, AlertCircle, Sparkles, AlertTriangle, CheckCircle } from "lucide-react";
import { RIcon } from "@/components/RIcon";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MissingRequirement } from "@shared/schema";
import { useMemo, useState } from "react";

export default function Dossier() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const currentCase = useActiveCase();
  const [checkedMissingInfo, setCheckedMissingInfo] = useState<any[] | null>(null);
  
  // Mutation to run missing info check
  const missingInfoCheckMutation = useMutation({
    mutationFn: async () => {
      if (!currentCase) throw new Error("No case selected");
      return await apiRequest("POST", `/api/cases/${currentCase.id}/missing-info-check`, {});
    },
    onSuccess: (data: any) => {
      console.log("✅ Missing info check completed:", data);
      if (data.missingInformation && Array.isArray(data.missingInformation)) {
        setCheckedMissingInfo(data.missingInformation);
        toast({
          title: "Dossier controle voltooid",
          description: `${data.missingInformation.length} ontbrekende ${data.missingInformation.length === 1 ? 'item' : 'items'} gevonden`
        });
      } else {
        setCheckedMissingInfo([]);
        toast({
          title: "Dossier controle voltooid",
          description: "Geen ontbrekende informatie gevonden"
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/cases", currentCase?.id] });
    },
    onError: (error: any) => {
      console.error("❌ Missing info check failed:", error);
      toast({
        title: "Dossier controle mislukt",
        description: error.message || "Er is een fout opgetreden bij de dossier controle",
        variant: "destructive"
      });
    }
  });

  // Extract missing requirements from case analysis (using same logic as Dashboard)
  const missingRequirements = useMemo(() => {
    // If we have fresh checked missing info, use that first
    if (checkedMissingInfo !== null) {
      return checkedMissingInfo.map((item: any, index: number) => ({
        id: item.id || `checked-${index}`,
        key: `missing-info-${index}`,
        label: item.item || item.question || 'Ontbrekende informatie',
        description: item.why_needed || item.reason || undefined,
        required: true,
        inputKind: 'both' as const,
        acceptMimes: undefined,
        maxLength: undefined,
        options: undefined,
        examples: undefined,
      }));
    }

    const fullAnalysis = currentCase?.fullAnalysis as any;
    const parsedAnalysis = fullAnalysis?.parsedAnalysis;
    const analysis = currentCase?.analysis as any;
    
    // Check if we have saved missing_information from database (from missing_info.flow)
    if (fullAnalysis?.missingInformation && Array.isArray(fullAnalysis.missingInformation)) {
      return fullAnalysis.missingInformation.map((item: any, index: number) => ({
        id: item.id || `saved-${index}`,
        key: `missing-info-saved-${index}`,
        label: item.item || item.question || 'Ontbrekende informatie',
        description: item.why_needed || item.reason || undefined,
        required: true,
        inputKind: 'both' as const,
        acceptMimes: undefined,
        maxLength: undefined,
        options: undefined,
        examples: undefined,
      }));
    }

    const dataSource = parsedAnalysis || analysis;
    if (!dataSource) return [];
    
    let questionsArray: any[] = [];
    
    // Try missing_info_struct with sections
    if (dataSource?.missing_info_struct && 
        Array.isArray(dataSource.missing_info_struct) && 
        dataSource.missing_info_struct.length > 0 &&
        dataSource.missing_info_struct.some((s: any) => s.sections)) {
      dataSource.missing_info_struct.forEach((struct: any) => {
        if (struct.sections && Array.isArray(struct.sections)) {
          struct.sections.forEach((section: any) => {
            if (section.items && Array.isArray(section.items)) {
              questionsArray.push(...section.items);
            }
          });
        }
      });
    } else if (dataSource?.missing_info_struct?.sections && Array.isArray(dataSource.missing_info_struct.sections)) {
      dataSource.missing_info_struct.sections.forEach((section: any) => {
        if (section.items && Array.isArray(section.items)) {
          questionsArray.push(...section.items);
        }
      });
    }
    
    // Try missing_essentials and clarifying_questions
    if (questionsArray.length === 0) {
      const missing = dataSource?.missing_essentials || [];
      const clarifying = dataSource?.clarifying_questions || [];
      
      if (Array.isArray(missing) || Array.isArray(clarifying)) {
        questionsArray = [
          ...(Array.isArray(missing) ? missing : []),
          ...(Array.isArray(clarifying) ? clarifying : [])
        ];
      }
    }
    
    // Try missing_info_for_assessment
    if (questionsArray.length === 0 && dataSource?.missing_info_for_assessment && Array.isArray(dataSource.missing_info_for_assessment)) {
      questionsArray = dataSource.missing_info_for_assessment;
    }
    
    // Convert questions to MissingRequirement format
    if (questionsArray.length > 0) {
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
    
    // Try evidence.missing
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
    
    // Try legacy missingDocsJson
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
  }, [currentCase?.analysis, currentCase?.fullAnalysis, checkedMissingInfo]);

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

  if (!user) {
    setLocation('/');
    return null;
  }

  if (!currentCase) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-4">Geen actieve zaak</h2>
          <p className="text-muted-foreground mb-6">
            Selecteer eerst een zaak om het dossier te bekijken.
          </p>
          <Button asChild data-testid="button-back-to-cases">
            <Link href="/cases">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Terug naar zaken
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const docCount = currentCase.documents?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation('/my-case')}
              data-testid="button-back-to-case"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Terug
            </Button>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Dossier</h2>
          <p className="text-muted-foreground">
            {currentCase.title || 'Uw zaak'}
          </p>
        </div>
        <RIcon size="md" className="opacity-10" />
      </div>

      {/* Info Alert */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <div className="space-y-1">
            <p className="font-semibold">Automatische documentanalyse</p>
            <p className="text-sm">
              Elk document wordt automatisch geanalyseerd na upload. U ziet direct onder elk document de AI-analyse met een samenvatting, tags en eventuele opmerkingen.
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {/* Documents Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documenten ({docCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {docCount === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                Nog geen documenten geüpload
              </p>
              <p className="text-sm text-muted-foreground">
                Upload documenten om ze te laten controleren
              </p>
            </div>
          ) : (
            <DocumentList 
              documents={currentCase.documents || []} 
              caseId={currentCase.id}
            />
          )}
        </CardContent>
      </Card>

      {/* Dossier Controle Button */}
      {currentCase.fullAnalysis && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Dossier Controle</h3>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                  Voer een automatische controle uit om ontbrekende informatie te identificeren op basis van uw analyse en juridisch advies.
                </p>
                <Button
                  onClick={() => missingInfoCheckMutation.mutate()}
                  disabled={missingInfoCheckMutation.isPending}
                  data-testid="button-run-missing-info-check"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {missingInfoCheckMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Bezig met controleren...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Start Dossier Controle
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ontbrekende Informatie Section */}
      {missingRequirements.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h3 className="text-lg font-semibold">Ontbrekende Informatie</h3>
          </div>
          
          <MissingInfo
            requirements={missingRequirements}
            caseId={currentCase.id}
            caseDocuments={currentCase.documents || []}
            onUpdated={() => {
              toast({
                title: "Informatie opgeslagen",
                description: "De antwoorden zijn succesvol opgeslagen. Start een nieuwe analyse om deze informatie te verwerken."
              });
            }}
          />
        </div>
      )}

      {/* Help text */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Upload alle relevante documenten voor uw zaak. Elk document wordt automatisch geanalyseerd
          om het type, inhoud en relevantie te bepalen. Dit helpt u te zorgen dat uw dossier compleet is.
        </AlertDescription>
      </Alert>
    </div>
  );
}
