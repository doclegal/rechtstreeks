import { Inbox as InboxIcon, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Inbox() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <InboxIcon className="h-6 w-6" />
          Inbox
        </h1>
        <p className="text-muted-foreground mt-1">
          Uw berichten en meldingen
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            Berichten
          </CardTitle>
          <CardDescription>
            Hier vindt u binnenkort al uw berichten en meldingen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <InboxIcon className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Geen berichten
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Uw inbox is leeg. Nieuwe berichten en meldingen verschijnen hier.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
