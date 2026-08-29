import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { LAUNCHER_TEMPLATE_URI, launcherWidgetHtml } from "./widget";

const APP_ORIGIN = "https://next-slide-please.aiconic-innovations.workers.dev";
const GOOGLE_SLIDES_ID = /docs\.google\.com\/presentation\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/;

const paceSchema = z.enum(["brisk", "natural", "detailed"]);
const runInputSchema = z.object({
  googleSlidesUrl: z.string().min(1).max(2_000).describe("A public Google Slides sharing URL."),
  presentationTitle: z.string().trim().min(1).max(100).optional().describe("A short title to show in the launcher."),
  pace: paceSchema.default("natural").describe("The speaking pace used when smart timing is calculated."),
  secondsPerSlide: z.array(z.number().int().min(5).max(600)).max(200).optional()
    .describe("Optional per-slide durations in seconds, ordered from the first slide."),
  autoplay: z.boolean().default(true).describe("Whether the run link should open directly in hands-free presentation mode."),
});

const runOutputSchema = z.object({
  googleSlidesUrl: z.string(),
  presentationTitle: z.string(),
  pace: paceSchema,
  paceLabel: z.string(),
  secondsPerSlide: z.array(z.number()),
  studioUrl: z.string().url(),
  runUrl: z.string().url(),
});

type RunInput = z.infer<typeof runInputSchema>;

function createPlan(input: RunInput) {
  const match = input.googleSlidesUrl.match(GOOGLE_SLIDES_ID);
  if (!match) return null;

  const canonicalDeckUrl = `https://docs.google.com/presentation/d/${match[1]}/edit`;
  const paceMultiplier = input.pace === "brisk" ? 0.78 : input.pace === "detailed" ? 1.28 : 1;
  const paceLabel = input.pace[0].toUpperCase() + input.pace.slice(1);
  const durations = input.secondsPerSlide ?? [];
  const encode = (play: boolean) => btoa(JSON.stringify({
    u: canonicalDeckUrl,
    d: durations.length ? durations : undefined,
    m: paceMultiplier,
    p: play,
  }));

  return {
    googleSlidesUrl: canonicalDeckUrl,
    presentationTitle: input.presentationTitle ?? "Your presentation",
    pace: input.pace,
    paceLabel,
    secondsPerSlide: durations,
    studioUrl: `${APP_ORIGIN}/#${encode(false)}`,
    runUrl: `${APP_ORIGIN}/#${encode(input.autoplay)}`,
  };
}

function invalidDeckResult() {
  return {
    isError: true as const,
    content: [{
      type: "text" as const,
      text: "Please provide a standard Google Slides sharing link from docs.google.com/presentation/d/... and make sure the deck is shared with ‘Anyone with the link’.",
    }],
  };
}

function createServer() {
  const server = new McpServer(
    { name: "next-slide-please", version: "1.1.0" },
    {
      instructions: "Create free, hands-free run links for public Google Slides decks. Call create_presentation_run first. If the user would benefit from launch buttons, pass the same inputs to show_presentation_launcher. Never claim a private deck can be accessed; the user must enable ‘Anyone with the link’.",
    },
  );

  server.registerResource(
    "next-slide-please-launcher",
    LAUNCHER_TEMPLATE_URI,
    {
      title: "Next Slide Please launcher",
      description: "Launch or tune a hands-free Google Slides presentation.",
      mimeType: "text/html;profile=mcp-app",
      _meta: {
        ui: {
          prefersBorder: true,
          domain: APP_ORIGIN,
          csp: { connectDomains: [], resourceDomains: [] },
        },
        "openai/widgetDescription": "A presentation launcher with buttons to begin hands-free playback or adjust per-slide timing.",
      },
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: "text/html;profile=mcp-app",
        text: launcherWidgetHtml,
        _meta: {
          ui: {
            prefersBorder: true,
            domain: APP_ORIGIN,
            csp: { connectDomains: [], resourceDomains: [] },
          },
          "openai/widgetDescription": "A presentation launcher with buttons to begin hands-free playback or adjust per-slide timing.",
        },
      }],
    }),
  );

  server.registerTool(
    "create_presentation_run",
    {
      title: "Create a timed presentation run",
      description: "Use this when the user wants to turn a public Google Slides link into a smartly timed or manually timed hands-free presentation and receive shareable studio and run links.",
      inputSchema: runInputSchema,
      outputSchema: runOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: {
        securitySchemes: [{ type: "noauth" }],
        "openai/toolInvocation/invoking": "Building the run…",
        "openai/toolInvocation/invoked": "Run ready",
      },
    },
    async (input) => {
      const plan = createPlan(input);
      if (!plan) return invalidDeckResult();
      return {
        structuredContent: plan,
        content: [{
          type: "text",
          text: `Created a ${plan.paceLabel.toLowerCase()}-pace presentation run. The studio link lets the user review every slide; the run link opens in hands-free playback mode.`,
        }],
      };
    },
  );

  server.registerTool(
    "show_presentation_launcher",
    {
      title: "Show the presentation launcher",
      description: "Use this to render launch buttons after create_presentation_run has prepared a valid run. Pass the same presentation inputs used for that tool.",
      inputSchema: runInputSchema,
      outputSchema: runOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: {
        securitySchemes: [{ type: "noauth" }],
        ui: { resourceUri: LAUNCHER_TEMPLATE_URI, visibility: ["model", "app"] },
        "openai/outputTemplate": LAUNCHER_TEMPLATE_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Preparing launcher…",
        "openai/toolInvocation/invoked": "Launcher ready",
      },
    },
    async (input) => {
      const plan = createPlan(input);
      if (!plan) return invalidDeckResult();
      return {
        structuredContent: plan,
        content: [{ type: "text", text: "The presentation launcher is ready." }],
      };
    },
  );

  return server;
}

export const mcpHandler = createMcpHandler(createServer);
