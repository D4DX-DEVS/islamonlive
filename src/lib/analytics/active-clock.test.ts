import { describe, expect, it } from "vitest";
import { ActiveClock } from "./active-clock";
import { IDLE_MS, MAX_ACTIVE_SECONDS } from "./shared";

const shown = { visible: true, focused: true, mediaPlaying: false };

/** Tick every second from `from` to `to`, as the tracker's timer does. */
function run(clock: ActiveClock, from: number, to: number): void {
  for (let t = from + 1000; t <= to; t += 1000) clock.tick(t);
}

describe("ActiveClock", () => {
  it("counts a visible, focused reader who keeps scrolling", () => {
    const clock = new ActiveClock(0, shown);
    for (let t = 1000; t <= 60_000; t += 1000) { clock.tick(t); if (t % 10_000 === 0) clock.interact(t); }
    expect(clock.seconds(60_000)).toBe(60);
  });

  it("stops IDLE_MS after the last interaction, to the second", () => {
    const clock = new ActiveClock(0, shown);
    run(clock, 0, 120_000);
    expect(clock.seconds(120_000)).toBe(IDLE_MS / 1000);
  });

  it("resumes on the next interaction", () => {
    const clock = new ActiveClock(0, shown);
    run(clock, 0, 100_000);
    clock.interact(100_000);
    run(clock, 100_000, 110_000);
    expect(clock.seconds(110_000)).toBe(IDLE_MS / 1000 + 10);
  });

  it("does not count a hidden tab", () => {
    const clock = new ActiveClock(0, shown);
    run(clock, 0, 5_000);
    clock.update(5_000, { visible: false });
    for (let t = 6_000; t <= 600_000; t += 1000) { clock.tick(t); clock.interact(t); }
    expect(clock.seconds(600_000)).toBe(5);
  });

  it("does not count while the window is in the background", () => {
    const clock = new ActiveClock(0, shown);
    run(clock, 0, 3_000);
    clock.update(3_000, { focused: false });
    run(clock, 3_000, 63_000);
    expect(clock.seconds(63_000)).toBe(3);
  });

  it("treats coming back to the tab as an interaction", () => {
    const clock = new ActiveClock(0, shown);
    clock.update(0, { visible: false });
    run(clock, 0, 300_000);
    clock.update(300_000, { visible: true });
    run(clock, 300_000, 310_000);
    expect(clock.seconds(310_000)).toBe(10);
  });

  it("counts a playing video or audio without interaction, but not in a hidden tab", () => {
    const clock = new ActiveClock(0, shown);
    clock.update(0, { mediaPlaying: true, focused: false });
    run(clock, 0, 180_000);
    expect(clock.seconds(180_000)).toBe(180);
    clock.update(180_000, { visible: false });
    run(clock, 180_000, 240_000);
    expect(clock.seconds(240_000)).toBe(180);
  });

  it("never credits the time a laptop slept between two ticks", () => {
    const clock = new ActiveClock(0, shown);
    clock.tick(1000);
    clock.interact(3_600_000);
    expect(clock.seconds(3_600_000)).toBeLessThanOrEqual(3);
  });

  it("is capped", () => {
    const clock = new ActiveClock(0, { ...shown, mediaPlaying: true });
    for (let t = 1000; t <= (MAX_ACTIVE_SECONDS + 600) * 1000; t += 1000) clock.tick(t);
    expect(clock.seconds((MAX_ACTIVE_SECONDS + 600) * 1000)).toBe(MAX_ACTIVE_SECONDS);
  });
});
