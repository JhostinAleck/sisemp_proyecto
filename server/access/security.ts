import type { Role } from "../../src/domains/shared/types";
import { HttpError } from "./errors";

export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export function assertPassword(password: string): void {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    throw new HttpError(
      400,
      "La contraseña debe tener entre 12 y 128 caracteres.",
    );
}
export function assertLiveToken(
  record:
    | { expires_at: Date | string; used_at?: Date | string | null }
    | null
    | undefined,
  now = new Date(),
): void {
  if (
    !record ||
    record.used_at ||
    new Date(record.expires_at).getTime() <= now.getTime() ||
    !Number.isFinite(new Date(record.expires_at).getTime())
  )
    throw new HttpError(400, "El enlace no es válido o ya venció.");
}
export function assertManager(user: { role: string; active: boolean }): void {
  if (!user.active || user.role !== "gerencia")
    throw new HttpError(403, "Esta acción requiere gerencia.");
}
export function assertManagerChange(
  member: { id: string; role: string; active: boolean },
  patch: { role?: Role; active?: boolean },
  actor: string,
  managers: number,
): void {
  if (member.id === actor && patch.active === false)
    throw new HttpError(400, "No puedes desactivar tu propia cuenta.");
  const removesManager =
    member.role === "gerencia" &&
    member.active &&
    (patch.active === false ||
      (patch.role !== undefined && patch.role !== "gerencia"));
  if (removesManager && managers <= 1)
    throw new HttpError(400, "Debe permanecer al menos un gerente activo.");
}
export function sessionCookie(
  token: string,
  production = process.env.NODE_ENV === "production",
): string {
  return `bb_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_SECONDS : 0}${production ? "; Secure" : ""}`;
}
export function readSessionCookie(cookie?: string): string | undefined {
  const found = (cookie ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("bb_session="));
  if (found.length !== 1) return undefined;
  try {
    return (
      decodeURIComponent(found[0].slice("bb_session=".length)) || undefined
    );
  } catch {
    return undefined;
  }
}
