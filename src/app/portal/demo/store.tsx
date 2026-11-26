"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { academicContext, buildDemoData } from "./seed";
import { uid } from "./format";
import type { CollectionKey, DemoData, EntityOf } from "./types";

/**
 * Client-side data layer for the demonstration portal.
 *
 * Records live in `localStorage` so that creating, editing and deleting during a
 * client presentation persists across refreshes and survives navigating between
 * modules — which is what makes the preview feel like a working product.
 *
 * Nothing here touches Supabase or any network endpoint. The school's real
 * records are never read, written or exposed by this workspace.
 */

const STORAGE_KEY = "upwa-isms:demo-portal";
const STORAGE_VERSION = 5;

const ID_PREFIX: Record<CollectionKey, string> = {
  students: "stu",
  guardians: "grd",
  staff: "stf",
  subjects: "sub",
  attendance: "att",
  scores: "sco",
  invoices: "inv",
  payments: "pay",
  applications: "adm",
  events: "evt",
  messages: "msg",
  expenses: "exp",
  bankCredits: "bnk",
  parentConfirmations: "pcf",
  expenseApprovals: "apr",
  attestations: "atst",
  auditLog: "aud",
  concerns: "con",
  presidentActions: "pac",
  budgets: "bud",
  receiptBooks: "rcb",
};

export type Toast = {
  id: string;
  message: string;
  detail?: string;
  tone: "success" | "info" | "danger";
};

type DemoStore = {
  data: DemoData | null;
  ready: boolean;
  create: <K extends CollectionKey>(key: K, entity: Omit<EntityOf<K>, "id">) => EntityOf<K>;
  update: <K extends CollectionKey>(key: K, id: string, patch: Partial<EntityOf<K>>) => void;
  remove: (key: CollectionKey, id: string) => void;
  replaceAll: <K extends CollectionKey>(key: K, records: EntityOf<K>[]) => void;
  updateSettings: (patch: Partial<DemoData["settings"]>) => void;
  reset: () => void;
  toasts: Toast[];
  notify: (message: string, tone?: Toast["tone"], detail?: string) => void;
  dismissToast: (id: string) => void;
};

/**
 * Exported so a single module can be rendered in isolation (tests, storybook-style
 * previews) by supplying a store value directly instead of mounting the provider.
 */
export const DemoContext = createContext<DemoStore | null>(null);

function readStored(): DemoData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; session?: string; data?: DemoData };
    if (parsed.version !== STORAGE_VERSION || !parsed.data) return null;
    // Reseed when the stored snapshot belongs to a different academic session so
    // the demo never presents last term's dates as current.
    if (parsed.session !== academicContext().session) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DemoData | null>(null);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Hydrate after mount only, so server and client markup stay identical.
  useEffect(() => {
    setData(readStored() ?? buildDemoData());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !data) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, session: data.settings.session, data }),
      );
    } catch {
      // Storage may be unavailable (private browsing); the demo still works in memory.
    }
  }, [data, ready]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: Toast["tone"] = "success", detail?: string) => {
      const id = uid("toast");
      setToasts((current) => [...current.slice(-3), { id, message, detail, tone }]);
      window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast],
  );

  const create = useCallback<DemoStore["create"]>(
    (key, entity) => {
      const record = { ...entity, id: uid(ID_PREFIX[key]) } as EntityOf<typeof key>;
      setData((current) =>
        current ? ({ ...current, [key]: [record, ...current[key]] } as DemoData) : current,
      );
      return record;
    },
    [],
  );

  const update = useCallback<DemoStore["update"]>((key, id, patch) => {
    setData((current) => {
      if (!current) return current;
      const next = current[key].map((record) =>
        record.id === id ? ({ ...record, ...patch } as typeof record) : record,
      );
      return { ...current, [key]: next } as DemoData;
    });
  }, []);

  const remove = useCallback<DemoStore["remove"]>((key, id) => {
    setData((current) => {
      if (!current) return current;
      return { ...current, [key]: current[key].filter((record) => record.id !== id) } as DemoData;
    });
  }, []);

  const replaceAll = useCallback<DemoStore["replaceAll"]>((key, records) => {
    setData((current) => (current ? ({ ...current, [key]: records } as DemoData) : current));
  }, []);

  const updateSettings = useCallback<DemoStore["updateSettings"]>((patch) => {
    setData((current) => (current ? { ...current, settings: { ...current.settings, ...patch } } : current));
  }, []);

  const reset = useCallback(() => {
    const fresh = buildDemoData();
    setData(fresh);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures on reset.
    }
    notify("Demonstration data restored", "info", "Every record is back to its original seeded state.");
  }, [notify]);

  const value = useMemo<DemoStore>(
    () => ({ data, ready, create, update, remove, replaceAll, updateSettings, reset, toasts, notify, dismissToast }),
    [data, ready, create, update, remove, replaceAll, updateSettings, reset, toasts, notify, dismissToast],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemo must be used inside <DemoProvider>");
  return context;
}

/** Convenience accessor that guarantees hydrated data inside the workspace. */
export function useDemoData(): DemoData {
  const { data } = useDemo();
  if (!data) throw new Error("Demo data is not ready");
  return data;
}
