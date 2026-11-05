import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useStore } from '../data/store';
import type { Role } from '../data/types';

/** "daniela.perez@boom.co" -> { name: "Daniela Perez", initials: "DP" } */
function nameFromEmail(email: string) {
  const local = email.split('@')[0] || 'Usuario';
  const words = local.split(/[._\-+\s]+/).filter(Boolean);
  const name = words.map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Usuario';
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : local.slice(0, 2)).toUpperCase();
  return { name, initials };
}

export function Login() {
  const { state, update, toast } = useStore();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState(state.user.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(state.user.role);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  if (state.loggedIn) return <Navigate to={from} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Escribe tu correo y contraseña.'); return; }
    const { name, initials } = nameFromEmail(email.trim());
    update(s => {
      s.user = { name, initials, role, email: email.trim() };
      s.loggedIn = true;
    });
    toast(`Bienvenido, ${name.split(' ')[0]}`);
    nav(from, { replace: true });
  };

  return (
    <div className="login">
      <aside className="login-side">
        <div className="nav-brand" style={{ padding: 0 }}>
          <div className="nav-logo"><Icon name="flame" size={18} style={{ color: '#111113' }} /></div>
          <div><b>Boom</b><small>Cotizador</small></div>
        </div>
        <div>
          <h2>Cotiza efectos y stunts en minutos, no en días.</h2>
          <p>Del desglose por escena a la cotización aprobada: inventario, proveedores y gerencia en un solo flujo.</p>
        </div>
        <ol className="login-steps">
          <li><span>1</span>Desglose de efectos por escena</li>
          <li><span>2</span>Verificación de inventario</li>
          <li><span>3</span>Solicitud a proveedores</li>
          <li><span>4</span>Comparador y aprobación</li>
        </ol>
      </aside>

      <main className="login-main">
        <div className="login-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h1>Iniciar sesión</h1>
            <span className="hint">Entra con tu cuenta de Boom.</span>
          </div>

          <form onSubmit={submit} noValidate>
            <div>
              <label className="lb" htmlFor="email">Correo</label>
              <input className="in" id="email" type="email" autoComplete="email" autoFocus placeholder="nombre@empresa.com"
                value={email} onChange={e => { setEmail(e.target.value); setError(''); }} />
            </div>
            <div>
              <label className="lb" htmlFor="pw">Contraseña</label>
              <div className="pw">
                <input className="in" id="pw" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                  value={password} onChange={e => { setPassword(e.target.value); setError(''); }} />
                <button type="button" onClick={() => setShowPw(v => !v)} aria-pressed={showPw}>{showPw ? 'Ocultar' : 'Mostrar'}</button>
              </div>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="lb">Entrar como</legend>
              <div className="seg">
                <label><input type="radio" name="role" checked={role === 'produccion'} onChange={() => setRole('produccion')} />Producción</label>
                <label><input type="radio" name="role" checked={role === 'gerencia'} onChange={() => setRole('gerencia')} />Gerencia</label>
              </div>
            </fieldset>
            {error && <p role="alert" style={{ fontSize: 13, color: '#B42318' }}>{error}</p>}
            <button className="btn btn-p" type="submit" style={{ height: 44, marginTop: 4 }}>Entrar <Icon name="next" /></button>
          </form>

          <p className="demo-note"><Icon name="info" style={{ flex: 'none', marginTop: 2 }} />
            Versión de demostración: cualquier correo y contraseña funcionan.</p>
        </div>
      </main>
    </div>
  );
}
