import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, formatDate } from "@/lib/format";
import { Package as PackageIcon, MapPin, Calendar, CreditCard, User, Phone, Mail, IdCard } from "lucide-react";

export const Route = createFileRoute("/track/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Track ${params.code} — trans.al` },
      { name: "description", content: "Track your package status." },
    ],
  }),
  component: TrackPage,
});

interface TrackPkg {
  id: string;
  package_code: string;
  product_name: string;
  price: number;
  currency: string;
  payment_status: string;
  amount_paid: number | null;
  amount_remaining: number | null;
  destination_location: string | null;
  delivery_date: string | null;
  arrival_date: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_id_number: string | null;
  image_url: string | null;
  cargo_id: string | null;
}

interface CargoInfo {
  cargo_code: string;
  departure_country: string;
  destination_country: string;
  status: string;
}

function TrackPage() {
  const { code } = Route.useParams();
  const [pkg, setPkg] = useState<TrackPkg | null>(null);
  const [cargo, setCargo] = useState<CargoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("package_code", code)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setPkg(data as TrackPkg);

      if (data.cargo_id) {
        const { data: c } = await supabase
          .from("cargos")
          .select("cargo_code, departure_country, destination_country, status")
          .eq("id", data.cargo_id)
          .maybeSingle();
        if (c) setCargo(c as CargoInfo);
      }

      setLoading(false);
    };
    load();
  }, [code]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  if (notFound || !pkg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <PackageIcon className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Package not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No package with code <span className="font-mono">{code}</span> was found.
          </p>
        </div>
      </div>
    );
  }

  const paymentLabel = { paid: "Paid", on_delivery: "Pay on delivery", partly: "Partly paid" }[pkg.payment_status] ?? pkg.payment_status;
  const statusColor = {
    pending: "bg-yellow-500/20 text-yellow-400",
    in_transit: "bg-blue-500/20 text-blue-400",
    delivered: "bg-green-500/20 text-green-400",
  }[cargo?.status ?? ""] ?? "bg-muted text-muted-foreground";

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-foreground text-background">
            <PackageIcon className="h-5 w-5" />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-foreground">Package Tracking</h1>
          <p className="font-mono text-sm text-muted-foreground">{pkg.package_code}</p>
        </div>

        {/* Product */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {pkg.image_url && (
            <div className="aspect-video overflow-hidden bg-secondary">
              <img src={pkg.image_url} alt={pkg.product_name} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="p-4">
            <h2 className="text-base font-semibold">{pkg.product_name}</h2>
            <div className="mt-1 text-lg font-mono font-medium">{formatMoney(pkg.price, pkg.currency)}</div>
          </div>
        </div>

        {/* Shipping */}
        {cargo && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Shipping</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{cargo.departure_country}</span>
                <span className="text-muted-foreground/50">→</span>
                <span>{cargo.destination_country}</span>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                {cargo.status === "in_transit" ? "In transit" : cargo.status.charAt(0).toUpperCase() + cargo.status.slice(1)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Destination</div>
                <div>{pkg.destination_location ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cargo</div>
                <div className="font-mono text-xs">{cargo.cargo_code}</div>
              </div>
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dates</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Delivery</div>
                <div>{formatDate(pkg.delivery_date)}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Arrival</div>
                <div>{formatDate(pkg.arrival_date)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Payment</h3>
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span>{paymentLabel}</span>
          </div>
          {pkg.payment_status === "partly" && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Paid</div>
                <div className="text-green-400">{formatMoney(pkg.amount_paid, pkg.currency)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Remaining</div>
                <div className="text-yellow-400">{formatMoney(pkg.amount_remaining, pkg.currency)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Client */}
        {pkg.client_name && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recipient</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{pkg.client_name}</span>
              </div>
              {pkg.client_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{pkg.client_phone}</span>
                </div>
              )}
              {pkg.client_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{pkg.client_email}</span>
                </div>
              )}
              {pkg.client_id_number && (
                <div className="flex items-center gap-2">
                  <IdCard className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-xs">{pkg.client_id_number}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-2 text-center text-xs text-muted-foreground">
          trans.al — Logistics Manager
        </div>
      </div>
    </div>
  );
}
