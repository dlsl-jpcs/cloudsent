// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { displaySamples } from "../displaySamples";
import SkyWall from "./SkyWall";
import PillNav from "./PillNav";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const render = async (prayers = displaySamples.slice(0, 3)) => {
  await act(async () => root.render(<MemoryRouter><SkyWall prayers={prayers} /></MemoryRouter>));
};
describe("the digital prayer sky", () => {
  it("shows each prayer once, newest approval first, with links to full prayers", async () => {
    await render();
    const cards = [...host.querySelectorAll<HTMLLIElement>("li[data-prayer-id]")];
    expect(cards.map((card) => card.dataset.prayerId)).toEqual(["display-sample-3", "display-sample-2", "display-sample-1"]);
    expect(cards[0].querySelector("a")?.getAttribute("href")).toBe("/prayer/display-sample-3");
    expect(host.querySelector(".sky-backdrop")?.getAttribute("aria-hidden")).toBe("true");
  });
  it("preserves existing cards and animates only arriving prayers on refresh", async () => {
    const old = displaySamples.slice(0, 2);
    await render(old);
    await act(async () => vi.advanceTimersByTime(1800));
    const retained = host.querySelector('[data-prayer-id="display-sample-1"]');
    await render([...old, displaySamples[2]]);
    expect(host.querySelector('[data-prayer-id="display-sample-1"]')).toBe(retained);
    expect(retained?.querySelector(".is-arriving")).toBeNull();
    expect(host.querySelectorAll(".is-arriving")).toHaveLength(1);
    expect(host.querySelector("li")?.dataset.prayerId).toBe("display-sample-3");
    await act(async () => vi.advanceTimersByTime(1800));
    expect(host.querySelectorAll(".is-arriving")).toHaveLength(0);
  });
  it("never displays an anonymous prayer's stored name", async () => {
    await render([{ ...displaySamples[0], isAnonymous: true, displayName: "Private name" }]);
    expect(host.textContent).not.toContain("Private name");
    expect(host.querySelector(".sky-card-author")?.textContent).toContain("Anonymous");
  });
  it("provides all three navigation links and marks only the current page", async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={["/wall"]}><PillNav /></MemoryRouter>));
    expect([...host.querySelectorAll("a")].map((link) => link.textContent)).toEqual(["Home", "Prayer Wall", "Send a Prayer"]);
    expect(host.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(host.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe("/wall");
  });
});
