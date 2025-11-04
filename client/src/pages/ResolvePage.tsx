import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Scale,
  Users,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Circle,
  ArrowRight,
  FileText,
  MessageCircle,
  Lightbulb,
  TrendingUp,
  UserPlus,
  Download,
  Send
} from "lucide-react";

// Mock data
const mockIssues = [
  {
    id: "1",
    title: "Hoofdsom vordering",
    description: "Restant openstaande facturen",
    positionA: "€8.500 inclusief BTW",
    positionB: "€6.200, betwist kwaliteit werk",
    overlap: "high",
    legalRating: "high",
    status: "partial"
  },
  {
    id: "2",
    title: "Betalingsregeling",
    description: "Termijnen en looptijd",
    positionA: "Maximaal 3 maanden",
    positionB: "Minimaal 12 maanden nodig",
    overlap: "medium",
    legalRating: "medium",
    status: "disagree"
  },
  {
    id: "3",
    title: "Wettelijke rente",
    description: "Vergoeding rente over achterstallig bedrag",
    positionA: "Volledige wettelijke rente vanaf factuurdatum",
    positionB: "Geen rente, gezien omstandigheden",
    overlap: "low",
    legalRating: "high",
    status: "disagree"
  },
  {
    id: "4",
    title: "Proceskosten",
    description: "Vergoeding juridische kosten",
    positionA: "€1.500 incassokosten",
    positionB: "Geen kosten, geen rechter ingeschakeld",
    overlap: "medium",
    legalRating: "medium",
    status: "partial"
  }
];

const mockProposal = {
  version: "v2",
  date: "4 november 2024",
  items: [
    {
      issue: "Hoofdsom vordering",
      proposal: "€7.200 incl. BTW",
      rationale: "Middenweg tussen beide standpunten, rekening houdend met erkende werkzaamheden"
    },
    {
      issue: "Betalingsregeling",
      proposal: "6 maanden, termijnen van €1.200",
      rationale: "Balans tussen liquiditeit schuldenaar en belang schuldeiser"
    },
    {
      issue: "Wettelijke rente",
      proposal: "50% van wettelijke rente vanaf 30 dagen na factuurdatum",
      rationale: "Redelijke vergoeding met begrip voor situatie"
    },
    {
      issue: "Proceskosten",
      proposal: "€500 forfaitaire vergoeding",
      rationale: "Gedeeltelijke vergoeding voor gemaakte kosten buiten rechter"
    }
  ]
};

export default function ResolvePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [privateMode, setPrivateMode] = useState<Record<string, boolean>>({
    position: false,
    interests: true,
    mustHaves: true
  });

  const getOverlapColor = (overlap: string) => {
    switch (overlap) {
      case "high": return "text-green-600 bg-green-50";
      case "medium": return "text-yellow-600 bg-yellow-50";
      case "low": return "text-red-600 bg-red-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "agree": return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "partial": return <Circle className="h-4 w-4 text-yellow-600" />;
      case "disagree": return <Circle className="h-4 w-4 text-red-600" />;
      default: return <Circle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Scale className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="heading-resolve">
              Online AI-Mediation
            </h1>
          </div>
          <p className="text-muted-foreground">
            Case: Onbetaalde facturen Bouwproject Zonnepanelen
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" data-testid="badge-role">Partij A (Eiser)</Badge>
            <Badge variant="secondary">Fase: Onderhandelen</Badge>
          </div>
        </div>
        <Button variant="outline" className="gap-2" data-testid="button-invite-party">
          <UserPlus className="h-4 w-4" />
          Partij B uitnodigen
        </Button>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8" data-testid="tabs-main">
          <TabsTrigger value="overview" data-testid="tab-overview">Overzicht</TabsTrigger>
          <TabsTrigger value="issues" data-testid="tab-issues">Issues</TabsTrigger>
          <TabsTrigger value="proposals" data-testid="tab-proposals">Voorstellen</TabsTrigger>
          <TabsTrigger value="my-input" data-testid="tab-my-input">Mijn inbreng</TabsTrigger>
          <TabsTrigger value="legal" data-testid="tab-legal">AI-beoordeling</TabsTrigger>
          <TabsTrigger value="chat" data-testid="tab-chat">Chat</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documenten</TabsTrigger>
          <TabsTrigger value="agreement" data-testid="tab-agreement">Akkoord</TabsTrigger>
        </TabsList>

        {/* Overzicht Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Case Card */}
          <Card data-testid="card-case-summary">
            <CardHeader>
              <CardTitle>Case Samenvatting</CardTitle>
              <CardDescription>Neutrale weergave van het geschil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Onderwerp</p>
                  <p className="font-medium">Onbetaalde facturen bouwproject</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bedrag in geschil</p>
                  <p className="font-medium">€8.500 - €6.200</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aantal issues</p>
                  <p className="font-medium">4 geschilpunten</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Partij A (u)</p>
                  <p className="text-sm text-muted-foreground">Zonnepanelen Installatie B.V.</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Partij B</p>
                  <p className="text-sm text-muted-foreground">Nog uit te nodigen</p>
                  <Badge variant="secondary" className="mt-1">In afwachting</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress Bar */}
          <Card data-testid="card-progress">
            <CardHeader>
              <CardTitle>Voortgang Mediation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Intake</span>
                  <span>Overlap</span>
                  <span>Beoordeling</span>
                  <span>Voorstel</span>
                  <span className="font-medium">Onderhandelen</span>
                  <span className="text-muted-foreground">Akkoord</span>
                </div>
                <Progress value={70} className="h-2" data-testid="progress-mediation" />
              </div>
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>
                  U bent nu in de onderhandelingsfase. Bekijk de AI-voorstellen en pas deze aan binnen uw aangegeven bandbreedtes.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Overlap Visual */}
          <Card data-testid="card-overlap">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Overlap & Convergentie
              </CardTitle>
              <CardDescription>Waar staan partijen ten opzichte van elkaar?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockIssues.map((issue) => (
                  <div key={issue.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(issue.status)}
                      <span className="text-sm font-medium">{issue.title}</span>
                    </div>
                    <Badge className={getOverlapColor(issue.overlap)} variant="secondary">
                      {issue.overlap === "high" ? "Dichtbij" : issue.overlap === "medium" ? "Gemiddeld" : "Ver uit elkaar"}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Algemene overlap:</strong> 60% - Er is ruimte voor overeenstemming op meerdere punten
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="default" 
              className="h-auto p-4 flex flex-col items-start gap-2"
              onClick={() => setActiveTab("issues")}
              data-testid="button-view-issues"
            >
              <FileText className="h-5 w-5" />
              <span className="font-semibold">Bekijk Issues</span>
              <span className="text-xs opacity-90">Zie alle geschilpunten in detail</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-start gap-2"
              onClick={() => setActiveTab("my-input")}
              data-testid="button-add-input"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="font-semibold">Vul Mijn Inbreng aan</span>
              <span className="text-xs">Geef privé informatie aan de mediator</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-start gap-2"
              onClick={() => setActiveTab("proposals")}
              data-testid="button-view-proposals"
            >
              <Lightbulb className="h-5 w-5" />
              <span className="font-semibold">Bekijk Voorstel</span>
              <span className="text-xs">AI-mediator voorstel v2</span>
            </Button>
          </div>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-4">
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              Dit zijn de gezamenlijke geschilpunten. Beide partijen zien dezelfde informatie.
            </AlertDescription>
          </Alert>

          {mockIssues.map((issue) => (
            <Card key={issue.id} data-testid={`card-issue-${issue.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {getStatusIcon(issue.status)}
                      {issue.title}
                    </CardTitle>
                    <CardDescription>{issue.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getOverlapColor(issue.overlap)}>
                      {issue.overlap === "high" ? "Hoge overlap" : issue.overlap === "medium" ? "Gemiddelde overlap" : "Lage overlap"}
                    </Badge>
                    <Badge variant="outline">
                      Juridisch: {issue.legalRating === "high" ? "Sterk" : "Gemiddeld"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg bg-blue-50/50">
                    <p className="text-sm font-medium text-blue-900 mb-1">Standpunt Partij A (u)</p>
                    <p className="text-sm text-blue-800">{issue.positionA}</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-purple-50/50">
                    <p className="text-sm font-medium text-purple-900 mb-1">Standpunt Partij B</p>
                    <p className="text-sm text-purple-800">{issue.positionB}</p>
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">AI-Mediator Observatie</p>
                  <p className="text-sm text-muted-foreground">
                    Er is ruimte voor een middenweg. Beide partijen hebben legitieme belangen die kunnen worden gebalanceerd.
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals" className="space-y-6">
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertDescription>
              Dit is het AI-mediator voorstel versie 2, aangepast op basis van eerdere feedback.
            </AlertDescription>
          </Alert>

          <Card data-testid="card-proposal">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>AI-Mediator Voorstel {mockProposal.version}</CardTitle>
                  <CardDescription>Laatst bijgewerkt: {mockProposal.date}</CardDescription>
                </div>
                <Badge variant="secondary">Neutraal & Onpartijdig</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {mockProposal.items.map((item, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{item.issue}</h4>
                      <p className="text-lg font-bold text-primary mt-1">{item.proposal}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs font-medium mb-1">Waarom dit voorstel?</p>
                    <p className="text-sm text-muted-foreground">{item.rationale}</p>
                  </div>
                  {index < mockProposal.items.length - 1 && <Separator />}
                </div>
              ))}

              <div className="mt-6 flex gap-3">
                <Button className="flex-1" data-testid="button-accept-proposal">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Akkoord met voorstel
                </Button>
                <Button variant="outline" className="flex-1" data-testid="button-adjust-proposal">
                  Aanpassen binnen bandbreedtes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Version Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Voorstel Historie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Circle className="h-3 w-3 fill-primary text-primary" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">v2 - Aangepast voorstel</p>
                    <p className="text-xs text-muted-foreground">4 nov 2024 - Betalingsregeling verlengd naar 6 maanden</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-lg opacity-60">
                  <Circle className="h-3 w-3" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">v1 - Initieel AI-voorstel</p>
                    <p className="text-xs text-muted-foreground">1 nov 2024 - Eerste neutrale versie</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Input Tab (Private) */}
        <TabsContent value="my-input" className="space-y-6">
          <Alert variant="default" className="border-amber-200 bg-amber-50">
            <EyeOff className="h-4 w-4" />
            <AlertDescription>
              <strong>Privé ruimte:</strong> Deze informatie is alleen zichtbaar voor u en de AI-mediator. Partij B ziet dit niet.
            </AlertDescription>
          </Alert>

          <Card data-testid="card-my-position">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Mijn Positie</CardTitle>
                  <CardDescription>Wat wil ik bereiken?</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={privateMode.position} 
                    onCheckedChange={(checked) => setPrivateMode({...privateMode, position: checked})}
                    data-testid="switch-position-privacy"
                  />
                  <Label className="text-xs">
                    {privateMode.position ? <EyeOff className="h-3 w-3 inline mr-1" /> : <Eye className="h-3 w-3 inline mr-1" />}
                    {privateMode.position ? "Privé" : "Delen"}
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Beschrijf uw standpunt en wat u wilt bereiken..." 
                className="min-h-[100px]"
                defaultValue="Ik wil mijn facturen betaald krijgen. Het werk is volgens afspraak uitgevoerd en de kwaliteit is goed. Wel begrijp ik dat de klant financiële problemen heeft."
                data-testid="textarea-position"
              />
            </CardContent>
          </Card>

          <Card data-testid="card-my-interests">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Mijn Belangen</CardTitle>
                  <CardDescription>Waarom is dit belangrijk voor mij?</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={privateMode.interests} 
                    onCheckedChange={(checked) => setPrivateMode({...privateMode, interests: checked})}
                    data-testid="switch-interests-privacy"
                  />
                  <Label className="text-xs">
                    {privateMode.interests ? <EyeOff className="h-3 w-3 inline mr-1" /> : <Eye className="h-3 w-3 inline mr-1" />}
                    {privateMode.interests ? "Privé" : "Delen"}
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Wat zijn uw onderliggende belangen?" 
                className="min-h-[100px]"
                defaultValue="Cashflow is belangrijk voor mijn bedrijf. Ik heb ook andere crediteuren. Wel wil ik de klantrelatie behouden voor de toekomst."
                data-testid="textarea-interests"
              />
            </CardContent>
          </Card>

          <Card data-testid="card-my-bandwidth">
            <CardHeader>
              <CardTitle>Mijn Bandbreedtes</CardTitle>
              <CardDescription>Waarbinnen kan ik bewegen?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Minimaal acceptabel bedrag</Label>
                <div className="flex items-center gap-4">
                  <Slider defaultValue={[7000]} max={8500} min={5000} step={100} className="flex-1" />
                  <Input className="w-24" value="€7.000" readOnly />
                </div>
              </div>
              <div className="space-y-3">
                <Label>Maximale betalingstermijn (maanden)</Label>
                <div className="flex items-center gap-4">
                  <Slider defaultValue={[6]} max={12} min={1} step={1} className="flex-1" />
                  <Input className="w-24" value="6" readOnly />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Legal Assessment Tab */}
        <TabsContent value="legal" className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Let op:</strong> Dit is een AI-juridische beoordeling ter informatie. Dit is geen bindende uitspraak en vervangt geen juridisch advies.
            </AlertDescription>
          </Alert>

          <Card data-testid="card-legal-assessment">
            <CardHeader>
              <CardTitle>AI-Juridische Beoordeling per Issue</CardTitle>
              <CardDescription>Onafhankelijke analyse van juridische posities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold">1. Hoofdsom vordering</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm font-medium mb-2">Kans Partij A</p>
                    <div className="flex items-center gap-2">
                      <Progress value={75} className="flex-1" />
                      <span className="text-sm font-bold">75%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Hoog - Sterke juridische positie</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm font-medium mb-2">Kans Partij B</p>
                    <div className="flex items-center gap-2">
                      <Progress value={40} className="flex-1" />
                      <span className="text-sm font-bold">40%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Gemiddeld - Beperkt verweer</p>
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium">Normenkader</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Art. 7:750 BW - Aanneming van werk</li>
                    <li>Art. 6:74 BW - Nakoming verbintenissen</li>
                  </ul>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm"><strong>AI-Duiding:</strong> De vordering lijkt gegrond, gezien de uitgevoerde werkzaamheden. Kwaliteitsklachten zijn niet substantieel onderbouwd.</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold">2. Wettelijke rente</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm font-medium mb-2">Kans Partij A</p>
                    <div className="flex items-center gap-2">
                      <Progress value={85} className="flex-1" />
                      <span className="text-sm font-bold">85%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Hoog - Duidelijke wettelijke grondslag</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm font-medium mb-2">Kans Partij B</p>
                    <div className="flex items-center gap-2">
                      <Progress value={25} className="flex-1" />
                      <span className="text-sm font-bold">25%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Laag - Zwak verweer</p>
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium">Normenkader</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Art. 6:119 BW - Wettelijke handelsrente</li>
                    <li>Art. 6:83 BW - Verzuim</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="space-y-4">
          <Alert>
            <MessageCircle className="h-4 w-4" />
            <AlertDescription>
              Gezamenlijke chat met AI-mediator assistent. Gebruik slash-commands voor hulp.
            </AlertDescription>
          </Alert>

          <Card className="h-[500px] flex flex-col">
            <CardHeader>
              <CardTitle>Mediation Chat</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-4 overflow-y-auto">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs">AI</div>
                  <div className="flex-1 p-3 bg-muted rounded-lg">
                    <p className="text-sm">Welkom bij de mediation chat. Ik kan u helpen met samenvattingen, voorstellen, en juridische checks. Type "/" voor beschikbare commands.</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="flex-1 max-w-[80%] p-3 bg-primary text-primary-foreground rounded-lg">
                    <p className="text-sm">Kun je uitleggen waarom het voorstel €7.200 is?</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">U</div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs">AI</div>
                  <div className="flex-1 p-3 bg-muted rounded-lg">
                    <p className="text-sm">Het bedrag van €7.200 is een middenweg tussen uw vordering (€8.500) en het aanbod van partij B (€6.200). Dit houdt rekening met erkende werkzaamheden en een redelijke concessie van beide kanten.</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input placeholder="Type een bericht... (of / voor commands)" data-testid="input-chat" />
                <Button size="icon" data-testid="button-send-chat">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Commands: /summarize, /propose, /check-legal, /compare
              </p>
            </div>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Gedeelde Documenten</h3>
              <p className="text-sm text-muted-foreground">Contracten, facturen en correspondentie</p>
            </div>
            <Button variant="outline" data-testid="button-upload-document">
              <FileText className="mr-2 h-4 w-4" />
              Document uploaden
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Offerte Zonnepanelen.pdf</p>
                    <p className="text-sm text-muted-foreground">15 sep 2024 • 245 KB</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">Contract</Badge>
                      <Badge variant="outline">Issue #1</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Factuur 2024-089.pdf</p>
                    <p className="text-sm text-muted-foreground">1 okt 2024 • 128 KB</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">Factuur</Badge>
                      <Badge variant="outline">Issue #1</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Email correspondentie.pdf</p>
                    <p className="text-sm text-muted-foreground">20 okt 2024 • 89 KB</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">E-mail</Badge>
                      <Badge variant="outline">Issue #2</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Agreement Tab */}
        <TabsContent value="agreement" className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Wanneer alle issues groen zijn, kunt u de vaststellingsovereenkomst genereren.
            </AlertDescription>
          </Alert>

          <Card data-testid="card-checklist">
            <CardHeader>
              <CardTitle>Checklist voor Akkoord</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Circle className="h-4 w-4 text-yellow-600" />
                <span className="flex-1">Hoofdsom vordering</span>
                <Badge variant="secondary">In onderhandeling</Badge>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Circle className="h-4 w-4 text-yellow-600" />
                <span className="flex-1">Betalingsregeling</span>
                <Badge variant="secondary">In onderhandeling</Badge>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Circle className="h-4 w-4 text-red-600" />
                <span className="flex-1">Wettelijke rente</span>
                <Badge variant="destructive">Nog geen overeenstemming</Badge>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Circle className="h-4 w-4 text-yellow-600" />
                <span className="flex-1">Proceskosten</span>
                <Badge variant="secondary">In onderhandeling</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vaststellingsovereenkomst</CardTitle>
              <CardDescription>Preview van de definitieve overeenkomst</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-6 border-2 border-dashed rounded-lg bg-muted/30 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Nog niet beschikbaar</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Alle issues moeten groen zijn voordat de overeenkomst gegenereerd kan worden
                </p>
              </div>
              <div className="flex gap-3">
                <Button className="flex-1" disabled data-testid="button-generate-agreement">
                  <FileText className="mr-2 h-4 w-4" />
                  Genereer Overeenkomst
                </Button>
                <Button variant="outline" className="flex-1" disabled data-testid="button-download-agreement">
                  <Download className="mr-2 h-4 w-4" />
                  Download Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
