// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { displaySamples } from "./displaySamples";
import * as api from "./api";
import usePrayerFeed from "./usePrayerFeed";

vi.mock("./api");
let host: HTMLDivElement;
let root: Root;
let feed: ReturnType<typeof usePrayerFeed>;
function Harness({ search }: { search: string }) {
  feed = usePrayerFeed(search);
  return <button onClick={feed.loadMore}>More</button>;
}
const page = (indexes: number[], cursor: string | null = null) => ({ data: indexes.map((index) => displaySamples[index]), meta: { hasMore: Boolean(cursor), nextCursor: cursor } });
const render = async (search = "") => { await act(async () => root.render(<Harness search={search} />)); };
const refresh = async () => { await act(async () => vi.advanceTimersByTime(30_000)); };
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
describe("live prayer arrivals", () => {
  it("refreshes arrivals and removes prayers no longer returned by the public API", async () => {
    vi.mocked(api.listPrayers).mockResolvedValueOnce(page([1, 0])).mockResolvedValueOnce(page([2, 1]));
    await render();
    await refresh();
    expect(feed.prayers.map((prayer) => prayer.id)).toEqual(["display-sample-3", "display-sample-2"]);
  });
  it("refreshes all loaded pages with fresh cursors and deduplicates records", async () => {
    vi.mocked(api.listPrayers)
      .mockResolvedValueOnce(page([2, 1], "old-cursor"))
      .mockResolvedValueOnce(page([1, 0]))
      .mockResolvedValueOnce(page([3, 2], "new-cursor"))
      .mockResolvedValueOnce(page([1, 0]));
    await render("color=sky");
    await act(async () => host.querySelector("button")!.click());
    expect(feed.prayers).toHaveLength(3);
    await refresh();
    expect(api.listPrayers).toHaveBeenLastCalledWith("?color=sky&cursor=new-cursor");
    expect(feed.prayers).toHaveLength(4);
    expect(feed.meta.hasMore).toBe(false);
  });
  it("keeps the last loaded prayers when refreshing fails and recovers on retry", async () => {
    vi.mocked(api.listPrayers).mockResolvedValueOnce(page([0])).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(page([1, 0]));
    await render();
    await refresh();
    expect(feed.prayers).toHaveLength(1);
    expect(feed.failed).toBe(false);
    expect(feed.refreshError).toBe(true);
    await refresh();
    expect(feed.prayers).toHaveLength(2);
    expect(feed.refreshError).toBe(false);
  });
  it("ignores stale requests after filters change", async () => {
    let resolve!: (value: ReturnType<typeof page>) => void;
    vi.mocked(api.listPrayers).mockImplementationOnce(() => new Promise((done) => { resolve = done; })).mockResolvedValueOnce(page([2]));
    await render("color=sky");
    await render("color=rose");
    await act(async () => resolve(page([0])));
    expect(feed.prayers[0].id).toBe("display-sample-3");
    expect(feed.loading).toBe(false);
  });
  it("does not overlap refresh requests, poll hidden tabs, or poll after unmount", async () => {
    let resolve!: (value: ReturnType<typeof page>) => void;
    vi.mocked(api.listPrayers).mockImplementationOnce(() => new Promise((done) => { resolve = done; })).mockResolvedValue(page([0]));
    await render();
    await refresh();
    expect(api.listPrayers).toHaveBeenCalledTimes(1);
    await act(async () => resolve(page([0])));
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    await refresh();
    expect(api.listPrayers).toHaveBeenCalledTimes(1);
    await act(async () => root.render(null));
    await refresh();
    expect(api.listPrayers).toHaveBeenCalledTimes(1);
  });
});
