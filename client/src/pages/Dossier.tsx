import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveCase } from "@/contexts/CaseContext";
import { useDossierCheck } from "@/hooks/useCase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DocumentList from "@/components/DocumentList";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FileCheck, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { RIcon } from "@/components/RIcon";

export default function Dossier() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const currentCase = useActiveCase();
  const [checkResult, setCheckResult] = useState<any>(null);
  
  const dossierCheckMutation = useDossierCheck(currentCase?.id || "");

  const handleDossierCheck = async () => {
    if (!currentCase?.id) return;
    
    try {
      const result = await dossierCheckMutation.mutateAsync();
      setCheckResult(result);
    } catch (error) {
      console.error('Dossier check error:', error);
      // Error toast is already shown by the mutation hook
    }
  };

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

      {/* Dossier Check Result */}
      {checkResult && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <div className="space-y-2">
              <p className="font-semibold">Dossiercontrole resultaat:</p>
              {checkResult.completeness && (
                <p>Volledigheid: {checkResult.completeness}</p>
              )}
              {checkResult.missing_documents && checkResult.missing_documents.length > 0 && (
                <div>
                  <p className="font-medium">Ontbrekende documenten:</p>
                  <ul className="list-disc list-inside ml-2">
                    {checkResult.missing_documents.map((doc: string, idx: number) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}
              {checkResult.recommendations && (
                <div>
                  <p className="font-medium">Aanbevelingen:</p>
                  <p className="whitespace-pre-wrap">{checkResult.recommendations}</p>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Documents Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documenten ({docCount})
            </CardTitle>
            <Button 
              onClick={handleDossierCheck}
              disabled={dossierCheckMutation.isPending || docCount === 0}
              data-testid="button-check-dossier"
            >
              {dossierCheckMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Controleren...
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Controleer dossier
                </>
              )}
            </Button>
          </div>
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

      {/* Help text */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Upload alle relevante documenten voor uw zaak. De dossiercontrole analyseert of uw
          dossier compleet is en geeft aanbevelingen voor ontbrekende stukken.
        </AlertDescription>
      </Alert>
    </div>
  );
}
