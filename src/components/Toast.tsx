import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastKind = "success" | "error";
type ToastItem = { id: number; kind: ToastKind; message: string };
type Toasts = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<Toasts>({ success: () => {}, error: () => {} });
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

const DURATION_MS = 4500;
let nextId = 1;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback(
    (id: number) => setItems((all) => all.filter((t) => t.id !== id)),
    []
  );
  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setItems((all) => [...all.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss]
  );
  const api = useMemo<Toasts>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`toast-item toast-${t.kind}`}
            onClick={() => dismiss(t.id)}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
