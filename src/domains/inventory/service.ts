import { businessDate } from "../shared/format";
import type {
  Workspace,
  Project,
  CheckRow,
  StockSummary,
} from "../shared/types";
export function outQuantity(
  s: Workspace,
  itemId: string,
  projectId?: string,
): number {
  return s.dispatches
    .filter((d) => !projectId || d.projectId === projectId)
    .reduce(
      (sum, d) =>
        sum +
        d.lines
          .filter((l) => l.itemId === itemId)
          .reduce((n, l) => n + l.qty - l.returnedQty, 0),
      0,
    );
}
/** Maximum concurrent unissued reservations, not sum of unrelated date windows. */
export function reservedPeak(
  s: Workspace,
  itemId: string,
  from: string,
  to: string,
  excludeProject?: string,
): number {
  const events = new Map<number, number>();
  for (const r of s.reservations) {
    if (
      r.itemId !== itemId ||
      r.projectId === excludeProject ||
      r.from > to ||
      r.to < from
    )
      continue;
    const qty = r.qty - r.dispatchedQty;
    if (qty <= 0) continue;
    const a = Date.parse(r.from > from ? r.from : from),
      b = Date.parse(r.to < to ? r.to : to) + 86400000;
    events.set(a, (events.get(a) || 0) + qty);
    events.set(b, (events.get(b) || 0) - qty);
  }
  let current = 0,
    max = 0;
  for (const [_, delta] of [...events].sort((a, b) => a[0] - b[0])) {
    current += delta;
    max = Math.max(max, current);
  }
  return max;
}
export function stockSummary(
  s: Workspace,
  itemId: string,
  today = businessDate(),
): StockSummary {
  const i = s.inventory.find((x) => x.id === itemId);
  if (!i)
    return {
      total: 0,
      out: 0,
      maintenance: 0,
      physical: 0,
      reserved: 0,
      available: 0,
    };
  const out = outQuantity(s, itemId),
    physical = Math.max(0, i.qty - out - i.maintenanceQty),
    reserved = reservedPeak(s, itemId, today, today);
  return {
    total: i.qty,
    out,
    maintenance: i.maintenanceQty,
    physical,
    reserved,
    available: Math.max(0, physical - reserved),
  };
}
export function inventoryCheck(s: Workspace, p: Project): CheckRow[] {
  const needed = new Map<string, number>();
  for (const e of p.effects)
    needed.set(e.itemId, (needed.get(e.itemId) || 0) + e.qty);
  return [...needed].map(([itemId, required]) => {
    const item = s.inventory.find((i) => i.id === itemId);
    if (!item) throw new Error("Material no encontrado en el inventario");
    const otherOut = outQuantity(s, itemId) - outQuantity(s, itemId, p.id);
    const otherReserved = reservedPeak(s, itemId, p.start, p.end, p.id);
    const free = Math.max(
      0,
      item.qty - item.maintenanceQty - otherOut - otherReserved,
    );
    const shortage = Math.max(0, required - free);
    const reservedHere = s.reservations
      .filter((r) => r.itemId === itemId && r.projectId === p.id)
      .reduce((n, r) => n + r.qty, 0);
    const conflict = s.reservations.find(
      (r) =>
        r.itemId === itemId &&
        r.projectId !== p.id &&
        r.from <= p.end &&
        r.to >= p.start &&
        r.qty > r.dispatchedQty,
    );
    return {
      item,
      required,
      free,
      shortage,
      reservedHere,
      state: shortage
        ? otherReserved
          ? "reservado"
          : "faltante"
        : "disponible",
      conflict: conflict
        ? s.projects.find((q) => q.id === conflict.projectId)?.name
        : undefined,
    };
  });
}
