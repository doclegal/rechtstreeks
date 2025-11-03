import { Button } from "@/components/ui/button";
import { UserCircle } from "lucide-react";
import { useState } from "react";
import { AskJuristDialog } from "./AskJuristDialog";

interface AskJuristButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  context?: string;
  showText?: boolean;
  className?: string;
}

export function AskJuristButton({ 
  variant = "outline", 
  size = "default", 
  context,
  showText = true,
  className = ""
}: AskJuristButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setDialogOpen(true)}
        className={className}
        data-testid="button-ask-jurist"
      >
        <UserCircle className="h-4 w-4" />
        {showText && <span className="ml-2">Vraag een jurist</span>}
      </Button>
      <AskJuristDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        context={context}
      />
    </>
  );
}
