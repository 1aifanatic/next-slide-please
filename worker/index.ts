const GOOGLE_SLIDES_ID = /docs\.google\.com\/presentation\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/;
const MAX_DECK_BYTES = 40 * 1024 * 1024;

function jsonError(message: string, status: number): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export default {
  async fetch(request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, service: "next-slide-please" });
    }

    if (url.pathname !== "/api/import" || request.method !== "POST") {
      return jsonError("Not found", 404);
    }

    let body: { url?: unknown };
    try {
      body = await request.json<{ url?: unknown }>();
    } catch {
      return jsonError("Send a valid Google Slides URL.", 400);
    }

    if (typeof body.url !== "string" || body.url.length > 2_000) {
      return jsonError("Send a valid Google Slides URL.", 400);
    }

    const match = body.url.match(GOOGLE_SLIDES_ID);
    if (!match) {
      return jsonError("That does not look like a Google Slides link.", 400);
    }

    const deckId = match[1];
    const exportUrl = `https://docs.google.com/presentation/d/${deckId}/export/pdf`;

    let upstream: Response;
    try {
      upstream = await fetch(exportUrl, {
        headers: {
          "User-Agent": "Next Slide Please/1.0",
          Accept: "application/pdf",
        },
        redirect: "follow",
      });
    } catch (error) {
      console.error(JSON.stringify({ event: "slides_export_failed", deckId, error: String(error) }));
      return jsonError("Google Slides could not be reached. Please try again.", 502);
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    const contentLength = Number(upstream.headers.get("content-length") ?? "0");

    if (!upstream.ok || !contentType.toLowerCase().includes("application/pdf")) {
      console.warn(JSON.stringify({ event: "slides_export_rejected", deckId, status: upstream.status, contentType }));
      return jsonError(
        "This deck is not publicly accessible. In Google Slides, choose Share → General access → Anyone with the link.",
        422,
      );
    }

    if (contentLength > MAX_DECK_BYTES) {
      return jsonError("This deck is over 40 MB. Try compressing its images first.", 413);
    }

    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Deck-Id": deckId,
    });
    if (contentLength > 0) headers.set("Content-Length", String(contentLength));

    return new Response(upstream.body, { status: 200, headers });
  },
} satisfies ExportedHandler;
