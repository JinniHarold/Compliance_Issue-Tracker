import { useState } from "react";
import { useParams } from "react-router-dom";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import {
  Alert,
  Article,
  ArticleHeader,
  ArticleList,
  ArticleListItem,
  ArticleMeta,
  Card,
  DetailList,
  DetailRow,
  EmptyState,
  Heading,
  LinkButton,
  Spinner,
  TextContent,
} from "../components/ui";
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
        <LinkButton to="/issues">Back to issues</LinkButton>
        <p>Issue not found</p>
      </div>
    );
  }

  if (issueResult.error) {
    return (
      <div className="space-y-4">
        <LinkButton to="/issues">Back to issues</LinkButton>
        <Alert>{issueResult.error.message}</Alert>
      </div>
    );
  }
  if (!issueResult.data || !user) return null;

  const issue = updatedIssue?.id === id ? updatedIssue.issue : issueResult.data.issue;
  const isCompleted = issue.status === "completed";
  const handleIssueUpdated = (nextIssue: Issue) => {
    setUpdatedIssue({ id, issue: nextIssue });
    historyResult.reload();
  };
  const refreshIssueAfterEvidence = async () => {
    const response = await api<{ issue: Issue }>(`/issues/${encodedId}`);
    handleIssueUpdated(response.issue);
  };

  return (
    <Article enabled={isCompleted}>
      <LinkButton to="/issues">Back to issues</LinkButton>
      {isCompleted ? (
        <ArticleHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={issue.severity} />
            <StatusBadge status={issue.status} />
          </div>
          <Heading level={1} variant="article-title">{issue.title}</Heading>
          <ArticleMeta>
            Owner: {issue.owner_name} · Completed {issue.completed_at ? formatDateTime(issue.completed_at) : "Not set"}
            {issue.is_overdue ? " · Overdue" : ""}
          </ArticleMeta>
        </ArticleHeader>
      ) : (
        <header className="space-y-3">
          <Heading level={1}>{issue.title}</Heading>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={issue.severity} />
            <StatusBadge status={issue.status} />
            {issue.is_overdue && <span>Overdue</span>}
          </div>
        </header>
      )}

      <Card variant={isCompleted ? "article" : "default"}>
        <div className="space-y-4">
          <Heading variant={isCompleted ? "article-section" : "default"}>Details</Heading>
          <DetailList>
            <DetailRow label="Description" empty={!issue.description}>
              {issue.description ? <TextContent>{issue.description}</TextContent> : "Not set"}
            </DetailRow>
            <DetailRow label="Owner" empty={!issue.owner_name}>{issue.owner_name || "Not set"}</DetailRow>
            <DetailRow label="Due date" empty={!issue.due_date}>{issue.due_date ? formatDate(issue.due_date) : "Not set"}</DetailRow>
            <DetailRow label="Created">{formatDateTime(issue.created_at)}</DetailRow>
            <DetailRow label="Updated">{formatDateTime(issue.updated_at)}</DetailRow>
            <DetailRow label="Completed" empty={!issue.completed_at}>
              {issue.completed_at ? formatDateTime(issue.completed_at) : "Not set"}
            </DetailRow>
            <DetailRow label="Evidence count">{issue.evidence_count}</DetailRow>
          </DetailList>
          <EditDetails issue={issue} user={user} onIssueUpdated={handleIssueUpdated} />
        </div>
      </Card>

      <Card variant={isCompleted ? "article" : "default"}>
        <div className="space-y-4">
          <Heading variant={isCompleted ? "article-section" : "default"}>Evidence</Heading>
          <EvidenceSection
            issueId={issue.id}
            ownerId={issue.owner_id}
            status={issue.status}
            user={user}
            onEvidenceAdded={refreshIssueAfterEvidence}
            article={isCompleted}
          />
        </div>
      </Card>

      <Card variant={isCompleted ? "article" : "default"}>
        <div className="space-y-4">
          <Heading variant={isCompleted ? "article-section" : "default"}>Workflow</Heading>
          <WorkflowActions
            issue={issue}
            user={user}
            onIssueUpdated={handleIssueUpdated}
            onActionComplete={() => setActivityRevision((revision) => revision + 1)}
          />
        </div>
      </Card>

      <Card variant={isCompleted ? "article" : "default"}>
        <div className="space-y-4">
          <Heading variant={isCompleted ? "article-section" : "default"}>Comments</Heading>
          <CommentsSection
            key={activityRevision}
            issueId={issue.id}
            ownerId={issue.owner_id}
            user={user}
            onCommentAdded={historyResult.reload}
            article={isCompleted}
          />
        </div>
      </Card>
      {can(user.role, "audit:read") && (
        <Card variant={isCompleted ? "article" : "default"}>
          <div className="space-y-3">
            <Heading variant={isCompleted ? "article-section" : "default"}>History</Heading>
            {historyResult.loading && <Spinner label="Loading history..." />}
            {historyResult.error && <Alert>{historyResult.error.message}</Alert>}
            {!historyResult.loading && !historyResult.error && historyResult.data?.entries.length === 0 && (
              <EmptyState>No history for this issue.</EmptyState>
            )}
            {historyResult.data && historyResult.data.entries.length > 0 && (
              isCompleted ? (
                <ArticleList ordered>
                  {[...historyResult.data.entries].reverse().map((entry) => (
                    <ArticleListItem key={entry.id}>
                      <ArticleMeta>
                        {formatDateTime(entry.created_at)} · {entry.actor_name} · {entry.action}
                      </ArticleMeta>
                    </ArticleListItem>
                  ))}
                </ArticleList>
              ) : (
              <ol className="space-y-2">
                {[...historyResult.data.entries].reverse().map((entry) => (
                  <li key={entry.id}>
                    {formatDateTime(entry.created_at)} · {entry.actor_name} · {entry.action}
                  </li>
                ))}
              </ol>
              )
            )}
          </div>
        </Card>
      )}
    </Article>
  );
}
