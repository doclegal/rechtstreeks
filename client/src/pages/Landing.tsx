import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, CheckCircle, Clock, FileText, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Scale className="text-primary text-2xl" />
              <span className="text-xl font-bold text-foreground">Rechtstreeks.ai</span>
            </div>
            <Button asChild data-testid="button-login">
              <a href="/api/login">Inloggen</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
            Laagdrempelige juridische hulp
            <span className="text-primary block mt-2">met AI-ondersteuning</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Een DIY-platform voor juridische procedures: wij bieden u stap-voor-stap begeleiding 
            en AI-ondersteuning, terwijl u zelf uw zaak behartigt.
          </p>
          <Button size="lg" asChild data-testid="button-get-started">
            <a href="/api/login" className="px-8 py-4 text-lg">
              Nu beginnen
            </a>
          </Button>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Ons 9-stappen proces
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: FileText, title: "Intake & Upload", desc: "U uploadt uw documenten en beschrijft uw zaak" },
              { icon: CheckCircle, title: "AI Analyse", desc: "AI helpt u uw juridische positie te begrijpen" },
              { icon: Scale, title: "Documenten genereren", desc: "U genereert brieven en dagvaardingen met onze hulp" },
              { icon: Users, title: "Deurwaarder", desc: "U schakelt een deurwaarder in via ons platform" },
              { icon: Clock, title: "Rechtbank", desc: "U dient in bij de rechtbank met onze ondersteuning" },
              { icon: CheckCircle, title: "Procedure", desc: "U beheert uw zaak met onze stap-voor-stap gids" }
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <step.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <Scale className="text-primary text-xl" />
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
