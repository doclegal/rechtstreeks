import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AskJuristDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: string;
}

export function AskJuristDialog({ open, onOpenChange, context }: AskJuristDialogProps) {
  const [question, setQuestion] = useState("");
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!question.trim()) {
      toast({
        title: "Vraag vereist",
        description: "Voer een vraag in om door te gaan",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Vraag verzonden",
      description: "Een jurist zal binnenkort contact met u opnemen",
    });
    
    setQuestion("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <UserCircle className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
            <span className="line-clamp-2">Vraag een jurist</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            Heeft u juridische vragen of twijfels? Stel uw vraag aan een van onze ervaren juristen.
            {context && ` Context: ${context}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2 sm:mt-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <UserCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-xs sm:text-sm text-blue-900 dark:text-blue-100 mb-1">
                  Direct contact met een jurist
                </h4>
                <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                  Een ervaren jurist zal uw vraag beoordelen en binnen 24 uur contact met u opnemen. 
                  In de toekomst zal uw dossier automatisch worden meegestuurd voor complete context.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jurist-question" className="text-sm sm:text-base">
              Uw vraag aan de jurist
            </Label>
            <Textarea
              id="jurist-question"
              placeholder="Typ hier uw juridische vraag of twijfel..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={6}
              className="resize-none text-sm sm:text-base"
              data-testid="textarea-jurist-question"
            />
            <p className="text-xs text-muted-foreground">
              Wees zo specifiek mogelijk om een gericht antwoord te krijgen.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2 sm:pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-jurist"
              className="w-full sm:w-auto"
            >
              Annuleren
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!question.trim()}
              data-testid="button-submit-jurist-question"
              className="w-full sm:w-auto"
            >
              <Send className="h-4 w-4 mr-2" />
              Verstuur vraag
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
