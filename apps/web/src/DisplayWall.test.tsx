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
  it("matches the regular wall's smaller cards and fills the available width responsively", async () => {
    await render("/view?demo=1");
    const wall = host.querySelector<HTMLElement>(".drift-wall")!;
    expect(wall.style.getPropertyValue("--dw-tile-w")).toBe("230px");
    expect(wall.style.getPropertyValue("--dw-tile-h")).toBe("180px");
    expect(wall.style.getPropertyValue("--dw-gap")).toBe("16px");
    for (const [width, columns] of [
      [1280, 6],
      [720, 3],
      [220, 1],
      [6000, 8],
    ]) {
      await act(async () => {
        resizeWall(
          [{ contentRect: { width } } as ResizeObserverEntry],
          {} as ResizeObserver,
        );
      });
      expect(host.querySelectorAll(".drift-wall__col")).toHaveLength(columns);
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
  it("uses the regular prayer wall's angle while keeping the display hands-free", async () => {
    await render("/view?demo=1");
    const frame = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    await act(async () => frame(0));
    const wall = host.querySelector<HTMLElement>(".drift-wall")!;
    const plane = host.querySelector<HTMLElement>(".drift-wall__plane")!;
    expect(wall.style.getPropertyValue("--dw-perspective")).toBe("1250px");
    expect(plane.style.transform).toContain("rotateX(9deg)");
    expect(plane.style.transform).toContain("rotateY(-7deg)");
    expect(plane.style.transform).toContain("translateZ(-90px)");
    expect(
      host.querySelector(".drift-wall a, .drift-wall [tabindex]"),
    ).toBeNull();
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
      host.querySelector("header, footer, nav, input, select, button"),
    ).toBeNull();
    expect(host.querySelector(".drift-wall")).not.toBeNull();
    expect(host.textContent).toContain(prayer.message);
    expect(host.textContent).toContain("Anonymous");
    expect(host.textContent).not.toContain("Must stay private");
    expect(
      host.querySelector(".drift-wall [tabindex], .drift-wall a"),
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
    expect(host.querySelector(".drift-wall")).toBeNull();
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
