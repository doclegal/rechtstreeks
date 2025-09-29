import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertTriangle, HelpCircle, FileText, Scale, Target, Users, Euro } from "lucide-react";

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
    <div className="space-y-6" data-testid="mindstudio-analysis">
      {/* Case Overview */}
      {analysis.case_overview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Zaak Overzicht
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  <span className="font-medium">Kantongerecht:</span>
                  <Badge variant={analysis.case_overview.is_kantonzaak ? "default" : "secondary"}>
                    {analysis.case_overview.is_kantonzaak ? "Geschikt" : "Niet geschikt"}
                  </Badge>
                </div>
                {analysis.case_overview.amount_eur !== undefined && (
                  <div className="flex items-center gap-2">
                    <Euro className="h-4 w-4" />
                    <span className="font-medium">Claim bedrag:</span>
                    <span>€{analysis.case_overview.amount_eur.toLocaleString('nl-NL')}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">Contract aanwezig:</span>
                  <Badge variant={analysis.case_overview.contract_present ? "default" : "secondary"}>
                    {analysis.case_overview.contract_present ? "Ja" : "Nee"}
                  </Badge>
                </div>
              </div>
              
              {analysis.case_overview.parties && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">Partijen:</span>
                  </div>
                  {analysis.case_overview.parties.claimant && (
                    <div className="ml-6">
                      <span className="text-sm font-medium">Eiser:</span> {analysis.case_overview.parties.claimant.name}
                    </div>
                  )}
                  {analysis.case_overview.parties.defendant && (
                    <div className="ml-6">
                      <span className="text-sm font-medium">Verweerder:</span> {analysis.case_overview.parties.defendant.name}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {analysis.case_overview.forum_clause_text && (
              <div className="pt-2">
                <span className="font-medium">Forum clausule:</span>
                <p className="text-sm mt-1 p-2 bg-muted rounded">{analysis.case_overview.forum_clause_text}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legal Analysis */}
      {analysis.legal_analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Juridische Analyse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.legal_analysis.what_is_the_dispute && (
              <div>
                <h4 className="font-medium mb-2">Kern van het geschil:</h4>
                <p className="text-sm p-3 bg-muted rounded">{analysis.legal_analysis.what_is_the_dispute}</p>
              </div>
            )}
            
            {analysis.legal_analysis.preliminary_assessment && (
              <div>
                <h4 className="font-medium mb-2">Voorlopige beoordeling:</h4>
                <p className="text-sm p-3 bg-muted rounded">{analysis.legal_analysis.preliminary_assessment}</p>
              </div>
            )}

            {analysis.legal_analysis.legal_issues && analysis.legal_analysis.legal_issues.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Juridische kernpunten:</h4>
                <ul className="space-y-1">
                  {analysis.legal_analysis.legal_issues.map((issue, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.legal_analysis.potential_defenses && analysis.legal_analysis.potential_defenses.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Mogelijke verweren:</h4>
                <ul className="space-y-1">
                  {analysis.legal_analysis.potential_defenses.map((defense, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
                      {defense}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.legal_analysis.risks && analysis.legal_analysis.risks.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Risico's:</h4>
                <ul className="space-y-1">
                  {analysis.legal_analysis.risks.map((risk, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.legal_analysis.legal_basis && analysis.legal_analysis.legal_basis.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Rechtsgronden:</h4>
                <ul className="space-y-1">
                  {analysis.legal_analysis.legal_basis.map((basis, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Scale className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                      <div>
                        <span className="font-medium">{basis.law}</span>
                        {basis.article && <span className="text-muted-foreground"> - {basis.article}</span>}
                        {basis.note && <div className="text-xs text-muted-foreground mt-1">{basis.note}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.legal_analysis.next_actions && analysis.legal_analysis.next_actions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Vervolgstappen:</h4>
                <ul className="space-y-1">
                  {analysis.legal_analysis.next_actions.map((action, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Target className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dispute Summary */}
      {analysis.legal_analysis?.what_is_the_dispute && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Geschil in het kort
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm p-3 bg-blue-50 dark:bg-blue-900/20 rounded border-l-4 border-blue-500">
              {analysis.legal_analysis.what_is_the_dispute}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Facts */}
      {analysis.facts && (
        <Card>
          <CardHeader>
            <CardTitle>Feiten en Omstandigheden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.facts.known && analysis.facts.known.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Vaststaande feiten
                </h4>
                <ul className="space-y-1">
                  {analysis.facts.known.map((fact, index) => (
                    <li key={index} className="text-sm p-2 bg-green-50 dark:bg-green-900/20 rounded border-l-2 border-green-500">
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.facts.disputed && analysis.facts.disputed.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Betwiste feiten
                </h4>
                <ul className="space-y-1">
                  {analysis.facts.disputed.map((fact, index) => (
                    <li key={index} className="text-sm p-2 bg-orange-50 dark:bg-orange-900/20 rounded border-l-2 border-orange-500">
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.facts.unclear && analysis.facts.unclear.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-gray-500" />
                  Onduidelijke feiten
                </h4>
                <ul className="space-y-1">
                  {analysis.facts.unclear.map((fact, index) => (
                    <li key={index} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded border-l-2 border-gray-400">
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Evidence */}
      {analysis.evidence && (
        <Card>
          <CardHeader>
            <CardTitle>Bewijs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.evidence.provided && analysis.evidence.provided.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Aangeleverd bewijs:</h4>
                <div className="space-y-2">
                  {analysis.evidence.provided.map((evidence, index) => (
                    <div key={index} className="p-3 border rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium">{evidence.doc_name}</span>
                        {evidence.source && <Badge variant="outline" className="text-xs">{evidence.source}</Badge>}
                      </div>
                      {evidence.key_passages && evidence.key_passages.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-1">Relevante passages:</p>
                          <ul className="space-y-1">
                            {evidence.key_passages.map((passage, pIndex) => (
                              <li key={pIndex} className="text-xs p-1 bg-blue-50 dark:bg-blue-900/20 rounded">
                                "{passage}"
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.evidence.missing && analysis.evidence.missing.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Ontbrekend bewijs
                </h4>
                <ul className="space-y-1">
                  {analysis.evidence.missing.map((missing, index) => (
                    <li key={index} className="text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded border-l-2 border-red-500">
                      {missing}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Questions to Answer */}
      {analysis.questions_to_answer && analysis.questions_to_answer.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Te beantwoorden vragen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.questions_to_answer.map((question, index) => (
                <li key={index} className="flex items-start gap-2 text-sm p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <HelpCircle className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                  {question}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Missing Information */}
      {analysis.missing_info_for_assessment && analysis.missing_info_for_assessment.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Ontbrekende informatie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {analysis.missing_info_for_assessment.map((info, index) => (
                <li key={index} className="text-sm p-2 bg-orange-50 dark:bg-orange-900/20 rounded border-l-2 border-orange-500">
                  {info}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Per Document Analysis */}
      {analysis.per_document && analysis.per_document.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Document Analyse</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysis.per_document.map((doc, index) => (
                <div key={index} className="border rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{doc.name}</span>
                    {doc.type && <Badge variant="outline" className="text-xs">{doc.type}</Badge>}
                  </div>
                  
                  {doc.summary && (
                    <p className="text-sm text-muted-foreground mb-2">{doc.summary}</p>
                  )}
                  
                  {doc.extracted_points && doc.extracted_points.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Geëxtraheerde punten:</p>
                      <ul className="space-y-1">
                        {doc.extracted_points.map((point, pIndex) => (
                          <li key={pIndex} className="text-xs p-1 bg-gray-50 dark:bg-gray-800 rounded">
                            • {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}