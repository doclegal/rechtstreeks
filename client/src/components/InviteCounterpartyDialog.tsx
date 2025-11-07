import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InviteCounterpartyDialogProps {
  caseId: string;
  counterpartyEmail?: string;
}

export default function InviteCounterpartyDialog({ caseId, counterpartyEmail }: InviteCounterpartyDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(counterpartyEmail || '');
  const [invitationCode, setInvitationCode] = useState<string | null>(null);
  const { toast } = useToast();

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Fout bij versturen uitnodiging');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setInvitationCode(data.invitation.invitationCode);
      toast({
        title: 'Uitnodiging verstuurd!',
        description: `Een uitnodigingslink is aangemaakt voor ${email}`,
      });
    },
  });

  const copyInvitationLink = () => {
    if (!invitationCode) return;
    const link = `${window.location.origin}/invitation/${invitationCode}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link gekopieerd!',
      description: 'De uitnodigingslink is gekopieerd naar je klembord',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      inviteMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-invite-counterparty">
          <UserPlus className="h-4 w-4" />
          Nodig wederpartij uit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wederpartij uitnodigen voor mediation</DialogTitle>
          <DialogDescription>
            Nodig de andere partij uit om deel te nemen aan deze zaak via online mediation
          </DialogDescription>
        </DialogHeader>

        {!invitationCode ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres van wederpartij</Label>
              <Input
                id="email"
                type="email"
                placeholder="naam@voorbeeld.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-counterparty-email"
              />
              <p className="text-xs text-muted-foreground">
                De uitnodiging is 30 dagen geldig
              </p>
            </div>

            {inviteMutation.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {(inviteMutation.error as any).message}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="submit" disabled={inviteMutation.isPending || !email} data-testid="button-send-invitation">
                {inviteMutation.isPending ? 'Versturen...' : 'Verstuur uitnodiging'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900 dark:text-green-100">
                Uitnodiging succesvol aangemaakt!
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Uitnodigingscode</Label>
              <div className="flex gap-2">
                <Input
                  value={invitationCode}
                  readOnly
                  className="font-mono text-lg"
                  data-testid="text-invitation-code"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyInvitationLink}
                  data-testid="button-copy-link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
              <p className="text-sm font-medium">Volgende stappen:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Deel de uitnodigingscode met de wederpartij</li>
                <li>Ze kunnen deze code gebruiken op: {window.location.origin}/invitation/{invitationCode}</li>
                <li>Na acceptatie verschijnt de zaak in hun overzicht</li>
              </ul>
            </div>

            <DialogFooter>
              <Button onClick={() => setOpen(false)} data-testid="button-close">
                Sluiten
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
