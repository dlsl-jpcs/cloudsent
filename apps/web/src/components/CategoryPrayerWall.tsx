import { useId, useMemo, useState, type CSSProperties } from "react";
import { prayerCategories, type PublicPrayer } from "@cloudsent/contracts";
import SkyPrayerCard, { CategoryIcon } from "./SkyPrayerCard";
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
  const accordionId = useId();
  const groups = useMemo(() => groupByCategory(prayers), [prayers]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const columns = Math.max(
    1,
    Math.min(4, Math.floor((wallWidth - 44 + 12) / 272)),
  );
  const expandedGroups = groups.filter((group) => !collapsed.has(group.id));
  const expandedRows = expandedGroups.reduce(
    (total, group) => total + Math.ceil(group.prayers.length / columns),
    0,
  );
  const cardRowGaps = expandedGroups.reduce(
    (total, group) =>
      total + Math.max(0, Math.ceil(group.prayers.length / columns) - 1) * 10,
    0,
  );
  const padding = Math.max(16, Math.min(28, wallWidth * 0.018));
  const groupGap = 14;
  const cardGap = 10;
  const fixedHeight =
    padding * 2 +
    groups.length * 46 +
    Math.max(0, groups.length - 1) * groupGap +
    expandedGroups.length * 12 +
    cardRowGaps;
  const cardHeight = expandedRows
    ? Math.min(
        176,
        Math.max(96, Math.floor((wallHeight - fixedHeight) / expandedRows)),
      )
    : 176;
  const contentHeight =
    groups.length * 46 +
    Math.max(0, groups.length - 1) * groupGap +
    expandedGroups.reduce(
      (total, group) =>
        total +
        Math.ceil(group.prayers.length / columns) * cardHeight +
        Math.max(0, Math.ceil(group.prayers.length / columns) - 1) * cardGap +
        12,
      0,
    );
  const scrollDistance = Math.max(0, contentHeight + padding * 2 - wallHeight);
  const scrollDuration = Math.max(28, scrollDistance / 14);
  const wallStyle = {
    "--display-columns": columns,
    "--display-card-height": `${cardHeight}px`,
    "--display-scroll-distance": `${scrollDistance}px`,
    "--display-scroll-duration": `${scrollDuration}s`,
  } as CSSProperties;

  const toggleCategory = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="display-category-wall"
      role="region"
      aria-label="Prayers grouped by category"
      data-scrolls={scrollDistance > 0 ? "true" : "false"}
      style={wallStyle}
    >
      <div className="display-accordion-track">
        {groups.map((group) => {
          const isOpen = !collapsed.has(group.id);
          const triggerId = `${accordionId}-${group.id}-trigger`;
          const panelId = `${accordionId}-${group.id}-panel`;

          return (
            <section className="display-category-accordion" key={group.id}>
              <h2 className="display-category-heading">
                <button
                  className="display-category-toggle"
                  id={triggerId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleCategory(group.id)}
                >
                  <CategoryIcon name={group.name} />
                  <span className="display-category-name">{group.name}</span>
                  <span className="display-category-count">
                    {group.prayers.length}
                  </span>
                  <span className="display-category-chevron" aria-hidden="true" />
                </button>
              </h2>
              <div
                className="display-category-panel"
                id={panelId}
                aria-labelledby={triggerId}
                role="region"
                hidden={!isOpen}
              >
                <ul className="display-category-cards">
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
