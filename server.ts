const TEXT_ENCODER = new TextEncoder();

/**
 * 指定されたパスに対応するContent-Typeを返す
 *
 * @param path URLのパス
 * @returns 対応するContent-Type、または不明な場合はundefined
 */
function getContentType(path: string): string | undefined {
  const p = path.toLowerCase();
  switch (true) {
    case p.endsWith(".html"):
      return "text/html; charset=utf-8";
    case p.endsWith(".css"):
      return "text/css; charset=utf-8";
    case p.endsWith(".js"):
      return "application/javascript; charset=utf-8";
    case p.endsWith(".json"):
      return "application/json; charset=utf-8";
    case p.endsWith(".svg"):
      return "image/svg+xml";
    case p.endsWith(".png"):
      return "image/png";
    case p.endsWith(".jpg"):
    case p.endsWith(".jpeg"):
      return "image/jpeg";
    case p.endsWith(".gif"):
      return "image/gif";
    default:
      return undefined;
  }
}

function badRequest(message = "Bad Request") {
  return new Response(TEXT_ENCODER.encode(message), {
    status: 400,
  });
}

function notFound(message = "Not Found") {
  return new Response(TEXT_ENCODER.encode(message), { status: 404 });
}

function internalError(message = "Internal Server Error") {
  return new Response(TEXT_ENCODER.encode(message), { status: 500 });
}

function normalizePathname(pathname: string) {
  try {
    pathname = decodeURIComponent(pathname);
  } catch (_) {
    return null;
  }
  if (pathname.includes("..")) return null;
  return pathname;
}

async function fileExists(path: string) {
  try {
    const stat = await Deno.stat(path);
    return stat.isFile;
  } catch (_e) {
    return false;
  }
}

async function serveFile(path: string) {
  try {
    const data = await Deno.readFile(path);
    const ct = getContentType(path) ?? "application/octet-stream";
    return new Response(data, {
      status: 200,
      headers: {
        "content-type": ct,
        "cache-control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Failed to read file", path, err);
    return internalError();
  }
}

function mapRequestToFile(pathname: string) {
  // Pages routes
  // Split and handle various shapes:
  //  - /                -> ./pages/index/index.html
  //  - /foo             -> ./pages/foo/foo.html
  //  - /foo.html        -> ./pages/foo/foo.html
  //  - /foo.css         -> ./pages/foo/foo.css
  //  - /foo/bar         -> ./pages/foo/bar.html
  //  - /foo/bar.ext     -> ./pages/foo/bar.ext
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) {
    return "./pages/index/index.html";
  }

  if (segs.length === 1) {
    const a = segs[0];
    // if a has extension
    const idx = a.lastIndexOf(".");
    if (idx !== -1) {
      const name = a.slice(0, idx);
      const ext = a.slice(idx);
      return `./pages/${name}/${name}${ext}`;
    }
    // no ext -> pages/a/a.html
    return `./pages/${a}/${a}.html`;
  }

  // segs.length >= 2
  // map /dir/inner... -> ./pages/dir/inner...
  const dir = segs[0];
  const rest = segs.slice(1).join("/");
  // if rest has extension, keep it; else append .html
  if (rest.includes(".")) {
    return `./pages/${dir}/${rest}`;
  }
  return `./pages/${dir}/${rest}.html`;
}

/**
 * Handle API requests by dynamically importing modules from ./api/endpoints.
 * The module should export a `default` async function that accepts
 * a Request and returns a Response (or Promise<Response>).
 *
 * Supported file locations (checked in order):
 *  - ./api/endpoints/<rest>.ts
 *  - ./api/endpoints/<rest>.js
 *  - ./api/endpoints/<rest>/index.ts
 *  - ./api/endpoints/<rest>/index.js
 */
async function handleApi(
  req: Request,
  pathname: string
): Promise<Response | null> {
  // strip leading /api or /api/
  let rest = pathname.replace(/^\/api\/?/, "");
  // if empty, no specific handler
  if (!rest) return null;

  const candidates = [
    `./api/endpoints/${rest}.ts`,
    `./api/endpoints/${rest}.js`,
    `./api/endpoints/${rest}/index.ts`,
    `./api/endpoints/${rest}/index.js`,
  ];

  for (const c of candidates) {
    if (await fileExists(c)) {
      try {
        // import using URL relative to this module
        const moduleUrl = new URL(c, import.meta.url).href;
        const mod = await import(moduleUrl);
        // prefer default export, fallback to `handler`
        const fn = mod.default ?? mod.handler;
        if (typeof fn === "function") {
          // call handler and return its Response
          const maybeResp = await fn(req);
          // Expect the handler to return a Response
          if (maybeResp instanceof Response) return maybeResp;
          // If it's not a Response, try to serialize it as JSON
          return new Response(JSON.stringify(maybeResp), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }
        return internalError("API module does not export a handler function");
      } catch (err) {
        console.error("Failed to import/execute API handler", c, err);
        return internalError();
      }
    }
  }

  return null;
}

console.log("Starting server on http://localhost:8000");

await Deno.serve({ port: 8000 }, async (req) => {
  try {
    const url = new URL(req.url);
    const rawPath = url.pathname;
    const pathname = normalizePathname(rawPath);
    if (pathname === null) {
      return badRequest("Invalid path");
    }

    // If this is an API request, try to dispatch to an API module first
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      const apiResp = await handleApi(req, pathname);
      if (apiResp) return apiResp;
      return notFound();
    }
    const mapped = mapRequestToFile(pathname);
    if (!mapped) return notFound();

    if (!(await fileExists(mapped))) {
      // if requested file not found, try a couple of fallbacks for common cases
      // e.g., request /foo -> try ./pages/foo/index.html
      if (mapped.startsWith("./pages/")) {
        const tryIndex = mapped.replace(/\/(?:[^\/]+)\.html$/, "/index.html");
        if (tryIndex !== mapped && (await fileExists(tryIndex))) {
          return serveFile(tryIndex);
        }
      }
      return notFound();
    }

    return serveFile(mapped);
  } catch (err) {
    console.error("Request handler failed", err);
    return internalError();
  }
});
