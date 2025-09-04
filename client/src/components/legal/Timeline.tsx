import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

interface TimelineProps {
  items: string[];
}

export function Timeline({ items }: TimelineProps) {
  const parseTimelineItem = (item: string) => {
    // Try to extract date and event from the timeline item
    const dateMatch = item.match(/^(\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
    if (dateMatch) {
      const date = dateMatch[1];
      const event = item.substring(dateMatch[0].length).replace(/^[\s:-]+/, '').trim();
      return { date, event: event || item };
    }
    
    // If no date found, check for "Onbekend" or treat as event
    if (item.toLowerCase().includes('onbekend')) {
      return { date: 'Onbekend', event: item };
    }
    
    return { date: null, event: item };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Tijdlijn
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item, index) => {
              const { date, event } = parseTimelineItem(item);
              return (
                <div key={index} className="flex items-start gap-3 pb-3 border-b border-border last:border-b-0">
                  <div className="flex-shrink-0">
                    {date ? (
                      <Badge 
                        variant="outline" 
                        className={date === 'Onbekend' ? 'text-muted-foreground' : ''}
                      >
                        {date}
                      </Badge>
                    ) : (
                      <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                    )}
                  </div>
                  <p className="text-sm flex-1">{event}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Geen tijdlijn beschikbaar
          </p>
        )}
      </CardContent>
    </Card>
  );
}