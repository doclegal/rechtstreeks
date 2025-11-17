import { useAuth } from "@/hooks/useAuth";
import { useGenerateLegalAdvice } from "@/hooks/useCase";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { FileSearch, ArrowLeft, Download, Copy, RefreshCw, AlertTriangle, FileText } from "lucide-react";
import { useActiveCase } from "@/contexts/CaseContext";
import { A4Layout, A4Page, SectionHeading, SectionBody } from "@/components/A4Layout";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function JuridischeAnalyseDetails() {
  const { user, isLoading: authLoading } = useAuth();
  const currentCase = useActiveCase();
  const generateAdviceMutation = useGenerateLegalAdvice(currentCase?.id || "");
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

  // Extract legal advice from multiple possible sources
  let legalAdviceJson: any = null;
  let legalAdviceFull: string | null = null;
  
  // IMPORTANT: Extract missing_elements from RKOS.flow (Volledige analyse) - this is the authoritative source
  let missingElementsFromRKOS: any[] = [];
  
  try {
    // Check for new JSON format in legalAdviceJson field
    if (currentCase?.fullAnalysis?.legalAdviceJson) {
      legalAdviceJson = currentCase.fullAnalysis.legalAdviceJson;
    }
    
    // Check rawText for both new and old formats
    if (currentCase?.fullAnalysis?.rawText) {
      const rawData = JSON.parse(currentCase.fullAnalysis.rawText);
      
      // Try to find legal_advice_json (NEW JSON FORMAT)
      if (!legalAdviceJson && rawData.result?.legal_advice_json) {
        legalAdviceJson = rawData.result.legal_advice_json;
      } else if (!legalAdviceJson && rawData.thread?.variables?.legal_advice_json) {
        const value = rawData.thread.variables.legal_advice_json.value || rawData.thread.variables.legal_advice_json;
        legalAdviceJson = typeof value === 'string' ? JSON.parse(value) : value;
      }
      
      // Try to find legal_advice_full (LEGACY TEXT FORMAT)
      if (!legalAdviceJson && rawData.legal_advice_full) {
        legalAdviceFull = rawData.legal_advice_full;
      } else if (!legalAdviceJson && rawData.result?.legal_advice_full) {
        legalAdviceFull = rawData.result.legal_advice_full;
      } else if (!legalAdviceJson && rawData.thread?.posts) {
        // Fallback: check in thread posts (old MindStudio format)
        for (const post of rawData.thread.posts) {
          if (post.debugLog?.newState?.variables?.legal_advice_full?.value) {
            legalAdviceFull = post.debugLog.newState.variables.legal_advice_full.value;
            break;
          }
        }
      }
    }
    
    // Extract missing_elements from RKOS.flow (Volledige analyse) - AUTHORITATIVE SOURCE
    if (currentCase?.fullAnalysis?.succesKansAnalysis) {
      const succesKans = currentCase.fullAnalysis.succesKansAnalysis as any;
      if (succesKans.missing_elements && Array.isArray(succesKans.missing_elements)) {
        missingElementsFromRKOS = succesKans.missing_elements;
        console.log('📋 Using missing_elements from RKOS.flow (authoritative):', missingElementsFromRKOS.length);
      }
    }
  } catch (error) {
    console.error('Error parsing legal advice:', error);
  }

  // Check if we have ANY advice (new or old format)
  const hasAdvice = legalAdviceJson || legalAdviceFull;
  
  // Check if full analysis exists (required for generating advice)
  // RKOS: Either analysisJson OR succesKansAnalysis counts as "full analysis"
  const hasFullAnalysis = currentCase?.fullAnalysis?.analysisJson || currentCase?.fullAnalysis?.succesKansAnalysis;

  if (!hasAdvice) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" asChild className="mb-4" data-testid="button-back-to-analysis">
          <Link href="/analysis">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar overzicht
          </Link>
        </Button>

        <div className="text-center py-12 max-w-2xl mx-auto">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Juridisch Advies Nog Niet Beschikbaar</h3>
          {hasFullAnalysis ? (
            <>
              <p className="text-sm text-muted-foreground mb-6">
                Genereer een uitgebreid juridisch advies met duidelijke secties over het geschil, de feiten, juridische duiding en vervolgstappen.
              </p>
              <Button
                onClick={() => generateAdviceMutation.mutate()}
                disabled={generateAdviceMutation.isPending}
                size="lg"
                data-testid="button-generate-advice"
              >
                {generateAdviceMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                    Advies genereren...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Juridisch advies genereren
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-6">
                Er moet eerst een volledige analyse worden uitgevoerd voordat juridisch advies kan worden gegenereerd.
              </p>
              <Button asChild size="lg" data-testid="button-go-to-analysis">
                <Link href="/analysis">
                  <FileSearch className="mr-2 h-4 w-4" />
                  Ga naar Analyse
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render advisory_text format (single text field from MindStudio)
  const renderAdvisoryText = (advisoryText: string) => {
    const handleCopy = () => {
      navigator.clipboard.writeText(advisoryText);
      toast({
        title: "Gekopieerd",
        description: "Het juridische advies is naar het klembord gekopieerd",
      });
    };

    const handleDownload = () => {
      const blob = new Blob([advisoryText], { type: 'text/plain' });
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateAdviceMutation.mutate()}
                  disabled={generateAdviceMutation.isPending}
                  data-testid="button-regenerate-advice"
                >
                  {generateAdviceMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      Genereren...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Opnieuw genereren
                    </>
                  )}
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

            {/* Advisory text content */}
            <SectionBody>
              <div 
                className="whitespace-pre-wrap text-sm leading-relaxed"
                data-testid="text-advisory-content"
              >
                {advisoryText}
              </div>
            </SectionBody>
          </A4Page>
        </A4Layout>
      </div>
    );
  };

  // Render NEW JSON format advice
  const renderJsonAdvice = () => {
    if (!legalAdviceJson) return null;

    // Handle advisory_text format (MindStudio returns single text field)
    if (legalAdviceJson.advisory_text && !legalAdviceJson.het_geschil) {
      return renderAdvisoryText(legalAdviceJson.advisory_text);
    }

    // Handle structured sections format
    // Support both 7-field format (without samenvatting) and 8-field format (with samenvatting)
    const hasSamenvatting = !!legalAdviceJson.samenvatting_advies;
    
    const sections = hasSamenvatting ? [
      { key: 'samenvatting_advies', title: 'Samenvatting Advies', isSummary: true },
      { key: 'vervolgstappen', title: '1. Vervolgstappen' },
      { key: 'divider', title: '', isDivider: true },
      { key: 'het_geschil', title: '2. Het Geschil' },
      { key: 'de_feiten', title: '3. De Feiten' },
      { key: 'betwiste_punten', title: '4. Betwiste Punten' },
      { key: 'beschikbaar_bewijs', title: '5. Beschikbaar Bewijs' },
      { key: 'ontbrekend_bewijs', title: '6. Ontbrekend Bewijs' },
      { key: 'juridische_duiding', title: '7. Juridische Duiding' },
    ] : [
      { key: 'vervolgstappen', title: '1. Vervolgstappen' },
      { key: 'divider', title: '', isDivider: true },
      { key: 'het_geschil', title: '2. Het Geschil' },
      { key: 'de_feiten', title: '3. De Feiten' },
      { key: 'betwiste_punten', title: '4. Betwiste Punten' },
      { key: 'beschikbaar_bewijs', title: '5. Beschikbaar Bewijs' },
      { key: 'ontbrekend_bewijs', title: '6. Ontbrekend Bewijs' },
      { key: 'juridische_duiding', title: '7. Juridische Duiding' },
    ];

    const allTextContent = sections
      .map(s => legalAdviceJson[s.key] || '')
      .join(' ');
    const isTruncated = allTextContent.length < 500;

    const handleCopy = () => {
      const fullText = sections
        .map(s => {
          // Use RKOS missing_elements for ontbrekend_bewijs if available
          let content = legalAdviceJson[s.key];
          if (s.key === 'ontbrekend_bewijs' && missingElementsFromRKOS.length > 0) {
            content = missingElementsFromRKOS.map((item: any) => 
              typeof item === 'string' ? item : `${item.point || item.item}\n${item.why_it_matters || item.why_needed || ''}`
            ).join('\n\n');
          } else if (Array.isArray(content)) {
            content = content.map((item: any) => 
              typeof item === 'string' ? item : JSON.stringify(item)
            ).join('\n');
          }
          return `${s.title}\n\n${content || 'Geen informatie beschikbaar'}\n\n`;
        })
        .join('---\n\n');
      navigator.clipboard.writeText(fullText);
      toast({
        title: "Gekopieerd",
        description: "Het juridische advies is naar het klembord gekopieerd",
      });
    };

    const handleDownload = () => {
      const fullText = sections
        .map(s => {
          // Use RKOS missing_elements for ontbrekend_bewijs if available
          let content = legalAdviceJson[s.key];
          if (s.key === 'ontbrekend_bewijs' && missingElementsFromRKOS.length > 0) {
            content = missingElementsFromRKOS.map((item: any) => 
              typeof item === 'string' ? item : `${item.point || item.item}\n${item.why_it_matters || item.why_needed || ''}`
            ).join('\n\n');
          } else if (Array.isArray(content)) {
            content = content.map((item: any) => 
              typeof item === 'string' ? item : JSON.stringify(item)
            ).join('\n');
          }
          return `${s.title}\n\n${content || 'Geen informatie beschikbaar'}\n\n`;
        })
        .join('---\n\n');
      const blob = new Blob([fullText], { type: 'text/plain' });
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateAdviceMutation.mutate()}
                  disabled={generateAdviceMutation.isPending}
                  data-testid="button-regenerate-advice"
                >
                  {generateAdviceMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      Genereren...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Opnieuw genereren
                    </>
                  )}
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

            {/* Truncation warning */}
            {isTruncated && (
              <Alert variant="destructive" className="mb-6" data-testid="alert-truncated-advice">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Advies Onvolledig</AlertTitle>
                <AlertDescription>
                  Het juridisch advies lijkt niet compleet te zijn ({allTextContent.length} karakters). 
                  Dit kan komen door een te lage "maximum response size" in MindStudio.
                  <br /><br />
                  <strong>Oplossing:</strong> Verhoog in MindStudio de "maximum response size" voor Create_advice.flow naar 8.000-16.000 tokens.
                  <br /><br />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateAdviceMutation.mutate()}
                    disabled={generateAdviceMutation.isPending}
                    className="mt-2 bg-background hover:bg-background/80"
                    data-testid="button-retry-from-warning"
                  >
                    {generateAdviceMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                        Opnieuw genereren...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Probeer opnieuw
                      </>
                    )}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Render sections */}
            <div className="space-y-6" data-testid="advice-content">
              {sections.map((section, idx) => {
                // Render horizontal divider
                if (section.isDivider) {
                  return (
                    <div key={section.key} className="my-8 border-t-2 border-gray-300 dark:border-gray-600"></div>
                  );
                }
                
                // IMPORTANT: Use RKOS.flow missing_elements instead of Create_advice ontbrekend_bewijs
                let content = legalAdviceJson[section.key];
                
                // Override ontbrekend_bewijs with RKOS.flow missing_elements (authoritative source)
                if (section.key === 'ontbrekend_bewijs' && missingElementsFromRKOS.length > 0) {
                  content = missingElementsFromRKOS;
                  console.log('📋 Using RKOS missing_elements for Ontbrekend Bewijs section');
                }
                
                if (!content) return null;

                // Helper function to render content (handles both strings and arrays of objects)
                const renderContent = (content: any) => {
                  // If it's an array of {item, why_needed} objects (ontbrekend_bewijs)
                  if (Array.isArray(content) && content.length > 0 && typeof content[0] === 'object' && 'item' in content[0]) {
                    return (
                      <div className="space-y-3">
                        {content.map((entry: any, index: number) => (
                          <div key={index}>
                            <div className="italic text-gray-900 dark:text-white">{entry.item}</div>
                            {entry.why_needed && (
                              <div className="text-gray-900 dark:text-white mt-1">
                                {entry.why_needed}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  // If it's an array of other objects (e.g., beschikbaar_bewijs with {type, filename, relevance})
                  else if (Array.isArray(content) && content.length > 0 && typeof content[0] === 'object') {
                    return (
                      <ul className="list-disc list-inside space-y-1">
                        {content.map((item: any, index: number) => {
                          // Try to render filename first, then type, then all values joined
                          const displayText = item.filename || item.type || Object.values(item).filter(v => v).join(' - ');
                          return <li key={index}>{displayText}</li>;
                        })}
                      </ul>
                    );
                  }
                  // If it's a regular array of strings
                  else if (Array.isArray(content)) {
                    return (
                      <ul className="list-disc list-inside space-y-1">
                        {content.map((item: string, index: number) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    );
                  }
                  // If it's a string
                  else {
                    return content;
                  }
                };

                return (
                  <div key={section.key} className="mb-6">
                    {section.isSummary ? (
                      // Special styling for summary
                      <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 p-4 mb-4 rounded-r">
                        <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                          {section.title}
                          <Badge variant="secondary" className="ml-2">Kernpunten</Badge>
                        </h2>
                        <SectionBody className="text-gray-700 dark:text-gray-300">
                          {renderContent(content)}
                        </SectionBody>
                      </div>
                    ) : (
                      // Regular sections
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white mb-3 text-[1em]">
                          {section.title}
                        </div>
                        <SectionBody>
                          {renderContent(content)}
                        </SectionBody>
                      </div>
                    )}
                  </div>
                );
              })}
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
  };

  // Render LEGACY text format advice
  const renderTextAdvice = () => {
    if (!legalAdviceFull) return null;

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
    const isTruncated = legalAdviceFull.length < 500;

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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateAdviceMutation.mutate()}
                  disabled={generateAdviceMutation.isPending}
                  data-testid="button-regenerate-advice"
                >
                  {generateAdviceMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      Genereren...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Opnieuw genereren
                    </>
                  )}
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

            {/* Truncation warning */}
            {isTruncated && (
              <Alert variant="destructive" className="mb-6" data-testid="alert-truncated-advice">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Advies Onvolledig</AlertTitle>
                <AlertDescription>
                  Het juridisch advies lijkt niet compleet te zijn ({legalAdviceFull.length} karakters). 
                  Dit kan komen door een te lage "maximum response size" in MindStudio.
                  <br /><br />
                  <strong>Oplossing:</strong> Verhoog in MindStudio de "maximum response size" voor de "Legal Analysis" stap naar 8.000-16.000 tokens.
                  <br /><br />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateAdviceMutation.mutate()}
                    disabled={generateAdviceMutation.isPending}
                    className="mt-2 bg-background hover:bg-background/80"
                    data-testid="button-retry-from-warning"
                  >
                    {generateAdviceMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                        Opnieuw genereren...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Probeer opnieuw
                      </>
                    )}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

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
  };

  // Render the appropriate format
  return legalAdviceJson ? renderJsonAdvice() : renderTextAdvice();
}
