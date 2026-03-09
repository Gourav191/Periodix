import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Link2,
  Zap,
  Calendar,
  Menu,
  LogOut,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAppStore } from "@/lib/store";
import { getBatches, getDepartments, getFaculty } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

/* --------------------
   Base navigation (shared)
-------------------- */
const baseNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/batches", label: "Batches", icon: GraduationCap },
  { to: "/faculty", label: "Faculty", icon: Users },
  { to: "/semester-setup", label: "Semester Setup", icon: BookOpen },
  { to: "/assignments", label: "Assignments", icon: Link2 },
  { to: "/generate", label: "Generate", icon: Zap },
  { to: "/timetable", label: "Timetable Viewer", icon: Calendar },
];

/* --------------------
   Role badge
-------------------- */
function roleBadge(role?: string) {
  const base =
    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold";

  if (role === "ADMIN")
    return (
      <span className={`${base} bg-primary/10 text-primary`}>
        <Shield className="w-3 h-3" />
        ADMIN
      </span>
    );

  if (role === "EDITOR")
    return (
      <span className={`${base} bg-secondary text-secondary-foreground`}>
        EDITOR
      </span>
    );

  return (
    <span className={`${base} bg-muted text-muted-foreground`}>
      VIEWER
    </span>
  );
}

/* --------------------
   Sidebar
-------------------- */
function SidebarContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { authUser, logout } = useAppStore();

  const userLabel = useMemo(() => {
    if (!authUser) return "";
    return authUser.name || authUser.email || "User";
  }, [authUser]);

  /* 🔐 Build nav dynamically (ADMIN gets Users) */
  const navItems = useMemo(() => {
    const items = [...baseNavItems];

    if (authUser?.role === "ADMIN") {
      items.splice(1, 0, {
        to: "/users",
        label: "Users",
        icon: Shield,
      });
    }

    return items;
  }, [authUser?.role]);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <img
            src="/Periodix.png"
            alt="Periodix"
            className="w-8 h-8 rounded-lg"
          />
          <div>
            <h1 className="font-semibold text-sidebar-foreground">Periodix</h1>
            <p className="text-xs text-muted-foreground">
              Generate Once. Get It Right.
            </p>
          </div>
        </div>

        {/* User + logout */}
        {authUser && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-sidebar-foreground truncate">
                {userLabel}
              </div>
              <div className="mt-1">{roleBadge(authUser.role)}</div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">
          Periodix v1.0
        </p>
      </div>
    </div>
  );
}

/* --------------------
   Layout
-------------------- */
export function AppLayout() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { setBatches, setDepartments , setFaculty } = useAppStore();

  // Global bootstrap
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const [deptRes, batchRes, facRes] = await Promise.all([
        getDepartments(),
        getBatches(),
        getFaculty()
      ]);

      if (cancelled) return;

      if (deptRes.data) setDepartments(deptRes.data);
      if (batchRes.data) setBatches(batchRes.data);
      if (facRes.data) setFaculty(facRes.data);
      if (deptRes.error || batchRes.error) {
        toast({
          title: "Could not load initial data",
          description:
            deptRes.error || batchRes.error ||  facRes.error ||"Backend not reachable",
          variant: "destructive",
        });
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [setBatches, setDepartments, setFaculty,toast]);

  return (
    <div className="min-h-screen flex w-full">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-sidebar border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile header + sidebar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-3 p-4 border-b border-border bg-card">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-60">
              <SidebarContent />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <img
              src="/Periodix.png"
              alt="Periodix"
              className="w-7 h-7 rounded-lg"
            />
            <span className="font-semibold text-foreground">Periodix</span>
          </div>
        </header>

        {/* Pages */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
