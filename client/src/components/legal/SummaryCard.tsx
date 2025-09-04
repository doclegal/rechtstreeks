import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardProps {
  text: string;
}

export function SummaryCard({ text }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Samenvatting Feiten</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-w-3xl prose prose-sm dark:prose-invert">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {text || (
              <span className="text-muted-foreground italic">
                Geen samenvatting beschikbaar
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}