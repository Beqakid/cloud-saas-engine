import type { Env, ImportQueueMessage } from "@cloud-saas-engine/types";
import { Router, json, handleOptions } from "./router";
import { healthHandler } from "./routes/health";

// --- Build the router ---
const router = new Router();

router.get("/health", healthHandler);

// --- Worker entry point ---
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    const url = new URL(request.url);
    const match = router.match(request.method, url);

    if (match) {
      try {
        return await match.handler({ request, env, url, params: match.params });
      } catch (err) {
        console.error("Route error:", err);
        return json({ ok: false, error: "Internal Server Error" }, 500);
      }
    }

    return json({ ok: false, error: "Not Found" }, 404);
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    // Queue consumer — wired in Task 6
    console.log(`Queue batch received: ${batch.messages.length} messages`);
    for (const msg of batch.messages) {
      msg.ack();
    }
  },
} satisfies ExportedHandler<Env>;
