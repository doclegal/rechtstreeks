import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CloudUpload, X, FileText, CheckCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DocumentUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  onSuccess?: (documents: any[]) => void;
}

export default function DocumentUpload({ 
  open, 
  onOpenChange, 
  caseId, 
  onSuccess 
}: DocumentUploadProps) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/cases/${caseId}/uploads`, {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'uploads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: "Upload voltooid",
        description: "Document is succesvol geüpload",
      });
      // Backend returns array directly, not { documents: [] }
      onSuccess?.(Array.isArray(data) ? data : []);
    },
    onError: (error) => {
      toast({
        title: "Upload mislukt",
        description: "Er is een fout opgetreden bij het uploaden",
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Only accept the first file
    const file = acceptedFiles[0];
    
    if (!file) return;
    
    // Validate file type and size
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'text/csv',
      'message/rfc822'
    ];
    
    const isValidType = validTypes.includes(file.type) || file.name.endsWith('.eml');
    const isValidSize = file.size <= 100 * 1024 * 1024; // 100MB
    
    if (!isValidType) {
      toast({
        title: "Bestandstype niet ondersteund",
        description: `${file.name} heeft een niet-ondersteund bestandstype`,
        variant: "destructive",
      });
      return;
    }
    
    if (!isValidSize) {
      toast({
        title: "Bestand te groot",
        description: `${file.name} is groter dan 100MB`,
        variant: "destructive",
      });
      return;
    }

    // Simulate upload progress
    const fileName = file.name;
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setUploadedFiles([fileName]);
      }
      setUploadProgress({ [fileName]: progress });
    }, 200);

    uploadMutation.mutate(file);
  }, [caseId, uploadMutation, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'message/rfc822': ['.eml'],
    },
  });

  const handleClose = () => {
    setUploadProgress({});
    setUploadedFiles([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Document uploaden</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              data-testid="button-close-upload"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
              isDragActive 
                ? "border-primary/50 bg-primary/5" 
                : "border-border hover:border-primary/50"
            )}
            data-testid="dropzone-upload"
          >
            <input {...getInputProps()} />
            <CloudUpload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">
              Sleep een bestand hierheen of klik om te uploaden
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Upload 1 document per keer • PDF, DOCX, JPG, PNG, EML (max 100 MB)
            </p>
            <Button type="button" data-testid="button-select-files">
              Bestand selecteren
            </Button>
          </div>

          {/* Upload progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Upload voortgang</h4>
              {Object.entries(uploadProgress).map(([fileName, progress]) => (
                <div key={fileName} className="space-y-2" data-testid={`upload-progress-${fileName}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {uploadedFiles.includes(fileName) ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-foreground break-words">
                        {fileName}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground flex-shrink-0">
                      {uploadedFiles.includes(fileName) ? "Voltooid" : `${Math.round(progress)}%`}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={uploadMutation.isPending}
            data-testid="button-cancel-upload"
          >
            Annuleren
          </Button>
          <Button
            onClick={handleClose}
            disabled={Object.keys(uploadProgress).length === 0}
            data-testid="button-finish-upload"
          >
            Gereed
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
