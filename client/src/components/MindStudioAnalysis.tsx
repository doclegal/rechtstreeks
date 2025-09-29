import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  FileText, 
  Scale, 
  Target, 
  Users, 
  Euro,
  ChevronDown,
  Upload,
  Info,
  BookOpen,
  Gavel,
  Shield,
  Calendar,
  CheckSquare,
  XCircle
} from "lucide-react";

interface MindStudioAnalysisProps {
  analysis: {
    case_overview?: {
      case_id?: string;
      is_kantonzaak?: boolean;
      amount_eur?: number;
      parties?: {
        claimant?: { name?: string; type?: string };
        defendant?: { name?: string; type?: string };
      };
      forum_clause_text?: string | null;
      contract_present?: boolean;
    };
    summary?: {
      facts_brief?: string;
      claims_brief?: string;
      defenses_brief?: string;
      legal_brief?: string;
    };
    questions_to_answer?: string[];
    facts?: {
      known?: string[];
      disputed?: string[];
      unclear?: string[];
    };
    evidence?: {
      provided?: Array<{
        source?: string;
        doc_name?: string;
        doc_url?: string;
        key_passages?: string[];
      }>;
      missing?: string[];
    };
    missing_info_for_assessment?: string[];
    per_document?: Array<{
      name?: string;
      url?: string;
      type?: string;
      summary?: string;
      extracted_points?: string[];
    }>;
    legal_analysis?: {
      what_is_the_dispute?: string;
      legal_issues?: string[];
      potential_defenses?: string[];
      preliminary_assessment?: string;
      risks?: string[];
      next_actions?: string[];
      legal_basis?: Array<{
        law?: string;
        article?: string;
        note?: string;
      }>;
    };
  };
}

const LegalTermTooltip = ({ term, explanation, children }: { term: string; explanation: string; children: React.ReactNode }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="underline decoration-dotted cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="max-w-xs">
          <p className="font-medium">{term}</p>
          <p className="text-sm">{explanation}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const CaseSummaryCard = ({ analysis }: { analysis: any }) => {
  if (!analysis.case_overview) return null;

  return (
    <Card className="sticky top-4 shadow-lg border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Scale className="h-5 w-5" />
          Zaak Samenvatting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Parties */}
        {analysis.case_overview.parties && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm">Partijen</span>
            </div>
            <div className="pl-6 space-y-1 text-sm">
              {analysis.case_overview.parties.claimant && (
                <div>
                  <span className="text-green-600 font-medium">Eiser:</span> {analysis.case_overview.parties.claimant.name}
                </div>
              )}
              {analysis.case_overview.parties.defendant && (
                <div>
                  <span className="text-red-600 font-medium">Verweerder:</span> {analysis.case_overview.parties.defendant.name}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Claim Amount */}
        {analysis.case_overview.amount_eur !== undefined && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-green-600" />
              <span className="font-medium text-sm">Claim bedrag</span>
            </div>
            <span className="font-bold text-green-700">€{analysis.case_overview.amount_eur.toLocaleString('nl-NL')}</span>
          </div>
        )}

        {/* Case Type */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-purple-600" />
            <span className="font-medium text-sm">Zaaktype</span>
          </div>
          <Badge variant="outline" className="text-xs">Verhuur/Borg</Badge>
        </div>

        {/* Court Suitability */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-sm">
              <LegalTermTooltip 
                term="Kantongerecht" 
                explanation="Rechtbank voor geschillen tot €25.000 met vereenvoudigde procedure"
              >
                Kantongerecht
              </LegalTermTooltip>
            </span>
          </div>
          <Badge variant={analysis.case_overview.is_kantonzaak ? "default" : "destructive"}>
            {analysis.case_overview.is_kantonzaak ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" />Geschikt</>
            ) : (
              <><XCircle className="h-3 w-3 mr-1" />Niet geschikt</>
            )}
          </Badge>
        </div>

        {/* Contract Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-600" />
            <span className="font-medium text-sm">Contract</span>
          </div>
          <Badge variant={analysis.case_overview.contract_present ? "default" : "secondary"}>
            {analysis.case_overview.contract_present ? "Aanwezig" : "Ontbreekt"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

const EvidenceChecklist = ({ evidence }: { evidence: any }) => {
  if (!evidence || !evidence.missing || evidence.missing.length === 0) return null;

  return (
    <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-900/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700">
          <CheckSquare className="h-5 w-5" />
          Ontbrekend Bewijs Checklist
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {evidence.missing.map((item: string, index: number) => (
            <div key={index} className="flex items-start gap-3 p-2 bg-white dark:bg-gray-800 rounded border">
              <Checkbox id={`missing-${index}`} className="mt-1" />
              <div className="flex-1">
                <label htmlFor={`missing-${index}`} className="text-sm cursor-pointer">
                  {item}
                </label>
              </div>
              <Button size="sm" variant="outline" className="text-xs" data-testid={`button-upload-missing-${index}`}>
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export function MindStudioAnalysis({ analysis }: MindStudioAnalysisProps) {
  if (!analysis) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Geen gestructureerde analyse beschikbaar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50" data-testid="mindstudio-analysis">
      <div className="container mx-auto p-6">
        {/* Two-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Left column: Sticky Case Summary (1/4 width on xl screens) */}
          <div className="xl:col-span-1">
            <CaseSummaryCard analysis={analysis} />
          </div>
          
          {/* Right column: Main content (3/4 width on xl screens) */}
          <div className="xl:col-span-3 space-y-6">
            {/* Quick Summary Cards Row */}
            {analysis.summary && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {analysis.summary.facts_brief && (
                  <Card className="shadow-md border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        <h3 className="font-medium text-blue-700">Feiten</h3>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{analysis.summary.facts_brief}</p>
                    </CardContent>
                  </Card>
                )}
                
                {analysis.summary.claims_brief && (
                  <Card className="shadow-md border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-green-600" />
                        <h3 className="font-medium text-green-700">Eisers Stellingen</h3>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{analysis.summary.claims_brief}</p>
                    </CardContent>
                  </Card>
                )}
                
                {analysis.summary.defenses_brief && (
                  <Card className="shadow-md border-l-4 border-l-orange-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-orange-600" />
                        <h3 className="font-medium text-orange-700">Verweer</h3>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{analysis.summary.defenses_brief}</p>
                    </CardContent>
                  </Card>
                )}
                
                {analysis.summary.legal_brief && (
                  <Card className="shadow-md border-l-4 border-l-purple-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Gavel className="h-4 w-4 text-purple-600" />
                        <h3 className="font-medium text-purple-700">Juridisch</h3>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{analysis.summary.legal_brief}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Tabbed Content */}
            <Tabs defaultValue="facts" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="facts" className="text-xs">
                  <BookOpen className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Feiten</span>
                </TabsTrigger>
                <TabsTrigger value="legal" className="text-xs">
                  <Gavel className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Juridisch</span>
                </TabsTrigger>
                <TabsTrigger value="evidence" className="text-xs">
                  <FileText className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Bewijs</span>
                </TabsTrigger>
                <TabsTrigger value="risks" className="text-xs">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Risico's</span>
                </TabsTrigger>
                <TabsTrigger value="next" className="text-xs">
                  <Calendar className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Vervolgstappen</span>
                </TabsTrigger>
              </TabsList>

              {/* Facts Tab */}
              <TabsContent value="facts" className="space-y-4">
                {analysis.facts && (
                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Feiten en Omstandigheden
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {analysis.facts.known && analysis.facts.known.length > 0 && (
                        <Collapsible defaultOpen>
                          <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                            <ChevronDown className="h-4 w-4" />
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="font-medium">Vaststaande feiten ({analysis.facts.known.length})</span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-6 pt-2 space-y-2">
                            {analysis.facts.known.map((fact, index) => (
                              <div key={index} className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded border-l-2 border-green-500">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">{fact}</span>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {analysis.facts.disputed && analysis.facts.disputed.length > 0 && (
                        <Collapsible>
                          <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                            <ChevronDown className="h-4 w-4" />
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">Betwiste feiten ({analysis.facts.disputed.length})</span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-6 pt-2 space-y-2">
                            {analysis.facts.disputed.map((fact, index) => (
                              <div key={index} className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded border-l-2 border-orange-500">
                                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">{fact}</span>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {analysis.facts.unclear && analysis.facts.unclear.length > 0 && (
                        <Collapsible>
                          <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                            <ChevronDown className="h-4 w-4" />
                            <HelpCircle className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">Onduidelijke feiten ({analysis.facts.unclear.length})</span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-6 pt-2 space-y-2">
                            {analysis.facts.unclear.map((fact, index) => (
                              <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border-l-2 border-gray-400">
                                <HelpCircle className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">{fact}</span>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Legal Analysis Tab */}
              <TabsContent value="legal" className="space-y-4">
                {analysis.legal_analysis && (
                  <div className="space-y-4">
                    {/* Core Dispute */}
                    {analysis.legal_analysis.what_is_the_dispute && (
                      <Card className="shadow-md">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Scale className="h-5 w-5" />
                            Kern van het Geschil
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm p-4 bg-blue-50 dark:bg-blue-900/20 rounded border-l-4 border-blue-500">
                            {analysis.legal_analysis.what_is_the_dispute}
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Legal Issues */}
                    {analysis.legal_analysis.legal_issues && analysis.legal_analysis.legal_issues.length > 0 && (
                      <Card className="shadow-md">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            Juridische Kernpunten
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {analysis.legal_analysis.legal_issues.map((issue, index) => (
                              <div key={index} className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">{issue}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Legal Basis */}
                    {analysis.legal_analysis.legal_basis && analysis.legal_analysis.legal_basis.length > 0 && (
                      <Card className="shadow-md">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Scale className="h-5 w-5 text-blue-600" />
                            <LegalTermTooltip 
                              term="Rechtsgronden" 
                              explanation="De wetten en artikelen die van toepassing zijn op uw zaak"
                            >
                              Rechtsgronden
                            </LegalTermTooltip>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {analysis.legal_analysis.legal_basis.map((basis, index) => (
                              <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border-l-2 border-blue-500">
                                <Scale className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{basis.law}</div>
                                  {basis.article && <div className="text-xs text-muted-foreground">{basis.article}</div>}
                                  {basis.note && <div className="text-xs text-muted-foreground mt-1">{basis.note}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Preliminary Assessment */}
                    {analysis.legal_analysis.preliminary_assessment && (
                      <Card className="shadow-md">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Gavel className="h-5 w-5 text-purple-600" />
                            Voorlopige Beoordeling
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm p-4 bg-purple-50 dark:bg-purple-900/20 rounded border-l-4 border-purple-500">
                            {analysis.legal_analysis.preliminary_assessment}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Evidence Tab */}
              <TabsContent value="evidence" className="space-y-4">
                {/* Evidence Checklist */}
                <EvidenceChecklist evidence={analysis.evidence} />
                
                {analysis.evidence && (
                  <div className="space-y-4">
                    {/* Provided Evidence */}
                    {analysis.evidence.provided && analysis.evidence.provided.length > 0 && (
                      <Card className="shadow-md border-green-200">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-green-700">
                            <CheckCircle2 className="h-5 w-5" />
                            Aangeleverd Bewijs ({analysis.evidence.provided.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {analysis.evidence.provided.map((evidence, index) => (
                              <div key={index} className="p-4 border rounded bg-green-50/50 dark:bg-green-900/10">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-green-600" />
                                    <span className="font-medium text-sm">{evidence.doc_name}</span>
                                  </div>
                                  {evidence.source && (
                                    <Badge variant="outline" className="text-xs bg-green-100">{evidence.source}</Badge>
                                  )}
                                </div>
                                {evidence.key_passages && evidence.key_passages.length > 0 && (
                                  <div className="mt-3">
                                    <p className="text-xs font-medium mb-2 text-gray-600">Relevante passages:</p>
                                    <div className="space-y-1">
                                      {evidence.key_passages.map((passage, pIndex) => (
                                        <div key={pIndex} className="text-xs p-2 bg-white dark:bg-gray-800 rounded border-l-2 border-green-400">
                                          "{passage}"
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Missing Evidence Card */}
                    {analysis.evidence.missing && analysis.evidence.missing.length > 0 && (
                      <Card className="shadow-md border-red-200">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-red-700">
                            <XCircle className="h-5 w-5" />
                            Ontbrekend Bewijs ({analysis.evidence.missing.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {analysis.evidence.missing.map((missing, index) => (
                              <div key={index} className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded border-l-2 border-red-500">
                                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                <span className="text-sm flex-1">{missing}</span>
                                <Button size="sm" variant="outline" className="text-xs">
                                  <Upload className="h-3 w-3 mr-1" />
                                  Upload
                                </Button>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Risks Tab */}
              <TabsContent value="risks" className="space-y-4">
                {analysis.legal_analysis && (
                  <div className="space-y-4">
                    {/* Risks */}
                    {analysis.legal_analysis.risks && analysis.legal_analysis.risks.length > 0 && (
                      <Card className="shadow-md border-red-200">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-red-700">
                            <AlertTriangle className="h-5 w-5" />
                            Geïdentificeerde Risico's
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {analysis.legal_analysis.risks.map((risk, index) => (
                              <div key={index} className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded border-l-4 border-red-500">
                                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="text-sm font-medium text-red-800 dark:text-red-200">{risk}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Potential Defenses */}
                    {analysis.legal_analysis.potential_defenses && analysis.legal_analysis.potential_defenses.length > 0 && (
                      <Card className="shadow-md border-orange-200">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-orange-700">
                            <Shield className="h-5 w-5" />
                            Mogelijke Verweren
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {analysis.legal_analysis.potential_defenses.map((defense, index) => (
                              <div key={index} className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded border-l-4 border-orange-500">
                                <Shield className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">{defense}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Next Steps Tab */}
              <TabsContent value="next" className="space-y-4">
                {analysis.legal_analysis?.next_actions && analysis.legal_analysis.next_actions.length > 0 && (
                  <Card className="shadow-md border-blue-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-700">
                        <Calendar className="h-5 w-5" />
                        Aanbevolen Vervolgstappen
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analysis.legal_analysis.next_actions.map((action, index) => (
                          <div key={index} className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded border-l-4 border-blue-500">
                            <div className="flex items-center justify-center w-6 h-6 bg-blue-500 text-white rounded-full text-xs font-bold flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <span className="text-sm">{action}</span>
                            </div>
                            <Button size="sm" className="text-xs" data-testid={`button-action-${index}`}>
                              Uitvoeren
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Questions to Answer */}
                {analysis.questions_to_answer && analysis.questions_to_answer.length > 0 && (
                  <Card className="shadow-md border-purple-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-purple-700">
                        <HelpCircle className="h-5 w-5" />
                        Te Beantwoorden Vragen
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analysis.questions_to_answer.map((question, index) => (
                          <div key={index} className="flex items-start gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded border-l-4 border-purple-500">
                            <HelpCircle className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{question}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Missing Information */}
                {analysis.missing_info_for_assessment && analysis.missing_info_for_assessment.length > 0 && (
                  <Card className="shadow-md border-yellow-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-yellow-700">
                        <Info className="h-5 w-5" />
                        Ontbrekende Informatie
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analysis.missing_info_for_assessment.map((info, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border-l-4 border-yellow-500">
                            <Info className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{info}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}