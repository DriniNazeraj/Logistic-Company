import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody } from "@/components/layout-primitives";
import { formatMoney, convertTotals, loadExchangeRates, type Currency } from "@/lib/format";
import { Truck, Package, Warehouse as WarehouseIcon, ArrowUpRight, MapPin, Shield, Clock, Phone, Mail, ChevronDown, Menu, X } from "lucide-react";
import { autoTransitPendingCargos } from "@/lib/auto-transit";
import { useTranslation } from "react-i18next";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { SkeletonStatsCard, SkeletonChart } from "@/components/skeleton";
import heroShip from "@/assets/hero-ship.png";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Transport Square — Cargo Shipping USA to Albania" },
      { name: "description", content: "Reliable cargo shipping from USA to Albania. Track packages, warehouse storage, and door-to-door delivery." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </div>
    );
  }

  if (user) return <Dashboard />;
  return <LandingPage />;
}

/* ============================================================
   LANDING PAGE
   ============================================================ */

function LandingPage() {
  const [mobileNav, setMobileNav] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const stats = [
    { value: "99%", label: "On-Time Delivery Rate" },
    { value: "92%", label: "Customer Satisfaction" },
    { value: "87%", label: "Cargo Safety Rate" },
    { value: "93%", label: "Client Retention Rate" },
  ];

  const services = [
    { icon: "plane", title: "Air Freight", desc: "Fast and secure air freight from USA to Albania, ensuring your goods arrive on time." },
    { icon: "express", title: "Express Shipping", desc: "Priority express shipping for urgent packages with real-time tracking." },
    { icon: "truck", title: "Door-to-Door", desc: "Complete door-to-door delivery service from any US address to Albania." },
    { icon: "warehouse", title: "Warehousing", desc: "Secure warehouse storage with organized sections and real-time inventory management." },
    { icon: "customs", title: "Custom Clearance", desc: "Expert handling of customs procedures for smooth and hassle-free import to Albania." },
    { icon: "shield", title: "Cargo Insurance", desc: "Comprehensive cargo insurance to protect your goods against any unforeseen risks." },
  ];

  const features = [
    { title: "Reliability", desc: "Our commitment to on-time deliveries ensures your packages arrive without delays." },
    { title: "Real-Time Tracking", desc: "Track every package with a unique QR code from warehouse to doorstep." },
    { title: "Secure Handling", desc: "Your cargo is handled with care, stored securely, and delivered safely." },
  ];

  const faqs = [
    { q: "What shipping services do you offer?", a: "We provide comprehensive cargo shipping from USA to Albania, including air freight, express shipping, door-to-door delivery, warehousing, customs clearance, and cargo insurance." },
    { q: "How do I track my package?", a: "Each package receives a unique tracking link and QR code. Simply open the link or scan the QR code to see your package status, location in our warehouse, and estimated delivery date." },
    { q: "How long does shipping take?", a: "Standard shipping from USA to Albania typically takes 10-15 business days. Express shipping is available for 5-7 business days delivery." },
    { q: "How can I contact you?", a: "You can reach us by phone or email. Our contact details are in the Contact section below. We're available Monday through Saturday." },
  ];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileNav(false);
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Transport Square" className="h-10 w-10" />
            <span className="text-xl font-bold tracking-tight">Transport Square</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            {["Services", "Why Us", "FAQ"].map((item) => (
              <button key={item} onClick={() => scrollTo(item.toLowerCase().replace(" ", "-"))} className="text-sm text-neutral-600 transition-colors hover:text-neutral-900">
                {item}
              </button>
            ))}
            <button onClick={() => scrollTo("contact")} className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800">
              Contact Us
            </button>
          </div>
          <button className="md:hidden" onClick={() => setMobileNav(!mobileNav)}>
            {mobileNav ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {mobileNav && (
          <div className="border-t border-neutral-200 bg-white px-6 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              {["Services", "Why Us", "FAQ"].map((item) => (
                <button key={item} onClick={() => scrollTo(item.toLowerCase().replace(" ", "-"))} className="text-left text-sm text-neutral-600 hover:text-neutral-900">
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden bg-neutral-100">
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-32">
          <img src={heroShip} alt="" className="pointer-events-none absolute right-0 top-1/2 w-[55%] max-w-2xl -translate-y-1/2 object-contain opacity-20 md:opacity-30" />
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Cargo Shipping<br />
              From USA to<br />
              <span className="text-neutral-500">Albania</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-neutral-600">
              Transport Square offers reliable cargo shipping services from the United States to Albania. Fast, secure, and cost-effective deliveries tailored to your needs.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => scrollTo("contact")} className="rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800">
                Get in Touch
              </button>
              <button onClick={() => scrollTo("services")} className="rounded-md border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50">
                Our Services
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* WHO WE ARE + STATS */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Who We Are</div>
            <p className="mt-4 text-2xl font-medium leading-relaxed text-neutral-800 md:text-3xl">
              We are a trusted freight and logistics company, delivering timely, secure, and cost-effective shipping solutions from USA to Albania.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold tracking-tight md:text-4xl">{s.value}</div>
                <div className="mt-1 text-sm text-neutral-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="bg-neutral-50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Our Services</div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Reliable solutions to<br />streamline your shipping
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.title} className="rounded-xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100">
                  {s.icon === "plane" && <Package className="h-5 w-5 text-neutral-700" />}
                  {s.icon === "express" && <Clock className="h-5 w-5 text-neutral-700" />}
                  {s.icon === "truck" && <Truck className="h-5 w-5 text-neutral-700" />}
                  {s.icon === "warehouse" && <WarehouseIcon className="h-5 w-5 text-neutral-700" />}
                  {s.icon === "customs" && <MapPin className="h-5 w-5 text-neutral-700" />}
                  {s.icon === "shield" && <Shield className="h-5 w-5 text-neutral-700" />}
                </div>
                <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section id="why-us" className="bg-neutral-900 py-16 text-white md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Why Clients Trust<br />Transport Square
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-neutral-700 bg-neutral-800 p-6">
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Frequently Asked<br />Questions
            </h2>
            <p className="mt-4 text-neutral-600">
              Find answers to common questions about our shipping services and how Transport Square can help.
            </p>
          </div>
          <div className="divide-y divide-neutral-200">
            {faqs.map((faq, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between py-5 text-left"
                >
                  <span className="pr-4 text-sm font-semibold">{faq.q}</span>
                  <ChevronDown className={"h-4 w-4 shrink-0 text-neutral-400 transition-transform " + (openFaq === i ? "rotate-180" : "")} />
                </button>
                {openFaq === i && (
                  <p className="pb-5 text-sm leading-relaxed text-neutral-600">{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT CTA */}
      <section id="contact" className="bg-neutral-900 py-12 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Ready to ship with Transport Square?</h2>
            <p className="mt-2 text-neutral-400">Get in touch with us for a quote or any questions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="tel:" className="flex items-center gap-2 rounded-md border border-neutral-600 px-5 py-3 text-sm font-medium transition-colors hover:bg-neutral-800">
              <Phone className="h-4 w-4" /> Call Us
            </a>
            <a href="mailto:" className="flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100">
              <Mail className="h-4 w-4" /> Email Us
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-neutral-200 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div>
            <div className="flex items-center gap-2">
              <img src={logo} alt="Transport Square" className="h-9 w-9" />
              <span className="text-lg font-bold tracking-tight">Transport Square</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">Reliable cargo shipping from USA to Albania.</p>
          </div>
          <div className="flex items-center gap-6 text-sm text-neutral-500">
            <button onClick={() => scrollTo("services")} className="hover:text-neutral-900">Services</button>
            <button onClick={() => scrollTo("faq")} className="hover:text-neutral-900">FAQ</button>
            <button onClick={() => scrollTo("contact")} className="hover:text-neutral-900">Contact</button>
            <Link to="/login" className="text-neutral-400 transition-colors hover:text-neutral-600">Admin</Link>
          </div>
        </div>
        <div className="mx-auto mt-6 max-w-6xl px-6 text-center text-xs text-neutral-400">
          &copy; {new Date().getFullYear()} Transport Square. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

/* ============================================================
   DASHBOARD (shown when logged in)
   ============================================================ */

interface Stats {
  cargos: number;
  inTransit: number;
  packages: number;
  warehouses: number;
  totalsByCurrency: Record<string, number>;
  cargoByStatus: { name: string; value: number }[];
  packagesByDay: { day: string; count: number }[];
}

const PIE_COLORS = ["#f59e0b", "#3b82f6", "#10b981"];

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const overviewCurrency = (localStorage.getItem("overview_currency") as Currency) || "USD";
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (!user) return;
    (async () => {
      await autoTransitPendingCargos();
      const [counts, pkgs, allCargos, allPkgs] = await Promise.all([
        api.cargos.stats(),
        api.packages.listSummary(),
        api.cargos.list(),
        api.packages.list(),
      ]);
      const totalsByCurrency: Record<string, number> = {};
      pkgs.forEach((x: any) => {
        const cur = x.currency ?? "EUR";
        totalsByCurrency[cur] = (totalsByCurrency[cur] ?? 0) + Number(x.price ?? 0);
      });

      const statusCounts: Record<string, number> = { pending: 0, in_transit: 0, delivered: 0 };
      allCargos.forEach((r: any) => {
        const s = r.status;
        statusCounts[s] = (statusCounts[s] ?? 0) + 1;
      });
      const cargoByStatus = [
        { name: t("overview.pending"), value: statusCounts.pending },
        { name: t("overview.inTransitStatus"), value: statusCounts.in_transit },
        { name: t("overview.delivered"), value: statusCounts.delivered },
      ].filter((d) => d.value > 0);

      const today = new Date();
      const days: { day: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push({ day: d.toLocaleDateString(i18n.language === "sq" ? "sq-AL" : "en-US", { weekday: "short" }), count: 0 });
      }
      allPkgs.forEach((r: any) => {
        const created = new Date(r.created_at);
        const diff = Math.floor((today.getTime() - created.getTime()) / 86400000);
        if (diff >= 0 && diff < 7) {
          days[6 - diff].count += 1;
        }
      });

      setStats({
        cargos: counts.total,
        inTransit: counts.inTransit,
        packages: pkgs.length,
        warehouses: counts.warehouses,
        totalsByCurrency,
        cargoByStatus,
        packagesByDay: days,
      });
    })();
  }, [user]);

  if (!user) return null;

  if (!stats) {
    return (
      <>
        <PageHeader title={t("overview.title")} description={t("overview.description")} />
        <PageBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStatsCard key={i} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </PageBody>
      </>
    );
  }

  const cards = [
    { label: t("overview.totalCargos"), value: stats?.cargos ?? "—", to: "/cargo", icon: Truck },
    { label: t("overview.inTransit"), value: stats?.inTransit ?? "—", to: "/cargo", icon: ArrowUpRight, accent: true },
    { label: t("overview.packages"), value: stats?.packages ?? "—", to: "/package", icon: Package },
    { label: t("overview.warehouses"), value: stats?.warehouses ?? "—", to: "/warehouse", icon: WarehouseIcon },
  ];

  return (
    <>
      <PageHeader
        title={t("overview.title")}
        description={t("overview.description")}
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/30"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </div>
                <c.icon className={"h-4 w-4 " + (c.accent ? "text-accent" : "text-muted-foreground")} />
              </div>
              <div className="mt-3 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
                {c.value}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("overview.packagesLast7Days")}
            </div>
            {stats && stats.packagesByDay.length > 0 ? (
              <div className="mt-4 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.packagesByDay} barSize={28}>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "var(--foreground)" }}
                      itemStyle={{ color: "var(--foreground)" }}
                      cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
                    />
                    <Bar dataKey="count" name={t("overview.packages")} fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-4 flex h-52 items-center justify-center text-sm text-muted-foreground">{t("overview.noData")}</div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("overview.cargoStatusBreakdown")}
            </div>
            {stats && stats.cargoByStatus.length > 0 ? (
              <div className="mt-4 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.cargoByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {stats.cargoByStatus.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: "var(--foreground)" }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span style={{ color: "var(--foreground)", fontSize: 12 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-4 flex h-52 items-center justify-center text-sm text-muted-foreground">{t("overview.noCargosYet")}</div>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("overview.totalPackageValue")}
            </div>
            {stats && Object.keys(stats.totalsByCurrency).length > 0 ? (
              <>
                <div className="mt-3 border-b border-border pb-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {t("common.total")} ({overviewCurrency})
                  </div>
                  <div className="font-mono text-2xl font-semibold tracking-tight sm:text-4xl">
                    {formatMoney(convertTotals(stats.totalsByCurrency, overviewCurrency), overviewCurrency)}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                  {["EUR", "USD", "ALL"]
                    .filter((c) => stats.totalsByCurrency[c])
                    .map((c) => (
                      <div key={c}>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {c}
                        </div>
                        <div className="font-mono text-lg font-semibold tracking-tight text-muted-foreground sm:text-2xl">
                          {formatMoney(stats.totalsByCurrency[c], c)}
                        </div>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-muted-foreground sm:text-4xl">
                —
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("overview.quickActions")}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                to="/cargo"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-muted-foreground/40"
              >
                {t("overview.newCargo")}
              </Link>
              <Link
                to="/package"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-muted-foreground/40"
              >
                {t("overview.newPackage")}
              </Link>
              <Link
                to="/warehouse"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-muted-foreground/40"
              >
                {t("overview.designWarehouse")}
              </Link>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
