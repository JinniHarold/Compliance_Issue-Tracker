import { Link, useParams } from "react-router-dom";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { Alert, Card, EmptyState, Heading, Spinner, TextContent } from "../components/ui";
import { formatDate, formatDateTime } from "../lib/format";
import type { Evidence, Issue, IssueComment } from "../lib/types";
import { useFetch } from "../lib/useFetch";

function safeEvidenceUrl(reference: string): string | null {
  try {
    const url = new URL(reference);
    return url.protocol === "http:" || url.protocol === "https:" ? reference : null;
  } catch {
    return null;
  }
}

export default function IssueDetail() {
  const { id = "" } = useParams();
  const encodedId = encodeURIComponent(id);
  const issueResult = useFetch<{ issue: Issue }>(`/issues/${encodedId}`);
  const commentsResult = useFetch<{ comments: IssueComment[] }>(`/issues/${encodedId}/comments`);
  const evidenceResult = useFetch<{ evidence: Evidence[] }>(`/issues/${encodedId}/evidence`);

  if (issueResult.loading || commentsResult.loading || evidenceResult.loading) {
    return <Spinner label="Loading issue..." />;
  }
  if (issueResult.error instanceof Error && "status" in issueResult.error && issueResult.error.status === 404) {
    return (
      <div className="space-y-4">
        <Link to="/issues">Back to issues</Link>
        <p>Issue not found</p>
      </div>
    );
  }

  const error = issueResult.error ?? commentsResult.error ?? evidenceResult.error;
  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/issues">Back to issues</Link>
        <Alert>{error.message}</Alert>
      </div>
    );
  }
  if (!issueResult.data || !commentsResult.data || !evidenceResult.data) return null;

  const issue = issueResult.data.issue;
  const evidence = evidenceResult.data.evidence;
  const comments = commentsResult.data.comments;

  return (
    <div className="space-y-5">
      <Link to="/issues">Back to issues</Link>
      <header className="space-y-3">
        <Heading level={1}>{issue.title}</Heading>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={issue.severity} />
          <StatusBadge status={issue.status} />
          {issue.is_overdue && <span>Overdue</span>}
        </div>
      </header>

      <Card>
        <Heading>Details</Heading>
        <dl className="grid gap-3 md:grid-cols-2">
          <div><dt>Description</dt><dd><TextContent>{issue.description || "—"}</TextContent></dd></div>
          <div><dt>Owner</dt><dd>{issue.owner_name}</dd></div>
          <div><dt>Due date</dt><dd>{formatDate(issue.due_date)}</dd></div>
          <div><dt>Created</dt><dd>{formatDateTime(issue.created_at)}</dd></div>
          <div><dt>Updated</dt><dd>{formatDateTime(issue.updated_at)}</dd></div>
          <div><dt>Completed</dt><dd>{issue.completed_at ? formatDateTime(issue.completed_at) : "—"}</dd></div>
          <div><dt>Evidence count</dt><dd>{issue.evidence_count}</dd></div>
        </dl>
      </Card>

      <Card>
        <Heading>Evidence</Heading>
        {evidence.length === 0 ? (
          <EmptyState>No evidence has been added.</EmptyState>
        ) : (
          <ul className="space-y-4">
            {evidence.map((item) => {
              const href = safeEvidenceUrl(item.reference);
              return (
                <li key={item.id} className="space-y-1">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">{item.reference}</a>
                  ) : (
                    <span>{item.reference}</span>
                  )}
                  {item.note && <p>{item.note}</p>}
                  <p>Added by {item.uploaded_by_name} on {formatDateTime(item.created_at)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <Heading>Comments</Heading>
        {comments.length === 0 ? (
          <EmptyState>No comments yet.</EmptyState>
        ) : (
          <ol className="space-y-4">
            {comments.map((comment) => (
              <li key={comment.id} className="space-y-1">
                <p>{comment.author_name} ({comment.author_role}) · {comment.kind.replaceAll("_", " ")}</p>
                <TextContent>{comment.body}</TextContent>
                <p>{formatDateTime(comment.created_at)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
