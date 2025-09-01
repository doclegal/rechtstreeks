import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus } from "lucide-react";
import DocumentUpload from "./DocumentUpload";
import { useState } from "react";

interface MissingDocument {
  name: string;
  description?: string;
  required: boolean;
}

interface MissingDocumentsProps {
  missingDocs: MissingDocument[];
  caseId: string;
  onDocumentUploaded?: () => void;
}

export default function MissingDocuments({ 
  missingDocs, 
  caseId, 
  onDocumentUploaded 
}: MissingDocumentsProps) {
  const [showUpload, setShowUpload] = useState(false);

  const requiredCount = missingDocs.filter(doc => doc.required).length;

  if (!missingDocs.length) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Wat we nog nodig hebben
            </CardTitle>
            <Badge variant="secondary" className="bg-warning text-white" data-testid="badge-missing-count">
              {requiredCount} ontbrekend
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {missingDocs.map((doc, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
                data-testid={`missing-doc-${index}`}
              >
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <div>
                    <span className="text-sm text-foreground font-medium">
                      {doc.name}
                    </span>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {doc.description}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary/80"
                  onClick={() => setShowUpload(true)}
                  data-testid={`button-upload-${index}`}
                >
                  Upload
                </Button>
              </div>
            ))}
          </div>
          
          <Button 
            variant="secondary" 
            className="w-full mt-4"
            onClick={() => setShowUpload(true)}
            data-testid="button-add-document"
          >
            <Plus className="mr-2 h-4 w-4" />
            Document toevoegen
          </Button>
        </CardContent>
      </Card>

      <DocumentUpload
        open={showUpload}
        onOpenChange={setShowUpload}
        caseId={caseId}
        onSuccess={() => {
          setShowUpload(false);
          onDocumentUploaded?.();
        }}
      />
    </>
  );
}
