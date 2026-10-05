import "./CloudIcon.css";

// A fixed vector shape avoids platform-specific emoji/font rendering.
export default function CloudIcon() {
  return (
    <svg className="cloud-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M6.5 19a4.5 4.5 0 0 1-.7-8.95A6.5 6.5 0 0 1 18.35 8.7 5.15 5.15 0 0 1 18.5 19Z" />
    </svg>
  );
}
