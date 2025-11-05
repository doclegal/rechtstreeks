import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, LogIn } from "lucide-react";

export default function RequireAuth() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Inloggen vereist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            Je moet ingelogd zijn om deze pagina te kunnen bekijken. 
            Log opnieuw in om verder te gaan.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full" size="lg" data-testid="button-login-required">
              <a href="/api/login" className="gap-2">
                <LogIn className="h-4 w-4" />
                Inloggen
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full" data-testid="button-home-required">
              <a href="/">
                Terug naar homepagina
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
