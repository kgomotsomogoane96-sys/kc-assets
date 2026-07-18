const ADMIN_EMAIL = "kgomotsomogoane96@gmail.com";
const FIREBASE_PROJECT_ID = "kc-portfolio-v3";

export function jsonError(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function verifyAuth(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, error: "No token" };

  try {
    // Verify Firebase ID token by calling Google's tokeninfo endpoint.
    // Simple + reliable inside Cloudflare Workers (no crypto libs).
    const res = await fetch("https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=" + token);
    if (!res.ok) return { ok: false, error: "Invalid token" };
    const info = await res.json();

    if (info.aud !== FIREBASE_PROJECT_ID)
      return { ok: false, error: "Wrong audience" };
    if (info.email !== ADMIN_EMAIL)
      return { ok: false, error: "Not admin" };
    if (info.email_verified !== "true" && info.email_verified !== true)
      return { ok: false, error: "Email not verified" };

    return { ok: true, email: info.email };
  } catch (e) {
    return { ok: false, error: "Verify failed: " + e.message };
  }
}