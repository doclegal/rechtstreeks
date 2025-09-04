import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface ConflictsProps {
  items: string[];
}

export function Conflicts({ items }: ConflictsProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Conflicten in Input Gedetecteerd</AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-1">
          {items.map((conflict, index) => (
            <div key={index} className="text-sm">
              • {conflict}
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}