import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import { Package as PackageIcon, MapPin, Calendar, CreditCard, User, Phone, Mail, IdCard, ScanLine, CheckCircle2, XCircle, Camera, KeyboardIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/track/$code")({
  head: () => ({
    meta: [
      { title: "Gjurmo Paketen — trans.square.al" },
      { name: "description", content: "Gjurmoni statusin e paketes tuaj." },
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
  track_token: string;
  confirmed_at: string | null;
}

interface CargoInfo {
  cargo_code: string;
  departure_country: string;
  destination_country: string;
  status: string;
}

interface SectionInfo {
  section_name: string;
  warehouse_name: string | null;
}

function TrackPage() {
  const { code } = Route.useParams();
  const [pkg, setPkg] = useState<TrackPkg | null>(null);
  const [cargo, setCargo] = useState<CargoInfo | null>(null);
  const [section, setSection] = useState<SectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { t } = useTranslation();

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState<"success" | "mismatch" | "already" | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.packages.track(code);
        setPkg(data.package as TrackPkg);
        if (data.package.confirmed_at) {
          setConfirmedAt(data.package.confirmed_at);
          setScanResult("already");
        }
        if (data.cargo) setCargo(data.cargo as CargoInfo);
        if (data.section) setSection(data.section as SectionInfo);
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    };
    load();
  }, [code]);

  const handleScanSuccess = useCallback(async (scannedCode: string) => {
    if (confirming) return;
    setConfirming(true);
    setScanning(false);

    try {
      const result = await api.packages.confirm(code, scannedCode);
      if (result.already) {
        setScanResult("already");
        setConfirmedAt(result.confirmed_at);
      } else if (result.confirmed) {
        setScanResult("success");
        setConfirmedAt(result.confirmed_at);
        // Package has been deleted from DB after confirmation — clear details
        setPkg(null);
      }
    } catch (err: any) {
      // If package was already deleted (404), treat as delivered
      if (err.message === "Package not found") {
        setScanResult("success");
        setConfirmedAt(new Date().toISOString());
        setPkg(null);
      } else {
        setScanResult("mismatch");
      }
    }
    setConfirming(false);
  }, [code, confirming]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  // Show delivered screen after successful confirmation or if package was already confirmed & deleted
  if (scanResult === "success" || scanResult === "already") {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center space-y-4">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
            <h1 className="text-xl font-semibold text-foreground">{t("track.packageDelivered")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("track.deliveredDescription")}
            </p>
            {confirmedAt && (
              <p className="text-xs text-muted-foreground">
                {t("track.deliveryConfirmed")} {formatDate(confirmedAt)}
              </p>
            )}
            <div className="pt-2 text-xs text-muted-foreground">
              {t("track.footer")}
            </div>
          </div>
        </div>
      );
  }

  if (notFound || !pkg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <PackageIcon className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">{t("track.packageNotFound")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("track.packageNotFoundDescription", { code })}
          </p>
        </div>
      </div>
    );
  }

  const paymentLabel = { paid: t("track.paidStatus"), unpaid: t("track.onDeliveryStatus"), partial: t("track.partlyPaidStatus") }[pkg.payment_status] ?? pkg.payment_status;
  const statusColor = {
    pending: "bg-yellow-500/20 text-yellow-400",
    in_transit: "bg-blue-500/20 text-blue-400",
    delivered: "bg-green-500/20 text-green-400",
  }[cargo?.status ?? ""] ?? "bg-muted text-muted-foreground";

  const isConfirmed = !!confirmedAt;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-foreground text-background">
            <PackageIcon className="h-5 w-5" />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-foreground">{t("track.heading")}</h1>
          <p className="font-mono text-sm text-muted-foreground">{pkg.package_code}</p>
        </div>

        {/* Confirmation status banner */}
        {isConfirmed && (
          <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
            <div>
              <div className="text-sm font-medium text-green-500">{t("track.confirmed")}</div>
              <div className="text-xs text-green-500/70">
                {t("track.deliveryConfirmed")} {formatDate(confirmedAt)}
              </div>
            </div>
          </div>
        )}

        {/* Scan to confirm section */}
        {!isConfirmed && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("track.confirmDelivery")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("track.scanInstruction")}
            </p>

            {scanResult === "mismatch" && (
              <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <div className="text-sm font-medium text-red-500">{t("track.qrMismatch")}</div>
                  <div className="text-xs text-red-500/70">
                    {t("track.qrMismatchDescription")}
                  </div>
                </div>
              </div>
            )}

            {confirming ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">{t("track.confirming")}</span>
              </div>
            ) : scanning ? (
              <QrScanner
                onScan={handleScanSuccess}
                onClose={() => setScanning(false)}
                onFallback={() => { setScanning(false); setManualEntry(true); }}
              />
            ) : manualEntry ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {t("track.manualInstruction")}
                </p>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="p.sh. PKG-ABC123"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-ring/50 focus:border-ring focus:ring-2"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (manualCode.trim()) handleScanSuccess(manualCode.trim());
                  }}
                  disabled={!manualCode.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t("track.confirmPackage")}
                </button>
                <button
                  onClick={() => { setManualEntry(false); setScanResult(null); }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {t("common.back")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => { setScanResult(null); setScanning(true); }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  <ScanLine className="h-4 w-4" />
                  {t("track.scanQR")}
                </button>
                <button
                  onClick={() => { setScanResult(null); setManualEntry(true); }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <KeyboardIcon className="h-4 w-4" />
                  {t("track.enterManually")}
                </button>
              </div>
            )}
          </div>
        )}

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
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("track.shipping")}</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{cargo.departure_country}</span>
                <span className="text-muted-foreground/50">→</span>
                <span>{cargo.destination_country}</span>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                {cargo.status === "in_transit" ? t("status.inTransit") : cargo.status === "pending" ? t("status.pending") : cargo.status === "delivered" ? t("status.delivered") : cargo.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">{t("track.destinationLabel")}</div>
                <div>{pkg.destination_location ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("track.cargoLabel")}</div>
                <div className="font-mono text-xs">{cargo.cargo_code}</div>
              </div>
            </div>
          </div>
        )}

        {/* Location in warehouse */}
        {section && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("package.warehouse")}</h3>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{section.warehouse_name ?? "—"}</span>
              <span className="text-muted-foreground/50">→</span>
              <span>{section.section_name}</span>
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("track.dates")}</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">{t("track.deliveryLabel")}</div>
                <div>{formatDate(pkg.delivery_date)}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">{t("track.arrivalLabel")}</div>
                <div>{formatDate(pkg.arrival_date)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("track.payment")}</h3>
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span>{paymentLabel}</span>
          </div>
          {pkg.payment_status === "partial" && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">{t("track.paidAmount")}</div>
                <div className="text-green-400">{formatMoney(pkg.amount_paid, pkg.currency)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("track.remainingAmount")}</div>
                <div className="text-yellow-400">{formatMoney(pkg.amount_remaining, pkg.currency)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Client */}
        {pkg.client_name && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("track.recipient")}</h3>
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
          {t("track.footer")}
        </div>
      </div>
    </div>
  );
}

/* --- QR Scanner Component --- */

function QrScanner({ onScan, onClose, onFallback }: { onScan: (code: string) => void; onClose: () => void; onFallback: () => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const scannerInstanceRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHttps] = useState(() => window.location.protocol === "https:" || window.location.hostname === "localhost");
  const { t } = useTranslation();

  useEffect(() => {
    let stopped = false;

    const startScanner = async () => {
      const { Html5Qrcode } = await import("html5-qrcode");

      if (stopped || !scannerRef.current) return;

      const scanner = new Html5Qrcode("qr-reader");
      scannerInstanceRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            let scannedCode = decodedText;
            const trackMatch = decodedText.match(/\/track\/([^/?#]+)/);
            if (trackMatch) {
              scannedCode = decodeURIComponent(trackMatch[1]);
            }
            scanner.stop().catch(() => {});
            onScan(scannedCode);
          },
          () => {},
        );
      } catch {
        if (!isHttps) {
          setError(t("track.cameraHttpsError"));
        } else {
          setError(t("track.cameraPermissionError"));
        }
      }
    };

    startScanner();

    return () => {
      stopped = true;
      scannerInstanceRef.current?.stop().catch(() => {});
    };
  }, [onScan, isHttps, t]);

  return (
    <div className="space-y-3">
      {!error && (
        <div className="relative overflow-hidden rounded-lg border border-border bg-black">
          <div id="qr-reader" ref={scannerRef} className="w-full" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-48 w-48 rounded-lg border-2 border-white/30" />
          </div>
        </div>
      )}

      {error && (
        <div className="space-y-3">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
            <div className="font-medium text-red-500">{t("track.cameraNotAvailable")}</div>
            <div className="mt-1 text-xs text-red-500/80">{error}</div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">{t("track.whatYouCanDo")}</div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {!isHttps && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">1.</span>
                  <span>{t("track.httpsHint")}</span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{isHttps ? "1" : "2"}.</span>
                <span>{t("track.checkPermission")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{isHttps ? "2" : "3"}.</span>
                <span>{t("track.manualFallback")}</span>
              </li>
            </ul>
          </div>

          <button
            onClick={onFallback}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <KeyboardIcon className="h-4 w-4" />
            {t("track.enterCodeManually")}
          </button>
        </div>
      )}

      {!error && (
        <p className="text-center text-xs text-muted-foreground">
          {t("track.pointCamera")}
        </p>
      )}

      <button
        onClick={onClose}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {t("common.cancel")}
      </button>
    </div>
  );
}
