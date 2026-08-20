"use client";

/* share + print row. Client-only for window.print(); the share links themselves
   are plain hrefs, so they still work if hydration never lands. */
export default function ShareRow({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, label: "Share on Facebook", d: "M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6c-.3-.04-1.3-.13-2.47-.13-2.44 0-4.12 1.5-4.12 4.24V9.9H7.3V13h2.81v8h3.39Z" },
    { href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, label: "Share on X", d: "M17.53 3h3.2l-7 8 8.23 10.9h-6.44l-5.04-6.6-5.77 6.6H1.5l7.49-8.56L1.1 3h6.6l4.56 6.03L17.53 3Zm-1.12 16.9h1.77L7.67 4.8H5.77l10.64 15.1Z" },
    { href: `https://api.whatsapp.com/send?text=${t}%20${u}`, label: "Share on WhatsApp", d: "M12.04 2.2c-5.44 0-9.85 4.4-9.85 9.84 0 1.74.46 3.44 1.33 4.94L2.1 22l5.16-1.35a9.83 9.83 0 0 0 4.78 1.22h.01c5.43 0 9.84-4.41 9.84-9.84 0-5.43-4.41-9.83-9.85-9.83Zm0 18.02h-.01a8.2 8.2 0 0 1-4.16-1.14l-.3-.18-3.09.81.82-3.01-.19-.31a8.16 8.16 0 0 1 12.52-10.1 8.16 8.16 0 0 1-5.6 13.93Zm4.5-6.11c-.25-.13-1.46-.72-1.68-.8-.23-.09-.39-.13-.56.12-.16.25-.64.81-.79.97-.14.17-.29.19-.53.06-.25-.12-1.04-.38-1.98-1.22a7.4 7.4 0 0 1-1.37-1.7c-.14-.25-.01-.38.11-.5.11-.12.25-.3.37-.44.13-.15.17-.25.25-.41.09-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.84-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.07-.65.31-.22.25-.85.83-.85 2.03s.87 2.36.99 2.52c.12.17 1.71 2.62 4.15 3.67.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.46-.6 1.66-1.18.2-.57.2-1.06.15-1.17-.06-.1-.22-.16-.47-.28Z" },
    { href: `mailto:?subject=${t}&body=${u}`, label: "Share by email", d: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm.7 2 7.3 5.2L19.3 7H4.7ZM20 8.7l-7.4 5.3a1 1 0 0 1-1.2 0L4 8.7V17h16V8.7Z" },
  ];
  const btn = "flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-purple-800 hover:text-white";

  // phones: one native share sheet — the OS picker chooses the app. Fallback: copy link.
  const nativeShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* user dismissed the sheet */
    }
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      <button type="button" onClick={nativeShare} aria-label="Share" title="Share" className={`${btn} sm:hidden`}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-[18px] w-[18px]">
          <path d="M12 2.6 16.2 6.8l-1.4 1.4-1.8-1.8V15h-2V6.4L9.2 8.2 7.8 6.8 12 2.6ZM5 10h4v2H7v8h10v-8h-2v-2h4v12H5V10Z" />
        </svg>
      </button>
      {links.map((s) => (
        <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label} className={`${btn} hidden sm:flex`}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-[18px] w-[18px]"><path d={s.d} /></svg>
        </a>
      ))}
      <button type="button" onClick={() => window.print()} aria-label="Print" title="Print" className={btn}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-[18px] w-[18px]">
          <path d="M7 3h10v4H7V3Zm11.5 5h-13A2.5 2.5 0 0 0 3 10.5V16h4v5h10v-5h4v-5.5A2.5 2.5 0 0 0 18.5 8ZM15 19H9v-5h6v5Zm3.2-7.3a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
        </svg>
      </button>
    </div>
  );
}
