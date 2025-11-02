import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useActiveCase } from "@/contexts/CaseContext";
import { useEffect } from "react";
import { CaseQnA } from "@/components/CaseQnA";
import { HelpCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function QnA() {
  const { user, isLoading: authLoading } = useAuth();
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

  if (!currentCase) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <HelpCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-2xl font-bold text-foreground mb-4">Geen actieve zaak</h2>
          <p className="text-muted-foreground mb-6">
            Selecteer eerst een zaak om veelgestelde vragen over uw juridische situatie te bekijken.
          </p>
          <Button asChild size="lg" data-testid="button-go-to-cases">
            <Link href="/">
              Bekijk mijn zaken
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <Button 
        variant="ghost" 
        size="sm" 
        asChild 
        className="mb-4"
        data-testid="button-back"
      >
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Link>
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
          <HelpCircle className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" />
          <span className="break-words">Veelgestelde Vragen</span>
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2 break-words">
          AI-gegenereerde antwoorden over zaak: <span className="font-medium">{currentCase.title}</span>
        </p>
      </div>

      <CaseQnA caseId={currentCase.id} />
    </div>
  );
}
