import { verifyAuth, jsonError } from "../_shared.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.ok) return jsonError(auth.error, 401);

  const filename = decodeURIComponent(request.headers.get("X-Filename") || "upload.bin");
  const contentType = request.headers.get("Content-Type") || "application/octet-stream";

  // Sanitize filename + add timestamp prefix to avoid collisions
  const clean = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${Date.now()}-${clean}`;

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return jsonError("Empty upload", 400);
  if (body.byteLength > 25 * 1024 * 1024) return jsonError("Too large (max 25MB)", 413);

  await env.ASSETS.put(key, body, {
    httpMetadata: { contentType },
  });

  return new Response(JSON.stringify({ ok: true, key }), {
    headers: { "Content-Type": "application/json" },
  });
}