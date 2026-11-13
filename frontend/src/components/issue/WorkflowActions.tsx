import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Textarea } from "../ui";
import { ApiError, api } from "../../lib/api";
import { can } from "../../lib/permissions";
import type { Issue, User } from "../../lib/types";

interface WorkflowActionsProps {
  issue: Issue;
  user: User;
  onIssueUpdated: (issue: Issue) => void;
  onActionComplete: () => void;
}

export default function WorkflowActions({ issue, user, onIssueUpdated, onActionComplete }: WorkflowActionsProps) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const isAdmin = can(user.role, "issue:review");
  const isOwner = user.id === issue.owner_id;
  const isLockedForReview = issue.status === "in_review" || issue.status === "completed";
  const canStartOrRequestReview = isAdmin || (user.role === "owner" && isOwner);
  const canReview = isAdmin && !isOwner;
  const action = issue.status === "open"
    ? canStartOrRequestReview ? { path: "start", label: "Start", commentRequired: false } : null
    : issue.status === "in_progress"
      ? canStartOrRequestReview ? { path: "request-review", label: "Request review", commentRequired: false } : null
      : issue.status === "in_review"
        ? canReview ? { path: "request-revision", label: "Send back", commentRequired: true } : null
        : issue.status === "completed"
          ? canReview ? { path: "reopen", label: "Reopen", commentRequired: true } : null
          : null;
  const canComplete = issue.status === "in_review" && canReview;

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    setError(null);
    setFieldError(undefined);
    setBusy(true);
    try {
      const response = await api<{ issue: Issue }>(`/issues/${encodeURIComponent(issue.id)}/${action.path}`, {
        method: "POST",
        body: { comment },
      });
      onIssueUpdated(response.issue);
      onActionComplete();
      setComment("");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Could not update issue.");
      if (reason instanceof ApiError) {
        setFieldError(reason.details?.find((detail) => detail.path === "comment")?.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function completeIssue() {
    if (!window.confirm("Complete this issue?")) return;
    setError(null);
    setFieldError(undefined);
    setBusy(true);
    try {
      const response = await api<{ issue: Issue }>(`/issues/${encodeURIComponent(issue.id)}/complete`, {
        method: "POST",
        body: { comment },
      });
      onIssueUpdated(response.issue);
      onActionComplete();
      setComment("");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Could not complete issue.");
      if (reason instanceof ApiError) {
        setFieldError(reason.details?.find((detail) => detail.path === "comment")?.message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!action && !canComplete) {
    if (user.role === "auditor") return null;
    if (isAdmin && isOwner && isLockedForReview) {
      return <p>You own this issue, so another admin must review it.</p>;
    }
    return null;
  }

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {(action?.commentRequired || canComplete) && (
        <Field
          id="workflow-comment"
          label={action?.commentRequired ? "Comment" : "Note (optional)"}
          error={fieldError}
        >
          <Textarea
            id="workflow-comment"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </Field>
      )}
      {canComplete && issue.evidence_count === 0 && <p>Add evidence before completing</p>}
      <div className="flex flex-wrap gap-2">
        {action && (
          <form onSubmit={submitAction}>
            <Button type="submit" disabled={busy}>
              {busy ? "Working..." : action.label}
            </Button>
          </form>
        )}
        {canComplete && (
          <Button type="button" disabled={busy} onClick={completeIssue}>
            {busy ? "Working..." : "Complete"}
          </Button>
        )}
      </div>
    </div>
  );
}
