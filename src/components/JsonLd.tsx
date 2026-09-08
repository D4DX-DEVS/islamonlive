/* Structured data goes in the server-rendered HTML, never injected later —
   Google reads the initial response and a client-side <script> can be missed.

   The "<" escape is not decorative: article titles and Yoast descriptions carry
   editor-entered HTML, and a literal "</script>" inside the JSON would close
   this tag early and turn the rest of the payload into executable markup.
   < is valid inside a JSON string and parses back to "<". */
export default function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
