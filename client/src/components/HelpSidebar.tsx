import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { UserCircle, ChevronLeft, X, MessageCircle, HelpCircle } from "lucide-react";
import { AskJuristDialog } from "@/components/AskJuristDialog";

export function HelpSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [juristDialogOpen, setJuristDialogOpen] = useState(false);

  return (
    <>
      {/* Sidebar Panel - Hidden on mobile, visible on desktop */}
      <div
        className={`hidden lg:block fixed top-0 right-0 h-full bg-card border-l border-border shadow-2xl transition-transform duration-300 ease-in-out z-40 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "320px" }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
            <h3 className="font-semibold text-foreground">Hulp & Ondersteuning</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              data-testid="button-close-sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Chat Link */}
            <Link
              href="/chat"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted border border-border transition-colors cursor-pointer"
              data-testid="link-chat-sidebar"
            >
              <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground">Chat</h4>
                <p className="text-sm text-muted-foreground">AI juridische chatassistent</p>
              </div>
            </Link>

            {/* Q&A Link */}
            <Link
              href="/qna"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted border border-border transition-colors cursor-pointer"
              data-testid="link-qna-sidebar"
            >
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <HelpCircle className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground">Q&A</h4>
                <p className="text-sm text-muted-foreground">Veelgestelde vragen over uw zaak</p>
              </div>
            </Link>

            {/* Vraag een Jurist Card */}
            <div
              className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => {
                setJuristDialogOpen(true);
                setIsOpen(false);
              }}
              data-testid="card-ask-jurist-sidebar"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <UserCircle className="h-5 w-5 text-white" />
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
                Een ervaren jurist staat klaar om uw vragen te beantwoorden en u te begeleiden bij uw juridische vraagstukken.
              </p>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setJuristDialogOpen(true);
                  setIsOpen(false);
                }}
                data-testid="button-ask-jurist-sidebar"
              >
                <UserCircle className="h-4 w-4 mr-2" />
                Stel uw vraag
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <h4 className="font-medium text-foreground mb-2 text-sm">Tips & Tricks</h4>
              <p className="text-xs text-muted-foreground">
                Binnenkort beschikbaar: handige tips om het meeste uit het platform te halen.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Button (Tab) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`hidden lg:flex fixed top-1/2 -translate-y-1/2 items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg transition-all duration-300 z-50 ${
          isOpen ? "right-[320px]" : "right-0"
        }`}
        style={{
          width: "40px",
          height: "80px",
          borderTopLeftRadius: "8px",
          borderBottomLeftRadius: "8px",
        }}
        data-testid="button-toggle-sidebar"
      >
        <ChevronLeft
          className={`h-5 w-5 transition-transform duration-300 ${
            isOpen ? "rotate-0" : "rotate-180"
          }`}
        />
      </button>

      {/* Backdrop - Only on large screens when sidebar is open */}
      {isOpen && (
        <div
          className="hidden lg:block fixed inset-0 bg-black/20 z-30"
          onClick={() => setIsOpen(false)}
          data-testid="sidebar-backdrop"
        />
      )}

      {/* Ask Jurist Dialog */}
      <AskJuristDialog
        open={juristDialogOpen}
        onOpenChange={setJuristDialogOpen}
        context="Help Sidebar"
      />
    </>
  );
}
