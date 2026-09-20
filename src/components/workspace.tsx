"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Layers3,
  LayoutGrid,
  Route,
  CheckCheck,
  Settings,
  Plus,
  ChevronRight,
  LogOut,
  WifiOff,
  ArrowUpRight,
  LoaderCircle,
} from "lucide-react";
import type { Actor, Project } from "@/lib/model";
import { api, write, Field, Modal, ErrorNotice, Empty } from "./ui";
import Backlog from "./backlog";
import TaskPanel from "./task-panel";
import SettingsPage from "./settings";
const JourneyPage = dynamic(() => import("./journey"), {
  loading: () => (
    <div className="loading">
      <LoaderCircle className="spin" />
      Loading journey…
    </div>
  ),
});
const ScreenPanel = dynamic(() => import("./screen-panel"));
const brand = process.env.NEXT_PUBLIC_APP_NAME || "CustomBacklog";
type ProjectOption = { id: string; name: string; prefix: string };
export default function Workspace() {
  const [user, setUser] = useState<Actor | null>(null),
    [boot, setBoot] = useState(true),
    [setup, setSetup] = useState(false),
    [projects, setProjects] = useState<ProjectOption[]>([]),
    [project, setProject] = useState<Project | null>(null),
    [projectId, setProjectId] = useState(""),
    [page, setPage] = useState("backlog"),
    [error, setError] = useState(""),
    [offline, setOffline] = useState(false),
    [selectedTask, setTask] = useState(""),
    [selectedScreen, setScreen] = useState(""),
    [createProject, setCreateProject] = useState(false),
    [reviewTab, setReviewTab] = useState("tasks");
  const syncUrl = useCallback(() => {
    const q = new URLSearchParams(location.search);
    setPage(q.get("page") || "backlog");
    setTask(q.get("task") || "");
    setScreen(q.get("screen") || "");
    if (q.get("project")) setProjectId(q.get("project")!);
  }, []);
  useEffect(() => {
    syncUrl();
    window.addEventListener("popstate", syncUrl);
    const off = () => setOffline(!navigator.onLine);
    window.addEventListener("online", off);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("popstate", syncUrl);
      window.removeEventListener("online", off);
      window.removeEventListener("offline", off);
    };
  }, [syncUrl]);
  function navigate(values: Record<string, string>) {
    const q = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(values)) v ? q.set(k, v) : q.delete(k);
    history.pushState({}, "", `/?${q}`);
    syncUrl();
  }
  const initialize = useCallback(async () => {
    setError("");
    try {
      const installation = await api<{
        setupRequired: boolean;
        authenticated: boolean;
      }>("installation");
      setSetup(installation.setupRequired);
      if (!installation.authenticated) {
        setUser(null);
        return;
      }
      try {
        const me = await api<Actor>("me");
        setUser(me);
        const ps = await api<ProjectOption[]>("projects");
        setProjects(ps);
        setProjectId((id) =>
          ps.some((p) => p.id === id) ? id : ps[0]?.id || "",
        );
      } catch (e) {
        if ((e as { status?: number }).status !== 401) throw e;
        setUser(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBoot(false);
    }
  }, []);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  const refresh = useCallback(async () => {
    if (projectId) {
      try {
        const p = await api<Project>(`projects/${projectId}/snapshot`);
        setProject(p);
      } catch (e) {
        setError((e as Error).message);
        if ((e as { status?: number }).status === 401) {
          setUser(null);
          setProject(null);
          setProjectId("");
          setProjects([]);
        }
      }
    }
  }, [projectId]);
  useEffect(() => {
    setProject(null);
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const focus = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("focus", focus);
    const timer = setInterval(focus, 60000);
    return () => {
      window.removeEventListener("focus", focus);
      clearInterval(timer);
    };
  }, [refresh]);
  if (boot)
    return (
      <div className="loading full">
        <Layers3 size={30} />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!user) return <Auth setup={setup} error={error} reload={initialize} />;
  const nav = [
    { id: "backlog", label: "Backlog", icon: LayoutGrid },
    { id: "journey", label: "User journey", icon: Route },
    { id: "reviews", label: "Reviews", icon: CheckCheck },
    { id: "settings", label: "Settings", icon: Settings },
  ];
  const owner = user.role === "owner";
  const reviewCount =
    project?.tasks.filter((t) => t.status === "Done").length || 0;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Layers3 size={21} />
          </span>
          {brand}
          <span className="beta">beta</span>
        </a>
        <div className="project-label">WORKSPACE</div>
        <div className="project-switch">
          <span className="project-avatar">
            {project?.prefix.slice(0, 1) || "W"}
          </span>
          <select
            aria-label="Project"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              navigate({ project: e.target.value, task: "", screen: "" });
            }}
          >
            <option value="" disabled>
              Select a project
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {owner && (
          <button
            className="new-project"
            onClick={() => setCreateProject(true)}
          >
            <Plus size={15} />
            New project
          </button>
        )}
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              onClick={() => navigate({ page: n.id, task: "", screen: "" })}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === "reviews" && reviewCount > 0 && (
                <span className="count">{reviewCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="tiny-dot" />
          One shared picture.
          <br />
          <span className="muted">From first idea to reviewed.</span>
        </div>
        <div className="account">
          <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{user.name}</strong>
            <small>{owner ? "Owner · Developer" : "Partner · Reviewer"}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              await write("/api/auth/sign-out", {});
              setUser(null);
              setProject(null);
              setProjectId("");
              setProjects([]);
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>{project?.name || "Workspace"}</span>
            <ChevronRight size={14} />
            <strong>
              {nav.find((n) => n.id === page)?.label || "Backlog"}
            </strong>
          </div>
          <span className="workspace-tag">Shared workspace</span>
          <select
            className="mobile-project"
            aria-label="Mobile project"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              navigate({ project: e.target.value });
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </header>
        {offline && (
          <div className="notice warning" role="status">
            <WifiOff size={18} />
            You’re offline. Keep this page open; unsaved drafts remain here.
            Reconnect before saving.
          </div>
        )}
        <main id="main">
          <ErrorNotice error={error} />
          {error && (
            <button
              onClick={() => {
                setError("");
                void refresh();
              }}
            >
              Retry
            </button>
          )}
          {!projectId ? (
            <Empty
              title="A clear place to start"
              action={
                owner && (
                  <button
                    className="primary"
                    onClick={() => setCreateProject(true)}
                  >
                    <Plus size={17} />
                    Create a project
                  </button>
                )
              }
            >
              Create your first project to bring tasks, screens, and feedback
              together.
            </Empty>
          ) : !project ? (
            <div className="loading">
              <LoaderCircle className="spin" />
              Loading project…
            </div>
          ) : (
            <>
              {page === "backlog" && (
                <Backlog
                  project={project}
                  actor={user}
                  openTask={(id, action) =>
                    navigate({ task: id, action: action || "" })
                  }
                  refresh={refresh}
                />
              )}
              {page === "journey" && (
                <JourneyPage
                  project={project}
                  actor={user}
                  refresh={refresh}
                  openScreen={(id) => navigate({ screen: id })}
                />
              )}
              {page === "reviews" && (
                <>
                  <div className="page-heading">
                    <div className="eyebrow">CLOSE THE LOOP</div>
                    <h1>Ready for a second look</h1>
                    <p>
                      Review the work, share feedback, and move forward
                      together.
                    </p>
                  </div>
                  <div className="tabs">
                    <button
                      className={reviewTab === "tasks" ? "selected" : ""}
                      onClick={() => setReviewTab("tasks")}
                    >
                      Completed tasks{" "}
                      <span className="count">{reviewCount}</span>
                    </button>
                    <button
                      className={reviewTab === "screens" ? "selected" : ""}
                      onClick={() => setReviewTab("screens")}
                    >
                      Screen reviews{" "}
                      <span className="count">
                        {
                          project.screens.filter(
                            (s) =>
                              s.versions.at(-1)?.status === "Awaiting review",
                          ).length
                        }
                      </span>
                    </button>
                  </div>
                  {reviewTab === "tasks" ? (
                    <div className="review-grid">
                      {project.tasks
                        .filter((t) => t.status === "Done")
                        .map((t) => (
                          <button
                            className="review-card"
                            key={t.id}
                            onClick={() => navigate({ task: t.id })}
                          >
                            <div className="card-meta">
                              <span>{t.readableId}</span>
                              <span className="status">
                                <CheckCheck size={15} />
                                Needs your review
                              </span>
                            </div>
                            <h3>{t.title}</h3>
                            <p>{t.completionSummary}</p>
                            <div className="review-evidence">
                              <strong>Verification</strong>
                              <p>{t.verification}</p>
                            </div>
                            <span className="text-link">
                              Review completion <ArrowUpRight size={16} />
                            </span>
                          </button>
                        ))}
                      {!reviewCount && (
                        <Empty title="All caught up">
                          Completed tasks will appear here when they’re ready
                          for a human review.
                        </Empty>
                      )}
                    </div>
                  ) : (
                    <div className="screen-grid">
                      {project.screens
                        .filter(
                          (s) =>
                            s.versions.at(-1)?.status === "Awaiting review",
                        )
                        .map((s) => (
                          <button
                            className="screen-card"
                            key={s.id}
                            onClick={() => navigate({ screen: s.id })}
                          >
                            <div className="screen-thumb">
                              {s.versions.at(-1)?.key ? (
                                <img
                                  alt={s.title}
                                  src={`/api/v1/projects/${project.id}/files/${s.versions.at(-1)!.key}`}
                                />
                              ) : (
                                <span>Screen in progress</span>
                              )}
                            </div>
                            <h3>{s.title}</h3>
                            <span className="muted">
                              Version {s.versions.at(-1)?.number} · Awaiting
                              review
                            </span>
                          </button>
                        ))}
                      {!project.screens.some(
                        (s) => s.versions.at(-1)?.status === "Awaiting review",
                      ) && (
                        <Empty title="No screens waiting">
                          New screen versions will appear here for review.
                        </Empty>
                      )}
                    </div>
                  )}
                </>
              )}
              {page === "settings" && (
                <SettingsPage
                  actor={user}
                  project={project}
                  refresh={initialize}
                />
              )}
            </>
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.map((n) => (
          <button
            key={n.id}
            className={page === n.id ? "active" : ""}
            onClick={() => navigate({ page: n.id, task: "", screen: "" })}
          >
            <n.icon size={21} />
            <span>
              {n.id === "journey"
                ? "Journey"
                : n.id === "settings"
                  ? "More"
                  : n.label}
            </span>
          </button>
        ))}
      </nav>
      {createProject && (
        <ProjectForm
          onClose={() => setCreateProject(false)}
          onCreated={async (id) => {
            setCreateProject(false);
            await initialize();
            setProjectId(id);
            navigate({ project: id, page: "backlog" });
          }}
        />
      )}
      {project &&
        selectedTask &&
        project.tasks.some((t) => t.id === selectedTask) && (
          <TaskPanel
            key={selectedTask}
            task={project.tasks.find((t) => t.id === selectedTask)!}
            project={project}
            actor={user}
            refresh={refresh}
            onClose={() => navigate({ task: "" })}
            openScreen={(id) => navigate({ task: "", screen: id })}
          />
        )}
      {project &&
        selectedScreen &&
        project.screens.some((s) => s.id === selectedScreen) && (
          <ScreenPanel
            key={selectedScreen}
            screen={project.screens.find((s) => s.id === selectedScreen)!}
            project={project}
            actor={user}
            refresh={refresh}
            onClose={() => navigate({ screen: "" })}
            openScreen={(id) => navigate({ screen: id })}
            openTask={(id) => navigate({ screen: "", task: id })}
          />
        )}
    </div>
  );
}
function Auth({
  setup,
  error: initialError,
  reload,
}: {
  setup: boolean;
  error: string;
  reload: () => Promise<void>;
}) {
  const [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false);
  const invite =
    typeof window !== "undefined"
      ? new URLSearchParams(location.search).get("invite")
      : null;
  return (
    <div className="auth-page">
      <div className="auth-story">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Layers3 />
          </span>
          {brand}
        </a>
        <div>
          <div className="eyebrow">BUILD WITH A SHARED UNDERSTANDING</div>
          <h1>
            Good work.
            <br />
            Thoughtful feedback.
            <br />
            One place.
          </h1>
          <p>
            A calmer workspace for the people building your product—and the
            people helping make it better.
          </p>
          <div className="auth-workflow">
            <span>Plan</span>
            <ChevronRight />
            <span>Build</span>
            <ChevronRight />
            <span>Review</span>
          </div>
        </div>
        <small>Open source. Your data. Your workflow.</small>
      </div>
      <section className="auth-form">
        <span className="eyebrow">
          {setup
            ? "YOUR WORKSPACE STARTS HERE"
            : invite
              ? "YOU’RE INVITED"
              : "WELCOME BACK"}
        </span>
        <h1>
          {setup
            ? "Set up your workspace"
            : invite
              ? "Join the workspace"
              : "Sign in"}
        </h1>
        <p className="muted">
          {setup
            ? "Use the setup token configured by your installation administrator."
            : invite
              ? "Create your reviewer account to share feedback."
              : "Pick up where your team left off."}
        </p>
        <ErrorNotice error={error} />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              if (setup || invite)
                await write(setup ? "setup" : "join", {
                  name: f.get("name"),
                  email: f.get("email"),
                  password: f.get("password"),
                  token: invite || f.get("token"),
                });
              await write("/api/auth/sign-in/email", {
                email: f.get("email"),
                password: f.get("password"),
              });
              if (invite) history.replaceState({}, "", "/");
              await reload();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {(setup || invite) && (
            <Field label="Your name">
              <input name="name" required autoComplete="name" />
            </Field>
          )}
          <Field label="Email address">
            <input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field
            label="Password"
            hint={setup || invite ? "Use at least 12 characters." : undefined}
          >
            <input
              name="password"
              type="password"
              required
              minLength={setup || invite ? 12 : 1}
              autoComplete={
                setup || invite ? "new-password" : "current-password"
              }
            />
          </Field>
          {setup && (
            <Field label="Installation setup token">
              <input name="token" type="password" required autoComplete="off" />
            </Field>
          )}
          <button className="primary full-width" disabled={busy}>
            {busy
              ? "Please wait…"
              : setup
                ? "Create owner account"
                : invite
                  ? "Join workspace"
                  : "Sign in"}
            <ArrowUpRight size={17} />
          </button>
        </form>
        <small className="muted">
          Private by default. No AI subscription required.
        </small>
      </section>
    </div>
  );
}
function ProjectForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Create a project"
      description="A shared home for tasks, screens, and decisions."
      onClose={onClose}
    >
      <form
        className="panel-body"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            const p = await write<{ id: string }>("projects", {
              name: f.get("name"),
              prefix: f.get("prefix"),
            });
            onCreated(p.id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Project name">
          <input
            name="name"
            required
            autoFocus
            placeholder="e.g. Studio website"
            maxLength={100}
          />
        </Field>
        <Field
          label="Task ID prefix"
          hint="2–6 uppercase letters, e.g. STUDIO-1"
        >
          <input
            name="prefix"
            required
            pattern="[A-Z]{2,6}"
            placeholder="STUDIO"
          />
        </Field>
        <ErrorNotice error={error} />
        <button className="primary" disabled={busy}>
          Create project
        </button>
      </form>
    </Modal>
  );
}
