import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, FileText } from "lucide-react";

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    filename: string;
    storageKey: string;
    mimetype: string;
  } | null;
}

export default function DocumentViewer({ 
  open, 
  onOpenChange, 
  document 
}: DocumentViewerProps) {
  const [isLoading, setIsLoading] = useState(true);

  if (!document) return null;

  const isPDF = document.mimetype === 'application/pdf';
  const fileUrl = `/api/files/${document.storageKey}`;

  const handleDownload = () => {
    window.open(fileUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span data-testid="text-document-name">{document.filename}</span>
            </DialogTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                data-testid="button-download-document"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-viewer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-muted rounded-lg p-4">
          {isPDF ? (
            <div className="w-full h-full">
              <iframe
                src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                className="w-full h-full border-0 rounded"
                title={document.filename}
                onLoad={() => setIsLoading(false)}
                data-testid="pdf-viewer"
              />
              {isLoading && (
                <div className="absolute inset-4 flex items-center justify-center bg-muted rounded">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">PDF wordt geladen...</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg border-2 border-dashed border-border">
              <div className="text-center">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">Voorvertoning niet beschikbaar</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Klik op Download om het bestand te openen
                </p>
                <Button 
                  className="mt-4"
                  onClick={handleDownload}
                  data-testid="button-download-preview"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download bestand
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
