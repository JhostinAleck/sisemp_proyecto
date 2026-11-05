import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../app/store";
import { can } from "../domains/access/policy";
import { stockSummary } from "../domains/inventory/service";
import { money, shortDate } from "../domains/shared/format";
import type { InventoryItem } from "../domains/shared/types";
import {
  Back,
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHead,
  Stat,
  Table,
  num,
  str,
} from "../components/ui";
import { Icon } from "../components/Icon";
const blank = {
  code: "",
  name: "",
  category: "",
  brand: "",
  size: "",
  location: "",
  notes: "",
  qty: 0,
  maintenanceQty: 0,
  minQty: 0,
  dailyRate: 0,
};
function ItemForm({
  item,
  close,
}: {
  item?: InventoryItem;
  close: () => void;
}) {
  const { command } = useStore(),
    value = item || blank;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const input = {
      code: str(d, "code"),
      name: str(d, "name"),
      category: str(d, "category"),
      brand: str(d, "brand"),
      size: str(d, "size"),
      location: str(d, "location"),
      notes: str(d, "notes"),
      minQty: num(d, "minQty"),
      dailyRate: num(d, "dailyRate"),
    };
    const result = await command(
      item
        ? { type: "inventory.update", id: item.id, input }
        : {
            type: "inventory.create",
            input: { ...input, qty: num(d, "qty"), maintenanceQty: 0 },
          },
    );
    if (result) close();
  };
  return (
    <Modal title={item ? "Editar artículo" : "Nuevo artículo"} close={close}>
      <form onSubmit={submit}>
        <div className="form-grid">
          {(
            ["code", "name", "category", "brand", "size", "location"] as const
          ).map((key, i) => (
            <Field
              key={key}
              label={
                [
                  "Código",
                  "Artículo",
                  "Categoría",
                  "Marca",
                  "Talla / medida",
                  "Ubicación",
                ][i]
              }
            >
              <input
                name={key}
                defaultValue={value[key]}
                required={["code", "name", "category", "location"].includes(
                  key,
                )}
                maxLength={160}
              />
            </Field>
          ))}
          {!item && (
            <Field label="Existencias iniciales">
              <input
                type="number"
                name="qty"
                min="0"
                step="1"
                defaultValue="0"
                required
              />
            </Field>
          )}
          <Field label="Mínimo de referencia">
            <input
              type="number"
              name="minQty"
              min="0"
              step="1"
              defaultValue={value.minQty}
              required
            />
          </Field>
          <Field label="Tarifa diaria (COP)">
            <input
              type="number"
              name="dailyRate"
              min="0"
              defaultValue={value.dailyRate}
              required
            />
          </Field>
          <Field label="Observaciones" wide>
            <textarea name="notes" defaultValue={value.notes} />
          </Field>
        </div>
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit">Guardar artículo</Button>
        </div>
      </form>
    </Modal>
  );
}
export function Inventory() {
  const { state, user } = useStore(),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [create, setCreate] = useState(false);
  const items = state.inventory.filter(
    (i) =>
      (!category || i.category === category) &&
      [i.code, i.name, i.category, i.brand, i.location]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Inventario"
        description="Cada equipo, su ubicación y su disponibilidad real."
      >
        {user && can(user.role, "inventory.write") && (
          <Button icon="plus" onClick={() => setCreate(true)}>
            Nuevo artículo
          </Button>
        )}
      </PageHead>
      <div className="inventory-intro">
        <div>
          <span className="live-dot" />
          <strong>{state.inventory.length} referencias</strong>
          <span>en el catálogo compartido</span>
        </div>
        <Badge>Muestra de inventario STUNTS</Badge>
      </div>
      <section className="panel">
        <div className="filter-bar">
          <div className="search-box">
            <Icon name="search" />
            <input
              aria-label="Buscar inventario"
              placeholder="Buscar por código, artículo, marca o ubicación…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filtrar categoría"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {[...new Set(state.inventory.map((i) => i.category))]
              .sort()
              .map((c) => (
                <option key={c}>{c}</option>
              ))}
          </select>
          <span className="muted">{items.length} resultados</span>
        </div>
        {items.length ? (
          <Table>
            <thead>
              <tr>
                <th>Código / artículo</th>
                <th>Categoría</th>
                <th>Ubicación</th>
                <th>Total</th>
                <th>Fuera</th>
                <th>Revisión</th>
                <th>Reservado hoy</th>
                <th>Disponible hoy</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const s = stockSummary(state, i.id);
                return (
                  <tr key={i.id}>
                    <td>
                      <small className="mono">{i.code}</small>
                      <Link className="item-name" to={`/inventario/${i.id}`}>
                        {i.name}
                      </Link>
                      <small>
                        {[i.brand, i.size].filter(Boolean).join(" · ")}
                      </small>
                    </td>
                    <td>
                      <Badge>{i.category}</Badge>
                    </td>
                    <td>{i.location || "—"}</td>
                    <td className="mono">{s.total}</td>
                    <td className="mono">{s.out}</td>
                    <td className="mono">{s.maintenance}</td>
                    <td className="mono">{s.reserved}</td>
                    <td>
                      <span
                        className={`stock-value ${s.available <= i.minQty ? "low" : ""}`}
                      >
                        {s.available}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="round-link"
                        to={`/inventario/${i.id}`}
                        aria-label={`Ver ${i.name}`}
                      >
                        <Icon name="next" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Empty
            title="No encontramos artículos"
            text="Intenta otra búsqueda o categoría."
          />
        )}
      </section>
      <p className="footnote">
        Disponible hoy = unidades físicas utilizables menos reservas activas de
        hoy. Consulta cada proyecto para disponibilidad por periodo.
      </p>
      {create && <ItemForm close={() => setCreate(false)} />}
    </>
  );
}
export function ItemDetail() {
  const { itemId } = useParams(),
    { state, user, command } = useStore(),
    [edit, setEdit] = useState(false),
    [operation, setOperation] = useState<
      "receive" | "maintain" | "release" | null
    >(null);
  const item = state.inventory.find((i) => i.id === itemId);
  if (!item)
    return (
      <Empty title="Artículo no encontrado">
        <Link to="/inventario">Volver al inventario</Link>
      </Empty>
    );
  const s = stockSummary(state, item.id),
    allowed = !!user && can(user.role, "inventory.move");
  const movement = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    if (!operation) return;
    if (
      await command({
        type: `inventory.${operation}`,
        itemId: item.id,
        qty: num(d, "qty"),
        notes: str(d, "notes"),
      })
    )
      setOperation(null);
  };
  return (
    <>
      <Back to="/inventario">Inventario</Back>
      <PageHead
        eyebrow={`${item.code} · ${item.category}`}
        title={item.name}
        description={[item.brand, item.size, item.location]
          .filter(Boolean)
          .join(" · ")}
      >
        {user && can(user.role, "inventory.write") && (
          <Button variant="secondary" onClick={() => setEdit(true)}>
            Editar ficha
          </Button>
        )}
        {allowed && (
          <Button icon="plus" onClick={() => setOperation("receive")}>
            Registrar ingreso
          </Button>
        )}
      </PageHead>
      <div className="stats">
        <Stat
          title="Existencias totales"
          value={s.total}
          detail="Propiedad de la empresa"
          icon="box"
        />
        <Stat
          title="Fuera de bodega"
          value={s.out}
          detail="Retorno pendiente"
          icon="truck"
          tone="amber"
        />
        <Stat
          title="En revisión"
          value={s.maintenance}
          detail="No disponibles para uso"
          icon="wrench"
        />
        <Stat
          title="Disponibles hoy"
          value={s.available}
          detail={`${s.reserved} reservadas hoy`}
          icon="check"
        />
      </div>
      <div className="two-columns">
        <section className="panel">
          <div className="panel-head">
            <h2>Ficha del equipo</h2>
            <Badge>{item.category}</Badge>
          </div>
          <dl className="details">
            <div>
              <dt>Código</dt>
              <dd className="mono">{item.code}</dd>
            </div>
            <div>
              <dt>Marca / talla</dt>
              <dd>
                {item.brand || "—"} / {item.size || "—"}
              </dd>
            </div>
            <div>
              <dt>Ubicación</dt>
              <dd>{item.location || "Sin ubicación"}</dd>
            </div>
            <div>
              <dt>Tarifa diaria</dt>
              <dd>{money(item.dailyRate)}</dd>
            </div>
            <div>
              <dt>Mínimo de referencia</dt>
              <dd>{item.minQty}</dd>
            </div>
            <div>
              <dt>Observaciones</dt>
              <dd>{item.notes || "Sin observaciones"}</dd>
            </div>
          </dl>
          {allowed && (
            <div className="panel-actions">
              <Button
                variant="secondary"
                icon="wrench"
                onClick={() => setOperation("maintain")}
              >
                Enviar a revisión
              </Button>
              <Button
                variant="secondary"
                icon="check"
                disabled={!s.maintenance}
                onClick={() => setOperation("release")}
              >
                Resolver revisión
              </Button>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Reservas por proyecto</h2>
          </div>
          {state.reservations.some((r) => r.itemId === item.id) ? (
            <div className="list-stack">
              {state.reservations
                .filter((r) => r.itemId === item.id)
                .map((r) => (
                  <Link
                    key={r.id}
                    className="list-row"
                    to={`/proyectos/${r.projectId}`}
                  >
                    <span>
                      <strong>
                        {state.projects.find((p) => p.id === r.projectId)?.name}
                      </strong>
                      <small>
                        {shortDate(r.from)} → {shortDate(r.to)}
                      </small>
                    </span>
                    <Badge>
                      {r.qty} uds. · {r.dispatchedQty} despachadas
                    </Badge>
                  </Link>
                ))}
            </div>
          ) : (
            <Empty
              title="Sin reservas"
              text="Este artículo no tiene compromisos de proyectos."
            />
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Historial del artículo</h2>
        </div>
        <Table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Movimiento</th>
              <th>Cantidad</th>
              <th>Responsable</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            {[...state.movements]
              .reverse()
              .filter((m) => m.itemId === item.id)
              .map((m) => (
                <tr key={m.id}>
                  <td>{shortDate(m.date)}</td>
                  <td className="capitalize">
                    {m.kind}
                    <small>{m.label}</small>
                  </td>
                  <td>{m.qty}</td>
                  <td>{m.actor}</td>
                  <td>{m.notes || "—"}</td>
                </tr>
              ))}
          </tbody>
        </Table>
      </section>
      {edit && <ItemForm item={item} close={() => setEdit(false)} />}
      {operation && (
        <Modal
          title={
            {
              receive: "Registrar ingreso",
              maintain: "Enviar equipos a revisión",
              release: "Devolver equipos a disponibilidad",
            }[operation]
          }
          close={() => setOperation(null)}
        >
          <form onSubmit={movement}>
            <p className="muted">
              {item.code} · {item.name}
            </p>
            <Field label="Cantidad de unidades">
              <input
                name="qty"
                type="number"
                min="1"
                step="1"
                max={
                  operation === "release"
                    ? s.maintenance
                    : operation === "maintain"
                      ? s.physical
                      : undefined
                }
                defaultValue="1"
                required
              />
            </Field>
            <Field label="Observación del movimiento">
              <textarea
                name="notes"
                required
                placeholder="Referencia del ingreso o resultado de la revisión"
              />
            </Field>
            <div className="form-actions">
              <Button type="submit">Confirmar movimiento</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
