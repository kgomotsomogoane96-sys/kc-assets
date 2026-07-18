import { verifyAuth, jsonError } from "../_shared.js";

export async function onRequestDelete(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.ok) return jsonError(auth.error, 401);

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return jsonError("Missing key", 400);

  await env.ASSETS.delete(key);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}