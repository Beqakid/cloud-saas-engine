import { json } from "../router";
import type { RouteContext } from "../router";

/** GET /health — binding diagnostics. */
export function healthHandler(ctx: RouteContext): Response {
  return json({
    ok: true,
    service: "cloud-saas-engine-api",
    bindings: {
      d1: !!ctx.env.DB,
      r2: !!ctx.env.FILES,
      kv: !!ctx.env.CACHE,
      queue: !!ctx.env.IMPORT_QUEUE,
    },
  });
}
