import { FormEvent, useEffect, useState } from "react";
import {
  Link,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import type { TaxonomyItem } from "@cloudsent/contracts";
import {
  addTaxonomy,
  adminLogout,
  adminPrayers,
  adminReports,
  adminSession,
  adminStats,
  adminTaxonomy,
  deletePrayer,
  editPrayer,
  exportPrayers,
  getTaxonomy,
  purgePrayer,
  resolveReport,
  restorePrayer,
  toggleTaxonomy,
  updatePrayerStatus,
  updateTaxonomy,
} from "./api";
import SkyWall from "./components/SkyWall";
import { CategoryIcon } from "./components/SkyPrayerCard";
import SkyBackdrop from "./components/SkyBackdrop";
import CloudIcon from "./components/CloudIcon";
import usePrayerFeed from "./usePrayerFeed";
import WallFilters from "./components/WallFilters";
import GlideSelect from "./components/GlideSelect";
import { palette } from "./palette";
import {
  Shell,
  Home,
  Submit,
  Detail,
  AdminLogin,
  Info,
  EmptyState,
  NotFound,
} from "./UiPages";
import SpotlightCard from "./components/SpotlightCard";
import CountUp from "./components/CountUp";
import Modal from "./components/Modal";
import DisplayWall from "./DisplayWall";

function Wall() {
  const [params, setParams] = useSearchParams();
  const [taxonomy, setTaxonomy] = useState<{
    categories: TaxonomyItem[];
    moods: TaxonomyItem[];
  }>({ categories: [], moods: [] });
  const search = params.toString();
  const { prayers, meta, loading, failed, loadingMore, moreError, refreshError, loadMore } = usePrayerFeed(search);
  useEffect(() => {
    getTaxonomy()
      .then((result) => setTaxonomy(result.data))
      .catch(() => undefined);
  }, []);
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("cursor");
    setParams(next);
  };
  return (
    <Shell>
      <main className="page prayer-wall-page">
        <div className="page-heading sky-wall-heading">
          <SkyBackdrop />
          <div>
            <p className="section-kicker"><CloudIcon /> Prayer Wall</p>
            <h1>A sky full of<br />kind words.</h1>
            <p>Read, reflect, and be reminded that you’re not alone.</p>
          </div>
          <Link className="button button-primary" to="/submit">
            Send a prayer
          </Link>
        </div>
        <WallFilters
          params={params}
          categories={taxonomy.categories}
          moods={taxonomy.moods}
          colors={Object.keys(palette)}
          onChange={setFilter}
          onClear={() => setParams({})}
        />
        <div className="sky-category-filters" role="group" aria-label="Filter by category">
          <button type="button" aria-pressed={!params.get("category")} onClick={() => setFilter("category", "")}>All</button>
          {taxonomy.categories.map((category) => (
            <button type="button" key={category.id} aria-pressed={params.get("category") === category.id} onClick={() => setFilter("category", category.id)}>
              <CategoryIcon name={category.name} />{category.name}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="loading-state" role="status">
            <span className="loading-cloud" aria-hidden="true">
              <CloudIcon />
            </span>
            Opening the wall…
          </div>
        ) : failed ? (
          <EmptyState unavailable />
        ) : prayers.length ? (
          <>
            <p className="sky-wall-note">Newest prayers first. Select a card to read its full prayer.</p>
            <SkyWall prayers={prayers} />
            {refreshError && <p className="sky-wall-note" role="status">Showing the last loaded prayers. Reconnecting to the sky…</p>}
            {moreError && (
              <p role="alert" className="form-error">
                {moreError}
              </p>
            )}
            {meta.hasMore && (
              <div className="load-more">
                <button
                  className="button button-quiet"
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  {loadingMore ? "Loading…" : "Load more prayers"}
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState filtered={Boolean(search)} />
        )}
        <div className="wall-bottom-action">
          <Link className="button button-primary button-small" to="/submit"><CloudIcon /> Send a prayer</Link>
        </div>
      </main>
    </Shell>
  );
}
function AdminDashboard() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [prayers, setPrayers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialog, setDialog] = useState<{
    kind: "edit" | "purge" | "report";
    record: any;
  } | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [note, setNote] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const refresh = async () => {
    try {
      const [p, r, s] = await Promise.all([
        adminPrayers(statusFilter ? "?status=" + statusFilter : ""),
        adminReports(),
        adminStats(),
      ]);
      setPrayers(p.data);
      setReports(r.data);
      setStats(s.data);
      setError("");
    } catch (e: any) {
      if (e.status === 401) navigate("/secretlang");
      else setError(e.message);
    }
  };
  useEffect(() => {
    adminSession()
      .then(() => {
        setReady(true);
      })
      .catch(() => navigate("/secretlang"));
  }, []);
  useEffect(() => {
    if (!ready) return;
    refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 30_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready, statusFilter]);
  if (!ready)
    return (
      <Shell>
        <main className="page">
          <div className="loading-state">Opening the dashboard…</div>
        </main>
      </Shell>
    );
  const logout = async () => {
    try {
      await adminLogout();
    } finally {
      navigate("/secretlang");
    }
  };
  const setStatus = async (id: string, status: string, version: number) => {
    try {
      await updatePrayerStatus(id, status, version);
      refresh();
    } catch (e: any) {
      setError(e.message || "Could not update status.");
    }
  };
  const edit = (prayer: any) => {
    setDraftTitle(prayer.title || "");
    setDraftMessage(prayer.message);
    setDialogError("");
    setDialog({ kind: "edit", record: prayer });
  };
  const remove = async (prayer: any) => {
    try {
      await deletePrayer(prayer.id);
      refresh();
    } catch (e: any) {
      setError(e.message || "Could not delete prayer.");
    }
  };
  const restore = async (prayer: any) => {
    try {
      await restorePrayer(prayer.id);
      refresh();
    } catch (e: any) {
      setError(e.message || "Could not restore prayer.");
    }
  };
  const purge = (prayer: any) => {
    setDialogError("");
    setDialog({ kind: "purge", record: prayer });
  };
  const confirmDialog = async (event: FormEvent) => {
    event.preventDefault();
    if (!dialog || actionBusy) return;
    if (dialog.kind === "edit" && !draftMessage.trim()) {
      setDialogError("Write a prayer message before saving.");
      return;
    }
    setActionBusy(true);
    setDialogError("");
    try {
      if (dialog.kind === "edit")
        await editPrayer(
          dialog.record.id,
          { title: draftTitle.trim() || null, message: draftMessage.trim() },
          dialog.record.version,
        );
      else if (dialog.kind === "purge") await purgePrayer(dialog.record.id);
      else await resolveReport(dialog.record.prayer_id, "dismiss", note.trim());
      setDialog(null);
      await refresh();
    } catch (e: any) {
      setDialogError(
        e.message || "The change could not be saved. Please try again.",
      );
    } finally {
      setActionBusy(false);
    }
  };
  const visible = prayers.filter(
    (prayer) =>
      !search.trim() ||
      [prayer.title, prayer.message, prayer.displayName]
        .filter(Boolean)
        .some((value: string) =>
          value.toLowerCase().includes(search.trim().toLowerCase()),
        ),
  );
  return (
    <Shell>
      <main className="page admin-page">
        <div className="page-heading">
          <div>
            <p className="section-kicker">Keeper workspace</p>
            <h1>Keepers’ dashboard</h1>
            <p>Review what is waiting to be carried onto the wall.</p>
          </div>
          <div className="hero-actions">
            <button className="button button-quiet" onClick={refresh}>
              Refresh
            </button>
            <Link className="button button-quiet" to="/secretlang/tools">
              Wall settings
            </Link>
            <button className="button button-quiet" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="stat-grid">
          <Stat
            label="Pending"
            value={Number(
              stats?.totals?.find((item: any) => item.status === "pending")
                ?.count ??
                prayers.filter((p) => p.status === "pending" && !p.deletedAt)
                  .length,
            )}
          />
          <Stat
            label="Approved"
            value={Number(
              stats?.totals?.find((item: any) => item.status === "approved")
                ?.count ??
                prayers.filter((p) => p.status === "approved" && !p.deletedAt)
                  .length,
            )}
          />
          <Stat
            label="Reports"
            value={Number(stats?.unresolvedReportCases ?? reports.length)}
          />
          <Stat
            label="Flags"
            value={
              stats?.flags?.reduce(
                (n: number, f: any) => n + Number(f.count),
                0,
              ) || 0
            }
          />
        </div>
        <section className="admin-section">
          <div className="section-heading">
            <h2>Prayer records</h2>
            <span className="muted">{visible.length} shown</span>
          </div>
          <div className="wall-controls admin-filters">
            <input
              aria-label="Search prayer records"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, message, or name"
            />
            <GlideSelect
              ariaLabel="Filter prayer status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "", label: "All statuses" },
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
              ]}
            />
          </div>
          <div className="admin-table">
            {visible.map((prayer) => (
              <div className="admin-row" key={prayer.id}>
                <div>
                  <strong>{prayer.title || "Untitled prayer"}</strong>
                  <p>{prayer.message}</p>
                  <small>
                    {prayer.deletedAt ? "Deleted" : prayer.status} ·{" "}
                    {prayer.isAnonymous ? "Anonymous" : prayer.displayName} ·{" "}
                    {prayer.category.name}
                  </small>
                </div>
                <div className="row-actions">
                  {!prayer.deletedAt && prayer.status === "pending" && (
                    <>
                      <button
                        className="button button-small"
                        onClick={() =>
                          setStatus(prayer.id, "approved", prayer.version)
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="button button-small button-danger"
                        onClick={() =>
                          setStatus(prayer.id, "rejected", prayer.version)
                        }
                      >
                        Reject
                      </button>
                    </>
                  )}{" "}
                  {!prayer.deletedAt && (
                    <button
                      className="button button-small"
                      onClick={() => edit(prayer)}
                    >
                      Edit
                    </button>
                  )}
                  {prayer.deletedAt ? (
                    <>
                      <button
                        className="button button-small"
                        onClick={() => restore(prayer)}
                      >
                        Restore
                      </button>
                      <button
                        className="button button-small button-danger"
                        onClick={() => purge(prayer)}
                      >
                        Purge
                      </button>
                    </>
                  ) : (
                    <button
                      className="button button-small button-danger"
                      onClick={() => remove(prayer)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!visible.length && (
              <p className="empty-inline">No matching prayer records.</p>
            )}
          </div>
        </section>
        <section className="admin-section">
          <div className="section-heading">
            <h2>Open report cases</h2>
            <span className="muted">{reports.length}</span>
          </div>
          <div className="admin-table">
            {reports.map((report) => (
              <div className="admin-row" key={report.prayer_id}>
                <div>
                  <strong>{report.title || "Untitled prayer"}</strong>
                  <p>
                    {report.report_count} report
                    {report.report_count === 1 ? "" : "s"} · {report.message}
                  </p>
                </div>
                <button
                  className="button button-small"
                  onClick={() => {
                    setNote("");
                    setDialogError("");
                    setDialog({ kind: "report", record: report });
                  }}
                >
                  Dismiss
                </button>
              </div>
            ))}
            {!reports.length && (
              <p className="empty-inline">No unresolved reports.</p>
            )}
          </div>
        </section>
        {dialog && (
          <Modal
            title={
              dialog.kind === "edit"
                ? "Edit prayer"
                : dialog.kind === "purge"
                  ? "Permanently delete this prayer?"
                  : "Dismiss report case"
            }
            onClose={() => setDialog(null)}
            busy={actionBusy}
          >
            <form className="dialog-form" onSubmit={confirmDialog}>
              <fieldset disabled={actionBusy}>
                {dialog.kind === "edit" ? (
                  <>
                    <label>
                      Title <span className="optional">Optional</span>
                      <input
                        maxLength={150}
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                      />
                    </label>
                    <label>
                      Prayer message
                      <textarea
                        required
                        maxLength={2000}
                        rows={7}
                        value={draftMessage}
                        onChange={(e) => setDraftMessage(e.target.value)}
                      />
                    </label>
                  </>
                ) : dialog.kind === "purge" ? (
                  <p>
                    This removes “{dialog.record.title || "Untitled prayer"}”
                    permanently. You won’t be able to restore it.
                  </p>
                ) : (
                  <label>
                    Resolution note <span className="optional">Optional</span>
                    <textarea
                      maxLength={500}
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                )}
              </fieldset>
              {dialogError && (
                <p className="form-error" role="alert">
                  {dialogError}
                </p>
              )}
              <div className="hero-actions">
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={actionBusy}
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={
                    dialog.kind === "purge"
                      ? "button button-danger"
                      : "button button-primary"
                  }
                  disabled={actionBusy}
                >
                  {actionBusy
                    ? "Saving…"
                    : dialog.kind === "edit"
                      ? "Save changes"
                      : dialog.kind === "purge"
                        ? "Permanently delete"
                        : "Dismiss report"}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </main>
    </Shell>
  );
}
function AdminTools() {
  const navigate = useNavigate();
  const [tax, setTax] = useState<any>({ categories: [], moods: [] });
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"categories" | "moods">("categories");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const load = async () => {
    try {
      await adminSession();
      const result = await adminTaxonomy();
      setTax(result.data);
      setDrafts(
        Object.fromEntries(
          [...result.data.categories, ...result.data.moods].map((item: any) => [
            item.id,
            item.name,
          ]),
        ),
      );
    } catch {
      navigate("/secretlang");
    }
  };
  useEffect(() => {
    load();
  }, []);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addTaxonomy(kind, name);
      setName("");
      setMessage("Choice added.");
      load();
    } catch (e: any) {
      setMessage(e.message || "Could not add entry.");
    }
  };
  const saveName = async (item: any) => {
    const next = (drafts[item.id] || "").trim();
    if (!next || next === item.name) return;
    try {
      await updateTaxonomy(item.kind, item.id, { name: next });
      setMessage("Choice renamed.");
      load();
    } catch (e: any) {
      setMessage(e.message || "Could not rename entry.");
    }
  };
  const move = async (item: any, direction: -1 | 1) => {
    const items = [...(tax[item.kind] || [])].sort(
      (a: any, b: any) => a.position - b.position,
    );
    const index = items.findIndex((candidate: any) => candidate.id === item.id);
    const other = items[index + direction];
    if (!other) return;
    try {
      await Promise.all([
        updateTaxonomy(item.kind, item.id, { position: other.position }),
        updateTaxonomy(item.kind, other.id, { position: item.position }),
      ]);
      load();
    } catch (e: any) {
      setMessage(e.message || "Could not reorder entry.");
    }
  };
  const entries = (tax[kind] || []).map((item: any) => ({ ...item, kind }));
  return (
    <Shell>
      <main className="page admin-page">
        <div className="page-heading">
          <div>
            <p className="section-kicker">Keeper workspace</p>
            <h1>Wall settings</h1>
            <p>Choose the words people can use to describe their prayers.</p>
          </div>
          <Link className="button button-quiet" to="/secretlang/dashboard">
            Back to dashboard
          </Link>
        </div>
        <section className="admin-section">
          <div className="section-heading">
            <h2>Prayer categories &amp; moods</h2>
            <p className="muted">
              Rename, reorder, or deactivate choices without deleting referenced
              records.
            </p>
          </div>
          <form className="hero-actions" onSubmit={add}>
            <GlideSelect
              ariaLabel="Taxonomy type"
              value={kind}
              onChange={(value) => setKind(value as "categories" | "moods")}
              options={[
                { value: "categories", label: "Category" },
                { value: "moods", label: "Mood" },
              ]}
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="New choice name"
              placeholder="New choice name"
              maxLength={50}
            />
            <button className="button button-primary">Add</button>
          </form>
          {message && (
            <p className="muted" role="status">
              {message}
            </p>
          )}
          <div className="admin-table">
            {entries.map((item: any, index: number) => (
              <div className="admin-row" key={item.kind + "-" + item.id}>
                <div className="taxonomy-edit">
                  <input
                    aria-label={"Name for " + item.name}
                    value={drafts[item.id] ?? item.name}
                    onChange={(e) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: e.target.value,
                      }))
                    }
                    maxLength={50}
                  />
                  <small>
                    {item.active ? "Active" : "Inactive"} · position {index + 1}
                  </small>
                </div>
                <div className="row-actions">
                  <button
                    className="button button-small"
                    onClick={() => saveName(item)}
                  >
                    Save
                  </button>
                  <button
                    className="button button-small"
                    disabled={index === 0}
                    onClick={() => move(item, -1)}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="button button-small"
                    disabled={index === entries.length - 1}
                    onClick={() => move(item, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    className="button button-small"
                    onClick={() =>
                      toggleTaxonomy(item.kind, item.id, !item.active).then(
                        load,
                      )
                    }
                  >
                    {item.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-section">
          <div className="section-heading">
            <h2>Export</h2>
          </div>
          <p className="muted">
            Download all non-deleted prayer records as a formula-safe CSV.
          </p>
          <button
            className="button button-quiet"
            onClick={async () => {
              const blob = await exportPrayers();
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = "cloudsent-prayers.csv";
              anchor.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download CSV
          </button>
        </section>
      </main>
    </Shell>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <SpotlightCard className="stat-card">
      <span className="stat-label">{label}</span>
      <strong>
        <CountUp value={value} />
      </strong>
      <span className="stat-caption">
        {label === "Pending"
          ? "Waiting for a keeper"
          : label === "Approved"
            ? "Shared with the wall"
            : label === "Reports"
              ? "Open review cases"
              : "Recorded flags"}
      </span>
    </SpotlightCard>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/wall" element={<Wall />} />
      <Route path="/view" element={<DisplayWall />} />
      <Route path="/submit" element={<Submit />} />
      <Route path="/prayer/:id" element={<Detail />} />
      <Route path="/secretlang" element={<AdminLogin />} />
      <Route path="/secretlang/dashboard" element={<AdminDashboard />} />
      <Route path="/secretlang/tools" element={<AdminTools />} />
      <Route
        path="/about"
        element={
          <Info title="A wall, not a feed.">
            <p>
              CloudSent is a shared digital place for prayer intentions,
              thanksgiving, reflection, encouragement, and remembrance.
            </p>
          </Info>
        }
      />
      <Route
        path="/privacy"
        element={
          <Info title="Privacy">
            <p>
              Prayers are anonymous by default. Please do not include addresses,
              phone numbers, or private details about another person. We use
              only short-lived pseudonymous device and network signals to slow
              abuse; they are not shown on the wall.
            </p>
          </Info>
        }
      />
      <Route
        path="/acceptable-use"
        element={
          <Info title="Acceptable use">
            <p>
              Keep this space kind and contemplative. Do not use it to threaten,
              harass, expose private information, or automate submissions.
              Prayers are reviewed before publication.
            </p>
          </Info>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
