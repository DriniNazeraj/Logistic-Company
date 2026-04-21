import { api } from "@/lib/api";

/**
 * Checks all pending cargos and transitions them to "in_transit"
 * if their departure date at 12:00 PM has passed.
 */
export async function autoTransitPendingCargos() {
  await api.cargos.autoTransit();
}
