import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RIcon } from "@/components/RIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Scale, MoreVertical, HelpCircle, LogOut, User, PlusCircle, ArrowLeft, Shield, FileText, FileSearch, Mail, Palette, Briefcase, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useActiveCase } from "@/contexts/CaseContext";
import { AskJuristDialog } from "@/components/AskJuristDialog";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const currentCase = useActiveCase();
  const [juristDialogOpen, setJuristDialogOpen] = useState(false);
  const [boldBrightTheme, setBoldBrightTheme] = useState(() => {
    const saved = localStorage.getItem('bold-bright-theme');
    return saved === 'true';
  });

  useEffect(() => {
    if (boldBrightTheme) {
      document.documentElement.classList.add('bold-bright-theme');
      localStorage.setItem('bold-bright-theme', 'true');
    } else {
      document.documentElement.classList.remove('bold-bright-theme');
      localStorage.setItem('bold-bright-theme', 'false');
    }
  }, [boldBrightTheme]);

  // Helper function to check if current location matches a menu item and its sub-pages
  const isActiveRoute = (mainRoute: string, subRoutes: string[] = []) => {
    if (location === mainRoute) return true;
    // Check exact matches
    if (subRoutes.some(subRoute => location === subRoute)) return true;
    // Check if location starts with any of the base routes (for dynamic routes like /analysis/:id/full)
    return subRoutes.some(subRoute => {
      if (subRoute.includes(':')) {
        // Handle dynamic routes by checking prefix
        const baseRoute = subRoute.split('/:')[0];
        return location.startsWith(baseRoute + '/');
      }
      return false;
    });
  };

  const getUserInitials = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const getUserDisplayName = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.email || "Gebruiker";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 sm:gap-8 min-w-0 flex-1">
              <Link href="/cases" className="flex items-center gap-2 min-w-0" data-testid="link-home">
                <RIcon size="md" className="flex-shrink-0" />
                <span className="text-xl font-semibold text-foreground hidden sm:inline">Rechtstreeks.ai</span>
              </Link>
              
              {currentCase && (
                <Link 
                  href="/dashboard" 
                  className={`hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                    boldBrightTheme 
                      ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-950/40'
                      : 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900/40'
                  }`}
                  data-testid="link-dashboard"
                >
                  <Briefcase className={`h-4 w-4 ${
                    boldBrightTheme 
                      ? 'text-teal-700 dark:text-teal-300' 
                      : 'text-blue-700 dark:text-blue-300'
                  }`} />
                  <span className={`text-sm font-medium max-w-[200px] truncate ${
                    boldBrightTheme 
                      ? 'text-teal-900 dark:text-teal-100' 
                      : 'text-blue-900 dark:text-blue-100'
                  }`} data-testid="text-selected-case">
                    {currentCase.title}
                  </span>
                </Link>
              )}
              
              <nav className="hidden md:flex items-center space-x-6">
                <Link 
                  href="/my-case" 
                  className={`font-medium transition-colors ${
                    isActiveRoute('/my-case', ['/case-details']) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="link-my-case"
                >
                  Mijn Zaak
                </Link>
                <Link 
                  href="/analysis" 
                  className={`font-medium transition-colors relative flex items-center gap-2 ${
                    isActiveRoute('/analysis', ['/volledige-analyse', '/analyse-details', '/analysis/:id/full']) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="link-analysis"
                >
                  Analyse
                  {currentCase?.needsReanalysis && (
                    <Badge className="text-xs px-1.5 py-0 bg-blue-500 hover:bg-blue-600 text-white">
                      Nieuw
                    </Badge>
                  )}
                </Link>
                <Link 
                  href="/letters" 
                  className={`font-medium transition-colors ${
                    isActiveRoute('/letters') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="link-letters"
                >
                  Brieven
                </Link>
                <Link 
                  href="/summons" 
                  className={`font-medium transition-colors ${
                    isActiveRoute('/summons') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="link-summons"
                >
                  Dagvaarding
                </Link>
                <div className="h-6 w-px bg-border" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className={`font-medium transition-colors relative flex items-center gap-2 ${
                        isActiveRoute('/chat', ['/qna']) || location === '/qna' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      data-testid="button-help-menu"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Help
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem asChild>
                      <Link href="/chat" data-testid="link-chat-submenu">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Chat
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/qna" data-testid="link-qna-submenu">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Q&A
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setJuristDialogOpen(true)} 
                      data-testid="link-expert-submenu"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Jurist vragen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </nav>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
              {/* Theme Toggle Button */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setBoldBrightTheme(!boldBrightTheme)}
                data-testid="button-theme-toggle"
                title={boldBrightTheme ? "Schakel over naar standaard theme" : "Schakel over naar Bold & Bright theme"}
                className="px-2 sm:px-3"
              >
                <Palette className={`h-4 w-4 ${boldBrightTheme ? 'text-primary' : 'text-muted-foreground'}`} />
              </Button>
              
              {/* Overflow menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="button-overflow-menu" className="px-2 sm:px-3">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/" data-testid="link-all-cases-mobile">
                      <Briefcase className="mr-2 h-4 w-4" />
                      Alle zaken
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/my-case" data-testid="link-my-case-mobile">
                      <Scale className="mr-2 h-4 w-4" />
                      Mijn Zaak
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/analysis" data-testid="link-analysis-mobile" className="flex items-center justify-between w-full">
                      <div className="flex items-center">
                        <FileSearch className="mr-2 h-4 w-4" />
                        Analyse
                      </div>
                      {currentCase?.needsReanalysis && (
                        <Badge className="text-xs px-1.5 py-0 bg-blue-500 hover:bg-blue-600 text-white ml-2">
                          Nieuw
                        </Badge>
                      )}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/chat" data-testid="link-chat-mobile">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Chat
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/qna" data-testid="link-qna-mobile">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Q&A
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/letters" data-testid="link-letters-mobile">
                      <Mail className="mr-2 h-4 w-4" />
                      Brieven
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/summons" data-testid="link-summons-mobile">
                      <FileText className="mr-2 h-4 w-4" />
                      Dagvaarding
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" data-testid="link-profile-mobile">
                      <User className="mr-2 h-4 w-4" />
                      Mijn Profiel
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/new-case" data-testid="link-new-case">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Nieuwe zaak aanmaken
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {user && (
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-sm text-muted-foreground hidden lg:block" data-testid="text-username">
                    {getUserDisplayName(user)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="p-0 h-8 w-8" data-testid="button-user-menu">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.profileImageUrl} alt={getUserDisplayName(user)} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getUserInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled>
                        <User className="mr-2 h-4 w-4" />
                        Profiel
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href="/api/logout" data-testid="link-logout">
                          <LogOut className="mr-2 h-4 w-4" />
                          Uitloggen
                        </a>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Ask Jurist Dialog */}
      <AskJuristDialog 
        open={juristDialogOpen} 
        onOpenChange={setJuristDialogOpen}
        context="Help Menu"
      />
    </div>
  );
}
