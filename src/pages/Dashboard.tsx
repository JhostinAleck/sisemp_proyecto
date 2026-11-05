import { Link } from "react-router-dom";
import { useStore } from "../app/store";
import { inventoryCheck, stockSummary } from "../domains/inventory/service";
import { dateRange, shortDate, STATUS_LABEL } from "../domains/shared/format";
import { Badge, Empty, PageHead, Stat, Table } from "../components/ui";
import { Icon } from "../components/Icon";
export function Dashboard() {
  const { state, user } = useStore();
  const stock = state.inventory.map((i) => stockSummary(state, i.id));
  const pending = state.dispatches.filter((d) =>
    d.lines.some((l) => l.qty > l.returnedQty),
  );
  const shortage = state.projects.filter((p) =>
    inventoryCheck(state, p).some((r) => r.shortage > 0),
  );
  return (
    <>
      <PageHead
        eyebrow="EL PULSO DE TU OPERACIÓN"
        title="Todo bajo control."
        description={`Hola, ${user?.name.split(" ")[0]}. Así se mueve Burning Bull hoy.`}
      >
        <Link className="button" to="/proyectos">
          <Icon name="plus" />
          Ver proyectos
        </Link>
      </PageHead>
      <div className="stats">
        <Stat
          title="Proyectos"
          value={state.projects.length}
          detail={`${state.projects.filter((p) => p.status === "aprobado").length} aprobados`}
          icon="folder"
        />
        <Stat
          title="Disponibles hoy"
          value={stock.reduce((n, s) => n + s.available, 0)}
          detail="Unidades para una nueva reserva"
          icon="box"
        />
        <Stat
          title="Equipos en set"
          value={stock.reduce((n, s) => n + s.out, 0)}
          detail={`${pending.length} actas con retorno pendiente`}
          icon="truck"
          tone="amber"
        />
        <Stat
          title="En revisión"
          value={stock.reduce((n, s) => n + s.maintenance, 0)}
          detail="Unidades en mantenimiento"
          icon="wrench"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">DE LA IDEA AL SET</span>
              <h2>Proyectos en marcha</h2>
            </div>
            <Link className="text-link" to="/proyectos">
              Ver todos <Icon name="next" />
            </Link>
          </div>
          {state.projects.length ? (
            <Table>
              <thead>
                <tr>
                  <th>Proyecto / cliente</th>
                  <th>Rodaje</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.projects.slice(0, 6).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="item-name" to={`/proyectos/${p.id}`}>
                        {p.name}
                      </Link>
                      <small>{p.client}</small>
                    </td>
                    <td>{dateRange(p)}</td>
                    <td>
                      <Badge tone={p.status === "aprobado" ? "green" : ""}>
                        {STATUS_LABEL[p.status]}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        className="round-link"
                        aria-label={`Abrir ${p.name}`}
                        to={`/proyectos/${p.id}`}
                      >
                        <Icon name="next" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty
              title="El próximo proyecto empieza aquí"
              text="Crea un proyecto y planea sus materiales y fechas."
            />
          )}
        </section>
        <section className="panel attention-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">PRÓXIMOS PASOS</span>
              <h2>En el radar</h2>
            </div>
            <Icon name="alert" />
          </div>
          <Link className="radar-row" to="/salidas">
            <span className="radar-icon">
              <Icon name="in" />
            </span>
            <span>
              <strong>{pending.length} retornos pendientes</strong>
              <small>Consulta equipos y actas de salida</small>
            </span>
            <Icon name="next" />
          </Link>
          <Link className="radar-row" to="/cotizaciones">
            <span className="radar-icon">
              <Icon name="file" />
            </span>
            <span>
              <strong>{shortage.length} proyectos con faltantes</strong>
              <small>Revisa cobertura y cotizaciones</small>
            </span>
            <Icon name="next" />
          </Link>
          <Link className="radar-row" to="/inventario">
            <span className="radar-icon">
              <Icon name="wrench" />
            </span>
            <span>
              <strong>
                {stock.reduce((n, s) => n + s.maintenance, 0)} unidades en
                revisión
              </strong>
              <small>Registra la resolución en inventario</small>
            </span>
            <Icon name="next" />
          </Link>
          <div className="radar-note">
            <Icon name="info" />
            <p>
              Las reservas consideran las fechas de cada proyecto. Los equipos
              sin devolución siguen fuera.
            </p>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">TRAZABILIDAD OPERATIVA</span>
            <h2>Últimos movimientos</h2>
          </div>
          <Badge>Registro compartido</Badge>
        </div>
        {state.movements.length ? (
          <Table>
            <thead>
              <tr>
                <th>Movimiento</th>
                <th>Artículo</th>
                <th>Unidades</th>
                <th>Responsable</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {[...state.movements]
                .reverse()
                .slice(0, 5)
                .map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className="capitalize">{m.kind}</span>
                      <small>{m.label}</small>
                    </td>
                    <td>
                      <Link to={`/inventario/${m.itemId}`}>
                        {state.inventory.find((i) => i.id === m.itemId)?.name ||
                          m.itemId}
                      </Link>
                    </td>
                    <td className="mono">{m.qty}</td>
                    <td>{m.actor}</td>
                    <td>{shortDate(m.date)}</td>
                  </tr>
                ))}
            </tbody>
          </Table>
        ) : (
          <Empty
            title="Aún no hay movimientos"
            text="Las reservas, salidas e ingresos aparecerán aquí."
          />
        )}
      </section>
    </>
  );
}
