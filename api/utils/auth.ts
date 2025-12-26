const ADMIN_USERNAME = Deno.env.get("ADMIN_USER") || "admin";
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASS") || "password";

export function isAdminRequest(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("basic ")) return false;

  const b64 = auth.slice(6).trim();
  let decoded: string;
  try {
    decoded = new TextDecoder().decode(b64decode(b64));
  } catch {
    return false;
  }

  const idx = decoded.indexOf(":");
  if (idx === -1) return false;

  const username = decoded.slice(0, idx);
  const password = decoded.slice(idx + 1);

  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "www-authenticate": 'Basic realm="kdbxttrc-admin"',
    },
  });
}

function b64decode(value: string): Uint8Array {
  // atob is available in Deno runtime
  const bin = atob(value);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
