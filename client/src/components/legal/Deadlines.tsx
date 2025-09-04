import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface DeadlinesProps {
  items: string[];
}

export function Deadlines({ items }: DeadlinesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Deadlines & Termijnen
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items && items.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {items.map((item, index) => (
              <Badge 
                key={index} 
                variant="secondary"
                className={item.toLowerCase().includes('onbekend') ? 'text-muted-foreground' : ''}
              >
                {item}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Geen deadlines beschikbaar
          </p>
        )}
      </CardContent>
    </Card>
  );
}