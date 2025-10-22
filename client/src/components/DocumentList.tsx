import { useState, useEffect } from "react";
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
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Tag
} from "lucide-react";
import DocumentViewer from "@/components/DocumentViewer";
import DocumentUpload from "@/components/DocumentUpload";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

interface DocumentAnalysis {
  document_name: string;
  document_type: string;
  is_readable: boolean;
  belongs_to_case: boolean;
  summary: string;
  tags: string[];
  note?: string | null;
}

interface Document {
  id: string;
  filename: string;
  storageKey: string;
  mimetype: string;
  sizeBytes: number;
  createdAt: string;
  documentAnalysis?: DocumentAnalysis | null;
  analysisStatus?: 'pending' | 'analyzing' | 'completed' | 'failed';
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

  // Generate consistent color for each tag based on tag name
  const getTagColor = (tag: string) => {
    const colors = [
      { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300' },
      { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300' },
      { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-800 dark:text-pink-300' },
      { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300' },
      { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-800 dark:text-teal-300' },
      { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-300' },
      { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-300' },
      { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-800 dark:text-cyan-300' },
      { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-800 dark:text-rose-300' },
      { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300' },
    ];
    
    // Simple hash function to get consistent color for same tag
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Auto-refresh while documents are being analyzed
  useEffect(() => {
    const hasAnalyzing = documents.some(doc => 
      doc.analysisStatus === 'analyzing' || doc.analysisStatus === 'pending'
    );

    if (hasAnalyzing) {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
        queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      }, 3000); // Refresh every 3 seconds

      return () => clearInterval(interval);
    }
  }, [documents, caseId, queryClient]);

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
                className="border border-border rounded-lg overflow-hidden"
                data-testid={`document-item-${document.id}`}
              >
                {/* Document header */}
                <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
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

                {/* Document analysis section */}
                {document.analysisStatus === 'analyzing' && (
                  <div className="px-4 pb-4 pt-2 border-t border-border bg-blue-50 dark:bg-blue-950/20" data-testid={`analysis-analyzing-${document.id}`}>
                    <div className="flex items-center space-x-2 text-sm text-blue-700 dark:text-blue-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="font-medium">Document wordt geanalyseerd...</span>
                    </div>
                  </div>
                )}

                {document.analysisStatus === 'completed' && document.documentAnalysis && (
                  <div className="px-4 pb-4 pt-2 border-t border-border bg-green-50 dark:bg-green-950/20" data-testid={`analysis-completed-${document.id}`}>
                    {/* Summary */}
                    <div className="mb-3">
                      <div className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-green-900 dark:text-green-100 leading-relaxed">
                            {document.documentAnalysis.summary}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    {document.documentAnalysis.tags && document.documentAnalysis.tags.length > 0 && (
                      <div className="flex items-center flex-wrap gap-2 mb-3">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        {document.documentAnalysis.tags.map((tag, index) => {
                          const tagColor = getTagColor(tag);
                          return (
                            <Badge 
                              key={index} 
                              variant="secondary" 
                              className={`${tagColor.bg} ${tagColor.text} border-0`}
                              data-testid={`tag-${document.id}-${index}`}
                            >
                              {tag}
                            </Badge>
                          );
                        })}
                      </div>
                    )}

                    {/* Note/Warning */}
                    {document.documentAnalysis.note && (
                      <div className="flex items-start space-x-2 p-2 bg-amber-100 dark:bg-amber-950/30 rounded-md">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-900 dark:text-amber-100" data-testid={`note-${document.id}`}>
                          {document.documentAnalysis.note}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {document.analysisStatus === 'failed' && (
                  <div className="px-4 pb-4 pt-2 border-t border-border bg-red-50 dark:bg-red-950/20" data-testid={`analysis-failed-${document.id}`}>
                    <div className="flex items-center space-x-2 text-sm text-red-700 dark:text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      <span>Analyse mislukt. Probeer het document opnieuw te uploaden.</span>
                    </div>
                  </div>
                )}
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
