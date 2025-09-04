import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { List } from "lucide-react";
import { ensureArray } from "@/lib/legalTypes";

interface OrderedListProps {
  items: string[] | string;
}

export function OrderedList({ items }: OrderedListProps) {
  const arrayItems = ensureArray(items);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <List className="h-5 w-5" />
          Kernredenering
        </CardTitle>
      </CardHeader>
      <CardContent>
        {arrayItems.length > 0 ? (
          <ol className="space-y-2 list-decimal list-inside">
            {arrayItems.map((item, index) => (
              <li key={index} className="text-sm leading-relaxed">
                <span className="ml-2">{item}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Geen data beschikbaar
          </p>
        )}
      </CardContent>
    </Card>
  );
}