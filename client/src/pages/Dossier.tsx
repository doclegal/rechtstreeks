import { useAuth } from "@/hooks/useAuth";
import { useActiveCase } from "@/contexts/CaseContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DocumentList from "@/components/DocumentList";
import MissingInfo from "@/components/MissingInfo";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FileText, AlertCircle, Sparkles, AlertTriangle } from "lucide-react";
import { RIcon } from "@/components/RIcon";
import { useMemo } from "react";
import type { MissingRequirement } from "@shared/schema";

export default function Dossier() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const currentCase = useActiveCase();

  // Extract missing_elements from RKOS.flow (Volledige analyse) - AUTHORITATIVE SOURCE
  const missingRequirements = useMemo(() => {
    if (!currentCase?.fullAnalysis?.succesKansAnalysis) {
      return [];
    }

    const succesKans = currentCase.fullAnalysis.succesKansAnalysis as any;
    const missing_elements = succesKans.missing_elements || [];

    if (!Array.isArray(missing_elements) || missing_elements.length === 0) {
      return [];
    }

    // Convert RKOS missing_elements to MissingRequirement format
    return missing_elements.map((elem: any, index: number): MissingRequirement => {
      // Handle both string and object formats
      const item = typeof elem === 'string' ? elem : (elem.point || elem.item || '');
      const why_needed = typeof elem === 'object' ? (elem.why_it_matters || elem.why_needed || '') : '';
      
      return {
        id: `rkos-missing-${index}`,
        caseId: currentCase.id,
        key: `rkos-missing-${index}`,
        label: item,
        description: why_needed,
        required: true, // All RKOS missing elements are important
        inputKind: undefined, // Allow both text and document upload
        createdAt: new Date(),
      };
    });
  }, [currentCase?.fullAnalysis?.succesKansAnalysis, currentCase?.id]);

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
              Elk document wordt automatisch geanalyseerd na upload. Vul ontbrekende informatie aan en klik op "Versturen" om een heranalyse te starten.
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {/* 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Documents */}
        <Card className="h-fit">
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

        {/* Right Column: Missing Information from RKOS.flow */}
        <div>
          {missingRequirements.length > 0 ? (
            <MissingInfo
              requirements={missingRequirements}
              caseId={currentCase.id}
              caseDocuments={currentCase.documents || []}
              onUpdated={() => {
                // After submitting missing info, suggest re-analysis
                console.log('Missing info updated - user should run re-analysis');
              }}
            />
          ) : (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                  <AlertTriangle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Ontbrekende Informatie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className="border-green-300 bg-green-100 dark:bg-green-900 dark:border-green-700">
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    {currentCase.fullAnalysis?.succesKansAnalysis ? (
                      <>
                        <p className="font-semibold mb-2">✅ Compleet dossier</p>
                        <p className="text-sm">
                          Op basis van de volledige analyse lijkt uw dossier compleet te zijn. Er zijn geen ontbrekende elementen gevonden.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold mb-2">Nog geen analyse uitgevoerd</p>
                        <p className="text-sm">
                          Voer eerst een <strong>Volledige analyse</strong> uit op de Analyse pagina om te zien welke informatie nog ontbreekt.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3"
                          onClick={() => setLocation('/analysis')}
                          data-testid="button-go-to-analysis"
                        >
                          Ga naar Analyse
                        </Button>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Help text */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Upload alle relevante documenten voor uw zaak. Elk document wordt automatisch geanalyseerd
          om het type, inhoud en relevantie te bepalen. Vul ontbrekende informatie aan en verstuur deze om een heranalyse te starten.
        </AlertDescription>
      </Alert>
    </div>
  );
}
