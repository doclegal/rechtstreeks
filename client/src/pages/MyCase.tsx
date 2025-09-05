import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useAnalysis } from "@/hooks/useAnalysis";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function MyCase() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: cases, isLoading: casesLoading, refetch } = useCases();
  const { toast } = useToast();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  
  const currentCase = Array.isArray(cases) && cases.length > 0 ? cases[0] : undefined;
  const caseId = currentCase?.id;

  const { 
    data: analysisData, 
    isLoading: analysisLoading, 
    error: analysisError, 
    refresh: refreshAnalysis,
    isRefreshing: isRefreshingAnalysis
  } = useAnalysis({ 
    caseId: caseId || "", 
    enabled: !!caseId && expandedSection === 'analyse' 
  });

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [authLoading, user, toast]);

  if (authLoading || casesLoading) {
    return <div className="flex justify-center items-center min-h-screen">Laden...</div>;
  }

  if (!currentCase) {
    return <div className="flex justify-center items-center min-h-screen">Geen zaak gevonden</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Mijn Zaak: {currentCase.title}</h1>
        <Button onClick={() => toggleSection('analyse')}>
          {expandedSection === 'analyse' ? 'Verberg Analyse' : 'Toon Analyse'}
        </Button>
      </div>

      {expandedSection === 'analyse' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Juridische Analyse</h2>
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  console.log("Analyse button clicked, caseId:", caseId);
                  refreshAnalysis();
                }}
                disabled={analysisLoading || isRefreshingAnalysis}
                size="sm"
                variant={analysisData ? "outline" : "default"}
              >
                {(analysisLoading || isRefreshingAnalysis) ? "Analyseren..." : analysisData ? "Heranalyseren" : "Start analyse"}
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {(analysisLoading || isRefreshingAnalysis) && (
            <Alert>
              <AlertDescription className="flex items-center gap-3">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <div>
                  <p className="font-medium">MindStudio AI analyseert uw zaak...</p>
                  <p className="text-sm text-gray-600">Dit kan 1-3 minuten duren</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Error State */}
          {analysisError && !analysisLoading && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p>Er is een fout opgetreden: {analysisError.message}</p>
                <Button 
                  onClick={() => refreshAnalysis()}
                  size="sm"
                  variant="outline"
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Opnieuw proberen
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* DEBUG: Show raw analysis data */}
          {analysisData && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-6">
              <h3 className="text-lg font-semibold text-green-800 mb-2">✅ RAW ANALYSE DATA:</h3>
              <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-96">
                {JSON.stringify(analysisData, null, 2)}
              </pre>
            </div>
          )}

          {/* Simple Success State */}
          {analysisData && !analysisLoading && (
            <div className="space-y-6">
              <div className="bg-white border rounded-lg p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">📋 Samenvatting Feiten</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{analysisData.factsJson?.[0]?.detail || 'Geen gegevens'}</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">⚖️ Juridische Analyse</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{analysisData.issuesJson?.[0]?.issue || 'Geen gegevens'}</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">🏛️ Juridische Grondslag</h3>
                  <div className="space-y-2">
                    {analysisData.legalBasisJson?.map((item, idx) => (
                      <p key={idx} className="text-gray-700">{item.law}</p>
                    )) || <p className="text-gray-500">Geen gegevens</p>}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">📋 Te Doen</h3>
                  <div className="space-y-2">
                    {analysisData.missingDocuments?.map((item, idx) => (
                      <p key={idx} className="text-gray-700">• {item}</p>
                    )) || <p className="text-gray-500">Geen gegevens</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No Data State */}
          {!analysisData && !analysisLoading && !isRefreshingAnalysis && (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-yellow-800">⚠️ Geen analyse data beschikbaar. Klik "Start analyse" om te beginnen.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}