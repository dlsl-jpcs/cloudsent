import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { PublicPrayer } from "@cloudsent/contracts";
import SkyBackdrop from "./SkyBackdrop";
import SkyPrayerCard from "./SkyPrayerCard";

export function newestFirst(prayers: PublicPrayer[]) {
  return [...prayers].sort((a, b) =>
    Date.parse(b.approvedAt || b.createdAt) - Date.parse(a.approvedAt || a.createdAt) || b.id.localeCompare(a.id),
  );
}

export default function SkyWall({ prayers }: { prayers: PublicPrayer[] }) {
  const ordered = newestFirst(prayers);
  const grid = useRef<HTMLUListElement>(null);
  const seen = useRef(new Set<string>());
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const [arrivals, setArrivals] = useState(new Set<string>());
  useLayoutEffect(() => {
    const fresh = prayers.filter((prayer) => !seen.current.has(prayer.id)).map((prayer) => prayer.id);
    seen.current = new Set(prayers.map((prayer) => prayer.id));
    if (fresh.length) setArrivals(new Set(fresh));
    const animations: Animation[] = [];
    const next = new Map<string, { x: number; y: number }>();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    grid.current?.querySelectorAll<HTMLLIElement>("li[data-prayer-id]").forEach((tile) => {
      const id = tile.dataset.prayerId!;
      const point = { x: tile.offsetLeft, y: tile.offsetTop };
      const previous = positions.current.get(id);
      if (previous && !reduced && tile.animate && (previous.x !== point.x || previous.y !== point.y)) {
        animations.push(tile.animate([
          { transform: `translate(${previous.x - point.x}px, ${previous.y - point.y}px)` },
          { transform: "translate(0, 0)" },
        ], { duration: 850, easing: "cubic-bezier(.22,1,.36,1)" }));
      }
      next.set(id, point);
    });
    positions.current = next;
    const timer = window.setTimeout(() => setArrivals(new Set()), 1800);
    return () => { window.clearTimeout(timer); animations.forEach((animation) => animation.cancel()); };
  }, [prayers]);
  return (
    <section className="sky-wall" aria-label="Sky of prayers">
      <SkyBackdrop />
      <ul className="sky-prayer-grid" ref={grid}>
        {ordered.map((prayer, index) => (
          <li key={prayer.id} data-prayer-id={prayer.id} style={{
            "--card-angle": `${[-1.2, 1, -0.7, 0.6, -1, 0.9][index % 6]}deg`,
            "--float-duration": `${9 + index % 5}s`,
            "--float-delay": `${-(index % 7)}s`,
          } as CSSProperties}>
            <div className={`sky-card-arrival ${arrivals.has(prayer.id) ? "is-arriving" : ""}`}>
              <div className="sky-card-float"><SkyPrayerCard prayer={prayer} /></div>
            </div>
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">{prayers.length} prayers shown. Newest prayers first.</p>
    </section>
  );
}
