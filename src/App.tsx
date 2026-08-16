import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useLocation } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BladeWipe } from "@/components/BladeWipe";
import { AppRouter } from "@/routes/router";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

// El overlay de caster (/broadcast/:canal/overlay) se usa como Browser Source
// en OBS: debe renderizar SIN navbar/footer y con fondo transparente para
// superponerse a la captura del juego.
const Shell = () => {
  const { pathname } = useLocation();
  const bareOverlay = /^\/broadcast\/[^/]+\/overlay/.test(pathname);
  if (bareOverlay) return <AppRouter />;
  return (
    <div className="min-h-screen flex flex-col bg-[#050505]">
      <Navbar />
      <main className="flex-grow">
        <AppRouter />
      </main>
      <Footer />
      <BladeWipe />
    </div>
  );
};

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
