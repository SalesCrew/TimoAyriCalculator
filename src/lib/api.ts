const railwayApiBaseUrl =
  "https://timoayricalculator-backend-production.up.railway.app";

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

const apiBaseUrl =
  process.env.NODE_ENV === "production"
    ? railwayApiBaseUrl
    : (configuredApiBaseUrl ?? railwayApiBaseUrl);

type ApiFetchOptions = {
  body?: unknown;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  { body, method = "GET", token }: ApiFetchOptions = {},
) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    method,
  });

  const payload = (await response.json().catch(() => null)) as
    | { code?: string; error?: string }
    | T
    | null;

  if (!response.ok) {
    throw new ApiClientError(
      (payload as { error?: string } | null)?.error ?? "Request failed",
      response.status,
      (payload as { code?: string } | null)?.code ?? "request_failed",
    );
  }

  return payload as T;
}
