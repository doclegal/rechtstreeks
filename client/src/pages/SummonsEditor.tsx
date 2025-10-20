import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCase";
import { useActiveCase } from "@/contexts/CaseContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Scale, PlusCircle, Construction } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function SummonsEditor() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: casesLoading } = useCases();
  const { toast } = useToast();
  const currentCase = useActiveCase();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3" data-testid="heading-summons-editor">
          <Scale className="h-8 w-8 text-primary" />
          Dagvaarding Editor
        </h1>
        <p className="text-muted-foreground">
          Genereer de officiële dagvaarding voor uw juridische procedure
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
        <CardContent className="py-12">
          <div className="text-center max-w-2xl mx-auto">
            <Construction className="h-20 w-20 text-blue-600 dark:text-blue-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-4">
              Binnenkort beschikbaar
            </h2>
            <p className="text-blue-800 dark:text-blue-200 mb-6 text-lg">
              De nieuwe Dagvaarding Editor is momenteel in ontwikkeling. 
              We bouwen een verbeterde versie met nog betere ondersteuning voor het opstellen van uw dagvaarding.
            </p>
            <p className="text-blue-700 dark:text-blue-300 mb-8">
              In de tussentijd kunt u uw zaak voorbereiden door documenten te uploaden en een analyse uit te voeren.
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild variant="default" data-testid="button-go-to-case">
                <Link href="/my-case">
                  Naar Mijn Zaak
                </Link>
              </Button>
              <Button asChild variant="outline" data-testid="button-go-to-analysis">
                <Link href="/analysis">
                  Naar Analyse
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
