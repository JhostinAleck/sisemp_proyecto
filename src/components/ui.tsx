import {
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
  type ReactElement,
} from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import { useStore } from "../app/store";
import { businessDate } from "../domains/shared/format";
export function Button({
  children,
  icon,
  variant = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconName;
  variant?: string;
}) {
  const { pending } = useStore();
  return (
    <button
      {...props}
      disabled={props.disabled || pending}
      className={`button ${variant} ${props.className || ""}`}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
export function PageHead({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow">
          {eyebrow || "BURNING BULL · OPERACIONES"}
        </span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="head-actions">{children}</div>
    </header>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <div className={`field ${wide ? "wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id: string }>, { id })
        : children}
    </div>
  );
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name="box" size={28} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const { error } = useStore();
  return (
    <div
      className="modal-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Cerrar">
            ×
          </button>
        </header>
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        {children}
      </section>
    </div>
  );
}
export function Back({
  to,
  children = "Volver",
}: {
  to: string;
  children?: ReactNode;
}) {
  return (
    <Link className="back-link" to={to}>
      <Icon name="back" />
      {children}
    </Link>
  );
}
export function Stat({
  title,
  value,
  detail,
  icon,
  tone = "",
}: {
  title: string;
  value: string | number;
  detail?: string;
  icon: IconName;
  tone?: string;
}) {
  return (
    <article className={`stat ${tone}`}>
      <span className="stat-label">
        {title}
        <Icon name={icon} size={18} />
      </span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="table-scroll">
      <table>{children}</table>
    </div>
  );
}
export const today = () => businessDate();
export const num = (data: FormData, key: string) => Number(data.get(key) || 0);
export const str = (data: FormData, key: string) =>
  String(data.get(key) || "").trim();
