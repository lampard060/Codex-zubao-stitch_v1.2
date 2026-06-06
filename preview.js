/**
 * ZuBao 本地预览服务器
 * 使用 Node.js 内置模块，无需安装任何依赖。
 *
 * 用法：
 *   node preview.js
 *
 * 然后访问 http://localhost:3000
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const APP_DIR = path.join(__dirname, "app");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".webp": "image/webp",
  ".woff2":"font/woff2",
  ".woff": "font/woff",
  ".ttf":  "font/ttf",
  ".webmanifest": "application/manifest+json",
};

const server = http.createServer((req, res) => {
  // Default to index.html for directory requests
  let urlPath = req.url.split("?")[0].split("#")[0];
  if (urlPath.endsWith("/")) urlPath += "index.html";

  const filePath = path.join(APP_DIR, urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(APP_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404);
        res.end("Not Found");
      } else {
        res.writeHead(500);
        res.end("Internal Server Error");
      }
      return;
    }

    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // Disable caching for development
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": data.length,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  ZuBao 预览服务器已启动`);
  console.log(`  ───────────────────────────`);
  console.log(`  本地访问: http://localhost:${PORT}`);
  console.log(`  退出: Ctrl+C\n`);
});
