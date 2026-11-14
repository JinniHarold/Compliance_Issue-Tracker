import { useState, type FormEvent } from "react";
import {
  Alert,
  ArticleBody,
  ArticleList,
  ArticleListItem,
  ArticleMeta,
  Button,
  EmptyState,
  Field,
  Spinner,
  Textarea,
  TextContent,
} from "../ui";
import { api } from "../../lib/api";
import type { IssueComment, User } from "../../lib/types";
import { formatDateTime } from "../../lib/format";
import { useFetch } from "../../lib/useFetch";

interface CommentsSectionProps {
  issueId: string;
  ownerId: string;
  user: User;
  onCommentAdded: () => void;
  article?: boolean;
}

const KIND_LABELS: Record<IssueComment["kind"], string> = {
  comment: "Comment",
  review_requested: "Review requested",
  revision_requested: "Revision requested",
  approved: "Approved",
  reopened: "Reopened",
};

export default function CommentsSection({
  issueId,
  ownerId,
  user,
  onCommentAdded,
  article = false,
}: CommentsSectionProps) {
  const path = `/issues/${encodeURIComponent(issueId)}/comments`;
  const { data, error, loading, reload } = useFetch<{ comments: IssueComment[] }>(path);
  const canComment = user.role === "admin" || (user.role === "owner" && user.id === ownerId);
  const [body, setBody] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setBusy(true);
    try {
      await api<{ comment: IssueComment }>(path, { method: "POST", body: { body } });
      setBody("");
      reload();
      onCommentAdded();
    } catch (reason: unknown) {
      setSubmitError(reason instanceof Error ? reason.message : "Could not add comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {loading && <Spinner label="Loading comments..." />}
      {error && <Alert>{error.message}</Alert>}
      {!loading && !error && data && data.comments.length === 0 && <EmptyState>No comments yet.</EmptyState>}
      {!loading && !error && data && data.comments.length > 0 && (article ? (
        <ArticleList thread>
          {data.comments.map((comment) => (
            <ArticleListItem key={comment.id}>
              <ArticleMeta>
                <strong>{comment.author_name}</strong> ({comment.author_role}) · {KIND_LABELS[comment.kind]} · {formatDateTime(comment.created_at)}
              </ArticleMeta>
              <ArticleBody><TextContent>{comment.body}</TextContent></ArticleBody>
            </ArticleListItem>
          ))}
        </ArticleList>
      ) : (
        <ol className="space-y-4">
          {data.comments.map((comment) => (
            <li key={comment.id} className="space-y-1">
              <p>{comment.author_name} ({comment.author_role}) · {KIND_LABELS[comment.kind]}</p>
              <TextContent>{comment.body}</TextContent>
              <p>{formatDateTime(comment.created_at)}</p>
            </li>
          ))}
        </ol>
      ))}
      {canComment && (
        <form className="space-y-3" onSubmit={submit}>
          {submitError && <Alert>{submitError}</Alert>}
          <Field id="comment-body" label="Add a comment">
            <Textarea id="comment-body" required minLength={1} maxLength={2000} rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
          </Field>
          <Button type="submit" disabled={busy}>{busy ? "Adding..." : "Add comment"}</Button>
        </form>
      )}
    </div>
  );
}
