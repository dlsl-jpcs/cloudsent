// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicPrayer } from "@cloudsent/contracts";
import App from "./App";
import * as api from "./api";
import { displaySamples } from "./displaySamples";

vi.mock("./api");
let host: HTMLDivElement;
let root: Root;
let resizeWall: ResizeObserverCallback;
const prayer: PublicPrayer = {
  id: "display-test-prayer",
  title: "For our school",
  message: "May everyone find a little kindness today.",
  excerpt: "May everyone find a little kindness today.",
  isAnonymous: true,
  displayName: "Must stay private",
  color: "sky",
  category: { id: "category", name: "Community", active: true, position: 0 },
  mood: { id: "mood", name: "Hopeful", active: true, position: 0 },
  createdAt: "2026-10-04T00:00:00Z",
  approvedAt: "2026-10-04T00:00:00Z",
};
const response = (data: PublicPrayer[]) => ({
  data,
  meta: { hasMore: false, nextCursor: null },
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        if (target.classList.contains("display-wall")) resizeWall = this.callback;
      }
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(Math, "random").mockReturnValue(0.25);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.mocked(api.listPrayers).mockResolvedValue(response([prayer]));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const render = async (route = "/view") => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>,
    ),
  );
};
const tick = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
};

describe("school display", () => {
  it("places the JPCS DLSL copyright below the wall and QR panel", async () => {
    await render("/view?demo=1");
    const notice = host.querySelector(".display-footer .copyright-notice")!;
    expect(notice.textContent).toBe(`© ${new Date().getFullYear()} JPCS DLSL. All rights reserved.`);
    expect(host.querySelectorAll(".copyright-notice")).toHaveLength(1);
    expect(host.querySelector(".display-page")?.nextElementSibling).toBe(notice.parentElement);
  });
  it("keeps exactly five drift columns and fits cards to the available space", async () => {
    await render("/view?demo=1");
    await act(async () => {
      resizeWall(
        [{ contentRect: { width: 1280, height: 800 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });
    const wall = host.querySelector<HTMLElement>(".display-drift")!;
    const wideCardWidth = Number.parseFloat(wall.style.getPropertyValue("--dw-tile-w"));
    expect(wideCardWidth).toBeLessThanOrEqual(216);
    expect(host.querySelectorAll(".drift-wall__col")).toHaveLength(5);
    for (const column of host.querySelectorAll(".drift-wall__col")) {
      expect(column.querySelectorAll(".drift-wall__tile").length).toBeGreaterThan(0);
    }
    await act(async () => {
      resizeWall(
        [{ contentRect: { width: 360, height: 550 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });
    const narrowCardWidth = Number.parseFloat(wall.style.getPropertyValue("--dw-tile-w"));
    const gap = Number.parseFloat(wall.style.getPropertyValue("--dw-gap"));
    expect(narrowCardWidth).toBeLessThan(wideCardWidth);
    expect(5 * (narrowCardWidth + gap)).toBeLessThan(360);
    expect(host.querySelectorAll(".drift-wall__col")).toHaveLength(5);
  });
  it.each([1, 2, 3, 4])("fills five lanes using only existing prayers when there are %i records", async (count) => {
    const records = Array.from({ length: count }, (_, index) => ({
      ...prayer, id: `sparse-${index}`, title: `Prayer ${index}`,
    }));
    vi.mocked(api.listPrayers).mockResolvedValue(response(records));
    await render();
    expect(host.querySelectorAll(".drift-wall__col")).toHaveLength(5);
    expect(host.querySelectorAll('.drift-wall__tile:not([aria-hidden="true"])')).toHaveLength(count);
    const ids = new Set(records.map((record) => record.id));
    for (const column of host.querySelectorAll(".drift-wall__col")) {
      const tiles = column.querySelectorAll(".drift-wall__tile");
      expect(tiles.length).toBeGreaterThan(1);
      for (const tile of tiles) expect(ids.has(tile.getAttribute("data-item-id")!)).toBe(true);
    }
  });
  it("frames the QR invitation and keeps decorative cloud artwork out of the reading order", async () => {
    await render("/view?demo=1");
    expect(
      host.querySelector(".display-qr-frame.card-spotlight .display-qr svg"),
    ).not.toBeNull();
    expect(
      host.querySelector(".display-cloudscape")?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(
      host.querySelector(".display-cloudscape")?.getAttribute("focusable"),
    ).toBe("false");
    expect(host.querySelector(".display-qr-caption")?.textContent).toBe(
      "Scan to join",
    );
  });
  it("randomizes prayer placement and keeps it stable through resizing and unchanged polling", async () => {
    await render("/view?demo=1");
    const wall = host.querySelector<HTMLElement>(".display-drift")!;
    expect(wall.querySelector("a, [tabindex], button")).toBeNull();
    const columnIds = () => [...wall.querySelectorAll(".drift-wall__col")].map((column) =>
      [...column.querySelectorAll('.drift-wall__tile:not([aria-hidden="true"])')].map((tile) =>
        tile.getAttribute("data-item-id"),
      ),
    );
    const columns = columnIds();
    const shuffledOrder = Array.from({ length: 8 }, (_, row) => columns.map((column) => column[row])).flat();
    const sourceOrder = displaySamples.map((sample) => sample.id);
    expect(shuffledOrder).not.toEqual(sourceOrder);
    expect([...shuffledOrder].sort()).toEqual([...sourceOrder].sort());
    await act(async () => {
      resizeWall(
        [{ contentRect: { width: 1000, height: 750 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });
    expect(columnIds()).toEqual(columns);

    // Check the live path as well: repeated API responses must not rebuild tracks.
    await act(async () => root.unmount());
    root = createRoot(host);
    vi.mocked(api.listPrayers).mockResolvedValue(response(displaySamples));
    await render();
    const tracks = [...host.querySelectorAll(".drift-wall__track")];
    const initialTiles = tracks.map((track) => [...track.children]);
    await tick();
    expect(api.listPrayers).toHaveBeenCalledTimes(2);
    tracks.forEach((track, index) => expect([...track.children]).toEqual(initialTiles[index]));
  });
  it("settles the angled tracks immediately and stops frame scheduling for reduced motion", async () => {
    await render("/view?demo=1");
    const plane = host.querySelector<HTMLElement>(".drift-wall__plane")!;
    expect(plane.style.transform).toContain("rotateZ(-4deg)");
    for (const track of host.querySelectorAll<HTMLElement>(".drift-wall__track")) {
      expect(track.style.transform).toMatch(/^translate3d\(0, -?\d/);
    }
    const raf = vi.mocked(requestAnimationFrame);
    const callback = raf.mock.calls.at(-1)![0];
    raf.mockClear();
    callback(1000);
    expect(raf).not.toHaveBeenCalled();
  });
  it("shows 40 labeled sample prayers in every color without contacting the database", async () => {
    await render("/view?demo=1");
    expect(
      host.querySelectorAll('.drift-wall__tile:not([aria-hidden="true"])'),
    ).toHaveLength(40);
    expect(new Set(displaySamples.map((sample) => sample.color)).size).toBe(6);
    expect(new Set(displaySamples.map((sample) => sample.title)).size).toBe(40);
    expect(host.textContent).toContain(
      "Preview: 40 sample prayers. These are not live submissions.",
    );
    expect(host.querySelector(".display-qr")?.getAttribute("href")).toBe(
      new URL("/", window.location.origin).href,
    );
    await tick();
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(api.listPrayers).not.toHaveBeenCalled();
    expect(api.submitPrayer).not.toHaveBeenCalled();
  });
  it("does not let an in-flight live response replace the sample preview", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    vi.mocked(api.listPrayers).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    function SwitchToPreview() {
      const navigate = useNavigate();
      return <button onClick={() => navigate("/view?demo=1")}>Preview</button>;
    }
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/view"]}>
          <SwitchToPreview />
          <App />
        </MemoryRouter>,
      ),
    );
    await act(async () =>
      host.querySelector<HTMLButtonElement>("button")!.click(),
    );
    await act(async () => resolve(response([prayer])));
    expect(host.textContent).toContain(displaySamples[0].title);
    expect(host.textContent).not.toContain(prayer.message);
    await tick();
    expect(api.listPrayers).toHaveBeenCalledTimes(1);
  });
  it("removes sample content when returning to the live display", async () => {
    function SwitchToLive() {
      const navigate = useNavigate();
      return <button onClick={() => navigate("/view")}>Live</button>;
    }
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/view?demo=1"]}>
          <SwitchToLive />
          <App />
        </MemoryRouter>,
      ),
    );
    await act(async () =>
      host.querySelector<HTMLButtonElement>("button")!.click(),
    );
    expect(api.listPrayers).toHaveBeenCalledWith("?limit=48");
    expect(host.textContent).toContain(prayer.message);
    expect(host.textContent).not.toContain(displaySamples[0].title);
    expect(host.textContent).not.toContain("40 sample prayers");
  });
  it("opens /view without website chrome or filters and only requests public prayers", async () => {
    await render("/view?status=pending&q=ignored");
    expect(api.listPrayers).toHaveBeenCalledWith("?limit=48");
    expect(api.adminPrayers).not.toHaveBeenCalled();
    expect(api.getTaxonomy).not.toHaveBeenCalled();
    expect(
      host.querySelector("header, .site-footer, nav, input, select, button"),
    ).toBeNull();
    expect(host.querySelector(".display-drift")).not.toBeNull();
    expect(host.textContent).toContain(prayer.message);
    expect(host.textContent).toContain("Anonymous");
    expect(host.textContent).not.toContain("Must stay private");
    expect(
      host.querySelector(".display-drift [tabindex], .display-drift a"),
    ).toBeNull();
    expect(document.title).toBe("Prayer wall display · CloudSent()");
  });
  it("encodes the homepage in a black-on-white QR with a quiet margin", async () => {
    await render();
    const value = new URL("/", window.location.origin).href;
    expect(host.querySelector(".display-qr")?.getAttribute("href")).toBe(value);
    const expected = document.createElement("div");
    expected.innerHTML = renderToStaticMarkup(
      <QRCodeSVG
        value={value}
        size={280}
        marginSize={4}
        level="M"
        bgColor="#ffffff"
        fgColor="#000000"
      />,
    );
    const actualPaths = [...host.querySelectorAll(".display-qr path")].map(
      (path) => path.getAttribute("d"),
    );
    expect(actualPaths).toEqual(
      [...expected.querySelectorAll("path")].map((path) =>
        path.getAttribute("d"),
      ),
    );
    expect(host.querySelector(".display-qr svg title")?.textContent).toContain(
      "CloudSent website",
    );
    expect(host.textContent).toContain("Local preview");
  });
  it("refreshes automatically, including removing prayers no longer public", async () => {
    await render();
    vi.mocked(api.listPrayers).mockResolvedValue(response([]));
    await tick();
    expect(api.listPrayers).toHaveBeenCalledTimes(2);
    expect(host.querySelector(".display-drift")).toBeNull();
    expect(host.textContent).toContain("A place for your first prayer.");
  });
  it("keeps loaded prayers during a connection failure and recovers", async () => {
    await render();
    vi.mocked(api.listPrayers).mockRejectedValueOnce(new Error("Test offline"));
    await tick();
    expect(host.textContent).toContain(prayer.message);
    expect(host.textContent).toContain("Reconnecting");
    await tick();
    expect(host.textContent).not.toContain("Reconnecting");
  });
  it("shows first-load failure and retries without user interaction", async () => {
    vi.mocked(api.listPrayers).mockRejectedValueOnce(new Error("Test offline"));
    await render();
    expect(host.textContent).toContain("The wall couldn’t connect.");
    expect(host.querySelector(".display-qr svg")).not.toBeNull();
    await tick();
    expect(host.textContent).toContain(prayer.message);
  });
  it("pauses hidden-tab polling and refreshes when visible or online", async () => {
    await render();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await tick();
    expect(api.listPrayers).toHaveBeenCalledTimes(1);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(api.listPrayers).toHaveBeenCalledTimes(2);
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(api.listPrayers).toHaveBeenCalledTimes(3);
  });
  it("does not overlap requests and cleans up polling on navigation away", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    vi.mocked(api.listPrayers).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await render();
    await tick();
    expect(api.listPrayers).toHaveBeenCalledTimes(1);
    await act(async () => resolve(response([prayer])));
    await act(async () =>
      root.render(
        <MemoryRouter>
          <div>Another page</div>
        </MemoryRouter>,
      ),
    );
    await tick();
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(api.listPrayers).toHaveBeenCalledTimes(1);
  });
});
