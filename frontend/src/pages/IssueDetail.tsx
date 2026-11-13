import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { Alert, Card, EmptyState, Heading, Spinner, TextContent } from "../components/ui";
import CommentsSection from "../components/issue/CommentsSection";
import EditDetails from "../components/issue/EditDetails";
import EvidenceSection from "../components/issue/EvidenceSection";
import WorkflowActions from "../components/issue/WorkflowActions";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/format";
import { can } from "../lib/permissions";
import type { AuditEntry, Issue, Paged } from "../lib/types";
import { useFetch } from "../lib/useFetch";

export default function IssueDetail() {
  const { user } = useAuth();
  const { id = "" } = useParams();
  const encodedId = encodeURIComponent(id);
  const issueResult = useFetch<{ issue: Issue }>(`/issues/${encodedId}`);
  const historyResult = useFetch<Paged<AuditEntry, "entries">>(
    user && can(user.role, "audit:read")
      ? `/audit?entity_type=issue&entity_id=${encodeURIComponent(id)}&limit=50`
      : null
  );
  const [updatedIssue, setUpdatedIssue] = useState<{ id: string; issue: Issue } | null>(null);
  const [activityRevision, setActivityRevision] = useState(0);

  if (issueResult.loading) {
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

  if (issueResult.error) {
    return (
      <div className="space-y-4">
        <Link to="/issues">Back to issues</Link>
        <Alert>{issueResult.error.message}</Alert>
      </div>
    );
  }
  if (!issueResult.data || !user) return null;

  const issue = updatedIssue?.id === id ? updatedIssue.issue : issueResult.data.issue;
  const handleIssueUpdated = (nextIssue: Issue) => {
    setUpdatedIssue({ id, issue: nextIssue });
    historyResult.reload();
  };
  const refreshIssueAfterEvidence = async () => {
    const response = await api<{ issue: Issue }>(`/issues/${encodedId}`);
    handleIssueUpdated(response.issue);
  };

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
        <div className="space-y-4">
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
          <EditDetails issue={issue} user={user} onIssueUpdated={handleIssueUpdated} />
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <Heading>Evidence</Heading>
          <EvidenceSection
            issueId={issue.id}
            ownerId={issue.owner_id}
            status={issue.status}
            user={user}
            onEvidenceAdded={refreshIssueAfterEvidence}
          />
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <Heading>Workflow</Heading>
          <WorkflowActions
            issue={issue}
            user={user}
            onIssueUpdated={handleIssueUpdated}
            onActionComplete={() => setActivityRevision((revision) => revision + 1)}
          />
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <Heading>Comments</Heading>
          <CommentsSection
            key={activityRevision}
            issueId={issue.id}
            ownerId={issue.owner_id}
            user={user}
            onCommentAdded={historyResult.reload}
          />
        </div>
      </Card>
      {can(user.role, "audit:read") && (
        <Card>
          <div className="space-y-3">
            <Heading>History</Heading>
            {historyResult.loading && <Spinner label="Loading history..." />}
            {historyResult.error && <Alert>{historyResult.error.message}</Alert>}
            {!historyResult.loading && !historyResult.error && historyResult.data?.entries.length === 0 && (
              <EmptyState>No history for this issue.</EmptyState>
            )}
            {historyResult.data && historyResult.data.entries.length > 0 && (
              <ol className="space-y-2">
                {[...historyResult.data.entries].reverse().map((entry) => (
                  <li key={entry.id}>
                    {formatDateTime(entry.created_at)} · {entry.actor_name} · {entry.action}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
