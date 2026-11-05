export type Role = 'produccion' | 'gerencia';

export type ProjectStatus = 'nuevo' | 'cotizacion' | 'enviado' | 'aprobado' | 'rechazado';

export type ItemStatus = 'disponible' | 'mantenimiento' | 'en_set' | 'baja';

export interface EffectLine {
  id: string;
  scene: string;
  effect: string;
  itemId: string;
  qty: number;
}

export interface RfqLine {
  itemId: string;
  qty: number;
  rental: boolean;
}

export interface Rfq {
  lines: RfqLine[];
  specs: string;
  supplierIds: string[];
  deadline: string;
  sentAt: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  start: string; // YYYY-MM-DD
  end: string;
  status: ProjectStatus;
  comments: string;
  effects: EffectLine[];
  rfq?: Rfq;
  /** itemId -> supplierId chosen in the comparator */
  choices: Record<string, string>;
  costs: { personal: number; polizas: number; margin: number };
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  qty: number;
  location: string;
  status: ItemStatus;
  /** Internal cost per unit per shooting day, COP */
  dailyRate: number;
}

export interface Reservation {
  id: string;
  itemId: string;
  projectId: string;
  qty: number;
  from: string;
  to: string;
}

export type MovementKind = 'salida' | 'entrada' | 'mantenimiento' | 'escaneo' | 'reserva' | 'ajuste';

export interface Movement {
  id: string;
  itemId: string;
  kind: MovementKind;
  label: string;
  date: string; // ISO
}

export interface Supplier {
  id: string;
  name: string;
  initials: string;
  category: string;
  channel: 'portal' | 'email';
  email: string;
}

export interface Offer {
  id: string;
  projectId: string;
  supplierId: string;
  itemId: string;
  /** Total price for the requested quantity, COP */
  price: number;
  leadDays: number;
  available: boolean;
}

export interface User {
  name: string;
  initials: string;
  role: Role;
  email?: string;
}

export interface State {
  version: number;
  user: User;
  /** Demo session: any credentials sign in. */
  loggedIn?: boolean;
  projects: Project[];
  inventory: InventoryItem[];
  reservations: Reservation[];
  movements: Movement[];
  suppliers: Supplier[];
  offers: Offer[];
}
