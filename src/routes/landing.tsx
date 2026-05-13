import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody } from "@/components/layout-primitives";
import { Field, Input, Button } from "@/components/ui-kit";
import { toast } from "sonner";
import { Save, Upload, Image, Type, BarChart3, MessageSquare, Phone, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "Landing Page — transport.square.al" },
      { name: "description", content: "Edit landing page content." },
    ],
  }),
  component: LandingEditor,
});

type SectionKey = "hero" | "stats" | "services" | "whyUs" | "faq" | "contact";

const SECTIONS: { key: SectionKey; label: string; icon: typeof Type }[] = [
  { key: "hero", label: "Hero", icon: Image },
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "services", label: "Services", icon: Type },
  { key: "whyUs", label: "Why Us", icon: Type },
  { key: "faq", label: "FAQ", icon: MessageSquare },
  { key: "contact", label: "Contact", icon: Phone },
];

function LandingEditor() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("hero");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    setBusy(true);
    try {
      const data = await api.landing.get();
      setContent(data);
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const update = (key: string, value: string) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.landing.save(content);
      toast.success("Landing page updated");
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    key: string,
    setUploading: (v: boolean) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed.");
      return;
    }
    setUploading(true);
    try {
      const url = await api.upload(file);
      update(key, url);
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err.message);
    }
    setUploading(false);
    e.target.value = "";
  };

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Landing Page"
        description="Edit your public landing page content."
        actions={
          <Button onClick={save} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            {saving ? t("common.saving") : t("common.saveChanges")}
          </Button>
        }
      />
      <PageBody>
        {busy ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">
            {/* Section tabs */}
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-card p-1.5">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
                    (activeSection === s.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                  }
                >
                  <s.icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              ))}
            </div>

            {/* HERO */}
            {activeSection === "hero" && (
              <div className="space-y-4 rounded-lg border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Hero Section</h2>

                {/* Logo upload */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Logo</label>
                  <div className="mt-1.5 flex items-center gap-3">
                    {content.logo_url && (
                      <img src={content.logo_url} alt="Logo" className="h-12 w-12 rounded-md border border-border object-contain" />
                    )}
                    <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "logo_url", setUploadingLogo)} />
                    <Button variant="secondary" onClick={() => logoRef.current?.click()} disabled={uploadingLogo}>
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingLogo ? t("common.uploading") : content.logo_url ? t("common.replace") : t("common.upload")}
                    </Button>
                  </div>
                </div>

                {/* Hero image upload */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Hero Image</label>
                  <div className="mt-1.5 flex items-center gap-3">
                    {content.hero_image_url && (
                      <img src={content.hero_image_url} alt="Hero" className="h-16 w-28 rounded-md border border-border object-cover" />
                    )}
                    <input ref={heroRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "hero_image_url", setUploadingHero)} />
                    <Button variant="secondary" onClick={() => heroRef.current?.click()} disabled={uploadingHero}>
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingHero ? t("common.uploading") : content.hero_image_url ? t("common.replace") : t("common.upload")}
                    </Button>
                  </div>
                </div>

                <Field label="Title line 1">
                  <Input value={content.hero_title1 ?? ""} onChange={(e) => update("hero_title1", e.target.value)} placeholder="Cargo Shipping" />
                </Field>
                <Field label="Title line 2">
                  <Input value={content.hero_title2 ?? ""} onChange={(e) => update("hero_title2", e.target.value)} placeholder="From USA to" />
                </Field>
                <Field label="Title line 3">
                  <Input value={content.hero_title3 ?? ""} onChange={(e) => update("hero_title3", e.target.value)} placeholder="Albania" />
                </Field>
                <Field label="Description">
                  <textarea
                    value={content.hero_desc ?? ""}
                    onChange={(e) => update("hero_desc", e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none ring-ring/50 focus:border-ring focus:ring-2"
                    placeholder="Transport Square offers reliable cargo shipping..."
                  />
                </Field>
              </div>
            )}

            {/* STATS */}
            {activeSection === "stats" && (
              <div className="space-y-4 rounded-lg border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Statistics</h2>
                <p className="text-xs text-muted-foreground">The 4 key metrics shown on the landing page.</p>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="grid grid-cols-3 gap-3">
                    <Field label={`Stat ${i} value`}>
                      <Input value={content[`stat${i}_value`] ?? ""} onChange={(e) => update(`stat${i}_value`, e.target.value)} placeholder="99%" />
                    </Field>
                    <div className="col-span-2">
                      <Field label={`Stat ${i} label`}>
                        <Input value={content[`stat${i}_label`] ?? ""} onChange={(e) => update(`stat${i}_label`, e.target.value)} placeholder="On-Time Delivery Rate" />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SERVICES */}
            {activeSection === "services" && (
              <div className="space-y-4 rounded-lg border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Services</h2>
                <p className="text-xs text-muted-foreground">The 6 service cards displayed on the landing page.</p>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="space-y-2 rounded-md border border-border p-3">
                    <Field label={`Service ${i} title`}>
                      <Input value={content[`service${i}_title`] ?? ""} onChange={(e) => update(`service${i}_title`, e.target.value)} placeholder="Service title" />
                    </Field>
                    <Field label={`Service ${i} description`}>
                      <textarea
                        value={content[`service${i}_desc`] ?? ""}
                        onChange={(e) => update(`service${i}_desc`, e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none ring-ring/50 focus:border-ring focus:ring-2"
                        placeholder="Service description"
                      />
                    </Field>
                  </div>
                ))}
              </div>
            )}

            {/* WHY US */}
            {activeSection === "whyUs" && (
              <div className="space-y-4 rounded-lg border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Why Us</h2>
                <p className="text-xs text-muted-foreground">The 3 feature cards in the dark section.</p>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2 rounded-md border border-border p-3">
                    <Field label={`Feature ${i} title`}>
                      <Input value={content[`feature${i}_title`] ?? ""} onChange={(e) => update(`feature${i}_title`, e.target.value)} placeholder="Feature title" />
                    </Field>
                    <Field label={`Feature ${i} description`}>
                      <textarea
                        value={content[`feature${i}_desc`] ?? ""}
                        onChange={(e) => update(`feature${i}_desc`, e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none ring-ring/50 focus:border-ring focus:ring-2"
                        placeholder="Feature description"
                      />
                    </Field>
                  </div>
                ))}
              </div>
            )}

            {/* FAQ */}
            {activeSection === "faq" && (
              <div className="space-y-4 rounded-lg border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Frequently Asked Questions</h2>
                <p className="text-xs text-muted-foreground">The 4 FAQ items on the landing page.</p>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2 rounded-md border border-border p-3">
                    <Field label={`Question ${i}`}>
                      <Input value={content[`faq${i}_q`] ?? ""} onChange={(e) => update(`faq${i}_q`, e.target.value)} placeholder="Question" />
                    </Field>
                    <Field label={`Answer ${i}`}>
                      <textarea
                        value={content[`faq${i}_a`] ?? ""}
                        onChange={(e) => update(`faq${i}_a`, e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none ring-ring/50 focus:border-ring focus:ring-2"
                        placeholder="Answer"
                      />
                    </Field>
                  </div>
                ))}
              </div>
            )}

            {/* CONTACT */}
            {activeSection === "contact" && (
              <div className="space-y-4 rounded-lg border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Contact Information</h2>
                <p className="text-xs text-muted-foreground">Phone and email shown in the contact section.</p>
                <Field label="Phone number">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <Input value={content.contact_phone ?? ""} onChange={(e) => update("contact_phone", e.target.value)} placeholder="+1 234 567 8900" />
                  </div>
                </Field>
                <Field label="Email address">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input value={content.contact_email ?? ""} onChange={(e) => update("contact_email", e.target.value)} placeholder="info@transport.square.al" />
                  </div>
                </Field>
              </div>
            )}

            {/* Bottom save button */}
            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={saving}>
                <Save className="h-3.5 w-3.5" />
                {saving ? t("common.saving") : t("common.saveChanges")}
              </Button>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
