import { useEffect, useState, type FormEvent } from "react";
import { api, useStore } from "../app/store";
import { can, ROLE_LABEL, ROLES } from "../domains/access/policy";
import type { AuditEvent, Role, User } from "../domains/shared/types";
import { shortDate } from "../domains/shared/format";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHead,
  Table,
  str,
} from "../components/ui";
import { Icon } from "../components/Icon";
export function Account() {
  const { user } = useStore(),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      d = new FormData(form);
    setError("");
    setMessage("");
    if (d.get("newPassword") !== d.get("confirmation")) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: String(d.get("currentPassword") || ""),
          newPassword: String(d.get("newPassword") || ""),
        }),
      });
      form.reset();
      setMessage("Contraseña actualizada. Se cerraron tus otras sesiones.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHead
        title="Tu cuenta"
        description="Administra tus datos de acceso al espacio compartido."
      />
      <div className="two-columns">
        <section className="panel">
          <div className="panel-head">
            <h2>Perfil y permisos</h2>
          </div>
          <dl className="details">
            <div>
              <dt>Nombre</dt>
              <dd>{user?.name}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>{user && ROLE_LABEL[user.role]}</dd>
            </div>
          </dl>
          <div className="info-banner">
            <Icon name="lock" />
            Gerencia administra tu rol. Las acciones se validan en el servidor.
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Cambiar contraseña</h2>
          </div>
          <form className="padded-form" onSubmit={submit}>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="inline-success" role="status">
                {message}
              </p>
            )}
            <Field label="Contraseña actual">
              <input
                type="password"
                name="currentPassword"
                required
                autoComplete="current-password"
              />
            </Field>
            <Field label="Nueva contraseña (mínimo 12 caracteres)">
              <input
                type="password"
                name="newPassword"
                minLength={12}
                required
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirmar contraseña">
              <input
                type="password"
                name="confirmation"
                minLength={12}
                required
                autoComplete="new-password"
              />
            </Field>
            <div className="form-actions">
              <Button type="submit" disabled={busy}>
                Actualizar contraseña
              </Button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
const roleDescriptions: Record<Role, string> = {
  produccion: "Proyectos, materiales, consulta y reservas.",
  bodega: "Catálogo, ingresos, revisión, salidas y retornos.",
  compras: "Proveedores, solicitudes, ofertas y cotizaciones.",
  gerencia: "Operación completa, aprobación, equipo y auditoría.",
};
export function Members() {
  const { user } = useStore(),
    [members, setMembers] = useState<User[]>([]),
    [inviting, setInviting] = useState(false),
    [invitation, setInvitation] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [changing, setChanging] = useState<{
      member: User;
      role?: Role;
      active?: boolean;
    } | null>(null);
  const load = () =>
    api<{ members: User[] }>("/auth/members")
      .then((r) => setMembers(r.members))
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (user && can(user.role, "members.manage")) void load();
  }, [user?.id]);
  if (!user || !can(user.role, "members.manage"))
    return <Empty title="Acceso reservado a gerencia" />;
  const invite = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d = new FormData(e.currentTarget);
    try {
      const r = await api<{ url: string; expiresAt: string }>(
        "/auth/invitations",
        {
          method: "POST",
          body: JSON.stringify({
            email: str(d, "email"),
            role: str(d, "role"),
          }),
        },
      );
      setInvitation(r.url);
      setInviting(false);
      setCopied(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const update = async () => {
    if (!changing) return;
    setBusy(true);
    setError("");
    try {
      await api(`/auth/members/${changing.member.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(changing.role ? { role: changing.role } : {}),
          ...(changing.active !== undefined ? { active: changing.active } : {}),
        }),
      });
      setChanging(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setChanging(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHead
        title="Equipo y acceso"
        description="Cuentas por invitación y permisos según la responsabilidad de cada persona."
      >
        <Button
          icon="plus"
          onClick={() => {
            setInviting(true);
            setInvitation("");
          }}
        >
          Invitar persona
        </Button>
      </PageHead>
      {error && (
        <div role="alert" className="inline-error">
          {error}
        </div>
      )}
      {invitation && (
        <div className="invitation-result">
          <Icon name="lock" />
          <div>
            <strong>
              Invitación creada. Comparte el enlace de forma privada.
            </strong>
            <p>
              Es de un solo uso y tiene vencimiento. No se envió correo
              automáticamente.
            </p>
            <input
              readOnly
              aria-label="Enlace privado de invitación"
              value={invitation}
              onFocus={(e) => e.target.select()}
            />
            <Button
              variant="secondary small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invitation);
                  setCopied(true);
                } catch {
                  setError("Selecciona el enlace y cópialo manualmente.");
                }
              }}
            >
              {copied ? "Copiado" : "Copiar enlace privado"}
            </Button>
          </div>
        </div>
      )}
      <section className="panel">
        <div className="panel-head">
          <h2>Personas del equipo</h2>
          <Badge>{members.filter((m) => m.active).length} activas</Badge>
        </div>
        <Table>
          <thead>
            <tr>
              <th>Persona</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acceso</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.name}</strong>
                  {m.id === user.id && <Badge>Tu cuenta</Badge>}
                  <small>{m.email}</small>
                </td>
                <td>
                  <select
                    value={m.role}
                    aria-label={`Rol de ${m.name}`}
                    disabled={busy}
                    onChange={(e) =>
                      setChanging({ member: m, role: e.target.value as Role })
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <Badge tone={m.active ? "green" : "red"}>
                    {m.active ? "Activa" : "Desactivada"}
                  </Badge>
                </td>
                <td>
                  <Button
                    variant="secondary small"
                    disabled={busy || m.id === user.id}
                    onClick={() =>
                      setChanging({ member: m, active: !m.active })
                    }
                  >
                    {m.active ? "Desactivar" : "Reactivar"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
      <h2 className="section-title">Responsabilidades por rol</h2>
      <div className="role-grid">
        {ROLES.map((r) => (
          <section className="panel role-card" key={r}>
            <Icon
              name={
                r === "produccion"
                  ? "folder"
                  : r === "bodega"
                    ? "box"
                    : r === "compras"
                      ? "file"
                      : "lock"
              }
              size={24}
            />
            <h3>{ROLE_LABEL[r]}</h3>
            <p>{roleDescriptions[r]}</p>
          </section>
        ))}
      </div>
      {inviting && (
        <Modal title="Invitar persona" close={() => setInviting(false)}>
          <form onSubmit={invite}>
            <p className="muted">
              La persona definirá su nombre y contraseña al activar el enlace
              privado.
            </p>
            <Field label="Correo electrónico">
              <input type="email" name="email" required />
            </Field>
            <Field label="Rol de acceso">
              <select name="role" required>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-actions">
              <Button type="submit" disabled={busy}>
                Crear invitación
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {changing && (
        <Modal title="Actualizar acceso" close={() => setChanging(null)}>
          <p>
            {changing.role
              ? `Cambiar el rol de ${changing.member.name} a ${ROLE_LABEL[changing.role]}.`
              : `${changing.active ? "Reactivar" : "Desactivar"} el acceso de ${changing.member.name}.`}
          </p>
          <p className="muted">
            Los cambios de permisos se aplican inmediatamente a sus sesiones.
          </p>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setChanging(null)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={() => void update()}>
              Confirmar cambio
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Activity() {
  const { user } = useStore(),
    [events, setEvents] = useState<AuditEvent[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user || !can(user.role, "audit.read")) return;
    const load = () =>
      api<{ events: AuditEvent[] }>("/audit")
        .then((r) => {
          setEvents(r.events);
          setError("");
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    void load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);
  if (!user || !can(user.role, "audit.read"))
    return <Empty title="Acceso reservado a gerencia" />;
  return (
    <>
      <PageHead
        title="Actividad"
        description="Trazabilidad de los cambios realizados en la plataforma."
      />
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <section className="panel">
        {events.length ? (
          <Table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Persona</th>
                <th>Acción</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    {shortDate(e.createdAt)}
                    <small>
                      {new Date(e.createdAt).toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </td>
                  <td>{e.actor}</td>
                  <td>
                    <Badge>{e.action}</Badge>
                  </td>
                  <td>{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty
            title={loading ? "Cargando actividad…" : "Sin eventos registrados"}
          />
        )}
      </section>
    </>
  );
}
