import { supabase } from "@/integrations/supabase/client";

/**
 * Checks all pending cargos and transitions them to "in_transit"
 * if their departure date at 12:00 PM has passed.
 */
export async function autoTransitPendingCargos() {
  const now = new Date();
  const { data: pendingDue } = await supabase
    .from("cargos")
    .select("id, departure_date")
    .eq("status", "pending")
    .not("departure_date", "is", null);

  if (!pendingDue || pendingDue.length === 0) return;

  const idsToTransit = pendingDue
    .filter((c) => {
      const noon = new Date(c.departure_date + "T12:00:00");
      return now >= noon;
    })
    .map((c) => c.id);

  if (idsToTransit.length > 0) {
    await supabase
      .from("cargos")
      .update({ status: "in_transit" })
      .in("id", idsToTransit);
  }
}
