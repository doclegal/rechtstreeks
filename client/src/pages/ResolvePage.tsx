import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Lock,
  Users,
  Send,
  Lightbulb,
  UserPlus,
  CheckCircle
} from "lucide-react";

// Mock berichten
const mockMessages = [
  {
    id: "1",
    sender: "AI Mediator",
    type: "ai",
    message: "Welkom bij de online mediation. Ik help beide partijen om tot een oplossing te komen. U kunt hier berichten sturen en voorstellen delen.",
    time: "10:00"
  },
  {
    id: "2",
    sender: "U (Partij A)",
    type: "user",
    message: "Ik wil graag tot een betalingsregeling komen voor het openstaande bedrag.",
    time: "10:15"
  },
  {
    id: "3",
    sender: "AI Mediator",
    type: "ai-proposal",
    message: "Op basis van de informatie stel ik voor: \n\n💰 Bedrag: €7.200 inclusief BTW\n📅 Betaling: 6 maanden, €1.200 per maand\n💡 Rente: 50% van wettelijke rente\n\nDit is een middenweg tussen beide standpunten.",
    time: "10:20"
  }
];

// Mock privé tips
const mockPrivateTips = [
  "Uw juridische positie is sterk (75%). De vordering lijkt gegrond.",
  "Een betalingsregeling van 6 maanden is realistisch en haalbaar.",
  "Overweeg om gedeeltelijk toe te geven op de rente als gebaar van goodwill.",
  "U heeft aangegeven minimaal €7.000 te willen ontvangen. Het huidige voorstel zit hier boven."
];

export default function ResolvePage() {
  const [newMessage, setNewMessage] = useState("");
  const [minAmount, setMinAmount] = useState("7000");
  const [maxMonths, setMaxMonths] = useState("6");

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      // Hier zou de message verzonden worden
      setNewMessage("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="heading-resolve">
              Oplossen met AI
            </h1>
          </div>
          <p className="text-muted-foreground">
            Onbetaalde facturen Bouwproject Zonnepanelen
          </p>
          <Badge variant="outline" className="mt-2">U bent Partij A</Badge>
        </div>
        <Button variant="outline" className="gap-2" data-testid="button-invite-party">
          <UserPlus className="h-4 w-4" />
          Nodig andere partij uit
        </Button>
      </div>

      {/* Twee-panelen layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* LINKS: Privé Sectie - Alleen voor u */}
        <Card className="border-2 border-amber-200 bg-amber-50/30" data-testid="card-private-section">
          <CardHeader className="bg-amber-100/50">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-700" />
              <CardTitle className="text-amber-900">Privé - Alleen voor u</CardTitle>
            </div>
            <p className="text-sm text-amber-800">
              Deze informatie ziet alleen u. De AI gebruikt dit om u persoonlijk advies te geven.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            
            {/* AI Tips voor u */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-amber-900">Persoonlijke tips van AI</h3>
              </div>
              
              {mockPrivateTips.map((tip, index) => (
                <div key={index} className="p-3 bg-white border border-amber-200 rounded-lg">
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{tip}</p>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Uw grenzen */}
            <div className="space-y-3">
              <h3 className="font-semibold text-amber-900">Uw grenzen</h3>
              <p className="text-sm text-muted-foreground">
                Geef aan wat voor u belangrijk is. De AI gebruikt dit om voorstellen te maken.
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium">Minimaal bedrag dat u wilt ontvangen</label>
                <div className="flex gap-2">
                  <span className="text-sm text-muted-foreground">€</span>
                  <Input 
                    type="number" 
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="flex-1"
                    data-testid="input-min-amount"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Maximaal aantal maanden betalingsregeling</label>
                <Input 
                  type="number" 
                  value={maxMonths}
                  onChange={(e) => setMaxMonths(e.target.value)}
                  data-testid="input-max-months"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Wat is voor u het belangrijkst?</label>
                <Textarea 
                  placeholder="Bijvoorbeeld: Snel betaald worden, de relatie behouden, zekerheid..."
                  className="min-h-[80px]"
                  defaultValue="Ik wil graag binnen 6 maanden volledig betaald zijn. De klantrelatie vind ik ook belangrijk voor toekomstige projecten."
                  data-testid="textarea-priorities"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Waar kunt u in meegaan?</label>
                <Textarea 
                  placeholder="Bijvoorbeeld: Ik kan een betalingsregeling accepteren, of een kleine korting geven..."
                  className="min-h-[80px]"
                  defaultValue="Ik kan akkoord gaan met een betalingsregeling en evt. een kleine korting op de rente."
                  data-testid="textarea-flexibility"
                />
              </div>
            </div>

          </CardContent>
        </Card>

        {/* RECHTS: Gedeelde Sectie - Voor alle partijen */}
        <Card className="border-2 border-blue-200" data-testid="card-shared-section">
          <CardHeader className="bg-blue-50">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-700" />
              <CardTitle className="text-blue-900">Gedeeld - Iedereen ziet dit</CardTitle>
            </div>
            <p className="text-sm text-blue-800">
              Berichten, voorstellen en AI-advies. Dit zien u, de andere partij en de mediator.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            
            {/* Chat berichten */}
            <ScrollArea className="h-[500px] p-6">
              <div className="space-y-4">
                {mockMessages.map((msg) => (
                  <div key={msg.id} className="space-y-2">
                    {msg.type === "ai" && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          AI
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-semibold text-sm">AI Mediator</span>
                            <span className="text-xs text-muted-foreground">{msg.time}</span>
                          </div>
                          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {msg.type === "ai-proposal" && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          AI
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-semibold text-sm">AI Mediator</span>
                            <Badge variant="secondary" className="text-xs">Voorstel</Badge>
                            <span className="text-xs text-muted-foreground">{msg.time}</span>
                          </div>
                          <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg">
                            <p className="text-sm whitespace-pre-line">{msg.message}</p>
                            <div className="flex gap-2 mt-4">
                              <Button size="sm" className="flex-1" data-testid="button-accept-proposal">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Akkoord
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1" data-testid="button-counter-proposal">
                                Tegenvoorstel
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {msg.type === "user" && (
                      <div className="flex gap-3 justify-end">
                        <div className="flex-1 flex flex-col items-end">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">{msg.time}</span>
                            <span className="font-semibold text-sm">{msg.sender}</span>
                          </div>
                          <div className="p-3 bg-primary text-primary-foreground rounded-lg max-w-[80%]">
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                          U
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input voor nieuw bericht */}
            <div className="p-4 border-t bg-white">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Typ uw bericht of voorstel..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    data-testid="input-message"
                  />
                  <Button 
                    onClick={handleSendMessage}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    data-testid="button-ask-ai-proposal"
                  >
                    <Lightbulb className="mr-2 h-4 w-4" />
                    Vraag AI om voorstel
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    data-testid="button-make-proposal"
                  >
                    Doe een voorstel
                  </Button>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

      </div>

      {/* Status onderaan */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm font-medium">Status: In onderhandeling</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Partij B is uitgenodigd maar nog niet ingelogd
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
