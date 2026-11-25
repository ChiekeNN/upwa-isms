"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Info,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { avatarTone, initialsOf } from "./format";

/** Shared presentational primitives for the demonstration portal. */

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-upwa-blue-500 focus:ring-2 focus:ring-upwa-blue-100 disabled:bg-slate-50 disabled:text-slate-500";

export const selectClass = `${inputClass} appearance-none bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10`;

const CHEVRON_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";

export function Select({ className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${selectClass} ${className}`} style={{ backgroundImage: CHEVRON_SVG }} {...props} />;
}

/* --------------------------------- badges -------------------------------- */

const BADGE_TONES = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-upwa-blue-50 text-upwa-blue-800 ring-upwa-blue-200",
  green: "bg-upwa-green-50 text-upwa-green-800 ring-upwa-green-200",
  orange: "bg-upwa-orange-50 text-upwa-orange-800 ring-upwa-orange-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  navy: "bg-upwa-navy text-white ring-upwa-navy",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Maps the domain's status strings onto badge colours consistently everywhere. */
export function statusTone(status: string): BadgeTone {
  const value = status.toUpperCase();
  if (["PAID", "CONFIRMED", "PRESENT", "ACTIVE", "ENROLLED", "SENT", "COMPLETED", "CLEARED"].includes(value)) return "green";
  if (["PART_PAYMENT", "LATE", "PENDING_REVIEW", "UNDER_REVIEW", "SCHEDULED", "WAITLISTED", "EXAM_SCHEDULED", "ON_LEAVE", "DRAFT"].includes(value)) return "orange";
  if (["OVERDUE", "OUTSTANDING", "ABSENT", "REJECTED", "DECLINED", "FAIL", "WITHDRAWN", "SUSPENDED", "RESIGNED"].includes(value)) return "red";
  if (["OFFER_MADE", "GRADUATED", "EXCUSED", "F9", "E8"].includes(value)) return "violet";
  return "blue";
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge tone={statusTone(status)}>
      {label ?? status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </Badge>
  );
}

/* -------------------------------- buttons -------------------------------- */

const BUTTON_VARIANTS = {
  primary: "bg-upwa-navy text-white hover:bg-upwa-blue-900 shadow-sm",
  accent: "bg-upwa-orange-500 text-upwa-midnight hover:bg-upwa-orange-400 shadow-sm",
  outline: "border border-slate-300 bg-white text-slate-700 hover:border-upwa-navy/35 hover:bg-upwa-canvas",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-500 shadow-sm",
  dangerOutline: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  subtle: "bg-upwa-blue-50 text-upwa-blue-800 hover:bg-upwa-blue-100",
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export function Button({
  children,
  variant = "outline",
  size = "md",
  icon,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: ReactNode;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
        BUTTON_VARIANTS[variant]
      } ${size === "sm" ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  onClick,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        tone === "danger" ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600" : "text-slate-400 hover:bg-slate-100 hover:text-upwa-blue-800"
      }`}
    >
      {children}
    </button>
  );
}

/* -------------------------------- surfaces ------------------------------- */

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-panel ${padded ? "p-5 sm:p-6" : ""} ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-upwa-blue-50 text-upwa-blue-800">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="font-display text-base font-bold text-upwa-navy">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  note,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  note?: string;
  icon: ReactNode;
  tone?: "blue" | "green" | "orange" | "violet" | "navy";
}) {
  const tones = {
    blue: "bg-upwa-blue-50 text-upwa-blue-800",
    green: "bg-upwa-green-50 text-upwa-green-800",
    orange: "bg-upwa-orange-50 text-upwa-orange-800",
    violet: "bg-violet-50 text-violet-800",
    navy: "bg-upwa-navy text-white",
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel transition-all duration-300 hover:-translate-y-0.5 hover:shadow-panel-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 font-display text-2xl font-bold tracking-tight text-upwa-navy">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
      </div>
      {note ? <p className="mt-3 text-[11px] leading-4 text-slate-500">{note}</p> : null}
    </article>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-8 w-8 text-[10px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-base" };
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${sizes[size]} ${avatarTone(name)}`}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}

/* --------------------------------- modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-upwa-midnight/55 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" aria-label="Close dialog" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-fade-up relative z-10 w-full ${widths[size]} rounded-t-3xl bg-white shadow-panel-lg sm:rounded-3xl`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-upwa-navy">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" icon={<Trash2 size={15} />} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <AlertTriangle size={19} />
        </span>
        <p className="text-sm leading-6 text-slate-600">{body}</p>
      </div>
    </Modal>
  );
}

/* --------------------------------- fields -------------------------------- */

export function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-700">
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] leading-4 text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800 sm:text-right">{children}</dd>
    </div>
  );
}

/* ------------------------------- data table ------------------------------ */

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  searchValue?: (row: T) => string;
  align?: "left" | "right" | "center";
  hideBelow?: "sm" | "md" | "lg" | "xl";
};

const HIDE_CLASS: Record<string, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export function DataTable<T>({
  rows,
  columns,
  getId,
  title,
  subtitle,
  searchPlaceholder = "Search records…",
  toolbar,
  addLabel,
  onAdd,
  onView,
  onEdit,
  onDelete,
  pageSize = 8,
  emptyTitle = "No records yet",
  emptyBody = "Create the first record to see how this module works.",
}: {
  rows: T[];
  columns: Column<T>[];
  getId: (row: T) => string;
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  addLabel?: string;
  onAdd?: () => void;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const searchable = columns.filter((column) => column.searchValue);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      searchable.some((column) => String(column.searchValue?.(row) ?? "").toLowerCase().includes(needle)),
    );
  }, [rows, query, searchable]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const column = columns.find((item) => item.key === sortKey);
    if (!column?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      if (typeof left === "number" && typeof right === "number") return sortDir === "asc" ? left - right : right - left;
      return sortDir === "asc"
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left));
    });
  }, [filtered, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  const alignClass = (align?: string) => (align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left");

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
      {(title || toolbar || onAdd) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            {title ? <h3 className="font-display text-base font-bold text-upwa-navy">{title}</h3> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {toolbar}
            {onAdd && addLabel ? (
              <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={onAdd}>
                {addLabel}
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-upwa-blue-500 focus:ring-2 focus:ring-upwa-blue-100"
          />
        </div>
        <p className="text-xs text-slate-500">
          <strong className="font-semibold text-slate-700">{sorted.length}</strong> record{sorted.length === 1 ? "" : "s"}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Search size={20} />
          </span>
          <p className="mt-4 font-display text-base font-bold text-upwa-navy">{emptyTitle}</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{emptyBody}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-[10px] uppercase tracking-wider text-slate-500">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-5 py-3 font-semibold ${HIDE_CLASS[column.hideBelow ?? ""] ?? ""} ${alignClass(column.align)}`}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex items-center gap-1 transition-colors hover:text-upwa-blue-800"
                      >
                        {column.header}
                        {sortKey === column.key ? (
                          sortDir === "asc" ? (
                            <ChevronUp size={12} />
                          ) : (
                            <ChevronDown size={12} />
                          )
                        ) : (
                          <ChevronDown size={12} className="opacity-25" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
                {onView || onEdit || onDelete ? (
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((row) => (
                <tr key={getId(row)} className="transition-colors hover:bg-upwa-canvas/60">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-5 py-3.5 align-middle ${HIDE_CLASS[column.hideBelow ?? ""] ?? ""} ${alignClass(column.align)}`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                  {onView || onEdit || onDelete ? (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {onView ? (
                          <IconButton label="View record" onClick={() => onView(row)}>
                            <Search size={15} />
                          </IconButton>
                        ) : null}
                        {onEdit ? (
                          <IconButton label="Edit record" onClick={() => onEdit(row)}>
                            <Pencil size={15} />
                          </IconButton>
                        ) : null}
                        {onDelete ? (
                          <IconButton label="Delete record" tone="danger" onClick={() => onDelete(row)}>
                            <Trash2 size={15} />
                          </IconButton>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-500">
            Page <strong className="font-semibold text-slate-700">{safePage + 1}</strong> of {pageCount}
          </p>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} icon={<ChevronLeft size={14} />}>
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------- toasts -------------------------------- */

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; message: string; detail?: string; tone: "success" | "info" | "danger" }[];
  onDismiss: (id: string) => void;
}) {
  const icons = {
    success: <Check size={16} className="text-upwa-green-700" />,
    info: <Info size={16} className="text-upwa-blue-700" />,
    danger: <XCircle size={16} className="text-rose-600" />,
  };
  const rings = {
    success: "border-upwa-green-200",
    info: "border-upwa-blue-200",
    danger: "border-rose-200",
  };

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[min(23rem,calc(100vw-2.5rem))] flex-col gap-2.5">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`animate-fade-up pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-panel-lg ${rings[toast.tone]}`}
        >
          <span className="mt-0.5">{icons[toast.tone]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-upwa-navy">{toast.message}</p>
            {toast.detail ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{toast.detail}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="rounded p-0.5 text-slate-400 hover:text-slate-700"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- tabs --------------------------------- */

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
            active === tab.key ? "bg-white text-upwa-navy shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.label}
          {typeof tab.count === "number" ? (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active === tab.key ? "bg-upwa-blue-50 text-upwa-blue-800" : "bg-slate-200 text-slate-600"}`}>
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
