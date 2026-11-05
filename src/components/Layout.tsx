import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useStore } from "../app/store";
import { ROLE_LABEL, can } from "../domains/access/policy";
import { Icon, type IconName } from "./Icon";
const links: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Resumen", icon: "qr" },
  { to: "/proyectos", label: "Proyectos", icon: "folder" },
  { to: "/inventario", label: "Inventario", icon: "box" },
  { to: "/salidas", label: "Salidas y retornos", icon: "truck" },
  { to: "/cotizaciones", label: "Cotizaciones", icon: "file" },
  { to: "/proveedores", label: "Proveedores", icon: "bookmark" },
];
export function Layout() {
  const { user, logout, error, notice, clear, pending } = useStore(),
    [open, setOpen] = useState(false);
  const location = useLocation();
  if (!user) return null;
  return (
    <div className="app-shell">
      <button
        aria-label="Cerrar menú"
        className={`sidebar-overlay ${open ? "visible" : ""}`}
        onClick={() => setOpen(false)}
      />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">
            <Icon name="flame" size={30} />
          </span>
          <span>
            BURNING BULL<small>STUNTS & SPECIAL EFFECTS</small>
          </span>
        </NavLink>
        <div className="workspace-label">
          <span className="live-dot" /> Espacio de operaciones
        </div>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <Icon name={l.icon} size={19} />
              {l.label}
              <span className="nav-arrow" aria-hidden="true">
                ›
              </span>
            </NavLink>
          ))}
          {can(user.role, "members.manage") && (
            <NavLink
              className="nav-link"
              to="/equipo"
              onClick={() => setOpen(false)}
            >
              <Icon name="lock" size={19} />
              Equipo y acceso
            </NavLink>
          )}
          {can(user.role, "audit.read") && (
            <NavLink
              className="nav-link"
              to="/actividad"
              onClick={() => setOpen(false)}
            >
              <Icon name="clock" size={19} />
              Actividad
            </NavLink>
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="sample-note">
            <Icon name="info" />
            <span>
              Catálogo de muestra
              <small>
                Basado en inventario STUNTS.
                <br />
                Sin sincronización con Sheets.
              </small>
            </span>
          </div>
          <NavLink className="user-card" to="/cuenta">
            <span className="avatar">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>{ROLE_LABEL[user.role]}</small>
            </span>
            <Icon name="next" />
          </NavLink>
          <button className="logout" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <div className="topbar">
          <div className="breadcrumb">
            <button
              className="menu-button"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
            >
              ☰
            </button>
            <span>Operaciones</span>
            <span>/</span>
            <strong>
              {links.find(
                (x) => x.to !== "/" && location.pathname.startsWith(x.to),
              )?.label ||
                (location.pathname === "/" ? "Resumen" : "Espacio de trabajo")}
            </strong>
          </div>
          <span className="connection">
            <span className="live-dot" />
            {pending ? "Guardando…" : "Base compartida"}
          </span>
        </div>
        <main>
          <div aria-live="polite">
            {(error || notice) && (
              <div className={`toast ${error ? "error" : "success"}`}>
                <Icon name={error ? "alert" : "check"} />
                <span>{error || notice}</span>
                <button onClick={clear} aria-label="Cerrar aviso">
                  ×
                </button>
              </div>
            )}
          </div>
          <Outlet />
        </main>
        <footer className="main-footer">
          <span>Burning Bull · Control de operaciones</span>
          <span>Inventario, proyectos y equipos en un solo lugar</span>
        </footer>
      </div>
    </div>
  );
}
