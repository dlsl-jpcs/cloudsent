import { useRef, useState } from 'react';
import type { TaxonomyItem } from '@cloudsent/contracts';
import AnimatedContent from './AnimatedContent';
import GlideSelect from './GlideSelect';
import { palette } from '../palette';

interface WallFiltersProps {
  params: URLSearchParams;
  categories: TaxonomyItem[];
  moods: TaxonomyItem[];
  colors: string[];
  onChange: (key: string, value: string) => void;
  onClear: () => void;
}

const filterKeys = ['q', 'category', 'mood', 'color', 'from', 'to', 'displayName'];

export default function WallFilters({ params, categories, moods, colors, onChange, onClear }: WallFiltersProps) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const activeCount = filterKeys.filter((key) => params.get(key)?.trim()).length;

  return <section className="wall-search" aria-label="Prayer wall search and filters">
    <div className="wall-search-toolbar">
      <button ref={toggleRef} type="button" className="wall-search-toggle" aria-expanded={open}
        aria-controls="wall-search-panel" onClick={() => setOpen((current) => !current)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" />
        </svg>
        <span>Search &amp; filters</span>
        {activeCount > 0 && <span className="wall-search-count" aria-label={`${activeCount} active filters`}>{activeCount}</span>}
        <svg className="wall-search-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>
      {activeCount > 0 ? <button type="button" className="wall-search-clear" onClick={onClear}>Clear filters</button>
        : <span className="wall-search-hint">Looking for a particular prayer?</span>}
    </div>
    <AnimatedContent open={open} id="wall-search-panel">
      <div className="wall-search-panel" onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
          toggleRef.current?.focus();
        }
      }}>
        <div className="wall-search-panel-heading"><h2>Find a prayer</h2><p>Choose what you’d like to find. The wall updates as you go.</p></div>
        <div className="wall-search-fields">
          <label className="wall-search-query">Search title or prayer
            <input type="search" value={params.get('q') || ''} onChange={(e) => onChange('q', e.target.value)} placeholder="A word, a hope, an intention…" />
          </label>
          <label>Category<GlideSelect ariaLabel="Category" value={params.get('category') || ''} onChange={(value) => onChange('category', value)}
            options={[{ value: '', label: 'All categories' }, ...categories.map((item) => ({ value: item.id, label: item.name }))]} /></label>
          <label>Mood<GlideSelect ariaLabel="Mood" value={params.get('mood') || ''} onChange={(value) => onChange('mood', value)}
            options={[{ value: '', label: 'All moods' }, ...moods.map((item) => ({ value: item.id, label: item.name }))]} /></label>
          <label>Color<GlideSelect ariaLabel="Color" value={params.get('color') || ''} onChange={(value) => onChange('color', value)}
            options={[{ value: '', label: 'All colors' }, ...colors.map((color) => ({ value: color, label: color.charAt(0).toUpperCase() + color.slice(1), color: palette[color] }))]} /></label>
          <label>From date<input type="date" value={params.get('from') || ''} onChange={(e) => onChange('from', e.target.value)} /></label>
          <label>To date<input type="date" value={params.get('to') || ''} onChange={(e) => onChange('to', e.target.value)} /></label>
          <label className="wall-search-name">Display name<input value={params.get('displayName') || ''} onChange={(e) => onChange('displayName', e.target.value)} placeholder="Name on the prayer" /></label>
        </div>
      </div>
    </AnimatedContent>
  </section>;
}
