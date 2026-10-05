// Adapted from React Bits PillNav: circle fill and stacked labels, with accessible site navigation.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { gsap } from "gsap";

const items = [
  { href: "/", label: "Home" },
  { href: "/wall", label: "Prayer Wall" },
  { href: "/submit", label: "Send a Prayer" },
];

const isCurrent = (pathname: string, href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

export default function PillNav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const nav = ref.current;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      gsap.killTweensOf(nav?.querySelectorAll(".hover-circle") || []);
    };
  }, []);
  const animate = (element: HTMLAnchorElement, enter: boolean) => {
    const circle = element.querySelector(".hover-circle");
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(circle, {
      scale: enter ? 1 : 0,
      duration: enter ? 0.32 : 0.2,
      ease: "power3.out",
      overwrite: true,
    });
  };
  return (
    <nav
      className="pill-nav"
      aria-label="Primary navigation"
      ref={ref}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <button
        ref={toggle}
        type="button"
        className="menu-toggle"
        aria-expanded={open}
        aria-controls="primary-links"
        onClick={() => setOpen(!open)}
      >
        <span>{open ? "Close" : "Menu"}</span>
        <span aria-hidden="true">{open ? "×" : "☰"}</span>
      </button>
      <div id="primary-links" className={`pill-list ${open ? "is-open" : ""}`}>
        {items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`nav-pill ${isCurrent(pathname, item.href) ? "is-active" : ""} ${item.href === "/submit" ? "nav-pill--cta" : ""}`}
            aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
            onClick={() => setOpen(false)}
            onMouseEnter={(event) => animate(event.currentTarget, true)}
            onMouseLeave={(event) => animate(event.currentTarget, false)}
            onFocus={(event) => animate(event.currentTarget, true)}
            onBlur={(event) => animate(event.currentTarget, false)}
          >
            <span className="hover-circle" aria-hidden="true" />
            <span className="pill-label">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
