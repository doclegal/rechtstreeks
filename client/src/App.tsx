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
import Dashboard from "@/pages/Dashboard";
import MyCase from "@/pages/MyCase";
import CaseDetails from "@/pages/CaseDetails";
import Analysis from "@/pages/Analysis";
import FullAnalysis from "@/pages/FullAnalysis";
import JuridischeAnalyseDetails from "@/pages/JuridischeAnalyseDetails";
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
      
      {isAuthenticated ? (
        <Layout>
          <Route path="/cases" component={AllCases} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/my-case" component={MyCase} />
          <Route path="/case-details" component={CaseDetails} />
          <Route path="/analysis" component={Analysis} />
          <Route path="/analyse-details" component={JuridischeAnalyseDetails} />
          <Route path="/analysis/:id/full" component={FullAnalysis} />
          <Route path="/letters" component={Letters} />
          <Route path="/summons" component={SummonsEditor} />
          <Route path="/dossier" component={Dossier} />
          <Route path="/chat" component={Chat} />
          <Route path="/qna" component={QnA} />
          <Route path="/edit-case/:id" component={EditCase} />
          <Route path="/step/:stepId" component={StepView} />
          <Route path="/warranty" component={Warranty} />
          <Route path="/help" component={Help} />
          <Route path="/new-case" component={NewCase} />
        </Layout>
      ) : null}
      
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
