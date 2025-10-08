import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useGenerateSummons, useDeleteSummons } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Link } from "wouter";
import { FileText, PlusCircle, Download, Scale, AlertCircle } from "lucide-react";
import { RIcon } from "@/components/RIcon";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useActiveCase } from "@/contexts/CaseContext";
import { SummonsTemplate } from "@/components/SummonsTemplate";

export default function Summons() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading } = useCases();
  const { toast } = useToast();
  
  const currentCase = useActiveCase();
  const caseId = currentCase?.id;

  const summonsMutation = useGenerateSummons(caseId || "");
  const deleteSummonsMutation = useDeleteSummons(caseId || "");

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

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

  const handleGenerateSummons = () => {
    summonsMutation.mutate(undefined, {
      onSuccess: () => {
        setGenerateDialogOpen(false);
      },
    });
  };

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

  const summonsList = (currentCase as any).summons || [];
  const hasAnalysis = !!(currentCase as any).analysis || !!(currentCase as any).fullAnalysis;

  // Get the latest summons (clone array before sorting to maintain immutability)
  const latestSummons = summonsList.length > 0 
    ? [...summonsList].sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0]
    : null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), "d MMMM yyyy", { locale: nl });
    } catch {
      return null;
    }
  };

  const handleDownload = (summons: any) => {
    if (summons.pdfStorageKey) {
      window.open(`/api/files/${summons.pdfStorageKey}`, '_blank');
    } else {
      // Generate PDF from template
      const printWindow = window.open('', '_blank');
      if (printWindow && summons.dataJson) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Dagvaarding</title>
            <style>
              @page { size: A4; margin: 2.5cm; }
              body { font-family: 'Times New Roman', Times, serif; }
            </style>
          </head>
          <body>
            <div id="root"></div>
          </body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    }
  };

  const handleDelete = (summonsId: string) => {
    if (confirm("Weet u zeker dat u deze dagvaarding wilt verwijderen?")) {
      deleteSummonsMutation.mutate(summonsId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Scale className="h-8 w-8 text-primary" />
          Dagvaarding
        </h1>
        <p className="text-muted-foreground">
          Genereer de officiële dagvaarding voor uw juridische procedure
        </p>
      </div>

      {!hasAnalysis ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Generate Summons Tile */}
          <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative" data-testid="tile-generate-summons">
                <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <PlusCircle className="h-6 w-6 text-primary" />
                    Genereer dagvaarding
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Maak een nieuwe officiële dagvaarding aan voor uw zaak
                  </p>
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      De dagvaarding wordt automatisch gegenereerd op basis van uw zaakanalyse volgens het officiële Model dagvaarding
                    </p>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nieuwe dagvaarding genereren</DialogTitle>
                <DialogDescription>
                  De dagvaarding wordt automatisch gegenereerd op basis van uw zaakanalyse
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Wat wordt gegenereerd?
                  </h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>Officiële dagvaarding volgens Nederlands model</li>
                    <li>Volledige eisomschrijving en grondslag</li>
                    <li>Berekening van vordering inclusief kosten</li>
                    <li>Bewijsmiddelen en getuigenlijst</li>
                  </ul>
                </div>

                <Button 
                  onClick={handleGenerateSummons}
                  disabled={summonsMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-summons"
                >
                  {summonsMutation.isPending ? "Genereren..." : "Genereer dagvaarding"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Latest Summons Tile */}
          {latestSummons && (
            <Dialog 
              open={previewDialogOpen}
              onOpenChange={setPreviewDialogOpen}
            >
              <DialogTrigger asChild>
                <Card 
                  className="hover:shadow-lg transition-shadow cursor-pointer h-full relative" 
                  data-testid="tile-latest-summons"
                  onClick={() => setPreviewDialogOpen(true)}
                >
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
                        <span className="font-medium text-green-600 dark:text-green-400" data-testid="text-summons-status">
                          Gegenereerd
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Aangemaakt op:</span>{" "}
                        <span className="font-medium" data-testid="text-summons-date">
                          {formatDate(latestSummons.createdAt)}
                        </span>
                      </div>
                      {latestSummons.dataJson?.case?.total_to_date_eur && (
                        <div>
                          <span className="text-muted-foreground">Totaal bedrag:</span>{" "}
                          <span className="font-medium" data-testid="text-summons-amount">
                            €{latestSummons.dataJson.case.total_to_date_eur.toLocaleString('nl-NL')}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Dagvaarding</DialogTitle>
                  <DialogDescription>
                    Aangemaakt op {formatDate(latestSummons.createdAt)}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {latestSummons.dataJson ? (
                    <div 
                      className="bg-white border border-border rounded-lg p-8"
                      style={{
                        minHeight: '400px',
                        maxHeight: '500px',
                        overflowY: 'auto'
                      }}
                      data-testid="summons-preview"
                    >
                      <SummonsTemplate data={latestSummons.dataJson} />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Geen data beschikbaar voor deze dagvaarding
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => handleDownload(latestSummons)}
                      className="flex-1"
                      data-testid="button-download-summons"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                    <Button 
                      onClick={() => handleDelete(latestSummons.id)}
                      variant="destructive"
                      disabled={deleteSummonsMutation.isPending}
                      data-testid="button-delete-summons"
                    >
                      {deleteSummonsMutation.isPending ? "Verwijderen..." : "Verwijder"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}
