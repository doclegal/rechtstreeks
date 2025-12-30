import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getAuthHeaders } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle, Loader2, RefreshCw, AlertCircle, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QnaItem {
  id: string;
  question: string;
  answer: string;
  order: number;
  createdAt: string;
}

interface CaseQnAProps {
  caseId: string;
}

export function CaseQnA({ caseId }: CaseQnAProps) {
  const { toast } = useToast();

  // Fetch Q&A items
  const { data: qnaData, isLoading } = useQuery({
    queryKey: ['/api/cases', caseId, 'qna'],
    queryFn: async () => {
      const response = await fetch(`/api/cases/${caseId}/qna`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch Q&A items');
      return response.json();
    },
  });

  const items: QnaItem[] = qnaData?.items || [];

  // Generate Q&A mutation (replaces existing)
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/cases/${caseId}/generate-qna`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'qna'] });
      toast({
        title: "Q&A gegenereerd",
        description: `${data.count || 0} vragen en antwoorden zijn aangemaakt`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij genereren",
        description: error.message || "Kon Q&A niet genereren",
        variant: "destructive",
      });
    },
  });

  // Generate MORE Q&A mutation (appends to existing)
  const generateMoreMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/cases/${caseId}/generate-more-qna`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'qna'] });
      toast({
        title: "Nieuwe vragen toegevoegd",
        description: `${data.count || 0} nieuwe vragen zijn toegevoegd aan de ${data.total || 0} totale vragen`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij toevoegen",
        description: error.message || "Kon geen nieuwe vragen genereren",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-2 min-w-0">
            <HelpCircle className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
            <div className="min-w-0">
              <CardTitle className="break-words">Veelgestelde Vragen</CardTitle>
              <CardDescription className="break-words">
                AI-gegenereerde antwoorden op vragen over uw zaak
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {items.length > 0 && (
              <Button
                onClick={() => generateMoreMutation.mutate()}
                disabled={generateMoreMutation.isPending || generateMutation.isPending || isLoading}
                data-testid="button-generate-more-qna"
                variant="default"
                size="sm"
                className="whitespace-nowrap"
              >
                {generateMoreMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Toevoegen...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Meer vragen
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || generateMoreMutation.isPending || isLoading}
              data-testid="button-generate-qna"
              variant={items.length > 0 ? "outline" : "default"}
              size="sm"
              className="whitespace-nowrap"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Genereren...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {items.length > 0 ? 'Vernieuwen' : 'Genereer Q&A'}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && items.length === 0 && !generateMutation.isPending && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Er zijn nog geen vragen en antwoorden gegenereerd voor deze zaak.
              Klik op "Genereer Q&A" om deze automatisch te laten maken op basis van uw dossier.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && items.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            {items.map((item, idx) => (
              <AccordionItem 
                key={item.id} 
                value={`item-${idx}`}
                data-testid={`qna-item-${idx}`}
              >
                <AccordionTrigger 
                  className="text-left hover:no-underline"
                  data-testid={`qna-question-${idx}`}
                >
                  <div className="flex items-start gap-2 pr-4">
                    <span className="text-primary font-semibold shrink-0 mt-0.5">
                      Q:
                    </span>
                    <span className="font-medium">{item.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent 
                  className="text-muted-foreground"
                  data-testid={`qna-answer-${idx}`}
                >
                  <div className="flex items-start gap-2 pl-1 pt-2">
                    <span className="text-primary font-semibold shrink-0">
                      A:
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {(generateMutation.isPending || generateMoreMutation.isPending) && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">
                {generateMoreMutation.isPending ? 'Nieuwe vragen worden toegevoegd...' : 'Q&A wordt gegenereerd...'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Dit kan 1-2 minuten duren
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
