# ChatGPT plugin submission kit

## Listing

- **Name:** Next Slide Please
- **Category:** Productivity
- **MCP URL:** `https://next-slide-please.aiconic-innovations.workers.dev/mcp`
- **MCP URL type:** Universal
- **Authentication:** None
- **Website:** `https://next-slide-please.aiconic-innovations.workers.dev`
- **Support:** `https://next-slide-please.aiconic-innovations.workers.dev/support`
- **Privacy:** `https://next-slide-please.aiconic-innovations.workers.dev/privacy`
- **Terms:** `https://next-slide-please.aiconic-innovations.workers.dev/terms`
- **Logo:** `public/logo.svg`

### Short description

Turn a public Google Slides link into a smartly timed, hands-free presentation.

### Long description

Next Slide Please creates a shareable presentation run from any Google Slides deck that has already been shared with “Anyone with the link.” Choose a brisk, natural, or detailed pace, provide exact per-slide durations when needed, and launch a run that advances automatically. A visual launcher lets people start presenting immediately or open the full timing studio to review and adjust every slide. The service is free, open source, and requires no account.

## Starter prompts

1. “Create a natural-paced presentation run for this public Google Slides deck: [link].”
2. “Make this deck brisk and show me launch buttons: [link].”
3. “Create a run with 30, 45, and 20 seconds for the first three slides: [link].”
4. “Open a timing studio for my public presentation: [link].”

## Positive review tests

1. **Smart timing:** Supply a valid public `/presentation/d/` URL with no durations. Expect studio and run URLs and a natural pace.
2. **Brisk pace:** Supply a valid URL with `pace: brisk`. Expect links whose embedded plan uses a 0.78 timing multiplier.
3. **Detailed pace:** Supply a valid URL with `pace: detailed`. Expect links whose embedded plan uses a 1.28 timing multiplier.
4. **Manual timing:** Supply a valid URL and `[30, 45, 20]`. Expect all three durations in structured content and the generated run.
5. **Widget:** Call `create_presentation_run`, then `show_presentation_launcher` with the same valid inputs. Expect a bordered launcher with “Present now” and “Tune the timing” actions.

## Negative review tests

1. **Non-Google URL:** Supply `https://example.com/deck`. Expect a clear error and no run URL.
2. **Private deck:** Supply a syntactically valid private Slides URL, then open the generated link. Expect the app to explain how to enable “Anyone with the link”; it must not claim access.
3. **Unsafe timing:** Supply a duration below 5 seconds or above 600 seconds. Expect schema validation to reject the call.

## Release notes

Initial public release. Adds an auth-free MCP server, two idempotent presentation tools, a ChatGPT launcher widget, smart/manual timing run links, public privacy/terms/support pages, and Cloudflare production hosting.

## Submission prerequisites owned by the publisher

- Verify the individual or business identity in the OpenAI Platform organization.
- Ensure the submitter has **Apps Management: Write** permission.
- Create a **With MCP** submission and choose **Universal** URL type.
- If prompted, place the exact OpenAI domain-verification token at `/.well-known/openai-apps-challenge` and redeploy.
- Run **Scan Tools**, resolve any portal feedback, and execute all tests above.
- Upload final listing artwork/screenshots and select the intended country availability.
