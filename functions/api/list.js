import { verifyAuth, jsonError } from "../_shared.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.ok) return jsonError(auth.error, 401);

  const list = await env.ASSETS.list({ limit: 1000 });
  const images = list.objects.map(o => ({
    key: o.key,
    size: o.size,
    uploaded: o.uploaded,
  })).sort((a,b) => new Date(b.uploaded) - new Date(a.uploaded));

  return new Response(JSON.stringify({ images }), {
    headers: { "Content-Type": "application/json" },
  });
}