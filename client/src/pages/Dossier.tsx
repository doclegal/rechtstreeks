import { useAuth } from "@/hooks/useAuth";
import { useActiveCase } from "@/contexts/CaseContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DocumentList from "@/components/DocumentList";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FileText, AlertCircle, Sparkles } from "lucide-react";
import { RIcon } from "@/components/RIcon";

export default function Dossier() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const currentCase = useActiveCase();

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
