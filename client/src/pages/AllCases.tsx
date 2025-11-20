import { useCases } from "@/hooks/useCase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { PlusCircle, FileText, Calendar, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { useCaseContext } from "@/contexts/CaseContext";
import { useAuth } from "@/hooks/useAuth";

export default function AllCases() {
  const { data: cases, isLoading } = useCases();
  const { setSelectedCaseId } = useCaseContext();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleCaseSelect = (caseId: string) => {
    setSelectedCaseId(caseId);
    setLocation('/dashboard');
  };

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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alle zaken</h1>
          <p className="text-muted-foreground">Selecteer een zaak om mee te werken</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((caseItem) => (
            <Card key={caseItem.id} className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer h-full flex flex-col" onClick={() => handleCaseSelect(caseItem.id)}>
              <CardHeader className="flex-1">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold line-clamp-2" data-testid={`text-case-title-${caseItem.id}`}>
                      {caseItem.title}
                    </CardTitle>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge 
                      variant={getStatusBadgeVariant(caseItem.status)}
                      data-testid={`badge-status-${caseItem.id}`}
                      className="w-fit"
                    >
                      {getStatusDisplayName(caseItem.status)}
                    </Badge>
                    
                    {/* Invited as counterparty badge */}
                    {(caseItem as any).counterpartyUserId === user?.id && (
                      <Badge 
                        variant="outline" 
                        className="w-fit bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                        data-testid={`badge-invited-${caseItem.id}`}
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        Uitgenodigd als wederpartij
                      </Badge>
                    )}
                    
                    {/* Success Chance Badge */}
                    {(caseItem as any).fullAnalysis?.succesKansAnalysis?.chance_of_success !== undefined && (
                      <Badge 
                        variant="outline"
                        className={`w-fit ${
                          (caseItem as any).fullAnalysis.succesKansAnalysis.chance_of_success >= 70 
                            ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 border-green-300 dark:border-green-700' 
                            : (caseItem as any).fullAnalysis.succesKansAnalysis.chance_of_success >= 40
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                            : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-red-300 dark:border-red-700'
                        }`}
                        data-testid={`badge-success-chance-${caseItem.id}`}
                      >
                        {(caseItem as any).fullAnalysis.succesKansAnalysis.chance_of_success}% kans op succes
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Wederpartij</Label>
                    <p className="text-foreground font-medium line-clamp-1">{caseItem.counterpartyName || "Niet opgegeven"}</p>
                  </div>
                  
                  {caseItem.claimAmount && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Bedrag</Label>
                      <p className="text-foreground font-medium">
                        €{parseFloat(caseItem.claimAmount).toLocaleString('nl-NL')}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center pt-2 border-t">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(caseItem.createdAt), { 
                          addSuffix: true, 
                          locale: nl 
                        })}
                      </span>
                    </div>
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
