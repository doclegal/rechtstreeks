import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  Mail, 
  Gavel, 
  CheckCircle, 
  Building, 
  Play, 
  FastForward, 
  Award 
} from "lucide-react";

interface Step {
  id: number;
  name: string;
  icon: React.ElementType;
  status: "completed" | "active" | "action-needed" | "pending";
}

interface StepChipsProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export default function StepChips({ currentStep, onStepClick }: StepChipsProps) {
  const steps: Step[] = [
    { id: 1, name: "Indienen stukken", icon: Upload, status: "completed" },
    { id: 2, name: "Brief", icon: Mail, status: "completed" },
    { id: 3, name: "Deurwaarder", icon: Gavel, status: "active" },
    { id: 4, name: "Betekening", icon: CheckCircle, status: "pending" },
    { id: 5, name: "Rechtbank", icon: Building, status: "pending" },
    { id: 6, name: "Procedure", icon: Play, status: "pending" },
    { id: 7, name: "Vervolg", icon: FastForward, status: "pending" },
    { id: 8, name: "Vonnis", icon: Award, status: "pending" },
  ];

  // Update step statuses based on current step
  const updatedSteps = steps.map(step => ({
    ...step,
    status: step.id < currentStep ? "completed" as const :
           step.id === currentStep ? "active" as const :
           "pending" as const
  }));

  const getStepClassName = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success text-white hover:bg-success/90";
      case "active":
        return "bg-primary text-white hover:bg-primary/90";
      case "action-needed":
        return "bg-warning text-white hover:bg-warning/90";
      case "pending":
      default:
        return "bg-muted text-muted-foreground hover:bg-muted/80";
    }
  };

  return (
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2">
      {updatedSteps.map((step) => {
        const Icon = step.icon;
        return (
          <Button
            key={step.id}
            variant="ghost"
            className={cn(
              "p-3 rounded-lg text-xs font-medium transition-colors text-center h-auto flex-col space-y-1",
              getStepClassName(step.status)
            )}
            onClick={() => onStepClick?.(step.id)}
            data-testid={`step-chip-${step.id}`}
            data-step={step.id}
          >
            <Icon className="h-4 w-4" />
            <span className="leading-tight">{step.name}</span>
          </Button>
        );
      })}
    </div>
  );
}
