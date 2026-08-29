export const LAUNCHER_TEMPLATE_URI = "ui://next-slide-please/launcher-v1.html";

export const launcherWidgetHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Next Slide Please</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 10px; background: transparent; color: #171432; }
    .card { position: relative; overflow: hidden; border: 1px solid rgba(23,20,50,.16); border-radius: 20px; padding: 20px; background: #fff8ec; box-shadow: 0 10px 30px rgba(23,20,50,.08); }
    .grid { position: absolute; inset: 0; opacity: .3; pointer-events: none; background-image: linear-gradient(rgba(23,20,50,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(23,20,50,.08) 1px,transparent 1px); background-size: 24px 24px; }
    .content { position: relative; z-index: 1; }
    .brand { display: flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 750; }
    .mark { width: 31px; height: 31px; display: grid; place-items: center; border-radius: 50% 50% 50% 9px; color: white; background: #ff6a3d; font-size: 18px; }
    .please { color: #6d4aff; font-family: Georgia, serif; font-style: italic; }
    .badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 22px; border: 1px solid #cfc4ff; border-radius: 999px; padding: 6px 9px; color: #5c41d2; background: rgba(255,255,255,.7); font: 600 9px ui-monospace, monospace; letter-spacing: 1.2px; }
    h1 { margin: 14px 0 6px; max-width: 520px; font: 700 clamp(29px,7vw,47px)/.98 Georgia, serif; letter-spacing: -1.7px; }
    h1 em { color: #6d4aff; }
    .subtitle { margin: 0; color: #676274; font-size: 13px; line-height: 1.5; }
    .details { display: flex; flex-wrap: wrap; gap: 7px; margin: 17px 0; }
    .chip { border-radius: 8px; padding: 7px 9px; background: rgba(255,255,255,.8); border: 1px solid rgba(23,20,50,.12); color: #5f5a6c; font-size: 10px; }
    .chip strong { color: #171432; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
    button { min-height: 46px; border-radius: 11px; border: 0; padding: 0 14px; font: 700 12px inherit; cursor: pointer; }
    .primary { color: white; background: #ff6a3d; box-shadow: 3px 3px 0 #171432; }
    .secondary { color: #171432; background: white; border: 1px solid #171432; }
    .fine { margin: 14px 0 0; color: #85808c; font-size: 9px; }
    .error { color: #a92920; }
    @media (prefers-color-scheme: dark) {
      body { color: #f7f4ff; }
      .card { background: #1b172d; border-color: #3f385c; }
      .grid { opacity: .12; }
      .subtitle,.fine { color: #aca5bd; }
      .chip { color: #c1bacf; background: #28223e; border-color: #453d61; }
      .chip strong { color: white; }
      .secondary { color: white; border-color: #766d91; background: #28223e; }
      .primary { box-shadow: 3px 3px 0 #d4f85b; }
    }
    @media (max-width: 420px) { .actions { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main class="card">
    <div class="grid"></div>
    <div class="content">
      <div class="brand"><span class="mark">→</span><span>Next Slide <span class="please">Please</span></span></div>
      <span class="badge">✦ YOUR RUN IS READY</span>
      <h1 id="title">Your presentation is <em>ready.</em></h1>
      <p class="subtitle" id="subtitle">Open the timing studio or jump straight into hands-free playback.</p>
      <div class="details">
        <span class="chip">Pace: <strong id="pace">Natural</strong></span>
        <span class="chip" id="timing">Smart timing</span>
        <span class="chip">No sign-in</span>
      </div>
      <div class="actions">
        <button class="primary" id="present">▶ Present now</button>
        <button class="secondary" id="studio">Tune the timing</button>
      </div>
      <p class="fine">The deck must be publicly shared. Links open on next-slide-please.aiconic-innovations.workers.dev.</p>
    </div>
  </main>
  <script type="module">
    let latest = window.openai?.toolOutput ?? null;

    const safeText = (value, fallback) => typeof value === "string" && value.trim() ? value.trim() : fallback;
    const isAllowedLink = (value) => {
      try { return new URL(value).origin === "https://next-slide-please.aiconic-innovations.workers.dev"; }
      catch { return false; }
    };

    function render(data) {
      if (!data || typeof data !== "object") return;
      latest = data;
      const title = safeText(data.presentationTitle, "Your presentation");
      document.querySelector("#title").innerHTML = "";
      document.querySelector("#title").append(document.createTextNode(title + " is "));
      const em = document.createElement("em"); em.textContent = "ready.";
      document.querySelector("#title").append(em);
      document.querySelector("#pace").textContent = safeText(data.paceLabel, "Natural");
      const count = Array.isArray(data.secondsPerSlide) ? data.secondsPerSlide.length : 0;
      document.querySelector("#timing").textContent = count ? count + " custom slide times" : "Smart timing";
    }

    async function openExternal(href) {
      if (!isAllowedLink(href)) return;
      if (window.openai?.openExternal) await window.openai.openExternal({ href });
      else window.open(href, "_blank", "noopener,noreferrer");
    }

    document.querySelector("#present").addEventListener("click", () => openExternal(latest?.runUrl));
    document.querySelector("#studio").addEventListener("click", () => openExternal(latest?.studioUrl));

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message?.jsonrpc !== "2.0") return;
      if (message.method === "ui/notifications/tool-result") render(message.params?.structuredContent);
    });

    render(latest);
  </script>
</body>
</html>`;
