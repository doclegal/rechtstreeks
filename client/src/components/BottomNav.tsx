import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Scale, FileSearch, Mail, UserCircle, Briefcase, MessageCircle, HelpCircle } from "lucide-react";
import { AskJuristDialog } from "@/components/AskJuristDialog";
import { isActiveRoute } from "@/lib/routeUtils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const [juristDialogOpen, setJuristDialogOpen] = useState(false);
  const [helpSheetOpen, setHelpSheetOpen] = useState(false);

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

          {/* Onderhandelen */}
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
            <span className="text-xs mt-1">Onderhandelen</span>
          </button>

          {/* Hulp - Opens help menu with all options */}
          <button
            onClick={() => setHelpSheetOpen(true)}
            className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-blue-600 to-purple-600 text-white transition-all hover:from-blue-700 hover:to-purple-700"
            data-testid="button-bottomnav-help"
          >
            <HelpCircle className="h-5 w-5" />
            <span className="text-xs mt-1 font-medium">Hulp</span>
          </button>
        </div>
      </nav>

      {/* Spacer to prevent content from being hidden behind bottom nav on mobile */}
      <div className="lg:hidden h-16" />

      {/* Mobile Help Sheet */}
      <Sheet open={helpSheetOpen} onOpenChange={setHelpSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left">Hulp & Ondersteuning</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-3 pb-6">
            {/* Chat Link */}
            <Link
              href="/chat"
              onClick={() => setHelpSheetOpen(false)}
              className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted border border-border transition-colors"
              data-testid="link-chat-mobile"
            >
              <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground">Chat</h4>
                <p className="text-sm text-muted-foreground">AI juridische chatassistent</p>
              </div>
            </Link>

            {/* Q&A Link */}
            <Link
              href="/qna"
              onClick={() => setHelpSheetOpen(false)}
              className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted border border-border transition-colors"
              data-testid="link-qna-mobile"
            >
              <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <HelpCircle className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground">Q&A</h4>
                <p className="text-sm text-muted-foreground">Veelgestelde vragen over uw zaak</p>
              </div>
            </Link>

            {/* Vraag een Jurist */}
            <div
              className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4"
              data-testid="card-ask-jurist-mobile"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <UserCircle className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Vraag een jurist
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Directe juridische ondersteuning
                  </p>
                </div>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                Een ervaren jurist staat klaar om uw vragen te beantwoorden.
              </p>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setHelpSheetOpen(false);
                  setJuristDialogOpen(true);
                }}
                data-testid="button-ask-jurist-mobile"
              >
                <UserCircle className="h-4 w-4 mr-2" />
                Stel uw vraag
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Ask Jurist Dialog */}
      <AskJuristDialog
        open={juristDialogOpen}
        onOpenChange={setJuristDialogOpen}
        context="Mobile Help Menu"
      />
    </>
  );
}
