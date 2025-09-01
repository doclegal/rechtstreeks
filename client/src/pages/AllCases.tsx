import { useCases } from "@/hooks/useCase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { PlusCircle, ArrowLeft, FileText, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

export default function AllCases() {
  const { data: cases, isLoading } = useCases();

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "JUDGMENT":
        return "default";
      case "PROCEEDINGS_ONGOING":
        return "secondary";
      case "ANALYZED":
      case "LETTER_DRAFTED":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusDisplayName = (status: string) => {
    const statusMap: Record<string, string> = {
      "NEW_INTAKE": "Nieuwe intake",
      "DOCS_UPLOADED": "Documenten geüpload",
      "ANALYZED": "Geanalyseerd",
      "LETTER_DRAFTED": "Brief opgesteld",
      "BAILIFF_ORDERED": "Deurwaarder ingeschakeld",
      "SERVED": "Betekend",
      "SUMMONS_DRAFTED": "Dagvaarding opgesteld",
      "FILED": "Aangebracht bij rechtbank",
      "PROCEEDINGS_ONGOING": "Procedure lopend",
      "JUDGMENT": "Vonnis"
    };
    return statusMap[status] || status;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Zaken laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-to-main">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Terug naar hoofdzaak
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alle zaken</h1>
            <p className="text-muted-foreground">Overzicht van al uw juridische zaken</p>
          </div>
        </div>
        
        <Link href="/new-case">
          <Button data-testid="button-new-case">
            <PlusCircle className="h-4 w-4 mr-2" />
            Nieuwe zaak
          </Button>
        </Link>
      </div>

      {/* Cases List */}
      {!cases || cases.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Geen zaken gevonden</h3>
            <p className="text-muted-foreground mb-6">
              U heeft nog geen zaken aangemaakt. Start uw eerste juridische zaak.
            </p>
            <Link href="/new-case">
              <Button data-testid="button-create-first-case">
                <PlusCircle className="h-4 w-4 mr-2" />
                Eerste zaak starten
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {cases.map((caseItem) => (
            <Card key={caseItem.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2" data-testid={`text-case-title-${caseItem.id}`}>
                      {caseItem.title}
                    </CardTitle>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {formatDistanceToNow(new Date(caseItem.createdAt), { 
                            addSuffix: true, 
                            locale: nl 
                          })}
                        </span>
                      </div>
                      {caseItem.claimAmount && (
                        <span>
                          €{parseFloat(caseItem.claimAmount).toLocaleString('nl-NL')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant={getStatusBadgeVariant(caseItem.status)}
                      data-testid={`badge-status-${caseItem.id}`}
                    >
                      {getStatusDisplayName(caseItem.status)}
                    </Badge>
                    <Link href="/my-case">
                      <Button size="sm" data-testid={`button-view-case-${caseItem.id}`}>
                        Bekijken
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4" data-testid={`text-case-description-${caseItem.id}`}>
                  {caseItem.description}
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Categorie</Label>
                    <p className="text-foreground">{caseItem.category || "Algemeen"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Wederpartij</Label>
                    <p className="text-foreground">{caseItem.counterpartyName || "Niet opgegeven"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p className="text-foreground">
                      {caseItem.counterpartyType === "company" ? "Bedrijf" : "Particulier"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Voortgang</Label>
                    <p className="text-foreground">
                      Stap {getStepNumber(caseItem.status)}/9
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function getStepNumber(status: string): number {
  const stepMap: Record<string, number> = {
    "NEW_INTAKE": 1,
    "DOCS_UPLOADED": 2,
    "ANALYZED": 3,
    "LETTER_DRAFTED": 4,
    "BAILIFF_ORDERED": 5,
    "SERVED": 6,
    "SUMMONS_DRAFTED": 6,
    "FILED": 7,
    "PROCEEDINGS_ONGOING": 8,
    "JUDGMENT": 9,
  };
  return stepMap[status] || 1;
}
