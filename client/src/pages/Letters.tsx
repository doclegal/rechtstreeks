import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases, useGenerateLetter, useDeleteLetter } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import GeneratedDocuments from "@/components/GeneratedDocuments";
import { Link } from "wouter";
import { FileText, Scale, PlusCircle } from "lucide-react";

export default function Letters() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: cases, isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  
  const currentCase = Array.isArray(cases) && cases.length > 0 ? cases[0] : undefined;
  const caseId = currentCase?.id;

  const letterMutation = useGenerateLetter(caseId || "");
  const deleteLetterMutation = useDeleteLetter(caseId || "");

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

  const handleGenerateLetter = (briefType: string, tone: string) => {
    letterMutation.mutate(
      { briefType, tone },
      {
        onSuccess: () => {
          refetch();
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

  const handleDeleteLetter = (letterId: string) => {
    deleteLetterMutation.mutate(letterId, {
      onSuccess: () => {
        refetch();
        toast({
          title: "Brief verwijderd",
          description: "De brief is succesvol verwijderd",
        });
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
              Eerste zaak starten
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const letters = (currentCase as any).letters || [];
  const hasLetters = letters.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            Brieven
          </h1>
          <p className="text-muted-foreground">
            Genereer en beheer juridische brieven voor uw zaak
          </p>
        </div>
      </div>

      {/* Case Context Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Zaak: {currentCase.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Wederpartij:</span>{" "}
              <span className="font-medium">{currentCase.counterpartyName}</span>
            </div>
            {currentCase.claimAmount && (
              <div>
                <span className="text-muted-foreground">Bedrag:</span>{" "}
                <span className="font-medium">€ {currentCase.claimAmount}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Letters Section */}
      {hasLetters || currentCase.analysis ? (
        <GeneratedDocuments
          letters={letters}
          summons={[]} // Only show letters on this page
          caseId={currentCase.id}
          onGenerateLetter={handleGenerateLetter}
          onDeleteLetter={handleDeleteLetter}
          isGenerating={letterMutation.isPending}
        />
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Nog geen brieven gegenereerd
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
      )}
    </div>
  );
}
