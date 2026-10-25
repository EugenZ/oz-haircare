// Database failures, summarized for logs and the admin alert. Drizzle wraps the
// driver error as `cause`, and its own message embeds the query params (client
// PII), so the summary uses the innermost error that carries a Postgres code.
export type DbFailure = {
  kind: "not_configured" | "query_failed";
  code?: string;
  message: string;
};

export function describeDbError(error: unknown): DbFailure {
  let current: unknown = error;
  let found: { code?: unknown; message?: unknown } | undefined;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") {
      found = candidate;
      break;
    }
    current = candidate.cause;
  }
  const top = error instanceof Error ? error.message : String(error ?? "unknown error");
  if (!found && top.startsWith("No database configured")) {
    return { kind: "not_configured", message: top };
  }
  const message = typeof found?.message === "string" ? found.message : top.split("\nparams:")[0];
  return {
    kind: "query_failed",
    ...(found ? { code: found.code as string } : {}),
    message,
  };
}
