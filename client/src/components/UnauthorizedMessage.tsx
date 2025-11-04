import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogIn, AlertCircle } from "lucide-react";

interface UnauthorizedMessageProps {
  title?: string;
  description?: string;
}

export function UnauthorizedMessage({ 
  title = "U bent niet meer ingelogd",
  description = "Uw sessie is verlopen. Log opnieuw in om verder te gaan."
}: UnauthorizedMessageProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-unauthorized-title">{title}</CardTitle>
          <CardDescription data-testid="text-unauthorized-description">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="text-sm">
              Dit kan gebeuren als u te lang inactief bent geweest of als uw sessie is verlopen om veiligheidsredenen.
            </AlertDescription>
          </Alert>
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-login"
          >
            <LogIn className="mr-2 h-5 w-5" />
            Opnieuw inloggen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
