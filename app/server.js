const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const STATIC_DIR = __dirname;

const mimeTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const CACHE_TYPES = {
  ".html": "public, max-age=0, must-revalidate",
  ".js": "public, max-age=86400",
  ".css": "public, max-age=86400",
  ".json": "public, max-age=0, must-revalidate",
  ".png": "public, max-age=2592000",
  ".jpg": "public, max-age=2592000",
  ".gif": "public, max-age=2592000",
  ".svg": "public, max-age=2592000",
  ".ico": "public, max-age=604800"
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];
  let filePath = path.join(STATIC_DIR, urlPath === "/" ? "index.html" : urlPath);

  const extname = String(path.extname(filePath)).toLowerCase();

  // Function to read file and send response
  const sendFile = (finalFilePath, finalContentType) => {
    fs.readFile(finalFilePath, (error, content) => {
      if (error) {
        if (error.code === "ENOENT") {
          res.writeHead(404, { "Content-Type": "text/html" });
          res.end("<h1>404 Not Found</h1>", "utf-8");
        } else {
          res.writeHead(500);
          res.end(`Server Error: ${error.code}`);
        }
      } else {
        const cacheHeader = CACHE_TYPES[extname] || "public, max-age=86400";
        res.writeHead(200, { 
          "Content-Type": finalContentType,
          "Cache-Control": cacheHeader
        });
        res.end(content, "utf-8");
      }
    });
  };

  // Check if file exists, if not try adding .html
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err && !extname) {
      // File not found and no extension, try adding .html
      const htmlFilePath = filePath + ".html";
      const htmlContentType = "text/html";
      sendFile(htmlFilePath, htmlContentType);
    } else {
      const contentType = mimeTypes[extname] || "application/octet-stream";
      sendFile(filePath, contentType);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Serving files from: ${STATIC_DIR}`);
});
