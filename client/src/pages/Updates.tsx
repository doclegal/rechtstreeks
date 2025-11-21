import { useAuth } from "@/hooks/useAuth";
import { useActiveCase } from "@/contexts/CaseContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DocumentUpload from "@/components/DocumentUpload";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Bell, CheckCircle } from "lucide-react";
import { RIcon } from "@/components/RIcon";
import { useState } from "react";

export default function Updates() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(true);
  const currentCase = useActiveCase();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation('/');
    return null;
  }

  if (!currentCase) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <Bell className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-4">Geen actieve zaak</h2>
          <p className="text-muted-foreground mb-6">
            Selecteer eerst een zaak om updates te bekijken.
          </p>
          <Button asChild data-testid="button-back-to-cases">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Terug naar dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleUploadSuccess = () => {
    setUploadSuccess(true);
    setTimeout(() => {
      setUploadSuccess(false);
    }, 5000);
  };

  return (
    <div className="space-y-6">
      <Button 
        variant="ghost" 
        size="sm" 
        asChild 
        className="mb-2"
        data-testid="button-back-to-my-case"
      >
        <Link href="/my-case">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Link>
      </Button>
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Updates</h2>
            <p className="text-muted-foreground">Upload nieuwe documenten voor uw dossier</p>
          </div>
        </div>
      </div>

      {uploadSuccess && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  Documenten succesvol geüpload
                </p>
                <p className="text-sm text-green-800 dark:text-green-200">
                  De bestanden zijn toegevoegd aan uw dossier. Ga naar het dossier om ze in te zien.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Documenten uploaden
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUpload 
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            caseId={currentCase.id}
            onSuccess={handleUploadSuccess}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-center pt-8">
        <p className="text-sm text-muted-foreground">
          Geüploade documenten verschijnen in uw <Link href="/dossier" className="text-primary hover:underline">dossier</Link>
        </p>
      </div>
    </div>
  );
}
