import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, ArrowRight } from "lucide-react";
import { ensureArray } from "@/lib/legalTypes";

interface TodoCtasProps {
  todos: string[] | string;
  ctas: string[] | string;
  onAction?: (label: string) => void;
}

export function TodoCtas({ todos, ctas, onAction }: TodoCtasProps) {
  const todoArray = ensureArray(todos);
  const ctaArray = ensureArray(ctas);
  
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* To-Do Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            To-Do
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todoArray.length > 0 ? (
            <ul className="space-y-2">
              {todoArray.map((todo, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground mt-1">•</span>
                  <span>{todo}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Geen data beschikbaar
            </p>
          )}
        </CardContent>
      </Card>

      {/* CTA Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Aanbevolen Acties
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ctaArray.length > 0 ? (
            <div className="space-y-2">
              {ctaArray.map((cta, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start h-auto py-2 px-3 whitespace-normal text-left"
                  onClick={() => onAction?.(cta)}
                  data-testid={`cta-button-${index}`}
                >
                  <span className="text-sm">{cta}</span>
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Geen data beschikbaar
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}