const ADMIN_EMAIL = "kgomotsomogoane96@gmail.com";
const FIREBASE_API_KEY = "AIzaSyBHYbGBD67I2WxYXaL1OPTI5ZjVlOWbYOc"; // from your firebaseConfig

export function jsonError(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function verifyAuth(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, error: "No token" };

  try {
    // Correct way without secrets: ask Firebase Identity Toolkit to validate the ID token.
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        data?.error?.message ||
        `Token verification failed (HTTP ${res.status})`;
      return { ok: false, error: msg };
    }

    const user = data?.users?.[0];
    if (!user?.email) return { ok: false, error: "No user on token" };

    if (user.email !== ADMIN_EMAIL) return { ok: false, error: "Not admin" };
    if (!user.emailVerified) return { ok: false, error: "Email not verified" };

    return { ok: true, email: user.email, uid: user.localId };
  } catch (e) {
    return { ok: false, error: "Verify failed: " + e.message };
  }
}
