import { useState } from "react";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PageInfoDialogProps {
  title: string;
  description: string;
  features: string[];
  importance: string;
}

export function PageInfoDialog({ title, description, features, importance }: PageInfoDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="ml-2 h-9 px-3 gap-1.5 border-green-500 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50 dark:border-green-600 text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium shadow-sm"
                data-testid="button-page-info"
              >
                <Info className="h-4 w-4" />
                <span className="text-xs">Info</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-green-700 dark:bg-green-800 text-white border-green-600">
            <p>Klik voor uitleg over deze pagina</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Info className="h-6 w-6 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <h4 className="font-semibold text-foreground mb-2">Wat kunt u hier doen?</h4>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-1">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <span className="text-xl">💡</span>
              Waarom is dit belangrijk?
            </h4>
            <p className="text-sm text-muted-foreground">
              {importance}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
