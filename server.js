const express = require("express");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());

app.get("/proxy", async (req, res) => {
  let targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: "No URL provided" });
  }

  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
        Referer: targetUrl,
      },
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let html = await response.text();

      const parsedUrl = new URL(targetUrl);
      const baseOrigin = parsedUrl.origin;
      const basePath = parsedUrl.href;

      const injectedScript = `
<script>
(function() {
  var PROXY_BASE = "/proxy?url=";
  var ORIGIN = "${baseOrigin}";
  var FULL_URL = "${basePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}";

  function toAbsolute(url) {
    if (!url) return null;
    url = url.trim();
    if (url.startsWith("javascript:") || url.startsWith("mailto:") || url.startsWith("#") || url.startsWith("data:")) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("//")) return "https:" + url;
    if (url.startsWith("/")) return ORIGIN + url;
    var base = FULL_URL.includes("?") ? FULL_URL.split("?")[0] : FULL_URL;
    var dir = base.endsWith("/") ? base : base.replace(/\\/[^\\/]*$/, "/");
    return dir + url;
  }

  function proxify(url) {
    var abs = toAbsolute(url);
    if (!abs) return null;
    return PROXY_BASE + encodeURIComponent(abs);
  }

  document.addEventListener("click", function(e) {
    var a = e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    var proxied = proxify(href);
    if (proxied) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = proxied;
    }
  }, true);

  document.addEventListener("submit", function(e) {
    var form = e.target;
    var action = form.getAttribute("action") || FULL_URL;
    var method = (form.method || "get").toLowerCase();
    if (method === "get") {
      e.preventDefault();
      e.stopPropagation();
      var data = new FormData(form);
      var params = new URLSearchParams();
      for (var pair of data.entries()) params.append(pair[0], pair[1]);
      var abs = toAbsolute(action);
      var fullTarget = abs + (abs.includes("?") ? "&" : "?") + params.toString();
      window.location.href = PROXY_BASE + encodeURIComponent(fullTarget);
    }
  }, true);
})();
</script>`;

      html = html.replace(
        /((?:src|href|action)\s*=\s*)(["'])([^"']*)\2/gi,
        function(match, attr, quote, url) {
          var trimmed = url.trim();
          if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("javascript:") || trimmed.startsWith("#") || trimmed.startsWith("/proxy?url=")) {
            return match;
          }
          var absolute;
          if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            absolute = trimmed;
          } else if (trimmed.startsWith("//")) {
            absolute = "https:" + trimmed;
          } else if (trimmed.startsWith("/")) {
            absolute = baseOrigin + trimmed;
          } else {
            var base = basePath.includes("?") ? basePath.split("?")[0] : basePath;
            var dir = base.endsWith("/") ? base : base.replace(/\/[^\/]*$/, "/");
            absolute = dir + trimmed;
          }
          return attr + quote + "/proxy?url=" + encodeURIComponent(absolute) + quote;
        }
      );

      if (html.includes("</body>")) {
        html = html.replace("</body>", injectedScript + "\n</body>");
      } else {
        html += injectedScript;
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.send(html);
    } else {
      const buffer = await response.buffer();
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
    }
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).send(`
      <!DOCTYPE html>
      <html><body style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:40px;text-align:center">
        <h2 style="color:#7c3aed">No se pudo cargar</h2>
        <p style="color:#64748b;margin:16px 0">${err.message}</p>
        <a href="/" style="color:#06b6d4">Regresar al inicio</a>
      </body></html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`MiProxy corriendo en http://localhost:${PORT}`);
});
