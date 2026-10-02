/*
 * Recognises the video links the site's featured-video plugin accepts (YouTube,
 * Vimeo, Dailymotion) and the player address for each. The patterns follow the
 * plugin's own, so a link accepted here is one WordPress will accept too.
 * No imports: used by the editor in the browser and by the API routes.
 */
export type Embed = { provider: "youtube" | "vimeo" | "dailymotion"; id: string; /** The player to put in an iframe. */ src: string; /** The link as the editor typed it, with a scheme. */ url: string };

const YOUTUBE_HOSTS = ["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com", "youtube-nocookie.com"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];
const DAILYMOTION_HOSTS = ["dailymotion.com", "www.dailymotion.com", "dai.ly"];

const YOUTUBE_ID = /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|vi|e(?:mbed)?|shorts)\/|\S*?[?&]v=|\S*?[?&]vi=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const VIMEO_ID = /\/\/(?:www\.|player\.)?vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:[a-zA-Z0-9_-]+)?/i;
const DAILYMOTION_ID = /^(?:(?:https?):)?(?:\/\/)?(?:www\.)?(?:(?:dailymotion\.com(?:\/embed|\/hub)?\/video)|dai\.ly)\/([a-zA-Z0-9]+)(?:_[\w_-]+)?$/;

export function parseEmbed(input: string): Embed | null {
  const typed = input.trim();
  if (!typed || /\s/.test(typed)) return null;
  const url = /^https?:\/\//i.test(typed) ? typed : `https://${typed}`;
  let host: string;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  if (YOUTUBE_HOSTS.includes(host)) { const id = url.match(YOUTUBE_ID)?.[1]; return id ? { provider: "youtube", id, src: `https://www.youtube-nocookie.com/embed/${id}`, url } : null; }
  if (VIMEO_HOSTS.includes(host)) { const id = url.match(VIMEO_ID)?.[1]; return id ? { provider: "vimeo", id, src: `https://player.vimeo.com/video/${id}`, url } : null; }
  if (DAILYMOTION_HOSTS.includes(host)) { const id = url.match(DAILYMOTION_ID)?.[1]; return id ? { provider: "dailymotion", id, src: `https://www.dailymotion.com/embed/video/${id}`, url } : null; }
  return null;
}
