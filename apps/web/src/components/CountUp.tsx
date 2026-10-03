// Adapted from React Bits CountUp; uses the existing GSAP runtime and an exact accessible value.
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export default function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (
      !ref.current ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const counter = { number: from };
    const tween = gsap.to(counter, {
      number: value,
      duration: 0.6,
      ease: "power2.out",
      onUpdate: () => {
        if (ref.current)
          ref.current.textContent = Math.round(counter.number).toLocaleString();
      },
    });
    return () => {
      tween.kill();
    };
  }, [value]);
  return (
    <>
      <span ref={ref} aria-hidden="true">
        {value.toLocaleString()}
      </span>
      <span className="sr-only">{value.toLocaleString()}</span>
    </>
  );
}
