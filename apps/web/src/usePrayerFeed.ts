import { useEffect, useRef, useState } from "react";
import type { PublicPrayer } from "@cloudsent/contracts";
import { listPrayers } from "./api";

type PageMeta = { hasMore: boolean; nextCursor: string | null };
const emptyMeta: PageMeta = { hasMore: false, nextCursor: null };
const unique = (prayers: PublicPrayer[]) => [...new Map(prayers.map((prayer) => [prayer.id, prayer])).values()];

// Refresh the pages already opened, so arrivals and moderation changes stay in sync.
export default function usePrayerFeed(search: string) {
  const [prayers, setPrayers] = useState<PublicPrayer[]>([]);
  const [meta, setMeta] = useState<PageMeta>(emptyMeta);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [refreshError, setRefreshError] = useState(false);
  const generation = useRef(0);
  const pages = useRef(1);
  const busy = useRef<number | null>(null);
  useEffect(() => {
    const current = ++generation.current;
    let active = true;
    let initial = true;
    pages.current = 1;
    busy.current = null;
    setLoading(true);
    setLoadingMore(false);
    setFailed(false);
    setMoreError("");
    setRefreshError(false);
    const refresh = async () => {
      if (!active || busy.current === current || (!initial && (document.hidden || navigator.onLine === false))) return;
      busy.current = current;
      try {
        const collected: PublicPrayer[] = [];
        let nextMeta = emptyMeta;
        let count = 0;
        for (let page = 0; page < pages.current; page++) {
          const query = new URLSearchParams(search);
          query.delete("cursor");
          if (nextMeta.nextCursor) query.set("cursor", nextMeta.nextCursor);
          const result = await listPrayers(query.size ? `?${query}` : "");
          if (!active) return;
          collected.push(...result.data);
          nextMeta = result.meta;
          count++;
          if (!nextMeta.hasMore || !nextMeta.nextCursor) break;
        }
        pages.current = count;
        const records = unique(collected);
        setPrayers((previous) => JSON.stringify(previous) === JSON.stringify(records) ? previous : records);
        setMeta(nextMeta);
        setFailed(false);
        setRefreshError(false);
      } catch {
        if (active) { if (initial) setFailed(true); else setRefreshError(true); }
      } finally {
        if (active) { initial = false; setLoading(false); }
        if (busy.current === current) busy.current = null;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const resume = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      generation.current++;
    };
  }, [search]);
  const loadMore = async () => {
    const current = generation.current;
    if (!meta.hasMore || !meta.nextCursor || busy.current === current) return;
    busy.current = current;
    setLoadingMore(true);
    setMoreError("");
    const query = new URLSearchParams(search);
    query.set("cursor", meta.nextCursor);
    try {
      const result = await listPrayers(`?${query}`);
      if (generation.current === current) {
        setPrayers((previous) => unique([...previous, ...result.data]));
        setMeta(result.meta);
        pages.current++;
      }
    } catch {
      if (generation.current === current) setMoreError("More prayers couldn’t be loaded. Please try again.");
    } finally {
      if (generation.current === current) setLoadingMore(false);
      if (busy.current === current) busy.current = null;
    }
  };
  return { prayers, meta, loading, failed, loadingMore, moreError, refreshError, loadMore };
}
