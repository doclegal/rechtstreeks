import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Scale, Mail, Lock, User, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, signup, isLoggingIn, isSigningUp, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Navigate after authentication is confirmed
  useEffect(() => {
    if (loginSuccess && isAuthenticated) {
      setLocation("/cases");
    }
  }, [loginSuccess, isAuthenticated, setLocation]);
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (isSignUp) {
        await signup({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
        });
        toast({
          title: "Account aangemaakt",
          description: "Je kunt nu inloggen met je gegevens.",
        });
        setIsSignUp(false);
        setFormData({ ...formData, password: "" });
      } else {
        await login({
          email: formData.email,
          password: formData.password,
        });
        toast({
          title: "Welkom terug!",
          description: "Je bent succesvol ingelogd.",
        });
        setLoginSuccess(true);
      }
    } catch (error: any) {
      const message = error?.message?.includes(":") 
        ? error.message.split(":").slice(1).join(":").trim()
        : error?.message || "Er ging iets mis";
      
      toast({
        title: isSignUp ? "Registratie mislukt" : "Inloggen mislukt",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Scale className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {isSignUp ? "Account aanmaken" : "Inloggen"}
          </CardTitle>
          <CardDescription>
            {isSignUp 
              ? "Maak een account aan om te beginnen met Rechtstreeks.ai"
              : "Log in om door te gaan naar je zaken"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Voornaam</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="firstName"
                      placeholder="Jan"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="pl-10"
                      data-testid="input-first-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Achternaam</Label>
                  <Input
                    id="lastName"
                    placeholder="Jansen"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    data-testid="input-last-name"
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="jan@voorbeeld.nl"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                  required
                  data-testid="input-email"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {isSignUp && (
                <p className="text-xs text-muted-foreground">Minimaal 6 tekens</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoggingIn || isSigningUp}
              data-testid="button-submit-auth"
            >
              {isLoggingIn || isSigningUp ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  {isSignUp ? "Account aanmaken..." : "Inloggen..."}
                </span>
              ) : (
                isSignUp ? "Account aanmaken" : "Inloggen"
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isSignUp ? "Heb je al een account?" : "Nog geen account?"}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setFormData({ email: "", password: "", firstName: "", lastName: "" });
                }}
                className="ml-1 text-primary hover:underline font-medium"
                data-testid="button-toggle-mode"
              >
                {isSignUp ? "Inloggen" : "Registreren"}
              </button>
            </p>
          </div>
          
          <div className="mt-4 text-center">
            <a 
              href="/" 
              className="text-sm text-muted-foreground hover:text-foreground"
              data-testid="link-back-home"
            >
              Terug naar homepagina
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
