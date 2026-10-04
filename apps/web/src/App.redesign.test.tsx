// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as api from "./api";

vi.mock("./api");
let host: HTMLDivElement;
let root: Root;
const category = {
  id: "category",
  name: "Thanksgiving",
  active: true,
  position: 0,
};
const mood = { id: "mood", name: "Hopeful", active: true, position: 0 };
const prayer = {
  id: "prayer",
  title: "A test intention",
  message: "A harmless test message.",
  excerpt: "A harmless test message.",
  approvedAt: "2026-10-03T00:00:00Z",
  isAnonymous: true,
  displayName: null,
  status: "pending",
  category,
  mood,
  color: "sky" as const,
  createdAt: "2026-10-03T00:00:00Z",
  version: 7,
  deletedAt: null,
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.mocked(api.getTaxonomy).mockResolvedValue({
    data: { categories: [category], moods: [mood], colors: [] },
  });
  vi.mocked(api.submitPrayer).mockResolvedValue({
    data: { message: "Received." },
  });
  vi.mocked(api.adminSession).mockResolvedValue({
    data: { csrfToken: "test-only" },
  });
  vi.mocked(api.adminPrayers).mockResolvedValue({ data: [prayer] });
  vi.mocked(api.adminReports).mockResolvedValue({ data: [] });
  vi.mocked(api.adminStats).mockResolvedValue({
    data: {
      totals: [
        { status: "pending", count: 12 },
        { status: "approved", count: 8 },
      ],
      flags: [],
      unresolvedReportCases: 0,
    },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
const render = async (route: string) => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>,
    ),
  );
};
const button = (text: string, scope: ParentNode = host) =>
  [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) => element.textContent === text,
  )!;
const click = async (element: HTMLElement) => {
  await act(async () => element.click());
};
const fill = async (
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const write = async () => {
  await click(host.querySelector('input[name="category"]')!);
  await fill(host.querySelector("textarea")!, "A hopeful intention.");
  await click(button("Continue"));
};
const review = async () => {
  await write();
  await click(host.querySelector('input[name="mood"]')!);
  await click(button("Continue"));
};

describe("redesigned public pages", () => {
  it("keeps the privacy card unchanged when the cursor moves over it", async () => {
    await render("/privacy");
    const card = host.querySelector<HTMLElement>(".card-spotlight")!;
    const initialStyle = card.getAttribute("style");
    await act(async () => {
      card.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 100, clientY: 150 }));
    });
    expect(card.getAttribute("style")).toBe(initialStyle);
    expect(card.style.getPropertyValue("--mouse-x")).toBe("");
    expect(card.style.getPropertyValue("--mouse-y")).toBe("");
    expect(host.querySelector("h1")?.textContent).toBe("Privacy");
    expect(host.querySelector('a[href="/wall"]')).not.toBeNull();
  });
  it.each(["/", "/wall", "/submit", "/prayer/prayer", "/secretlang", "/secretlang/dashboard", "/secretlang/tools", "/about", "/privacy", "/acceptable-use", "/missing-page"])(
    "shows a single JPCS DLSL copyright at the bottom of %s",
    async (route) => {
      vi.mocked(api.listPrayers).mockResolvedValue({ data: [], meta: { hasMore: false, nextCursor: null } });
      vi.mocked(api.getPrayer).mockResolvedValue({ data: prayer });
      vi.mocked(api.adminTaxonomy).mockResolvedValue({ data: { categories: [category], moods: [mood] } });
      await render(route);
      const footer = host.querySelector(".site-footer")!;
      expect(footer.querySelector(".copyright-notice")?.textContent).toBe(`© ${new Date().getFullYear()} JPCS DLSL. All rights reserved.`);
      expect(host.querySelectorAll(".copyright-notice")).toHaveLength(1);
      expect(footer.lastElementChild?.classList.contains("copyright-notice")).toBe(true);
    },
  );
  it("has no administrator links in the public navigation or footer", async () => {
    await render("/");
    expect(host.querySelector('a[href^="/secretlang"]')).toBeNull();
    expect([...host.querySelectorAll("nav a")].some((item) => item.textContent === "Admin")).toBe(false);
  });
  it("retires the old admin website route", async () => {
    await render("/admin");
    expect(host.querySelector('input[autocomplete="current-password"]')).toBeNull();
    expect(host.querySelector("h1")?.textContent).toBe("This page drifted away.");
  });
  it("signs in through secretlang with a username and an unmodified password", async () => {
    vi.mocked(api.adminLogin).mockResolvedValue({ data: { csrfToken: "test-only" } });
    await render("/secretlang");
    expect(host.querySelector('input[autocomplete="username"]')).not.toBeNull();
    const password = host.querySelector<HTMLInputElement>('input[name="password"]')!;
    expect(password.type).toBe("password");
    await fill(host.querySelector<HTMLInputElement>('input[name="username"]')!, "Keeper.Test");
    await fill(password, " test-only password with spaces! ");
    await click(button("Open dashboard"));
    expect(api.adminLogin).toHaveBeenCalledWith("keeper.test", " test-only password with spaces! ");
    expect(host.querySelector("h1")?.textContent).toBe("Keepers’ dashboard");
  });
  it("shows failed login errors without exposing a password", async () => {
    vi.mocked(api.adminLogin).mockRejectedValue(new Error("The username or password is incorrect."));
    await render("/secretlang");
    await fill(host.querySelector<HTMLInputElement>('input[name="username"]')!, "test.keeper");
    await fill(host.querySelector<HTMLInputElement>('input[name="password"]')!, "a test-only password");
    await click(button("Open dashboard"));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("The username or password is incorrect.");
    expect(host.querySelector<HTMLInputElement>('input[name="password"]')!.type).toBe("password");
    expect(host.textContent).not.toContain("a test-only password");
    expect(button("Open dashboard").disabled).toBe(false);
  });
  it("redirects a signed-out dashboard visitor to secretlang login", async () => {
    vi.mocked(api.adminSession).mockRejectedValue(new Error("Authentication required."));
    await render("/secretlang/dashboard");
    expect(host.querySelector('input[name="username"]')).not.toBeNull();
    expect(api.adminPrayers).not.toHaveBeenCalled();
  });
  it("opens and closes navigation with Escape and returns focus to Menu", async () => {
    await render("/");
    const menu = button("Menu☰");
    await click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    await act(async () =>
      menu.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(menu);
  });
  it("does not advance an empty prayer or skip forward using the progress buttons", async () => {
    await render("/submit");
    await click(button("Continue"));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Choose a category",
    );
    expect(api.submitPrayer).not.toHaveBeenCalled();
    expect(
      [
        ...host.querySelectorAll<HTMLButtonElement>(".step-indicators button"),
      ].every((item) => item.disabled),
    ).toBe(true);
  });
  it("keeps the draft when going back and sends only after the final review", async () => {
    await render("/submit");
    await write();
    await click(button("Back"));
    expect(host.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe(
      "A hopeful intention.",
    );
    await click(button("Continue"));
    await click(host.querySelector('input[name="mood"]')!);
    await click(button("Continue"));
    expect(host.querySelector(".review-letter")?.textContent).toContain(
      "Anonymous",
    );
    expect(api.submitPrayer).not.toHaveBeenCalled();
    await click(button("Send for review"));
    expect(api.submitPrayer).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "A hopeful intention.",
        isAnonymous: true,
        displayName: "",
      }),
    );
    expect(host.textContent).toContain("Your prayer has been received.");
    await click(button("Send another prayer"));
    expect(host.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("");
  });
  it("requires a display name when anonymity is disabled", async () => {
    await render("/submit");
    await write();
    await click(host.querySelector('input[name="mood"]')!);
    await click(host.querySelector('input[type="checkbox"]')!);
    await click(button("Continue"));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "display name",
    );
    await fill(
      host.querySelector<HTMLInputElement>('input[autocomplete="nickname"]')!,
      "Sample name",
    );
    await click(button("Continue"));
    expect(host.querySelector(".review-letter")?.textContent).toContain(
      "Sample name",
    );
  });
  it("keeps the review and draft after a failed send", async () => {
    vi.mocked(api.submitPrayer).mockRejectedValue(
      new Error("Try again later."),
    );
    await render("/submit");
    await review();
    await click(button("Send for review"));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "Try again later.",
    );
    expect(host.querySelector(".review-letter")?.textContent).toContain(
      "A hopeful intention.",
    );
    expect(button("Send for review").disabled).toBe(false);
  });
  it("disables sending and backwards navigation during an in-flight send", async () => {
    let complete!: () => void;
    vi.mocked(api.submitPrayer).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = () => resolve({ data: { message: "Received." } });
        }),
    );
    await render("/submit");
    await review();
    await click(button("Send for review"));
    expect(button("Sending…").disabled).toBe(true);
    expect(button("Back").disabled).toBe(true);
    expect(
      [
        ...host.querySelectorAll<HTMLButtonElement>(".step-indicators button"),
      ].every((item) => item.disabled),
    ).toBe(true);
    await act(async () => complete());
    expect(api.submitPrayer).toHaveBeenCalledTimes(1);
  });
  it("shows a load error without letting a prayer be submitted", async () => {
    vi.mocked(api.getTaxonomy).mockRejectedValue(new Error("Unavailable"));
    await render("/submit");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t load",
    );
    expect(button("Continue").disabled).toBe(true);
  });
  it("offers a true not-found page instead of silently rendering home", async () => {
    await render("/unknown");
    expect(host.querySelector("h1")?.textContent).toBe(
      "This page drifted away.",
    );
  });
  it("reports failures without losing the report reason", async () => {
    vi.mocked(api.getPrayer).mockResolvedValue({ data: prayer });
    vi.mocked(api.reportPrayer).mockRejectedValue(
      new Error("Report unavailable"),
    );
    await render("/prayer/prayer");
    await click(button("Report this prayer"));
    await fill(host.querySelector("textarea")!, "Test-only reason");
    await click(button("Send report"));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "Report unavailable",
    );
    expect(host.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe(
      "Test-only reason",
    );
  });
});

describe("keeper dialogs and counts", () => {
  it("keeps keyboard focus inside the edit dialog", async () => {
    await render("/secretlang/dashboard");
    await click(button("Edit"));
    const dialog = document.querySelector('[role="dialog"]')!;
    const first = dialog.querySelector<HTMLButtonElement>("button")!;
    const last = button("Save changes", dialog);
    last.focus();
    await act(async () =>
      last.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(document.activeElement).toBe(first);
    await act(async () =>
      first.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(document.activeElement).toBe(last);
  });
  it("uses a resolution dialog instead of a browser prompt", async () => {
    vi.mocked(api.adminReports).mockResolvedValue({
      data: [
        {
          prayer_id: "prayer",
          title: "Test case",
          message: "Test report message.",
          report_count: 2,
        },
      ],
    });
    vi.mocked(api.resolveReport).mockResolvedValue({});
    await render("/secretlang/dashboard");
    await click(button("Dismiss"));
    const dialog = document.querySelector('[role="dialog"]')!;
    await fill(dialog.querySelector("textarea")!, "Reviewed in test only.");
    await click(button("Dismiss report", dialog));
    expect(api.resolveReport).toHaveBeenCalledWith(
      "prayer",
      "dismiss",
      "Reviewed in test only.",
    );
  });
  it("edits in a dialog and retains the concurrency version", async () => {
    vi.mocked(api.editPrayer).mockResolvedValue({});
    await render("/secretlang/dashboard");
    await click(button("Edit"));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(document.querySelector<HTMLElement>(".site-shell")?.inert).toBe(
      true,
    );
    await fill(dialog.querySelector("textarea")!, "Updated test message.");
    await click(button("Save changes", dialog));
    expect(api.editPrayer).toHaveBeenCalledWith(
      "prayer",
      { title: "A test intention", message: "Updated test message." },
      7,
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector<HTMLElement>(".site-shell")?.inert).toBe(
      false,
    );
  });
  it("keeps failed edits in the dialog and allows safe cancellation", async () => {
    vi.mocked(api.editPrayer).mockRejectedValue(
      new Error("This prayer changed. Refresh first."),
    );
    await render("/secretlang/dashboard");
    await click(button("Edit"));
    const dialog = document.querySelector('[role="dialog"]')!;
    await click(button("Save changes", dialog));
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
      "Refresh first",
    );
    await click(button("Cancel", dialog));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("does not purge until the explicit permanent-delete confirmation", async () => {
    vi.mocked(api.adminPrayers).mockResolvedValue({
      data: [{ ...prayer, deletedAt: "2026-10-03T00:00:00Z" }],
    });
    vi.mocked(api.purgePrayer).mockResolvedValue({});
    await render("/secretlang/dashboard");
    await click(button("Purge"));
    expect(api.purgePrayer).not.toHaveBeenCalled();
    await click(button("Cancel", document.querySelector('[role="dialog"]')!));
    expect(api.purgePrayer).not.toHaveBeenCalled();
    await click(button("Purge"));
    await click(
      button("Permanently delete", document.querySelector('[role="dialog"]')!),
    );
    expect(api.purgePrayer).toHaveBeenCalledWith("prayer");
  });
  it("uses totals rather than the current filtered page for the overview", async () => {
    await render("/secretlang/dashboard");
    const cards = host.querySelectorAll(".stat-card");
    expect(cards[0].querySelector(".sr-only")?.textContent).toBe("12");
    expect(cards[1].querySelector(".sr-only")?.textContent).toBe("8");
  });
  it("closes dialogs with Escape and returns focus to the opener", async () => {
    await render("/secretlang/dashboard");
    const edit = button("Edit");
    edit.focus();
    await click(edit);
    await act(async () =>
      document
        .querySelector('[role="dialog"]')!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(edit);
  });
});
