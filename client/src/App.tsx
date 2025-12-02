import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { CaseProvider } from "@/contexts/CaseContext";
import Layout from "@/components/Layout";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import KantonrechtInfo from "@/pages/KantonrechtInfo";
import Dashboard from "@/pages/Dashboard";
import MyCase from "@/pages/MyCase";
import CaseDetails from "@/pages/CaseDetails";
import Analysis from "@/pages/Analysis";
import FullAnalysis from "@/pages/FullAnalysis";
import JuridischeAnalyseDetails from "@/pages/JuridischeAnalyseDetails";
import VolledigeAnalyseDetails from "@/pages/VolledigeAnalyseDetails";
import Letters from "@/pages/Letters";
import SummonsEditor from "@/pages/SummonsEditor";
import Help from "@/pages/Help";
import NewCase from "@/pages/NewCase";
import EditCase from "@/pages/EditCase";
import AllCases from "@/pages/AllCases";
import StepView from "@/pages/StepView";
import Warranty from "@/pages/Warranty";
import Dossier from "@/pages/Dossier";
import Chat from "@/pages/Chat";
import QnA from "@/pages/QnA";
import Inbox from "@/pages/Inbox";
import ResolvePage from "@/pages/ResolvePage";
import InvitationAccept from "@/pages/InvitationAccept";
import Jurisprudentie from "@/pages/Jurisprudentie";
import Wetgeving from "@/pages/Wetgeving";
import Updates from "@/pages/Updates";
import RequireAuth from "@/components/RequireAuth";

// Protected route definitions
const protectedRoutes = [
  { path: "/cases", component: AllCases },
  { path: "/dashboard", component: Dashboard },
  { path: "/my-case", component: MyCase },
  { path: "/case-details", component: CaseDetails },
  { path: "/analysis", component: Analysis },
  { path: "/analyse-details", component: JuridischeAnalyseDetails },
  { path: "/volledige-analyse", component: VolledigeAnalyseDetails },
  { path: "/jurisprudentie", component: Jurisprudentie },
  { path: "/wetgeving", component: Wetgeving },
  { path: "/analysis/:id/full", component: FullAnalysis },
  { path: "/letters", component: Letters },
  // { path: "/resolve", component: ResolvePage }, // Temporarily hidden
  { path: "/summons", component: SummonsEditor },
  { path: "/dossier", component: Dossier },
  { path: "/chat", component: Chat },
  { path: "/qna", component: QnA },
  { path: "/inbox", component: Inbox },
  { path: "/edit-case/:id", component: EditCase },
  { path: "/step/:stepId", component: StepView },
  { path: "/warranty", component: Warranty },
  { path: "/help", component: Help },
  { path: "/new-case", component: NewCase },
  { path: "/updates", component: Updates },
];

function ProtectedRoute({ 
  component: Component, 
  isAuthenticated 
}: { 
  component: React.ComponentType;
  isAuthenticated: boolean;
}) {
  if (!isAuthenticated) {
    return <RequireAuth />;
  }
  
  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/kantonrecht-info" component={KantonrechtInfo} />
      <Route path="/invitation/:code" component={InvitationAccept} />
      
      {isAuthenticated ? (
        <Layout>
          {protectedRoutes.map(({ path, component }) => (
            <Route key={path} path={path} component={component} />
          ))}
        </Layout>
      ) : (
        <>
          {protectedRoutes.map(({ path, component }) => (
            <Route 
              key={path} 
              path={path} 
              component={() => <ProtectedRoute component={component} isAuthenticated={isAuthenticated} />} 
            />
          ))}
        </>
      )}
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CaseProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </CaseProvider>
    </QueryClientProvider>
  );
}

export default App;
