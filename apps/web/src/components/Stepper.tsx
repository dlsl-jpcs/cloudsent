// Adapted from React Bits Stepper; controlled steps retain drafts and prevent skipping validation.
// GSAP replaces Motion to share CloudSent's existing animation runtime.
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";

export default function Stepper({
  step,
  labels,
  onBack,
  children,
  disabled = false,
}: {
  step: number;
  labels: string[];
  onBack: (step: number) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  const previous = useRef(step);
  useLayoutEffect(() => {
    if (previous.current === step) return;
    const direction = step > previous.current ? 1 : -1;
    previous.current = step;
    content.current?.focus({ preventScroll: true });
    content.current?.parentElement?.scrollIntoView?.({
      block: "start",
      behavior: "instant",
    });
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.fromTo(
      content.current,
      { x: direction * 16, opacity: 0.4 },
      {
        x: 0,
        opacity: 1,
        duration: 0.3,
        clearProps: "transform,opacity",
        ease: "power2.out",
      },
    );
    return () => {
      tween.kill();
    };
  }, [step]);
  return (
    <div className="stepper">
      <ol className="step-indicators" aria-label="Prayer submission progress">
        {labels.map((label, index) => (
          <li
            key={label}
            className={index <= step ? "step-reached" : ""}
            aria-current={index === step ? "step" : undefined}
          >
            <button
              type="button"
              disabled={disabled || index >= step}
              onClick={() => onBack(index)}
              aria-label={`${label}${index < step ? ", go back" : ""}`}
            >
              <span className="step-circle" aria-hidden="true">
                {index < step ? "✓" : index + 1}
              </span>
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="step-content" ref={content} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
