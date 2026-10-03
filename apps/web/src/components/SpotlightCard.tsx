// Adapted from React Bits SpotlightCard. See THIRD_PARTY_NOTICES.md.
import { useRef, type CSSProperties, type PropsWithChildren } from "react";

export default function SpotlightCard({
  children,
  className = "",
  style,
}: PropsWithChildren<{ className?: string; style?: CSSProperties }>) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`card-spotlight ${className}`}
      style={style}
      onPointerMove={(event) => {
        if (event.pointerType === "touch" || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        ref.current.style.setProperty(
          "--mouse-x",
          `${event.clientX - rect.left}px`,
        );
        ref.current.style.setProperty(
          "--mouse-y",
          `${event.clientY - rect.top}px`,
        );
      }}
    >
      {children}
    </div>
  );
}
