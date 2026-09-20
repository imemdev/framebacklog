"use client";
import { Children, cloneElement, isValidElement, useId, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  CheckCheck,
  CheckCircle2,
  Circle,
  Clock3,
  AlertCircle,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { Task } from "@/lib/model";
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const r = await fetch(path.startsWith("/api/") ? path : `/api/v1/${path}`, {
    ...options,
    headers: {
      ...(options.body && typeof options.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(
      new Error(
        r.status === 429
          ? "Too many requests. Please wait a minute, then try again."
          : data.error || data.message || "Request failed",
      ),
      {
        status: r.status,
        details: data.details,
      },
    );
  return data;
}
export function write<T = unknown>(
  path: string,
  data: unknown,
  method = "POST",
  idempotent = false,
) {
  return api<T>(path, {
    method,
    body: JSON.stringify(data),
    headers:
      idempotent || method === "POST"
        ? { "Idempotency-Key": crypto.randomUUID() }
        : undefined,
  });
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span id={`${id}-label`}>{label}</span>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        ["input", "select", "textarea"].includes(String(child.type))
          ? cloneElement(child as React.ReactElement<Record<string, unknown>>, {
              id,
              "aria-labelledby": `${id}-label`,
              "aria-describedby": hint ? `${id}-hint` : undefined,
            })
          : child,
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const reduced = useReducedMotion();
  const opener = useRef<HTMLElement | null>(
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement),
  );
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={`panel ${wide ? "wide" : ""}`}
          asChild
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
            else
              (
                document.querySelector('[role="dialog"]') as HTMLElement | null
              )?.focus();
          }}
        >
          <motion.section
            initial={{ opacity: 0, x: reduced ? 0 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          >
            <header className="panel-header">
              <div>
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Description
                  className={description ? "muted" : "sr-only"}
                >
                  {description || "Review or edit the selected item."}
                </Dialog.Description>
              </div>
              <Dialog.Close className="icon-button" aria-label="Close panel">
                <X size={20} />
              </Dialog.Close>
            </header>
            {children}
          </motion.section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function StatusIcon({ status }: { status: Task["status"] }) {
  const Icon =
    status === "Done reviewed"
      ? CheckCheck
      : status === "Done"
        ? CheckCircle2
        : status === "In progress"
          ? Clock3
          : Circle;
  return <Icon size={15} aria-hidden />;
}
export function Status({ status }: { status: Task["status"] }) {
  return (
    <span
      className={`status status-${status.replaceAll(" ", "-").toLowerCase()}`}
    >
      <StatusIcon status={status} />
      {status}
    </span>
  );
}
export function ErrorNotice({ error }: { error: string }) {
  return error ? (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      <span>{error}</span>
    </div>
  ) : null;
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <CheckCircle2 size={26} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export const stamp = (s: string) =>
  new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
