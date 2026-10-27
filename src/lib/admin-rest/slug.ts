/* WordPress's slug rules, so a post created here gets the URL WordPress would
   have given it.

   A port of sanitize_title( $title ) in its "save" context — remove_accents()
   then sanitize_title_with_dashes() — and of utf8_uri_encode(), WordPress 6.x.
   For Malayalam that means: every non-ASCII character becomes its UTF-8 bytes
   as lowercase %xx, the whole slug is capped at 200 encoded octets without
   splitting a character, and zero-width characters (ZWJ/ZWNJ) are dropped.
   (Older slugs in the archive still carry %e2%80%8d: they predate WordPress
   stripping it. Those stored slugs are never regenerated, only new ones.) */

const MAX_OCTETS = 200;

/* remove_accents(), Latin only. Applied per character below U+0250 so that
   Malayalam is never touched: NFD would split its two-part vowel signs (ൊ into
   െ + ാ) and change the bytes of the slug. */
const SPECIAL_LATIN: Record<string, string> = { ß: "ss", æ: "ae", Æ: "AE", ø: "o", Ø: "O", đ: "d", Đ: "D", ł: "l", Ł: "L", þ: "th", Þ: "TH", œ: "oe", Œ: "OE", ð: "d", Ð: "D", ŉ: "n" };

function removeAccents(text: string): string {
  return text.replace(/[À-ɏ]/g, (ch) => SPECIAL_LATIN[ch] ?? ch.normalize("NFD").replace(/[̀-ͯ]/g, ""));
}

/** utf8_uri_encode( $string, 200 ): ASCII kept, other bytes as lowercase %xx, capped at whole characters. */
function utf8UriEncode(text: string, length: number): string {
  let out = "";
  let used = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < 128) {
      if (used + 1 > length) break;
      out += ch;
      used += 1;
      continue;
    }
    const bytes = Buffer.from(ch, "utf8");
    if (used + bytes.length * 3 > length) break;
    for (const b of bytes) out += `%${b.toString(16)}`;
    used += bytes.length * 3;
  }
  return out;
}

// &nbsp; &ndash; &mdash; (encoded) become hyphens
const TO_HYPHEN = ["%c2%a0", "%e2%80%93", "%e2%80%94", "%e2%80%80", "%e2%80%81", "%e2%80%82", "%e2%80%83", "%e2%80%84", "%e2%80%85", "%e2%80%86", "%e2%80%87", "%e2%80%88", "%e2%80%89", "%e2%80%8a", "%e2%80%a8", "%e2%80%a9", "%e2%80%af"];
const ENTITY_HYPHEN = ["&nbsp;", "&#160;", "&ndash;", "&#8211;", "&mdash;", "&#8212;"];
// soft hyphen, ¡ ¿, angle and curly quotes, bullet, © ® ° … ™, accents, zero-width and bidi marks, BOM, U+FFFC
const STRIP = [
  "%c2%ad", "%c2%a1", "%c2%bf", "%c2%ab", "%c2%bb", "%e2%80%b9", "%e2%80%ba",
  "%e2%80%98", "%e2%80%99", "%e2%80%9c", "%e2%80%9d", "%e2%80%9a", "%e2%80%9b", "%e2%80%9e", "%e2%80%9f",
  "%e2%80%a2", "%c2%a9", "%c2%ae", "%c2%b0", "%e2%80%a6", "%e2%84%a2",
  "%c2%b4", "%cb%8a", "%cc%81", "%cd%81", "%cc%80", "%cc%84", "%cc%8c",
  "%e2%80%8b", "%e2%80%8c", "%e2%80%8d", "%e2%80%8e", "%e2%80%8f",
  "%e2%80%aa", "%e2%80%ab", "%e2%80%ac", "%e2%80%ad", "%e2%80%ae", "%ef%bb%bf", "%ef%bf%bc",
];

const replaceAll = (text: string, needles: string[], by: string): string => needles.reduce((acc, n) => acc.split(n).join(by), text);

/** sanitize_title( $title ) as WordPress saves it: the slug for a post or term name. */
export function sanitizeTitle(title: string): string {
  let t = removeAccents(String(title)).replace(/<[^>]*>/g, "");
  // keep escaped octets, drop stray percent signs
  t = t.replace(/%([a-fA-F0-9]{2})/g, "---$1---").replace(/%/g, "").replace(/---([a-fA-F0-9]{2})---/g, "%$1");
  t = utf8UriEncode(t.toLowerCase(), MAX_OCTETS).toLowerCase();
  t = replaceAll(t, TO_HYPHEN, "-");
  t = replaceAll(t, ENTITY_HYPHEN, "-");
  t = t.split("/").join("-");
  t = replaceAll(t, STRIP, "");
  t = t.split("%c3%97").join("x");
  t = t.replace(/&.+?;/g, "").split(".").join("-");
  t = t.replace(/[^%a-z0-9 _-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  return t.replace(/^-+|-+$/g, "");
}

/* wp_unique_post_slug(): a taken slug gets "-2", then "-3"…, with the base cut
   short so the result still fits in 200 octets (never inside a %xx escape). */
function truncateSlug(slug: string, length: number): string {
  if (slug.length <= length) return slug;
  const cut = slug.slice(0, length);
  // don't leave a partial %xx, and don't split a multi-byte character's escapes
  const decodable = cut.replace(/%[0-9a-f]?$/i, "");
  for (let end = decodable.length; end > 0; end--) {
    const candidate = decodable.slice(0, end);
    try {
      decodeURIComponent(candidate);
      return candidate.replace(/-+$/, "");
    } catch {
      /* a character's escapes were split — back off */
    }
  }
  return "";
}

/** The first free variant of `slug`: itself, else slug-2, slug-3, … (WordPress's order). */
export async function uniqueSlug(slug: string, isTaken: (candidate: string) => Promise<boolean>): Promise<string> {
  if (!(await isTaken(slug))) return slug;
  for (let suffix = 2; suffix < 10_000; suffix++) {
    const candidate = `${truncateSlug(slug, MAX_OCTETS - (String(suffix).length + 1))}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error("Could not find a free slug");
}
