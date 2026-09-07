"use client";

import { useEffect } from "react";

/* Last resort: app/error.tsx sits inside the root layout, so it cannot catch a
   throw from the layout itself (the nav previews, the fonts). This replaces the
   whole document, which is why it ships its own <html>/<body> and inline styles
   — globals.css is part of the tree that just failed. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ml">
      <body style={{ margin: 0, background: "#fafafa", fontFamily: "system-ui, sans-serif", color: "#18181b" }}>
        <div style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ maxWidth: "26rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>The site is having trouble right now</h1>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.9rem", lineHeight: 1.6, color: "#71717a" }}>
              Something went wrong while building this page. It isn&apos;t anything you did. Please try once more in a moment — we&apos;re
              already looking at it.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "1.5rem",
                minHeight: "2.75rem",
                padding: "0 1.5rem",
                borderRadius: "999px",
                border: "none",
                background: "#693FE2",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {error.digest && <p style={{ marginTop: "1.5rem", fontSize: "0.7rem", color: "#a1a1aa" }}>Reference {error.digest}</p>}
          </div>
        </div>
      </body>
    </html>
  );
}
