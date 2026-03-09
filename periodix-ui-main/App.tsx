import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Batches from "./pages/Batches";
import FacultyPage from "./pages/Faculty";
import SemesterSetup from "./pages/SemesterSetup";
import Assignments from "./pages/Assignments";
import Generate from "./pages/Generate";
import TimetableViewer from "./pages/TimetableViewer";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/batches" element={<Batches />} />
            <Route path="/faculty" element={<FacultyPage />} />
            <Route path="/semester-setup" element={<SemesterSetup />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/generate" element={<Generate />} />
            <Route path="/timetable" element={<TimetableViewer />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
