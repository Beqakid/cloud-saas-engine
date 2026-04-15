import type { HealthResponse } from '@cloud-saas-engine/types';

export interface Env {
  // Bindings will be added in P-02
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      const body: HealthResponse = {
        ok: true,
        service: 'cloud-saas-engine-api',
        timestamp: new Date().toISOString(),
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
};
