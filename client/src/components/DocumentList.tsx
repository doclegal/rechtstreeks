import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  FileText, 
  File, 
  Image, 
  Mail, 
  Eye, 
  Download, 
  Plus,
  Calendar,
  Trash2
} from "lucide-react";
import DocumentViewer from "@/components/DocumentViewer";
import DocumentUpload from "@/components/DocumentUpload";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

interface Document {
  id: string;
  filename: string;
  storageKey: string;
  mimetype: string;
  sizeBytes: number;
  createdAt: string;
}

interface DocumentListProps {
  documents: Document[];
  caseId: string;
  onDocumentUploaded?: () => void;
}

export default function DocumentList({ 
  documents, 
  caseId, 
  onDocumentUploaded 
}: DocumentListProps) {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getFileIcon = (mimetype: string) => {
    if (mimetype === "application/pdf") {
      return <FileText className="h-5 w-5 text-red-500" />;
    } else if (mimetype.includes("word")) {
      return <File className="h-5 w-5 text-blue-500" />;
    } else if (mimetype.startsWith("image/")) {
      return <Image className="h-5 w-5 text-green-500" />;
    } else if (mimetype === "message/rfc822") {
      return <Mail className="h-5 w-5 text-purple-500" />;
    }
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleDownload = (document: Document) => {
    window.open(`/api/files/${document.storageKey}`, '_blank');
  };

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiRequest('DELETE', `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Document verwijderd",
        description: "Het document is succesvol verwijderd.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'uploads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] }); // Refresh case for updatedAt
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] }); // Refresh cases list
      onDocumentUploaded?.(); // Refresh the document list
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij verwijderen",
        description: error.message || "Het document kon niet worden verwijderd.",
        variant: "destructive",
      });
    }
  });

  const handleDeleteDocument = (document: Document) => {
    if (confirm(`Weet je zeker dat je '${document.filename}' wilt verwijderen?`)) {
      deleteDocumentMutation.mutate(document.id);
    }
  };

  if (documents.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Geen documenten</h3>
            <p className="text-muted-foreground mb-6">
              Upload uw eerste documenten om te beginnen met de analyse.
            </p>
            <Button onClick={() => setShowUpload(true)} data-testid="button-upload-first-document">
              <Plus className="h-4 w-4 mr-2" />
              Eerste document uploaden
            </Button>
          </CardContent>
        </Card>

        <DocumentUpload
          open={showUpload}
          onOpenChange={setShowUpload}
          caseId={caseId}
          onSuccess={() => {
            setShowUpload(false);
            // Invalidate queries to refresh case updatedAt timestamp  
            queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'uploads'] });
            queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
            queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
            onDocumentUploaded?.();
          }}
        />
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Geüploade documenten
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" data-testid="badge-document-count">
                {documents.length} document{documents.length !== 1 ? 'en' : ''}
              </Badge>
              <Button 
                size="sm" 
                onClick={() => setShowUpload(true)}
                data-testid="button-add-document"
              >
                <Plus className="h-4 w-4 mr-2" />
                Toevoegen
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents.map((document) => (
              <div 
                key={document.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                data-testid={`document-item-${document.id}`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    {getFileIcon(document.mimetype)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate" data-testid={`text-filename-${document.id}`}>
                      {document.filename}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(document.createdAt), { 
                            addSuffix: true, 
                            locale: nl 
                          })}
                        </span>
                      </div>
                      <span>{formatFileSize(document.sizeBytes)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDocument(document)}
                    data-testid={`button-preview-${document.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(document)}
                    data-testid={`button-download-${document.id}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDocument(document)}
                    disabled={deleteDocumentMutation.isPending}
                    data-testid={`button-delete-${document.id}`}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <DocumentViewer
        open={!!selectedDocument}
        onOpenChange={(open) => !open && setSelectedDocument(null)}
        document={selectedDocument}
      />

      <DocumentUpload
        open={showUpload}
        onOpenChange={setShowUpload}
        caseId={caseId}
        onSuccess={() => {
          setShowUpload(false);
          // Invalidate queries to refresh case updatedAt timestamp
          queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'uploads'] });
          queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
          queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
          onDocumentUploaded?.();
        }}
      />
    </>
  );
}
