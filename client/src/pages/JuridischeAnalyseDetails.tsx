import { useAuth } from "@/hooks/useAuth";
import { useFullAnalyzeCase } from "@/hooks/useCase";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { FileSearch, ArrowLeft, Download, Copy } from "lucide-react";
import { useActiveCase } from "@/contexts/CaseContext";
import { A4Layout, A4Page, SectionHeading, SectionBody } from "@/components/A4Layout";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function JuridischeAnalyseDetails() {
  const { user, isLoading: authLoading } = useAuth();
  const currentCase = useActiveCase();
  const fullAnalyzeMutation = useFullAnalyzeCase(currentCase?.id || "");
  const { toast } = useToast();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  if (!currentCase) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">Geen actieve zaak</h2>
          <p className="text-muted-foreground mb-6">
            U heeft nog geen zaak aangemaakt.
          </p>
          <Button asChild size="lg" data-testid="button-create-first-case">
            <Link href="/new-case">
              Eerste zaak starten
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Extract legal_advice_full and check for old format
  let legalAdviceFull: string | null = null;
  let hasOldAnalysis = false;
  
  try {
    // First check top-level parsedAnalysis (legacy format)
    if ((currentCase?.fullAnalysis as any)?.parsedAnalysis) {
      hasOldAnalysis = true;
    }
    
    // Then check rawText for both new and old formats
    if (currentCase?.fullAnalysis?.rawText) {
      const rawData = JSON.parse(currentCase.fullAnalysis.rawText);
      
      // Try multiple paths to find legal_advice_full (NEW FORMAT)
      if (rawData.legal_advice_full) {
        legalAdviceFull = rawData.legal_advice_full;
      } else if (rawData.result?.legal_advice_full) {
        legalAdviceFull = rawData.result.legal_advice_full;
      } else if (rawData.thread?.posts) {
        // Fallback: check in thread posts (old MindStudio format)
        for (const post of rawData.thread.posts) {
          if (post.debugLog?.newState?.variables?.legal_advice_full?.value) {
            legalAdviceFull = post.debugLog.newState.variables.legal_advice_full.value;
            break;
          }
        }
      }
      
      // Check if old format exists (for backwards compatibility message)
      if (!legalAdviceFull && (rawData.parsedAnalysis || rawData.result?.analysis_json)) {
        hasOldAnalysis = true;
      }
      
      // Also check in thread.posts for old analysis_json
      if (!legalAdviceFull && !hasOldAnalysis && rawData.thread?.posts) {
        for (const post of rawData.thread.posts) {
          if (post.debugLog?.newState?.variables?.analysis_json?.value) {
            hasOldAnalysis = true;
            break;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing legal advice:', error);
  }

  if (!legalAdviceFull) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" asChild className="mb-4" data-testid="button-back-to-analysis">
          <Link href="/analysis">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar overzicht
          </Link>
        </Button>

        <div className="text-center py-12 max-w-2xl mx-auto">
          <FileSearch className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          {hasOldAnalysis ? (
            <>
              <h3 className="text-xl font-semibold mb-2">Oude Analyse Gevonden</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Deze zaak heeft een analyse in het oude formaat. Voer opnieuw een volledige analyse uit om het nieuwe advies-formaat te krijgen met een duidelijk, samenhangend juridisch advies.
              </p>
              <Button
                onClick={() => fullAnalyzeMutation.mutate()}
                disabled={fullAnalyzeMutation.isPending}
                size="lg"
                data-testid="button-rerun-analysis"
              >
                {fullAnalyzeMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                    Analyseren...
                  </>
                ) : (
                  <>
                    <FileSearch className="mr-2 h-4 w-4" />
                    Nieuwe analyse opstellen
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold mb-2">Juridisch Advies Nog Niet Beschikbaar</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Start de volledige juridische analyse om een professioneel advies te ontvangen over uw zaak.
              </p>
              <Button
                onClick={() => fullAnalyzeMutation.mutate()}
                disabled={fullAnalyzeMutation.isPending}
                size="lg"
                data-testid="button-start-full-analysis"
              >
                {fullAnalyzeMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                    Analyseren...
                  </>
                ) : (
                  <>
                    <FileSearch className="mr-2 h-4 w-4" />
                    Start volledige analyse
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Parse the advice text to extract sections
  const parseSections = (text: string) => {
    const sections: { title: string; content: string }[] = [];
    
    // Split by numbered sections (1. Het geschil, 2. De feiten, etc.)
    const sectionRegex = /(\d+\.\s+[^\n]+)/g;
    const parts = text.split(sectionRegex);
    
    let currentSection: { title: string; content: string } | null = null;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;
      
      // Check if this is a section header (starts with number)
      if (/^\d+\.\s+/.test(part)) {
        // Save previous section if exists
        if (currentSection) {
          sections.push(currentSection);
        }
        // Start new section
        currentSection = { title: part, content: '' };
      } else {
        // This is content
        if (currentSection) {
          currentSection.content += part;
        } else {
          // This must be the summary before numbered sections
          if (part.toLowerCase().includes('samenvatting')) {
            sections.push({ title: 'Samenvatting', content: part.replace(/^samenvatting\s*/i, '').trim() });
          }
        }
      }
    }
    
    // Don't forget last section
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  };

  const sections = parseSections(legalAdviceFull);

  const handleCopy = () => {
    navigator.clipboard.writeText(legalAdviceFull || '');
    toast({
      title: "Gekopieerd",
      description: "Het juridische advies is naar het klembord gekopieerd",
    });
  };

  const handleDownload = () => {
    const blob = new Blob([legalAdviceFull || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `juridisch-advies-${currentCase.title || 'zaak'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Gedownload",
      description: "Het juridische advies is gedownload",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with actions */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild data-testid="button-back-to-analysis">
                <Link href="/analysis">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Terug
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Juridisch Advies</h1>
                <p className="text-sm text-muted-foreground">
                  {currentCase.title || 'Uw zaak'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                data-testid="button-copy-advice"
              >
                <Copy className="mr-2 h-4 w-4" />
                Kopiëren
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                data-testid="button-download-advice"
              >
                <Download className="mr-2 h-4 w-4" />
                Downloaden
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* A4 Layout Content */}
      <A4Layout>
        <A4Page pageNumber={1}>
          <SectionHeading level={1}>JURIDISCH ADVIES</SectionHeading>
          
          {/* Case info */}
          <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p><strong>Zaak:</strong> {currentCase.title || 'Onbekend'}</p>
              <p><strong>Datum:</strong> {new Date().toLocaleDateString('nl-NL', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>
          </div>

          {/* Render sections */}
          <div className="space-y-6" data-testid="advice-content">
            {sections.map((section, idx) => (
              <div key={idx} className="mb-6">
                {idx === 0 && section.title === 'Samenvatting' ? (
                  // Special styling for summary
                  <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 p-4 mb-4 rounded-r">
                    <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                      {section.title}
                      <Badge variant="secondary" className="ml-2">Kernpunten</Badge>
                    </h2>
                    <SectionBody className="text-gray-700 dark:text-gray-300">
                      {section.content}
                    </SectionBody>
                  </div>
                ) : (
                  // Regular sections
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 border-b-2 border-primary pb-2">
                      {section.title}
                    </h2>
                    <SectionBody>
                      {section.content}
                    </SectionBody>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-500">
            <p>
              Dit advies is gegenereerd door een AI-systeem op basis van de door u aangeleverde informatie.
              Hoewel zorgvuldig samengesteld, kan aan de inhoud geen rechten worden ontleend.
              Raadpleeg altijd een erkend juridisch adviseur voor definitief advies.
            </p>
          </div>
        </A4Page>
      </A4Layout>
    </div>
  );
}
