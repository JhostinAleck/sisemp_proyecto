import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../data/store';
import { Icon } from './Icon';

const LINKS = [
  { to: '/', label: 'Proyectos', icon: 'folder', end: true },
  { to: '/inventario', label: 'Inventario', icon: 'box' },
  { to: '/proveedores', label: 'Proveedores', icon: 'truck' },
  { to: '/cotizaciones', label: 'Cotizaciones', icon: 'file' },
] as const;

export function Layout() {
  const { state, update, reset, toast, toasts } = useStore();
  const { user } = state;
  const { pathname } = useLocation();

  if (!state.loggedIn) return <Navigate to="/login" replace state={{ from: pathname }} />;

  const logout = () => update(s => { s.loggedIn = false; });

  const switchRole = () => {
    update(s => {
      s.user.role = s.user.role === 'gerencia' ? 'produccion' : 'gerencia';
    });
    toast(user.role === 'gerencia' ? 'Ahora ves la app como Producción' : 'Ahora ves la app como Gerencia');
  };

  return (
    <div className="shell">
      <nav className="nav" aria-label="Principal">
        <div className="nav-brand">
          <div className="nav-logo"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111113" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z" /></svg></div>
          <div><b>Boom</b><small>Cotizador</small></div>
        </div>
        <div className="nav-group">
          <span className="nav-label">Operación</span>
          {LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={'end' in l ? l.end : false}
              className={({ isActive }) => (isActive || (l.to === '/' && pathname.startsWith('/proyectos')) ? 'active' : '')}>
              <Icon name={l.icon} size={18} stroke={1.75} />{l.label}
            </NavLink>
          ))}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="nav-reset" type="button"
            onClick={() => { if (confirm('¿Restaurar los datos de ejemplo? Se perderán los cambios.')) { reset(); toast('Datos de ejemplo restaurados'); } }}>
            Restaurar datos de ejemplo
          </button>
          <button className="nav-reset" type="button" onClick={logout}>Cerrar sesión</button>
          <button className="nav-user" type="button" onClick={switchRole} title="Cambiar de rol (demo)">
            <span className="avatar">{user.initials}</span>
            <span><b>{user.name}</b><small>{user.role === 'gerencia' ? 'Gerencia' : 'Producción'} · cambiar rol</small></span>
          </button>
        </div>
      </nav>
      <main className="main">
        <div className="page"><Outlet /></div>
      </main>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => <div key={t.id} className="toast">{t.text}</div>)}
      </div>
    </div>
  );
}
