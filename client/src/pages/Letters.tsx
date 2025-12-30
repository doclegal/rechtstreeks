import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useGenerateLetter, useDeleteLetter } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { FileText, PlusCircle, Download, Mail, ArrowLeft, Trash2, Upload, Clock, MessageSquare, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { RIcon } from "@/components/RIcon";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useActiveCase } from "@/contexts/CaseContext";
import { AskJuristButton } from "@/components/AskJuristButton";
import { PageInfoDialog } from "@/components/PageInfoDialog";
import { Badge } from "@/components/ui/badge";

export default function Letters() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const currentCase = useActiveCase();
  const caseId = currentCase?.id;

  const letterMutation = useGenerateLetter(caseId || "");
  const deleteLetterMutation = useDeleteLetter(caseId || "");

  // Fetch negotiation summary
  const { data: negotiationSummary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<{
    summary: string;
    timeline: Array<{ date: string; action: string }>;
    status: string;
    nextStep?: string;
  }>({
    queryKey: ['/api/cases', caseId, 'negotiation-summary'],
    enabled: !!caseId,
  });

  const [briefType, setBriefType] = useState<string>("LAATSTE_AANMANING");
  const [tone, setTone] = useState<string>("zakelijk-vriendelijk");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedLetterType, setSelectedLetterType] = useState<string | null>(null);
  const [uploadingLetterId, setUploadingLetterId] = useState<string | null>(null);

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

  const handleGenerateLetter = () => {
    letterMutation.mutate(
      { briefType, tone },
      {
        onSuccess: () => {
          refetch();
          setGenerateDialogOpen(false);
          toast({
            title: "Brief gegenereerd",
            description: "Uw brief is succesvol aangemaakt",
          });
        },
        onError: () => {
          toast({
            title: "Fout bij genereren",
            description: "Er is een fout opgetreden bij het genereren van de brief",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDeleteLetter = (letterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Weet u zeker dat u deze brief wilt verwijderen?")) {
      deleteLetterMutation.mutate(letterId, {
        onSuccess: () => {
          refetch();
          setPreviewDialogOpen(false);
        }
      });
    }
  };

  const uploadToDossierMutation = useMutation({
    mutationFn: async ({ pdfStorageKey, letterId, createdAt, html }: { pdfStorageKey: string | null; letterId: string; createdAt: string; html: string }) => {
      let blob: Blob;
      let filename: string;
      const timestamp = new Date(createdAt).toISOString().split('T')[0];
      
      // Try to fetch the PDF if it exists
      if (pdfStorageKey) {
        try {
          const response = await fetch(`/api/files/${pdfStorageKey}`, {
            headers: getAuthHeaders(),
            credentials: 'include',
          });
          if (response.ok) {
            blob = await response.blob();
            filename = `Brief_${timestamp}_${letterId.substring(0, 8)}.pdf`;
          } else {
            // PDF not found, generate from HTML
            throw new Error('PDF not found, will use HTML');
          }
        } catch (error) {
          // PDF fetch failed, create HTML file instead
          blob = new Blob([html], { type: 'text/html' });
          filename = `Brief_${timestamp}_${letterId.substring(0, 8)}.html`;
        }
      } else {
        // No PDF storage key, create HTML file
        blob = new Blob([html], { type: 'text/html' });
        filename = `Brief_${timestamp}_${letterId.substring(0, 8)}.html`;
      }
      
      const file = new File([blob], filename, { type: blob.type });
      
      // Upload to dossier
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await fetch(`/api/cases/${caseId}/uploads`, {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Upload to dossier failed');
      }
      
      return uploadResponse.json();
    },
    onSuccess: () => {
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
        queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'uploads'] });
        queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      }
      toast({
        title: "Succesvol geüpload",
        description: "Het document is toegevoegd aan het dossier en wordt geanalyseerd",
      });
      setUploadingLetterId(null);
    },
    onError: (error) => {
      toast({
        title: "Upload mislukt",
        description: "Er is een fout opgetreden bij het uploaden naar het dossier",
        variant: "destructive",
      });
      setUploadingLetterId(null);
    },
  });

  const handleUploadToDossier = (letter: any, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!letter.html) {
      toast({
        title: "Geen inhoud beschikbaar",
        description: "Deze brief heeft geen inhoud om te uploaden",
        variant: "destructive",
      });
      return;
    }
    
    setUploadingLetterId(letter.id);
    uploadToDossierMutation.mutate({ 
      pdfStorageKey: letter.pdfStorageKey || null,
      letterId: letter.id,
      createdAt: letter.createdAt,
      html: letter.html
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

  const letters = (currentCase as any).letters || [];
  // Check for analysis in Supabase (rkosAnalysis) first, then fall back to old local DB fields
  const hasAnalysis = !!(currentCase as any).rkosAnalysis || !!(currentCase as any).analysis || !!(currentCase as any).fullAnalysis;

  // Group letters by type
  const lettersByType: Record<string, any[]> = {};
  letters.forEach((letter: any) => {
    const type = letter.briefType || "ONBEKEND";
    if (!lettersByType[type]) {
      lettersByType[type] = [];
    }
    lettersByType[type].push(letter);
  });

  // Get the latest letter for each type
  const letterTypes = Object.keys(lettersByType).map(type => {
    const typeLetters = lettersByType[type].sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return {
      type,
      letter: typeLetters[0],
      count: typeLetters.length
    };
  });

  const getLetterTypeLabel = (type: string) => {
    switch (type) {
      case "LAATSTE_AANMANING":
        return "Laatste aanmaning";
      case "INGEBREKESTELLING":
        return "Ingebrekestelling";
      case "INFORMATIEVERZOEK":
        return "Informatieverzoek";
      default:
        return type;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), "d MMM yyyy", { locale: nl });
    } catch {
      return null;
    }
  };

  const handleDownload = (letter: any) => {
    if (letter.pdfStorageKey) {
      window.open(`/api/files/${letter.pdfStorageKey}`, '_blank');
    } else {
      // Show HTML in new tab
      const htmlWindow = window.open('', '_blank');
      if (htmlWindow) {
        htmlWindow.document.write(letter.html);
        htmlWindow.document.close();
      }
    }
  };

  return (
    <div className="space-y-6">
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
      
      {/* Header with Negotiation Status Tile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="flex items-start">
          <div className="flex items-start gap-2">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
                <Mail className="h-8 w-8 text-primary" />
                Onderhandelen
              </h1>
              <p className="text-muted-foreground">
                Onderhandel en genereer juridische brieven voor uw zaak
              </p>
            </div>
            <PageInfoDialog
              title="Onderhandelen"
              description="Genereer professionele juridische brieven met AI-ondersteuning om uw zaak formeel aan te kaarten bij de wederpartij."
              features={[
                "Genereer verschillende soorten juridische brieven (aanmaning, ingebrekestelling, informatieverzoek)",
                "Kies de juiste toon voor uw brief (zakelijk-vriendelijk tot formeel-juridisch)",
                "AI gebruikt uw zaakgegevens en analyse om een op maat gemaakte brief te schrijven",
                "Download brieven als PDF voor verzending",
                "Bewaar alle gegenereerde brieven voor later gebruik"
              ]}
              importance="Juridische brieven zijn essentiële stappen voordat u naar de rechter kunt. Een goed opgestelde brief kan helpen het conflict op te lossen zonder rechterlijke tussenkomst. Bovendien toont het aan dat u geprobeerd hebt het probleem op te lossen, wat verplicht is voor sommige juridische procedures."
            />
          </div>
        </div>
        
        {/* Empty middle column for spacing on large screens */}
        <div className="hidden lg:block" />
        
        {/* Negotiation Status Tile - Right side */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800" data-testid="tile-negotiation-status">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-blue-800 dark:text-blue-200">Stand van zaken</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => refetchSummary()}
                disabled={summaryLoading}
                className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                data-testid="button-refresh-summary"
              >
                <RefreshCw className={`h-3 w-3 ${summaryLoading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {summaryLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>AI analyseert onderhandeling...</span>
              </div>
            ) : negotiationSummary ? (
              <div className="space-y-2">
                <p className="text-sm text-foreground leading-relaxed">
                  {negotiationSummary.summary || "Geen samenvatting beschikbaar."}
                </p>
                {negotiationSummary.status && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      negotiationSummary.status === 'niet_gestart' ? 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300' :
                      negotiationSummary.status === 'lopend' ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300' :
                      negotiationSummary.status === 'in_afwachting' ? 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300' :
                      negotiationSummary.status === 'geen_reactie' ? 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900 dark:text-orange-300' :
                      negotiationSummary.status === 'opgelost' ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300' :
                      negotiationSummary.status === 'geescaleerd' ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300' :
                      negotiationSummary.status === 'onbekend' ? 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300' :
                      'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                    data-testid="badge-negotiation-status"
                  >
                    {negotiationSummary.status === 'niet_gestart' ? 'Niet gestart' :
                     negotiationSummary.status === 'lopend' ? 'Lopend' :
                     negotiationSummary.status === 'in_afwachting' ? 'In afwachting' :
                     negotiationSummary.status === 'geen_reactie' ? 'Geen reactie' :
                     negotiationSummary.status === 'opgelost' ? 'Opgelost' :
                     negotiationSummary.status === 'geescaleerd' ? 'Geëscaleerd' :
                     negotiationSummary.status === 'onbekend' ? 'Onbekend' :
                     'Status onbekend'}
                  </Badge>
                )}
                {negotiationSummary.nextStep && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Volgende stap: {negotiationSummary.nextStep}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Genereer uw eerste brief om de onderhandeling te starten.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="flex items-start lg:hidden mb-4">
        <AskJuristButton context="Onderhandelen" variant="outline" />
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
                Upload eerst documenten en voer een analyse uit voordat u brieven kunt genereren.
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
        <>
          {/* Action Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Generate Letter Tile */}
            <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
              <DialogTrigger asChild>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative" data-testid="tile-generate-letter">
                  <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <PlusCircle className="h-6 w-6 text-primary" />
                      Genereer een brief
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">
                        Maak een nieuwe juridische brief aan voor uw zaak
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nieuwe brief genereren</DialogTitle>
                  <DialogDescription>
                    Selecteer het type brief en de gewenste toon
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="brief-type">Brief type</Label>
                    <Select value={briefType} onValueChange={setBriefType}>
                      <SelectTrigger id="brief-type" data-testid="select-brief-type">
                        <SelectValue placeholder="Selecteer brief type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LAATSTE_AANMANING">Laatste aanmaning</SelectItem>
                        <SelectItem value="INGEBREKESTELLING">Ingebrekestelling</SelectItem>
                        <SelectItem value="INFORMATIEVERZOEK">Informatieverzoek</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tone">Toon</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger id="tone" data-testid="select-tone">
                        <SelectValue placeholder="Selecteer toon" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zakelijk-vriendelijk">Zakelijk-vriendelijk</SelectItem>
                        <SelectItem value="formeel">Formeel</SelectItem>
                        <SelectItem value="streng">Streng</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleGenerateLetter}
                    disabled={letterMutation.isPending}
                    className="w-full"
                    data-testid="button-generate-letter"
                  >
                    {letterMutation.isPending ? "Genereren..." : "Genereer brief"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Separator */}
          {letters.length > 0 && (
            <>
              <Separator className="my-8" />

              {/* Document Overview - Two Columns */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* Gegenereerde brieven */}
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Gegenereerde brieven</h2>
                  <div className="space-y-3">
                    {letters.map((letter: any, index: number) => (
                    <Dialog 
                      key={letter.id}
                      open={previewDialogOpen && selectedLetterType === letter.id}
                      onOpenChange={(open) => {
                        setPreviewDialogOpen(open);
                        if (!open) setSelectedLetterType(null);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Card 
                          className="hover:shadow-md transition-shadow cursor-pointer"
                          data-testid={`document-${index}`}
                          onClick={() => {
                            setSelectedLetterType(letter.id);
                            setPreviewDialogOpen(true);
                          }}
                        >
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-foreground">
                                    {getLetterTypeLabel(letter.briefType || "Brief")}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {formatDate(letter.createdAt)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(letter);
                                  }}
                                  data-testid={`button-download-${index}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => handleUploadToDossier(letter, e)}
                                  disabled={uploadingLetterId === letter.id}
                                  data-testid={`button-upload-to-dossier-${index}`}
                                  title="Upload naar dossier"
                                >
                                  {uploadingLetterId === letter.id ? (
                                    <Clock className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Upload className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => handleDeleteLetter(letter.id, e)}
                                  data-testid={`button-delete-${index}`}
                                  disabled={deleteLetterMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{getLetterTypeLabel(letter.briefType || "Brief")}</DialogTitle>
                          <DialogDescription>
                            Gegenereerd op {formatDate(letter.createdAt)}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div 
                            className="bg-card border border-border rounded-lg p-8"
                            style={{
                              minHeight: '400px',
                              maxHeight: '500px',
                              overflowY: 'auto'
                            }}
                            data-testid={`letter-preview-${letter.id}`}
                          >
                            <div dangerouslySetInnerHTML={{ __html: letter.html }} />
                          </div>
                          <div className="flex gap-3">
                            <Button 
                              onClick={() => handleDownload(letter)}
                              className="flex-1"
                              data-testid={`button-download-dialog-${letter.id}`}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                            <Button 
                              onClick={(e) => handleUploadToDossier(letter, e)}
                              variant="outline"
                              className="flex-1"
                              data-testid={`button-upload-dialog-${letter.id}`}
                              disabled={uploadingLetterId === letter.id}
                            >
                              {uploadingLetterId === letter.id ? (
                                <>
                                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                                  Uploaden...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload naar dossier
                                </>
                              )}
                            </Button>
                            <Button 
                              onClick={(e) => handleDeleteLetter(letter.id, e)}
                              variant="destructive"
                              className="flex-1"
                              data-testid={`button-delete-dialog-${letter.id}`}
                              disabled={deleteLetterMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Verwijder
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    ))}
                  </div>
                </div>

                {/* Ontvangen brieven */}
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Ontvangen brieven</h2>
                  <Card className="border-dashed">
                    <CardContent className="py-12">
                      <div className="text-center">
                        <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <p className="text-muted-foreground mb-4">
                          Brieven van de wederpartij verschijnen hier
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Upload antwoorden en correspondentie van de wederpartij naar uw dossier
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
