"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  List,
  Columns3,
  ImageIcon,
  Flag,
  SlidersHorizontal,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import {
  statuses,
  priorities,
  type Actor,
  type Project,
  type Task,
} from "@/lib/model";
import {
  write,
  Modal,
  Field,
  ErrorNotice,
  Empty,
  StatusIcon,
  Status,
} from "./ui";
export default function Backlog({
  project,
  actor,
  openTask,
  refresh,
}: {
  project: Project;
  actor: Actor;
  openTask: (id: string, action?: string) => void;
  refresh: () => Promise<void>;
}) {
  const [view, setView] = useState("list"),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [priority, setPriority] = useState(""),
    [assignee, setAssignee] = useState(""),
    [screen, setScreen] = useState(""),
    [blocked, setBlocked] = useState(false),
    [filters, setFilters] = useState(false),
    [create, setCreate] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setView(q.get("view") || (window.innerWidth > 800 ? "board" : "list"));
    setQuery(q.get("q") || "");
    setStatus(q.get("status") || "");
    setPriority(q.get("priority") || "");
    setAssignee(q.get("assignee") || "");
    setScreen(q.get("filterScreen") || "");
    setBlocked(q.get("blocked") === "1");
  }, []);
  function saveFilter(k: string, v: string) {
    const q = new URLSearchParams(location.search);
    v ? q.set(k, v) : q.delete(k);
    history.replaceState({}, "", `/?${q}`);
  }
  const tasks = useMemo(
    () =>
      project.tasks.filter(
        (t) =>
          (!query ||
            `${t.title} ${t.readableId}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (!status || t.status === status) &&
          (!priority || t.priority === priority) &&
          (!assignee || t.assignee === assignee) &&
          (!screen || t.screenIds.includes(screen)) &&
          (!blocked || t.blockerReason),
      ),
    [project, query, status, priority, assignee, screen, blocked],
  );
  const owner = actor.role === "owner";
  async function drop(e: React.DragEvent, s: Task["status"]) {
    e.preventDefault();
    const task = project.tasks.find(
      (t) => t.id === e.dataTransfer.getData("text/plain"),
    );
    if (!task || task.status === s) return;
    if (
      s === "Done" ||
      s === "Done reviewed" ||
      task.status === "Done" ||
      task.status === "Done reviewed"
    ) {
      openTask(task.id, s === "Done" ? "complete" : "review");
      return;
    }
    try {
      await write(
        `projects/${project.id}/tasks/${task.id}/progress`,
        { version: task.version, status: s },
        "PATCH",
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="heading-row">
        <div className="page-heading">
          <div className="eyebrow">IDEAS INTO PROGRESS</div>
          <h1>
            Backlog{" "}
            <span className="heading-count">{project.tasks.length}</span>
          </h1>
          <p>A clear view of what’s next, what’s moving, and what’s ready.</p>
        </div>
        {owner && (
          <button className="primary" onClick={() => setCreate(true)}>
            <Plus size={18} />
            New task
          </button>
        )}
      </div>
      <div className="backlog-toolbar">
        <div className="segmented">
          <button
            className={view === "board" ? "selected" : ""}
            onClick={() => {
              setView("board");
              saveFilter("view", "board");
            }}
          >
            <Columns3 size={16} />
            Board
          </button>
          <button
            className={view === "list" ? "selected" : ""}
            onClick={() => {
              setView("list");
              saveFilter("view", "list");
            }}
          >
            <List size={16} />
            List
          </button>
        </div>
        <label className="search">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              saveFilter("q", e.target.value);
            }}
            placeholder="Search tasks…"
            aria-label="Search tasks"
          />
        </label>
        <button
          className={filters ? "selected" : ""}
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal size={16} />
          Filters
          {(priority || assignee || screen || blocked) && (
            <span className="tiny-dot" />
          )}
        </button>
        <span className="toolbar-count">{tasks.length} tasks</span>
      </div>
      <div className="status-tabs">
        <button
          className={!status ? "selected" : ""}
          onClick={() => {
            setStatus("");
            saveFilter("status", "");
          }}
        >
          All tasks
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            className={status === s ? "selected" : ""}
            onClick={() => {
              setStatus(s);
              saveFilter("status", s);
            }}
          >
            <StatusIcon status={s} />
            {s}
          </button>
        ))}
      </div>
      {filters && (
        <div className="filter-panel">
          <Field label="Priority">
            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                saveFilter("priority", e.target.value);
              }}
            >
              <option value="">All priorities</option>
              {priorities.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Assignee">
            <select
              value={assignee}
              onChange={(e) => {
                setAssignee(e.target.value);
                saveFilter("assignee", e.target.value);
              }}
            >
              <option value="">Everyone</option>
              {[
                ...new Set(
                  project.tasks.map((t) => t.assignee).filter(Boolean),
                ),
              ].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Linked screen">
            <select
              value={screen}
              onChange={(e) => {
                setScreen(e.target.value);
                saveFilter("filterScreen", e.target.value);
              }}
            >
              <option value="">All screens</option>
              {project.screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={blocked}
              onChange={(e) => {
                setBlocked(e.target.checked);
                saveFilter("blocked", e.target.checked ? "1" : "");
              }}
            />
            Blocked only
          </label>
        </div>
      )}
      <ErrorNotice error={error} />
      {view === "board" ? (
        <div className="board">
          {statuses.map((s) => (
            <section
              className="column"
              key={s}
              aria-label={s}
              onDragOver={(e) => owner && e.preventDefault()}
              onDrop={(e) => owner && void drop(e, s)}
            >
              <header>
                <span className={`column-dot ${s.replaceAll(" ", "-")}`}>
                  <StatusIcon status={s} />
                </span>
                <h2>{s}</h2>
                <span className="column-count">
                  {tasks.filter((t) => t.status === s).length}
                </span>
                {owner && s === "To do" && (
                  <button
                    className="icon-button"
                    aria-label="Add task to To do"
                    onClick={() => setCreate(true)}
                  >
                    <Plus size={17} />
                  </button>
                )}
              </header>
              <div className="column-cards">
                {tasks
                  .filter((t) => t.status === s)
                  .map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      project={project}
                      onClick={() => openTask(t.id)}
                      draggable={owner}
                    />
                  ))}
                {!tasks.some((t) => t.status === s) && (
                  <div className="column-empty">
                    {s === "To do"
                      ? "Room for your next idea."
                      : s === "In progress"
                        ? "Ready when you are."
                        : s === "Done"
                          ? "Completed work lands here."
                          : "Reviewed and ready to go."}
                  </div>
                )}
                {owner && s === "To do" && (
                  <button className="add-card" onClick={() => setCreate(true)}>
                    <Plus size={16} />
                    Add task
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="task-list">
          <div className="list-header">
            <span>Task</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Assignee</span>
          </div>
          {tasks.map((t) => (
            <button
              className="task-row"
              key={t.id}
              onClick={() => openTask(t.id)}
            >
              <div>
                <small>{t.readableId}</small>
                <strong>{t.title}</strong>
                {t.blockerReason && (
                  <span className="blocked">
                    <AlertCircle size={13} />
                    Blocked
                  </span>
                )}
              </div>
              <Status status={t.status} />
              <span className={`priority ${t.priority.toLowerCase()}`}>
                <Flag size={13} />
                {t.priority}
              </span>
              <span className="assignee">
                <span className="avatar small">
                  {(t.assignee || "?").slice(0, 2)}
                </span>
                {t.assignee || "Unassigned"}
              </span>
            </button>
          ))}
          {!tasks.length && (
            <Empty
              title={
                project.tasks.length
                  ? "No matching tasks"
                  : "Start with one small task"
              }
            >
              {project.tasks.length
                ? "Try adjusting your search or filters."
                : "Add a task, then fill in the details as the work takes shape."}
            </Empty>
          )}
        </div>
      )}
      <div className="board-footnote">
        <span>
          <CheckCheckIcon />
          Done means implementation is complete. Done reviewed means a human has
          checked it.
        </span>
      </div>
      {create && (
        <CreateTask
          project={project}
          onClose={() => setCreate(false)}
          onCreated={async () => {
            setCreate(false);
            await refresh();
          }}
        />
      )}
    </>
  );
}
function CheckCheckIcon() {
  return <ArrowUpRight size={14} />;
}
function TaskCard({
  task: t,
  project,
  onClick,
  draggable,
}: {
  task: Task;
  project: Project;
  onClick: () => void;
  draggable: boolean;
}) {
  const screen = project.screens.find((s) => t.screenIds.includes(s.id));
  return (
    <button
      className="task-card"
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
      onClick={onClick}
    >
      <div className="card-meta">
        <span>{t.readableId}</span>
        <span className={`priority ${t.priority.toLowerCase()}`}>
          <Flag size={12} />
          {t.priority}
        </span>
      </div>
      <h3>{t.title}</h3>
      {t.blockerReason && (
        <span className="blocked">
          <AlertCircle size={13} />
          Blocked · {t.blockerReason}
        </span>
      )}
      {screen && (
        <span className="linked-screen">
          <ImageIcon size={13} />
          {screen.title}
          {t.screenIds.length > 1 ? ` +${t.screenIds.length - 1}` : ""}
        </span>
      )}
      <div className="card-footer">
        <span className="assignee">
          <span
            className={`avatar small ${t.assignee.includes("AI") ? "ai" : ""}`}
          >
            {(t.assignee || "?").slice(0, 2)}
          </span>
          {t.assignee || "Unassigned"}
        </span>
        {t.status === "Done reviewed" && (
          <span className="reviewed-text">Reviewed ✓</span>
        )}
        {t.status === "Done" && <span className="muted">Needs review</span>}
      </div>
    </button>
  );
}
export function CreateTask({
  project,
  onClose,
  onCreated,
  sourceCommentId,
  initialTitle = "",
  initialDescription = "",
  screenId,
}: {
  project: Project;
  onClose: () => void;
  onCreated: (id?: string) => void;
  sourceCommentId?: string;
  initialTitle?: string;
  initialDescription?: string;
  screenId?: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title="New task"
      description="Start with a title. Add the details when you’re ready."
      onClose={onClose}
    >
      <form
        className="panel-body"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            const result = await write<{ id: string }[]>(
              `projects/${project.id}/tasks`,
              {
                tasks: [
                  {
                    title: f.get("title"),
                    description: f.get("description") || "",
                    acceptanceCriteria: f.get("criteria") || "",
                    priority: f.get("priority") || "Medium",
                    sourceCommentId,
                    screenIds: screenId ? [screenId] : [],
                  },
                ],
              },
              "POST",
              true,
            );
            onCreated(result[0].id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Task title">
          <input
            name="title"
            required
            maxLength={200}
            autoFocus
            placeholder="What needs to happen?"
            defaultValue={initialTitle}
          />
        </Field>
        <details open={!!initialDescription}>
          <summary>Add details</summary>
          <Field label="Description">
            <textarea
              name="description"
              defaultValue={initialDescription}
              rows={5}
            />
          </Field>
          <Field label="Acceptance criteria">
            <textarea
              name="criteria"
              rows={3}
              placeholder="How will we know it’s ready?"
            />
          </Field>
          <Field label="Priority">
            <select name="priority" defaultValue="Medium">
              {priorities.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
        </details>
        <ErrorNotice error={error} />
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
