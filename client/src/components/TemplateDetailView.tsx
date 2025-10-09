import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings2, Plus, X, Save, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TemplateDetailViewProps {
  template: any;
  onUpdate?: () => void;
}

export function TemplateDetailView({ template, onUpdate }: TemplateDetailViewProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Check if multi-step template
  const isMultiStep = template.isMultiStep || false;
  const [sectionsConfig, setSectionsConfig] = useState<any[]>(
    template.sectionsConfig || []
  );
  
  // Flow linking state (for single-step templates)
  const [flowName, setFlowName] = useState(template.mindstudioFlowName || "");
  const [flowId, setFlowId] = useState(template.mindstudioFlowId || "");
  const [launchVariables, setLaunchVariables] = useState<string[]>(
    template.launchVariables || []
  );
  const [returnDataKeys, setReturnDataKeys] = useState<{key: string, value: string}[]>(
    template.returnDataKeys || []
  );
  
  // Add/remove launch variables
  const [newLaunchVar, setNewLaunchVar] = useState("");
  
  const handleAddLaunchVariable = () => {
    if (newLaunchVar.trim() && !launchVariables.includes(newLaunchVar.trim())) {
      setLaunchVariables([...launchVariables, newLaunchVar.trim()]);
      setNewLaunchVar("");
    }
  };
  
  const handleRemoveLaunchVariable = (index: number) => {
    setLaunchVariables(launchVariables.filter((_, i) => i !== index));
  };
  
  // Add/remove return data keys
  const [newReturnKey, setNewReturnKey] = useState("");
  const [newReturnValue, setNewReturnValue] = useState("");
  
  const handleAddReturnData = () => {
    if (newReturnKey.trim()) {
      setReturnDataKeys([...returnDataKeys, { 
        key: newReturnKey.trim(), 
        value: newReturnValue.trim() 
      }]);
      setNewReturnKey("");
      setNewReturnValue("");
    }
  };
  
  const handleRemoveReturnData = (index: number) => {
    setReturnDataKeys(returnDataKeys.filter((_, i) => i !== index));
  };
  
  // Update return data value
  const handleUpdateReturnValue = (index: number, value: string) => {
    const updated = [...returnDataKeys];
    updated[index].value = value;
    setReturnDataKeys(updated);
  };
  
  // Multi-step section handlers
  const handleUpdateSectionFlow = (sectionKey: string, flowName: string) => {
    const updated = sectionsConfig.map(section => 
      section.sectionKey === sectionKey 
        ? { ...section, flowName }
        : section
    );
    setSectionsConfig(updated);
  };
  
  const handleUpdateSectionFeedbackVar = (sectionKey: string, feedbackVariableName: string) => {
    const updated = sectionsConfig.map(section => 
      section.sectionKey === sectionKey 
        ? { ...section, feedbackVariableName }
        : section
    );
    setSectionsConfig(updated);
  };
  
  const handleSaveFlowConfig = async () => {
    setIsSaving(true);
    try {
      const payload: any = {};
      
      // For multi-step templates, only send sectionsConfig
      if (isMultiStep) {
        payload.sectionsConfig = sectionsConfig;
      } else {
        // For single-step templates, send flow config
        if (flowName.trim()) {
          payload.mindstudioFlowName = flowName;
        }
        if (flowId) {
          payload.mindstudioFlowId = flowId;
        }
        payload.launchVariables = launchVariables;
        payload.returnDataKeys = returnDataKeys;
      }
      
      const response = await apiRequest("PATCH", `/api/templates/${template.id}/flow`, payload);
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
        toast({
          title: "Flow configuratie opgeslagen",
          description: "De MindStudio flow is succesvol gekoppeld aan deze template",
        });
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      toast({
        title: "Opslaan mislukt",
        description: "Er is een fout opgetreden bij het opslaan van de flow configuratie",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    setIsDeleting(true);
    try {
      const response = await apiRequest("DELETE", `/api/templates/${template.id}`);
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
        toast({
          title: "Template verwijderd",
          description: `Template "${template.name}" is succesvol verwijderd`,
        });
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      toast({
        title: "Verwijderen mislukt",
        description: "Er is een fout opgetreden bij het verwijderen van de template",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Parse user and AI fields from template
  const userFields = template.userFieldsJson || [];
  const aiFields = template.aiFieldsJson || [];
  
  return (
    <Card className="mt-4" data-testid={`template-detail-${template.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              data-testid="toggle-template-detail"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Template Details & MindStudio Flow Koppeling</CardTitle>
          </div>
          <Badge variant={flowName ? "default" : "secondary"} data-testid="flow-status-badge">
            {flowName ? `Flow: ${flowName}` : "Geen flow gekoppeld"}
          </Badge>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Template Fields Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold">User Fields ([velden])</Label>
              <div className="mt-2 space-y-1">
                {userFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Geen user fields gevonden</p>
                ) : (
                  userFields.map((field: any, idx: number) => (
                    <Badge key={idx} variant="outline" className="mr-1 mb-1" data-testid={`user-field-${idx}`}>
                      [{field.key}] <span className="ml-1 text-xs">({field.occurrences}x)</span>
                    </Badge>
                  ))
                )}
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-semibold">AI Fields ({'{velden}'})</Label>
              <div className="mt-2 space-y-1">
                {aiFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Geen AI fields gevonden</p>
                ) : (
                  aiFields.map((field: any, idx: number) => (
                    <Badge key={idx} variant="outline" className="mr-1 mb-1 bg-amber-50" data-testid={`ai-field-${idx}`}>
                      {'{'}
                      {field.key}
                      {'}'} <span className="ml-1 text-xs">({field.occurrences}x)</span>
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>
          
          <hr />
          
          {/* Multi-Step Configuration */}
          {isMultiStep && (
            <>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">🔹 Multi-Step Template: 7 Secties</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configureer per sectie de MindStudio flow en feedback variable naam. De flow wordt aangeroepen bij "Genereren", de feedback variable wordt gebruikt bij "Afwijzen + opnieuw genereren".
                  </p>
                </div>
                
                <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                  {sectionsConfig.map((section, idx) => (
                    <div key={section.sectionKey} className="space-y-2 pb-3 border-b last:border-b-0" data-testid={`section-config-${idx}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Stap {section.stepOrder}
                        </Badge>
                        <span className="font-medium text-sm">{section.sectionName}</span>
                        <Badge variant="secondary" className="text-xs ml-auto">
                          {'{'}
                          {section.aiFieldKey}
                          {'}'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 ml-4">
                        <div>
                          <Label htmlFor={`flow-${section.sectionKey}`} className="text-xs">
                            MindStudio Flow Naam
                          </Label>
                          <Input
                            id={`flow-${section.sectionKey}`}
                            value={section.flowName || ""}
                            onChange={(e) => handleUpdateSectionFlow(section.sectionKey, e.target.value)}
                            placeholder="bijv: GenerateVorderingen.flow"
                            className="text-sm h-8"
                            data-testid={`input-section-flow-${idx}`}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`feedback-${section.sectionKey}`} className="text-xs">
                            Feedback Variable Naam
                          </Label>
                          <Input
                            id={`feedback-${section.sectionKey}`}
                            value={section.feedbackVariableName || ""}
                            onChange={(e) => handleUpdateSectionFeedbackVar(section.sectionKey, e.target.value)}
                            placeholder="bijv: user_feedback"
                            className="text-sm h-8"
                            data-testid={`input-section-feedback-${idx}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <hr />
            </>
          )}
          
          {/* Flow Configuration (Single-Step) */}
          {!isMultiStep && (
            <>
              <div className="space-y-4">
            <div>
              <Label htmlFor="flow-name">MindStudio Flow Name</Label>
              <Input
                id="flow-name"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                placeholder="bijv: CreateDagvaarding.flow"
                data-testid="input-flow-name"
              />
            </div>
            
            <div>
              <Label htmlFor="flow-id">MindStudio Flow ID (optioneel)</Label>
              <Input
                id="flow-id"
                value={flowId}
                onChange={(e) => setFlowId(e.target.value)}
                placeholder="bijv: flow_12345abc"
                data-testid="input-flow-id"
              />
            </div>
          </div>
          
          <hr />
          
          {/* Launch Variables (Start block) */}
          <div>
            <Label className="text-sm font-semibold">Launch Variables (Start block)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Variabelen die de MindStudio flow verwacht als input. Voeg deze toe aan het Launch Variables block in MindStudio.
            </p>
            
            <div className="space-y-2">
              {launchVariables.map((variable, idx) => (
                <div key={idx} className="flex items-center gap-2" data-testid={`launch-var-${idx}`}>
                  <Badge variant="secondary">{variable}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveLaunchVariable(idx)}
                    data-testid={`remove-launch-var-${idx}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              
              <div className="flex gap-2">
                <Input
                  value={newLaunchVar}
                  onChange={(e) => setNewLaunchVar(e.target.value)}
                  placeholder="Variabele naam (bijv: case_data, analysis_json)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLaunchVariable();
                    }
                  }}
                  data-testid="input-new-launch-var"
                />
                <Button onClick={handleAddLaunchVariable} size="sm" data-testid="button-add-launch-var">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <hr />
          
          {/* Return Data (End block) */}
          <div>
            <Label className="text-sm font-semibold">Return Data (End block)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              JSON keys die de MindStudio flow teruggeeft. Deze worden gemapt naar de {'{AI velden}'} in de template.
            </p>
            
            <div className="space-y-2">
              {returnDataKeys.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2" data-testid={`return-data-${idx}`}>
                  <Badge variant="outline">{item.key}</Badge>
                  <Input
                    value={item.value}
                    onChange={(e) => handleUpdateReturnValue(idx, e.target.value)}
                    placeholder="Voorbeeldwaarde of beschrijving"
                    className="flex-1"
                    data-testid={`input-return-value-${idx}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveReturnData(idx)}
                    data-testid={`remove-return-data-${idx}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              
              <div className="flex gap-2">
                <Input
                  value={newReturnKey}
                  onChange={(e) => setNewReturnKey(e.target.value)}
                  placeholder="JSON key (bijv: dagvaarding_tekst)"
                  className="flex-1"
                  data-testid="input-new-return-key"
                />
                <Input
                  value={newReturnValue}
                  onChange={(e) => setNewReturnValue(e.target.value)}
                  placeholder="Voorbeeldwaarde"
                  className="flex-1"
                  data-testid="input-new-return-value"
                />
                <Button onClick={handleAddReturnData} size="sm" data-testid="button-add-return-data">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
              </>
            )}
          
          <div className="flex justify-between pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  disabled={isDeleting}
                  data-testid="button-delete-template"
                >
                  {isDeleting ? (
                    <>Verwijderen...</>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Template Verwijderen
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Template definitief verwijderen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Je staat op het punt om template "{template.name}" ({template.version}) te verwijderen. 
                    Deze actie kan niet ongedaan gemaakt worden. Het template wordt volledig uit het systeem verwijderd.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="cancel-delete">Annuleren</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteTemplate}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="confirm-delete"
                  >
                    Ja, verwijderen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <Button 
              onClick={handleSaveFlowConfig} 
              disabled={isSaving || (!isMultiStep && !flowName)}
              data-testid="button-save-flow-config"
            >
              {isSaving ? (
                <>Opslaan...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Flow Configuratie Opslaan
                </>
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
