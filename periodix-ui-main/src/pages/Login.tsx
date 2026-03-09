import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { login, setAuthToken } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setAuthUser } = useAppStore();

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const res = await login(form.email, form.password);

    if (res.error || !res.data) {
      toast({
        title: "Login failed",
        description: res.error || "Invalid credentials",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    setAuthToken(res.data.token);
    setAuthUser(res.data.user);

    toast({ title: "Welcome to Periodix" });
    navigate("/", { replace: true });
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md card-soft p-8">
        {/* Logo + Branding */}
        <div className="flex flex-col items-center mb-6">
          <img
            src="/Periodix.png"
            alt="Periodix"
            className="w-14 h-14 rounded-xl mb-3"
          />
          <h1 className="text-2xl font-semibold">Periodix</h1>
          <p className="text-sm text-muted-foreground">
            Generate Once. Get It Right.
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="admin@periodix.com"
              type="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              type="password"
              required
            />
          </div>

          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
