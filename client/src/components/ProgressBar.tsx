import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: number;
  className?: string;
}

export default function ProgressBar({ progress, className }: ProgressBarProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-foreground">Voortgang</span>
        <span className="text-sm text-muted-foreground" data-testid="text-progress">
          {progress}%
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-3">
        <div 
          className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-primary via-primary to-success" 
          style={{ width: `${progress}%` }}
          data-testid="progress-bar"
        />
      </div>
    </div>
  );
}
