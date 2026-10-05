import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { PublicPrayer } from "@cloudsent/contracts";
import { palette } from "../palette";
import CloudIcon from "./CloudIcon";
import "./SkyWall.css";

export function CategoryIcon({ name }: { name: string }) {
  const path = /thank|grat/i.test(name)
    ? "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"
    : /reflection|hope/i.test(name)
      ? "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"
      : /memorial|remembrance/i.test(name)
        ? "M5 20C5 10 10 4 20 3c1 10-4 17-12 16m-3 2L17 8"
        : /encouragement/i.test(name)
          ? "M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13 1 4.5 4.5 0 0 1 0 9Z"
          : "M12 20 3 11C-2 4 7 0 12 7c5-7 14-3 9 4Z";
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
}

export default function SkyPrayerCard({ prayer, interactive = true }: { prayer: PublicPrayer; interactive?: boolean }) {
  const style = { "--prayer-color": palette[prayer.color] || palette.cloud } as CSSProperties;
  const content = <>
    <span className="sky-card-category"><CategoryIcon name={prayer.category.name} />{prayer.category.name}</span>
    <span className="sky-card-cloud" aria-hidden="true"><CloudIcon /></span>
    {prayer.title && <h2>{prayer.title}</h2>}
    <p className="sky-card-message">{prayer.excerpt || prayer.message}</p>
    <p className="sky-card-author">{prayer.isAnonymous ? "Anonymous" : prayer.displayName || "Anonymous"}<span> · {prayer.category.name}</span></p>
  </>;
  return interactive
    ? <Link to={`/prayer/${prayer.id}`} className="sky-prayer-card" style={style}>{content}</Link>
    : <article className="sky-prayer-card" style={style}>{content}</article>;
}
