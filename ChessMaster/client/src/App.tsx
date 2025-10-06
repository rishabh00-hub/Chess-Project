import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Leaderboard from "@/pages/Leaderboard";
import Play from "@/pages/Play";
import Game from "@/pages/Game";
import Stats from "@/pages/Stats";
import Tutorial from "@/pages/Tutorial";
import BottomNavigation from "@/components/BottomNavigation";
import FloatingActionButton from "@/components/FloatingActionButton";

function Router() {
  // Temporarily bypass authentication for UI demonstration
  const isAuthenticated = true;
  const isLoading = false;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-md mx-auto bg-slate-900 min-h-screen relative">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/play" component={Play} />
          <Route path="/game/:id" component={Game} />
          <Route path="/stats" component={Stats} />
          <Route path="/tutorial" component={Tutorial} />
          <Route component={NotFound} />
        </Switch>
        <BottomNavigation />
        <FloatingActionButton />
      </div>
    </div>
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
