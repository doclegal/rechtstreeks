import { useState } from "react";
import { Inbox as InboxIcon, Mail, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Message {
  id: string;
  from: string;
  to: string;
  subject: string;
  preview: string;
  date: string;
  read: boolean;
  content: string;
}

const welcomeMessageContent = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%); padding: 32px; border-radius: 12px 12px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Welkom bij Rechtstreeks.ai</h1>
    <p style="color: #a0a0b0; margin: 8px 0 0 0; font-size: 14px;">Uw persoonlijke juridische assistent</p>
  </div>
  
  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e5e5; border-top: none;">
    <p style="font-size: 15px; line-height: 1.7; color: #333;">
      Beste gebruiker,
    </p>
    
    <p style="font-size: 15px; line-height: 1.7; color: #333;">
      Welkom bij Rechtstreeks.ai! Wij zijn blij dat u ons platform heeft gevonden. 
      Rechtstreeks.ai is ontwikkeld om u te helpen bij het afhandelen van juridische zaken, 
      zonder dat u direct een dure advocaat hoeft in te schakelen.
    </p>
    
    <p style="font-size: 15px; line-height: 1.7; color: #333;">
      Ons platform begeleidt u stap voor stap door het juridische proces. Hieronder leggen wij uit hoe het werkt:
    </p>
    
    <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <h2 style="color: #1a1a2e; font-size: 16px; margin: 0 0 16px 0; font-weight: 600;">Zo werkt het platform:</h2>
      
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="background: #1a1a2e; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">1</span>
          <div>
            <strong style="color: #1a1a2e;">Zaak aanmaken</strong>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #666;">Start met het aanmaken van uw zaak. Beschrijf wat er is gebeurd en wat u wilt bereiken. Hoe meer details u geeft, hoe beter wij u kunnen helpen.</p>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="background: #1a1a2e; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">2</span>
          <div>
            <strong style="color: #1a1a2e;">Dossier uploaden</strong>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #666;">Upload alle documenten die relevant zijn voor uw zaak: contracten, e-mails, facturen, foto's of andere bewijsstukken. Deze documenten helpen bij de analyse van uw zaak.</p>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="background: #1a1a2e; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">3</span>
          <div>
            <strong style="color: #1a1a2e;">Analyse uitvoeren</strong>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #666;">Onze AI analyseert uw zaak en beoordeelt de kans op succes. U krijgt inzicht in de sterke en zwakke punten van uw zaak.</p>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="background: #1a1a2e; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">4</span>
          <div>
            <strong style="color: #1a1a2e;">Advies ontvangen</strong>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #666;">Op basis van de analyse ontvangt u een juridisch advies met concrete vervolgstappen. Dit advies helpt u om de juiste beslissingen te nemen.</p>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="background: #1a1a2e; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">5</span>
          <div>
            <strong style="color: #1a1a2e;">Jurisprudentie zoeken</strong>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #666;">Zoek naar relevante rechtspraak die uw zaak ondersteunt. Eerdere uitspraken van rechters kunnen uw positie versterken.</p>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="background: #1a1a2e; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">6</span>
          <div>
            <strong style="color: #1a1a2e;">Brief versturen</strong>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #666;">Stuur een professionele juridische brief naar de wederpartij. Vaak leidt een goede brief al tot een oplossing zonder verdere stappen.</p>
          </div>
        </div>
      </div>
      
      <div>
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="background: #1a1a2e; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">7</span>
          <div>
            <strong style="color: #1a1a2e;">Procedure starten</strong>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #666;">Indien alle andere opties niet werken, kunt u een gerechtelijke procedure starten. Het platform helpt u bij het opstellen en uitbrengen van een dagvaarding.</p>
          </div>
        </div>
      </div>
    </div>
    
    <p style="font-size: 15px; line-height: 1.7; color: #333;">
      Heeft u vragen of hulp nodig? Gebruik dan de Chat functie in het menu "Hulp & Ondersteuning". 
      Wij staan voor u klaar om u te begeleiden bij elke stap.
    </p>
    
    <p style="font-size: 15px; line-height: 1.7; color: #333;">
      Veel succes met uw zaak!
    </p>
    
    <p style="font-size: 15px; line-height: 1.7; color: #333; margin-bottom: 0;">
      Met vriendelijke groet,<br/>
      <strong>Team Rechtstreeks.ai</strong>
    </p>
  </div>
  
  <div style="background: #f8f9fa; padding: 16px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e5e5; border-top: none;">
    <p style="font-size: 12px; color: #888; margin: 0; text-align: center;">
      Dit is een automatisch bericht van Rechtstreeks.ai
    </p>
  </div>
</div>
`;

const defaultMessages: Message[] = [
  {
    id: "welcome-1",
    from: "Team Rechtstreeks.ai",
    to: "U",
    subject: "Welkom bij Rechtstreeks.ai - Zo werkt het platform",
    preview: "Welkom bij Rechtstreeks.ai! Wij zijn blij dat u ons platform heeft gevonden...",
    date: "Vandaag",
    read: false,
    content: welcomeMessageContent
  }
];

export default function Inbox() {
  const [messages] = useState<Message[]>(defaultMessages);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [readMessages, setReadMessages] = useState<Set<string>>(new Set());

  const handleOpenMessage = (message: Message) => {
    setSelectedMessage(message);
    setReadMessages(prev => new Set(prev).add(message.id));
  };

  const isRead = (messageId: string) => readMessages.has(messageId);

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
        <CardContent className="p-0">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <InboxIcon className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Geen berichten
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Uw inbox is leeg. Nieuwe berichten verschijnen hier.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {messages.map((message) => (
                <div
                  key={message.id}
                  onClick={() => handleOpenMessage(message)}
                  className={`flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                    !isRead(message.id) ? "bg-primary/5" : ""
                  }`}
                  data-testid={`message-item-${message.id}`}
                >
                  <div className={`p-2 rounded-full shrink-0 ${
                    !isRead(message.id) ? "bg-primary/10" : "bg-muted"
                  }`}>
                    <Mail className={`h-5 w-5 ${
                      !isRead(message.id) ? "text-primary" : "text-muted-foreground"
                    }`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm truncate ${
                        !isRead(message.id) ? "font-semibold text-foreground" : "font-medium text-foreground"
                      }`}>
                        {message.from}
                      </span>
                      {!isRead(message.id) && (
                        <Badge variant="default" className="text-xs px-1.5 py-0">
                          Nieuw
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm truncate ${
                      !isRead(message.id) ? "font-medium text-foreground" : "text-foreground"
                    }`}>
                      {message.subject}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {message.preview}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {message.date}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden">
          {selectedMessage && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <DialogTitle className="text-lg font-semibold pr-8">
                  {selectedMessage.subject}
                </DialogTitle>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground mt-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Van:</span>
                    <span>{selectedMessage.from}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Aan:</span>
                    <span>{selectedMessage.to}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Datum:</span>
                    <span>{selectedMessage.date}</span>
                  </div>
                </div>
              </DialogHeader>
              <Separator />
              <ScrollArea className="flex-1 max-h-[calc(85vh-180px)]">
                <div 
                  className="p-6"
                  dangerouslySetInnerHTML={{ __html: selectedMessage.content }}
                />
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
