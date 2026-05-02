const express = require("express");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());

// Main proxy endpoint
app.get("/proxy", async (req, res) => {
  let targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: "No URL provided" });
  }

  // Add https:// if missing
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";

    // If it's HTML, rewrite links so they also go through the proxy
    if (contentType.includes("text/html")) {
      let html = await response.text();

      // Rewrite absolute links
      const baseOrigin = new URL(targetUrl).origin;
      const basePath = new URL(targetUrl).href;

      // Inject base rewriting script
      const injectedScript = `
        <script>
          (function() {
            const PROXY = "/proxy?url=";
            const BASE = "${baseOrigin}";

            function rewrite(url) {
              if (!url || url.startsWith("javascript:") || url.startsWith("mailto:") || url.startsWith("#") || url.startsWith("data:")) return url;
              if (url.startsWith("/proxy?url=")) return url;
              if (url.startsWith("http://") || url.startsWith("https://")) return PROXY + encodeURIComponent(url);
              if (url.startsWith("//")) return PROXY + encodeURIComponent("https:" + url);
              if (url.startsWith("/")) return PROXY + encodeURIComponent(BASE + url);
              return PROXY + encodeURIComponent(BASE + "/" + url);
            }

            // Intercept clicks
            document.addEventListener("click", function(e) {
              const a = e.target.closest("a");
              if (a && a.href && !a.href.startsWith(window.location.origin + "/proxy")) {
                e.preventDefault();
                const newUrl = rewrite(a.href);
                if (newUrl) window.location.href = newUrl;
              }
            }, true);

            // Intercept form submits
            document.addEventListener("submit", function(e) {
              const form = e.target;
              if (form.action) {
                e.preventDefault();
                const rewritten = rewrite(form.action);
                form.action = rewritten;
                form.submit();
              }
            }, true);
          })();
        </script>
      `;

      // Inject before </body>
      if (html.includes("</body>")) {
        html = html.replace("</body>", injectedScript + "</body>");
      } else {
        html += injectedScript;
      }

      // Rewrite src/href attributes for resources
      html = html.replace(
        /(src|href|action)=["']([^"']+)["']/gi,
        (match, attr, url) => {
          if (
            url.startsWith("data:") ||
            url.startsWith("javascript:") ||
            url.startsWith("#") ||
            url.startsWith("/proxy")
          ) {
            return match;
          }

          let absoluteUrl;
          if (url.startsWith("http://") || url.startsWith("https://")) {
            absoluteUrl = url;
          } else if (url.startsWith("//")) {
            absoluteUrl = "https:" + url;
          } else if (url.startsWith("/")) {
            absoluteUrl = baseOrigin + url;
          } else {
            absoluteUrl = basePath.replace(/\/[^\/]*$/, "/") + url;
          }

          // Only proxy HTML navigations; pass resources directly via proxy too
          return `${attr}="/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
        }
      );

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.send(html);
    } else {
      // For non-HTML (images, CSS, JS, etc.) — stream directly
      const buffer = await response.buffer();
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
    }
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2>❌ No se pudo cargar la página</h2>
        <p>${err.message}</p>
        <a href="/">← Regresar</a>
      </body></html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy corriendo en http://localhost:${PORT}`);
});
