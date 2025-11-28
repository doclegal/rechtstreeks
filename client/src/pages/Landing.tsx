import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileSearch, CheckCircle, Mail, AlertTriangle, FileText, Scale, ArrowRight, UserCircle, Handshake, Gavel } from "lucide-react";
import { RIcon } from "@/components/RIcon";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <RIcon size="md" />
              <span className="text-xl font-bold text-foreground">Rechtstreeks.ai</span>
            </div>
            {isAuthenticated ? (
              <Button asChild data-testid="button-go-to-app">
                <a href="/cases">Naar de app</a>
              </Button>
            ) : (
              <Button asChild data-testid="button-login">
                <a href="/api/login">Inloggen</a>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Los <span className="text-primary">zelf</span> een juridisch probleem op
            <span className="text-primary block mt-2">met hulp van AI</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Rechtstreeks betekent geen hoge advocaatkosten. Stap voor stap begeleiding naar een oplossing.
          </p>

          <div className="flex flex-col items-center gap-6">
            <Button 
              size="lg" 
              data-testid="button-get-started"
              className="px-8 py-4 text-lg"
              onClick={() => {
                if (isAuthenticated) {
                  toast({
                    title: "Toegang vereist",
                    description: "Toegang tot de app moet worden aangevraagd. Neem contact met ons op voor meer informatie.",
                    variant: "default",
                  });
                } else {
                  window.location.href = "/api/login";
                }
              }}
            >
              Starten
            </Button>
            
            <Card className="w-full max-w-2xl border-primary/20 hover:border-primary/40 transition-colors">
              <CardContent className="p-6">
                <Link href="/kantonrecht-info">
                  <div className="flex items-center justify-between gap-4 cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Scale className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                          Meer informatie over kantonzaken
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Leer hoe je zelf een procedure start en wat je kunt verwachten
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* What You Can Do */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Wat kun je doen met Rechtstreeks.ai?
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            In simpele stappen zelf je geschil oplossen
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1: Upload Documents */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      1. Upload je documenten
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      Sleep je PDF-bestanden naar de app. Bijvoorbeeld: contract, e-mails, foto's.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <FileText className="h-4 w-4" />
                        <span>Voorbeeld documenten:</span>
                      </div>
                      <ul className="text-sm space-y-1 text-foreground/80">
                        <li>• Huurcontract.pdf</li>
                        <li>• Email wederpartij.pdf</li>
                        <li>• Foto's van schade.pdf</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 2: AI Analysis */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileSearch className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      2. AI leest en legt uit
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      Voor elk document krijg je een korte samenvatting en labels.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="text-sm font-medium text-foreground mb-2">
                        Huurcontract.pdf
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Samenvatting: Contract voor huur woning vanaf 1 januari 2023...
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">huur</span>
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">contract</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 3: Dossier Overview */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      3. Overzicht van alles
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      Alle documenten op één plek. Duidelijk overzicht van je zaak.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground">📄 Contract</span>
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">Compleet</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground">📧 E-mails</span>
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">Compleet</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground">📷 Bewijsmateriaal</span>
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">Compleet</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 4: Success Chance */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      4. Zie je kans op succes
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      AI beoordeelt hoe sterk je zaak is en wat je nog nodig hebt.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 flex-1 bg-green-200 dark:bg-green-900 rounded-full overflow-hidden">
                          <div className="h-full bg-green-600 dark:bg-green-500" style={{width: '75%'}}></div>
                        </div>
                        <span className="text-sm font-medium text-foreground">75%</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Goede kans op succes. Je hebt sterke bewijzen.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 5: Jurisprudentie */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Gavel className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      5. Relevante rechtspraak
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      AI zoekt automatisch naar relevante jurisprudentie en gerechtelijke uitspraken voor jouw zaak.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="text-sm space-y-2">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-foreground/80">Vergelijkbare rechtszaken</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-foreground/80">Uitspraken van rechters</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-foreground/80">Juridische precedenten</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 6: Generate Letters */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      6. Maak juridische brieven
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      AI schrijft brieven voor jou. Bijvoorbeeld: aanmaning, ingebrekestelling.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="text-sm space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">Aanmaning</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">Ingebrekestelling</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">Sommatiebrief</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 7: Missing Info */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      7. Weet wat je nog nodig hebt
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      AI vertelt welke informatie of documenten nog ontbreken.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="text-sm space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs text-amber-700 dark:text-amber-300">!</span>
                          </div>
                          <span className="text-foreground/80">Ontbreekt: bewijs van betaling</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs text-amber-700 dark:text-amber-300">!</span>
                          </div>
                          <span className="text-foreground/80">Ontbreekt: datum eerste melding</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 8: Oplossen (Online Mediation) */}
            <Card className="overflow-hidden md:col-span-2">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Handshake className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      8. Oplossen via online mediation
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      Los je geschil online op met behulp van een mediator, zonder naar de rechter te hoeven. 
                      Sneller, goedkoper en vaak met een beter resultaat voor beide partijen.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-foreground mb-2">
                            Voordelen van mediation:
                          </div>
                          <ul className="text-sm space-y-1.5 text-foreground/80">
                            <li>✓ Sneller dan rechtszaak</li>
                            <li>✓ Lagere kosten</li>
                            <li>✓ Behoud van relatie mogelijk</li>
                            <li>✓ Zelf controle over uitkomst</li>
                          </ul>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground mb-2">
                            Hoe werkt het:
                          </div>
                          <ul className="text-sm space-y-1.5 text-foreground/80">
                            <li>• Nodig wederpartij uit</li>
                            <li>• Online gesprek met mediator</li>
                            <li>• Samen naar oplossing</li>
                            <li>• Bindende afspraken</li>
                          </ul>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          💡 80% van de mediations leidt tot een oplossing waar beide partijen tevreden mee zijn.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 9: Dagvaarding maken */}
            <Card className="overflow-hidden md:col-span-2 border-2 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Scale className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      9. Maak zelf een dagvaarding
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      Wij begeleiden je stap voor stap bij het maken van een dagvaarding voor de kantonrechter. 
                      Je hoeft geen advocaat te betalen.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-foreground mb-2">
                            Wat wij voor je doen:
                          </div>
                          <ul className="text-sm space-y-1.5 text-foreground/80">
                            <li>✓ Stap-voor-stap uitleg</li>
                            <li>✓ AI helpt bij het schrijven</li>
                            <li>✓ Controleer je dagvaarding</li>
                            <li>✓ Download klaar voor deurwaarder</li>
                          </ul>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground mb-2">
                            Voor welke zaken:
                          </div>
                          <ul className="text-sm space-y-1.5 text-foreground/80">
                            <li>• Huurgeschillen</li>
                            <li>• Kleine geldvorderingen</li>
                            <li>• Arbeidsconflicten</li>
                            <li>• Consumentenzaken</li>
                          </ul>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          💡 Bij de kantonrechter kun je vaak zonder advocaat procederen. Wij helpen je hierbij.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works - Simple 4 Steps */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Zo werkt het
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Begeleiding bij elke stap
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                1
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">
                Maak een zaak aan
              </h3>
              <p className="text-muted-foreground text-sm">
                Geef je zaak een naam en upload je documenten
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                2
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">
                AI analyseert
              </h3>
              <p className="text-muted-foreground text-sm">
                AI leest alles en maakt een samenvatting voor jou
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                3
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">
                Genereer brieven
              </h3>
              <p className="text-muted-foreground text-sm">
                Maak brieven en bekijk wat je nog nodig hebt
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                4
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">
                Oplossen
              </h3>
              <p className="text-muted-foreground text-sm">
                Probeer eerst online mediation voor een snelle oplossing
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                5
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">
                Maak een dagvaarding
              </h3>
              <p className="text-muted-foreground text-sm">
                AI begeleidt je bij het opstellen van je dagvaarding
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Expert Support Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-blue-50 dark:bg-blue-950/20">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Altijd een jurist beschikbaar
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Hoewel AI je ver kan helpen, is het soms fijn om een ervaren jurist te kunnen raadplegen. 
                Daarom kun je op elk moment tijdens je traject direct contact opnemen met een van onze juristen.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Optioneel, niet verplicht</h4>
                    <p className="text-sm text-muted-foreground">
                      Je kunt het hele proces zelf doorlopen. Een jurist is er als je hulp nodig hebt.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Direct bereikbaar</h4>
                    <p className="text-sm text-muted-foreground">
                      Via de "Vraag een jurist" knop op elke pagina kun je direct een vraag stellen.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Binnen 24 uur reactie</h4>
                    <p className="text-sm text-muted-foreground">
                      Een ervaren jurist bekijkt je vraag en neemt snel contact met je op.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Jouw zaak uitgelegd</h3>
                  <Button variant="outline" size="sm" className="gap-2">
                    <UserCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Vraag een jurist</span>
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="h-4 bg-muted rounded w-5/6"></div>
                </div>
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <ArrowRight className="h-4 w-4" />
                    <span>Klik op de knop voor directe hulp</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Online Mediation Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Eerst proberen op te lossen
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Voordat je naar de rechter gaat, probeer je geschil eerst via online mediation op te lossen. 
              Sneller, goedkoper en vaak met een beter resultaat voor beide partijen.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="border-2 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Handshake className="h-6 w-6 text-primary" />
                  <h3 className="font-semibold text-lg text-foreground">
                    Waarom eerst mediation?
                  </h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Een rechtszaak is vaak de laatste stap. Mediation biedt een kans om samen met de wederpartij 
                  tot een oplossing te komen, met hulp van een neutrale mediator.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                    <div className="text-2xl">⚡</div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Sneller resultaat</h4>
                      <p className="text-sm text-muted-foreground">
                        Mediation duurt gemiddeld 1-2 weken, een rechtszaak kan maanden tot jaren duren.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                    <div className="text-2xl">💰</div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Lagere kosten</h4>
                      <p className="text-sm text-muted-foreground">
                        Mediation kost een fractie van een rechtszaak en voorkomt proceskosten.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg">
                    <div className="text-2xl">🤝</div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Behoud van relatie</h4>
                      <p className="text-sm text-muted-foreground">
                        Samen werken aan een oplossing in plaats van tegen elkaar procederen.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <h3 className="font-semibold text-lg text-foreground">
                    Hoe werkt online mediation?
                  </h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Via ons platform kun je eenvoudig een mediation starten. De mediator helpt beide partijen 
                  naar een oplossing toe te werken.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Nodig wederpartij uit</h4>
                      <p className="text-sm text-muted-foreground">
                        Stuur een uitnodiging voor mediation naar de wederpartij via ons platform.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                      2
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Online gesprek</h4>
                      <p className="text-sm text-muted-foreground">
                        Een professionele mediator voert online gesprekken met beide partijen.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                      3
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Samen naar oplossing</h4>
                      <p className="text-sm text-muted-foreground">
                        De mediator helpt jullie een voor beide partijen acceptabele oplossing te vinden.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                      4
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Bindende afspraken</h4>
                      <p className="text-sm text-muted-foreground">
                        De gemaakte afspraken worden vastgelegd in een bindende overeenkomst.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground mb-2">
                  Succesvol in 80% van de gevallen
                </h3>
                <p className="text-muted-foreground mb-3">
                  Studies tonen aan dat in ongeveer 80% van de mediations beide partijen tot een 
                  overeenkomst komen waar ze tevreden mee zijn. Dit voorkomt een langdurige en kostbare rechtszaak.
                </p>
                <p className="text-sm text-muted-foreground italic">
                  💡 <strong>Tip:</strong> Ook als mediation niet slaagt, kun je daarna nog altijd een dagvaarding opstellen. 
                  Je hebt dan in ieder geval geprobeerd het op een goede manier op te lossen.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kantonzaken Uitleg Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Zelf procederen bij de kantonrechter
            </h2>
            <p className="text-xl text-muted-foreground">
              Bij kantonzaken kun je zonder advocaat naar de rechter. Rechtstreeks.ai helpt je hierbij.
            </p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg text-foreground mb-3 flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  Wat zijn kantonzaken?
                </h3>
                <p className="text-muted-foreground mb-4">
                  Kantonzaken zijn juridische geschillen die bij de kantonrechter worden behandeld. Dit zijn vaak 
                  geschillen tussen particulieren en bedrijven, of tussen werkgever en werknemer. Denk aan:
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Huurgeschillen (bijv. borg, onderhoud)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Arbeidsconflicten (bijv. ontslag, salaris)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Consumentenzaken (bijv. niet-geleverde goederen)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Kleine geldvorderingen (tot €25.000)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg text-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Waarom zelf procederen?
                </h3>
                <p className="text-muted-foreground mb-4">
                  Bij de kantonrechter mag je zonder advocaat procederen. Dit heeft grote voordelen:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                    <div className="text-2xl">💰</div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Bespaar duizenden euro's</h4>
                      <p className="text-sm text-muted-foreground">
                        Een advocaat kost al snel €3.000 - €10.000. Door zelf te procederen bespaar je deze kosten.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                    <div className="text-2xl">⚖️</div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Je hebt dezelfde rechten</h4>
                      <p className="text-sm text-muted-foreground">
                        De kantonrechter behandelt je zaak gelijkwaardig, ook zonder advocaat. Je mag alles zelf doen.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg">
                    <div className="text-2xl">🎯</div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Volledige controle</h4>
                      <p className="text-sm text-muted-foreground">
                        Je bepaalt zelf de strategie en bent niet afhankelijk van de planning van een advocaat.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/20">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg text-foreground mb-3 flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-primary" />
                  Hoe helpt Rechtstreeks.ai jou?
                </h3>
                <p className="text-muted-foreground mb-4">
                  Rechtstreeks.ai is een <strong>Do-It-Yourself (DIY) platform</strong> speciaal ontworpen voor kantonzaken. 
                  Wij begeleiden je door het hele proces:
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">1</div>
                      <span>Documenten analyseren</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-8">AI leest je zaak en legt uit wat belangrijk is</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">2</div>
                      <span>Juridische brieven</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-8">Genereer professionele brieven zoals aanmaningen</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">3</div>
                      <span>Dagvaarding opstellen</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-8">Stap-voor-stap begeleiding bij je dagvaarding</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">4</div>
                      <span>Jurist indien nodig</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-8">Optioneel: vraag hulp aan een ervaren jurist</p>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-border">
                  <p className="text-sm text-center text-muted-foreground">
                    💡 <strong>Het resultaat:</strong> Je bespaart kosten, behoudt controle en krijgt professionele ondersteuning waar nodig.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Klaar om te beginnen?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Maak een gratis account en upload je eerste documenten
          </p>
          <Button size="lg" asChild data-testid="button-cta-start">
            <a href="/api/login" className="px-8 py-4 text-lg">
              Start nu gratis
            </a>
          </Button>
        </div>
      </section>

      {/* Disclaimer Section */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 bg-amber-50 dark:bg-amber-950/20 border-y border-amber-200 dark:border-amber-900">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 dark:text-amber-100">
              <strong className="font-semibold">Belangrijke opmerking:</strong> Rechtstreeks is een DIY (Do-It-Yourself) hulpdienst voor juridische geschillen. 
              Het platform biedt hulpmiddelen en begeleiding, maar is geen vervanging voor professioneel juridisch advies. 
              Voor complexe zaken raden wij aan altijd een erkende jurist te raadplegen.
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <RIcon size="sm" />
                <span className="font-bold text-foreground">Rechtstreeks.ai</span>
              </div>
              <p className="text-sm text-muted-foreground">
                DIY juridische hulp voor kantonzaken. Direct zelf aan de slag met AI-ondersteuning.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-3">Informatie</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Leer meer over kantonrecht procedures
              </p>
              <Button variant="outline" size="sm" asChild data-testid="button-kantonrecht-info">
                <Link href="/kantonrecht-info">
                  <Scale className="w-4 h-4 mr-2" />
                  Meer informatie
                </Link>
              </Button>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-3">Contact</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Vragen over het platform?
              </p>
              <Button variant="outline" size="sm" asChild data-testid="button-contact">
                <a href="mailto:info@rechtstreeks.ai">
                  Contact opnemen
                </a>
              </Button>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-3">Afspraak met jurist</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Wil je persoonlijk advies?
              </p>
              <Button variant="default" size="sm" asChild data-testid="button-appointment">
                <a href="mailto:afspraak@rechtstreeks.ai">
                  Afspraak maken
                </a>
              </Button>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              © 2024 Rechtstreeks.ai. Alle rechten voorbehouden.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
