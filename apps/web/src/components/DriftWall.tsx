import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import './DriftWall.css';

export interface DriftWallItem {
  id?: string;
  content?: ReactNode;
  title?: string | null;
  message?: string | null;
  meta?: string | null;
  image?: string;
  href?: string;
  color?: string;
}

interface DriftWallProps {
  items?: DriftWallItem[];
  columns?: number;
  tileWidth?: number;
  tileHeight?: number;
  gap?: number;
  radius?: number;
  tilt?: number;
  turn?: number;
  roll?: number;
  perspective?: number;
  depth?: number;
  scale?: number;
  speed?: number;
  direction?: 'up' | 'down';
  variance?: number;
  parallax?: number;
  pauseOnHover?: boolean;
  lift?: number;
  fade?: number;
  dim?: number;
  grayscale?: boolean;
  overlayColor?: string;
  className?: string;
  style?: CSSProperties;
  interactive?: boolean;
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const columnFactor = (index: number, variance: number) => 1 + variance * ((((index * 0.6180339887 + 0.35) % 1) * 2) - 1);

export default function DriftWall({
  items = [], columns = 5, tileWidth = 220, tileHeight = 178, gap = 18, radius = 2, tilt = 10, turn = -8,
  roll = 0, perspective = 1200, depth = 100, scale = 1.12, speed = 24, direction = 'up', variance = 0.35,
  parallax = 0.45, pauseOnHover = false, lift = 34, fade = 0.35, dim = 0.92, grayscale = false,
  overlayColor = '#6f83a0', className = '', style, interactive = true,
}: DriftWallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const offsetsRef = useRef<number[]>([]);
  const velocitiesRef = useRef<number[]>([]);
  const hoveredColRef = useRef(-1);
  const wallHoveredRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const pointerDampedRef = useRef({ x: 0, y: 0 });
  const lastTsRef = useRef<number | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  const columnItems = useMemo(() => {
    const safeColumns = Math.max(1, Math.floor(columns));
    const result = Array.from({ length: safeColumns }, () => [] as DriftWallItem[]);
    items.forEach((item, index) => result[index % safeColumns].push(item));
    // Sparse walls still fill every requested lane, using only existing prayers.
    return result.map((column, index) => column.length || !items.length ? column : [items[index % items.length]]);
  }, [columns, items]);

  const columnMeta = useMemo(() => {
    const unit = tileHeight + gap;
    return columnItems.map((column) => {
      const copyHeight = Math.max(unit, column.length * unit);
      return { copyHeight, copies: Math.max(2, Math.ceil((containerHeight * 1.6) / copyHeight) + 1) };
    });
  }, [columnItems, containerHeight, gap, tileHeight]);

  useLayoutEffect(() => {
    if (!containerRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setContainerHeight(entry.contentRect.height || 600));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const baseVelocities = useMemo(() => {
    const directionSign = direction === 'up' ? 1 : -1;
    return columnItems.map((_, index) => speed * columnFactor(index, variance) * directionSign * (index % 2 === 0 ? 1 : -1));
  }, [columnItems, direction, speed, variance]);

  useLayoutEffect(() => {
    offsetsRef.current = columnMeta.map((meta, index) => meta.copyHeight * ((index * 0.37) % 1));
    velocitiesRef.current = columnItems.map(() => 0);
    trackRefs.current.forEach((track, index) => {
      if (track) track.style.transform = `translate3d(0, ${-offsetsRef.current[index]}px, 0)`;
    });
  }, [columnItems, columnMeta]);

  const applyPlaneTransform = useCallback((pointerX: number, pointerY: number) => {
    if (!planeRef.current) return;
    planeRef.current.style.transform = `translate(-50%, -50%) scale(${scale}) rotateX(${tilt + pointerY}deg) rotateY(${turn + pointerX}deg) rotateZ(${roll}deg) translateZ(${-depth}px)`;
  }, [depth, roll, scale, tilt, turn]);

  useLayoutEffect(() => applyPlaneTransform(0, 0), [applyPlaneTransform]);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (lastTsRef.current === null) lastTsRef.current = timestamp;
      const delta = Math.min(0.05, Math.max(0, timestamp - lastTsRef.current) / 1000);
      lastTsRef.current = timestamp;
      const maxTilt = parallax * 8;
      const targetX = pointerRef.current.x * maxTilt;
      const targetY = -pointerRef.current.y * maxTilt;
      const damping = 1 - Math.exp(-delta / 0.12);
      pointerDampedRef.current.x += (targetX - pointerDampedRef.current.x) * damping;
      pointerDampedRef.current.y += (targetY - pointerDampedRef.current.y) * damping;
      applyPlaneTransform(pointerDampedRef.current.x, pointerDampedRef.current.y);

      for (let column = 0; column < trackRefs.current.length; column += 1) {
        const meta = columnMeta[column];
        const track = trackRefs.current[column];
        if (!meta || !track) continue;
        if (!reduced) {
          const paused = wallHoveredRef.current && pauseOnHover;
          const target = baseVelocities[column] * (paused || hoveredColRef.current === column ? 0 : 1);
          const easing = 1 - Math.exp(-delta / (target === 0 ? 0.16 : 0.28));
          velocitiesRef.current[column] += (target - velocitiesRef.current[column]) * easing;
          offsetsRef.current[column] = ((offsetsRef.current[column] + velocitiesRef.current[column] * delta) % meta.copyHeight + meta.copyHeight) % meta.copyHeight;
        }
        track.style.transform = `translate3d(0, ${-(offsetsRef.current[column] ?? 0)}px, 0)`;
      }
      // A reduced-motion wall needs one settled frame, not a permanent RAF loop.
      rafRef.current = reduced ? null : requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [applyPlaneTransform, baseVelocities, columnMeta, pauseOnHover, parallax, reduced]);

  const activate = useCallback((id: string, column: number) => {
    activeIdRef.current = id;
    hoveredColRef.current = column;
    setActiveId(id);
  }, []);
  const release = useCallback(() => {
    activeIdRef.current = null;
    hoveredColRef.current = -1;
    setActiveId(null);
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (parallax > 0 && !reduced) pointerRef.current = { x: (event.clientX - rect.left) / rect.width - 0.5, y: (event.clientY - rect.top) / rect.height - 0.5 };
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const tile = hit?.closest?.('[data-tile-id]') as HTMLElement | null;
    if (!tile) {
      if (activeIdRef.current !== null) release();
      return;
    }
    const id = tile.dataset.tileId;
    if (id && id !== activeIdRef.current) activate(id, Number(tile.dataset.col));
  }, [activate, parallax, reduced, release]);

  const cssVars = useMemo(() => ({
    '--dw-tile-w': `${tileWidth}px`, '--dw-tile-h': `${tileHeight}px`, '--dw-gap': `${gap}px`, '--dw-radius': `${radius}px`,
    '--dw-perspective': `${perspective}px`, '--dw-lift': `${lift}px`, '--dw-dim': dim, '--dw-gray': grayscale ? 1 : 0,
    '--dw-overlay': overlayColor, '--dw-edge': `${Math.max(0, (1 - fade) * 100)}%`, ...style,
  } as CSSProperties), [dim, fade, gap, grayscale, lift, overlayColor, perspective, radius, style, tileHeight, tileWidth]);

  const renderTile = (item: DriftWallItem, id: string, column: number, clone: boolean) => {
    const message = item.message || item.title || 'A quiet prayer';
    const content = <div className="drift-wall__inner" style={item.color ? { backgroundColor: item.color } : undefined}>
      {item.content ?? <>
        {item.image && <img src={item.image} alt="" loading="lazy" decoding="async" draggable={false} />}
        <span className="drift-wall__overlay" aria-hidden="true" />
        <span className="drift-wall__copy"><strong>{item.title || 'Untitled prayer'}</strong><span>{message}</span><small>{item.meta || 'Anonymous'}</small></span>
      </>}
    </div>;
    const common = { className: `drift-wall__tile${activeId === id ? ' is-active' : ''}`, 'data-tile-id': id, 'data-item-id': item.id, 'data-col': column, onFocus: interactive ? () => activate(id, column) : undefined, onBlur: interactive ? release : undefined };
    if (clone) return <div key={id} {...common} aria-hidden="true">{content}</div>;
    if (item.href && interactive) {
      const external = /^https?:\/\//i.test(item.href);
      return <a key={id} href={item.href} {...common} {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>{content}</a>;
    }
    return <div key={id} tabIndex={interactive ? 0 : undefined} role="group" aria-label={item.title || 'Prayer'} {...common}>{content}</div>;
  };

  const rootClass = ['drift-wall', reduced ? 'drift-wall--reduced' : '', className].filter(Boolean).join(' ');
  return <div ref={containerRef} className={rootClass} style={cssVars} onPointerMove={interactive ? handlePointerMove : undefined} onPointerEnter={interactive ? () => { wallHoveredRef.current = true; } : undefined} onPointerLeave={interactive ? () => { wallHoveredRef.current = false; pointerRef.current = { x: 0, y: 0 }; release(); } : undefined} role="group" aria-label="Drifting prayer wall">
    <div ref={planeRef} className="drift-wall__plane">
      {columnItems.map((column, columnIndex) => <div className="drift-wall__col" key={`column-${columnIndex}`}><div className="drift-wall__track" ref={(element) => { trackRefs.current[columnIndex] = element; }}>{Array.from({ length: columnMeta[columnIndex].copies }).flatMap((_, copyIndex) => column.map((item, itemIndex) => renderTile(item, `${columnIndex}-${copyIndex}-${item.id ?? itemIndex}`, columnIndex, copyIndex > 0 || columnIndex >= items.length)))}</div></div>)}
    </div>
  </div>;
}
