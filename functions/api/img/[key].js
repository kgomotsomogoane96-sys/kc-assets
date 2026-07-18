export async function onRequestGet(context) {
  const { env, params } = context;
  const key = Array.isArray(params.path) ? params.path.join("/") : params.path;

  if (!key) return new Response("Missing key", { status: 400 });

  const obj = await env.ASSETS.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(obj.body, { headers });
}
