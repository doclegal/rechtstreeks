import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, HelpCircle, XCircle } from "lucide-react";
import type { Kansinschatting } from "@/lib/legalTypes";
import { getRiskColor } from "@/lib/legalTypes";

interface RiskPanelProps extends Kansinschatting {}

export function RiskPanel({ inschatting, redenen }: RiskPanelProps) {
  const getRiskIcon = () => {
    switch (inschatting) {
      case "kansrijk":
        return <CheckCircle className="h-4 w-4" />;
      case "twijfelachtig":
        return <AlertTriangle className="h-4 w-4" />;
      case "risicovol":
        return <XCircle className="h-4 w-4" />;
      case "Onbekend":
      default:
        return <HelpCircle className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Kansinschatting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className={getRiskColor(inschatting)}>
            {getRiskIcon()}
            <span className="ml-1 capitalize">{inschatting}</span>
          </Badge>
        </div>
        
        {redenen && redenen.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Redenen:</h4>
            <ul className="space-y-1">
              {redenen.map((reden, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-xs mt-1">•</span>
                  <span>{reden}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}