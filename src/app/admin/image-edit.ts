/* The image editor's arithmetic, kept apart from the canvas so it can be tested.

   Coordinates: the picture is first rotated and flipped, and the crop box lives
   in that turned picture's bounding box ("bounds"), in source pixels. */

export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };
/** Which edge or corner of the crop box is being dragged; "move" drags the whole box. */
export type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export type Adjustments = { brightness: number; contrast: number; saturation: number; grayscale: number };
export type OutputType = "image/webp" | "image/jpeg" | "image/png";

export const NO_ADJUSTMENTS: Adjustments = { brightness: 100, contrast: 100, saturation: 100, grayscale: 0 };
/** Neither side of the saved picture goes past this; larger is never useful on the site. */
export const MAX_EDGE = 4000;
export const MIN_CROP = 16;

export const ASPECTS: { label: string; value: number | "original" | null }[] = [
  { label: "Free", value: null },
  { label: "Original", value: "original" },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "9:16", value: 9 / 16 },
];

/** The box a w×h picture needs once turned by `degrees`. */
export function rotatedBounds(width: number, height: number, degrees: number): Size {
  const r = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(r)), sin = Math.abs(Math.sin(r));
  // round away float noise so 90° gives exactly h×w
  const tidy = (n: number) => Math.max(1, Math.round(n * 1e6) / 1e6);
  return { width: tidy(width * cos + height * sin), height: tidy(width * sin + height * cos) };
}

/** The largest box of the given aspect that fits the bounds, centred. */
export function fitAspect(bounds: Size, aspect: number | null): Rect {
  if (!aspect) return { x: 0, y: 0, width: bounds.width, height: bounds.height };
  let width = bounds.width, height = width / aspect;
  if (height > bounds.height) { height = bounds.height; width = height * aspect; }
  return { x: (bounds.width - width) / 2, y: (bounds.height - height) / 2, width, height };
}

/** Keeps a box inside the bounds and at least `min` on each side, moving it before shrinking it. */
export function clampRect(rect: Rect, bounds: Size, min = MIN_CROP): Rect {
  const width = Math.min(bounds.width, Math.max(Math.min(min, bounds.width), rect.width));
  const height = Math.min(bounds.height, Math.max(Math.min(min, bounds.height), rect.height));
  const x = Math.min(bounds.width - width, Math.max(0, rect.x));
  const y = Math.min(bounds.height - height, Math.max(0, rect.y));
  return { x, y, width, height };
}

/** The crop box after dragging `handle` by dx, dy (source pixels), holding `aspect` when set. */
export function dragRect(start: Rect, handle: Handle, dx: number, dy: number, bounds: Size, aspect: number | null, min = MIN_CROP): Rect {
  if (handle === "move") return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, bounds, min);
  let left = start.x, top = start.y, right = start.x + start.width, bottom = start.y + start.height;
  if (handle.includes("w")) left = Math.min(right - min, Math.max(0, left + dx));
  if (handle.includes("e")) right = Math.max(left + min, Math.min(bounds.width, right + dx));
  if (handle.includes("n")) top = Math.min(bottom - min, Math.max(0, top + dy));
  if (handle.includes("s")) bottom = Math.max(top + min, Math.min(bounds.height, bottom + dy));
  if (!aspect) return { x: left, y: top, width: right - left, height: bottom - top };

  // Holding a shape: the dragged side leads, the other follows, anchored at the opposite edge/corner.
  const horizontal = handle.includes("e") || handle.includes("w");
  const vertical = handle.includes("n") || handle.includes("s");
  let width = right - left, height = bottom - top;
  if (horizontal && !vertical) height = width / aspect;
  else if (vertical && !horizontal) width = height * aspect;
  else if (width / height > aspect) height = width / aspect; else width = height * aspect;
  // room available from the anchor
  const anchorX = handle.includes("w") ? start.x + start.width : handle.includes("e") ? start.x : start.x + start.width / 2;
  const anchorY = handle.includes("n") ? start.y + start.height : handle.includes("s") ? start.y : start.y + start.height / 2;
  const roomX = handle.includes("w") ? anchorX : handle.includes("e") ? bounds.width - anchorX : 2 * Math.min(anchorX, bounds.width - anchorX);
  const roomY = handle.includes("n") ? anchorY : handle.includes("s") ? bounds.height - anchorY : 2 * Math.min(anchorY, bounds.height - anchorY);
  const shrink = Math.min(1, roomX / width, roomY / height);
  width *= shrink; height *= shrink;
  if (width < min) { width = min; height = min / aspect; }
  if (height < min) { height = min; width = min * aspect; }
  const x = handle.includes("w") ? anchorX - width : handle.includes("e") ? anchorX : anchorX - width / 2;
  const y = handle.includes("n") ? anchorY - height : handle.includes("s") ? anchorY : anchorY - height / 2;
  return clampRect({ x, y, width, height }, bounds, min);
}

/** Scales a size down so neither side passes `maxEdge`; never up. */
export function capSize(size: Size, maxEdge = MAX_EDGE): Size {
  const ratio = Math.min(1, maxEdge / Math.max(size.width, size.height));
  return { width: Math.max(1, Math.round(size.width * ratio)), height: Math.max(1, Math.round(size.height * ratio)) };
}

/** A typed width or height, the other side following when the ratio is locked. */
export function resizeTo(crop: Size, side: "width" | "height", value: number, current: Size, locked: boolean): Size {
  const v = Math.max(1, Math.min(MAX_EDGE, Math.round(value) || 1));
  if (!locked) return side === "width" ? { width: v, height: current.height } : { width: current.width, height: v };
  const ratio = crop.width / crop.height;
  const next = side === "width" ? { width: v, height: Math.max(1, Math.round(v / ratio)) } : { width: Math.max(1, Math.round(v * ratio)), height: v };
  return capSize(next);
}

/** The CSS/canvas filter string for the sliders; "none" when nothing is changed. */
export function filterString(a: Adjustments): string {
  const parts: string[] = [];
  if (a.brightness !== 100) parts.push(`brightness(${a.brightness}%)`);
  if (a.contrast !== 100) parts.push(`contrast(${a.contrast}%)`);
  if (a.saturation !== 100) parts.push(`saturate(${a.saturation}%)`);
  if (a.grayscale) parts.push(`grayscale(${a.grayscale}%)`);
  return parts.length ? parts.join(" ") : "none";
}

const EXTENSIONS: Record<OutputType, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/** The original file name with the extension of the type actually written. */
export function outputName(name: string, type: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${EXTENSIONS[type as OutputType] ?? "img"}`;
}

/** The format to save as by default: the source's own, PNG kept for transparency. */
export function defaultOutputType(sourceType: string): OutputType {
  return sourceType === "image/png" ? "image/png" : sourceType === "image/jpeg" ? "image/jpeg" : "image/webp";
}
