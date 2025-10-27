import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useAnalyzeCase, useFullAnalyzeCase, useGenerateLetter, useDeleteLetter, useOrderBailiff } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DocumentList from "@/components/DocumentList";
import DeadlineWarning from "@/components/DeadlineWarning";
import { Link, useLocation } from "wouter";
import { PlusCircle, Headset, MessageSquare, FileText, CheckCircle, Files, ArrowLeft, AlertCircle, FolderOpen } from "lucide-react";
import { RIcon } from "@/components/RIcon";
import { useActiveCase } from "@/contexts/CaseContext";

export default function MyCase() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [kantonCheckResult, setKantonCheckResult] = useState<any>(null);
  const [v2Analysis, setV2Analysis] = useState<any>(null);
  
  const [zaakgegevensOpen, setZaakgegevensOpen] = useState(false);
  
  const currentCase = useActiveCase();
  const caseId = currentCase?.id;

  const analyzeMutation = useAnalyzeCase(caseId || "");
  const fullAnalyzeMutation = useFullAnalyzeCase(caseId || "");
  const letterMutation = useGenerateLetter(caseId || "");
  const deleteLetterMutation = useDeleteLetter(caseId || "");
  const bailiffMutation = useOrderBailiff(caseId || "");

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

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "Niet opgegeven";
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR'
    }).format(parseFloat(amount));
  };

  const docCount = currentCase.documents?.length || 0;

  return (
    <div className="space-y-6">
      <DeadlineWarning caseId={currentCase.id} />
      
      <Button 
        variant="ghost" 
        size="sm" 
        asChild 
        className="mb-2"
        data-testid="button-back-to-dashboard"
      >
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Link>
      </Button>
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Mijn zaak</h2>
          <p className="text-muted-foreground">Overzicht van uw zaakgegevens</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <Dialog open={zaakgegevensOpen} onOpenChange={setZaakgegevensOpen}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow relative h-full" data-testid="card-zaakgegevens">
              <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
              <CardHeader>
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-center">Zaakgegevens</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {currentCase.title || "Geen titel"}
                </p>
                <Badge variant="outline" className="mt-2">
                  {currentCase.category || "Algemeen"}
                </Badge>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Zaakgegevens</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-foreground border-b pb-2">Zaak informatie</h3>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Titel</label>
                  <p className="text-sm text-foreground" data-testid="text-case-title">
                    {currentCase.title || "Geen titel"}
                  </p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Beschrijving</label>
                  <p className="text-sm text-foreground" data-testid="text-case-description">
                    {currentCase.description || "Geen beschrijving"}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Categorie</label>
                    <p className="text-sm text-foreground" data-testid="text-category">
                      {currentCase.category || "Algemeen"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Claim bedrag</label>
                    <p className="text-sm text-foreground" data-testid="text-claim-amount">
                      {formatCurrency(currentCase.claimAmount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t">
                <h3 className="font-semibold text-sm text-foreground border-b pb-2">Wederpartij gegevens</h3>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <p className="text-sm text-foreground" data-testid="text-counterparty-type">
                    {currentCase.counterpartyType === "company" ? "Bedrijf" : "Particulier"}
                  </p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Naam</label>
                  <p className="text-sm text-foreground" data-testid="text-counterparty-name">
                    {currentCase.counterpartyName || "Niet opgegeven"}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                    <p className="text-sm text-foreground truncate" data-testid="text-counterparty-email">
                      {currentCase.counterpartyEmail || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Telefoon</label>
                    <p className="text-sm text-foreground" data-testid="text-counterparty-phone">
                      {currentCase.counterpartyPhone || "-"}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Adres</label>
                  <p className="text-sm text-foreground" data-testid="text-counterparty-address">
                    {currentCase.counterpartyAddress || "Niet opgegeven"}
                  </p>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  setZaakgegevensOpen(false);
                  setLocation(`/edit-case/${currentCase.id}`);
                }}
                data-testid="button-edit-case"
              >
                Bewerken
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Link href="/dossier">
          <Card className={`cursor-pointer hover:shadow-lg transition-shadow relative h-full ${currentCase?.hasUnseenMissingItems ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/20' : ''}`} data-testid="card-documenten">
            <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
            <CardHeader>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${currentCase?.hasUnseenMissingItems ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-primary/10'}`}>
                <FolderOpen className={`h-8 w-8 ${currentCase?.hasUnseenMissingItems ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`} />
              </div>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                Dossier
                {currentCase?.hasUnseenMissingItems && (
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                    Nieuw
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-2xl font-bold text-foreground">{docCount}</p>
              <p className="text-sm text-muted-foreground mb-2">
                {docCount === 1 ? 'document' : 'documenten'} geüpload
              </p>
              {currentCase?.hasUnseenMissingItems && (
                <div className="flex items-start gap-2 mt-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded border border-amber-300 dark:border-amber-700">
                  <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200 font-medium text-left">
                    Nieuwe ontbrekende informatie na analyse! Klik om te bekijken.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

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
