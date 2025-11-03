import { useActiveCase } from "@/contexts/CaseContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import CaseInfo from "@/components/CaseInfo";

export default function CaseDetails() {
  const currentCase = useActiveCase();
  const [, setLocation] = useLocation();

  if (!currentCase) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">Geen zaak gevonden</h2>
          <p className="text-muted-foreground mb-6">
            Er is geen actieve zaak geselecteerd.
          </p>
          <Button onClick={() => setLocation("/cases")} data-testid="button-go-to-cases">
            Naar mijn zaken
          </Button>
        </div>
      </div>
    );
  }

  const caseWithProgress = {
    ...currentCase,
    progress: 0,
    documents: currentCase.documents || [],
    analysis: null,
  };

  return (
    <div className="space-y-6">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setLocation("/my-case")}
        className="mb-2"
        data-testid="button-back-to-mycase"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Terug naar Mijn zaak
      </Button>

      <CaseInfo
        caseData={caseWithProgress}
        isFullWidth={true}
        onEdit={() => setLocation(`/edit-case/${currentCase.id}`)}
        onExport={() => {
          console.log("Export case");
        }}
      />
    </div>
  );
}
