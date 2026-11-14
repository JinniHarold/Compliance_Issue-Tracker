import { config } from "./config.js";

export interface ApiCallOptions {
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface ApiErrorDetail {
  path: string;
  message: string;
}

function redactToken(value: string): string {
  return value.split(config.agentToken).join("[redacted]");
}

export class ApiError extends Error {
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(
    readonly status: number,
    message: string,
    code = "API_ERROR",
    details: ApiErrorDetail[] = [],
  ) {
    super(redactToken(message));
    this.name = "ApiError";
    this.code = redactToken(code);
    this.details = details.map(({ path, message: detailMessage }) => ({
      path: redactToken(path),
      message: redactToken(detailMessage),
    }));
  }
}

export class ApiNetworkError extends Error {
  constructor() {
    super("The Compliance Tracker API could not be reached or the request timed out.");
    this.name = "ApiNetworkError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeErrorDetails(value: unknown): ApiErrorDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((detail): ApiErrorDetail[] => {
    if (
      isRecord(detail) &&
      typeof detail.path === "string" &&
      typeof detail.message === "string"
    ) {
      return [{ path: detail.path, message: detail.message }];
    }
    return [];
  });
}

function buildUrl(path: string, query?: ApiCallOptions["query"]): URL {
  const baseUrl = new URL(config.apiBaseUrl);
  const basePath = baseUrl.pathname.replace(/\/+$/, "");
  baseUrl.pathname = `${basePath}${path}`;
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) baseUrl.searchParams.set(key, String(value));
    }
  }
  return baseUrl;
}

function parseError(status: number, value: unknown): ApiError {
  const envelope = isRecord(value) && isRecord(value.error) ? value.error : undefined;
  const code = typeof envelope?.code === "string" ? envelope.code : "API_ERROR";
  const message = typeof envelope?.message === "string" ? envelope.message : "The API request failed.";
  return new ApiError(status, message, code, safeErrorDetails(envelope?.details));
}

export async function apiCall<T>(
  path: string,
  { method = "GET", query, body }: ApiCallOptions = {},
): Promise<T> {
  const headers = new Headers({
    Authorization: `Bearer ${config.agentToken}`,
    Accept: "application/json",
  });
  if (body !== undefined) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
  } catch {
    throw new ApiNetworkError();
  }

  let responseText: string;
  try {
    responseText = await response.text();
  } catch {
    throw new ApiNetworkError();
  }
  let responseBody: unknown = null;
  if (responseText) {
    try {
      responseBody = JSON.parse(responseText) as unknown;
    } catch {
      if (!response.ok) throw new ApiError(response.status, "The API returned an invalid error response.");
      throw new ApiError(response.status, "The API returned an invalid JSON response.", "INVALID_RESPONSE");
    }
  }

  if (!response.ok) throw parseError(response.status, responseBody);
  return responseBody as T;
}
