import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  AlertTriangle, 
  Scale, 
  Users,
  TrendingUp,
  FileText
} from "lucide-react";

interface AnalysisResultsProps {
  analysis: {
    factsJson?: any[];
    issuesJson?: any[];
    legalBasisJson?: any[];
    riskNotesJson?: any[];
    missingDocsJson?: any[];
  };
}

export default function AnalysisResults({ analysis }: AnalysisResultsProps) {
  const facts = analysis.factsJson || [];
  const issues = analysis.issuesJson || [];
  const legalBasis = analysis.legalBasisJson || [];
  const riskNotes = analysis.riskNotesJson || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span>AI Analyse resultaten</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Facts */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 flex items-center">
              <CheckCircle className="text-primary mr-2 h-4 w-4" />
              Belangrijkste feiten
            </h3>
            {facts.length > 0 ? (
              <ul className="space-y-2" data-testid="list-facts">
                {facts.map((fact, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                    <span className="text-primary mt-1.5 text-xs">•</span>
                    <span>{typeof fact === 'string' ? fact : fact.description || fact.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Geen feiten geïdentificeerd</p>
            )}
          </div>
          
          {/* Legal Basis */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 flex items-center">
              <Scale className="text-warning mr-2 h-4 w-4" />
              Juridische grondslag
            </h3>
            {legalBasis.length > 0 ? (
              <ul className="space-y-2" data-testid="list-legal-basis">
                {legalBasis.map((basis, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                    <span className="text-primary mt-1.5 text-xs">•</span>
                    <span>{typeof basis === 'string' ? basis : basis.article || basis.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Geen juridische grondslag gevonden</p>
            )}
          </div>

          {/* Issues */}
          {issues.length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-3 flex items-center">
                <AlertTriangle className="text-warning mr-2 h-4 w-4" />
                Geïdentificeerde problemen
              </h3>
              <ul className="space-y-2" data-testid="list-issues">
                {issues.map((issue, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                    <span className="text-warning mt-1.5 text-xs">•</span>
                    <span>{typeof issue === 'string' ? issue : issue.description || issue.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Risk Assessment */}
        {riskNotes.length > 0 && (
          <div className="mt-6 p-4 bg-accent rounded-lg">
            <h4 className="font-medium text-accent-foreground mb-2 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Risico-inschatting
            </h4>
            <div className="space-y-1" data-testid="risk-assessment">
              {riskNotes.map((note, index) => (
                <p key={index} className="text-sm text-accent-foreground">
                  {typeof note === 'string' ? note : note.description || note.text}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
