import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Upload, Type, CheckCircle2, Send, Edit2, FileText, XCircle } from "lucide-react";
import DocumentUpload from "./DocumentUpload";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MissingRequirement } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface MissingInfoProps {
  requirements: MissingRequirement[];
  caseId: string;
  onUpdated?: () => void;
}

interface Answer {
  requirementId: string;
  kind: 'document' | 'text' | 'not_available';
  value?: string;
  documentId?: string;
  documentName?: string;
  notAvailable?: boolean;
}

export default function MissingInfo({ 
  requirements, 
  caseId, 
  onUpdated 
}: MissingInfoProps) {
  const { toast } = useToast();
  const [draftAnswers, setDraftAnswers] = useState<Map<string, Answer>>(new Map());
  const [textValues, setTextValues] = useState<Map<string, string>>(new Map());
  const [showUploadForReq, setShowUploadForReq] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingReqId, setEditingReqId] = useState<string | null>(null);

  // Fetch saved responses (already submitted)
  const { data: savedResponsesData } = useQuery<{ responses: Answer[] }>({
    queryKey: ['/api/cases', caseId, 'missing-info', 'responses'],
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/missing-info/responses`);
      if (!res.ok) throw new Error('Failed to fetch responses');
      return res.json();
    }
  });

  const savedResponses = savedResponsesData?.responses || [];
  
  // Create a Map of saved responses for easy lookup
  const savedResponsesMap = new Map<string, Answer>();
  savedResponses.forEach((response: Answer) => {
    savedResponsesMap.set(response.requirementId, response);
  });

  const handleTextChange = (reqId: string, value: string) => {
    const newTextValues = new Map(textValues);
    newTextValues.set(reqId, value);
    setTextValues(newTextValues);
  };

  const handleTextBlur = (reqId: string) => {
    const value = textValues.get(reqId) || '';
    const trimmedValue = value.trim();
    const newAnswers = new Map(draftAnswers);
    
    if (trimmedValue) {
      newAnswers.set(reqId, {
        requirementId: reqId,
        kind: 'text',
        value: trimmedValue
      });
    } else {
      newAnswers.delete(reqId);
    }
    setDraftAnswers(newAnswers);
  };

  const handleSelectAnswer = (reqId: string, value: string) => {
    const newAnswers = new Map(draftAnswers);
    if (value) {
      newAnswers.set(reqId, {
        requirementId: reqId,
        kind: 'text',
        value: value
      });
    } else {
      newAnswers.delete(reqId);
    }
    setDraftAnswers(newAnswers);
  };

  const handleDocumentUploaded = async (reqId: string, documentId: string, documentName: string) => {
    const newAnswers = new Map(draftAnswers);
    newAnswers.set(reqId, {
      requirementId: reqId,
      kind: 'document',
      documentId,
      documentName
    });
    setDraftAnswers(newAnswers);
    
    // Clear any previous text value that might have been entered
    const newTextValues = new Map(textValues);
    newTextValues.delete(reqId);
    setTextValues(newTextValues);
    
    setShowUploadForReq(null);
  };

  const handleRemoveDraft = (reqId: string) => {
    const newAnswers = new Map(draftAnswers);
    newAnswers.delete(reqId);
    setDraftAnswers(newAnswers);
    
    // Also clear text value if exists
    const newTextValues = new Map(textValues);
    newTextValues.delete(reqId);
    setTextValues(newTextValues);
  };

  const handleNotAvailable = (reqId: string) => {
    const newAnswers = new Map(draftAnswers);
    newAnswers.set(reqId, {
      requirementId: reqId,
      kind: 'not_available',
      notAvailable: true
    });
    setDraftAnswers(newAnswers);
    
    // Clear any text value that might have been entered
    const newTextValues = new Map(textValues);
    newTextValues.delete(reqId);
    setTextValues(newTextValues);
  };

  const handleSubmit = async () => {
    // Check if all required items are answered (check both saved and draft)
    const unansweredRequired = requirements.filter(
      req => req.required && !savedResponsesMap.has(req.id) && !draftAnswers.has(req.id)
    );
    
    if (unansweredRequired.length > 0) {
      toast({
        title: "Verplichte velden ontbreken",
        description: `Beantwoord eerst alle ${unansweredRequired.length} verplichte ${unansweredRequired.length === 1 ? 'vraag' : 'vragen'}`,
        variant: "destructive"
      });
      return;
    }
    
    if (draftAnswers.size === 0) {
      toast({
        title: "Geen nieuwe antwoorden",
        description: "Vul minimaal één nieuw antwoord in voordat u verstuurt",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const responses = Array.from(draftAnswers.values());
      await apiRequest("POST", `/api/cases/${caseId}/missing-info/responses`, {
        responses
      });

      toast({
        title: "Antwoorden verstuurd",
        description: "Klik op 'Juridische Analyse' om een heranalyse te starten met de nieuwe informatie"
      });

      // Clear draft answers and editing state
      setDraftAnswers(new Map());
      setTextValues(new Map());
      setEditingReqId(null);
      
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'missing-info', 'responses'] });
      
      onUpdated?.();
    } catch (error) {
      toast({
        title: "Fout bij versturen",
        description: "Er is een fout opgetreden. Probeer het opnieuw.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!requirements || requirements.length === 0) {
    return null;
  }

  const requiredCount = requirements.filter(req => req.required).length;
  const requiredAnsweredCount = requirements.filter(req => req.required && savedResponsesMap.has(req.id)).length;
  const totalAnsweredCount = savedResponsesMap.size;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Wat we nog nodig hebben
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="secondary" className="bg-warning text-white" data-testid="badge-missing-count">
                {requiredCount - requiredAnsweredCount} vereist ontbrekend
              </Badge>
              {totalAnsweredCount > 0 && (
                <Badge variant="secondary" className="bg-success text-white" data-testid="badge-answered-count">
                  {totalAnsweredCount} beantwoord
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Beantwoord de vragen hieronder door <strong>tekst in te vullen</strong> of een <strong>document te uploaden</strong>. Klik daarna op "Versturen" om de informatie op te slaan.
            </AlertDescription>
          </Alert>

          {requirements.map((req) => {
            // Check if this requirement has been SUBMITTED (not just drafted)
            const isSubmitted = savedResponsesMap.has(req.id);
            const submittedAnswer = savedResponsesMap.get(req.id);
            const isEditing = editingReqId === req.id;
            
            // Check if there's a draft answer for this requirement
            const hasDraftAnswer = draftAnswers.has(req.id);
            const draftAnswer = draftAnswers.get(req.id);
            const isAnswered = isSubmitted || hasDraftAnswer;
            
            return (
              <div 
                key={req.id}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  isAnswered && !isEditing ? 'border-success bg-success/5' : 'border-muted bg-muted/50'
                }`}
                data-testid={`requirement-${req.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {isAnswered && !isEditing && <CheckCircle2 className="h-4 w-4 text-success" />}
                      {!isAnswered && !isEditing && <AlertTriangle className="h-4 w-4 text-warning" />}
                      {isEditing && <AlertTriangle className="h-4 w-4 text-warning" />}
                      <span className="font-medium text-foreground">
                        {req.label}
                      </span>
                      {req.required && (
                        <Badge variant="outline" className="text-xs">Vereist</Badge>
                      )}
                      {hasDraftAnswer && !isSubmitted && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                          Nog niet verstuurd
                        </Badge>
                      )}
                    </div>
                    {req.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {req.description}
                      </p>
                    )}
                    {req.examples && req.examples.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        Bijvoorbeeld: {req.examples.join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Draft answer preview (before submission) */}
                {!isSubmitted && hasDraftAnswer && (
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2 text-sm">
                      <div className="flex-1">
                        {draftAnswer?.kind === 'text' && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Type className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                              <span className="text-amber-700 dark:text-amber-300 text-xs font-medium">Uw antwoord (nog niet verstuurd):</span>
                            </div>
                            <p className="text-sm font-medium pl-6 text-foreground">{draftAnswer.value}</p>
                          </div>
                        )}
                        {draftAnswer?.kind === 'document' && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                              <span className="text-amber-700 dark:text-amber-300 text-xs font-medium">Document geüpload (nog niet verstuurd):</span>
                            </div>
                            <p className="text-sm font-medium pl-6 text-foreground">{draftAnswer.documentName || 'Document'}</p>
                          </div>
                        )}
                        {draftAnswer?.kind === 'not_available' && (
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                            <span className="text-amber-700 dark:text-amber-300 italic text-xs">Niet beschikbaar (nog niet verstuurd)</span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDraft(req.id)}
                        className="text-xs flex items-center gap-1 text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
                        data-testid={`button-remove-draft-${req.id}`}
                      >
                        <XCircle className="h-3 w-3" />
                        Verwijderen
                      </Button>
                    </div>
                  </div>
                )}

                {/* Input fields (only show if not answered OR not a draft) */}
                {!isSubmitted && !hasDraftAnswer && (
                  <div className="space-y-3 mt-3">
                    {/* Select dropdown for options (multiple_choice) */}
                    {req.options && req.options.length > 0 && req.inputKind === 'text' && (
                      <Select onValueChange={(value) => handleSelectAnswer(req.id, value)}>
                        <SelectTrigger data-testid={`select-${req.id}`}>
                          <SelectValue placeholder="Kies een optie..." />
                        </SelectTrigger>
                        <SelectContent>
                          {req.options.map((option, idx) => (
                            <SelectItem key={idx} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    {/* Text input - show for 'text', 'document' (flexible), or undefined */}
                    {(req.inputKind === 'text' || req.inputKind === 'document' || !req.inputKind) && (!req.options || req.options.length === 0) && (
                      <Textarea
                        placeholder="Typ hier uw antwoord..."
                        className="min-h-[80px]"
                        maxLength={req.maxLength}
                        value={textValues.get(req.id) || ''}
                        onChange={(e) => handleTextChange(req.id, e.target.value)}
                        onBlur={() => handleTextBlur(req.id)}
                        data-testid={`textarea-${req.id}`}
                      />
                    )}
                    
                    {/* Document upload - show for 'document' or undefined inputKind */}
                    {(req.inputKind === 'document' || !req.inputKind) && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowUploadForReq(req.id)}
                          data-testid={`button-upload-${req.id}`}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {req.inputKind === 'document' ? 'Upload document' : 'Of upload document'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleNotAvailable(req.id)}
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                          data-testid={`link-not-available-${req.id}`}
                        >
                          Ik heb dit niet
                        </button>
                      </div>
                    )}
                    
                    {/* Unsupported input kind */}
                    {req.inputKind && req.inputKind !== 'text' && req.inputKind !== 'document' && (
                      <div className="text-sm text-muted-foreground">
                        Dit veld ondersteunt alleen {req.inputKind} input (nog niet geïmplementeerd)
                      </div>
                    )}
                  </div>
                )}

                {isSubmitted && !isEditing && (
                  <div className="mt-3 p-3 bg-background rounded border">
                    <div className="flex items-start gap-2 text-sm">
                      <div className="flex-1">
                        {submittedAnswer?.kind === 'text' && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Type className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground text-xs">Tekst antwoord:</span>
                            </div>
                            <p className="text-sm font-medium pl-6">{submittedAnswer.value}</p>
                          </div>
                        )}
                        {submittedAnswer?.kind === 'document' && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground text-xs">Document:</span>
                            </div>
                            <p className="text-sm font-medium pl-6">{submittedAnswer.documentName || 'Geüpload document'}</p>
                          </div>
                        )}
                        {submittedAnswer?.kind === 'not_available' && (
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground italic text-xs">Niet beschikbaar</span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingReqId(req.id);
                        }}
                        className="text-xs flex items-center gap-1"
                        data-testid={`button-edit-${req.id}`}
                      >
                        <Edit2 className="h-3 w-3" />
                        Wijzigen
                      </Button>
                    </div>
                  </div>
                )}
                
                {isSubmitted && isEditing && (
                  <div className="space-y-3 mt-3">
                    {/* Show input fields when editing */}
                    {(req.inputKind === 'text' || req.inputKind === 'document' || !req.inputKind) && (!req.options || req.options.length === 0) && (
                      <Textarea
                        placeholder="Typ hier uw antwoord..."
                        className="min-h-[80px]"
                        maxLength={req.maxLength}
                        value={textValues.get(req.id) || ''}
                        onChange={(e) => handleTextChange(req.id, e.target.value)}
                        onBlur={() => handleTextBlur(req.id)}
                        data-testid={`textarea-edit-${req.id}`}
                      />
                    )}
                    
                    {(req.inputKind === 'document' || !req.inputKind) && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowUploadForReq(req.id)}
                          data-testid={`button-upload-edit-${req.id}`}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {req.inputKind === 'document' ? 'Upload nieuw document' : 'Of upload document'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleNotAvailable(req.id)}
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                          data-testid={`link-not-available-edit-${req.id}`}
                        >
                          Ik heb dit niet
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingReqId(null)}
                          className="text-xs text-muted-foreground hover:text-foreground underline ml-auto"
                          data-testid={`link-cancel-edit-${req.id}`}
                        >
                          Annuleren
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <Button
            onClick={handleSubmit}
            disabled={draftAnswers.size === 0 || isSubmitting}
            className="w-full"
            data-testid="button-submit-missing-info"
          >
            <Send className="mr-2 h-4 w-4" />
            {isSubmitting ? "Bezig met versturen..." : draftAnswers.size === 0 ? "Vul eerst antwoorden in" : `Versturen (${draftAnswers.size} ${draftAnswers.size === 1 ? 'antwoord' : 'antwoorden'})`}
          </Button>

          {draftAnswers.size > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Na het versturen kunt u een heranalyse starten met de nieuwe informatie
            </p>
          )}
        </CardContent>
      </Card>

      {showUploadForReq && (
        <DocumentUpload
          open={true}
          onOpenChange={(open) => !open && setShowUploadForReq(null)}
          caseId={caseId}
          onSuccess={(documents) => {
            // Use the first uploaded document's ID and name
            if (documents && documents.length > 0) {
              handleDocumentUploaded(showUploadForReq, documents[0].id, documents[0].filename);
              toast({
                title: "Document geüpload",
                description: `${documents[0].filename} is toegevoegd aan uw antwoord`
              });
            }
            setShowUploadForReq(null);
          }}
        />
      )}
    </>
  );
}
