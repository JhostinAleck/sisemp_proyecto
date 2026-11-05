import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, useStore } from "../app/store";
import { Icon } from "../components/Icon";
import { Button, Field, str } from "../components/ui";
import { ROLE_LABEL } from "../domains/access/policy";
import type { Role } from "../domains/shared/types";
export function Auth() {
  const { user, authenticate } = useStore(),
    location = useLocation(),
    activation = location.pathname === "/activar";
  const [invite, setInvite] = useState<{
      email: string;
      role: Role;
      expiresAt: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const token = new URLSearchParams(location.hash.slice(1)).get("token") || "";
  useEffect(() => {
    if (activation) {
      if (!token) {
        setError(
          "Este enlace de activación no es válido. Solicita una nueva invitación a gerencia.",
        );
        return;
      }
      api<{ email: string; role: Role; expiresAt: string }>(
        `/auth/invitation?token=${encodeURIComponent(token)}`,
      )
        .then(setInvite)
        .catch((e) => setError(e.message));
    }
  }, [activation, token]);
  if (user) return <Navigate to="/" replace />;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d = new FormData(e.currentTarget);
    try {
      await authenticate(
        activation ? "activate" : "login",
        activation
          ? {
              token,
              name: str(d, "name"),
              password: String(d.get("password") || ""),
            }
          : {
              email: str(d, "email"),
              password: String(d.get("password") || ""),
            },
      );
      if (activation) history.replaceState(null, "", "/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="flame" size={32} />
          </span>
          <span>
            BURNING BULL<small>STUNTS & SPECIAL EFFECTS</small>
          </span>
        </div>
        <div>
          <span className="eyebrow">CADA DETALLE CUENTA</span>
          <h1>
            Todo listo.
            <br />
            Del almacén
            <br />
            <em>al set.</em>
          </h1>
          <p>
            Coordina proyectos, equipos y movimientos.
            <br />
            Una operación conectada, de principio a fin.
          </p>
        </div>
        <span className="auth-caption">
          PRODUCCIÓN · BODEGA · COMPRAS · GERENCIA
        </span>
      </section>
      <section className="auth-form">
        <div>
          <span className="eyebrow">ESPACIO DE OPERACIONES</span>
          <h2>{activation ? "Activa tu cuenta" : "Bienvenido de nuevo"}</h2>
          <p>
            {activation
              ? "Tu invitación te da acceso al equipo de Burning Bull."
              : "Ingresa con tu cuenta para continuar."}
          </p>
          {error && (
            <div role="alert" className="inline-error">
              {error}
            </div>
          )}
          {(!activation || invite) && (
            <form onSubmit={submit}>
              {activation ? (
                <>
                  <div className="invite-info">
                    <strong>{invite?.email}</strong>
                    <span>{invite && ROLE_LABEL[invite.role]}</span>
                  </div>
                  <Field label="Nombre completo">
                    <input
                      name="name"
                      required
                      autoComplete="name"
                      maxLength={120}
                    />
                  </Field>
                </>
              ) : (
                <Field label="Correo electrónico">
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="tu@empresa.com"
                  />
                </Field>
              )}
              <Field
                label={
                  activation
                    ? "Crea una contraseña (mínimo 12 caracteres)"
                    : "Contraseña"
                }
              >
                <input
                  name="password"
                  type="password"
                  minLength={activation ? 12 : 1}
                  required
                  autoComplete={
                    activation ? "new-password" : "current-password"
                  }
                />
              </Field>
              <Button type="submit" icon="next" disabled={busy}>
                {busy
                  ? "Un momento…"
                  : activation
                    ? "Activar cuenta"
                    : "Entrar al espacio"}
              </Button>
            </form>
          )}
          <div className="auth-help">
            <Icon name="lock" />
            <span>
              Acceso por invitación. Si necesitas una cuenta o recuperar tu
              acceso, comunícate con gerencia.
            </span>
          </div>
          <small className="muted">
            Los cambios se guardan en la base de datos compartida de la empresa.
          </small>
        </div>
      </section>
    </div>
  );
}
