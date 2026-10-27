/* IndexNow integration for notifying Microsoft/Bing of URL changes.
   Called asynchronously by admin routes after publishing, never throws. */

const INDEXNOW_API = "https://api.indexnow.org/indexnow";

/**
 * Notify IndexNow of published URLs.
 * Called fire-and-forget after write operations; failures do not propagate.
 */
export async function pingIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://islamonlive.in";

  if (!key || !urls.length) {
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(INDEXNOW_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: new URL(siteUrl).host,
        key,
        // at the root: a key file in a folder only vouches for URLs under that folder
        keyLocation: `${siteUrl}/indexnow-key.txt`,
        urlList: urls,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      // Log but don't throw; IndexNow is best-effort
      console.warn(`IndexNow ping failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    // Swallow timeout and network errors; IndexNow is optional
    if (error instanceof Error) {
      console.warn(`IndexNow ping error: ${error.message}`);
    }
  }
}
