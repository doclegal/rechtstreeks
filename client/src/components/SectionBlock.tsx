import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Sparkles } from "lucide-react";

type SectionStatus = "pending" | "generating" | "draft" | "needs_changes" | "approved";

interface SectionBlockProps {
  sectionKey: string;
  sectionName: string;
  stepOrder: number;
  status: SectionStatus;
  generatedText?: string | null;
  userFeedback?: string | null;
  warnings?: string[];
  disabled?: boolean;
  isReadOnly?: boolean;
  isGenerating?: boolean;
  onGenerate: () => Promise<void>;
  onApprove: () => Promise<void>;
  onNeedsChanges: () => void;
  onRevise: (feedback: string) => Promise<void>;
}

export function SectionBlock({
  sectionKey,
  sectionName,
  stepOrder,
  status,
  generatedText,
  userFeedback,
  warnings = [],
  disabled = false,
  isReadOnly = false,
  isGenerating = false,
  onGenerate,
  onApprove,
  onNeedsChanges,
  onRevise
}: SectionBlockProps) {
  const [showFeedbackForm, setShowFeedbackForm] = useState(!!userFeedback); // Show if there's existing feedback
  const [feedbackText, setFeedbackText] = useState(userFeedback || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Check if feedback has been submitted (saved to database)
  const isFeedbackSubmitted = userFeedback && userFeedback === feedbackText;

  const getStatusBadge = () => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" data-testid={`badge-pending-${sectionKey}`}>
            <AlertTriangle className="w-3 h-3 mr-1" />
            Wachten
          </Badge>
        );
      case "generating":
        return (
          <Badge variant="default" className="bg-blue-500" data-testid={`badge-generating-${sectionKey}`}>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Genereren...
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-700" data-testid={`badge-draft-${sectionKey}`}>
            <Sparkles className="w-3 h-3 mr-1" />
            Concept
          </Badge>
        );
      case "needs_changes":
        return (
          <Badge variant="destructive" data-testid={`badge-needs-changes-${sectionKey}`}>
            <XCircle className="w-3 h-3 mr-1" />
            Wijzigingen nodig
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="bg-green-600" data-testid={`badge-approved-${sectionKey}`}>
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Goedgekeurd
          </Badge>
        );
    }
  };

  const handleReviseClick = async () => {
    if (!feedbackText.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onRevise(feedbackText);
      // Don't hide the form - keep it visible to show submitted feedback
      // setShowFeedbackForm(false);
      // Don't clear the text - keep it to show what was submitted
      // setFeedbackText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNeedsChangesClick = () => {
    onNeedsChanges();
    setShowFeedbackForm(true);
  };

  if (isReadOnly) {
    return (
      <Card className="mb-6" data-testid={`section-readonly-${sectionKey}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              {stepOrder}. {sectionName}
            </CardTitle>
            <Badge variant="secondary" data-testid={`badge-fixed-${sectionKey}`}>
              Vast
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded border" data-testid={`section-content-${sectionKey}`}>
            {generatedText || "(Geen tekst beschikbaar)"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6" data-testid={`section-block-${sectionKey}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {stepOrder}. {sectionName}
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent>
        {/* Warnings */}
        {warnings.length > 0 && (
          <Alert className="mb-4" data-testid={`warnings-${sectionKey}`}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Generated Content */}
        {generatedText && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded border text-sm whitespace-pre-wrap" data-testid={`section-content-${sectionKey}`}>
            {generatedText}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {status === "pending" && (
            <Button
              onClick={onGenerate}
              disabled={disabled || isGenerating}
              data-testid={`button-generate-${sectionKey}`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Genereren...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Genereer
                </>
              )}
            </Button>
          )}
          
          {status === "generating" && (
            <Button
              disabled
              data-testid={`button-generating-${sectionKey}`}
            >
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Genereren...
            </Button>
          )}

          {(status === "draft" || status === "needs_changes") && (
            <>
              <Button
                onClick={onApprove}
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                disabled={disabled || isGenerating}
                data-testid={`button-approve-${sectionKey}`}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Goedkeuren
              </Button>

              {status === "draft" && (
                <Button
                  onClick={handleNeedsChangesClick}
                  variant="outline"
                  disabled={disabled || isGenerating}
                  data-testid={`button-needs-changes-${sectionKey}`}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Wijzigingen nodig
                </Button>
              )}

              <Button
                onClick={onGenerate}
                variant="outline"
                disabled={disabled || isGenerating}
                data-testid={`button-regenerate-${sectionKey}`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Genereren...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Opnieuw genereren
                  </>
                )}
              </Button>
            </>
          )}

          {status === "approved" && (
            <Button
              onClick={onGenerate}
              variant="outline"
              disabled={disabled || isGenerating}
              data-testid={`button-reopen-${sectionKey}`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Genereren...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Heropenen
                </>
              )}
            </Button>
          )}
        </div>

        {/* Feedback Form */}
        {showFeedbackForm && (
          <div 
            className={`mt-4 p-4 border rounded transition-colors ${
              isFeedbackSubmitted 
                ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700' 
                : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700'
            }`}
            data-testid={`feedback-form-${sectionKey}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {isFeedbackSubmitted && (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              )}
              <label className="block text-sm font-medium">
                {isFeedbackSubmitted ? 'Toegevoegde context (verzonden)' : 'Wat moet er worden aangepast?'}
              </label>
            </div>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Beschrijf welke wijzigingen nodig zijn..."
              className="mb-3"
              rows={4}
              data-testid={`textarea-feedback-${sectionKey}`}
              disabled={!!isFeedbackSubmitted}
            />
            <div className="flex gap-2">
              {!isFeedbackSubmitted && (
                <>
                  <Button
                    onClick={handleReviseClick}
                    disabled={!feedbackText.trim() || isSubmitting}
                    data-testid={`button-revise-${sectionKey}`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Reviseren...
                      </>
                    ) : (
                      "Reviseer met feedback"
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowFeedbackForm(false);
                      setFeedbackText(userFeedback || "");
                    }}
                    variant="outline"
                    disabled={isSubmitting}
                    data-testid={`button-cancel-feedback-${sectionKey}`}
                  >
                    Annuleer
                  </Button>
                </>
              )}
              {isFeedbackSubmitted && (
                <Button
                  onClick={() => setFeedbackText("")}
                  variant="outline"
                  size="sm"
                  data-testid={`button-edit-feedback-${sectionKey}`}
                >
                  Wijzig feedback
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
