import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../app/store";
import { quoteTotals } from "../domains/procurement/service";
import { can } from "../domains/access/policy";
import { inventoryCheck } from "../domains/inventory/service";
import {
  dateRange,
  money,
  shootingDays,
  shortDate,
  STATUS_LABEL,
} from "../domains/shared/format";
import type { Offer, Project, Supplier } from "../domains/shared/types";
import {
  Back,
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHead,
  Table,
  num,
  str,
  today,
} from "../components/ui";
import { Icon } from "../components/Icon";
function SupplierForm({
  supplier,
  close,
}: {
  supplier?: Supplier;
  close: () => void;
}) {
  const { command } = useStore();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    if (
      await command({
        type: "supplier.save",
        id: supplier?.id,
        input: {
          name: str(d, "name"),
          category: str(d, "category"),
          email: str(d, "email"),
          phone: str(d, "phone"),
          notes: str(d, "notes"),
        },
      })
    )
      close();
  };
  return (
    <Modal
      title={supplier ? "Editar proveedor" : "Nuevo proveedor"}
      close={close}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          {(["name", "category", "email", "phone"] as const).map((k, i) => (
            <Field
              key={k}
              label={
                [
                  "Nombre / razón social",
                  "Especialidad / categoría",
                  "Correo electrónico",
                  "Teléfono",
                ][i]
              }
            >
              <input
                name={k}
                type={k === "email" ? "email" : "text"}
                required={k === "name" || k === "category"}
                defaultValue={supplier?.[k]}
              />
            </Field>
          ))}
          <Field label="Notas" wide>
            <textarea name="notes" defaultValue={supplier?.notes} />
          </Field>
        </div>
        <div className="form-actions">
          <Button type="submit">Guardar proveedor</Button>
        </div>
      </form>
    </Modal>
  );
}
export function Suppliers() {
  const { state, user } = useStore(),
    [edit, setEdit] = useState<Supplier | "new" | null>(null),
    [search, setSearch] = useState("");
  const suppliers = state.suppliers.filter((s) =>
    `${s.name} ${s.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Proveedores"
        description="Tu red de aliados para cada necesidad de producción."
      >
        {user && can(user.role, "procurement.write") && (
          <Button icon="plus" onClick={() => setEdit("new")}>
            Nuevo proveedor
          </Button>
        )}
      </PageHead>
      <section className="panel">
        <div className="filter-bar">
          <div className="search-box">
            <Icon name="search" />
            <input
              aria-label="Buscar proveedores"
              placeholder="Buscar nombre o especialidad…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="muted">{suppliers.length} proveedores</span>
        </div>
        {suppliers.length ? (
          <Table>
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Especialidad</th>
                <th>Correo</th>
                <th>Teléfono</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <small>{s.notes}</small>
                  </td>
                  <td>{s.category}</td>
                  <td>{s.email}</td>
                  <td>{s.phone || "—"}</td>
                  <td>
                    {user && can(user.role, "procurement.write") && (
                      <Button
                        variant="secondary small"
                        onClick={() => setEdit(s)}
                      >
                        Editar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty
            title="Sin proveedores registrados"
            text="Añade tus aliados para preparar solicitudes y comparar sus ofertas."
          />
        )}
      </section>
      {edit && (
        <SupplierForm
          supplier={edit === "new" ? undefined : edit}
          close={() => setEdit(null)}
        />
      )}
    </>
  );
}
export function Quotes() {
  const { state } = useStore();
  return (
    <>
      <PageHead
        title="Cotizaciones"
        description="Faltantes, ofertas y costos claros antes de aprobar."
      />
      <section className="panel">
        {state.projects.length ? (
          <Table>
            <thead>
              <tr>
                <th>Proyecto / cliente</th>
                <th>Rodaje</th>
                <th>Solicitud</th>
                <th>Ofertas</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      className="item-name"
                      to={`/proyectos/${p.id}/cotizacion`}
                    >
                      {p.name}
                    </Link>
                    <small>{p.client}</small>
                  </td>
                  <td>{dateRange(p)}</td>
                  <td>
                    {p.rfq ? (
                      <Badge tone="green">Registrada</Badge>
                    ) : (
                      <Badge>Sin solicitud</Badge>
                    )}
                  </td>
                  <td>
                    {state.offers.filter((o) => o.projectId === p.id).length}
                  </td>
                  <td>
                    <Badge tone={p.status === "aprobado" ? "green" : ""}>
                      {STATUS_LABEL[p.status]}
                    </Badge>
                  </td>
                  <td>
                    <Link
                      className="round-link"
                      to={`/proyectos/${p.id}/cotizacion`}
                      aria-label={`Ver cotización ${p.name}`}
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
            title="Primero, un proyecto"
            text="Las cotizaciones se construyen desde los materiales de un proyecto."
          />
        )}
      </section>
    </>
  );
}
function RfqForm({ project, close }: { project: Project; close: () => void }) {
  const { state, command } = useStore(),
    rows = inventoryCheck(state, project).filter((r) => r.shortage > 0);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    if (
      await command({
        type: "rfq.save",
        projectId: project.id,
        specs: str(d, "specs"),
        deadline: str(d, "deadline"),
        supplierIds: d.getAll("suppliers").map(String),
        itemIds: d.getAll("items").map(String),
      })
    )
      close();
  };
  return (
    <Modal title="Solicitud de cotización" close={close}>
      <form onSubmit={submit}>
        <p className="muted">
          Se registra la solicitud para compartirla manualmente con tus
          proveedores. No se envían correos desde esta plataforma.
        </p>
        <h3>Materiales faltantes</h3>
        <div className="checklist">
          {rows.map((r) => (
            <label key={r.item.id}>
              <input
                type="checkbox"
                name="items"
                value={r.item.id}
                defaultChecked
              />
              {r.item.name} · {r.shortage} unidades
            </label>
          ))}
          {!rows.length && <p>No hay faltantes en este proyecto.</p>}
        </div>
        <h3>Proveedores a consultar</h3>
        <div className="checklist">
          {state.suppliers.map((s) => (
            <label key={s.id}>
              <input
                name="suppliers"
                type="checkbox"
                value={s.id}
                defaultChecked={project.rfq?.supplierIds.includes(s.id)}
              />
              {s.name} · {s.category}
            </label>
          ))}
          {!state.suppliers.length && (
            <Link to="/proveedores">Registra primero un proveedor</Link>
          )}
        </div>
        <Field label="Fecha límite de respuesta">
          <input
            name="deadline"
            type="date"
            min={today()}
            defaultValue={project.rfq?.deadline || today()}
            required
          />
        </Field>
        <Field label="Especificaciones técnicas y condiciones">
          <textarea
            name="specs"
            defaultValue={project.rfq?.specs}
            required
            placeholder="Medidas, transporte, disponibilidad para el rodaje, impuestos…"
          />
        </Field>
        <div className="form-actions">
          <Button
            type="submit"
            disabled={!rows.length || !state.suppliers.length}
          >
            Registrar solicitud manual
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function OfferForm({
  project,
  offer,
  close,
}: {
  project: Project;
  offer?: Offer;
  close: () => void;
}) {
  const { state, command } = useStore();
  const rows = inventoryCheck(state, project).filter((r) => r.shortage > 0);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    if (
      await command({
        type: "offer.save",
        id: offer?.id,
        input: {
          projectId: project.id,
          supplierId: str(d, "supplierId"),
          itemId: str(d, "itemId"),
          qty: num(d, "qty"),
          price: num(d, "price"),
          leadDays: num(d, "leadDays"),
          available: d.get("available") === "on",
        },
      })
    )
      close();
  };
  return (
    <Modal
      title={offer ? "Editar oferta recibida" : "Registrar oferta recibida"}
      close={close}
    >
      <form onSubmit={submit}>
        <p className="muted">
          Registro manual de una respuesta del proveedor. El valor es el total
          de la oferta para la cantidad y el periodo solicitado.
        </p>
        <div className="form-grid">
          <Field label="Proveedor" wide>
            <select name="supplierId" defaultValue={offer?.supplierId} required>
              <option value="">Selecciona proveedor</option>
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Material" wide>
            <select name="itemId" defaultValue={offer?.itemId} required>
              <option value="">Selecciona artículo faltante</option>
              {rows.map((r) => (
                <option key={r.item.id} value={r.item.id}>
                  {r.item.name} · {r.shortage} unidades faltantes
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cantidad cubierta">
            <input
              type="number"
              name="qty"
              min="1"
              step="1"
              defaultValue={offer?.qty || 1}
              required
            />
          </Field>
          <Field label="Plazo de entrega (días)">
            <input
              type="number"
              name="leadDays"
              min="0"
              step="1"
              defaultValue={offer?.leadDays || 0}
              required
            />
          </Field>
          <Field label="Valor total oferta (COP)" wide>
            <input
              type="number"
              name="price"
              min="0"
              step="0.01"
              defaultValue={offer?.price || 0}
              required
            />
          </Field>
        </div>
        <label className="checkbox-row">
          <input
            name="available"
            type="checkbox"
            defaultChecked={offer?.available ?? true}
          />
          Proveedor confirma disponibilidad para el periodo
        </label>
        <div className="form-actions">
          <Button type="submit">Guardar oferta</Button>
        </div>
      </form>
    </Modal>
  );
}
export function QuoteDetail() {
  const { id } = useParams(),
    { state, user, command } = useStore(),
    [rfq, setRfq] = useState(false),
    [offer, setOffer] = useState<Offer | "new" | null>(null),
    [reject, setReject] = useState(false);
  const project = state.projects.find((p) => p.id === id);
  if (!project) return <Empty title="Proyecto no encontrado" />;
  const rows = inventoryCheck(state, project),
    shortages = rows.filter((r) => r.shortage > 0),
    offers = state.offers.filter((o) => o.projectId === project.id),
    writable = !!user && can(user.role, "procurement.write"),
    approvable = !!user && can(user.role, "quotes.approve"),
    locked = project.status === "aprobado" || project.status === "enviado";
  const totals = quoteTotals(state, project),
    { inventory: own, suppliers: external, subtotal, total } = totals;
  const snapshot = locked ? project.quoteSnapshot : undefined,
    days = snapshot?.days ?? shootingDays(project);
  const covered = snapshot
    ? true
    : shortages.every((r) => {
        const line = project.rfq?.lines.find((l) => l.itemId === r.item.id);
        return offers.some(
          (o) =>
            o.itemId === r.item.id &&
            o.supplierId === project.choices[r.item.id] &&
            project.rfq?.supplierIds.includes(o.supplierId) &&
            o.available &&
            o.qty >= r.shortage &&
            o.qty === line?.qty &&
            Date.parse(today()) + o.leadDays * 86400000 <=
              Date.parse(project.start),
        );
      });
  const saveCosts = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    await command({
      type: "quote.costs",
      projectId: project.id,
      costs: {
        personal: num(d, "personal"),
        polizas: num(d, "polizas"),
        margin: num(d, "margin"),
      },
    });
  };
  return (
    <>
      <Back to={`/proyectos/${id}`}>Proyecto</Back>
      <PageHead
        title={`Cotización · ${project.name}`}
        description={`${project.client} · ${dateRange(project)}`}
      >
        <Badge tone={project.status === "aprobado" ? "green" : ""}>
          {STATUS_LABEL[project.status]}
        </Badge>
        <Button
          variant="secondary"
          icon="download"
          onClick={() => window.print()}
        >
          Imprimir / PDF
        </Button>
      </PageHead>
      <div className="info-banner">
        <Icon name="info" />
        Solicitudes y ofertas se registran manualmente. La aprobación no genera
        compras, ingresos de stock, correos ni registros en Siigo.
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">01 · REQUERIMIENTOS EXTERNOS</span>
            <h2>Solicitud a proveedores</h2>
          </div>
          {writable && (
            <Button
              variant="secondary"
              icon="file"
              disabled={locked}
              onClick={() => setRfq(true)}
            >
              {project.rfq ? "Editar solicitud" : "Preparar solicitud"}
            </Button>
          )}
        </div>
        {project.rfq ? (
          <div className="rfq-summary">
            <Badge tone="green">Solicitud registrada · entrega manual</Badge>
            <p>{project.rfq.specs}</p>
            <div className="muted">
              Respuesta límite: {shortDate(project.rfq.deadline)} ·{" "}
              {project.rfq.supplierIds
                .map((s) => state.suppliers.find((x) => x.id === s)?.name)
                .filter(Boolean)
                .join(", ")}
            </div>
            <ul>
              {project.rfq.lines.map((l) => (
                <li key={l.itemId}>
                  {state.inventory.find((i) => i.id === l.itemId)?.name} ·{" "}
                  {l.qty} unidades · {l.rental ? "Alquiler" : "Compra"}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty
            title={
              shortages.length
                ? `${shortages.length} materiales requieren cobertura`
                : "Tu inventario cubre los materiales"
            }
            text={
              shortages.length
                ? "Prepara una solicitud y compártela manualmente con tus proveedores."
                : "Puedes continuar con el presupuesto del proyecto."
            }
          />
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">02 · COMPARAR Y ELEGIR</span>
            <h2>Ofertas de proveedores</h2>
          </div>
          {writable && (
            <Button
              icon="plus"
              variant="secondary"
              disabled={locked || !shortages.length}
              onClick={() => setOffer("new")}
            >
              Registrar oferta
            </Button>
          )}
        </div>
        {snapshot && (
          <>
            <div className="info-banner">
              <Icon name="lock" />
              Presupuesto fijado al enviar a aprobación. Los valores y
              materiales se conservan aunque cambie el inventario.
            </div>
            <Table>
              <thead>
                <tr>
                  <th>Material / origen</th>
                  <th>Cantidad</th>
                  <th>Tarifa / total</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.ownLines.map((l) => (
                  <tr key={`own-${l.itemId}`}>
                    <td>
                      <strong>{l.name}</strong>
                      <small>Inventario propio · {snapshot.days} días</small>
                    </td>
                    <td>{l.qty}</td>
                    <td>{money(l.dailyRate)} / día</td>
                  </tr>
                ))}
                {snapshot.supplierLines.map((l) => (
                  <tr key={`supplier-${l.itemId}`}>
                    <td>
                      <strong>{l.name}</strong>
                      <small>{l.supplierName}</small>
                    </td>
                    <td>{l.qty}</td>
                    <td>{money(l.price)} total</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
        {!snapshot &&
          shortages.map((r) => (
            <div className="comparison-group" key={r.item.id}>
              <div className="comparison-title">
                <h3>{r.item.name}</h3>
                <Badge tone="amber">{r.shortage} unidades faltantes</Badge>
              </div>
              {offers.some((o) => o.itemId === r.item.id) ? (
                <Table>
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Cantidad</th>
                      <th>Entrega</th>
                      <th>Valor total</th>
                      <th>Disponibilidad</th>
                      <th>Selección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers
                      .filter((o) => o.itemId === r.item.id)
                      .map((o) => (
                        <tr
                          key={o.id}
                          className={
                            project.choices[r.item.id] === o.supplierId
                              ? "selected-row"
                              : ""
                          }
                        >
                          <td>
                            <strong>
                              {
                                state.suppliers.find(
                                  (s) => s.id === o.supplierId,
                                )?.name
                              }
                            </strong>
                            {writable && !locked && (
                              <button
                                className="inline-link"
                                onClick={() => setOffer(o)}
                              >
                                Editar oferta
                              </button>
                            )}
                          </td>
                          <td>{o.qty}</td>
                          <td>{o.leadDays} días</td>
                          <td className="mono">{money(o.price)}</td>
                          <td>
                            <Badge
                              tone={
                                o.available && o.qty >= r.shortage
                                  ? "green"
                                  : "amber"
                              }
                            >
                              {o.available
                                ? o.qty >= r.shortage
                                  ? "Cubre faltante"
                                  : "Cantidad insuficiente"
                                : "No disponible"}
                            </Badge>
                          </td>
                          <td>
                            {project.choices[r.item.id] === o.supplierId ? (
                              <Badge tone="green">✓ Seleccionada</Badge>
                            ) : (
                              writable && (
                                <Button
                                  variant="secondary small"
                                  disabled={
                                    locked || !o.available || o.qty < r.shortage
                                  }
                                  onClick={() =>
                                    void command({
                                      type: "offer.choose",
                                      projectId: project.id,
                                      itemId: r.item.id,
                                      supplierId: o.supplierId,
                                    })
                                  }
                                >
                                  Elegir oferta
                                </Button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </Table>
              ) : (
                <p className="comparison-empty">
                  Sin ofertas registradas para este material.
                </p>
              )}
            </div>
          ))}
        {!snapshot && !shortages.length && (
          <Empty
            title="No hay faltantes que cotizar"
            text="Los materiales están cubiertos por capacidad propia para las fechas del rodaje."
          />
        )}
      </section>
      <div className="quote-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">03 · PRESUPUESTO</span>
              <h2>Costos del proyecto</h2>
            </div>
          </div>
          <form className="cost-form" onSubmit={saveCosts} key={project.id}>
            <div className="form-grid">
              <Field label="Personal (COP)">
                <input
                  type="number"
                  min="0"
                  name="personal"
                  defaultValue={project.costs.personal}
                  required
                  disabled={!writable || locked}
                />
              </Field>
              <Field label="Pólizas (COP)">
                <input
                  type="number"
                  min="0"
                  name="polizas"
                  defaultValue={project.costs.polizas}
                  required
                  disabled={!writable || locked}
                />
              </Field>
              <Field label="Margen (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  name="margin"
                  defaultValue={project.costs.margin}
                  required
                  disabled={!writable || locked}
                />
              </Field>
            </div>
            {writable && !locked && (
              <div className="form-actions">
                <Button variant="secondary" type="submit">
                  Guardar costos
                </Button>
              </div>
            )}
          </form>
        </section>
        <section className="panel quote-total">
          <span className="eyebrow">RESUMEN DEL PRESUPUESTO</span>
          <dl>
            <div>
              <dt>Equipo propio · {days} días</dt>
              <dd>{money(own)}</dd>
            </div>
            <div>
              <dt>Ofertas seleccionadas</dt>
              <dd>{money(external)}</dd>
            </div>
            <div>
              <dt>Personal</dt>
              <dd>{money(totals.personal)}</dd>
            </div>
            <div>
              <dt>Pólizas</dt>
              <dd>{money(totals.polizas)}</dd>
            </div>
            <div>
              <dt>Subtotal</dt>
              <dd>{money(subtotal)}</dd>
            </div>
            <div>
              <dt>Margen · {project.costs.margin}%</dt>
              <dd>{money(totals.margin)}</dd>
            </div>
          </dl>
          <div className="grand-total">
            <span>Total estimado</span>
            <strong>{money(total)}</strong>
          </div>
          <Badge tone={covered ? "green" : "amber"}>
            {covered
              ? "Materiales con cobertura"
              : "Faltan ofertas suficientes seleccionadas"}
          </Badge>
          {writable && !locked && (
            <Button
              icon="send"
              disabled={!covered || !rows.length}
              onClick={() =>
                void command({ type: "quote.submit", projectId: project.id })
              }
            >
              Enviar a aprobación interna
            </Button>
          )}
          {approvable && project.status === "enviado" && (
            <div className="button-group">
              <Button
                icon="check"
                disabled={!covered}
                onClick={() =>
                  void command({ type: "quote.approve", projectId: project.id })
                }
              >
                Aprobar
              </Button>
              <Button
                variant="secondary danger"
                onClick={() => setReject(true)}
              >
                Rechazar
              </Button>
            </div>
          )}
          <p className="footnote">
            La validación final revisa cobertura, cantidades y disponibilidad al
            guardar.
          </p>
        </section>
      </div>
      {rfq && <RfqForm project={project} close={() => setRfq(false)} />}
      {offer && (
        <OfferForm
          project={project}
          offer={offer === "new" ? undefined : offer}
          close={() => setOffer(null)}
        />
      )}
      {reject && (
        <Modal title="Rechazar cotización" close={() => setReject(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await command({
                  type: "quote.reject",
                  projectId: project.id,
                  notes: str(new FormData(e.currentTarget), "notes"),
                })
              )
                setReject(false);
            }}
          >
            <Field label="Motivo y cambios requeridos">
              <textarea name="notes" required />
            </Field>
            <div className="form-actions">
              <Button type="submit" variant="danger">
                Confirmar rechazo
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
