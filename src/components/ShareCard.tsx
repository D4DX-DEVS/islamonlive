"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const W = 1080;
const H = 1350;
const PAD = 88;

interface ShareCardProps {
  title: string;
  author?: string;
  date?: string;
  category?: string;
  url: string;
  className?: string;
}

/** wrap `text` to `max` px, honouring the width the canvas will actually paint */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= max || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* The reader shares a picture of the article rather than a bare link — the same
   "Share as card" the old native app had.

   The card is drawn straight onto a canvas rather than built as HTML and
   rasterised: there is no html-to-image dependency in this project, and drawing
   it once means the preview on screen and the file that gets shared are the same
   pixels. The Malayalam face is whatever the page is already using — read off
   the live DOM so it matches the site instead of falling back to a system font. */
export default function ShareCard({ title, author, date, category, url, className = "" }: ShareCardProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // next/font family names are hashed at build time; take them from the page
    const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
    // canvas silently falls back to a default face for glyphs whose font has not
    // finished loading — Malayalam would render as boxes on a cold visit
    try {
      await document.fonts.load(`700 64px ${family}`, title.slice(0, 40));
      await document.fonts.ready;
    } catch {
      /* no font loading API — draw with whatever is resolved */
    }

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#5B2BC9");
    g.addColorStop(0.55, "#3F3AA8");
    g.addColorStop(1, "#1F7A6E");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // a soft highlight so the flat gradient reads as a designed card
    const glow = ctx.createRadialGradient(W * 0.15, H * 0.1, 0, W * 0.15, H * 0.1, W * 0.9);
    glow.addColorStop(0, "rgba(255,255,255,0.16)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.textBaseline = "top";
    let y = PAD;

    ctx.font = `600 38px ${family}`;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText("islamonlive", PAD, y);
    y += 74;

    if (category) {
      const label = category.toUpperCase();
      ctx.font = `700 28px system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.roundRect(PAD, y, tw + 44, 56, 28);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, PAD + 22, y + 14);
      y += 96;
    }

    // the headline gets whatever vertical room is left above the footer, and the
    // type shrinks a step at a time until it fits rather than being clipped
    const maxW = W - PAD * 2;
    const footerTop = H - PAD - 120;
    let size = 68;
    let lines: string[] = [];
    for (; size >= 40; size -= 4) {
      ctx.font = `700 ${size}px ${family}`;
      lines = wrap(ctx, title, maxW);
      if (y + lines.length * size * 1.35 < footerTop - 90) break;
    }
    ctx.fillStyle = "#ffffff";
    for (const line of lines) {
      ctx.fillText(line, PAD, y);
      y += size * 1.35;
    }

    if (author) {
      y += 26;
      ctx.font = `500 36px ${family}`;
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.fillText(`— ${author}`, PAD, y);
      y += 54;
    }
    if (date) {
      ctx.font = `400 30px ${family}`;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(date, PAD, y);
    }

    ctx.font = `500 32px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.fillText("islamonlive.in", PAD, H - PAD - 40);
  }, [title, author, date, category]);

  useEffect(() => {
    if (open) void draw();
  }, [open, draw]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas || busy) return;
    setBusy(true);
    try {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) return;
      const file = new File([blob], "islamonlive.png", { type: "image/png" });
      // canShare({files}) is the only reliable check — Chrome on desktop has
      // navigator.share but refuses files, and share() then rejects
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: url });
      } else {
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = "islamonlive.png";
        a.click();
        URL.revokeObjectURL(href);
      }
    } catch {
      /* dismissed */
    } finally {
      setBusy(false);
    }
  };

  const btn = "flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-purple-800 hover:text-white";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Share as card" title="Share as card" className={`${btn} ${className}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[18px] w-[18px]">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="m4.5 16 4-4.5 3.5 3.5 2.5-2.5 5 5" />
          <circle cx="9" cy="9" r="1.4" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
            <div
              className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-zinc-900 p-4 pb-6 sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/25 sm:hidden" />
              <canvas ref={canvasRef} width={W} height={H} className="mx-auto block w-full max-w-[320px] rounded-2xl" />
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-11 rounded-full px-5 text-sm font-semibold text-white/70 transition hover:text-white"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={share}
                  disabled={busy}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#693FE2] px-6 text-sm font-semibold text-white transition hover:bg-[#5a34c7] disabled:opacity-60"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
                    <path d="M12 2.6 16.2 6.8l-1.4 1.4-1.8-1.8V15h-2V6.4L9.2 8.2 7.8 6.8 12 2.6ZM5 10h4v2H7v8h10v-8h-2v-2h4v12H5V10Z" />
                  </svg>
                  {busy ? "Preparing…" : "Share card"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
