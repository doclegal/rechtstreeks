import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Lock,
  Users,
  Send,
  Lightbulb,
  UserPlus,
  CheckCircle,
  Scale,
  ArrowRight,
  ArrowLeft,
  Info
} from "lucide-react";
import { PageInfoDialog } from "@/components/PageInfoDialog";

// Mediatie stappen
type MediationStep = "intro" | "party-input" | "conversation" | "summary" | "solution";

// Mock data voor partij B antwoorden (voor demo)
const partyBResponse = "Ik erken dat er werk is verricht, maar de kwaliteit voldeed niet helemaal aan de verwachtingen. Daarom vind ik €6.200 een redelijk bedrag. Ik heb ook financiële problemen en heb minimaal 12 maanden nodig om te betalen.";

// Mock conversatie berichten - volledige demo met meerdere berichten van beide partijen
const mockConversation = [
  {
    id: "1",
    sender: "mediator",
    message: "Beide partijen hebben hun standpunt gegeven. Laten we nu dieper ingaan op de kernpunten. Partij A, kunt u uitleggen waarom u vindt dat het volledige bedrag betaald moet worden?"
  },
  {
    id: "2", 
    sender: "party-a",
    message: "Het werk is volledig volgens afspraak uitgevoerd. We hebben extra uren gestoken in het project om het op tijd af te krijgen."
  },
  {
    id: "3",
    sender: "mediator", 
    message: "Dank u. Partij B, u noemde kwaliteitsproblemen. Kunt u daar specifieker over zijn?"
  },
  {
    id: "4",
    sender: "party-b",
    message: "Er waren een paar panelen die niet goed aangesloten waren. Dat heb ik zelf moeten laten repareren door een andere partij."
  },
  {
    id: "5",
    sender: "mediator",
    message: "Partij A, was u hiervan op de hoogte? Heeft u de kans gehad om dit te herstellen?"
  },
  {
    id: "6",
    sender: "party-a",
    message: "Nee, daar ben ik nooit over geïnformeerd. We staan altijd open om zaken te herstellen binnen de garantieperiode."
  },
  {
    id: "7",
    sender: "mediator",
    message: "Interessant. Het lijkt erop dat er een communicatieprobleem was. Partij B, had u Partij A kunnen benaderen voor herstel?"
  },
  {
    id: "8",
    sender: "party-b",
    message: "Ja, achteraf had ik dat kunnen doen. Ik dacht dat het te laat was. Maar ik ben wel bereid om te praten over een oplossing."
  },
  {
    id: "9",
    sender: "mediator",
    message: "Goed om te horen dat beide partijen open staan voor een oplossing. Partij A, zou u bereid zijn om een gebaar te maken qua betalingstermijn?"
  },
  {
    id: "10",
    sender: "party-a",
    message: "Als het bedrag compleet betaald wordt, dan kan ik wel akkoord gaan met een langere betalingsregeling. Bijvoorbeeld 6-8 maanden."
  },
  {
    id: "11",
    sender: "mediator",
    message: "En Partij B, zou een betalingsregeling van 6-8 maanden haalbaar zijn voor u?"
  },
  {
    id: "12",
    sender: "party-b",
    message: "6 maanden zou ik kunnen doen als we het bedrag iets verlagen. Bij het volledige bedrag zou ik liever 12 maanden zien."
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
  const [currentStep, setCurrentStep] = useState<MediationStep>("intro");
  const [partyAInput, setPartyAInput] = useState("");
  const [partyAInputSubmitted, setPartyAInputSubmitted] = useState(false);
  const [partyBInputReceived, setPartyBInputReceived] = useState(false);
  const [conversationMessage, setConversationMessage] = useState("");
  const [conversationMessages, setConversationMessages] = useState<typeof mockConversation>([]);
  const [partyAReady, setPartyAReady] = useState(false);
  const [partyBReady, setPartyBReady] = useState(false);
  const [minAmount, setMinAmount] = useState("7000");
  const [maxMonths, setMaxMonths] = useState("6");

  const handleSubmitPartyAInput = () => {
    if (partyAInput.trim()) {
      setPartyAInputSubmitted(true);
      // Simuleer dat partij B ook antwoord heeft gegeven
      setTimeout(() => {
        setPartyBInputReceived(true);
      }, 500);
    }
  };

  const handleContinueToConversation = () => {
    setCurrentStep("conversation");
    // Laad de mock conversatie
    setConversationMessages(mockConversation);
  };

  const handleSendConversationMessage = () => {
    if (conversationMessage.trim()) {
      console.log("Versturen bericht:", conversationMessage);
      
      // Voeg bericht van Partij A toe
      const newMessage = {
        id: `user-${Date.now()}`,
        sender: "party-a" as const,
        message: conversationMessage
      };
      
      const updatedMessages = [...conversationMessages, newMessage];
      setConversationMessages(updatedMessages);
      setConversationMessage("");

      console.log("Bericht toegevoegd, wachten op Partij B antwoord...");
      
      // Simuleer automatisch antwoord van Partij B na 1.5 seconde
      setTimeout(() => {
        console.log("Partij B antwoordt nu");
        const partyBReply = {
          id: `party-b-${Date.now()}`,
          sender: "party-b" as const,
          message: "Dat begrijp ik. Laten we kijken of we hier samen uit kunnen komen."
        };
        setConversationMessages(prev => {
          console.log("Huidige berichten:", prev.length);
          const newMessages = [...prev, partyBReply];
          console.log("Nieuwe berichten:", newMessages.length);
          return newMessages;
        });
      }, 1500);
    }
  };

  const handlePartyAToggleReady = () => {
    const newReadyState = !partyAReady;
    setPartyAReady(newReadyState);
    
    // Simuleer dat Partij B ook klaar is wanneer Partij A klaar is
    if (newReadyState) {
      setTimeout(() => {
        setPartyBReady(true);
      }, 800);
    } else {
      setPartyBReady(false);
    }
  };

  const handleGoBack = () => {
    // Bepaal vorige stap
    const stepOrder: MediationStep[] = ["intro", "party-input", "conversation", "summary", "solution"];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
      
      // Reset states als we teruggaan
      if (stepOrder[currentIndex - 1] === "party-input") {
        setConversationMessages(mockConversation);
        setPartyAReady(false);
        setPartyBReady(false);
      }
      if (stepOrder[currentIndex - 1] === "intro") {
        setPartyAInputSubmitted(false);
        setPartyBInputReceived(false);
        setPartyAInput("");
      }
    }
  };

  const renderSharedContent = () => {
    switch (currentStep) {
      case "intro":
        return (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Scale className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">AI Mediator</h2>
                <p className="text-sm text-muted-foreground">Onpartijdig & neutraal</p>
              </div>
            </div>

            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4" />
              <AlertDescription>
                De AI Mediator is volledig onpartijdig en behartigt de belangen van beide partijen gelijk.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                <h3 className="font-semibold mb-3">Welkom bij de online mediation</h3>
                <div className="space-y-3 text-sm">
                  <p>
                    <strong>Wat ik begrijp:</strong> Er is een geschil over onbetaalde facturen voor een bouwproject. 
                    Beide partijen willen tot een oplossing komen zonder naar de rechter te gaan.
                  </p>
                  <Separator />
                  <p>
                    <strong>Mijn doel:</strong> Ik help beide partijen om samen tot een eerlijke oplossing te komen 
                    die voor iedereen acceptabel is. Ik ben volledig onpartijdig en behandel beide partijen gelijk.
                  </p>
                  <Separator />
                  <p>
                    <strong>Hoe werkt het:</strong>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Beide partijen geven hun eerste visie op het geschil</li>
                    <li>We voeren een gesprek om alles te verduidelijken</li>
                    <li>Ik maak een samenvatting en geef juridische context</li>
                    <li>Samen zoeken we naar een oplossing die voor beiden werkt</li>
                  </ol>
                </div>
              </div>

              <Button 
                className="w-full" 
                size="lg"
                onClick={() => setCurrentStep("party-input")}
                data-testid="button-start-mediation"
              >
                Start mediation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case "party-input":
        return (
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="p-6 space-y-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="mb-2"
                data-testid="button-go-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Terug
              </Button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Scale className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Stap 1: Eerste standpunten</h2>
                  <Badge variant="outline">Hoor en wederhoor</Badge>
                </div>
              </div>

              <div className="space-y-4">
                {/* Mediator vraagt aan Partij A */}
                <div className="w-full">
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                        AI
                      </div>
                      <span className="font-semibold text-sm">AI Mediator</span>
                    </div>
                    <p className="text-sm">
                      <strong>Partij A</strong>, kunt u in uw eigen woorden uitleggen wat er is gebeurd 
                      en wat volgens u een eerlijke oplossing zou zijn?
                    </p>
                  </div>
                </div>

                {/* Input veld voor Partij A */}
                {!partyAInputSubmitted && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Uw antwoord</label>
                    <Textarea 
                      placeholder="Vertel uw verhaal..."
                      className="min-h-[120px]"
                      value={partyAInput}
                      onChange={(e) => setPartyAInput(e.target.value)}
                      data-testid="textarea-party-a-input"
                    />
                    <Button 
                      className="w-full" 
                      onClick={handleSubmitPartyAInput}
                      disabled={!partyAInput.trim()}
                      data-testid="button-submit-party-a"
                    >
                      Verstuur antwoord
                      <Send className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Partij A antwoord (rechts uitgelijnd, chat-stijl) */}
                {partyAInputSubmitted && (
                  <div className="flex justify-end">
                    <div className="max-w-[75%]">
                      <div className="flex items-baseline gap-2 mb-1 justify-end">
                        <span className="text-xs text-muted-foreground">U (Partij A)</span>
                      </div>
                      <div className="p-3 bg-primary text-primary-foreground rounded-lg rounded-tr-none">
                        <p className="text-sm">{partyAInput}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mediator vraagt aan Partij B */}
                {partyAInputSubmitted && (
                  <>
                    <div className="w-full mt-6">
                      <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                            AI
                          </div>
                          <span className="font-semibold text-sm">AI Mediator</span>
                        </div>
                        <p className="text-sm">
                          Dank u Partij A. <strong>Partij B</strong>, wat is uw kant van het verhaal? 
                          Wat vindt u een eerlijke oplossing?
                        </p>
                      </div>
                    </div>

                    {!partyBInputReceived && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Wachten op antwoord van Partij B... (Voor deze demo gebruiken we een voorbeeld)
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Partij B antwoord (links uitgelijnd, chat-stijl) */}
                    {partyBInputReceived && (
                      <>
                        <div className="flex justify-start">
                          <div className="max-w-[75%]">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-xs text-muted-foreground">Partij B</span>
                            </div>
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg rounded-tl-none">
                              <p className="text-sm">{partyBResponse}</p>
                            </div>
                          </div>
                        </div>

                        <div className="w-full mt-6">
                          <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                AI
                              </div>
                              <span className="font-semibold text-sm">AI Mediator</span>
                            </div>
                            <p className="text-sm">
                              Dank u beiden voor het delen van uw standpunten. 
                              Ik zie dat beide partijen willen tot een oplossing komen. 
                              Laten we nu dieper ingaan op enkele kernpunten in een gesprek.
                            </p>
                          </div>
                        </div>

                        <Button 
                          className="w-full" 
                          size="lg"
                          onClick={handleContinueToConversation}
                          data-testid="button-continue-to-conversation"
                        >
                          Ga verder naar het gesprek
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </ScrollArea>
        );

      case "conversation":
        return (
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="p-6 space-y-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="mb-2"
                data-testid="button-go-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Terug
              </Button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Scale className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Stap 2: Het gesprek</h2>
                  <Badge variant="outline">Mediator leidt het gesprek</Badge>
                </div>
              </div>

              <div className="space-y-4">
                {conversationMessages.map((msg) => {
                  if (msg.sender === "mediator") {
                    return (
                      <div key={msg.id} className="w-full">
                        <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                              AI
                            </div>
                            <span className="font-semibold text-sm">AI Mediator</span>
                          </div>
                          <p className="text-sm">{msg.message}</p>
                        </div>
                      </div>
                    );
                  } else if (msg.sender === "party-a") {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[75%]">
                          <div className="flex items-baseline gap-2 mb-1 justify-end">
                            <span className="text-xs text-muted-foreground">U (Partij A)</span>
                          </div>
                          <div className="p-3 bg-primary text-primary-foreground rounded-lg rounded-tr-none">
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={msg.id} className="flex justify-start">
                        <div className="max-w-[75%]">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">Partij B</span>
                          </div>
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg rounded-tl-none">
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}

                {/* Input voor nieuw bericht */}
                {!partyAReady && (
                  <div className="space-y-3 pt-4 border-t">
                    <p className="text-sm font-medium">Wilt u nog iets toevoegen aan het gesprek?</p>
                    <Textarea 
                      placeholder="Typ uw bericht..."
                      className="min-h-[60px]"
                      value={conversationMessage}
                      onChange={(e) => setConversationMessage(e.target.value)}
                      data-testid="textarea-conversation-message"
                    />
                    <Button 
                      variant="outline"
                      className="w-full"
                      disabled={!conversationMessage.trim()}
                      onClick={handleSendConversationMessage}
                      data-testid="button-send-conversation-message"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Verstuur bericht
                    </Button>
                  </div>
                )}

                {/* Status van beide partijen */}
                <div className="space-y-3 pt-4 border-t">
                  <p className="text-sm font-semibold mb-3">Status gesprek</p>
                  
                  {/* Partij A status */}
                  <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">U (Partij A): Ik heb niets meer toe te voegen</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Klik om aan te geven dat u klaar bent met het gesprek
                      </p>
                    </div>
                    <Button
                      variant={partyAReady ? "default" : "outline"}
                      size="sm"
                      onClick={handlePartyAToggleReady}
                      data-testid="button-toggle-ready-party-a"
                    >
                      {partyAReady ? (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Klaar
                        </>
                      ) : (
                        "Markeer als klaar"
                      )}
                    </Button>
                  </div>

                  {/* Partij B status (alleen kijken) */}
                  <div className={`flex items-center justify-between p-4 rounded-lg ${
                    partyBReady 
                      ? "bg-green-50 border border-green-200" 
                      : "bg-gray-50 border border-gray-200"
                  }`}>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Partij B: Niets meer toe te voegen</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Status van de andere partij
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {partyBReady ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Klaar
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          Nog bezig
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ga verder naar samenvatting (alleen als beide klaar zijn) */}
                {partyAReady && partyBReady && (
                  <div className="space-y-3">
                    <div className="w-full">
                      <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                            AI
                          </div>
                          <span className="font-semibold text-sm">AI Mediator</span>
                        </div>
                        <p className="text-sm">
                          Beide partijen hebben aangegeven dat het gesprek compleet is. 
                          Uitstekend! Ik ga nu een samenvatting maken van alle besproken punten 
                          en juridische context geven.
                        </p>
                      </div>
                    </div>

                    <Button 
                      className="w-full"
                      size="lg"
                      onClick={() => setCurrentStep("summary")}
                      data-testid="button-continue-to-summary"
                    >
                      Ga naar samenvatting
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        );

      case "summary":
        return (
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="p-6 space-y-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="mb-2"
                data-testid="button-go-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Terug
              </Button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Scale className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Stap 3: Samenvatting & Juridische context</h2>
                  <Badge variant="outline">AI Analyse</Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                  <h3 className="font-semibold mb-3">Samenvatting van de standpunten</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-blue-700 mb-1">Partij A (u) wil:</p>
                      <ul className="text-sm space-y-1 ml-4 list-disc">
                        <li>Het volledige bedrag ontvangen voor het uitgevoerde werk</li>
                        <li>Bij voorkeur binnen 6 maanden betaald krijgen</li>
                        <li>De klantrelatie behouden voor de toekomst</li>
                      </ul>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-green-700 mb-1">Partij B wil:</p>
                      <ul className="text-sm space-y-1 ml-4 list-disc">
                        <li>Een lager bedrag betalen vanwege kwaliteitskwesties</li>
                        <li>Een langere betalingstermijn (12 maanden)</li>
                        <li>Rekening houden met financiële situatie</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Waar zijn partijen het WEL over eens
                  </h3>
                  <ul className="text-sm space-y-1 ml-4 list-disc">
                    <li>Er is werk verricht door Partij A</li>
                    <li>Er moet een bedrag worden betaald</li>
                    <li>Beide partijen willen een oplossing zonder rechter</li>
                    <li>Een betalingsregeling is mogelijk</li>
                  </ul>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h3 className="font-semibold mb-2">Wat is in geschil</h3>
                  <ul className="text-sm space-y-1 ml-4 list-disc">
                    <li>De hoogte van het bedrag (€8.500 vs €6.200)</li>
                    <li>De kwaliteit van het geleverde werk</li>
                    <li>De duur van de betalingsregeling (6 vs 12 maanden)</li>
                    <li>Rente en extra kosten</li>
                  </ul>
                </div>

                <Separator />

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold mb-3">Juridische context (informatief, geen oordeel)</h3>
                  <p className="text-sm mb-3">
                    <strong>Hoe zou een rechter hier waarschijnlijk naar kijken?</strong>
                  </p>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium mb-1">📋 Bewijs van werk:</p>
                      <p className="text-muted-foreground">
                        Een rechter kijkt naar offertes, facturen en bewijzen van uitgevoerd werk. 
                        Als het werk volgens afspraak is gedaan, heeft Partij A meestal recht op betaling.
                      </p>
                    </div>

                    <div>
                      <p className="font-medium mb-1">⚖️ Kwaliteitskwesties:</p>
                      <p className="text-muted-foreground">
                        Partij B moet concrete bewijzen leveren van slechte kwaliteit. 
                        Algemene klachten zonder bewijs worden vaak niet gehonoreerd.
                      </p>
                    </div>

                    <div>
                      <p className="font-medium mb-1">💰 Betalingsregeling:</p>
                      <p className="text-muted-foreground">
                        Een rechter kan een betalingsregeling opleggen, maar dit hangt af van de 
                        financiële situatie. Meestal 6-12 maanden voor particulieren.
                      </p>
                    </div>

                    <div>
                      <p className="font-medium mb-1">💡 Wettelijke rente:</p>
                      <p className="text-muted-foreground">
                        Bij te late betaling heeft Partij A recht op wettelijke handelsrente. 
                        Dit is een percentage over het openstaande bedrag.
                      </p>
                    </div>
                  </div>

                  <Alert className="mt-3">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Let op:</strong> Dit is geen juridisch advies maar een algemene schets. 
                      Een rechter oordeelt altijd op basis van alle specifieke feiten en bewijzen.
                    </AlertDescription>
                  </Alert>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => setCurrentStep("solution")}
                  data-testid="button-continue-to-solution"
                >
                  Ga naar oplossingen zoeken
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </ScrollArea>
        );

      case "solution":
        return (
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="p-6 space-y-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="mb-2"
                data-testid="button-go-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Terug
              </Button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Lightbulb className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Stap 4: Op zoek naar een oplossing</h2>
                  <Badge variant="outline">Samen tot een voorstel</Badge>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg">
                <h3 className="font-semibold mb-3">AI Mediator Voorstel</h3>
                <p className="text-sm mb-4">
                  Op basis van jullie standpunten en de juridische context stel ik het volgende voor:
                </p>

                <div className="space-y-3">
                  <div className="p-3 bg-white rounded border">
                    <p className="font-medium text-sm mb-1">💰 Bedrag</p>
                    <p className="text-lg font-bold text-primary">€7.200 inclusief BTW</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Een middenweg: Partij B erkent de waarde van het werk, Partij A doet een kleine concessie
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded border">
                    <p className="font-medium text-sm mb-1">📅 Betalingsregeling</p>
                    <p className="text-lg font-bold text-primary">8 maanden, €900 per maand</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tussenweg: Langer dan Partij A wil, korter dan Partij B vraagt
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded border">
                    <p className="font-medium text-sm mb-1">💡 Wettelijke rente</p>
                    <p className="text-lg font-bold text-primary">50% van wettelijke rente</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Compromis: Partij A krijgt gedeeltelijke vergoeding, Partij B krijgt korting
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded border">
                    <p className="font-medium text-sm mb-1">🤝 Extra afspraak</p>
                    <p className="text-sm">Bij tijdige betaling: geen extra kosten</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Stimulans voor Partij B om op tijd te betalen
                    </p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Waarom dit voorstel?</p>
                  <ul className="text-sm space-y-1 ml-4 list-disc text-muted-foreground">
                    <li>Het houdt rekening met de belangen van beide partijen</li>
                    <li>Het is juridisch haalbaar en realistisch</li>
                    <li>Het voorkomt een dure en tijdrovende rechtszaak</li>
                    <li>Beide partijen doen een concessie voor een snelle oplossing</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Wat vindt u van dit voorstel?</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    className="w-full" 
                    variant="default"
                    data-testid="button-accept-solution"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Akkoord
                  </Button>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    data-testid="button-counter-solution"
                  >
                    Tegenvoorstel
                  </Button>
                </div>

                <Textarea 
                  placeholder="Uw reactie op dit voorstel (optioneel)..."
                  className="min-h-[80px]"
                  data-testid="textarea-solution-feedback"
                />
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  data-testid="button-send-feedback"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Verstuur reactie
                </Button>
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Als beide partijen akkoord gaan, wordt automatisch een vaststellingsovereenkomst opgesteld 
                  die u beiden kunt ondertekenen.
                </AlertDescription>
              </Alert>
            </div>
          </ScrollArea>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-start gap-2 mb-2">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold" data-testid="heading-resolve">
                Oplossen met AI
              </h1>
            </div>
            <PageInfoDialog
              title="Oplossen (Mediation)"
              description="Los uw juridisch geschil op via online mediation met AI-ondersteuning, zonder naar de rechter te hoeven."
              features={[
                "Online mediatie met beide partijen en een AI-mediator",
                "Privé advies van AI speciaal voor u (niet zichtbaar voor wederpartij)",
                "Gestructureerd gesprek om tot een gezamenlijke oplossing te komen",
                "Automatische vaststellingsovereenkomst bij akkoord",
                "Sneller, goedkoper en minder stressvol dan een rechtszaak"
              ]}
              importance="Mediation is vaak de beste manier om geschillen op te lossen. Het is sneller en goedkoper dan naar de rechter, en u houdt zelf controle over de uitkomst. Bovendien blijft de relatie met de wederpartij meestal beter. Probeer dit altijd eerst voordat u een dagvaarding opstelt."
            />
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
              De AI Mediator begeleidt beide partijen stap voor stap naar een oplossing.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {renderSharedContent()}
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
