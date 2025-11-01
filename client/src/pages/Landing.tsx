import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileSearch, CheckCircle, Mail, AlertTriangle, FileText, Scale } from "lucide-react";
import { RIcon } from "@/components/RIcon";

export default function Landing() {
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
            <Button asChild data-testid="button-login">
              <a href="/api/login">Inloggen</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
            Begrijp uw juridische zaak
            <span className="text-primary block mt-2">met hulp van AI</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload uw documenten. AI helpt u ze te begrijpen en brieven te schrijven. 
            Eenvoudig en duidelijk.
          </p>
          <Button size="lg" asChild data-testid="button-get-started">
            <a href="/api/login" className="px-8 py-4 text-lg">
              Gratis beginnen
            </a>
          </Button>
        </div>
      </section>

      {/* What You Can Do */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Wat kunt u doen met Rechtstreeks.ai?
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Simpele stappen om uw juridische documenten te begrijpen
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
                      1. Upload uw documenten
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      Sleep uw PDF-bestanden naar de app. Bijvoorbeeld: contract, e-mails, foto's.
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
                      Voor elk document krijgt u een korte samenvatting en labels.
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

            {/* Feature 3: Success Chance */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      3. Zie uw kans op succes
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      AI beoordeelt hoe sterk uw zaak is en wat u nog nodig heeft.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 flex-1 bg-green-200 dark:bg-green-900 rounded-full overflow-hidden">
                          <div className="h-full bg-green-600 dark:bg-green-500" style={{width: '75%'}}></div>
                        </div>
                        <span className="text-sm font-medium text-foreground">75%</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Goede kans op succes. U heeft sterke bewijzen.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 4: Generate Letters */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      4. Maak juridische brieven
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      AI schrijft brieven voor u. Bijvoorbeeld: aanmaning, ingebrekestelling.
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

            {/* Feature 5: Missing Info */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      5. Weet wat u nog nodig heeft
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

            {/* Feature 6: Dossier Overview */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      6. Overzicht van alles
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      Alle documenten op één plek. Duidelijk overzicht van uw zaak.
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

            {/* Feature 7: Dagvaarding maken */}
            <Card className="overflow-hidden md:col-span-2 border-2 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Scale className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      7. Maak zelf een dagvaarding
                    </h3>
                    <p className="text-muted-foreground mb-3">
                      Wij begeleiden u stap voor stap bij het maken van een dagvaarding voor de kantonrechter. 
                      U hoeft geen advocaat te betalen.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-foreground mb-2">
                            Wat wij voor u doen:
                          </div>
                          <ul className="text-sm space-y-1.5 text-foreground/80">
                            <li>✓ Stap-voor-stap uitleg</li>
                            <li>✓ AI helpt bij het schrijven</li>
                            <li>✓ Controleer uw dagvaarding</li>
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
                          💡 Bij de kantonrechter kunt u vaak zonder advocaat procederen. Wij helpen u hierbij.
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

      {/* How It Works - Simple 3 Steps */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Zo werkt het
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            In 3 eenvoudige stappen begrijpt u uw zaak beter
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                1
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">
                Maak een zaak aan
              </h3>
              <p className="text-muted-foreground">
                Geef uw zaak een naam en upload uw documenten
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                2
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">
                AI analyseert
              </h3>
              <p className="text-muted-foreground">
                AI leest alles en maakt een samenvatting voor u
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                3
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">
                Genereer documenten
              </h3>
              <p className="text-muted-foreground">
                Maak brieven en bekijk wat u nog nodig heeft
              </p>
            </div>
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
            Maak een gratis account en upload uw eerste documenten
          </p>
          <Button size="lg" asChild data-testid="button-cta-start">
            <a href="/api/login" className="px-8 py-4 text-lg">
              Start nu gratis
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <RIcon size="sm" />
              <span className="font-bold text-foreground">Rechtstreeks.ai</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Rechtstreeks.ai. Alle rechten voorbehouden.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
