import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Heading,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
} from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { ApiError, api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { UserRow } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const ROLES = ["admin", "owner", "auditor"] as const;
type ManagedRole = (typeof ROLES)[number];

interface NewUser {
  email: string;
  name: string;
  role: ManagedRole;
  password: string;
}

const EMPTY_USER: NewUser = { email: "", name: "", role: "owner", password: "" };

export default function Users() {
  const { user: currentUser } = useAuth();
  const { data, error, loading, reload } = useFetch<{ users: UserRow[] }>("/users");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewUser>(EMPTY_USER);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function updateRole(target: UserRow, role: ManagedRole) {
    setRowErrors((previous) => ({ ...previous, [target.id]: "" }));
    setBusyId(target.id);
    try {
      await api<{ user: UserRow }>(`/users/${encodeURIComponent(target.id)}/role`, {
        method: "PATCH",
        body: { role },
      });
      reload();
    } catch (reason: unknown) {
      setRowErrors((previous) => ({ ...previous, [target.id]: reason instanceof Error ? reason.message : "Could not change role." }));
    } finally {
      setBusyId(null);
    }
  }

  async function setActive(target: UserRow, active: boolean) {
    const verb = active ? "Reactivate" : "Deactivate";
    if (!active && !window.confirm(`Deactivate ${target.name}?`)) return;
    setRowErrors((previous) => ({ ...previous, [target.id]: "" }));
    setBusyId(target.id);
    try {
      await api<{ user: UserRow }>(`/users/${encodeURIComponent(target.id)}/${active ? "reactivate" : "deactivate"}`, {
        method: "POST",
      });
      reload();
    } catch (reason: unknown) {
      setRowErrors((previous) => ({ ...previous, [target.id]: reason instanceof Error ? reason.message : `Could not ${verb.toLowerCase()} user.` }));
    } finally {
      setBusyId(null);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await api<{ user: UserRow }>("/users", { method: "POST", body: form });
      setDialogOpen(false);
      setForm(EMPTY_USER);
      reload();
    } catch (reason: unknown) {
      setSubmitError(reason instanceof Error ? reason.message : "Could not create user.");
      if (reason instanceof ApiError && reason.details) {
        setFieldErrors(Object.fromEntries(reason.details.map(({ path, message }) => [path, message])));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={1}>Users</Heading>
        <Button onClick={() => {
          setForm(EMPTY_USER);
          setSubmitError(null);
          setFieldErrors({});
          setDialogOpen(true);
        }}>
          New user
        </Button>
      </div>
      {error && <Alert>{error.message}</Alert>}
      {loading ? (
        <Spinner label="Loading users..." />
      ) : !error && data && data.users.length === 0 ? (
        <Card><EmptyState>No users found.</EmptyState></Card>
      ) : !error && data ? (
        <>
          <div className="hidden md:block">
            <Card className="p-0">
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Name</TableHeader>
                      <TableHeader>Email</TableHeader>
                      <TableHeader>Role</TableHeader>
                      <TableHeader>Active</TableHeader>
                      <TableHeader>Created</TableHeader>
                      <TableHeader>Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.users.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.role === "agent" ? "Service account" : row.role}</TableCell>
                        <TableCell>{row.is_active ? "Active" : "Inactive"}</TableCell>
                        <TableCell>{formatDateTime(row.created_at)}</TableCell>
                        <TableCell>
                          <UserActions
                            row={row}
                            isSelf={row.id === currentUser?.id}
                            busy={busyId === row.id}
                            error={rowErrors[row.id]}
                            onRoleChange={(role) => updateRole(row, role)}
                            onActiveChange={(active) => setActive(row, active)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </div>
          <div className="grid gap-3 md:hidden">
            {data.users.map((row) => (
              <Card key={row.id}>
                <div className="space-y-2">
                  <p>{row.name}</p>
                  <p>{row.email}</p>
                  <p>{row.role === "agent" ? "Service account" : row.role}</p>
                  <p>{row.is_active ? "Active" : "Inactive"}</p>
                  <p>Created {formatDateTime(row.created_at)}</p>
                  <UserActions
                    row={row}
                    isSelf={row.id === currentUser?.id}
                    busy={busyId === row.id}
                    error={rowErrors[row.id]}
                    onRoleChange={(role) => updateRole(row, role)}
                    onActiveChange={(active) => setActive(row, active)}
                  />
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="New user">
        <form className="space-y-4" onSubmit={createUser}>
          {submitError && <Alert>{submitError}</Alert>}
          <Field id="new-email" label="Email" error={fieldErrors.email}>
            <TextInput id="new-email" type="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field id="new-name" label="Name" error={fieldErrors.name}>
            <TextInput id="new-name" required minLength={1} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field id="new-role" label="Role" error={fieldErrors.role}>
            <Select id="new-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as ManagedRole })}>
              {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </Select>
          </Field>
          <Field id="new-password" label="Password" error={fieldErrors.password}>
            <TextInput id="new-password" type="password" required maxLength={72} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            <p className="text-sm">Password must be 12 to 72 characters.</p>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create user"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function UserActions({
  row,
  isSelf,
  busy,
  error,
  onRoleChange,
  onActiveChange,
}: {
  row: UserRow;
  isSelf: boolean;
  busy: boolean;
  error?: string;
  onRoleChange: (role: ManagedRole) => void;
  onActiveChange: (active: boolean) => void;
}) {
  if (error) return <Alert>{error}</Alert>;
  if (row.role === "agent") return <span>Service account</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isSelf && (
        <Field id={`role-${row.id}`} label="Role">
          <Select
            id={`role-${row.id}`}
            value={row.role}
            disabled={busy}
            onChange={(event) => onRoleChange(event.target.value as ManagedRole)}
          >
            {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </Select>
        </Field>
      )}
      {!isSelf && (
        <Button variant="secondary" disabled={busy} onClick={() => onActiveChange(!row.is_active)}>
          {row.is_active ? "Deactivate" : "Reactivate"}
        </Button>
      )}
    </div>
  );
}
