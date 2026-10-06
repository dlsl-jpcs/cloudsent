import { useMemo, type CSSProperties } from "react";
import { prayerCategories, type PublicPrayer } from "@cloudsent/contracts";
import SkyPrayerCard from "./SkyPrayerCard";
import "./CategoryPrayerWall.css";

interface PrayerCategoryGroup {
  id: string;
  name: string;
  prayers: PublicPrayer[];
}

function groupByCategory(prayers: PublicPrayer[]): PrayerCategoryGroup[] {
  const groups = new Map<string, PrayerCategoryGroup>();

  for (const prayer of prayers) {
    const id = prayer.category.id;
    const group = groups.get(id);
    if (group) {
      group.prayers.push(prayer);
    } else {
      groups.set(id, {
        id,
        name: prayer.category.name,
        prayers: [prayer],
      });
    }
  }

  return [...groups.values()].sort((left, right) => {
    const leftOrder = prayerCategories.indexOf(
      left.name as (typeof prayerCategories)[number],
    );
    const rightOrder = prayerCategories.indexOf(
      right.name as (typeof prayerCategories)[number],
    );
    const leftRank = leftOrder === -1 ? prayerCategories.length : leftOrder;
    const rightRank = rightOrder === -1 ? prayerCategories.length : rightOrder;
    return leftRank - rightRank || left.name.localeCompare(right.name);
  });
}

interface CategoryPrayerWallProps {
  prayers: PublicPrayer[];
  wallWidth: number;
  wallHeight: number;
}

export default function CategoryPrayerWall({
  prayers,
  wallWidth,
  wallHeight,
}: CategoryPrayerWallProps) {
  const groups = useMemo(() => groupByCategory(prayers), [prayers]);
  const maxColumnsForWidth = Math.max(
    1,
    Math.floor((wallWidth - 56 + 18) / 218),
  );
  const columns = Math.min(5, Math.max(groups.length, 1), maxColumnsForWidth);
  const rows = Math.ceil(Math.max(groups.length, 1) / columns);
  const maxGroupSize = Math.max(...groups.map((group) => group.prayers.length), 1);
  const padding = Math.max(16, Math.min(30, wallWidth * 0.02));
  const laneGap = Math.max(14, Math.min(24, wallWidth * 0.016));
  const laneHeight = Math.max(
    0,
    (wallHeight - 2 * padding - (rows - 1) * laneGap) / rows,
  );
  const feedHeight = Math.max(0, laneHeight - 42);
  const cardHeight = Math.min(
    184,
    Math.max(
      96,
      Math.floor((feedHeight - (maxGroupSize - 1) * 10) / maxGroupSize),
    ),
  );

  return (
    <div
      className={[
        "display-category-wall",
        groups.length === 1 ? "is-single-category" : "",
        cardHeight < 132 ? "is-compact-cards" : "",
      ].filter(Boolean).join(" ")}
      aria-label="Prayers grouped by category"
      style={
        {
          "--display-columns": columns,
          "--display-card-height": `${cardHeight}px`,
        } as CSSProperties
      }
    >
      <div className="display-category-grid">
        {groups.map((group) => {
          const contentHeight =
            group.prayers.length * cardHeight +
            Math.max(0, group.prayers.length - 1) * 10;
          const scrollDistance = Math.max(0, contentHeight - feedHeight);
          const scrollDuration = Math.max(22, scrollDistance / 16);
          const feedStyle = {
            "--display-scroll-distance": `${scrollDistance}px`,
            "--display-scroll-duration": `${scrollDuration}s`,
          } as CSSProperties;

          return (
            <section className="display-category-lane" key={group.id}>
              <h2 className="display-category-heading">
                <span>{group.name}</span>
                <span className="display-category-count">
                  {group.prayers.length}
                </span>
              </h2>
              <div
                className="display-category-feed-window"
                data-scrolls={scrollDistance > 0 ? "true" : "false"}
                style={feedStyle}
                aria-label={`${group.name} prayers`}
              >
                <ul className="display-category-track">
                  {group.prayers.map((prayer) => (
                    <li key={prayer.id}>
                      <SkyPrayerCard prayer={prayer} interactive={false} />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
