// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WallFilters from './WallFilters';

let host: HTMLDivElement;
let root: Root;
const onChange = vi.fn();
const onClear = vi.fn();

function Harness({ initial = '' }: { initial?: string }) {
  const [params, setParams] = useState(new URLSearchParams(initial));
  return <WallFilters params={params} categories={[{ id: 'thanks', name: 'Thanksgiving', active: true, position: 0 }]}
    moods={[{ id: 'hope', name: 'Hopeful', active: true, position: 0 }]} colors={['sky', 'gold']}
    onChange={(key, value) => {
      onChange(key, value);
      const next = new URLSearchParams(params);
      if (value) next.set(key, value); else next.delete(key);
      setParams(next);
    }} onClear={() => { onClear(); setParams(new URLSearchParams()); }} />;
}

const toggle = () => host.querySelector<HTMLButtonElement>('[aria-controls="wall-search-panel"]')!;
const panel = () => host.querySelector<HTMLDivElement>('#wall-search-panel')!;
const click = async (element: HTMLElement) => { await act(async () => element.click()); };

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // Instant transitions exercise the real GSAP component and reduced-motion path.
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('optional prayer wall search', () => {
  it('starts hidden and removes controls from interaction', async () => {
    await act(async () => root.render(<Harness />));
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(panel().hidden).toBe(true);
    expect(panel().hasAttribute('inert')).toBe(true);
    expect(panel().getAttribute('aria-hidden')).toBe('true');
  });

  it('opens and closes with selected filters preserved', async () => {
    await act(async () => root.render(<Harness initial="q=hope&color=sky" />));
    await click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(panel().hidden).toBe(false);
    expect(panel().hasAttribute('inert')).toBe(false);
    expect(host.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('hope');
    await click(toggle());
    expect(panel().hidden).toBe(true);
    await click(toggle());
    expect(host.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('hope');
    expect(host.querySelector('[role="combobox"][aria-label="Color"]')?.textContent).toBe('Sky');
  });

  it('shows active filters from a shared URL and clears them while collapsed', async () => {
    await act(async () => root.render(<Harness initial="q=hope&category=thanks&cursor=ignored&unrelated=value" />));
    expect(panel().hidden).toBe(true);
    expect(host.querySelector('.wall-search-count')?.textContent).toBe('2');
    await click(host.querySelector<HTMLButtonElement>('.wall-search-clear')!);
    expect(onClear).toHaveBeenCalledOnce();
    expect(host.querySelector('.wall-search-count')).toBeNull();
    expect(host.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('');
    expect(panel().hidden).toBe(true);
  });

  it('closes on Escape and returns focus to the toggle', async () => {
    await act(async () => root.render(<Harness />));
    await click(toggle());
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.focus();
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(panel().hidden).toBe(true);
    expect(document.activeElement).toBe(toggle());
  });

  it('keeps date, name, and taxonomy controls connected to their filters', async () => {
    await act(async () => root.render(<Harness />));
    await click(toggle());
    await click(host.querySelector<HTMLButtonElement>('[role="combobox"][aria-label="Category"]')!);
    await click([...document.querySelectorAll<HTMLElement>('[role="option"]')].find((option) => option.textContent === 'Thanksgiving')!);
    expect(onChange).toHaveBeenLastCalledWith('category', 'thanks');
    const labels = [...host.querySelectorAll('.wall-search-fields label')].map((label) => label.childNodes[0].textContent?.trim());
    expect(labels).toEqual(['Search title or prayer', 'Category', 'Mood', 'Color', 'From date', 'To date', 'Display name']);
    expect(host.querySelectorAll('input[type="date"]')).toHaveLength(2);
  });

  it('closes the dropdown first on Escape, then the search panel', async () => {
    await act(async () => root.render(<Harness />));
    await click(toggle());
    const category = host.querySelector<HTMLButtonElement>('[aria-label="Category"]')!;
    await click(category);
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    await act(async () => category.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(panel().hidden).toBe(false);
    await act(async () => category.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(panel().hidden).toBe(true);
  });

  it('removes a portal dropdown when its search panel is hidden', async () => {
    await act(async () => root.render(<Harness />));
    await click(toggle());
    await click(host.querySelector<HTMLButtonElement>('[aria-label="Category"]')!);
    await click(toggle());
    expect(panel().hidden).toBe(true);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });
});
