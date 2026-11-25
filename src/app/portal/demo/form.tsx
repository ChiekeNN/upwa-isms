"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Field, Select, inputClass } from "./ui";

/**
 * Schema-driven form used by every editable module in the demo portal, so
 * creating and editing a record behaves identically whether it is a pupil, an
 * invoice line or a term date.
 */

export type FieldSchema = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea" | "tel" | "email";
  options?: (string | { value: string; label: string })[];
  required?: boolean;
  hint?: string;
  full?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  readOnly?: boolean;
};

export type FormValues = Record<string, string | number>;

function optionList(options: FieldSchema["options"]) {
  return (options ?? []).map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
}

export function SchemaForm({
  schema,
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = "Save changes",
  columns = 2,
  note,
}: {
  schema: FieldSchema[];
  value: FormValues;
  onChange: (next: FormValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  columns?: 1 | 2;
  note?: ReactNode;
}) {
  const [touched, setTouched] = useState(false);

  function setValue(name: string, next: string | number) {
    onChange({ ...value, [name]: next });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    const missing = schema.filter((field) => field.required && String(value[field.name] ?? "").trim() === "");
    if (missing.length > 0) return;
    onSubmit();
  }

  const missingFields = touched
    ? schema.filter((field) => field.required && String(value[field.name] ?? "").trim() === "")
    : [];

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className={`grid gap-4 ${columns === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
        {schema.map((field) => {
          const isMissing = missingFields.some((item) => item.name === field.name);
          const common = {
            id: `field-${field.name}`,
            name: field.name,
            required: field.required,
            readOnly: field.readOnly,
            className: `${inputClass} ${isMissing ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : ""}`,
          };

          return (
            <Field
              key={field.name}
              label={field.label}
              hint={isMissing ? "This field is required." : field.hint}
              required={field.required}
              className={field.full ? "sm:col-span-2" : ""}
            >
              {field.type === "select" ? (
                <Select
                  {...common}
                  value={String(value[field.name] ?? "")}
                  onChange={(event) => setValue(field.name, event.target.value)}
                >
                  {!field.required ? <option value="">— select —</option> : null}
                  {optionList(field.options).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : field.type === "textarea" ? (
                <textarea
                  {...common}
                  rows={4}
                  placeholder={field.placeholder}
                  value={String(value[field.name] ?? "")}
                  onChange={(event) => setValue(field.name, event.target.value)}
                />
              ) : (
                <input
                  {...common}
                  type={field.type ?? "text"}
                  inputMode={field.type === "number" ? "decimal" : undefined}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  placeholder={field.placeholder}
                  value={String(value[field.name] ?? "")}
                  onChange={(event) =>
                    setValue(
                      field.name,
                      field.type === "number"
                        ? event.target.value === ""
                          ? ""
                          : Number(event.target.value)
                        : event.target.value,
                    )
                  }
                />
              )}
            </Field>
          );
        })}
      </div>

      {note ? <div className="mt-5">{note}</div> : null}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 pt-5">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Builds an empty record matching a schema, used when opening a create form. */
export function blankFrom(schema: FieldSchema[], seed: FormValues = {}): FormValues {
  const base: FormValues = {};
  schema.forEach((field) => {
    base[field.name] = field.type === "number" ? 0 : "";
  });
  return { ...base, ...seed };
}

/** Coerces form strings back into the numeric fields the domain expects. */
export function coerceFrom(schema: FieldSchema[], values: FormValues): FormValues {
  const next: FormValues = { ...values };
  schema.forEach((field) => {
    if (field.type === "number") {
      const parsed = Number(next[field.name]);
      next[field.name] = Number.isFinite(parsed) ? parsed : 0;
    } else {
      next[field.name] = String(next[field.name] ?? "").trim();
    }
  });
  return next;
}
