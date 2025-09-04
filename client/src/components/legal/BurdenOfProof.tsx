import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, CheckCircle, XCircle } from "lucide-react";
import type { Bewijslast } from "@/lib/legalTypes";

interface BurdenOfProofProps extends Bewijslast {}

export function BurdenOfProof({ 
  wie_moet_wat_bewijzen, 
  beschikbaar_bewijs, 
  ontbrekend_bewijs 
}: BurdenOfProofProps) {
  const sections = [
    {
      title: "Wie moet wat bewijzen",
      items: wie_moet_wat_bewijzen,
      icon: Scale,
      variant: "outline" as const
    },
    {
      title: "Beschikbaar bewijs",
      items: beschikbaar_bewijs,
      icon: CheckCircle,
      variant: "default" as const
    },
    {
      title: "Ontbrekend bewijs",
      items: ontbrekend_bewijs,
      icon: XCircle,
      variant: "destructive" as const
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Bewijslast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
          {sections.map(({ title, items, icon: Icon, variant }) => (
            <div key={title} className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1">
                <Icon className="h-4 w-4" />
                {title}
              </h4>
              <div className="space-y-1">
                {items && items.length > 0 ? (
                  items.map((item, index) => (
                    <Badge 
                      key={index} 
                      variant={variant}
                      className="block text-xs p-2 h-auto text-left whitespace-normal"
                    >
                      {item}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Geen informatie beschikbaar
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}