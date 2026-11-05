import type { Role } from "../shared/types";
export const ROLES: Role[] = ["produccion", "bodega", "compras", "gerencia"];
export const ROLE_LABEL: Record<Role, string> = {
  produccion: "Producción",
  bodega: "Bodega",
  compras: "Compras",
  gerencia: "Gerencia",
};
export type Permission =
  | "projects.write"
  | "inventory.write"
  | "inventory.move"
  | "reservations.write"
  | "procurement.write"
  | "quotes.approve"
  | "members.manage"
  | "audit.read";
const GRANTS: Record<Role, readonly Permission[]> = {
  produccion: ["projects.write", "reservations.write"],
  bodega: ["inventory.write", "inventory.move"],
  compras: ["procurement.write"],
  gerencia: [
    "projects.write",
    "inventory.write",
    "inventory.move",
    "reservations.write",
    "procurement.write",
    "quotes.approve",
    "members.manage",
    "audit.read",
  ],
};
export function can(role: string, permission: string): boolean {
  return (
    Object.hasOwn(GRANTS, role) &&
    GRANTS[role as Role].includes(permission as Permission)
  );
}
