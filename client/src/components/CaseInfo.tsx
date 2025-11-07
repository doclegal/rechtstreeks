import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Clock, MessageSquare, Share, Download } from "lucide-react";
import { type Case } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

interface CaseInfoProps {
  caseData: Case & {
    progress: number;
    documents?: any[];
    analysis?: any;
  };
  onExport?: () => void;
  onEdit?: () => void;
  isFullWidth?: boolean;
}

export default function CaseInfo({ caseData, onExport, onEdit, isFullWidth = false }: CaseInfoProps) {
  const formatCurrency = (amount: string | null) => {
    if (!amount) return "Niet opgegeven";
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR'
    }).format(parseFloat(amount));
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Onbekend";
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true, 
      locale: nl 
    });
  };

  if (isFullWidth) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Mijn zaak</h2>
            <p className="text-muted-foreground">Overzicht van uw zaakgegevens</p>
          </div>
          <Button
            onClick={onEdit}
            data-testid="button-edit-case-details"
          >
            <Edit className="mr-2 h-4 w-4" />
            Bewerken
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Zaakgegevens */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Edit className="h-5 w-5 text-primary" />
                <span>Zaak gegevens</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Titel van de zaak</label>
                <p className="text-foreground font-medium" data-testid="text-case-title-full">
                  {caseData.title || "Geen titel opgegeven"}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Beschrijving</label>
                <div className="bg-muted/30 rounded-lg p-3 mt-1">
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap text-sm" data-testid="text-case-description-full">
                    {caseData.description || "Geen beschrijving opgegeven"}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Categorie</label>
                  <p className="text-foreground font-medium" data-testid="text-category-full">
                    {caseData.category || "Algemeen"}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Claim bedrag</label>
                  <p className="text-foreground font-medium" data-testid="text-claim-amount-full">
                    {formatCurrency(caseData.claimAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Wederpartij gegevens */}
          <Card>
            <CardHeader>
              <CardTitle>Wederpartij gegevens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Type wederpartij</label>
                <p className="text-foreground font-medium" data-testid="text-counterparty-type-full">
                  {caseData.counterpartyType === "company" ? "Bedrijf" : "Particulier"}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {caseData.counterpartyType === "company" ? "Bedrijfsnaam" : "Naam"}
                </label>
                <p className="text-foreground font-medium" data-testid="text-counterparty-name-full">
                  {caseData.counterpartyName || "Niet opgegeven"}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">E-mail</label>
                  <p className="text-foreground font-medium" data-testid="text-counterparty-email-full">
                    {caseData.counterpartyEmail || "Niet opgegeven"}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefoon</label>
                  <p className="text-foreground font-medium" data-testid="text-counterparty-phone-full">
                    {caseData.counterpartyPhone || "Niet opgegeven"}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Adres</label>
                <p className="text-foreground font-medium" data-testid="text-counterparty-address-full">
                  {caseData.counterpartyAddress || "Niet opgegeven"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Case Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Zaak gegevens
            </CardTitle>
            {onExport && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExport}
                data-testid="button-export-case"
              >
                <Download className="h-4 w-4 mr-2" />
                Export zaakmap
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Wederpartij</label>
              <p className="text-foreground" data-testid="text-counterparty">
                {caseData.counterpartyName || "Niet opgegeven"}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Claim bedrag</label>
              <p className="text-foreground" data-testid="text-claim-amount">
                {formatCurrency(caseData.claimAmount)}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Categorie</label>
              <p className="text-foreground" data-testid="text-category">
                {caseData.category || "Algemeen"}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" data-testid="badge-status">
                  {caseData.status?.replace(/_/g, ' ') || "Onbekend"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ({caseData.progress}% voltooid)
                </span>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Gestart</label>
              <p className="text-foreground" data-testid="text-created-date">
                {formatDate(caseData.createdAt)}
              </p>
            </div>
          </div>
          
          <Button 
            className="w-full mt-6"
            onClick={onEdit}
            data-testid="button-edit-case"
          >
            <Edit className="mr-2 h-4 w-4" />
            Gegevens bewerken
          </Button>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Snelle acties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button 
              variant="ghost" 
              className="w-full justify-between p-3 h-auto"
              data-testid="button-view-timeline"
            >
              <div className="flex items-center space-x-3">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-foreground">Tijdlijn bekijken</span>
              </div>
              <span className="text-muted-foreground">→</span>
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full justify-between p-3 h-auto"
              data-testid="button-add-notes"
            >
              <div className="flex items-center space-x-3">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-foreground">Notities toevoegen</span>
              </div>
              <span className="text-muted-foreground">→</span>
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full justify-between p-3 h-auto"
              data-testid="button-share-case"
            >
              <div className="flex items-center space-x-3">
                <Share className="h-4 w-4 text-primary" />
                <span className="text-foreground">Zaak delen</span>
              </div>
              <span className="text-muted-foreground">→</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
