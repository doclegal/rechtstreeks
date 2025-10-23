import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "wouter";
import { 
  CheckCircle, 
  FileText, 
  FileSearch, 
  Mail, 
  Scale,
  PlusCircle,
  Files
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { RIcon } from "@/components/RIcon";
import { useActiveCase } from "@/contexts/CaseContext";
import MissingInfo from "@/components/MissingInfo";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const currentCase = useActiveCase();
  const [nogAanTeLeverenOpen, setNogAanTeLeverenOpen] = useState(false);
  
  // Fetch saved responses for missing info
  const { data: savedResponsesData } = useQuery({
    queryKey: ['/api/cases', currentCase?.id, 'missing-info', 'responses'],
    enabled: !!currentCase?.id,
    queryFn: async () => {
      const res = await fetch(`/api/cases/${currentCase?.id}/missing-info/responses`);
      if (!res.ok) throw new Error('Failed to fetch responses');
      return res.json();
    }
  });

  const savedResponses = savedResponsesData?.responses || [];
  
  // Create a Set of valid document IDs for quick lookup
  const validDocumentIds = new Set((currentCase?.documents || []).map((doc: any) => doc.id));
  
  // Create a Map of saved responses for easy lookup
  const savedResponsesMap = new Map<string, any>();
  savedResponses.forEach((response: any) => {
    if (response.kind === 'document') {
      if (response.documentId && validDocumentIds.has(response.documentId)) {
        savedResponsesMap.set(response.requirementId, response);
      }
    } else {
      savedResponsesMap.set(response.requirementId, response);
    }
  });

  const missingRequirements = useMemo(() => {
    const fullAnalysis = currentCase?.fullAnalysis as any;
    const parsedAnalysis = fullAnalysis?.parsedAnalysis;
    const analysis = currentCase?.analysis as any;
    const dataSource = parsedAnalysis || analysis;
    if (!dataSource) return [];
    
    let questionsArray: any[] = [];
    
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
    
    if (questionsArray.length === 0 && dataSource?.missing_info_for_assessment && Array.isArray(dataSource.missing_info_for_assessment)) {
      questionsArray = dataSource.missing_info_for_assessment;
    }
    
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
  
  // Count only UNANSWERED required requirements
  const requiredCount = missingRequirements.filter((r: any) => {
    if (!r.required) return false;
    return !savedResponsesMap.has(r.id);
  }).length;

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

  // Extract data for status bar
  const caseData = currentCase as any;
  const createdAt = caseData.createdAt;
  const analysis = caseData.analysis || caseData.fullAnalysis;
  const analysisDate = analysis?.createdAt;
  const letters = caseData.letters || [];
  const lastLetter = letters.length > 0 ? letters[letters.length - 1] : null;
  const lastLetterDate = lastLetter?.createdAt;
  const summons = caseData.summons || [];
  const summonsDate = summons.length > 0 ? summons[0]?.createdAt : null;
  const status = caseData.status;
  const procedureStarted = status === 'FILED' || status === 'PROCEEDINGS_ONGOING' || status === 'JUDGMENT';
  const caseResolved = status === 'JUDGMENT';

  // Status bar stages
  const stages = [
    {
      label: "Zaak aangemaakt",
      date: createdAt,
      completed: !!createdAt
    },
    {
      label: "Analyse gedaan",
      date: analysisDate,
      completed: !!analysis
    },
    {
      label: "Laatste brief",
      date: lastLetterDate,
      completed: letters.length > 0
    },
    {
      label: "Dagvaarding opgesteld",
      date: summonsDate,
      completed: summons.length > 0
    },
    {
      label: "Procedure gestart",
      date: procedureStarted ? caseData.updatedAt : null,
      completed: procedureStarted
    },
    {
      label: "Zaak opgelost",
      date: caseResolved ? caseData.updatedAt : null,
      completed: caseResolved
    }
  ];

  // Format date helper
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), "d MMM yyyy", { locale: nl });
    } catch {
      return null;
    }
  };

  // Calculate summaries
  const caseTitle = caseData.title || "Geen titel";
  const counterparty = caseData.counterpartyName || "Niet opgegeven";
  const claimAmount = caseData.claimAmount ? `€ ${caseData.claimAmount}` : "Niet opgegeven";
  
  const hasAnalysis = !!analysis;
  const analysisStatus = hasAnalysis ? "Analyse voltooid" : "Nog geen analyse";
  
  const letterCount = letters.length;
  const letterStatus = letterCount > 0 
    ? `${letterCount} brief${letterCount > 1 ? 'ven' : ''} opgesteld` 
    : "Nog geen brieven";
  
  const summonsCount = summons.length;
  const summonsStatus = summonsCount > 0 
    ? "Dagvaarding opgesteld" 
    : "Nog geen dagvaarding";
  
  const procedureStatus = procedureStarted 
    ? (caseResolved ? "Zaak afgerond" : "Procedure aanhangig")
    : "Nog geen procedure";

  const docCount = caseData.documents?.length || 0;
  const dossierStatus = docCount > 0
    ? `${docCount} document${docCount > 1 ? 'en' : ''} geüpload`
    : "Nog geen documenten";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Overzicht van uw zaak: {caseTitle}
        </p>
      </div>

      {/* Status Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Voortgang</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stages.map((stage, index) => (
              <div key={index} className="text-center" data-testid={`status-stage-${index}`}>
                <div className="flex justify-center mb-2">
                  {stage.completed ? (
                    <CheckCircle className="h-8 w-8 text-primary" data-testid={`icon-completed-${index}`} />
                  ) : (
                    <RIcon size="md" className="opacity-30" data-testid={`icon-pending-${index}`} />
                  )}
                </div>
                <p className="text-xs font-medium text-foreground mb-1" data-testid={`label-${index}`}>
                  {stage.label}
                </p>
                {stage.date && (
                  <p className="text-xs text-muted-foreground" data-testid={`date-${index}`}>
                    {formatDate(stage.date)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Menu Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Mijn Zaak */}
        <Link href="/my-case" data-testid="tile-mijn-zaak">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Scale className="h-6 w-6 text-primary" />
                Mijn Zaak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Titel:</span>{" "}
                  <span className="font-medium" data-testid="summary-case-title">{caseTitle}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Wederpartij:</span>{" "}
                  <span className="font-medium" data-testid="summary-counterparty">{counterparty}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Bedrag:</span>{" "}
                  <span className="font-medium" data-testid="summary-claim-amount">{claimAmount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="font-medium" data-testid="summary-procedure-status">{procedureStatus}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Analyse */}
        <Link href="/analysis" data-testid="tile-analyse">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileSearch className="h-6 w-6 text-primary" />
                Analyse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="font-medium" data-testid="summary-analysis-status">{analysisStatus}</span>
                </div>
                {hasAnalysis && analysisDate && (
                  <div>
                    <span className="text-muted-foreground">Datum:</span>{" "}
                    <span className="font-medium" data-testid="summary-analysis-date">
                      {formatDate(analysisDate)}
                    </span>
                  </div>
                )}
                <p className="text-muted-foreground pt-2">
                  {hasAnalysis 
                    ? "Bekijk de juridische analyse van uw zaak"
                    : "Start een analyse om uw juridische positie te begrijpen"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Nog aan te leveren */}
        <Dialog open={nogAanTeLeverenOpen} onOpenChange={setNogAanTeLeverenOpen}>
          <DialogTrigger asChild>
            <Card 
              className={`cursor-pointer hover:shadow-lg transition-all relative h-full ${
                currentCase?.fullAnalysis && requiredCount === 0 
                  ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                  : ''
              }`}
              data-testid="tile-nog-aan-te-leveren"
            >
              <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <CheckCircle className={`h-6 w-6 ${
                    currentCase?.fullAnalysis && requiredCount === 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-primary'
                  }`} />
                  Nog aan te leveren
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentCase?.fullAnalysis ? (
                  <div className="space-y-2 text-sm">
                    {requiredCount === 0 && (
                      <Badge variant="default" className="mb-2 bg-green-600 dark:bg-green-700">
                        Compleet
                      </Badge>
                    )}
                    <div>
                      <p className="text-2xl font-bold text-foreground mb-1">{requiredCount}</p>
                      <p className="text-muted-foreground">
                        vereiste {requiredCount === 1 ? 'vraag' : 'vragen'}
                      </p>
                    </div>
                    <p className="text-muted-foreground pt-2">
                      {requiredCount === 0
                        ? "Alle vereiste informatie is aangeleverd"
                        : "Klik om vragen te beantwoorden"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground mb-2">
                      Nog niet geanalyseerd
                    </p>
                    <Badge variant="outline">Klik om te bekijken</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Wat we nog nodig hebben</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <MissingInfo 
                requirements={missingRequirements}
                caseId={currentCase?.id || ""}
                caseDocuments={currentCase?.documents || []}
                onUpdated={() => {
                  refetch();
                  setNogAanTeLeverenOpen(false);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Brieven */}
        <Link href="/letters" data-testid="tile-brieven">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Mail className="h-6 w-6 text-primary" />
                Brieven
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="font-medium" data-testid="summary-letters-status">{letterStatus}</span>
                </div>
                {letterCount > 0 && lastLetterDate && (
                  <div>
                    <span className="text-muted-foreground">Laatste brief:</span>{" "}
                    <span className="font-medium" data-testid="summary-last-letter-date">
                      {formatDate(lastLetterDate)}
                    </span>
                  </div>
                )}
                <p className="text-muted-foreground pt-2">
                  {letterCount > 0 
                    ? "Beheer en genereer juridische brieven"
                    : "Genereer juridische brieven voor uw zaak"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Dagvaarding */}
        <Link href="/summons" data-testid="tile-dagvaarding">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                Dagvaarding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="font-medium" data-testid="summary-summons-status">{summonsStatus}</span>
                </div>
                {summonsCount > 0 && summonsDate && (
                  <div>
                    <span className="text-muted-foreground">Datum:</span>{" "}
                    <span className="font-medium" data-testid="summary-summons-date">
                      {formatDate(summonsDate)}
                    </span>
                  </div>
                )}
                <p className="text-muted-foreground pt-2">
                  {summonsCount > 0 
                    ? "Bekijk uw dagvaarding documenten"
                    : "Genereer dagvaarding voor uw zaak"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Dossier */}
        <Link href="/dossier" data-testid="tile-dossier">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Files className="h-6 w-6 text-primary" />
                Dossier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="font-medium" data-testid="summary-dossier-status">{dossierStatus}</span>
                </div>
                {docCount > 0 && (
                  <div>
                    <span className="text-muted-foreground">Documenten:</span>{" "}
                    <span className="font-medium" data-testid="summary-doc-count">{docCount}</span>
                  </div>
                )}
                <p className="text-muted-foreground pt-2">
                  {docCount > 0 
                    ? "Bekijk documenten en controleer uw dossier"
                    : "Upload documenten voor uw zaak"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
