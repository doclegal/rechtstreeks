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
import { FileText, PlusCircle, Download, Mail, ArrowLeft } from "lucide-react";
import { RIcon } from "@/components/RIcon";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useActiveCase } from "@/contexts/CaseContext";

export default function Letters() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  
  const currentCase = useActiveCase();
  const caseId = currentCase?.id;

  const letterMutation = useGenerateLetter(caseId || "");
  const deleteLetterMutation = useDeleteLetter(caseId || "");

  const [briefType, setBriefType] = useState<string>("LAATSTE_AANMANING");
  const [tone, setTone] = useState<string>("zakelijk-vriendelijk");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedLetterType, setSelectedLetterType] = useState<string | null>(null);

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
  const hasAnalysis = !!(currentCase as any).analysis || !!(currentCase as any).fullAnalysis;

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
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Mail className="h-8 w-8 text-primary" />
          Brieven
        </h1>
        <p className="text-muted-foreground">
          Genereer en beheer juridische brieven voor uw zaak
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
                  <p className="text-muted-foreground">
                    Maak een nieuwe juridische brief aan voor uw zaak
                  </p>
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

          {/* Letter Type Tiles */}
          {letterTypes.map(({ type, letter, count }) => (
            <Dialog 
              key={type}
              open={previewDialogOpen && selectedLetterType === type}
              onOpenChange={(open) => {
                setPreviewDialogOpen(open);
                if (!open) setSelectedLetterType(null);
              }}
            >
              <DialogTrigger asChild>
                <Card 
                  className="hover:shadow-lg transition-shadow cursor-pointer h-full relative" 
                  data-testid={`tile-letter-${type}`}
                  onClick={() => {
                    setSelectedLetterType(type);
                    setPreviewDialogOpen(true);
                  }}
                >
                  <RIcon size="sm" className="absolute top-4 right-4 opacity-10" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <FileText className="h-6 w-6 text-primary" />
                      {getLetterTypeLabel(type)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Aantal:</span>{" "}
                        <span className="font-medium" data-testid={`text-count-${type}`}>{count}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Laatst gegenereerd:</span>{" "}
                        <span className="font-medium" data-testid={`text-date-${type}`}>
                          {formatDate(letter.createdAt)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{getLetterTypeLabel(type)}</DialogTitle>
                  <DialogDescription>
                    Laatst gegenereerd op {formatDate(letter.createdAt)}
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
                    data-testid={`letter-preview-${type}`}
                  >
                    <div dangerouslySetInnerHTML={{ __html: letter.html }} />
                  </div>
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => handleDownload(letter)}
                      className="flex-1"
                      data-testid={`button-download-${type}`}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      )}
    </div>
  );
}
