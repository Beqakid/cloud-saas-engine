export interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
  bindings?: {
    d1: boolean;
    r2: boolean;
    kv: boolean;
    queue: boolean;
  };
}

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  KV: KVNamespace;
  IMPORT_QUEUE: Queue;
}
