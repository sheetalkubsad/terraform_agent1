import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppNav } from "@/components/platform/AppNav";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Console from "./pages/Console";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import AccountSelection from "./pages/AccountSelection";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Landing and Authentication - No AppNav */}
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account-selection" element={<AccountSelection />} />
          
          {/* App Pages - With AppNav */}
          <Route 
            path="/" 
            element={
              <div className="h-screen overflow-hidden flex flex-col bg-background">
                <AppNav />
                <main className="flex-1 min-h-0 overflow-hidden">
                  <Index />
                </main>
              </div>
            } 
          />
          <Route 
            path="/console" 
            element={
              <div className="h-screen overflow-hidden flex flex-col bg-background">
                <AppNav />
                <main className="flex-1 min-h-0 overflow-hidden">
                  <Console />
                </main>
              </div>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <div className="h-screen overflow-hidden flex flex-col bg-background">
                <AppNav />
                <main className="flex-1 min-h-0 overflow-hidden">
                  <AdminDashboard />
                </main>
              </div>
            } 
          />
          
          {/* 404 Page */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
