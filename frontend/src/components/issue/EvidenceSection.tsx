import { useState, type FormEvent } from "react";
import { Alert, Button, EmptyState, Field, Spinner, TextInput, Textarea } from "../ui";
import { ApiError, api } from "../../lib/api";
import type { Evidence, Status, User } from "../../lib/types";
import { formatDateTime } from "../../lib/format";
import { useFetch } from "../../lib/useFetch";

interface EvidenceSectionProps {
  issueId: string;
  ownerId: string;
  status: Status;
  user: User;
  onEvidenceAdded: () => Promise<void>;
}

function safeEvidenceUrl(reference: string): string | null {
  try {
    const url = new URL(reference);
    return url.protocol === "http:" || url.protocol === "https:" ? reference : null;
  } catch {
    return null;
  }
}

export default function EvidenceSection({ issueId, ownerId, status, user, onEvidenceAdded }: EvidenceSectionProps) {
  const path = `/issues/${encodeURIComponent(issueId)}/evidence`;
  const { data, error, loading, reload } = useFetch<{ evidence: Evidence[] }>(path);
  const locked = status === "in_review" || status === "completed";
  const canAdd = user.role === "admin" || (user.role === "owner" && user.id === ownerId && !locked);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setReferenceError(undefined);
    setBusy(true);
    try {
      await api<{ evidence: Evidence }>(path, { method: "POST", body: { reference, note } });
      setReference("");
      setNote("");
      reload();
      await onEvidenceAdded();
    } catch (reason: unknown) {
      setSubmitError(reason instanceof Error ? reason.message : "Could not add evidence.");
      if (reason instanceof ApiError) {
        setReferenceError(reason.details?.find((detail) => detail.path === "reference")?.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {loading && <Spinner label="Loading evidence..." />}
      {error && <Alert>{error.message}</Alert>}
      {!loading && !error && data && data.evidence.length === 0 && <EmptyState>No evidence has been added.</EmptyState>}
      {!loading && !error && data && data.evidence.length > 0 && (
        <ul className="space-y-4">
          {data.evidence.map((item) => {
            const href = safeEvidenceUrl(item.reference);
            return (
              <li key={item.id} className="space-y-1">
                {href ? <a href={href} target="_blank" rel="noopener noreferrer">{item.reference}</a> : <span>{item.reference}</span>}
                {item.note && <p>{item.note}</p>}
                <p>Added by {item.uploaded_by_name} on {formatDateTime(item.created_at)}</p>
              </li>
            );
          })}
        </ul>
      )}
      {canAdd && (
        <form className="space-y-3" onSubmit={submit}>
          {submitError && <Alert>{submitError}</Alert>}
          <Field id="evidence-reference" label="Link" error={referenceError}>
            <TextInput id="evidence-reference" type="url" required maxLength={2048} value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>
          <Field id="evidence-note" label="Note">
            <Textarea id="evidence-note" maxLength={500} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <Button type="submit" disabled={busy}>{busy ? "Adding..." : "Add evidence"}</Button>
        </form>
      )}
    </div>
  );
}
