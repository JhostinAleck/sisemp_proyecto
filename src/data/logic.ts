import type { InventoryItem, Project, ProjectStatus, State } from './types';

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  nuevo: 'Nuevo',
  cotizacion: 'En cotización',
  enviado: 'Enviado',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

export const ITEM_STATUS_LABEL: Record<InventoryItem['status'], string> = {
  disponible: 'Disponible',
  mantenimiento: 'En mantenimiento',
  en_set: 'En set',
  baja: 'Dado de baja',
};

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const money = (n: number) => cop.format(n || 0);

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function shortDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function dateRange(p: Pick<Project, 'start' | 'end'>): string {
  if (!p.start) return 'Sin fechas';
  if (!p.end || p.end === p.start) return shortDate(p.start);
  return `${shortDate(p.start)} – ${shortDate(p.end)}`;
}

/** Inclusive number of shooting days; 1 when dates are missing. */
export function shootingDays(p: Pick<Project, 'start' | 'end'>): number {
  if (!p.start) return 1;
  const a = Date.parse(p.start);
  const b = Date.parse(p.end || p.start);
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function overlaps(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  // Missing dates on either side: assume a conflict (conservative).
  if (!aFrom || !bFrom) return true;
  return aFrom <= (bTo || bFrom) && bFrom <= (aTo || aFrom);
}

export type CheckState = 'disponible' | 'reservado' | 'faltante';

export interface CheckRow {
  item: InventoryItem;
  required: number;
  free: number;
  shortage: number;
  state: CheckState;
  /** Name of the project holding a conflicting reservation */
  conflict?: string;
  /** Already reserved for this project */
  reservedHere: number;
}

/** Aggregate a project's materials and check them against stock and other projects' reservations. */
export function inventoryCheck(state: State, project: Project): CheckRow[] {
  const required = new Map<string, number>();
  for (const e of project.effects) required.set(e.itemId, (required.get(e.itemId) ?? 0) + e.qty);

  const rows: CheckRow[] = [];
  for (const [itemId, req] of required) {
    const item = state.inventory.find(i => i.id === itemId);
    if (!item || req <= 0) continue;
    const others = state.reservations.filter(
      r => r.itemId === itemId && r.projectId !== project.id && overlaps(r.from, r.to, project.start, project.end),
    );
    const otherQty = others.reduce((s, r) => s + r.qty, 0);
    const reservedHere = state.reservations
      .filter(r => r.itemId === itemId && r.projectId === project.id)
      .reduce((s, r) => s + r.qty, 0);
    const usable = item.status === 'disponible' ? item.qty : 0;
    const free = Math.max(0, usable - otherQty);
    const shortage = Math.max(0, req - free);
    let st: CheckState = 'disponible';
    let conflict: string | undefined;
    if (shortage > 0) {
      if (otherQty > 0 && usable >= req) {
        st = 'reservado';
        conflict = state.projects.find(p => p.id === others[0].projectId)?.name;
      } else {
        st = 'faltante';
      }
    }
    rows.push({ item, required: req, free, shortage, state: st, conflict, reservedHere });
  }
  return rows;
}

export interface Totals {
  inventory: number;
  suppliers: number;
  personal: number;
  polizas: number;
  subtotal: number;
  margin: number;
  total: number;
}

export function quoteTotals(state: State, project: Project): Totals {
  const days = shootingDays(project);
  const inventory = inventoryCheck(state, project).reduce(
    (s, r) => s + Math.min(r.required, r.free) * r.item.dailyRate * days,
    0,
  );
  let suppliers = 0;
  for (const [itemId, supplierId] of Object.entries(project.choices)) {
    const o = state.offers.find(x => x.projectId === project.id && x.itemId === itemId && x.supplierId === supplierId);
    if (o) suppliers += o.price;
  }
  const { personal, polizas } = project.costs;
  const subtotal = inventory + suppliers + personal + polizas;
  const margin = subtotal * (project.costs.margin / 100);
  return { inventory, suppliers, personal, polizas, subtotal, margin, total: subtotal + margin };
}
