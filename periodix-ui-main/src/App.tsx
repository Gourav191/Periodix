// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import RequireAuth from "./components/RequireAuth";
import Login from "./pages/Login";

import { AppLayout } from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Batches from "./pages/Batches";
import FacultyPage from "./pages/Faculty";
import SemesterSetup from "./pages/SemesterSetup";
import Assignments from "./pages/Assignments";
import Generate from "./pages/Generate";
import TimetableViewer from "./pages/TimetableViewer";
import UsersPage from "./pages/Users";
import NotFound from "./pages/NotFound";

// (later) Admin pages
// import UsersPage from "./pages/Users";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected Layout */}
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/batches" element={<Batches />} />
            <Route path="/faculty" element={<FacultyPage />} />
            <Route path="/semester-setup" element={<SemesterSetup />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/generate" element={<Generate />} />
            <Route path="/timetable" element={<TimetableViewer />} />

            {/* Admin-only*/}
            <Route path="/users" element={<UsersPage />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/batches" element={<Batches />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
