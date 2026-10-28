import { IDLE_MS, MAX_ACTIVE_SECONDS } from "@/lib/analytics/shared";

/* Active reading time, not "how long the tab was open".

   Time counts only while all of these hold: the tab is visible, the window has
   focus (or focus is inside an embedded player on the page), and the reader did
   something in the last IDLE_MS, or a video or audio element is playing. The
   tracker calls tick() about once a second and on every state change; each call
   credits the time since the previous one if the reader was engaged throughout.

   A gap longer than MAX_STEP_MS between two calls (a sleeping laptop, a
   throttled background timer) is credited as MAX_STEP_MS at most, so waking
   up never adds the time spent asleep. Pure: the caller supplies the time,
   which keeps it testable with plain numbers. */

const MAX_STEP_MS = 2_000;

export type ClockState = { visible: boolean; focused: boolean; mediaPlaying: boolean };

export class ActiveClock {
  private activeMs = 0;
  private lastTick: number;
  private lastInteraction: number;
  private state: ClockState;

  constructor(now: number, state: ClockState) {
    this.lastTick = now;
    // opening the page is the first thing the reader did
    this.lastInteraction = now;
    this.state = { ...state };
  }

  private engagedAt(now: number): boolean {
    const { visible, focused, mediaPlaying } = this.state;
    return visible && (mediaPlaying || (focused && now - this.lastInteraction <= IDLE_MS));
  }

  /** Credit the time since the last tick, if the reader was engaged. */
  tick(now: number): void {
    const step = Math.min(Math.max(0, now - this.lastTick), MAX_STEP_MS);
    const { visible, focused, mediaPlaying } = this.state;
    if (visible && mediaPlaying) this.activeMs += step;
    // reading: engaged until IDLE_MS after the last interaction, which can fall inside this step
    else if (visible && focused) this.activeMs += Math.max(0, Math.min(now, this.lastInteraction + IDLE_MS) - (now - step));
    this.lastTick = now;
  }

  /** A scroll, key, pointer or touch. */
  interact(now: number): void {
    this.tick(now);
    this.lastInteraction = now;
  }

  /** Visibility, focus or media changed. Time up to now is settled under the old state first. */
  update(now: number, change: Partial<ClockState>): void {
    this.tick(now);
    const wasPaused = !this.engagedAt(now);
    this.state = { ...this.state, ...change };
    // coming back to the tab or window is an interaction
    if (wasPaused && (change.visible || change.focused)) this.lastInteraction = now;
  }

  /** Whole active seconds so far, capped. */
  seconds(now: number): number {
    this.tick(now);
    return Math.min(MAX_ACTIVE_SECONDS, Math.floor(this.activeMs / 1000));
  }
}
