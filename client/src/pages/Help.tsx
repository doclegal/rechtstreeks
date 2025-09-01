import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Upload, 
  Search, 
  Mail, 
  Gavel, 
  CheckCircle, 
  Building, 
  Play, 
  FastForward, 
  Award,
  Clock,
  AlertTriangle,
  HelpCircle
} from "lucide-react";

export default function Help() {
  const processSteps = [
    {
      id: 1,
      icon: Upload,
      title: "Indienen stukken",
      description: "Upload alle relevante documenten voor uw zaak",
      duration: "Direct",
      details: "Upload contracten, correspondentie, betalingsbewijzen en andere relevante documenten. Ondersteunde formaten: PDF, DOCX, JPG, PNG, EML (max 100MB per bestand).",
      tips: [
        "Zorg dat alle documenten goed leesbaar zijn",
        "Upload alles in één keer voor de beste analyse",
        "Voeg beschrijvingen toe bij onduidelijke documenten"
      ],
      faqs: [
        {
          q: "Welke documenten zijn verplicht?",
          a: "Minimaal het contract of de overeenkomst en bewijs van uw schade of claim. Overige documenten helpen bij een betere analyse."
        },
        {
          q: "Kan ik later nog documenten toevoegen?",
          a: "Ja, u kunt altijd aanvullende documenten uploaden tijdens het proces."
        }
      ]
    },
    {
      id: 2,
      icon: Search,
      title: "Analyse",
      description: "AI analyseert uw zaak en identificeert juridische grondslag",
      duration: "2-5 minuten",
      details: "Onze AI analyseert alle documenten, identificeert de feiten, bepaalt de juridische grondslag en geeft een risico-inschatting.",
      tips: [
        "De analyse is volledig geautomatiseerd",
        "Controleer de resultaten op juistheid",
        "Ontbrekende documenten worden automatisch geïdentificeerd"
      ],
      faqs: [
        {
          q: "Hoe betrouwbaar is de AI-analyse?",
          a: "De AI is getraind op Nederlandse jurisprudentie, maar controleer altijd de resultaten. Bij twijfel raden we professioneel juridisch advies aan."
        },
        {
          q: "Kan ik de analyse laten heruitvoeren?",
          a: "Ja, na het toevoegen van nieuwe documenten kunt u de analyse opnieuw laten draaien."
        }
      ]
    },
    {
      id: 3,
      icon: Mail,
      title: "Brief opstellen",
      description: "Automatisch gegenereerde ingebrekestelling of aanmaning",
      duration: "1-2 minuten",
      details: "Op basis van de analyse wordt automatisch een professionele brief opgesteld volgens Nederlandse juridische standaarden.",
      tips: [
        "De brief wordt automatisch aangepast aan uw specifieke zaak",
        "Controleer altijd de inhoud voordat u verstuurt",
        "De brief volgt juridische conventies en termijnen"
      ],
      faqs: [
        {
          q: "Kan ik de brief aanpassen?",
          a: "U kunt wijzigingen voorstellen. Voor grote aanpassingen adviseren we contact op te nemen."
        },
        {
          q: "Hoe wordt de brief verstuurd?",
          a: "U kunt de brief downloaden en zelf versturen, of via onze deurwaarder laten betekenen."
        }
      ]
    },
    {
      id: 4,
      icon: Gavel,
      title: "Deurwaarder inschakelen",
      description: "Professionele betekening door gecertificeerde deurwaarder",
      duration: "5-7 werkdagen",
      details: "Een gecertificeerde deurwaarder betekent uw brief formeel aan de wederpartij volgens wettelijke procedures.",
      tips: [
        "Formele betekening vergroot uw juridische positie",
        "Kosten worden doorberekend bij winst van de zaak",
        "U ontvangt bewijs van betekening"
      ],
      faqs: [
        {
          q: "Wat kost een deurwaarder?",
          a: "Kosten variëren van €275-€350. Deze kosten kunt u verhalen op de wederpartij bij een succesvolle procedure."
        },
        {
          q: "Moet ik zelf contact opnemen met de deurwaarder?",
          a: "Nee, wij regelen alle communicatie met de deurwaarder voor u."
        }
      ]
    },
    {
      id: 5,
      icon: CheckCircle,
      title: "Betekening voltooid",
      description: "Bevestiging van formele betekening aan wederpartij",
      duration: "Direct na betekening",
      details: "U ontvangt bevestiging dat de documenten formeel zijn betekend, inclusief datum en tijd van betekening.",
      tips: [
        "Bewaar het bewijs van betekening goed",
        "De termijn voor reactie begint nu te lopen",
        "Wederpartij heeft meestal 14 dagen om te reageren"
      ],
      faqs: [
        {
          q: "Wat als de wederpartij niet thuis is?",
          a: "De deurwaarder volgt wettelijke procedures en kan documenten achter laten of aan huisgenoten overhandigen."
        }
      ]
    },
    {
      id: 6,
      icon: Building,
      title: "Aanbrengen bij rechtbank",
      description: "Dagvaarding indienen bij de bevoegde rechtbank",
      duration: "1-2 werkdagen",
      details: "Als de wederpartij niet reageert, dienen we een dagvaarding in bij het juiste kantongerecht.",
      tips: [
        "We selecteren automatisch de juiste rechtbank",
        "Alle benodigde documenten worden meegestuurd",
        "U ontvangt een zaaknummer van de rechtbank"
      ],
      faqs: [
        {
          q: "Bij welke rechtbank wordt de zaak aangebracht?",
          a: "Dit hangt af van het bedrag en de woonplaats van de wederpartij. Voor bedragen tot €25.000 gaat het naar het kantongerecht."
        }
      ]
    },
    {
      id: 7,
      icon: Play,
      title: "Procedure gestart",
      description: "Officiële start van de rechtbankprocedure",
      duration: "Direct",
      details: "De rechtbank heeft uw zaak in behandeling genomen en zal een zittingsdatum plannen.",
      tips: [
        "U ontvangt bericht over de zittingsdatum",
        "Bereid u voor op mogelijke vragen van de rechter",
        "Houd alle documenten bij de hand"
      ],
      faqs: [
        {
          q: "Moet ik naar de zitting?",
          a: "Meestal wel, tenzij u zich laat vertegenwoordigen door een advocaat."
        }
      ]
    },
    {
      id: 8,
      icon: FastForward,
      title: "Vervolg procedure",
      description: "Zitting, verweer en eventuele vervolgstappen",
      duration: "2-4 maanden",
      details: "De rechtbank behandelt uw zaak. Dit kan meerdere zittingen omvatten afhankelijk van de complexiteit.",
      tips: [
        "Wees voorbereid op mogelijke tegenargumenten",
        "Houd communicatie zakelijk en feitelijk",
        "Volg alle rechtbank instructies nauwkeurig op"
      ],
      faqs: [
        {
          q: "Kan de wederpartij nog reageren?",
          a: "Ja, zij kunnen verweer voeren tot 2 weken voor de zitting."
        }
      ]
    },
    {
      id: 9,
      icon: Award,
      title: "Vonnis",
      description: "Einduitspraak van de rechtbank",
      duration: "2-6 weken na zitting",
      details: "De rechtbank doet uitspraak en bepaalt of uw vordering wordt toegewezen.",
      tips: [
        "Het vonnis is bindend voor beide partijen",
        "Bij toewijzing kunt u uitvoering van het vonnis vragen",
        "Er is meestal een termijn voor hoger beroep"
      ],
      faqs: [
        {
          q: "Wat als ik het vonnis niet eens ben?",
          a: "U kunt binnen 4 weken hoger beroep instellen bij het gerechtshof."
        },
        {
          q: "Hoe krijg ik mijn geld als ik win?",
          a: "Met het vonnis kunt u via een deurwaarder beslag laten leggen of executeren."
        }
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Processtappen uitgelegd
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Van intake tot vonnis: een duidelijke uitleg van alle stappen in het juridische proces
        </p>
      </div>

      {/* Process Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <span>Proces overzicht</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-3 gap-4 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Upload</h3>
              <p className="text-sm text-muted-foreground">Documenten en analyse</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Oplossen</h3>
              <p className="text-sm text-muted-foreground">Brief en onderhandelen</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Building className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Procederen</h3>
              <p className="text-sm text-muted-foreground">Rechtbank en vonnis</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Steps */}
      <div className="space-y-6">
        {processSteps.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.id}>
              <CardHeader>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                      <CardTitle className="text-lg">
                        Stap {step.id}: {step.title}
                      </CardTitle>
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{step.duration}</span>
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-foreground">{step.details}</p>
                
                {step.tips.length > 0 && (
                  <div>
                    <h4 className="font-medium text-foreground mb-2 flex items-center">
                      <AlertTriangle className="h-4 w-4 text-warning mr-2" />
                      Tips
                    </h4>
                    <ul className="space-y-1">
                      {step.tips.map((tip, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {step.faqs.length > 0 && (
                  <div>
                    <h4 className="font-medium text-foreground mb-3">Veelgestelde vragen</h4>
                    <Accordion type="single" collapsible>
                      {step.faqs.map((faq, index) => (
                        <AccordionItem key={index} value={`faq-${step.id}-${index}`}>
                          <AccordionTrigger className="text-sm font-medium text-left">
                            {faq.q}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground">
                            {faq.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Hulp nodig?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Heeft u vragen over uw specifieke zaak of het proces? Neem contact met ons op.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button variant="outline" data-testid="button-contact-help">
              Contact opnemen
            </Button>
            <Button variant="outline" data-testid="button-schedule-call">
              Telefonische afspraak plannen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
