import type {
  DatasetMetadata,
  HygieneIssue,
  FidelityReport,
  PersonaKey,
  SSEEvent,
} from "./types";

const API_BASE = "/api"; // proxied to FastAPI via next.config.ts rewrite

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export async function createSession(): Promise<{ session_id: string }> {
  return request<{ session_id: string }>("/session", { method: "POST" });
}

export async function preWarmDemo(): Promise<{ sessionId: string; metadata: DatasetMetadata } | null> {
  try {
    const { session_id } = await createSession();
    const res = await loadDemo(session_id);
    return { sessionId: session_id, metadata: res.metadata };
  } catch {
    return null;
  }
}

// ─── Upload / Demo ────────────────────────────────────────────────────────────

export interface UploadResponse {
  session_id: string;
  rows: number;
  columns: string[];
  privacy_actions: string[];
  metadata: DatasetMetadata;
}

export async function loadDemo(sessionId: string): Promise<UploadResponse> {
  const res = await fetch(`${API_BASE}/load-demo/${sessionId}`, { method: "POST" });
  if (!res.ok) throw new Error(`Load demo failed: ${res.statusText}`);
  return res.json();
}

export async function uploadCSV(sessionId: string, file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/upload/${sessionId}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let msg = text;
    try { msg = (JSON.parse(text) as { detail?: string }).detail ?? text; } catch { /* use raw text */ }
    throw new Error(msg);
  }
  return res.json();
}

// ─── Hygiene ──────────────────────────────────────────────────────────────────

export async function runHygiene(
  sessionId: string,
  metadata: DatasetMetadata
): Promise<{ issues: HygieneIssue[] }> {
  return request(`/hygiene/${sessionId}`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, metadata }),
  });
}

export async function applyHygieneFixes(
  sessionId: string,
  approvedFixes: string[],
  metadata?: DatasetMetadata
): Promise<{ metadata: DatasetMetadata; applied: string[] }> {
  return request(`/hygiene/apply/${sessionId}`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, approved_fixes: approvedFixes, metadata }),
  });
}

// ─── Generation ───────────────────────────────────────────────────────────────

export async function startGeneration(
  sessionId: string,
  metadata: DatasetMetadata,
  nRows = 1000,
  model = "auto"
): Promise<{ session_id: string; status: string }> {
  return request(`/generate/${sessionId}`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, metadata, n_rows: nRows, model }),
  });
}

export interface GenerationStatus {
  status: "generating" | "generated" | "error";
  progress: string[];
  result?: { rows_generated: number; rows_rejected: number; model_used: string };
  synthetic_path?: string;
}

export async function pollGenerationStatus(sessionId: string): Promise<GenerationStatus> {
  return request(`/generate/status/${sessionId}`);
}

// ─── Verification ─────────────────────────────────────────────────────────────

export async function runVerification(sessionId: string): Promise<{ fidelity: FidelityReport }> {
  return request(`/verify/${sessionId}`);
}

// ─── Preview / Download ───────────────────────────────────────────────────────

export async function getPreview(sessionId: string, n = 20): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  return request(`/preview/${sessionId}?n=${n}`);
}

export function getDownloadUrl(sessionId: string): string {
  return `${API_BASE}/download/${sessionId}`;
}

// ─── Agent Chat Stream ────────────────────────────────────────────────────────

/**
 * Stream agent chat via SSE (using fetch + ReadableStream for POST support).
 * Returns a cleanup function that aborts the stream.
 */
export function streamChat(
  sessionId: string,
  message: string,
  role: PersonaKey,
  onEvent: (event: SSEEvent) => void,
  onDone?: () => void,
  onError?: (err: Error) => void
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message, role }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Stream failed: ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const json = line.slice(6).trim();
            if (!json) continue;
            try {
              const event = JSON.parse(json) as SSEEvent;
              onEvent(event);
              if (event.type === "done") {
                onDone?.();
                return;
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
      onDone?.();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError?.(err as Error);
      }
    }
  })();

  return () => controller.abort();
}
