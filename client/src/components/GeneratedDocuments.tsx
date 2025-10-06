import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  Scale, 
  Eye, 
  Download, 
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Trash2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { useState } from "react";

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
  onGenerateLetter?: (briefType: string, tone: string) => void;
  onDeleteLetter?: (letterId: string) => void;
  isGenerating?: boolean;
}

export default function GeneratedDocuments({ 
  letters, 
  summons, 
  caseId,
  onGenerateLetter,
  onDeleteLetter,
  isGenerating = false
}: GeneratedDocumentsProps) {
  const [briefType, setBriefType] = useState<string>("LAATSTE_AANMANING");
  const [tone, setTone] = useState<string>("zakelijk-vriendelijk");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  
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

  // Auto-select first document if none selected
  if (!selectedDocumentId && allDocuments.length > 0) {
    setSelectedDocumentId(allDocuments[0].id);
  }

  const selectedDocument = allDocuments.find(doc => doc.id === selectedDocumentId);

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
          <div className="space-y-6">
            <div className="text-center py-4">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-6">
                Nog geen documenten gegenereerd. Configureer onderstaande opties en genereer een brief.
              </p>
            </div>

            {/* Brief Configuration Form */}
            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="brief-type">Brief type</Label>
                <Select value={briefType} onValueChange={setBriefType}>
                  <SelectTrigger id="brief-type" data-testid="select-brief-type">
                    <SelectValue placeholder="Selecteer brief type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LAATSTE_AANMANING">Laatste aanmaning</SelectItem>
                    <SelectItem value="INGEBREKESTELLING">Ingebrekestelling</SelectItem>
                    <SelectItem value="INFORMATIEVERZOEK">Informatieverzoek</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tone">Toon</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger id="tone" data-testid="select-tone">
                    <SelectValue placeholder="Selecteer toon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zakelijk-vriendelijk">Zakelijk-vriendelijk</SelectItem>
                    <SelectItem value="formeel">Formeel</SelectItem>
                    <SelectItem value="streng">Streng</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={() => onGenerateLetter?.(briefType, tone)}
                disabled={isGenerating || !onGenerateLetter}
                className="w-full"
                data-testid="button-generate-letter"
              >
                <Send className="h-4 w-4 mr-2" />
                {isGenerating ? "Brief wordt gegenereerd..." : "Genereer brief"}
              </Button>
            </div>
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
        {/* Brief Configuration Form */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="text-sm font-medium mb-4">Nieuwe brief genereren</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brief-type-existing">Brief type</Label>
              <Select value={briefType} onValueChange={setBriefType}>
                <SelectTrigger id="brief-type-existing" data-testid="select-brief-type-existing">
                  <SelectValue placeholder="Selecteer brief type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LAATSTE_AANMANING">Laatste aanmaning</SelectItem>
                  <SelectItem value="INGEBREKESTELLING">Ingebrekestelling</SelectItem>
                  <SelectItem value="INFORMATIEVERZOEK">Informatieverzoek</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone-existing">Toon</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger id="tone-existing" data-testid="select-tone-existing">
                  <SelectValue placeholder="Selecteer toon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zakelijk-vriendelijk">Zakelijk-vriendelijk</SelectItem>
                  <SelectItem value="formeel">Formeel</SelectItem>
                  <SelectItem value="streng">Streng</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={() => onGenerateLetter?.(briefType, tone)}
                disabled={isGenerating || !onGenerateLetter}
                className="w-full"
                data-testid="button-generate-letter-existing"
              >
                <Send className="h-4 w-4 mr-2" />
                {isGenerating ? "Genereren..." : "Genereer brief"}
              </Button>
            </div>
          </div>
        </div>

        {/* Letter Preview - Show HTML content of selected document */}
        {selectedDocument && (
          <div className="mb-6">
            <div 
              className="bg-card border border-border rounded-lg p-8 shadow-sm"
              style={{
                minHeight: '400px',
                maxHeight: '600px',
                overflowY: 'auto'
              }}
              data-testid="letter-preview"
            >
              <div dangerouslySetInnerHTML={{ __html: selectedDocument.html }} />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {allDocuments.map((document) => {
            const Icon = document.icon;
            const isSelected = selectedDocumentId === document.id;
            return (
              <div 
                key={`${document.type}-${document.id}`}
                className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => setSelectedDocumentId(document.id)}
                data-testid={`generated-document-${document.id}`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-primary/20' : 'bg-primary/10'
                  }`}>
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-primary'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className={`font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
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
                <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
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
                  {document.type === "letter" && onDeleteLetter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteLetter(document.id)}
                      data-testid={`button-delete-${document.id}`}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
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
