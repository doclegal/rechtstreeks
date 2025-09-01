import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StepChips from "@/components/StepChips";
import MissingDocuments from "@/components/MissingDocuments";
import DocumentList from "@/components/DocumentList";
import AnalysisResults from "@/components/AnalysisResults";
import GeneratedDocuments from "@/components/GeneratedDocuments";
import ProcessTimeline from "@/components/ProcessTimeline";
import { ArrowLeft, ArrowRight, Home } from "lucide-react";

export default function StepView() {
  const [match, params] = useRoute("/step/:stepId");
  const { user, isLoading: authLoading } = useAuth();
  const { data: cases, isLoading: casesLoading } = useCases();
  const { toast } = useToast();
  
  const stepId = parseInt(params?.stepId || "1");
  const currentCase = cases?.[0];

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

  const handleStepClick = (step: number) => {
    window.location.href = `/step/${step}`;
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 1:
        return {
          title: "Stap 1: Indienen stukken",
          content: currentCase ? (
            <div className="space-y-6">
              <MissingDocuments caseId={currentCase.id} />
              <DocumentList caseId={currentCase.id} />
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Geen zaak gevonden. <Link href="/new-case" className="text-primary underline">Maak een nieuwe zaak aan</Link>.
            </div>
          )
        };
      case 2:
        return {
          title: "Stap 2: AI Analyse",
          content: currentCase ? (
            <AnalysisResults caseId={currentCase.id} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Geen zaak gevonden.
            </div>
          )
        };
      case 3:
        return {
          title: "Stap 3: Brief genereren",
          content: currentCase ? (
            <GeneratedDocuments caseId={currentCase.id} type="letters" />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Geen zaak gevonden.
            </div>
          )
        };
      case 4:
        return {
          title: "Stap 4: Deurwaarder inschakelen",
          content: (
            <Card>
              <CardHeader>
                <CardTitle>Deurwaarder inschakelen</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  In deze stap schakelt u een deurwaarder in voor de formele betekening van uw brief.
                </p>
                <Badge variant="outline">Mock functionaliteit</Badge>
              </CardContent>
            </Card>
          )
        };
      case 5:
        return {
          title: "Stap 5: Betekening",
          content: (
            <Card>
              <CardHeader>
                <CardTitle>Wachten op betekening</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  De deurwaarder zal de brief formeel betekenen aan de wederpartij.
                </p>
              </CardContent>
            </Card>
          )
        };
      case 6:
        return {
          title: "Stap 6: Rechtbank",
          content: currentCase ? (
            <GeneratedDocuments caseId={currentCase.id} type="summons" />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Dagvaarding bij rechtbank</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Genereer en dien de dagvaarding in bij de rechtbank.
                </p>
              </CardContent>
            </Card>
          )
        };
      case 7:
        return {
          title: "Stap 7: Procedure",
          content: (
            <Card>
              <CardHeader>
                <CardTitle>Rechtbankprocedure</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  De rechtbankprocedure is gestart. Volg de ontwikkelingen.
                </p>
              </CardContent>
            </Card>
          )
        };
      case 8:
        return {
          title: "Stap 8: Vervolg procedure",
          content: (
            <Card>
              <CardHeader>
                <CardTitle>Procedure loopt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  De procedure is gaande. Wacht op verder bericht van de rechtbank.
                </p>
              </CardContent>
            </Card>
          )
        };
      case 9:
        return {
          title: "Stap 9: Vonnis",
          content: (
            <Card>
              <CardHeader>
                <CardTitle>Vonnis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Het vonnis is uitgesproken. Upload het vonnis voor archivering.
                </p>
              </CardContent>
            </Card>
          )
        };
      default:
        return {
          title: "Onbekende stap",
          content: (
            <div className="text-center py-8 text-muted-foreground">
              Stap niet gevonden.
            </div>
          )
        };
    }
  };

  if (authLoading || casesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  const stepContent = getStepContent(stepId);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/my-case">
              <Button variant="outline" size="sm" data-testid="button-back-to-overview">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Terug naar overzicht
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-home">
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
            </Link>
          </div>
          
          <div className="flex items-center space-x-2">
            {stepId > 1 && (
              <Link href={`/step/${stepId - 1}`}>
                <Button variant="outline" size="sm" data-testid="button-previous-step">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Vorige
                </Button>
              </Link>
            )}
            {stepId < 9 && (
              <Link href={`/step/${stepId + 1}`}>
                <Button variant="outline" size="sm" data-testid="button-next-step">
                  Volgende
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Step Navigation */}
        <Card>
          <CardHeader>
            <CardTitle>Stappen overzicht</CardTitle>
          </CardHeader>
          <CardContent>
            <StepChips currentStep={stepId} onStepClick={handleStepClick} />
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>{stepContent.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {stepContent.content}
          </CardContent>
        </Card>

        {/* Timeline */}
        {currentCase && (
          <Card>
            <CardHeader>
              <CardTitle>Tijdlijn</CardTitle>
            </CardHeader>
            <CardContent>
              <ProcessTimeline caseId={currentCase.id} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}