// Adapted from React Bits SpotlightCard. See THIRD_PARTY_NOTICES.md.
import { type CSSProperties, type PropsWithChildren } from "react";

export default function SpotlightCard({
  children,
  className = "",
  style,
}: PropsWithChildren<{ className?: string; style?: CSSProperties }>) {
  return (
    <div className={`card-spotlight ${className}`} style={style}>
      {children}
    </div>
  );
}
