import "./SkyWall.css";

export default function SkyBackdrop() {
  return (
    <div className="sky-backdrop" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <svg key={index} className={`sky-cloud sky-cloud-${index}`} viewBox="0 0 240 100">
          <path d="M35 92C-8 92-7 43 32 42C35 10 79 1 99 27C120-10 178 7 177 46C219 29 251 91 206 92Z" fill="currentColor" />
        </svg>
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <svg key={index} className={`sky-sparkle sky-sparkle-${index}`} viewBox="0 0 24 24">
          <path d="M12 1L15 9L23 12L15 15L12 23L9 15L1 12L9 9Z" fill="currentColor" />
        </svg>
      ))}
      <svg className="sky-cloud-bank" viewBox="0 0 1200 130" preserveAspectRatio="none">
        <path d="M0 72Q70 35 140 82Q230 28 315 86Q395 55 460 95Q550 28 655 75Q725 7 810 72Q885 40 960 85Q1080 17 1200 68V130H0Z" fill="currentColor" />
      </svg>
    </div>
  );
}
