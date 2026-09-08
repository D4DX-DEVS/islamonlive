/* The XSL Yoast shipped with its sitemaps, reimplemented.

   Purely cosmetic: it is what turns /sitemap_index.xml into a readable table in
   a browser instead of the "This XML file does not appear to have any style
   information" warning. Crawlers ignore it. It lives here because the sitemaps
   reference /main-sitemap.xsl, the path Yoast used — an editor who has that
   bookmarked should not meet a 404. */

export const revalidate = 86400;

const XSL = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <title>XML Sitemap</title>
        <meta name="robots" content="noindex,follow"/>
        <style>
          body { font: 14px/1.5 system-ui, sans-serif; color: #18181b; margin: 2rem auto; max-width: 1100px; padding: 0 1rem; }
          h1 { font-size: 1.5rem; }
          p { color: #52525b; }
          table { border-collapse: collapse; width: 100%; margin-top: 1.5rem; }
          th, td { text-align: left; padding: .5rem .75rem; border-bottom: 1px solid #e4e4e7; }
          th { background: #31094C; color: #fff; }
          tr:hover td { background: #faf5ff; }
          a { color: #6b21a8; }
        </style>
      </head>
      <body>
        <h1>XML Sitemap</h1>
        <xsl:if test="count(s:sitemapindex/s:sitemap) &gt; 0">
          <p>This index contains <xsl:value-of select="count(s:sitemapindex/s:sitemap)"/> sitemaps.</p>
          <table>
            <tr><th>Sitemap</th><th>Last modified</th></tr>
            <xsl:for-each select="s:sitemapindex/s:sitemap">
              <tr>
                <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                <td><xsl:value-of select="s:lastmod"/></td>
              </tr>
            </xsl:for-each>
          </table>
        </xsl:if>
        <xsl:if test="count(s:urlset/s:url) &gt; 0">
          <p>This sitemap contains <xsl:value-of select="count(s:urlset/s:url)"/> URLs.</p>
          <table>
            <tr><th>URL</th><th>Last modified</th></tr>
            <xsl:for-each select="s:urlset/s:url">
              <tr>
                <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                <td><xsl:value-of select="s:lastmod"/></td>
              </tr>
            </xsl:for-each>
          </table>
        </xsl:if>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;

export function GET(): Response {
  return new Response(XSL, {
    headers: {
      "Content-Type": "application/xslt+xml; charset=UTF-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
