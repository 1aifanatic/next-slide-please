import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clipboard,
  Clock3,
  ExternalLink,
  Gauge,
  Github,
  Link2,
  LoaderCircle,
  Maximize,
  Pause,
  Play,
  Plus,
  Presentation,
  RotateCcw,
  Sparkles,
  TimerReset,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type Slide = {
  pageNumber: number;
  title: string;
  words: number;
  suggestedSeconds: number;
  seconds: number;
  thumbnail: string;
};

type View = "landing" | "studio" | "presenter" | "finished";
type SharedPlan = { u: string; d?: number[]; p?: boolean };

const EXAMPLE_URL = "https://docs.google.com/presentation/d/your-deck-id/edit";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getSharedPlan(): SharedPlan | null {
  const value = window.location.hash.slice(1);
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(value)))) as SharedPlan;
  } catch {
    return null;
  }
}

function encodePlan(plan: SharedPlan) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(plan))));
}

async function renderThumbnail(document: PDFDocumentProxy, pageNumber: number) {
  const page = await document.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 280 / base.width });
  const canvas = window.document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas is unavailable in this browser.");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();
  return canvas.toDataURL("image/jpeg", 0.78);
}

function analyzeTiming(words: number, textItems: number) {
  // Conversational pace (~138 wpm) plus a small pause for visual orientation.
  const speaking = words / 2.3;
  const visualPause = 8 + Math.min(12, textItems * 0.16);
  return clamp(Math.ceil((speaking + visualPause) / 5) * 5, 15, 120);
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className={`logo ${light ? "logo-light" : ""}`}>
      <span className="logo-mark"><ArrowRight size={18} strokeWidth={3} /></span>
      <span>Next Slide <em>Please</em></span>
    </div>
  );
}

function App() {
  const [view, setView] = useState<View>("landing");
  const [deckUrl, setDeckUrl] = useState("");
  const [deck, setDeck] = useState<PDFDocumentProxy | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const importedFromHash = useRef(false);

  const importDeck = useCallback(async (sourceUrl: string, shared?: SharedPlan) => {
    const normalized = sourceUrl.trim();
    if (!normalized) {
      setError("Paste a public Google Slides link to get started.");
      return;
    }

    setDeckUrl(normalized);
    setLoading(true);
    setLoadProgress(5);
    setError("");

    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "That presentation could not be imported.");
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      setLoadProgress(18);
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      setDeck(pdf);
      const analyzed: Slide[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const chunks = content.items
          .filter((item): item is (typeof content.items)[number] & { str: string } => "str" in item)
          .map((item) => item.str.trim())
          .filter(Boolean);
        const text = chunks.join(" ");
        const words = text.match(/[\p{L}\p{N}'’-]+/gu)?.length ?? 0;
        const suggestedSeconds = analyzeTiming(words, chunks.length);
        const titleSource = chunks.find((chunk) => chunk.length > 2) ?? `Slide ${pageNumber}`;
        const title = titleSource.length > 70 ? `${titleSource.slice(0, 67)}…` : titleSource;
        const thumbnail = await renderThumbnail(pdf, pageNumber);
        const sharedSeconds = shared?.d?.[pageNumber - 1];

        analyzed.push({
          pageNumber,
          title,
          words,
          suggestedSeconds,
          seconds: typeof sharedSeconds === "number" ? clamp(Math.round(sharedSeconds), 5, 600) : suggestedSeconds,
          thumbnail,
        });
        setLoadProgress(18 + Math.round((pageNumber / pdf.numPages) * 80));
      }

      setSlides(analyzed);
      setCurrentSlide(0);
      localStorage.setItem("nsp:lastDeck", normalized);
      if (shared?.p) {
        setView("presenter");
        setRemainingMs((analyzed[0]?.seconds ?? 30) * 1000);
      } else {
        setView("studio");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong while reading this deck.");
      setView("landing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const shared = getSharedPlan();
    if (!shared?.u || importedFromHash.current) return;
    importedFromHash.current = true;
    void importDeck(shared.u, shared);
  }, [importDeck]);

  const totalSeconds = slides.reduce((sum, slide) => sum + slide.seconds, 0);

  const updateSeconds = (index: number, seconds: number) => {
    setSlides((current) => current.map((slide, i) => (
      i === index ? { ...slide, seconds: clamp(Math.round(seconds || 5), 5, 600) } : slide
    )));
  };

  const applyPace = (multiplier: number) => {
    setSlides((current) => current.map((slide) => ({
      ...slide,
      seconds: clamp(Math.round((slide.suggestedSeconds * multiplier) / 5) * 5, 5, 600),
    })));
  };

  const beginPresentation = () => {
    setCurrentSlide(0);
    setRemainingMs((slides[0]?.seconds ?? 30) * 1000);
    setPaused(false);
    setView("presenter");
  };

  const moveToSlide = useCallback((next: number) => {
    if (next >= slides.length) {
      setView("finished");
      return;
    }
    const safe = clamp(next, 0, Math.max(0, slides.length - 1));
    setCurrentSlide(safe);
    setRemainingMs((slides[safe]?.seconds ?? 30) * 1000);
  }, [slides]);

  useEffect(() => {
    if (view !== "presenter" || paused) return;
    const timer = window.setInterval(() => {
      setRemainingMs((value) => {
        if (value <= 100) {
          window.clearInterval(timer);
          window.setTimeout(() => moveToSlide(currentSlide + 1), 0);
          return 0;
        }
        return value - 100;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [view, paused, currentSlide, moveToSlide]);

  useEffect(() => {
    if (view !== "presenter") return;
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowRight", " ", "PageDown"].includes(event.key)) moveToSlide(currentSlide + 1);
      if (["ArrowLeft", "PageUp"].includes(event.key)) moveToSlide(currentSlide - 1);
      if (event.key.toLowerCase() === "p") setPaused((value) => !value);
      if (event.key === "Escape") setView("studio");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, currentSlide, moveToSlide]);

  const copyRunLink = async () => {
    const hash = encodePlan({ u: deckUrl, d: slides.map((slide) => slide.seconds), p: true });
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    await navigator.clipboard.writeText(url);
    window.history.replaceState(null, "", `#${hash}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (view === "presenter" && deck) {
    return (
      <Presenter
        deck={deck}
        slides={slides}
        current={currentSlide}
        remainingMs={remainingMs}
        paused={paused}
        onPause={() => setPaused((value) => !value)}
        onNext={() => moveToSlide(currentSlide + 1)}
        onPrevious={() => moveToSlide(currentSlide - 1)}
        onExit={() => setView("studio")}
      />
    );
  }

  if (view === "finished") {
    return (
      <main className="finished-screen">
        <div className="confetti confetti-a" />
        <div className="confetti confetti-b" />
        <div className="finished-card">
          <span className="finished-icon"><Check size={38} strokeWidth={3} /></span>
          <p className="eyebrow">THAT'S A WRAP</p>
          <h1>You nailed it.</h1>
          <p>{slides.length} slides, perfectly paced in {formatTime(totalSeconds)}.</p>
          <div className="finished-actions">
            <button className="button button-primary" onClick={beginPresentation}><RotateCcw size={18} /> Run it again</button>
            <button className="button button-ghost" onClick={() => setView("studio")}><ArrowLeft size={18} /> Back to timing</button>
          </div>
        </div>
      </main>
    );
  }

  if (view === "studio") {
    return (
      <main className="studio-page">
        <header className="studio-nav">
          <Logo />
          <div className="studio-nav-actions">
            <button className="button button-quiet" onClick={() => { window.location.hash = ""; setView("landing"); }}><Plus size={17} /> New deck</button>
            <button className="button button-dark" onClick={() => void copyRunLink()}>
              {copied ? <Check size={17} /> : <Link2 size={17} />}{copied ? "Link copied" : "Copy run link"}
            </button>
          </div>
        </header>

        <section className="studio-hero">
          <div>
            <p className="eyebrow purple">YOUR RUN OF SHOW</p>
            <h1>Set the pace.<br /><em>Own the room.</em></h1>
          </div>
          <div className="total-card">
            <span><Clock3 size={18} /> TOTAL RUN TIME</span>
            <strong>{formatTime(totalSeconds)}</strong>
            <small>{slides.length} slides · ~{Math.round(totalSeconds / Math.max(1, slides.length))} sec each</small>
          </div>
        </section>

        <section className="pace-bar">
          <div>
            <Gauge size={20} />
            <span><strong>Choose a pace</strong><small>Start with our recommendation, then tune any slide.</small></span>
          </div>
          <div className="pace-options">
            <button onClick={() => applyPace(0.78)}><Zap size={16} /> Brisk</button>
            <button className="active" onClick={() => applyPace(1)}><Sparkles size={16} /> Natural</button>
            <button onClick={() => applyPace(1.28)}><WandSparkles size={16} /> Detailed</button>
          </div>
        </section>

        <section className="slides-editor">
          <div className="editor-head">
            <span>SLIDE</span><span>CONTENT SNAPSHOT</span><span>TIME</span>
          </div>
          {slides.map((slide, index) => (
            <article className="slide-row" key={slide.pageNumber}>
              <span className="slide-number">{String(index + 1).padStart(2, "0")}</span>
              <img src={slide.thumbnail} alt={`Preview of slide ${index + 1}`} />
              <div className="slide-info">
                <h3>{slide.title}</h3>
                <p>{slide.words > 0 ? `${slide.words} words detected` : "Visual slide"} · Suggested {formatTime(slide.suggestedSeconds)}</p>
              </div>
              <label className="time-input">
                <input
                  aria-label={`Seconds for slide ${index + 1}`}
                  type="number"
                  min="5"
                  max="600"
                  value={slide.seconds}
                  onChange={(event) => updateSeconds(index, Number(event.target.value))}
                />
                <span>sec</span>
              </label>
            </article>
          ))}
        </section>

        <div className="launch-dock">
          <div><span className="pulse-dot" /><p><strong>Ready when you are</strong><small>We’ll advance every slide on cue.</small></p></div>
          <button className="button button-launch" onClick={beginPresentation}><Play size={19} fill="currentColor" /> Start presenting</button>
        </div>
      </main>
    );
  }

  return (
    <main className="landing-page">
      <nav className="nav-shell">
        <Logo />
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="https://github.com/1aifanatic/next-slide-please" target="_blank" rel="noreferrer"><Github size={16} /> Open source</a>
        </div>
      </nav>

      <section className="hero-shell">
        <div className="hero-copy">
          <div className="hero-badge"><span>✦</span> THE CLICKER CAN RETIRE NOW</div>
          <h1>Your slides.<br />Perfectly <em>timed.</em></h1>
          <p className="hero-lede">Paste a public Google Slides link. We read the room, set the rhythm, and advance every slide—right on cue.</p>

          <form className={`deck-form ${error ? "has-error" : ""}`} onSubmit={(event) => { event.preventDefault(); void importDeck(deckUrl); }}>
            <label htmlFor="deck-url">YOUR PUBLIC GOOGLE SLIDES LINK</label>
            <div className="url-field">
              <Presentation size={21} />
              <input
                id="deck-url"
                type="url"
                value={deckUrl}
                onChange={(event) => setDeckUrl(event.target.value)}
                placeholder={EXAMPLE_URL}
                disabled={loading}
              />
              <button type="submit" disabled={loading}>
                {loading ? <LoaderCircle className="spin" size={19} /> : <>Build my run <ArrowRight size={19} /></>}
              </button>
            </div>
            {loading && <div className="load-line"><span style={{ width: `${loadProgress}%` }} /></div>}
            {error && <p className="form-error"><X size={15} /> {error}</p>}
            <p className="privacy-note"><Check size={14} /> No sign-in. Your deck stays yours. It must be set to “Anyone with the link.”</p>
          </form>

          <div className="trust-row">
            <div className="avatar-stack"><span>👩🏽‍💻</span><span>🧑🏻‍🎨</span><span>👨🏿‍🚀</span></div>
            <p><strong>Built for people with something to say</strong><span>Teachers · Founders · Storytellers · You</span></p>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="slide-card-back"><div /><div /><div /></div>
          <div className="slide-card-main">
            <div className="mock-slide">
              <span className="mock-kicker">THE BIG IDEA</span>
              <strong>Make it<br /><em>memorable.</em></strong>
              <div className="mock-shape"><Sparkles size={24} /></div>
            </div>
            <div className="mock-controls">
              <span><Pause size={14} fill="currentColor" /></span>
              <div><i /><i /><i /></div>
              <b>00:28</b>
            </div>
          </div>
          <div className="timing-chip"><Clock3 size={18} /><span><b>Smart timing</b><small>Based on your content</small></span><Check size={16} /></div>
          <div className="handsfree-chip"><WandSparkles size={18} /><span><b>Hands-free</b><small>Zero awkward clicks</small></span></div>
        </div>
      </section>

      <section className="how-strip" id="how-it-works">
        <article><span>01</span><div><Link2 size={21} /><h3>Paste the link</h3><p>Any Google Slides deck shared publicly.</p></div></article>
        <article><span>02</span><div><TimerReset size={21} /><h3>Tune the timing</h3><p>Use our smart estimate or set every beat.</p></div></article>
        <article><span>03</span><div><Play size={21} /><h3>Take the stage</h3><p>Share one run link. Slides move themselves.</p></div></article>
      </section>

      <footer className="landing-footer">
        <span>Free, open source, and made for better stories.</span>
        <a href="https://github.com/1aifanatic/next-slide-please" target="_blank" rel="noreferrer">View on GitHub <ExternalLink size={14} /></a>
      </footer>
    </main>
  );
}

function Presenter({
  deck,
  slides,
  current,
  remainingMs,
  paused,
  onPause,
  onNext,
  onPrevious,
  onExit,
}: {
  deck: PDFDocumentProxy;
  slides: Slide[];
  current: number;
  remainingMs: number;
  paused: boolean;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onExit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const slide = slides[current];
  const percent = slide ? clamp(1 - remainingMs / (slide.seconds * 1000), 0, 1) * 100 : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !slide) return;
    let cancelled = false;
    setRendering(true);

    const render = async () => {
      const page = await deck.getPage(slide.pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const cssWidth = Math.min(window.innerWidth * 0.9, 1600);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (cssWidth * pixelRatio) / base.width });
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${Math.round(viewport.width / pixelRatio)}px`;
      canvas.style.height = `${Math.round(viewport.height / pixelRatio)}px`;
      await page.render({ canvasContext: context, viewport }).promise;
      if (!cancelled) setRendering(false);
    };

    void render();
    return () => { cancelled = true; };
  }, [deck, slide]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  };

  return (
    <main className="presenter-page">
      <div className="presenter-topbar">
        <Logo light />
        <span>SLIDE {current + 1} <i>/</i> {slides.length}</span>
        <button onClick={onExit}><X size={18} /> Exit</button>
      </div>
      <div className="stage">
        {rendering && <LoaderCircle className="spin stage-loader" size={34} />}
        <canvas ref={canvasRef} className={rendering ? "rendering" : ""} />
        {paused && <div className="paused-label"><Pause size={17} fill="currentColor" /> Paused</div>}
      </div>
      <div className="presenter-dock">
        <button onClick={onPrevious} disabled={current === 0} aria-label="Previous slide"><ArrowLeft size={20} /></button>
        <button className="pause-button" onClick={onPause} aria-label={paused ? "Resume" : "Pause"}>
          {paused ? <Play size={22} fill="currentColor" /> : <Pause size={22} fill="currentColor" />}
        </button>
        <button onClick={onNext} aria-label="Next slide"><ArrowRight size={20} /></button>
        <div className="presenter-progress">
          <div><span style={{ width: `${percent}%` }} /></div>
          <p><strong>{formatTime(Math.ceil(remainingMs / 1000))}</strong><small>until next slide</small></p>
        </div>
        <button onClick={() => void toggleFullscreen()} aria-label="Toggle full screen"><Maximize size={19} /></button>
      </div>
      <p className="keyboard-hint"><span>Space</span> pause · <span>←</span><span>→</span> navigate · <span>Esc</span> exit</p>
    </main>
  );
}

export default App;
