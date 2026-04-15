export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  KV: KVNamespace;
  IMPORT_QUEUE: Queue;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      const body = {
        ok: true,
        service: 'cloud-saas-engine-api',
        timestamp: new Date().toISOString(),
        bindings: {
          d1: !!env.DB,
          r2: !!env.FILES,
          kv: !!env.KV,
          queue: !!env.IMPORT_QUEUE,
        },
      };
      return new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      console.log('Queue message received:', JSON.stringify(msg.body));
      msg.ack();
    }
  },
};
