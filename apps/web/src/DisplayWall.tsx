import { useEffect, useRef, useState } from "react";
import type { PublicPrayer } from "@cloudsent/contracts";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams } from "react-router-dom";
import { listPrayers } from "./api";
import SkyBackdrop from "./components/SkyBackdrop";
import CloudIcon from "./components/CloudIcon";
import CategoryPrayerWall from "./components/CategoryPrayerWall";
import SpotlightCard from "./components/SpotlightCard";
import CopyrightNotice from "./components/CopyrightNotice";
import { displaySamples } from "./displaySamples";
import "./DisplayWall.css";

const REFRESH_MS = 30_000;

export default function DisplayWall() {
  const [params] = useSearchParams();
  const demo = params.get("demo") === "1";
  const [prayers, setPrayers] = useState<PublicPrayer[]>(() =>
    demo ? displaySamples : [],
  );
  const [loading, setLoading] = useState(!demo);
  const [unavailable, setUnavailable] = useState(false);
  const [wallSize, setWallSize] = useState({ width: 0, height: 0 });
  const wallRef = useRef<HTMLElement>(null);
  // Only the public homepage is encoded, never /view or a private admin route.
  const websiteUrl = new URL("/", window.location.origin).href;
  const localPreview = ["localhost", "127.0.0.1", "[::1]"].includes(
    window.location.hostname,
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Prayer wall display · CloudSent()";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    if (!wallRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setWallSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(wallRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setUnavailable(false);
    if (demo) {
      setPrayers(displaySamples);
      setLoading(false);
      return;
    }
    setPrayers([]);
    setLoading(true);
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (!active || pending) return;
      pending = true;
      try {
        const result = await listPrayers("?limit=48");
        if (active) {
          // Keep the category lanes settled when the public records haven't changed.
          setPrayers((current) =>
            JSON.stringify(current) === JSON.stringify(result.data)
              ? current
              : result.data,
          );
          setUnavailable(false);
        }
      } catch {
        if (active) setUnavailable(true);
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    const resume = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [demo]);

  return (
    <div className="display-shell">
      <main className="display-page" aria-label="CloudSent school prayer wall">
        <section
          className="display-wall"
          ref={wallRef}
          aria-label="Public prayers"
        >
          <h1 className="sr-only">Prayer wall</h1>
          <SkyBackdrop />
          {prayers.length ? (
            <CategoryPrayerWall
              prayers={prayers}
              wallWidth={wallSize.width}
              wallHeight={wallSize.height}
            />
          ) : (
            <div className="display-state" role="status">
              <span aria-hidden="true"><CloudIcon /></span>
              <h2>
                {loading
                  ? "Opening the prayer wall…"
                  : unavailable
                    ? "The wall couldn’t connect."
                    : "A place for your first prayer."}
              </h2>
              <p>
                {loading
                  ? ""
                  : unavailable
                    ? "We’ll try again automatically."
                    : "Scan the code to send a prayer. It will appear here once reviewed."}
              </p>
            </div>
          )}
          {unavailable && prayers.length > 0 && (
            <p className="display-connection" role="status">
              Showing the last loaded prayers. Reconnecting…
            </p>
          )}
        </section>
        <aside className="display-invitation" aria-label="Join CloudSent">
          <svg
            className="display-cloudscape"
            viewBox="0 0 480 240"
            preserveAspectRatio="xMidYMax slice"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M-30 240V175C-10 125 35 120 62 143C66 86 147 71 183 125C207 105 257 117 268 153C305 102 387 113 397 170C430 141 481 164 510 197V240Z"
              fill="white"
              opacity=".35"
            />
            <path
              d="M-30 240V208C12 165 64 178 83 205C108 148 183 151 204 204C246 180 292 195 300 225C343 174 419 186 442 219C465 199 493 203 510 220V240Z"
              fill="white"
              opacity=".55"
            />
          </svg>
          <div className="display-brand">
            <span className="display-brand-cloud" aria-hidden="true">
              <CloudIcon />
            </span>{" "}
            CloudSent
            <span className="brand-parens">()</span>
          </div>
          <div className="display-scan">
            <h2>Leave a little hope.</h2>
            <SpotlightCard className="display-qr-frame">
              <a
                className="display-qr"
                href={websiteUrl}
                aria-label="Open the CloudSent website"
              >
                <QRCodeSVG
                  value={websiteUrl}
                  size={280}
                  marginSize={4}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                  title="Scan to open the CloudSent website"
                />
              </a>
              <span className="display-qr-caption">Scan to join</span>
            </SpotlightCard>
            <p>
              Read the wall
              <br />
              or send a prayer.
            </p>
            <a className="display-url" href={websiteUrl}>
              {new URL(websiteUrl).host}
            </a>
          </div>
          <p className="display-note">
            {demo
              ? "Preview: 40 sample prayers. These are not live submissions."
              : localPreview
                ? "Local preview. Open the deployed website here before displaying this at school."
                : "Anonymous by default. Reviewed before sharing."}
          </p>
        </aside>
      </main>
      <footer className="display-footer">
        <CopyrightNotice />
      </footer>
    </div>
  );
}
