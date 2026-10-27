import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pingIndexNow } from "@/lib/indexnow";

describe("pingIndexNow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST request to IndexNow API when key is set", async () => {
    process.env.INDEXNOW_KEY = "test-key";
    process.env.NEXT_PUBLIC_SITE_URL = "https://islamonlive.in";

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ ok: true });

    await pingIndexNow(["https://islamonlive.in/article/"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.indexnow.org/indexnow",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("does nothing when key is not set", async () => {
    process.env.INDEXNOW_KEY = "";

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    await pingIndexNow(["https://islamonlive.in/article/"]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when URLs list is empty", async () => {
    process.env.INDEXNOW_KEY = "test-key";

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    await pingIndexNow([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows network errors silently", async () => {
    process.env.INDEXNOW_KEY = "test-key";
    process.env.NEXT_PUBLIC_SITE_URL = "https://islamonlive.in";

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    await expect(pingIndexNow(["https://islamonlive.in/article/"])).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalled();
  });
});
