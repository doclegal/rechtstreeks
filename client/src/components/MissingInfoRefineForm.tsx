import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Send, FileText, CheckCircle2 } from "lucide-react";
import DocumentUpload from "./DocumentUpload";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MissingInfoItem {
  id?: string; // Actual ID from MindStudio missing_info_for_assessment
  question: string;
  answer_type?: string;
  expected?: string;
  ui?: string;
  specificity?: string;
  file_spec?: string;
}

interface MissingInfoRefineFormProps {
  missingInfoStruct: MissingInfoItem[];
  caseId: string;
  onSecondRunComplete: (result: any) => void;
}

export default function MissingInfoRefineForm({
  missingInfoStruct,
  caseId,
  onSecondRunComplete
}: MissingInfoRefineFormProps) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Map<string, any>>(new Map());
  const [showUploadFor, setShowUploadFor] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTextAnswer = (questionId: string, value: string) => {
    const newAnswers = new Map(answers);
    if (value.trim()) {
      newAnswers.set(questionId, {
        question_id: questionId,
        answer_type: "text",
        answer_text: value.trim()
      });
    } else {
      newAnswers.delete(questionId);
    }
    setAnswers(newAnswers);
  };

  const handleMultipleChoiceAnswer = (questionId: string, choice: string) => {
    const newAnswers = new Map(answers);
    newAnswers.set(questionId, {
      question_id: questionId,
      answer_type: "multiple_choice",
      answer_choice: choice
    });
    setAnswers(newAnswers);
  };

  const handleFileUpload = async (questionId: string, documents: any[]) => {
    if (documents.length === 0) return;
    
    const doc = documents[0]; // Take first uploaded document
    
    const newAnswers = new Map(answers);
    newAnswers.set(questionId, {
      question_id: questionId,
      answer_type: "file_upload",
      answer_files: [{
        name: doc.filename,
        type: doc.mimetype as "application/pdf" | "image/jpeg" | "image/png",
        file_url: `/api/documents/${doc.id}/download`
      }]
    });
    setAnswers(newAnswers);
    setShowUploadFor(null);
  };

  const handleSubmitSecondRun = async () => {
    if (answers.size === 0) {
      toast({
        title: "Geen antwoorden",
        description: "Vul minimaal één antwoord in om de analyse te verfijnen",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const missing_info_answers = Array.from(answers.values());
      
      const result = await apiRequest("POST", `/api/cases/${caseId}/second-run`, {
        missing_info_answers,
        new_uploads: null
      });

      toast({
        title: "Analyse verfijnd",
        description: "De analyse is succesvol verfijnd met jouw antwoorden"
      });

      // Clear answers
      setAnswers(new Map());
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      
      // Call callback with result
      onSecondRunComplete(result);
    } catch (error) {
      toast({
        title: "Fout bij verfijnen",
        description: "Er is een fout opgetreden. Probeer het opnieuw.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!missingInfoStruct || missingInfoStruct.length === 0) {
    return null;
  }

  const getQuestionId = (item: MissingInfoItem, index: number) => {
    // Use actual ID from MindStudio if available, otherwise generate fallback
    return item.id || `q-${index}-${item.question.substring(0, 20).replace(/\s/g, '-')}`;
  };

  return (
    <Card className="border-yellow-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-700">
          <AlertTriangle className="h-5 w-5" />
          Verfijn Analyse - Beantwoord Vragen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Beantwoord de onderstaande vragen om de analyse te verfijnen. Je antwoorden worden gebruikt voor een tweede analyse.
        </p>

        {missingInfoStruct.map((item, index) => {
          const questionId = getQuestionId(item, index);
          const answerType = item.answer_type || item.ui || 'text';
          const currentAnswer = answers.get(questionId);

          return (
            <div key={questionId} className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-yellow-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-sm font-medium">{item.question}</Label>
                  {item.expected && (
                    <p className="text-xs text-muted-foreground mt-1">Verwacht: {item.expected}</p>
                  )}
                </div>
                {currentAnswer && (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
              </div>

              {/* Text Input */}
              {answerType === 'text' && (
                <Textarea
                  placeholder="Jouw antwoord..."
                  value={currentAnswer?.answer_text || ''}
                  onChange={(e) => handleTextAnswer(questionId, e.target.value)}
                  className="min-h-20"
                  data-testid={`textarea-answer-${index}`}
                />
              )}

              {/* Multiple Choice */}
              {answerType === 'multiple_choice' && item.expected && (
                <Select
                  value={currentAnswer?.answer_choice || ''}
                  onValueChange={(value) => handleMultipleChoiceAnswer(questionId, value)}
                >
                  <SelectTrigger data-testid={`select-answer-${index}`}>
                    <SelectValue placeholder="Maak een keuze..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(item.expected) 
                      ? item.expected 
                      : item.expected.split('|')
                    ).map((option: string) => (
                      <SelectItem key={option.trim()} value={option.trim()}>
                        {option.trim()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* File Upload */}
              {answerType === 'file_upload' && (
                <div className="space-y-2">
                  <DocumentUpload
                    open={showUploadFor === questionId}
                    onOpenChange={(open) => setShowUploadFor(open ? questionId : null)}
                    caseId={caseId}
                    onSuccess={(documents) => handleFileUpload(questionId, documents)}
                  />
                  {currentAnswer?.answer_files ? (
                    <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded">
                      <span className="text-sm">{currentAnswer.answer_files[0].name}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowUploadFor(questionId)}
                        data-testid={`button-change-file-${index}`}
                      >
                        Wijzig
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setShowUploadFor(questionId)}
                      className="w-full"
                      data-testid={`button-upload-file-${index}`}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Bestand uploaden
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {answers.size} van {missingInfoStruct.length} vragen beantwoord
          </p>
          <Button
            onClick={handleSubmitSecondRun}
            disabled={isSubmitting || answers.size === 0}
            data-testid="button-refine-analysis"
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? "Bezig met verfijnen..." : "Verfijn Analyse"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
