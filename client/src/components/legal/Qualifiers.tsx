import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Kwalificaties } from "@/lib/legalTypes";

interface QualifiersProps extends Kwalificaties {}

export function Qualifiers({ 
  is_kantonzaak, 
  relatieve_bevoegdheid, 
  toepasselijk_recht 
}: QualifiersProps) {
  const qualifiers = [
    { label: "Kantonzaak", value: is_kantonzaak },
    { label: "Relatieve Bevoegdheid", value: relatieve_bevoegdheid },
    { label: "Toepasselijk Recht", value: toepasselijk_recht }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Juridische Kwalificaties</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {qualifiers.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Badge 
                variant="outline" 
                className={value === "Onbekend" ? "text-muted-foreground" : ""}
              >
                {value || "Onbekend"}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}