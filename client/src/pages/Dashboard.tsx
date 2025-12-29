import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  CheckCircle,
  FileText, 
  FileSearch, 
  Mail, 
  Scale,
  PlusCircle,
  FolderOpen,
  AlertCircle,
  UserCircle,
  Handshake
} from "lucide-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { RIcon } from "@/components/RIcon";
import { useActiveCase } from "@/contexts/CaseContext";
import { AskJuristDialog } from "@/components/AskJuristDialog";

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading } = useCases();
  const { toast } = useToast();
  const currentCase = useActiveCase();
  const [juristDialogOpen, setJuristDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
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
  // Check for analysis in Supabase (rkosAnalysis) first, then fall back to old local DB fields
  const analysis = caseData.rkosAnalysis || caseData.analysis || caseData.fullAnalysis;
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
      completed: !!createdAt,
      href: "/my-case"
    },
    {
      label: "Analyse gedaan",
      date: analysisDate,
      completed: !!analysis,
      href: "/analysis"
    },
    {
      label: "Onderhandelen",
      date: lastLetterDate,
      completed: letters.length > 0,
      href: "/letters"
    },
    /* Oplossen - Temporarily hidden
    {
      label: "Oplossen",
      date: null,
      completed: false,
      href: "/mediation"
    },
    */
    {
      label: "Dagvaarding opgesteld",
      date: summonsDate,
      completed: summons.length > 0,
      href: "/summons"
    },
    {
      label: "Procedure gestart",
      date: procedureStarted ? caseData.updatedAt : null,
      completed: procedureStarted,
      href: "/my-case"
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
          <CardTitle>Acties</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stages.map((stage, index) => (
              <Link key={index} href={stage.href} data-testid={`link-stage-${index}`}>
                <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" data-testid={`status-stage-${index}`}>
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
              </Link>
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
          <Card className={`hover:shadow-lg transition-shadow cursor-pointer h-full relative ${currentCase?.needsReanalysis ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20' : ''}`}>
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileSearch className={`h-6 w-6 ${currentCase?.needsReanalysis ? 'text-blue-600 dark:text-blue-400' : 'text-primary'}`} />
                Analyse
                {currentCase?.needsReanalysis && (
                  <Badge className="ml-auto bg-blue-500 hover:bg-blue-600 text-white">
                    Nieuw
                  </Badge>
                )}
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
                {currentCase?.needsReanalysis && (
                  <div className="flex items-start gap-2 mt-3 p-2 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-300 dark:border-blue-700">
                    <AlertCircle className="h-4 w-4 text-blue-700 dark:text-blue-300 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                      Nieuwe documenten of informatie toegevoegd! Heranalyse aanbevolen.
                    </p>
                  </div>
                )}
                <p className="text-muted-foreground pt-2">
                  {currentCase?.needsReanalysis 
                    ? "Voer opnieuw een analyse uit met de nieuwe gegevens"
                    : hasAnalysis 
                      ? "Bekijk de juridische analyse van uw zaak"
                      : "Start een analyse om uw juridische positie te begrijpen"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Dossier */}
        <Link href="/dossier" data-testid="tile-dossier">
          <Card className={`hover:shadow-lg transition-shadow cursor-pointer h-full relative ${currentCase?.hasUnseenMissingItems ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/20' : ''}`}>
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FolderOpen className={`h-6 w-6 ${currentCase?.hasUnseenMissingItems ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`} />
                Dossier
                {currentCase?.hasUnseenMissingItems && (
                  <Badge className="ml-auto bg-amber-500 hover:bg-amber-600 text-white">
                    Nieuw
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Documenten:</span>{" "}
                  <span className="font-medium" data-testid="summary-documents-count">
                    {currentCase?.documents?.length || 0}
                  </span>
                </div>
                {currentCase?.hasUnseenMissingItems && (
                  <div className="flex items-start gap-2 mt-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded border border-amber-300 dark:border-amber-700">
                    <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                      Nieuwe ontbrekende informatie na analyse! Klik om te bekijken.
                    </p>
                  </div>
                )}
                <p className="text-muted-foreground pt-2">
                  {currentCase?.hasUnseenMissingItems 
                    ? "Bekijk en vul ontbrekende informatie aan"
                    : "Beheer uw documenten en dossier"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Onderhandelen */}
        <Link href="/letters" data-testid="tile-brieven">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Mail className="h-6 w-6 text-primary" />
                Onderhandelen
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

        {/* Oplossen - Temporarily hidden
        <Link href="/mediation" data-testid="tile-oplossen">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Handshake className="h-6 w-6 text-primary" />
                Oplossen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="font-medium" data-testid="summary-mediation-status">Binnenkort beschikbaar</span>
                </div>
                <p className="text-muted-foreground pt-2">
                  Probeer het geschil op te lossen via online mediation, voordat u naar de rechter gaat
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        */}

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

        {/* Vraag een jurist - Opvallend block */}
        <Card 
          className="hover:shadow-lg transition-shadow cursor-pointer h-full relative bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-300 dark:border-blue-700"
          onClick={() => setJuristDialogOpen(true)}
          data-testid="tile-vraag-jurist"
        >
          <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <UserCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              Vraag een jurist
              <Badge className="ml-auto bg-blue-500 hover:bg-blue-600 text-white">
                Nieuw
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Heeft u vragen over uw zaak?
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Een ervaren jurist staat klaar om uw juridische vragen te beantwoorden. Klik hier voor direct contact.
              </p>
              <div className="pt-2">
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setJuristDialogOpen(true);
                  }}
                  data-testid="button-ask-jurist-dashboard"
                >
                  <UserCircle className="h-4 w-4 mr-2" />
                  Stel uw vraag
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ask Jurist Dialog */}
      <AskJuristDialog 
        open={juristDialogOpen} 
        onOpenChange={setJuristDialogOpen}
        context="Dashboard"
      />
    </div>
  );
}
