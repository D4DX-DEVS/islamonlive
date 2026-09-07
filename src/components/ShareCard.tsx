"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const W = 1080;
const H = 1350;
const PAD = 72;

interface ShareCardProps {
  title: string;
  author?: string;
  /** featured image — drawn across the top of the card when present */
  img?: string | null;
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

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

/** cover-fit `im` into the box, like CSS object-fit: cover; object-position top */
function drawCover(ctx: CanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / im.width, h / im.height);
  const sw = w / s;
  const sh = h / s;
  const sx = (im.width - sw) / 2;
  const sy = Math.min((im.height - sh) / 2, im.height * 0.08);
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}

/* The reader shares a picture of the article rather than a bare link — the same
   "Share as card" the old native app had.

   Layout, top to bottom, everything centred like a phone story card:
     featured image (when the post has one) → headline → author →
     the site logo with the URL under it, pinned to the bottom.
   No category chip and no date: the card is a poster, not a listing row.

   Drawn straight onto a canvas: no html-to-image dependency, and the preview on
   screen and the shared file are the same pixels. The featured image comes
   through /_next/image — same origin — so drawing it doesn't taint the canvas
   (WordPress sends no CORS header, so the raw URL would). */
export default function ShareCard({ title, author, img, url, className = "" }: ShareCardProps) {
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
    const [photo, logo] = await Promise.all([
      // w and q must be values the optimizer allows (Next 16 only serves q=75 by default)
      img ? loadImage(`/_next/image?url=${encodeURIComponent(img)}&w=1080&q=75`) : Promise.resolve(null),
      loadImage("/logo-white.png"),
      // canvas silently falls back to a default face for glyphs whose font has not
      // finished loading — Malayalam would render as boxes on a cold visit
      (async () => {
        try {
          await document.fonts.load(`700 64px ${family}`, title.slice(0, 40));
          await document.fonts.ready;
        } catch {
          /* no font loading API — draw with whatever is resolved */
        }
      })(),
    ]);

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#4A1E9E");
    g.addColorStop(0.55, "#31094C");
    g.addColorStop(1, "#1B0530");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // a soft highlight so the flat gradient reads as a designed card
    const glow = ctx.createRadialGradient(W * 0.5, H * 0.05, 0, W * 0.5, H * 0.05, W * 0.9);
    glow.addColorStop(0, "rgba(255,255,255,0.14)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    const cx = W / 2;
    const maxW = W - PAD * 2;

    // footer: logo + url, pinned to the bottom
    const footerH = 150;
    const footerTop = H - PAD - footerH;
    if (logo) {
      const lh = 64;
      const lw = (logo.width / logo.height) * lh;
      ctx.drawImage(logo, cx - lw / 2, footerTop + 20, lw, lh);
    } else {
      ctx.font = `700 44px ${family}`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText("islamonlive", cx, footerTop + 26);
    }
    ctx.font = `500 30px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("www.islamonlive.in", cx, footerTop + 106);
    // hairline above the footer
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(PAD, footerTop - 26, maxW, 2);

    // photo block across the top, rounded, cover-cropped
    let y = PAD;
    if (photo) {
      const ph = 640;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(PAD, y, maxW, ph, 32);
      ctx.clip();
      drawCover(ctx, photo, PAD, y, maxW, ph);
      ctx.restore();
      y += ph + 48;
    }

    // headline fills the middle: with a photo it starts right under it; without
    // one the text block is centred in the space above the footer, with the
    // author sitting tight beneath it
    const authorH = author ? 84 : 0;
    const blockBottom = footerTop - 40;
    let size = photo ? 60 : 68;
    let lines: string[] = [];
    let lineH = 0;
    for (; size >= 36; size -= 4) {
      ctx.font = `700 ${size}px ${family}`;
      lines = wrap(ctx, title, maxW);
      lineH = size * 1.38;
      if (y + lines.length * lineH + authorH <= blockBottom) break;
    }
    const textH = lines.length * lineH + authorH;
    if (!photo) y = Math.max(PAD, (y + blockBottom) / 2 - textH / 2);

    ctx.fillStyle = "#ffffff";
    for (const line of lines) {
      ctx.fillText(line, cx, y, maxW);
      y += lineH;
    }
    if (author) {
      y += 18;
      ctx.font = `500 34px ${family}`;
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.fillText(author, cx, y, maxW);
    }
  }, [title, author, img]);

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
