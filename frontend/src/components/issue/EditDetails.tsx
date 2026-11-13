import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Select, Spinner, TextInput, Textarea } from "../ui";
import { ApiError, api } from "../../lib/api";
import { can } from "../../lib/permissions";
import type { Issue, Severity, User, UserRecord } from "../../lib/types";
import { useFetch } from "../../lib/useFetch";

interface EditDetailsProps {
  issue: Issue;
  user: User;
  onIssueUpdated: (issue: Issue) => void;
}

interface IssuePatch {
  title?: string;
  description?: string;
  severity?: Severity;
  owner_id?: string;
  due_date?: string;
}

export default function EditDetails({ issue, user, onIssueUpdated }: EditDetailsProps) {
  const isAdmin = can(user.role, "issue:edit-fields");
  const isOwner = user.role === "owner" && user.id === issue.owner_id;
  const locked = issue.status === "in_review" || issue.status === "completed";
  const canEdit = isAdmin || (isOwner && !locked);
  const { data: userData, error: usersError, loading: usersLoading } =
    useFetch<{ users: UserRecord[] }>(isAdmin ? "/users" : null);
  const owners = userData?.users.filter(
    (candidate) => candidate.is_active && (candidate.role === "owner" || candidate.role === "admin")
  ) ?? [];
  const [form, setForm] = useState(() => ({
    title: issue.title,
    description: issue.description,
    severity: issue.severity,
    owner_id: issue.owner_id,
    due_date: issue.due_date,
  }));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (user.role === "auditor" || (user.role === "owner" && !isOwner)) return null;
  if (!canEdit) return <p>Locked while under review or completed.</p>;

  function change<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const patch: IssuePatch = {};
    if (isAdmin) {
      if (form.title !== issue.title) patch.title = form.title;
      if (form.description !== issue.description) patch.description = form.description;
      if (form.severity !== issue.severity) patch.severity = form.severity;
      if (form.owner_id !== issue.owner_id) patch.owner_id = form.owner_id;
      if (form.due_date !== issue.due_date) patch.due_date = form.due_date;
    } else if (form.description !== issue.description) {
      patch.description = form.description;
    }
    if (Object.keys(patch).length === 0) return;

    setBusy(true);
    try {
      const response = await api<{ issue: Issue }>(`/issues/${encodeURIComponent(issue.id)}`, {
        method: "PATCH",
        body: patch,
      });
      onIssueUpdated(response.issue);
      setForm({
        title: response.issue.title,
        description: response.issue.description,
        severity: response.issue.severity,
        owner_id: response.issue.owner_id,
        due_date: response.issue.due_date,
      });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Could not update issue.");
      if (reason instanceof ApiError && reason.details) {
        setFieldErrors(Object.fromEntries(reason.details.map(({ path, message }) => [path, message])));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={save}>
      {error && <Alert>{error}</Alert>}
      {usersError && isAdmin && <Alert>{usersError.message}</Alert>}
      {isAdmin && (
        <>
          <Field id="edit-title" label="Title" error={fieldErrors.title}>
            <TextInput id="edit-title" required minLength={3} maxLength={200} value={form.title} onChange={(event) => change("title", event.target.value)} />
          </Field>
          <Field id="edit-severity" label="Severity" error={fieldErrors.severity}>
            <Select id="edit-severity" value={form.severity} onChange={(event) => change("severity", event.target.value as Severity)}>
              {(["low", "medium", "high", "critical"] as const).map((severity) => <option key={severity} value={severity}>{severity}</option>)}
            </Select>
          </Field>
          <Field id="edit-owner" label="Owner" error={fieldErrors.owner_id}>
            <Select id="edit-owner" value={form.owner_id} disabled={usersLoading || !!usersError} onChange={(event) => change("owner_id", event.target.value)}>
              {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} ({owner.role})</option>)}
            </Select>
          </Field>
          <Field id="edit-due-date" label="Due date" error={fieldErrors.due_date}>
            <TextInput id="edit-due-date" type="date" required value={form.due_date} onChange={(event) => change("due_date", event.target.value)} />
          </Field>
        </>
      )}
      <Field id="edit-description" label="Description" error={fieldErrors.description}>
        <Textarea id="edit-description" rows={4} maxLength={5000} value={form.description} onChange={(event) => change("description", event.target.value)} />
      </Field>
      {usersLoading && isAdmin && <Spinner label="Loading owners..." />}
      <Button type="submit" disabled={busy || (isAdmin && (usersLoading || !!usersError))}>
        {busy ? "Saving..." : "Save details"}
      </Button>
    </form>
  );
}
