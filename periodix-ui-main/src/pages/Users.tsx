import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCcw, Shield, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusCard } from "@/components/StatusCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import {
  type Role,
  type UserRow,
  listUsers,
  createUser,
  updateUser,
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const roles: Role[] = ["ADMIN", "EDITOR", "VIEWER"];

function rolePill(role: Role) {
  const base = "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold";
  if (role === "ADMIN") return <span className={`${base} bg-primary/10 text-primary`}><Shield className="w-3 h-3" />ADMIN</span>;
  if (role === "EDITOR") return <span className={`${base} bg-secondary text-secondary-foreground`}>EDITOR</span>;
  return <span className={`${base} bg-muted text-muted-foreground`}>VIEWER</span>;
}

export default function UsersPage() {
  const { toast } = useToast();
  const { authUser, isAdmin } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "VIEWER" as Role,
  });

  const canUse = isAdmin();

  const meId = authUser?.id;

  const sortedUsers = useMemo(() => {
    const arr = [...users];
    // active first, then role priority, then name
    const roleScore = (r: Role) => (r === "ADMIN" ? 0 : r === "EDITOR" ? 1 : 2);
    arr.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (roleScore(a.role) !== roleScore(b.role)) return roleScore(a.role) - roleScore(b.role);
      return (a.name || a.email).localeCompare(b.name || b.email);
    });
    return arr;
  }, [users]);

  async function load() {
    setLoading(true);
    const res = await listUsers();
    setLoading(false);

    if (res.error) {
      toast({
        title: "Failed to load users",
        description: res.error,
        variant: "destructive",
      });
      return;
    }

    setUsers(res.data || []);
  }

  useEffect(() => {
    if (!canUse) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await createUser({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
    });

    setLoading(false);

    if (res.error || !res.data) {
      toast({
        title: "Failed to create user",
        description: res.error || "Unknown error",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "User created" });
    setUsers([res.data, ...users]);

    setForm({ name: "", email: "", password: "", role: "VIEWER" });
  };

  const setRole = async (u: UserRow, role: Role) => {
    setLoading(true);
    const res = await updateUser(u.id, { role });
    setLoading(false);

    if (res.error || !res.data) {
      toast({ title: "Update failed", description: res.error || "Unknown error", variant: "destructive" });
      return;
    }

    toast({ title: "Role updated" });
    setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data! : x)));
  };

  const toggleActive = async (u: UserRow) => {
    // backend already blocks disabling self
    setLoading(true);
    const res = await updateUser(u.id, { isActive: !u.isActive });
    setLoading(false);

    if (res.error || !res.data) {
      toast({ title: "Update failed", description: res.error || "Unknown error", variant: "destructive" });
      return;
    }

    toast({ title: u.isActive ? "User deactivated" : "User activated" });
    setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data! : x)));
  };

  const resetPassword = async (u: UserRow) => {
    const pwd = prompt(`Enter a new password for ${u.email}`);
    if (!pwd) return;

    setLoading(true);
    const res = await updateUser(u.id, { password: pwd });
    setLoading(false);

    if (res.error) {
      toast({ title: "Password reset failed", description: res.error, variant: "destructive" });
      return;
    }

    toast({ title: "Password updated" });
  };

  if (!canUse) {
    return (
      <div className="max-w-3xl">
        <div className="page-header">
          <h1 className="page-title">Users</h1>
          <p className="page-description">Admin-only user management</p>
        </div>

        <div className="card-soft p-6 text-sm text-muted-foreground">
          You don’t have access to this page.
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="page-header">
        <h1 className="page-title">Users</h1>
        <p className="page-description">Create users and manage roles (Admin only)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusCard title="Create User" icon={<Plus className="w-4 h-4" />}>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@college.com"
                type="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Set a password"
                type="password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : "Create user"}
            </Button>

            <div className="text-xs text-muted-foreground">
              Tip: Only <span className="font-mono">ADMIN</span> can create and manage users.
            </div>
          </form>
        </StatusCard>

        <StatusCard title="All Users" icon={<UserCog className="w-4 h-4" />}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">
              {users.length} user{users.length === 1 ? "" : "s"}
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </Button>
          </div>

          <div className="space-y-3">
            {sortedUsers.map((u) => (
              <div key={u.id} className="card-soft p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {u.name}{" "}
                      {u.id === meId ? <span className="text-xs text-muted-foreground">(you)</span> : null}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{u.email}</div>
                    <div className="mt-2 flex items-center gap-2">
                      {rolePill(u.role)}
                      {!u.isActive ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive">
                          INACTIVE
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700">
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    <Select
                      value={u.role}
                      onValueChange={(v) => setRole(u, v as Role)}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loading || (u.id === meId && u.isActive)}
                        onClick={() => toggleActive(u)}
                      >
                        {u.isActive ? "Deactivate" : "Activate"}
                      </Button>

                      <Button variant="outline" size="sm" disabled={loading} onClick={() => resetPassword(u)}>
                        Reset PW
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {sortedUsers.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No users found.
              </div>
            )}
          </div>
        </StatusCard>
      </div>
    </div>
  );
}
