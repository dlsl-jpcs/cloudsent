// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GlideSelect, { type GlideSelectOption } from './GlideSelect';

let host: HTMLDivElement;
let root: Root;
const onChange = vi.fn();
const options: GlideSelectOption[] = [
  { value: '', label: 'All colors' }, { value: 'sky', label: 'Sky', color: '#DCEEFF' },
  { value: 'sage', label: 'Sage' }, { value: 'gold', label: 'Gold', disabled: true },
  { value: 'rose', label: 'Rose' },
];

function Harness() {
  const [value, setValue] = useState('');
  return <form onSubmit={(event) => { event.preventDefault(); throw new Error('Dropdown submitted the form'); }}>
    <GlideSelect options={options} value={value} ariaLabel="Colors" onChange={(next) => { onChange(next); setValue(next); }} />
    <button type="button">Outside</button>
  </form>;
}

const trigger = () => host.querySelector<HTMLButtonElement>('[role="combobox"]')!;
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const key = async (value: string) => {
  await act(async () => trigger().dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })));
};
const rows = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  onChange.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('shared Glide Select dropdown', () => {
  it('opens a portal list with the selected option and chooses an empty value too', async () => {
    await act(async () => root.render(<Harness />));
    await click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
    await click(rows()[1]);
    expect(onChange).toHaveBeenLastCalledWith('sky');
    expect(trigger().textContent).toBe('Sky');
    expect(document.activeElement).toBe(trigger());
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    await click(trigger());
    await click(rows()[0]);
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(trigger().textContent).toBe('All colors');
  });

  it('supports arrows, Home, End and Enter while skipping disabled options', async () => {
    await act(async () => root.render(<Harness />));
    await key('ArrowDown');
    await key('End');
    expect(trigger().getAttribute('aria-activedescendant')).toBe(rows()[4].id);
    await key('ArrowUp');
    expect(trigger().getAttribute('aria-activedescendant')).toBe(rows()[2].id);
    await key('Home');
    expect(trigger().getAttribute('aria-activedescendant')).toBe(rows()[0].id);
    await key('ArrowDown');
    await key('Enter');
    expect(onChange).toHaveBeenCalledWith('sky');
  });

  it('supports letter search and Space selection', async () => {
    await act(async () => root.render(<Harness />));
    await key('r');
    expect(trigger().getAttribute('aria-activedescendant')).toBe(rows()[4].id);
    await key(' ');
    expect(onChange).toHaveBeenCalledWith('rose');
  });

  it('closes on Escape and Tab without changing the value', async () => {
    await act(async () => root.render(<Harness />));
    await key('Enter');
    await key('Escape');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    await click(trigger());
    await key('Tab');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes on outside pointer interaction or focus leaving', async () => {
    await act(async () => root.render(<Harness />));
    await click(trigger());
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    await click(trigger());
    await act(async () => host.querySelector<HTMLButtonElement>('form > button')!.focus());
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('ignores disabled options and handles disabled or empty controls', async () => {
    await act(async () => root.render(<Harness />));
    await click(trigger());
    await click(rows()[3]);
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    await act(async () => root.render(<GlideSelect options={options} value="" ariaLabel="Colors" disabled onChange={onChange} />));
    expect(trigger().disabled).toBe(true);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    await act(async () => root.render(<GlideSelect options={[]} value="" ariaLabel="Colors" onChange={onChange} />));
    expect(trigger().disabled).toBe(true);
  });

  it('uses externally updated values without triggering onChange', async () => {
    await act(async () => root.render(<GlideSelect options={options} value="sky" ariaLabel="Colors" onChange={onChange} />));
    expect(trigger().textContent).toBe('Sky');
    await act(async () => root.render(<GlideSelect options={options} value="rose" ariaLabel="Colors" onChange={onChange} />));
    expect(trigger().textContent).toBe('Rose');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('flips above the trigger near the bottom of the viewport', async () => {
    await act(async () => root.render(<Harness />));
    vi.spyOn(trigger(), 'getBoundingClientRect').mockReturnValue({ left: 900, right: 1080, top: 700, bottom: 746, width: 180, height: 46, x: 900, y: 700, toJSON: () => ({}) });
    await click(trigger());
    const menu = document.querySelector<HTMLElement>('.glide-select__menu')!;
    expect(menu.dataset.side).toBe('top');
    expect(parseFloat(menu.style.left) + parseFloat(menu.style.width)).toBeLessThanOrEqual(window.innerWidth - 8);
  });
});
