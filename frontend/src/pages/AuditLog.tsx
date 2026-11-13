import { Fragment, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  Heading,
  Pagination,
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
import { formatDateTime } from "../lib/format";
import type { AuditEntry, Paged } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const PAGE_SIZE = 50;
const ACTIONS = [
  "auth.login",
  "user.created",
  "user.role_changed",
  "user.deactivated",
  "user.reactivated",
  "issue.created",
  "issue.updated",
  "issue.start",
  "issue.request_review",
  "issue.request_revision",
  "issue.complete",
  "issue.reopen",
  "issue.commented",
  "evidence.added",
  "pending_action.proposed",
  "pending_action.approved",
  "pending_action.rejected",
] as const;

export default function AuditLog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const actorType = searchParams.get("actor_type") ?? "";
  const action = searchParams.get("action") ?? "";
  const entityType = searchParams.get("entity_type") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const query = new URLSearchParams();
  if (actorType === "human" || actorType === "agent") query.set("actor_type", actorType);
  if (ACTIONS.includes(action as (typeof ACTIONS)[number])) query.set("action", action);
  if (entityType === "issue" || entityType === "user") query.set("entity_type", entityType);
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  query.set("page", String(page));
  query.set("limit", String(PAGE_SIZE));
  const { data, error, loading } = useFetch<Paged<AuditEntry, "entries">>(`/audit?${query.toString()}`);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next);
  }

  function updatePage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  return (
    <div className="space-y-5">
      <Heading level={1}>Audit Logs</Heading>
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <Field id="audit-actor-type" label="Actor type">
            <Select id="audit-actor-type" value={actorType} onChange={(event) => updateFilter("actor_type", event.target.value)}>
              <option value="">All actor types</option>
              <option value="human">Human</option>
              <option value="agent">Agent</option>
            </Select>
          </Field>
          <Field id="audit-action" label="Action">
            <Select id="audit-action" value={action} onChange={(event) => updateFilter("action", event.target.value)}>
              <option value="">All actions</option>
              {ACTIONS.map((knownAction) => <option key={knownAction} value={knownAction}>{knownAction}</option>)}
            </Select>
          </Field>
          <Field id="audit-entity-type" label="Entity type">
            <Select id="audit-entity-type" value={entityType} onChange={(event) => updateFilter("entity_type", event.target.value)}>
              <option value="">All entities</option>
              <option value="issue">Issue</option>
              <option value="user">User</option>
            </Select>
          </Field>
          <Field id="audit-from" label="From">
            <TextInput id="audit-from" type="date" value={from} onChange={(event) => updateFilter("from", event.target.value)} />
          </Field>
          <Field id="audit-to" label="To">
            <TextInput id="audit-to" type="date" value={to} onChange={(event) => updateFilter("to", event.target.value)} />
          </Field>
        </div>
      </Card>
      {error && <Alert>{error.message}</Alert>}
      {loading ? (
        <Spinner label="Loading audit log..." />
      ) : !error && data && data.entries.length === 0 ? (
        <Card><EmptyState>No audit entries match these filters.</EmptyState></Card>
      ) : !error && data ? (
        <>
          <div className="hidden md:block">
            <Card className="p-0">
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Time</TableHeader>
                      <TableHeader>Actor</TableHeader>
                      <TableHeader>Action</TableHeader>
                      <TableHeader>Entity</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.entries.map((entry) => (
                      <Fragment key={entry.id}>
                      <TableRow>
                        <TableCell>
                          <button
                            type="button"
                            aria-expanded={expandedId === entry.id}
                            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                          >
                            {formatDateTime(entry.created_at)}
                          </button>
                        </TableCell>
                        <TableCell>{entry.actor_name} ({entry.actor_type})</TableCell>
                        <TableCell>{entry.action}</TableCell>
                        <TableCell>
                          {entry.entity_type === "issue"
                            ? <Link to={`/issues/${entry.entity_id}`}>{entry.entity_id}</Link>
                            : entry.entity_id}
                        </TableCell>
                      </TableRow>
                      {expandedId === entry.id && (
                        <TableRow>
                          <TableCell>
                            <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(entry.details, null, 2)}</pre>
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </div>
          <div className="grid gap-3 md:hidden">
            {data.entries.map((entry) => (
              <Card key={entry.id}>
                <div className="space-y-2">
                  <button
                    type="button"
                    aria-expanded={expandedId === entry.id}
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    {formatDateTime(entry.created_at)}
                  </button>
                  <p>{entry.actor_name} ({entry.actor_type})</p>
                  <p>{entry.action}</p>
                  <p>
                    {entry.entity_type === "issue"
                      ? <Link to={`/issues/${entry.entity_id}`}>{entry.entity_id}</Link>
                      : entry.entity_id}
                  </p>
                  {expandedId === entry.id && (
                    <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(entry.details, null, 2)}</pre>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} pages={pages} total={total} onChange={updatePage} />
        </>
      ) : null}
    </div>
  );
}
