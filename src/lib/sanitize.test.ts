import { describe, expect, it } from "vitest";
import { safeTitle, sanitizeHtml } from "./sanitize";
import { renderContent } from "./content";

describe("sanitizeHtml", () => {
  // every one of these walked past the old regex strip()
  const payloads = [
    "<svg/onload=alert(1)>",
    "<img src=x/onerror=alert(1)>",
    '<img src="x" onerror="alert(1)">',
    '<a href="&#106;avascript:alert(1)">x</a>',
    '<a href=" javascript:alert(1)">x</a>',
    '<a href="java&#9;script:alert(1)">x</a>',
    "<a href=javascript:alert(1)>x</a>",
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<object data="javascript:alert(1)"></object>',
    '<embed src="javascript:alert(1)">',
    '<form action="javascript:alert(1)"><button>go</button></form>',
    '<base href="https://evil.example/">',
    "<scr<script>ipt>alert(1)</script>",
    '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)></style></mglyph></table></mtext></math>',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  ];

  it.each(payloads)("neutralises %s", (payload) => {
    const out = sanitizeHtml(payload).toLowerCase();
    expect(out).not.toMatch(/<script|<svg|<object|<embed|<form|<base|<meta|<math|srcdoc|javascript:|data:text|\son[a-z]+=/);
  });

  it("keeps the markup articles use", () => {
    const html =
      '<h2 id="a">Heading</h2><p style="text-align: center" class="x">ടെക്സ്റ്റ് <strong>bold</strong> <em>em</em></p>' +
      '<figure class="wp-block-image"><img src="/wp-content/uploads/a.jpg" srcset="/wp-content/uploads/a-300.jpg 300w" alt="alt" width="300" height="200"><figcaption>cap</figcaption></figure>' +
      '<table><tbody><tr><td colspan="2">cell</td></tr></tbody></table>' +
      '<iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk" allowfullscreen loading="lazy"></iframe>' +
      '<blockquote cite="https://example.com">q</blockquote><ul><li>one</li></ul><a href="mailto:a@b.c">mail</a>';
    const out = sanitizeHtml(html);
    for (const kept of ['id="a"', 'style="text-align:center"', "<strong>", "<figure", 'srcset="/wp-content/uploads/a-300.jpg 300w"', 'colspan="2"', "youtube-nocookie.com/embed/abcdefghijk", "allowfullscreen", 'href="mailto:a@b.c"', "ടെക്സ്റ്റ്"]) {
      expect(out).toContain(kept);
    }
  });

  it("adds noopener to links that open a new tab", () => {
    expect(sanitizeHtml('<a href="https://x.example" target="_blank">x</a>')).toContain('rel="noopener noreferrer"');
  });

  it("never frames this site itself, so an article cannot overlay the admin", () => {
    for (const src of ["/admin/team/", "//islamonlive.in/admin/", "https://islamonlive.in/admin/"]) {
      expect(sanitizeHtml(`<p>a</p><iframe src="${src}"></iframe>`)).toBe("<p>a</p>");
    }
    expect(sanitizeHtml('<iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk"></iframe>')).toContain("<iframe");
  });

  it("keeps anchors but not ids that would shadow the app's globals", () => {
    expect(sanitizeHtml('<h2 id="part-2">x</h2>')).toContain('id="part-2"');
    expect(sanitizeHtml('<p id="OneSignalDeferred">x</p><a name="__iolInstallEvent">y</a>')).toBe("<p>x</p><a>y</a>");
  });

  it("guards every link that opens another window, and keeps share links", () => {
    expect(sanitizeHtml('<a href="https://x.example" target="_new">x</a>')).toContain('rel="noopener noreferrer"');
    expect(sanitizeHtml('<a href="whatsapp://send?text=hi">w</a>')).toContain('href="whatsapp://send?text=hi"');
  });

  it("drops script and noscript contents instead of showing them as text", () => {
    expect(sanitizeHtml("<p>a</p><script>var x=1</script><noscript>no js</noscript>")).toBe("<p>a</p>");
  });

  it("is idempotent", () => {
    const once = sanitizeHtml('<p class="a">x &amp; y <img src="/a.jpg" alt="a"></p>');
    expect(sanitizeHtml(once)).toBe(once);
  });

  it("guards the public article renderer", () => {
    const out = renderContent('<p>ok</p><img src="/a.jpg" onerror="alert(1)">');
    expect(out).not.toMatch(/\sonerror=/i);
    expect(out).toContain('<img src="/a.jpg" loading="lazy" decoding="async">');
  });
});

describe("safeTitle", () => {
  it("keeps entities, drops tags", () => {
    expect(safeTitle("&#8216;Quoted&#8217; &amp; <em>more</em>")).toBe("&#8216;Quoted&#8217; &amp; more");
  });

  it("keeps a bare < or > as text", () => {
    expect(safeTitle("5 < 6 and 7 > 3")).toBe("5 &lt; 6 and 7 &gt; 3");
  });

  it("cannot be turned into a tag", () => {
    expect(safeTitle("<img src=x onerror=alert(1)>Title")).toBe("Title");
    expect(safeTitle("Title <img src=x onerror=alert(1)")).not.toContain("<");
    expect(safeTitle(null)).toBe("");
  });
});
