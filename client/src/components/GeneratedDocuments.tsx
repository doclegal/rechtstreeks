import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Scale, 
  Eye, 
  Download, 
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

interface Letter {
  id: string;
  html: string;
  markdown: string;
  pdfStorageKey: string | null;
  status: string;
  createdAt: string;
}

interface Summons {
  id: string;
  html: string;
  markdown: string;
  pdfStorageKey: string | null;
  status: string;
  createdAt: string;
}

interface GeneratedDocumentsProps {
  letters: Letter[];
  summons: Summons[];
  caseId: string;
}

export default function GeneratedDocuments({ 
  letters, 
  summons, 
  caseId 
}: GeneratedDocumentsProps) {
  const allDocuments = [
    ...letters.map(letter => ({
      ...letter,
      type: "letter" as const,
      title: "Ingebrekestelling brief",
      icon: FileText
    })),
    ...summons.map(summon => ({
      ...summon,
      type: "summons" as const,
      title: "Dagvaarding",
      icon: Scale
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary" className="bg-warning text-white">Concept</Badge>;
      case "reviewed":
        return <Badge variant="secondary" className="bg-primary text-white">Gecontroleerd</Badge>;
      case "sent":
      case "filed":
        return <Badge variant="secondary" className="bg-success text-white">Klaar</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
      case "filed":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "reviewed":
        return <Eye className="h-4 w-4 text-primary" />;
      case "draft":
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handlePreview = (document: any) => {
    if (document.pdfStorageKey) {
      window.open(`/api/files/${document.pdfStorageKey}`, '_blank');
    } else {
      // Show HTML preview in a modal or new tab
      const htmlWindow = window.open('', '_blank');
      if (htmlWindow) {
        htmlWindow.document.write(document.html);
        htmlWindow.document.close();
      }
    }
  };

  const handleDownload = (document: any) => {
    if (document.pdfStorageKey) {
      window.open(`/api/files/${document.pdfStorageKey}`, '_blank');
    }
  };

  if (allDocuments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Gegenereerde documenten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nog geen documenten gegenereerd. Start eerst de analyse van uw zaak.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Gegenereerde documenten
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => window.open(`/api/cases/${caseId}/export`, '_blank')}
            data-testid="button-export-all"
          >
            <Download className="h-4 w-4 mr-2" />
            Export zaakmap
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allDocuments.map((document) => {
            const Icon = document.icon;
            return (
              <div 
                key={`${document.type}-${document.id}`}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                data-testid={`generated-document-${document.id}`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="font-medium text-foreground">
                        {document.title}
                      </p>
                      {getStatusIcon(document.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Gegenereerd {formatDistanceToNow(new Date(document.createdAt), { 
                        addSuffix: true, 
                        locale: nl 
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(document.status)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreview(document)}
                    data-testid={`button-preview-${document.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {document.pdfStorageKey && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(document)}
                      data-testid={`button-download-${document.id}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
