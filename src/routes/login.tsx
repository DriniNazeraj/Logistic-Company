import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Identifikohu — trans.square.al" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email, password);
      toast.success(t("login.welcomeBack"));
      navigate({ to: "/" });
    } catch (err) {
      toast.error((err as Error).message ?? t("login.authFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-border bg-sidebar lg:block">
        <div className="grid-bg absolute inset-0 opacity-40" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
              <Truck className="h-4 w-4" />
            </div>
            <span className="font-mono text-sm font-semibold">trans.square.al</span>
          </div>
          <div className="space-y-3">
            <h2 className="max-w-sm text-3xl font-semibold tracking-tight text-balance">
              {t("login.sidebarHeading")}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("login.sidebarDescription")}
            </p>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {t("login.sidebarCities")}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("login.heading")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("login.accessDashboard")}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("login.emailLabel")}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none ring-ring/50 focus:border-ring focus:ring-2"
                placeholder="manager@trans.square.al"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("login.passwordLabel")}</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none ring-ring/50 focus:border-ring focus:ring-2"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t("login.pleaseWait") : t("login.signInButton")}
            </button>
          </form>


          <div className="mt-10 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              {t("login.backLink")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
