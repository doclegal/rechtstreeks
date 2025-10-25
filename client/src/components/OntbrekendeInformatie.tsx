import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, FileText, Info } from "lucide-react";

interface OntbrekendeInformatieProps {
  ontbrekendBewijs: Array<{
    item: string;
    why_needed: string;
  }>;
}

export default function OntbrekendeInformatie({ ontbrekendBewijs }: OntbrekendeInformatieProps) {
  if (!ontbrekendBewijs || ontbrekendBewijs.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          Ontbrekende Informatie
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 border-amber-300 bg-amber-100 dark:bg-amber-900 dark:border-amber-700">
          <Info className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            De volgende informatie ontbreekt in uw dossier volgens het juridisch advies. Upload deze documenten om uw zaak te versterken.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {ontbrekendBewijs.map((item, index) => (
            <div 
              key={index}
              className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900"
              data-testid={`missing-item-${index}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {item.item}
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {item.why_needed}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>Tip:</strong> Upload deze documenten via de sectie hierboven. Na het uploaden kunt u een nieuwe analyse uitvoeren om uw dossier te updaten.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
