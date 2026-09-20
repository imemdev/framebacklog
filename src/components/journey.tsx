"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Plus,
  List,
  Network,
  ArrowRight,
  MessageSquare,
  ImageIcon,
} from "lucide-react";
import type { Actor, Project } from "@/lib/model";
import { write, Modal, Field, ErrorNotice, Empty } from "./ui";
const Canvas = dynamic(() => import("./journey-canvas"), {
  ssr: false,
  loading: () => <div className="loading">Loading canvas…</div>,
});
export default function JourneyPage({
  project,
  actor,
  refresh,
  openScreen,
}: {
  project: Project;
  actor: Actor;
  refresh: () => Promise<void>;
  openScreen: (id: string) => void;
}) {
  const [selected, setSelected] = useState(project.journeys[0]?.id || ""),
    [view, setView] = useState("screens"),
    [modal, setModal] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const journey =
    project.journeys.find((j) => j.id === selected) || project.journeys[0];
  const owner = actor.role === "owner";
  const screens = journey
    ? journey.nodes
        .map((n) => project.screens.find((s) => s.id === n.screenId)!)
        .filter(Boolean)
    : project.screens;
  return (
    <>
      <div className="heading-row">
        <div className="page-heading">
          <div className="eyebrow">THE BIG PICTURE</div>
          <h1>User journey</h1>
          <p>
            See how the experience connects. Review it one screen at a time.
          </p>
        </div>
        {owner && (
          <button className="primary" onClick={() => setModal("screen")}>
            <Plus size={18} />
            Add screen
          </button>
        )}
      </div>
      <div className="journey-toolbar">
        <select
          aria-label="Journey"
          value={journey?.id || ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="" disabled>
            Select a journey
          </option>
          {project.journeys.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
        {owner && (
          <button onClick={() => setModal("journey")}>
            <Plus size={16} />
            New journey
          </button>
        )}
        <div className="segmented">
          <button
            className={view === "screens" ? "selected" : ""}
            onClick={() => setView("screens")}
          >
            <List size={16} />
            Screens
          </button>
          <button
            className={view === "canvas" ? "selected" : ""}
            onClick={() => setView("canvas")}
          >
            <Network size={16} />
            Canvas
          </button>
        </div>
      </div>
      {journey && (
        <p className="journey-caption">
          {journey.nodes.length} screens · {journey.edges.length} connections{" "}
          <span>Choose a screen to preview, comment, or review.</span>
        </p>
      )}
      {view === "canvas" && journey ? (
        <Canvas
          key={journey.id}
          journey={journey}
          project={project}
          editable={owner}
          refresh={refresh}
          openScreen={openScreen}
        />
      ) : (
        <div className="screen-grid">
          {screens.map((s, i) => {
            const v = s.versions.at(-1)!;
            const node = journey?.nodes.find((n) => n.screenId === s.id);
            const next = journey?.edges.filter((e) => e.source === node?.id);
            return (
              <article className="screen-card" key={s.id}>
                <button
                  className="screen-open"
                  onClick={() => openScreen(s.id)}
                >
                  <div className="screen-thumb">
                    {v.key ? (
                      <img
                        alt={s.title}
                        src={`/api/v1/projects/${project.id}/files/${v.key}`}
                      />
                    ) : (
                      <div className="placeholder">
                        <ImageIcon size={32} />
                        <span>Screen in progress</span>
                        <small>A place for what’s coming next</small>
                      </div>
                    )}
                    <span className="screen-index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="screen-info">
                    <div className="card-meta">
                      <span>VERSION {v.number}</span>
                      <span
                        className={`review-status ${v.status === "Approved" ? "approved" : v.status === "Changes requested" ? "changes" : ""}`}
                      >
                        {v.status === "Approved"
                          ? "✓ "
                          : v.status === "Changes requested"
                            ? "↩ "
                            : "◷ "}
                        {v.status}
                      </span>
                    </div>
                    <h3>{s.title}</h3>
                    <div className="screen-stats">
                      <span>
                        <MessageSquare size={14} />
                        {
                          project.comments.filter(
                            (c) =>
                              c.versionId === v.id &&
                              !c.resolved &&
                              !c.parentId,
                          ).length
                        }{" "}
                        open
                      </span>
                      <span>
                        {
                          project.tasks.filter((t) =>
                            t.screenIds.includes(s.id),
                          ).length
                        }{" "}
                        linked tasks
                      </span>
                    </div>
                  </div>
                </button>
                {!!next?.length && (
                  <div className="next-screens">
                    <small>NEXT SCREENS</small>
                    {next.map((e) => {
                      const n = journey?.nodes.find((n) => n.id === e.target);
                      const dest = project.screens.find(
                        (s) => s.id === n?.screenId,
                      );
                      return (
                        dest && (
                          <button
                            key={e.id}
                            onClick={() => openScreen(dest.id)}
                          >
                            {e.label || dest.title}
                            <ArrowRight size={14} />
                          </button>
                        )
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
          {!screens.length && (
            <Empty
              title="Map the first step"
              action={
                owner && (
                  <button
                    className="primary"
                    onClick={() => setModal("screen")}
                  >
                    Add a screen
                  </button>
                )
              }
            >
              Start with a placeholder or upload a screenshot. Connect screens
              when the journey takes shape.
            </Empty>
          )}
        </div>
      )}
      {modal && (
        <Modal
          title={modal === "screen" ? "Add a screen" : "New journey"}
          onClose={() => setModal("")}
        >
          <form
            className="panel-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                if (modal === "journey") {
                  const j = await write<{ id: string }>(
                    `projects/${project.id}/journeys`,
                    { name: f.get("title") },
                  );
                  setSelected(j.id);
                } else {
                  await write(`projects/${project.id}/screens`, {
                    title: f.get("title"),
                    journeyId: journey?.id,
                  });
                }
                await refresh();
                setModal("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label={modal === "screen" ? "Screen title" : "Journey name"}>
              <input
                name="title"
                required
                autoFocus
                maxLength={100}
                placeholder={
                  modal === "screen"
                    ? "e.g. Create project"
                    : "e.g. First-time onboarding"
                }
              />
            </Field>
            <p className="muted">
              {modal === "screen"
                ? "A placeholder gives your idea a home. Open the screen to upload its first screenshot."
                : "Keep each journey focused on a goal your users want to accomplish."}
            </p>
            <ErrorNotice error={error} />
            <button className="primary" disabled={busy}>
              {modal === "screen" ? "Add screen" : "Create journey"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
