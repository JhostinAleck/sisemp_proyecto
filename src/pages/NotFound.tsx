import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="card empty">
      No encontramos esta página. <Link to="/">Volver a proyectos</Link>
    </div>
  );
}
