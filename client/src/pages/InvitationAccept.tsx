import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Clock, User, FileText, Euro } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Separator } from '@/components/ui/separator';

export default function InvitationAccept() {
  const { code } = useParams();
  const [, navigate] = useLocation();
  const [accepted, setAccepted] = useState(false);

  // Fetch invitation info (public endpoint, no auth)
  const { data: invitationData, isLoading, error } = useQuery({
    queryKey: [`/api/invitations/${code}`],
    enabled: !!code,
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invitations/${code}/accept`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Fout bij accepteren uitnodiging');
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      setAccepted(true);
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      
      // Navigate to case after 2 seconds
      setTimeout(() => {
        navigate(`/case/${data.caseId}`);
      }, 2000);
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
            <p className="text-muted-foreground">Uitnodiging laden...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitationData) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardContent className="p-12">
            <Alert variant="destructive">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription>
                {error ? 'Deze uitnodiging kon niet worden gevonden of is verlopen.' : 'Uitnodiging niet gevonden'}
              </AlertDescription>
            </Alert>
            <Button className="mt-6 w-full" onClick={() => navigate('/cases')} data-testid="button-back-to-cases">
              Terug naar mijn zaken
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { invitation, case: caseInfo } = invitationData as any;

  if (accepted) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-600" />
            <h2 className="text-2xl font-bold mb-2 text-green-900 dark:text-green-100">Uitnodiging geaccepteerd!</h2>
            <p className="text-muted-foreground mb-4">
              Je bent nu toegevoegd aan deze zaak. Je wordt doorgestuurd naar het dossier...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine roles
  const isCounterpartyEiser = caseInfo.userRole === 'GEDAAGDE'; // If owner is GEDAAGDE, counterparty is EISER
  const yourRole = isCounterpartyEiser ? 'EISER' : 'GEDAAGDE';
  const yourRoleLabel = yourRole === 'EISER' ? 'Eiser' : 'Gedaagde';
  const theirRoleLabel = yourRole === 'EISER' ? 'Gedaagde' : 'Eiser';

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Je bent uitgenodigd voor een zaak</CardTitle>
          <CardDescription>
            Je bent uitgenodigd om deel te nemen aan mediation voor deze zaak
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Invitation Info */}
          <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Uitnodiging voor</span>
            </div>
            <p className="text-sm text-muted-foreground">{invitation.invitedEmail}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Let op: Je moet inloggen met dit e-mailadres om de uitnodiging te accepteren
            </p>
          </div>

          <Separator />

          {/* Case Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Zaak informatie</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Titel</label>
                <p className="text-base" data-testid="text-case-title">{caseInfo.title}</p>
              </div>
              
              {caseInfo.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Omschrijving van het geschil</label>
                  <p className="text-sm text-muted-foreground mt-1" data-testid="text-case-description">
                    {caseInfo.description}
                  </p>
                  <Alert className="mt-3">
                    <FileText className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Na het accepteren van deze uitnodiging wordt je gevraagd om te bevestigen dat deze omschrijving correct is.
                      Als er aanpassingen nodig zijn, kun je dat aangeven.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {caseInfo.category && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Categorie</label>
                  <p className="text-sm">{caseInfo.category}</p>
                </div>
              )}

              {caseInfo.claimAmount && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Bedrag in geschil</label>
                  <div className="flex items-center gap-2">
                    <Euro className="h-4 w-4 text-muted-foreground" />
                    <p className="text-base font-medium">€ {parseFloat(caseInfo.claimAmount).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Roles */}
          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold mb-3">Jouw rol in deze zaak</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{theirRoleLabel}</p>
                <p className="font-medium">{caseInfo.claimantName || caseInfo.counterpartyName || 'De andere partij'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{yourRoleLabel} (jij)</p>
                <p className="font-medium">{yourRole === 'EISER' ? caseInfo.claimantName : caseInfo.counterpartyName}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* What happens next */}
          <div className="space-y-3">
            <h4 className="font-semibold">Wat gebeurt er na acceptatie?</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">1.</span>
                <span>Je krijgt toegang tot de zaak in je overzicht</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">2.</span>
                <span>Je wordt gevraagd de omschrijving van het geschil te controleren en goed te keuren</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">3.</span>
                <span>Je bouwt je eigen dossier met documenten (de andere partij kan deze niet zien)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">4.</span>
                <span>Zodra beide dossiers compleet zijn, kan de mediation starten in "Oplossen"</span>
              </li>
            </ul>
          </div>

          {/* Accept Button */}
          <div className="pt-4">
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              data-testid="button-accept-invitation"
            >
              {acceptMutation.isPending ? 'Accepteren...' : 'Accepteer uitnodiging en ga naar zaak'}
            </Button>
            
            {acceptMutation.error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {(acceptMutation.error as any)?.message || 'Er is een fout opgetreden bij het accepteren van de uitnodiging'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
