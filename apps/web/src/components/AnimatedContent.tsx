import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { gsap } from 'gsap';

// Adapted from React Bits Animated Content (David Haz).
// https://reactbits.dev/animations/animated-content
// See THIRD_PARTY_NOTICES.md. This version responds to opening/closing,
// rather than scrolling, and respects reduced-motion preferences.
interface AnimatedContentProps {
  open: boolean;
  id: string;
  children: ReactNode;
  distance?: number;
  duration?: number;
  ease?: string;
}

export default function AnimatedContent({
  open, id, children, distance = 8, duration = 0.32, ease = 'power3.out',
}: AnimatedContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(!open);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Don't briefly expose a panel that starts closed (including StrictMode).
    if (!open && element.hidden) return;
    const initialHeight = element.hidden ? 0 : element.getBoundingClientRect().height;
    const initialOpacity = element.hidden ? 0 : Number(gsap.getProperty(element, 'opacity'));
    element.hidden = false;
    if (open) setHidden(false);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animation = gsap.fromTo(element,
      { height: initialHeight, opacity: initialOpacity, overflow: 'hidden', y: initialHeight ? 0 : -distance },
      {
        height: open ? 'auto' : 0, opacity: open ? 1 : 0, y: open ? 0 : -distance,
        duration: media.matches ? 0 : duration, ease,
        onComplete: () => {
          if (open) gsap.set(element, { clearProps: 'height,overflow,transform,opacity' });
          else setHidden(true);
        },
      },
    );
    const updateMotion = () => { if (media.matches) animation.progress(1); };
    media.addEventListener('change', updateMotion);
    return () => {
      animation.kill();
      media.removeEventListener('change', updateMotion);
    };
  }, [open, distance, duration, ease]);

  return <div ref={ref} id={id} hidden={hidden} inert={!open} aria-hidden={!open}>{children}</div>;
}
