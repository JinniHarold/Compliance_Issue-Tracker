import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles =
    variant === "primary"
      ? "border px-3 py-2 font-medium"
      : "border px-3 py-2";
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md text-sm disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border px-3 py-2 text-sm ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border px-3 py-2 text-sm ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border px-3 py-2 text-sm ${props.className ?? ""}`}
    />
  );
}

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-sm">{error}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border p-4 ${className}`}>{children}</section>;
}

export function Alert({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-md border px-3 py-2 text-sm">{children}</p>;
}

export function Spinner({ label = "Loading..." }: { label?: string }) {
  return <p role="status" className="text-sm">{label}</p>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm">{children}</p>;
}

export function Heading({ level = 2, children }: { level?: 1 | 2; children: ReactNode }) {
  const className = level === 1 ? "text-xl font-semibold" : "text-lg font-semibold";
  return level === 1 ? <h1 className={className}>{children}</h1> : <h2 className={className}>{children}</h2>;
}

export function TextContent({ children }: { children: ReactNode }) {
  return <div className="whitespace-pre-wrap">{children}</div>;
}

export function TableContainer({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Table({ children }: { children: ReactNode }) {
  return <table className="w-full text-left text-sm">{children}</table>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b text-xs font-medium">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y">{children}</tbody>;
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}

export function TableHeader({ children }: { children: ReactNode }) {
  return <th scope="col" className="px-3 py-2 font-medium">{children}</th>;
}

export function TableCell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="dialog-title"
      className="m-auto max-h-[90vh] w-[min(42rem,calc(100%-2rem))] overflow-y-auto rounded-lg border p-0"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="space-y-4 p-5">
        <h2 id="dialog-title" className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total?: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
      <span className="text-sm">Page {page} of {pages}{total !== undefined ? ` (${total})` : ""}</span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
    </nav>
  );
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-2">
      {items.map((item) => (
        <Button
          key={item.value}
          role="tab"
          aria-selected={value === item.value}
          variant={value === item.value ? "primary" : "secondary"}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
