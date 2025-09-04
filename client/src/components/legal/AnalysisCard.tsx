import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AnalysisCardProps {
  text: string;
}

export function AnalysisCard({ text }: AnalysisCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Juridische Analyse (Uitgebreid)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-w-3xl prose prose-sm dark:prose-invert">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {text || (
              <span className="text-muted-foreground italic">
                Geen analyse beschikbaar
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}