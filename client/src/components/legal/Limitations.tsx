import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface LimitationsProps {
  text: string;
}

export function Limitations({ text }: LimitationsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Verjaring & Klachttermijnen
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-w-3xl">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {text || (
              <span className="text-muted-foreground italic">
                Geen informatie over verjaring en klachttermijnen beschikbaar
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}