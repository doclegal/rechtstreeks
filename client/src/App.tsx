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
import Analysis from "@/pages/Analysis";
import FullAnalysis from "@/pages/FullAnalysis";
import Letters from "@/pages/Letters";
import Summons from "@/pages/Summons";
import Help from "@/pages/Help";
import NewCase from "@/pages/NewCase";
import EditCase from "@/pages/EditCase";
import AllCases from "@/pages/AllCases";
import StepView from "@/pages/StepView";
import Warranty from "@/pages/Warranty";

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
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <Layout>
          <Route path="/" component={Dashboard} />
          <Route path="/my-case" component={MyCase} />
          <Route path="/analysis" component={Analysis} />
          <Route path="/analysis/:id/full" component={FullAnalysis} />
          <Route path="/letters" component={Letters} />
          <Route path="/summons" component={Summons} />
          <Route path="/edit-case/:id" component={EditCase} />
          <Route path="/step/:stepId" component={StepView} />
          <Route path="/warranty" component={Warranty} />
          <Route path="/help" component={Help} />
          <Route path="/new-case" component={NewCase} />
          <Route path="/all-cases" component={AllCases} />
        </Layout>
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
