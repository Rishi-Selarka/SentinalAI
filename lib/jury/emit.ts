import type { AgentEvent } from "./types";

export type EmitFn = (event: AgentEvent) => void;

export function encodeSse(event: AgentEvent): Uint8Array {
  // Single-line JSON per SSE message keeps client parsing trivial.
  const payload = JSON.stringify(event);
  return new TextEncoder().encode(`data: ${payload}\n\n`);
}

export function makeEmitter(controller: ReadableStreamDefaultController<Uint8Array>): EmitFn {
  let closed = false;
  return (event) => {
    if (closed) return;
    try {
      controller.enqueue(encodeSse(event));
      if (event.type === "trial:end" || event.type === "trial:error") {
        closed = true;
      }
    } catch {
      closed = true;
    }
  };
}
