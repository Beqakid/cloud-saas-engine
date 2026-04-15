import type { Env } from "@cloud-saas-engine/types";

/** Context passed to every route handler. */
export interface RouteContext {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}

/** A route handler returns a Response. */
export type RouteHandler = (ctx: RouteContext) => Response | Promise<Response>;

interface Route {
  method: string;
  pattern: URLPattern;
  handler: RouteHandler;
}

/** Lightweight router — maps METHOD + pathname → handler. */
export class Router {
  private routes: Route[] = [];

  add(method: string, pathname: string, handler: RouteHandler): void {
    this.routes.push({
      method: method.toUpperCase(),
      pattern: new URLPattern({ pathname }),
      handler,
    });
  }

  get(pathname: string, handler: RouteHandler): void {
    this.add("GET", pathname, handler);
  }

  post(pathname: string, handler: RouteHandler): void {
    this.add("POST", pathname, handler);
  }

  match(method: string, url: URL): { handler: RouteHandler; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;
      const result = route.pattern.exec(url);
      if (result) {
        const params = result.pathname.groups as Record<string, string>;
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}

/** CORS headers applied to every response. */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Helper: return a JSON response with CORS headers. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/** Preflight handler for CORS OPTIONS requests. */
export function handleOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
