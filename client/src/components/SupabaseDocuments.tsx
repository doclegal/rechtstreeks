import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getAuthHeaders } from "@/lib/queryClient";
import { 
  FileText, 
  File, 
  Image, 
  CloudUpload,
  Download, 
  Trash2,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  Tag
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DocumentAnalysis {
  document_name: string;
  document_type: string | null;
  is_readable: boolean;
  belongs_to_case: boolean;
  summary: string;
  tags: string[];
  note: string | null;
  created_at: string;
}

interface SupabaseDocument {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  analysis?: DocumentAnalysis | null;
}

interface SupabaseDocumentsProps {
  caseId: string;
}

export default function SupabaseDocuments({ caseId }: SupabaseDocumentsProps) {
  const [showUpload, setShowUpload] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading, refetch } = useQuery<SupabaseDocument[]>({
    queryKey: ['/api/cases', caseId, 'documents'],
    queryFn: async () => {
      const response = await fetch(`/api/cases/${caseId}/documents`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      return response.json();
    },
    enabled: !!caseId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/cases/${caseId}/documents`, {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'documents'] });
      setShowUpload(false);
      
      const hasAnalysis = data.analysis !== null;
      const hasError = data.analysis_error !== null;
      
      if (hasAnalysis) {
        toast({
          title: "Upload voltooid",
          description: "Document is succesvol geüpload en geanalyseerd",
        });
      } else if (hasError) {
        toast({
          title: "Upload voltooid",
          description: "Document is geüpload, maar analyse is niet beschikbaar",
          variant: "default",
        });
      } else {
        toast({
          title: "Upload voltooid",
          description: "Document is succesvol geüpload",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload mislukt",
        description: error.message || "Er is een fout opgetreden bij het uploaden",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest("DELETE", `/api/documents/${documentId}/supabase`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'documents'] });
      toast({
        title: "Document verwijderd",
        description: "Het document is succesvol verwijderd",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verwijderen mislukt",
        description: error.message || "Er is een fout opgetreden bij het verwijderen",
        variant: "destructive",
      });
    },
  });

  const handleDownload = async (doc: SupabaseDocument) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/url`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }
      
      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error) {
      toast({
        title: "Download mislukt",
        description: "Kon download link niet genereren",
        variant: "destructive",
      });
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    uploadMutation.mutate(file);
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'text/plain': ['.txt'],
    },
  });

  const handleCloseUpload = () => {
    setShowUpload(false);
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-5 w-5" />;
    if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (mimeType.includes('image')) return <Image className="h-5 w-5 text-blue-500" />;
    if (mimeType.includes('word')) return <FileText className="h-5 w-5 text-blue-600" />;
    return <File className="h-5 w-5" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Onbekend';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Documenten laden...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Supabase Documenten</CardTitle>
          <Button onClick={() => setShowUpload(true)} size="sm" data-testid="button-upload-supabase">
            <CloudUpload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nog geen documenten geüpload naar Supabase Storage</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowUpload(true)}
                data-testid="button-upload-first-supabase"
              >
                Upload eerste document
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div 
                  key={doc.id} 
                  className="border rounded-lg overflow-hidden"
                  data-testid={`supabase-doc-${doc.id}`}
                >
                  <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center space-x-3">
                      {getFileIcon(doc.mime_type)}
                      <div>
                        <p className="font-medium text-sm">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.size_bytes)} • {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: nl })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc)}
                        data-testid={`button-download-supabase-${doc.id}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(doc.id)}
                        disabled={deleteMutation.isPending}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        data-testid={`button-delete-supabase-${doc.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {doc.analysis ? (
                    <div className="px-4 pb-4 pt-2 border-t border-border bg-green-50 dark:bg-green-950/20" data-testid={`analysis-${doc.id}`}>
                      <div className="mb-3">
                        <div className="flex items-start space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-green-900 dark:text-green-100 leading-relaxed">
                              {doc.analysis.summary}
                            </p>
                          </div>
                        </div>
                      </div>

                      {doc.analysis.tags && doc.analysis.tags.length > 0 && (
                        <div className="flex items-center flex-wrap gap-2 mb-3">
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          {doc.analysis.tags.map((tag, index) => (
                            <Badge 
                              key={index} 
                              variant="secondary" 
                              className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-0"
                              data-testid={`tag-${doc.id}-${index}`}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {doc.analysis.note && (
                        <div className="flex items-start space-x-2 p-2 bg-amber-100 dark:bg-amber-950/30 rounded-md">
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-amber-900 dark:text-amber-100" data-testid={`note-${doc.id}`}>
                            {doc.analysis.note}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 pb-3 pt-2 border-t border-border bg-muted/30" data-testid={`no-analysis-${doc.id}`}>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <File className="h-4 w-4" />
                        <span>Geen analyse beschikbaar</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showUpload} onOpenChange={handleCloseUpload}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Document uploaden naar Supabase</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseUpload}
                data-testid="button-close-supabase-upload"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {uploadMutation.isPending ? (
              <div className="py-8 text-center" data-testid="upload-loading">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                <p className="text-foreground font-medium mb-1">
                  Document wordt verwerkt...
                </p>
                <p className="text-sm text-muted-foreground">
                  Uploaden en analyseren, even geduld
                </p>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                  isDragActive 
                    ? "border-primary/50 bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
                data-testid="dropzone-supabase-upload"
              >
                <input {...getInputProps()} />
                <CloudUpload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-medium mb-1">
                  Sleep een bestand hierheen
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF, DOCX, JPG, PNG, TXT (max 10 MB)
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={handleCloseUpload}
                disabled={uploadMutation.isPending}
              >
                Sluiten
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
