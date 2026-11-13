import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import {
  Alert,
  Button,
  Card,
  Dialog,
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
  Textarea,
} from "../components/ui";
import { ApiError, api } from "../lib/api";
import { can } from "../lib/permissions";
import { formatDate } from "../lib/format";
import type { Issue, Paged, Severity, Status, UserRecord } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const PAGE_SIZE = 20;
const STATUSES: Status[] = ["open", "in_progress", "in_review", "completed"];
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const SORTS = ["due_date", "created_at", "updated_at", "severity"] as const;
type SortKey = (typeof SORTS)[number];

interface IssueForm {
  title: string;
  description: string;
  severity: Severity;
  owner_id: string;
  due_date: string;
}

const EMPTY_FORM: IssueForm = {
  title: "",
  description: "",
  severity: "medium",
  owner_id: "",
  due_date: "",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not create issue.";
}

export default function Issues() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchValue = searchParams.get("search") ?? "";
  const [searchState, setSearchState] = useState({ source: searchValue, draft: searchValue });
  const searchDraft = searchState.source === searchValue ? searchState.draft : searchValue;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<IssueForm>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const canCreate = can(user?.role, "issue:create");
  const statusValue = searchParams.get("status") ?? "";
  const severityValue = searchParams.get("severity") ?? "";
  const overdueValue = searchParams.get("overdue") === "true";
  const ownerId = searchParams.get("owner_id") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const sortValue = SORTS.includes(searchParams.get("sort") as SortKey)
    ? (searchParams.get("sort") as SortKey)
    : "due_date";
  const orderValue = searchParams.get("order") === "desc" ? "desc" : "asc";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = searchDraft.trim();
      if (nextSearch === searchValue) return;
      const params = new URLSearchParams(searchParams);
      if (nextSearch) params.set("search", nextSearch);
      else params.delete("search");
      params.delete("page");
      setSearchParams(params, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft, searchParams, searchValue, setSearchParams]);

  const listPath = useMemo(() => {
    const params = new URLSearchParams();
    if (STATUSES.includes(statusValue as Status)) params.set("status", statusValue);
    if (SEVERITIES.includes(severityValue as Severity)) params.set("severity", severityValue);
    if (overdueValue) params.set("overdue", "true");
    if (ownerId) params.set("owner_id", ownerId);
    if (searchValue) params.set("search", searchValue);
    params.set("sort", sortValue);
    params.set("order", orderValue);
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    return `/issues?${params.toString()}`;
  }, [statusValue, severityValue, overdueValue, ownerId, searchValue, sortValue, orderValue, page]);

  const { data, error, loading } = useFetch<Paged<Issue>>(listPath);
  const {
    data: userData,
    error: userError,
    loading: usersLoading,
  } = useFetch<{ users: UserRecord[] }>(canCreate && dialogOpen ? "/users" : null);

  const owners = userData?.users.filter(
    (candidate) => candidate.is_active && (candidate.role === "owner" || candidate.role === "admin")
  ) ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  function changeFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    setSearchParams(params);
  }

  function changePage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    setSearchParams(params);
  }

  function clearFilters() {
    setSearchState({ source: searchValue, draft: "" });
    setSearchParams(new URLSearchParams());
  }

  function openCreateDialog() {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setSubmitError(null);
    setDialogOpen(true);
  }

  async function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const response = await api<{ issue: Issue }>("/issues", {
        method: "POST",
        body: form,
      });
      setDialogOpen(false);
      navigate(`/issues/${response.issue.id}`);
    } catch (reason: unknown) {
      setSubmitError(getErrorMessage(reason));
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
        <Heading level={1}>Issues</Heading>
        {canCreate && <Button onClick={openCreateDialog}>New issue</Button>}
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <Field id="filter-status" label="Status">
            <Select id="filter-status" value={statusValue} onChange={(event) => changeFilter("status", event.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
            </Select>
          </Field>
          <Field id="filter-severity" label="Severity">
            <Select id="filter-severity" value={severityValue} onChange={(event) => changeFilter("severity", event.target.value)}>
              <option value="">All severities</option>
              {SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
            </Select>
          </Field>
          <Field id="filter-search" label="Search">
            <TextInput
              id="filter-search"
              maxLength={100}
              value={searchDraft}
              onChange={(event) => setSearchState({ source: searchValue, draft: event.target.value })}
              placeholder="Search title or description"
            />
          </Field>
          <Field id="filter-sort" label="Sort by">
            <Select id="filter-sort" value={sortValue} onChange={(event) => changeFilter("sort", event.target.value)}>
              {SORTS.map((sort) => <option key={sort} value={sort}>{sort.replace("_", " ")}</option>)}
            </Select>
          </Field>
          <Field id="filter-order" label="Order">
            <Select id="filter-order" value={orderValue} onChange={(event) => changeFilter("order", event.target.value)}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="filter-overdue" className="flex items-center gap-2">
            <input
              id="filter-overdue"
              type="checkbox"
              checked={overdueValue}
              onChange={(event) => changeFilter("overdue", event.target.checked ? "true" : "")}
            />
            Overdue
          </label>
          <Button
            variant="secondary"
            aria-pressed={ownerId === user?.id}
            onClick={() => changeFilter("owner_id", ownerId === user?.id ? "" : user?.id ?? "")}
          >
            Assigned to me
          </Button>
          <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
        </div>
      </Card>

      {error && <Alert>{error.message}</Alert>}
      {loading ? (
        <Spinner label="Loading issues..." />
      ) : !error && data && data.issues.length === 0 ? (
        <Card><EmptyState>No issues match these filters.</EmptyState></Card>
      ) : !error && data ? (
        <>
          <div className="hidden md:block">
            <Card className="p-0">
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Title</TableHeader>
                      <TableHeader>Severity</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Owner</TableHeader>
                      <TableHeader>Due date</TableHeader>
                      <TableHeader>Evidence</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.issues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell><Link to={`/issues/${issue.id}`}>{issue.title}</Link></TableCell>
                        <TableCell><SeverityBadge severity={issue.severity} /></TableCell>
                        <TableCell><StatusBadge status={issue.status} /></TableCell>
                        <TableCell>{issue.owner_name}</TableCell>
                        <TableCell>
                          {formatDate(issue.due_date)}
                          {issue.is_overdue && <span className="block">Overdue</span>}
                        </TableCell>
                        <TableCell>{issue.evidence_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </div>
          <div className="grid gap-3 md:hidden">
            {data.issues.map((issue) => (
              <Card key={issue.id}>
                <div className="space-y-3">
                  <Link to={`/issues/${issue.id}`}>{issue.title}</Link>
                  <div className="flex flex-wrap gap-2">
                    <SeverityBadge severity={issue.severity} />
                    <StatusBadge status={issue.status} />
                  </div>
                  <p>Owner: {issue.owner_name}</p>
                  <p>Due: {formatDate(issue.due_date)}{issue.is_overdue ? " — Overdue" : ""}</p>
                  <p>Evidence: {issue.evidence_count}</p>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} pages={pages} total={data.total} onChange={changePage} />
        </>
      ) : null}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="New issue">
        <form className="space-y-4" onSubmit={submitIssue}>
          {submitError && <Alert>{submitError}</Alert>}
          {usersLoading && <Spinner label="Loading owners..." />}
          {userError && <Alert>{userError.message}</Alert>}
          <Field id="new-title" label="Title" error={fieldErrors.title}>
            <TextInput
              id="new-title"
              required
              minLength={3}
              maxLength={200}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <Field id="new-description" label="Description" error={fieldErrors.description}>
            <Textarea
              id="new-description"
              maxLength={5000}
              rows={4}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <Field id="new-severity" label="Severity" error={fieldErrors.severity}>
            <Select
              id="new-severity"
              value={form.severity}
              onChange={(event) => setForm({ ...form, severity: event.target.value as Severity })}
            >
              {SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
            </Select>
          </Field>
          <Field id="new-owner" label="Owner" error={fieldErrors.owner_id}>
            <Select
              id="new-owner"
              required
              value={form.owner_id}
              disabled={usersLoading || owners.length === 0}
              onChange={(event) => setForm({ ...form, owner_id: event.target.value })}
            >
              <option value="">Select an owner</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.name} ({owner.role})</option>
              ))}
            </Select>
          </Field>
          <Field id="new-due-date" label="Due date" error={fieldErrors.due_date}>
            <TextInput
              id="new-due-date"
              type="date"
              required
              value={form.due_date}
              onChange={(event) => setForm({ ...form, due_date: event.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || usersLoading || !!userError || owners.length === 0}>
              {submitting ? "Creating..." : "Create issue"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
