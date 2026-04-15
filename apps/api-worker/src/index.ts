import type { Env } from "@cloud-saas-engine/types";
import { Router, json, handleOptions } from "./router";
import { healthHandler } from "./routes/health";
import { uploadHandler } from "./routes/upload";
import { listJobsHandler, jobStatusHandler, jobRowsHandler } from "./routes/jobs";
import { adminHandler } from "./routes/admin";
import { listFundsHandler, createFundHandler, updateFundHandler, deleteFundHandler } from "./routes/funds";
import { listDonorsHandler, getDonorHandler, createDonorHandler, updateDonorHandler, deleteDonorHandler } from "./routes/donors";
import { listDonationsHandler, getDonationHandler, createDonationHandler, updateDonationHandler, deleteDonationHandler } from "./routes/donations";
import { handleQueueBatch } from "./queue-handler";

// --- Build the router ---
const router = new Router();

router.get("/", adminHandler);
router.get("/admin", adminHandler);
router.get("/health", healthHandler);
router.post("/files/upload", uploadHandler);
router.get("/jobs", listJobsHandler);
router.get("/jobs/:id/status", jobStatusHandler);
router.get("/jobs/:id/rows", jobRowsHandler);

// Church domain CRUD
router.get("/funds", listFundsHandler);
router.post("/funds", createFundHandler);
router.put("/funds/:id", updateFundHandler);
router.delete("/funds/:id", deleteFundHandler);

router.get("/donors", listDonorsHandler);
router.post("/donors", createDonorHandler);
router.get("/donors/:id", getDonorHandler);
router.put("/donors/:id", updateDonorHandler);
router.delete("/donors/:id", deleteDonorHandler);

router.get("/donations", listDonationsHandler);
router.post("/donations", createDonationHandler);
router.get("/donations/:id", getDonationHandler);
router.put("/donations/:id", updateDonationHandler);
router.delete("/donations/:id", deleteDonationHandler);

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
    await handleQueueBatch(batch, env);
  },
} satisfies ExportedHandler<Env>;
