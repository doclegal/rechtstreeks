import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Euro, Percent } from "lucide-react";
import type { Vordering } from "@/lib/legalTypes";

interface ClaimPanelProps extends Vordering {}

export function ClaimPanel({ hoofdsom, wettelijke_rente }: ClaimPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Euro className="h-5 w-5" />
          Vordering
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Hoofdsom:</span>
          <span className="font-medium">
            {hoofdsom || (
              <span className="text-muted-foreground italic">Onbekend</span>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Percent className="h-3 w-3" />
            Wettelijke rente:
          </span>
          <span className="font-medium">
            {wettelijke_rente || (
              <span className="text-muted-foreground italic">Onbekend</span>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}