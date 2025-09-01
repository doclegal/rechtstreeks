import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

interface DeadlineWarningProps {
  caseId: string;
}

interface DeadlineWarning {
  type: string;
  message: string;
  daysRemaining: number;
}

export default function DeadlineWarning({ caseId }: DeadlineWarningProps) {
  const [warnings, setWarnings] = useState<DeadlineWarning[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    // Check for deadline warnings
    const checkDeadlines = async () => {
      try {
        const response = await fetch(`/api/cases/${caseId}/deadlines`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.hasWarnings) {
            setWarnings(data.warnings);
          }
        }
      } catch (error) {
        console.error("Error checking deadlines:", error);
      }
    };

    if (caseId) {
      checkDeadlines();
      // Check every 5 minutes
      const interval = setInterval(checkDeadlines, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [caseId]);

  const visibleWarnings = warnings.filter(warning => 
    !dismissed.includes(`${warning.type}-${warning.daysRemaining}`)
  );

  const dismissWarning = (warning: DeadlineWarning) => {
    setDismissed(prev => [...prev, `${warning.type}-${warning.daysRemaining}`]);
  };

  if (visibleWarnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleWarnings.map((warning, index) => (
        <Alert 
          key={index} 
          className="border-warning bg-warning/10"
          data-testid={`deadline-warning-${index}`}
        >
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Let op termijn!</p>
              <p className="text-sm text-muted-foreground">
                {warning.message} ({warning.daysRemaining} dagen resterend)
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissWarning(warning)}
              data-testid={`button-dismiss-warning-${index}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
