import { useState } from "react";
import { useLocation } from "wouter";
import { Scale, FileSearch, Mail, UserCircle, Briefcase } from "lucide-react";
import { AskJuristDialog } from "@/components/AskJuristDialog";
import { isActiveRoute } from "@/lib/routeUtils";

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const [juristDialogOpen, setJuristDialogOpen] = useState(false);

  return (
    <>
      {/* Bottom Navigation Bar - Only visible on mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
        <div className="grid grid-cols-5 h-16">
          {/* Dashboard */}
          <button
            onClick={() => setLocation("/dashboard")}
            className={`flex flex-col items-center justify-center h-full w-full transition-colors ${
              isActiveRoute(location, "/dashboard")
                ? "text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="button-bottomnav-dashboard"
          >
            <Briefcase className="h-5 w-5" />
            <span className="text-xs mt-1">Dashboard</span>
          </button>

          {/* Mijn Zaak */}
          <button
            onClick={() => setLocation("/my-case")}
            className={`flex flex-col items-center justify-center h-full w-full transition-colors ${
              isActiveRoute(location, "/my-case", ["/case-details", "/case-details/:id"])
                ? "text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="button-bottomnav-my-case"
          >
            <Scale className="h-5 w-5" />
            <span className="text-xs mt-1">Zaak</span>
          </button>

          {/* Analyse */}
          <button
            onClick={() => setLocation("/analysis")}
            className={`flex flex-col items-center justify-center h-full w-full transition-colors ${
              isActiveRoute(location, "/analysis", ["/volledige-analyse", "/analyse-details", "/analysis/:id/full"])
                ? "text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="button-bottomnav-analysis"
          >
            <FileSearch className="h-5 w-5" />
            <span className="text-xs mt-1">Analyse</span>
          </button>

          {/* Brieven */}
          <button
            onClick={() => setLocation("/letters")}
            className={`flex flex-col items-center justify-center h-full w-full transition-colors ${
              isActiveRoute(location, "/letters", ["/letters/:id"])
                ? "text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="button-bottomnav-letters"
          >
            <Mail className="h-5 w-5" />
            <span className="text-xs mt-1">Brieven</span>
          </button>

          {/* Jurist - Special styling with blue */}
          <button
            onClick={() => setJuristDialogOpen(true)}
            className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-blue-600 to-purple-600 text-white transition-all hover:from-blue-700 hover:to-purple-700"
            data-testid="button-bottomnav-jurist"
          >
            <UserCircle className="h-5 w-5" />
            <span className="text-xs mt-1 font-medium">Jurist</span>
          </button>
        </div>
      </nav>

      {/* Spacer to prevent content from being hidden behind bottom nav on mobile */}
      <div className="lg:hidden h-16" />

      {/* Ask Jurist Dialog */}
      <AskJuristDialog
        open={juristDialogOpen}
        onOpenChange={setJuristDialogOpen}
        context="Bottom Navigation"
      />
    </>
  );
}
