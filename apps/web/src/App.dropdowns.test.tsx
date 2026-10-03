// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { adminPrayers, adminReports, adminSession, adminStats, adminTaxonomy } from './api';

vi.mock('./api');
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(adminSession).mockResolvedValue({ data: { csrfToken: 'test-only' } });
  vi.mocked(adminPrayers).mockResolvedValue({ data: [] });
  vi.mocked(adminReports).mockResolvedValue({ data: [] });
  vi.mocked(adminStats).mockResolvedValue({ data: { flags: [] } });
  vi.mocked(adminTaxonomy).mockResolvedValue({ data: {
    categories: [{ id: 'category', name: 'Thanksgiving', active: true, position: 0 }],
    moods: [{ id: 'mood', name: 'Hopeful', active: true, position: 0 }],
  } });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
const click = async (element: HTMLElement) => { await act(async () => element.click()); };

describe('dropdown design across admin pages', () => {
  it('uses Glide Select for status and reloads the matching records', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/secretlang/dashboard']}><App /></MemoryRouter>));
    const dropdown = host.querySelector<HTMLButtonElement>('[role="combobox"][aria-label="Filter prayer status"]')!;
    expect(dropdown.className).toContain('glide-select__trigger');
    expect(host.querySelector('select')).toBeNull();
    await click(dropdown);
    await click([...document.querySelectorAll<HTMLElement>('[role="option"]')].find((option) => option.textContent === 'Pending')!);
    expect(adminPrayers).toHaveBeenLastCalledWith('?status=pending');
    expect(dropdown.textContent).toBe('Pending');
  });

  it('uses Glide Select in settings and switches between category and mood entries', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/secretlang/tools']}><App /></MemoryRouter>));
    const dropdown = host.querySelector<HTMLButtonElement>('[role="combobox"][aria-label="Taxonomy type"]')!;
    expect(dropdown.className).toContain('glide-select__trigger');
    expect(host.querySelector('select')).toBeNull();
    expect(host.querySelector('input[aria-label="Name for Thanksgiving"]')).not.toBeNull();
    await click(dropdown);
    await click([...document.querySelectorAll<HTMLElement>('[role="option"]')].find((option) => option.textContent === 'Mood')!);
    expect(host.querySelector('input[aria-label="Name for Hopeful"]')).not.toBeNull();
    expect(host.querySelector('input[aria-label="Name for Thanksgiving"]')).toBeNull();
  });
});
