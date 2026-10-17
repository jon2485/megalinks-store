import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import {boundedRequest} from '../lib/request-security';
import {ensureRuntimeSecretMigration} from '../lib/server';
import {applySeoHeaders} from '../lib/seo';

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const limited=await boundedRequest(request);
    if(!limited)return Response.json({error:'הבקשה גדולה מדי'},{status:413,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    request=limited;
    // Exact-ciphertext, verified migration is safe to finish without waiting
    // for a browser owner session. Failures retain the DB copy for recovery.
    ctx.waitUntil(ensureRuntimeSecretMigration().catch(()=>{console.error('Runtime secret migration failed');}));
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response=await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    const secured=new Response(response.body,response);
    secured.headers.set('X-Content-Type-Options','nosniff');
    secured.headers.set('Referrer-Policy','no-referrer');
    secured.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    const path=new URL(request.url).pathname;
    if(path.startsWith('/api/supplier/')||path.startsWith('/supplier/')||path==='/mcp')secured.headers.set('Cache-Control','private, no-store');
    return applySeoHeaders(secured,path);
  },
};
