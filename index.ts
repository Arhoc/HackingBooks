import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { extname, join } from "https://deno.land/std@0.224.0/path/mod.ts";

const BOOKS_DIR = "./Books";

function getBookList(): string[] {
  return Array.from(Deno.readDirSync(BOOKS_DIR))
    .filter((entry) => entry.isFile && extname(entry.name) === ".pdf")
    .map((entry) => entry.name);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/") {
    const books = getBookList();
    const bookListHtml = books.map(
      (book) => `
        <li class="book-item">
          <div class="cover"><img data-title="${escapeHtml(book)}" src="/static/placeholder.png" alt="cover" loading="lazy"></div>
          <div class="meta">
            <a href="/Books/${encodeURIComponent(book)}" download>${escapeHtml(book)}</a>
          </div>
        </li>`
    ).join("");
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hacking Book Database</title>
  <link rel="stylesheet" href="/static/style.css">
  <script defer src="/static/covers.js"></script>
</head>
<body>
  <header>
    <h1>Hacking Book Database</h1>
  </header>
  <main>
    <ul class="book-list">
      ${bookListHtml}
    </ul>
  </main>
  <footer>
    <p>Powered by Deno</p>
  </footer>
</body>
</html>`;
    return new Response(html, { headers: { "content-type": "text/html" } });
  }

  if (url.pathname.startsWith("/Books/")) {
    const filePath = join(BOOKS_DIR, decodeURIComponent(url.pathname.replace("/Books/", "")));
    try {
      const file = await Deno.open(filePath, { read: true });
      const stat = await Deno.stat(filePath);
      return new Response(file.readable, {
        headers: {
          "content-type": "application/pdf",
          "content-length": stat.size.toString(),
          "content-disposition": `attachment; filename=\"${filePath.split("/").pop()}\"`,
        },
      });
    } catch {
      return new Response("File not found", { status: 404 });
    }
  }

  if (url.pathname.startsWith("/static/")) {
    const staticPath = "." + url.pathname;
    try {
      const file = await Deno.open(staticPath, { read: true });
      const ext = extname(staticPath).toLowerCase();
      const contentTypes: Record<string, string> = {
        ".css": "text/css",
        ".js": "application/javascript",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
      };
      const contentType = contentTypes[ext] || "application/octet-stream";
      return new Response(file.readable, {
        headers: { "content-type": contentType },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }

  if (url.pathname === "/api/cover") {
    const title = url.searchParams.get("title") ?? "";
    if (!title) {
      return new Response(JSON.stringify({ url: "/static/placeholder.png" }), {
        headers: { "content-type": "application/json" },
      });
    }
    // Try Open Library first
    const openLibraryUrl = `https://covers.openlibrary.org/b/ISBN/${encodeURIComponent(title)}-L.jpg`;
    // Try Google Books API
    const googleBooksApi = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}`;
    try {
      const gbRes = await fetch(googleBooksApi);
      if (gbRes.ok) {
        const data = await gbRes.json();
        const img = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
        if (img) {
          return new Response(JSON.stringify({ url: img }), {
            headers: { "content-type": "application/json" },
          });
        }
      }
    } catch {}
    // fallback to Open Library
    return new Response(JSON.stringify({ url: openLibraryUrl }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response("Not found", { status: 404 });
}

serve(handler, { port: 8080 });
console.log("Server running on http://localhost:8080/");
