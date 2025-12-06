import "https://deno.land/x/dotenv/load.ts";

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

/**
 * 400レスポンスを返す
 * @param message エラーメッセージ
 * @returns 400 エラーレスポンス
 */
function badRequest(message = "Bad Request") {
  return new Response(TEXT_ENCODER.encode(message), {
    status: 400,
  });
}

/**
 * 404レスポンスを返す
 * @param message エラーメッセージ
 * @returns 404 エラーレスポンス
 */
function notFound(message = "Not Found") {
  return new Response(TEXT_ENCODER.encode(message), { status: 404 });
}

/**
 * 500エラーのレスポンスを返す
 * @param message エラーメッセージ
 * @returns 500 エラーレスポンス
 */
function internalError(message = "Internal Server Error") {
  return new Response(TEXT_ENCODER.encode(message), { status: 500 });
}

/**
 * パス名を正規化する
 * @param pathname リクエストのパス名
 * @returns 正規化されたパス名、または不正な場合はnull
 */
function normalizePathname(pathname: string) {
  try {
    pathname = decodeURIComponent(pathname);
  } catch (_) {
    return null;
  }
  if (pathname.includes("..")) return null;
  return pathname;
}

/**
 * ファイルが存在するか確認する
 * @param path ファイルシステムのパス
 * @returns ファイルが存在する場合はtrue、存在しない場合はfalse
 */
async function fileExists(path: string) {
  try {
    const stat = await Deno.stat(path);
    return stat.isFile;
  } catch (_e) {
    return false;
  }
}

/**
 * ファイルを読み込み、レスポンスとして返す
 * @param path ファイルシステムのパス
 * @returns
 */
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

/**
 * 与えられたパス名に対応するページファイルをマッピングする（存在確認はしない）
 *
 * @param pathname リクエストのパス名
 * @returns
 */
function mapRequestToFile(pathname: string) {
  const c = getPageCandidates(pathname);
  return c.length > 0 ? c[0] : "";
}

/**
 * 与えられたパス名に対応する最初に見つかったページファイルを解決する
 *
 * @param pathname リクエストのパス名
 * @returns ファイルシステムのパス、または見つからなかった場合はnull
 *
 * @example
 *  - /               -> ./pages/index/index.html
 *  - /foo            -> ./pages/foo/index.html, ./pages/foo/foo.html
 *  - /foo.html       -> ./pages/foo/foo.html
 *  - /foo/bar        -> ./pages/foo/bar/index.html, ./pages/foo/bar.html
 *  - /foo/bar.ext    -> ./pages/foo/bar.ext
 */
async function resolvePageFile(pathname: string): Promise<string | null> {
  const candidates = getPageCandidates(pathname);
  for (const c of candidates) {
    if (await fileExists(c)) return c;
  }
  return null;
}

/**
 * 与えられたパス名に対応するページファイルの候補を順序付きで返す
 *
 * @param pathname リクエストのパス名
 * @returns ページファイルの候補パスの配列
 */
function getPageCandidates(pathname: string): string[] {
  // パスを`/`で分割し、空のセグメントを除去
  const segs = pathname.split("/").filter(Boolean);
  const candidates: string[] = [];

  // ルート
  if (segs.length === 0) {
    candidates.push("./pages/index/index.html");
    return candidates;
  }

  // 単一セグメント: /hoge, /hoge.html, /hoge/
  if (segs.length === 1) {
    const a = segs[0];
    const idx = a.lastIndexOf(".");
    if (idx !== -1) {
      const name = a.slice(0, idx);
      const ext = a.slice(idx).toLowerCase();
      if (ext === ".html") {
        // /hoge.html -> pages/hoge/index.html
        candidates.push(`./pages/${name}/index.html`);
        return candidates;
      }
      // その他の拡張子は直接ファイルを参照する（例: /hello.css -> pages/hello/hello.css）
      candidates.push(`./pages/${name}/${name}${ext}`);
      return candidates;
    }

    // 拡張子なしはディレクトリの index.html を返す
    candidates.push(`./pages/${a}/index.html`);
    return candidates;
  }

  // 2セグメント以上: /hoge/huga, /hoge/huga.html, /hoge/huga/
  const dir = segs[0];
  const restSegs = segs.slice(1);
  const last = restSegs[restSegs.length - 1];
  const lastDot = last.lastIndexOf(".");

  if (lastDot !== -1) {
    const ext = last.slice(lastDot).toLowerCase();
    const nameWithoutExt = last.slice(0, lastDot);
    if (ext === ".html") {
      // /hoge/.../huga.html -> pages/hoge/.../huga/index.html
      const restPath = [...restSegs.slice(0, -1), nameWithoutExt].join("/");
      candidates.push(`./pages/${dir}/${restPath}/index.html`);
      return candidates;
    }

    // 拡張子が HTML 以外なら直接ファイルを参照する
    const restPath = restSegs.join("/");
    candidates.push(`./pages/${dir}/${restPath}`);
    return candidates;
  }

  // 拡張子無しのネストパス -> pages/dir/rest.../index.html
  const restPath = restSegs.join("/");
  candidates.push(`./pages/${dir}/${restPath}/index.html`);
  return candidates;
}

/**
 * APIハンドラを処理する
 *
 * @param req リクエストオブジェクト
 * @param pathname リクエストのパス名
 * @returns レスポンスオブジェクト、または該当するハンドラがない場合はnull
 */
async function handleApi(
  req: Request,
  pathname: string
): Promise<Response | null> {
  // /api または /api/ を取り除く
  let rest = pathname.replace(/^\/api\/?/, "");
  if (!rest) return null;

  const candidates = [
    `./api/endpoints/${rest}.ts`,
    `./api/endpoints/${rest}.js`,
  ];

  for (const c of candidates) {
    if (await fileExists(c)) {
      try {
        const moduleUrl = new URL(c, import.meta.url).href;
        const mod = await import(moduleUrl);
        const fn = mod.default ?? mod.handler;
        // 呼び出し可能か確認
        if (typeof fn === "function") {
          const maybeResp = await fn(req);
          if (maybeResp instanceof Response) return maybeResp;
          return new Response(JSON.stringify(maybeResp), {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
            },
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

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      const apiResp = await handleApi(req, pathname);
      if (apiResp) return apiResp;
      return notFound();
    }

    const filePath = await resolvePageFile(pathname);
    if (!filePath) return notFound();
    return serveFile(filePath);
  } catch (err) {
    console.error("Request handler failed", err);
    return internalError();
  }
});
