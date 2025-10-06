import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Scale, MoreVertical, HelpCircle, LogOut, User, PlusCircle, ArrowLeft, Shield } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  const [location] = useLocation();

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
        <div className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center space-x-3" data-testid="link-home">
                <img 
                  src="/attached_assets/ChatGPT Image 6 okt 2025, 17_25_21_1759764379350.png" 
                  alt="Rechtstreeks AI" 
                  className="h-8"
                />
              </Link>
              <nav className="hidden md:flex items-center space-x-6">
                <Link 
                  href="/my-case" 
                  className={`font-medium transition-colors ${
                    location === '/my-case' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="link-my-case"
                >
                  Mijn Zaak
                </Link>
                <Link 
                  href="/analysis" 
                  className={`font-medium transition-colors ${
                    location === '/analysis' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="link-analysis"
                >
                  Analyse
                </Link>
                <Link 
                  href="/letters" 
                  className={`font-medium transition-colors ${
                    location === '/letters' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="link-letters"
                >
                  Brieven
                </Link>
                <Link 
                  href="/summons" 
                  className={`font-medium transition-colors ${
                    location === '/summons' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="link-summons"
                >
                  Dagvaarding
                </Link>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Overflow menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="button-overflow-menu">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/all-cases" data-testid="link-all-cases">
                      Alle zaken
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/new-case" data-testid="link-new-case">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Nieuwe zaak
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {user && (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-muted-foreground hidden sm:block" data-testid="text-username">
                    {getUserDisplayName(user)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="p-0" data-testid="button-user-menu">
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
    </div>
  );
}
