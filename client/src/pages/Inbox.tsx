import { Inbox as InboxIcon, Mail, Sparkles, FileText, Upload, Search, PenLine, Scale, Users, Gavel } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Welkom bij Rechtstreeks.ai</CardTitle>
                <CardDescription>
                  Uw persoonlijke juridische assistent
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">Nieuw</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground">
            Welkom bij Rechtstreeks.ai! Dit platform helpt u stap voor stap bij het afhandelen van uw juridische zaak. 
            Van het indienen van uw zaak tot aan een eventuele gerechtelijke procedure - wij begeleiden u door het hele proces.
          </p>
          
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-foreground">Zo werkt het platform:</h4>
            
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  1
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm">Zaak aanmaken</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start met het aanmaken van uw zaak en geef een beschrijving van uw situatie.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  2
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm">Dossier uploaden</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload alle relevante documenten en bewijsstukken voor uw zaak.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  3
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm">Analyse uitvoeren</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Laat de AI uw zaak analyseren en de kansen inschatten.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  4
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm">Advies ontvangen</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ontvang een juridisch advies met concrete vervolgstappen.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  5
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm">Jurisprudentie zoeken</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Zoek relevante rechtspraak ter ondersteuning van uw zaak.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  6
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm">Brief versturen</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Stuur een juridische brief naar de wederpartij.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  7
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm">Mediation starten</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Probeer tot een oplossing te komen via mediation.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  8
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Gavel className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm">Procedure starten</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Indien nodig: stel een dagvaarding op en start een gerechtelijke procedure.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground pt-2 border-t">
            Heeft u vragen? Gebruik de Chat functie in het Hulp & Ondersteuning menu voor persoonlijke begeleiding.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
