import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { adminLoginSchema, type PublicPrayer, type TaxonomyItem } from "@cloudsent/contracts";
import {
  adminLogin,
  getPrayer,
  getTaxonomy,
  reportPrayer,
  submitPrayer,
} from "./api";
import PillNav from "./components/PillNav";
import SpotlightCard from "./components/SpotlightCard";
import Stepper from "./components/Stepper";
import { palette } from "./palette";

const initialForm = {
  title: "",
  message: "",
  categoryId: "",
  moodId: "",
  color: "sky",
  isAnonymous: true,
  displayName: "",
};
const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    const titles: Record<string, string> = {
      "/": "A shared sky",
      "/wall": "Prayer wall",
      "/submit": "Send a prayer",
      "/secretlang": "Admin sign in",
      "/secretlang/dashboard": "Keepers’ dashboard",
      "/secretlang/tools": "Wall settings",
      "/about": "About",
      "/privacy": "Privacy",
      "/acceptable-use": "Acceptable use",
    };
    document.title = `${titles[pathname] || "CloudSent"} · CloudSent()`;
  }, [pathname]);
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="CloudSent home">
          <span className="brand-mark" aria-hidden="true">
            ☁
          </span>
          <span>
            CloudSent<span className="brand-parens">()</span>
          </span>
        </Link>
        <PillNav />
      </header>
      <div id="main-content" className="site-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="site-footer">
        <div>
          <Link className="footer-brand" to="/">
            CloudSent()
          </Link>
          <p>A little room for faith, hope, and reflection.</p>
        </div>
        <nav aria-label="Information">
          <Link to="/about">About</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/acceptable-use">Acceptable use</Link>
        </nav>
        <span className="footer-note">
          Held with care. Shared with kindness.
        </span>
      </footer>
    </div>
  );
}

export function Home() {
  return (
    <Shell>
      <main className="home-page">
        <section className="home-hero">
          <div className="home-copy">
            <p className="section-kicker">
              <span aria-hidden="true">☁</span> A shared sky for quiet
              intentions
            </p>
            <h1>Some prayers are lighter when carried together.</h1>
            <p className="hero-lede">
              A hope for tomorrow. A thank-you for today. A remembrance that
              stays with you. There’s a place for it here.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/submit">
                Send a prayer
              </Link>
              <Link className="button button-quiet" to="/wall">
                Explore the wall
              </Link>
            </div>
            <p className="hero-assurance">
              Anonymous by default. Reviewed before sharing.
            </p>
          </div>
          <div
            className="letter-scene"
            aria-label="Illustrative prayer cards, not live submissions"
          >
            <span className="scene-cloud scene-cloud-one" aria-hidden="true">
              ☁
            </span>
            <span className="scene-cloud scene-cloud-two" aria-hidden="true">
              ☁
            </span>
            <div className="scene-letter scene-letter-back" aria-hidden="true">
              <span>Thanksgiving</span>
              <p>For the people who make ordinary days feel full.</p>
            </div>
            <SpotlightCard className="scene-letter scene-letter-front">
              <span className="letter-symbol" aria-hidden="true">
                ✦
              </span>
              <p>May there be enough light for the next step.</p>
              <div>
                <span>Anonymous</span>
                <span className="mood-chip">Hopeful</span>
              </div>
            </SpotlightCard>
            <span className="scene-caption">
              A glimpse of the wall · sample prayers
            </span>
          </div>
        </section>
        <section className="home-purpose">
          <div>
            <p className="section-kicker">A wall, not a feed</p>
            <h2>Words worth slowing down for.</h2>
          </div>
          <p>
            No likes. No follower counts. No pressure to say it perfectly. Just
            a shared space to read, reflect, and leave a few words of your own.
          </p>
        </section>
        <section className="home-guidance" aria-label="How CloudSent works">
          <SpotlightCard className="guidance-card">
            <span className="guidance-symbol" aria-hidden="true">
              ✎
            </span>
            <h3>Write what matters</h3>
            <p>
              Choose a category and put your intention into words. You can leave
              your name out.
            </p>
            <Link className="text-link" to="/submit">
              Write a prayer
            </Link>
          </SpotlightCard>
          <SpotlightCard className="guidance-card guidance-review">
            <span className="guidance-symbol" aria-hidden="true">
              ♡
            </span>
            <h3>A moment of care</h3>
            <p>
              Every prayer is reviewed by a keeper before it becomes public.
            </p>
            <Link className="text-link" to="/acceptable-use">
              How we keep this space kind
            </Link>
          </SpotlightCard>
          <SpotlightCard className="guidance-card">
            <span className="guidance-symbol" aria-hidden="true">
              ☁
            </span>
            <h3>Join the shared sky</h3>
            <p>
              Explore approved prayers, or search for the words you need to find
              today.
            </p>
            <Link className="text-link" to="/wall">
              Visit the wall
            </Link>
          </SpotlightCard>
        </section>
      </main>
    </Shell>
  );
}

export function EmptyState({
  unavailable = false,
  filtered = false,
}: {
  unavailable?: boolean;
  filtered?: boolean;
}) {
  return (
    <SpotlightCard className="empty-state">
      <span className="empty-symbol" aria-hidden="true">
        ☁
      </span>
      <h2>
        {unavailable
          ? "We couldn’t open the wall."
          : filtered
            ? "No prayers match these filters."
            : "Room for the first prayer."}
      </h2>
      <p>
        {unavailable
          ? "Please refresh the page or try again in a moment."
          : filtered
            ? "Try a different word or clear your filters to see the whole wall."
            : "Approved prayers will appear here. Send an intention and a keeper will review it before sharing."}
      </p>
      {!unavailable && !filtered && (
        <Link className="button button-primary" to="/submit">
          Send a prayer
        </Link>
      )}
      {unavailable && (
        <button
          className="button button-quiet"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      )}
    </SpotlightCard>
  );
}

export function Submit() {
  const [taxonomy, setTaxonomy] = useState<{
    categories: TaxonomyItem[];
    moods: TaxonomyItem[];
  }>({ categories: [], moods: [] });
  const [choicesReady, setChoicesReady] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    getTaxonomy()
      .then((result) => {
        if (active) {
          setTaxonomy(result.data);
          setChoicesReady(true);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "We couldn’t load the prayer choices. Refresh the page to try again.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const update = (key: keyof typeof initialForm, value: unknown) =>
    setForm((current) => ({ ...current, [key]: value }));
  const validate = (target: number) => {
    if (target === 0 && (!form.categoryId || !form.message.trim()))
      return "Choose a category and write your prayer before continuing.";
    if (
      target === 1 &&
      (!form.moodId || (!form.isAnonymous && !form.displayName.trim()))
    )
      return "Choose a mood and add a display name, or stay anonymous.";
    return "";
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !choicesReady) return;
    const validation = step === 2 ? validate(0) || validate(1) : validate(step);
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      await submitPrayer({
        ...form,
        title: form.title.trim(),
        message: form.message.trim(),
        displayName: form.isAnonymous ? "" : form.displayName.trim(),
      });
      setSent(true);
    } catch (error) {
      setError(
        errorText(error, "Your prayer couldn’t be sent. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  };
  const back = (target: number) => {
    if (!busy) {
      setStep(target);
      setError("");
    }
  };
  if (sent)
    return (
      <Shell>
        <main className="page narrow">
          <SpotlightCard className="success-card">
            <span className="success-symbol" aria-hidden="true">
              ✓
            </span>
            <h1>Your prayer has been received.</h1>
            <p>
              It’s waiting for a keeper’s review. It will join the public wall
              only after approval.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/wall">
                Visit the wall
              </Link>
              <button
                className="button button-quiet"
                onClick={() => {
                  setSent(false);
                  setForm(initialForm);
                  setStep(0);
                }}
              >
                Send another prayer
              </button>
            </div>
          </SpotlightCard>
        </main>
      </Shell>
    );
  return (
    <Shell>
      <main className="page compose-page">
        <div className="page-heading">
          <div>
            <p className="section-kicker">A note for the shared sky</p>
            <h1>Send a prayer</h1>
            <p>A few honest words are enough. Take your time.</p>
          </div>
          <Link className="text-link" to="/wall">
            Back to the wall
          </Link>
        </div>
        <div className="compose-layout">
          <form className="compose-form" onSubmit={submit} noValidate>
            <Stepper
              step={step}
              labels={["Write", "Personalize", "Review"]}
              onBack={back}
              disabled={busy}
            >
              <fieldset disabled={busy} className="step-fields">
                {step === 0 && (
                  <>
                    <h2>What’s on your heart?</h2>
                    <fieldset>
                      <legend>What kind of prayer is this?</legend>
                      <div className="choice-grid">
                        {taxonomy.categories.map((item) => (
                          <label
                            className={`choice ${form.categoryId === item.id ? "selected" : ""}`}
                            key={item.id}
                          >
                            <input
                              type="radio"
                              name="category"
                              checked={form.categoryId === item.id}
                              onChange={() => update("categoryId", item.id)}
                            />
                            <span>{item.name}</span>
                          </label>
                        ))}
                      </div>
                      {!choicesReady && !error && (
                        <p role="status">Loading choices…</p>
                      )}
                    </fieldset>
                    <label>
                      <span>
                        Title <span className="optional">Optional</span>
                      </span>
                      <input
                        maxLength={150}
                        value={form.title}
                        onChange={(event) =>
                          update("title", event.target.value)
                        }
                        placeholder="A few words to hold it"
                      />
                    </label>
                    <label>
                      Your prayer
                      <textarea
                        maxLength={2000}
                        value={form.message}
                        onChange={(event) =>
                          update("message", event.target.value)
                        }
                        placeholder="Write what you would like to send…"
                        rows={7}
                      />
                      <span className="counter">
                        {form.message.length.toLocaleString()}/2,000
                      </span>
                    </label>
                  </>
                )}
                {step === 1 && (
                  <>
                    <h2>Make it your own.</h2>
                    <fieldset>
                      <legend>How does it feel?</legend>
                      <div className="choice-grid">
                        {taxonomy.moods.map((item) => (
                          <label
                            className={`choice ${form.moodId === item.id ? "selected" : ""}`}
                            key={item.id}
                          >
                            <input
                              type="radio"
                              name="mood"
                              checked={form.moodId === item.id}
                              onChange={() => update("moodId", item.id)}
                            />
                            {item.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend>Choose a sky color</legend>
                      <div className="color-grid">
                        {Object.entries(palette).map(([key, color]) => (
                          <label
                            key={key}
                            className={`color-choice ${form.color === key ? "selected" : ""}`}
                            style={{ background: color }}
                          >
                            <input
                              type="radio"
                              name="color"
                              checked={form.color === key}
                              onChange={() => update("color", key)}
                            />
                            <span>{key}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend>How should your name appear?</legend>
                      <label className="toggle-row">
                        <input
                          type="checkbox"
                          checked={form.isAnonymous}
                          onChange={(event) =>
                            update("isAnonymous", event.target.checked)
                          }
                        />
                        Keep me anonymous
                      </label>
                      {!form.isAnonymous && (
                        <label>
                          Display name
                          <input
                            maxLength={100}
                            value={form.displayName}
                            onChange={(event) =>
                              update("displayName", event.target.value)
                            }
                            autoComplete="nickname"
                          />
                        </label>
                      )}
                      <p className="field-help">
                        Your chosen name will be visible to everyone if the
                        prayer is approved.
                      </p>
                    </fieldset>
                  </>
                )}
                {step === 2 && (
                  <>
                    <h2>One last look.</h2>
                    <p className="field-help">
                      This is how your prayer will appear after approval.
                    </p>
                    <SpotlightCard
                      className="review-letter"
                      style={{ background: palette[form.color] }}
                    >
                      <div className="letter-labels">
                        <span>
                          {
                            taxonomy.categories.find(
                              (item) => item.id === form.categoryId,
                            )?.name
                          }
                        </span>
                        <span className="mood-chip">
                          {
                            taxonomy.moods.find(
                              (item) => item.id === form.moodId,
                            )?.name
                          }
                        </span>
                      </div>
                      {form.title && <h3>{form.title}</h3>}
                      <p>{form.message}</p>
                      <small>
                        {form.isAnonymous ? "Anonymous" : form.displayName}
                      </small>
                    </SpotlightCard>
                    <p className="review-notice">
                      Sending your prayer places it in the review queue, not
                      directly on the wall.
                    </p>
                  </>
                )}
              </fieldset>
            </Stepper>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="step-footer">
              {step > 0 ? (
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={busy}
                  onClick={() => back(step - 1)}
                >
                  Back
                </button>
              ) : (
                <span className="muted">Step 1 of 3</span>
              )}
              <button
                type="submit"
                className="button button-primary"
                disabled={
                  busy ||
                  !choicesReady ||
                  !taxonomy.categories.length ||
                  !taxonomy.moods.length
                }
              >
                {busy
                  ? "Sending…"
                  : step === 2
                    ? "Send for review"
                    : "Continue"}
              </button>
            </div>
          </form>
          <aside className="compose-aside">
            <SpotlightCard className="care-note">
              <span className="guidance-symbol" aria-hidden="true">
                ♡
              </span>
              <h3>A little care goes a long way.</h3>
              <p>
                Approved prayers are public. Leave out addresses, phone numbers,
                and private details about other people.
              </p>
              <p>You don’t need an account, and you can stay anonymous.</p>
              <Link className="text-link" to="/privacy">
                Read our privacy notes
              </Link>
            </SpotlightCard>
          </aside>
        </div>
      </main>
    </Shell>
  );
}

export function Detail() {
  const { id } = useParams();
  const [prayer, setPrayer] = useState<PublicPrayer | null>(null);
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const [reportError, setReportError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setPrayer(null);
    setError("");
    setReportOpen(false);
    setReported(false);
    setReason("");
    setReportError("");
    getPrayer(id!)
      .then((result) => {
        if (active) setPrayer(result.data);
      })
      .catch((error) => {
        if (active)
          setError(
            error.status === 404
              ? "This prayer is no longer available on the wall."
              : "We couldn’t load this prayer. Please try again in a moment.",
          );
      });
    return () => {
      active = false;
    };
  }, [id]);
  const report = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !reason.trim()) return;
    setBusy(true);
    setReportError("");
    try {
      await reportPrayer(id!, reason.trim());
      setReported(true);
      setReportOpen(false);
    } catch (error) {
      setReportError(
        errorText(error, "Your report couldn’t be sent. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell>
      <main className="page narrow detail-page">
        <Link className="back-link" to="/wall">
          Back to the prayer wall
        </Link>
        {error ? (
          <SpotlightCard className="empty-state">
            <h1>Prayer unavailable</h1>
            <p role="alert">{error}</p>
          </SpotlightCard>
        ) : !prayer ? (
          <div className="loading-state" role="status">
            Opening this prayer…
          </div>
        ) : (
          <>
            <SpotlightCard
              className="detail-card"
              style={{ background: palette[prayer.color] }}
            >
              <div className="letter-labels">
                <span>{prayer.category.name}</span>
                <span className="mood-chip">{prayer.mood.name}</span>
              </div>
              <span className="detail-star" aria-hidden="true">
                ✦
              </span>
              <h1>{prayer.title || "A quiet intention"}</h1>
              <p className="detail-message">{prayer.message}</p>
              <div className="detail-meta">
                <span>
                  {prayer.isAnonymous ? "Anonymous" : prayer.displayName}
                </span>
                <time dateTime={prayer.createdAt}>
                  {new Date(prayer.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </div>
            </SpotlightCard>
            <div className="report-area">
              {reported ? (
                <p role="status">Report received. A keeper will review it.</p>
              ) : (
                <button
                  className="text-link"
                  type="button"
                  aria-expanded={reportOpen}
                  onClick={() => setReportOpen(!reportOpen)}
                >
                  Report this prayer
                </button>
              )}
              {reportOpen && (
                <form className="report-form" onSubmit={report}>
                  <h2>Help keep the wall kind.</h2>
                  <label>
                    Reason for reporting
                    <textarea
                      required
                      maxLength={255}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={3}
                    />
                  </label>
                  {reportError && (
                    <p role="alert" className="form-error">
                      {reportError}
                    </p>
                  )}
                  <div className="hero-actions">
                    <button
                      className="button button-primary"
                      disabled={busy || !reason.trim()}
                    >
                      {busy ? "Sending…" : "Send report"}
                    </button>
                    <button
                      type="button"
                      className="button button-quiet"
                      disabled={busy}
                      onClick={() => setReportOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </main>
    </Shell>
  );
}

export function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = adminLoginSchema.safeParse({ username, password });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true);
    setError("");
    try {
      await adminLogin(parsed.data.username, parsed.data.password);
      setPassword("");
      navigate("/secretlang/dashboard");
    } catch (error) {
      setError(errorText(error, "Sign in failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell>
      <main className="page login-layout">
        <div className="login-copy">
          <p className="section-kicker">For the people holding this space</p>
          <h1>A moment of care starts here.</h1>
          <p>
            Review the prayers waiting for the wall, look into reports, and keep
            the shared sky kind.
          </p>
          <Link className="text-link" to="/wall">
            Return to the public wall
          </Link>
        </div>
        <SpotlightCard className="login-card">
          <span className="login-symbol" aria-hidden="true">
            ⌘
          </span>
          <h2>Keeper sign in</h2>
          <p>Sign in with your administrator account.</p>
          <form className="form-card" onSubmit={login}>
            <label>
              Username
              <input type="text" name="username" required minLength={3} maxLength={50} autoComplete="username"
                autoCapitalize="none" spellCheck={false} value={username}
                onChange={(event) => setUsername(event.target.value)} placeholder="Your username" disabled={busy} />
            </label>
            <label>
              Password
              <input type="password" name="password" required maxLength={72} autoComplete="current-password"
                value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" disabled={busy} />
            </label>
            <span className="field-help">Your password stays hidden as you type.</span>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary" disabled={busy}>
              {busy ? "Signing in…" : "Open dashboard"}
            </button>
          </form>
          <small className="login-footnote">
            Private access for CloudSent keepers.
          </small>
        </SpotlightCard>
      </main>
    </Shell>
  );
}

export function Info({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  return (
    <Shell>
      <main className="page info-layout">
        <aside>
          <Link className="back-link" to="/">
            Back to CloudSent
          </Link>
          <nav aria-label="About this space">
            {[
              { href: "/about", label: "About CloudSent" },
              { href: "/privacy", label: "Privacy" },
              { href: "/acceptable-use", label: "Acceptable use" },
            ].map((item) => (
              <Link
                key={item.href}
                to={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <SpotlightCard className="info-paper">
          <span className="guidance-symbol" aria-hidden="true">
            ☁
          </span>
          <h1>{title}</h1>
          <div className="info-body">{children}</div>
          <div className="info-invitation">
            <p>There’s room for your words here.</p>
            <Link className="button button-quiet" to="/wall">
              Explore the wall
            </Link>
          </div>
        </SpotlightCard>
      </main>
    </Shell>
  );
}

export function NotFound() {
  return (
    <Shell>
      <main className="page narrow">
        <SpotlightCard className="empty-state">
          <span className="empty-symbol" aria-hidden="true">
            ☁
          </span>
          <h1>This page drifted away.</h1>
          <p>That address doesn’t lead to a CloudSent page.</p>
          <Link className="button button-primary" to="/wall">
            Go to the prayer wall
          </Link>
        </SpotlightCard>
      </main>
    </Shell>
  );
}
