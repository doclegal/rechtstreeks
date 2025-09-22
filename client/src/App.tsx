import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import MyCase from "@/pages/MyCase";
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
          <Route path="/" component={MyCase} />
          <Route path="/my-case" component={MyCase} />
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
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
