import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Scale, FileText, Calendar, Gavel, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

export default function KantonrechtInfo() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <Button variant="ghost" size="sm" asChild data-testid="button-back-home">
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Terug naar home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Scale className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">
              Kantonrechter Procedures
            </h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Alles wat je moet weten over het starten en doorlopen van een procedure bij de kantonrechter
          </p>
        </div>

        {/* Value Proposition Card */}
        <Card className="mb-6 border-primary/20">
          <CardContent className="p-8">
            <div className="space-y-6">
              <div className="text-lg sm:text-xl leading-relaxed">
                <p className="text-muted-foreground mb-2">
                  Wij zijn <strong className="text-foreground">géén</strong> advocatenkantoor.
                </p>
                <p className="text-muted-foreground mb-6">
                  Wij maken openbare juridische bronnen en slimme DIY-tools toegankelijk voor iedereen die zelf zijn recht wil halen zonder dure advocaat.
                </p>
              </div>

              <div className="border-l-4 border-primary pl-6 text-left space-y-3">
                <p className="text-foreground font-medium">
                  Geen juridisch gedoe, geen torenhoge kosten.
                </p>
                <p className="text-muted-foreground">
                  Gewoon praktische hulp, duidelijke stappen en slimme ondersteuning bij procedures bij de kantonrechter.
                </p>
              </div>

              <div className="text-lg leading-relaxed">
                <p className="text-foreground font-medium">
                  Met ons platform regel je het <strong className="text-primary">zélf</strong> en schakel je alleen hulp in als jij dat nodig vindt.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Introduction */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              Voor wie is dit?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              Deze informatie is bedoeld voor procedures waarin je een bedrag van <strong>€25.000 of minder</strong> vordert 
              van de wederpartij. Deze procedures worden gestart met een dagvaarding en dienen bij de kantonrechter.
            </p>
          </CardContent>
        </Card>

        {/* De Dagvaarding */}
        <Card className="mb-6" data-testid="section-dagvaarding">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              De Dagvaarding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Je start de procedure bij de kantonrechter met het aanbrengen van de betekende dagvaarding. 
              In de dagvaarding leg je aan de kantonrechter uit:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Waarom je een vordering hebt op de wederpartij</li>
              <li>Wat het verweer is van de wederpartij</li>
              <li>Wat je precies vordert</li>
            </ul>
            <p className="text-muted-foreground">
              Zodra de dagvaarding klaar is, stuur je deze naar de deurwaarder. De deurwaarder zorgt ervoor dat 
              de dagvaarding wordt betekend bij (wordt afgegeven aan) de wederpartij.
            </p>
            <div className="bg-primary/5 border-l-4 border-primary p-4 rounded">
              <p className="text-sm text-foreground">
                <strong>Let op:</strong> Nadat je de dagvaarding aan de rechtbank hebt toegestuurd, gaat eigenlijk alles vanzelf. 
                Je wordt telkens per brief op de hoogte gehouden door de rechtbank. Als je iets moet doen, ontvang je daarover ook een brief.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Eerste Roldatum */}
        <Card className="mb-6" data-testid="section-eerste-roldatum">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              De Eerste Roldatum
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              De eerste roldatum is de datum waarop de zaak voor het eerst dient bij de kantonrechter. Dit is de datum 
              die in de dagvaarding staat: de datum waarop de gedaagde partij zich moet melden bij de kantonrechter.
            </p>
            <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 p-4 rounded">
              <p className="text-sm text-foreground">
                <strong>Belangrijk:</strong> Je hoeft zelf niet naar de rechtbank op de eerste roldatum.
              </p>
            </div>
            
            <p className="font-semibold text-foreground mt-6">Op de eerste roldatum kunnen vier dingen gebeuren:</p>
            
            <div className="space-y-4 mt-4">
              {/* Scenario 1 */}
              <div className="border-l-2 border-green-500 pl-4">
                <h4 className="font-semibold text-foreground mb-2">1. De wederpartij meldt zich niet (80% van de gevallen)</h4>
                <p className="text-sm text-muted-foreground">
                  Als de wederpartij zich niet heeft gemeld, wordt er verstek verleend. De vorderingen worden toegewezen 
                  tenzij de kantonrechter deze onrechtmatig of ongegrond vindt (daarvan is niet snel sprake). 
                  Je ontvangt van de kantonrechter een brief met de datum waarop het vonnis zal worden gewezen.
                </p>
              </div>

              {/* Scenario 2 */}
              <div className="border-l-2 border-blue-500 pl-4">
                <h4 className="font-semibold text-foreground mb-2">2. De wederpartij vraagt om uitstel</h4>
                <p className="text-sm text-muted-foreground">
                  Dit uitstel wordt altijd verleend. De wederpartij krijgt vier weken de tijd om een conclusie van antwoord in te dienen.
                </p>
              </div>

              {/* Scenario 3 */}
              <div className="border-l-2 border-purple-500 pl-4">
                <h4 className="font-semibold text-foreground mb-2">3. De wederpartij antwoordt mondeling op de zitting</h4>
                <p className="text-sm text-muted-foreground">
                  De wederpartij kan in persoon verschijnen en mondeling reageren. De griffier zet dit op papier en 
                  maakt er een conclusie van antwoord van die aan jou per post wordt toegestuurd.
                </p>
              </div>

              {/* Scenario 4 */}
              <div className="border-l-2 border-orange-500 pl-4">
                <h4 className="font-semibold text-foreground mb-2">4. De wederpartij dient een schriftelijke reactie in</h4>
                <p className="text-sm text-muted-foreground">
                  De wederpartij (of zijn gemachtigde, bijvoorbeeld een advocaat) kan schriftelijk reageren met een 
                  conclusie van antwoord. Deze krijg je toegestuurd nadat de kantonrechter heeft gezien dat je het griffierecht hebt betaald.
                </p>
              </div>
            </div>

            <div className="bg-primary/5 p-4 rounded mt-4">
              <p className="text-sm text-muted-foreground">
                <strong>Griffierecht:</strong> Na de eerste roldatum ontvang je eerst een factuur voor het griffierecht. 
                Deze moet je binnen vier weken betalen. Pas daarna ontvang je bericht over wat er op de eerste roldatum is gebeurd.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Na Conclusie van Antwoord */}
        <Card className="mb-6" data-testid="section-na-antwoord">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Na de Conclusie van Antwoord
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Het verschilt per procedure wat er na de conclusie van antwoord gebeurt. De kantonrechter bepaalt dit en 
              je ontvangt daarover per brief bericht.
            </p>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Comparitie van Partijen (meest voorkomend)</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  In de meeste gevallen wordt er een comparitie van partijen gehouden. Dit is een zitting waarbij:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                  <li>De kantonrechter aan partijen vragen stelt</li>
                  <li>Er wordt bekeken of er een schikking kan worden getroffen</li>
                  <li>Je geen pleidooi hoeft te houden, maar wel je vordering mag toelichten</li>
                  <li>De zitting een soort vergadering is met de kantonrechter als voorzitter</li>
                </ul>
                
                <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 p-4 rounded mt-3">
                  <p className="text-sm text-foreground">
                    <strong>Tip bij schikken:</strong> Bedenk van tevoren of je wilt schikken en zo ja, welk bedrag 
                    voor jou acceptabel is. Laat je niet uit het veld slaan als de kantonrechter beide partijen aan het 
                    twijfelen brengt door zwakke punten te benadrukken.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">Schriftelijke Ronde (Conclusie van Repliek)</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Als je schriftelijk moet reageren op de conclusie van antwoord, doe je dat met een conclusie van repliek. 
                  Je krijgt daarvoor vier weken de tijd.
                </p>
                <div className="bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500 p-4 rounded">
                  <p className="text-sm text-foreground">
                    <strong>Belangrijk:</strong> Lees de conclusie van antwoord goed door en betwist de feiten die niet waar zijn 
                    gemotiveerd in de conclusie van repliek. Als je dat niet doet, zal de kantonrechter aannemen dat ze waar zijn.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Eindvonnis */}
        <Card className="mb-6" data-testid="section-eindvonnis">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-primary" />
              Het Eindvonnis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Als je een eindvonnis hebt ontvangen, staat daarin (als het goed is) dat de wederpartij aan jou een bepaald 
              bedrag moet betalen.
            </p>
            
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded space-y-3">
              <h4 className="font-semibold text-foreground">Wat kun je doen met het vonnis?</h4>
              <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                <li>Het vonnis naar de deurwaarder sturen</li>
                <li>De deurwaarder betekent het vonnis bij de wederpartij</li>
                <li>Als de wederpartij niet vrijwillig betaalt, kan de deurwaarder het vonnis executeren 
                    (bijvoorbeeld door beslag te leggen)</li>
                <li>De kosten van de deurwaarder worden, mits de wederpartij verhaal biedt, verhaald op de wederpartij</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Hoger Beroep */}
        <Card className="mb-6" data-testid="section-hoger-beroep">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              Hoger Beroep
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Beide partijen hebben <strong>drie maanden</strong> de tijd om in hoger beroep te gaan. 
              Daarvoor geldt verplichte procesvertegenwoordiging en moet dus een advocaat worden ingeschakeld.
            </p>
            
            <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 p-4 rounded">
              <p className="text-sm text-foreground">
                <strong>Let op bij verstekvonnis:</strong> Als er een verstekvonnis is gewezen (de wederpartij is niet 
                verschenen in de procedure), kan er geen hoger beroep worden ingesteld. De wederpartij moet dan eerst 
                in verzet binnen vier weken nadat deze bekend is geworden met het vonnis.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Timeline Overview */}
        <Card className="mb-6" data-testid="section-timeline">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Proces in het kort
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Dagvaarding opstellen en betekenen</h4>
                  <p className="text-sm text-muted-foreground">Via de deurwaarder</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Eerste roldatum</h4>
                  <p className="text-sm text-muted-foreground">Je hoeft niet aanwezig te zijn</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Griffierecht betalen</h4>
                  <p className="text-sm text-muted-foreground">Binnen 4 weken na eerste roldatum</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Reactie wederpartij / Comparitie</h4>
                  <p className="text-sm text-muted-foreground">Afhankelijk van wat de wederpartij doet</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  5
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Eindvonnis</h4>
                  <p className="text-sm text-muted-foreground">Ontvang je per post</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  6
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Executie (indien nodig)</h4>
                  <p className="text-sm text-muted-foreground">Via de deurwaarder als niet vrijwillig wordt betaald</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="bg-primary/5 p-8 rounded-lg text-center">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Klaar om te beginnen?
          </h3>
          <p className="text-muted-foreground mb-6">
            Rechtstreeks.ai helpt je bij elke stap van je kantonrechtprocedure
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg" data-testid="button-start-now">
              <Link href="/cases">Start nu</Link>
            </Button>
            <Button asChild variant="outline" size="lg" data-testid="button-back-home-bottom">
              <Link href="/">Terug naar home</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
