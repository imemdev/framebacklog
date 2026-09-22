"use client";
import { can } from "@/lib/access";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  MapPin,
  MessageSquare,
  Check,
  Plus,
  ImageIcon,
  CheckCircle2,
  Maximize2,
  Trash2,
} from "lucide-react";
import {
  screenVersions,
  type Actor,
  type Project,
  type Screen,
} from "@/lib/model";
import { Modal, Field, ErrorNotice, api, write, stamp } from "./ui";
import { CreateTask } from "./backlog";
export default function ScreenPanel({
  screen,
  project,
  actor,
  onClose,
  refresh,
  openScreen,
  openTask,
}: {
  screen: Screen;
  project: Project;
  actor: Actor;
  onClose: () => void;
  refresh: () => Promise<void>;
  openScreen: (id: string) => void;
  openTask: (id: string) => void;
}) {
  const [versionId, setVersionId] = useState(screenVersions(screen)[0].id),
    [screenTitle, setScreenTitle] = useState(screen.title),
    [pinMode, setPinMode] = useState(false),
    [activePin, setActivePin] = useState(""),
    [pin, setPin] = useState<{ x: number; y: number }>(),
    [text, setText] = useState(""),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [reply, setReply] = useState(""),
    [createComment, setCreateComment] = useState(""),
    [showResolved, setShowResolved] = useState(false),
    [focus, setFocus] = useState(false),
    [uploadMode, setUploadMode] = useState<"image" | "version">("image");
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => setScreenTitle(screen.title), [screen.title]);
  const v =
    screen.versions.find((v) => v.id === versionId) || screen.versions.at(-1)!;
  const versions = screenVersions(screen);
  const index = versions.findIndex((version) => version.id === v.id);
  function selectVersion(id: string) {
    setVersionId(id);
    setActivePin("");
    setPin(undefined);
    setPinMode(false);
    setReply("");
    setText("");
    setFeedback("");
    setNotice("");
  }
  const old = v.id !== screen.versions.at(-1)!.id;
  const owner = can(actor, project.id, "tasks");
  const comments = project.comments.filter((c) => c.versionId === v.id);
  // Number all pinned root threads in creation order, including hidden resolved ones.
  const pinNumbers = new Map(
    comments.filter((c) => c.pin && !c.parentId).map((c, i) => [c.id, i + 1]),
  );
  function revealPin(id: string, target: "pin" | "comment") {
    setActivePin(id);
    const element = document.getElementById(`${target}-${id}`);
    element?.scrollIntoView({ behavior: "instant", block: "center" });
    element?.focus({ preventScroll: true });
  }
  const roots = comments.filter(
    (c) => !c.parentId && (showResolved || !c.resolved),
  );
  const journey = project.journeys.find((j) =>
    j.nodes.some((n) => n.screenId === screen.id),
  );
  const node = journey?.nodes.find((n) => n.screenId === screen.id);
  const next = journey?.edges.filter((e) => e.source === node?.id) || [];
  const prev = journey?.edges.filter((e) => e.target === node?.id) || [];
  const linked = project.tasks.filter((t) => t.screenIds.includes(screen.id));
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      setNotice("Saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function chooseUpload(mode: "image" | "version") {
    setUploadMode(mode);
    fileInput.current?.click();
  }
  function saveTitle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = screenTitle.trim();
    if (!title || title === screen.title) return;
    void run(() =>
      write(`projects/${project.id}/screens/${screen.id}`, { title }, "PATCH"),
    );
  }
  async function deleteScreen() {
    if (
      !window.confirm(
        `Delete “${screen.title}”? Its image files, comments, journey links, and task links will be removed.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`projects/${project.id}/screens/${screen.id}`, {
        method: "DELETE",
      });
      await refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Modal
        title={screen.title}
        description="Screen preview, feedback, and review"
        wide
        onClose={onClose}
      >
        <div className="screen-panel-toolbar">
          <select
            aria-label="Screen version"
            value={versionId}
            onChange={(e) => selectVersion(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                Version {v.number}
                {v.id === screen.versions.at(-1)!.id ? " · Latest" : ""}
              </option>
            ))}
          </select>
          <span
            className={`review-status ${v.status === "Approved" ? "approved" : v.status === "Changes requested" ? "changes" : ""}`}
          >
            {v.status}
          </span>
          <button onClick={() => setFocus(!focus)}>
            <Maximize2 size={16} />
            {focus ? "Split view" : "Focus preview"}
          </button>
          {can(actor, project.id, "upload") && (
            <>
              <button
                className="upload-button"
                disabled={busy}
                onClick={() => chooseUpload("image")}
              >
                <Upload size={16} />
                {v.key ? "Replace image" : "Upload image"}
              </button>
              {v.key && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Remove the image from Version ${v.number}? Its version and feedback history will remain.`,
                      )
                    )
                      return;
                    void run(() =>
                      api(
                        `projects/${project.id}/screens/${screen.id}/versions/${v.id}/image`,
                        {
                          method: "DELETE",
                          headers: {
                            "If-Match": String(screen.imageVersion ?? 0),
                          },
                        },
                      ),
                    );
                  }}
                >
                  <Trash2 size={16} />
                  Remove image
                </button>
              )}
              <button disabled={busy} onClick={() => chooseUpload("version")}>
                <Plus size={16} />
                New version
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = "";
                  void run(async () => {
                    if (file.size > 5 * 1024 * 1024)
                      throw new Error("Choose an image smaller than 5 MB.");
                    if (uploadMode === "version") {
                      const created = await api<{ id: string }>(
                        `projects/${project.id}/screens/${screen.id}/versions`,
                        {
                          method: "POST",
                          body: file,
                          headers: {
                            "Content-Type": file.type,
                            "If-Match": String(screen.versions.length),
                          },
                        },
                      );
                      setVersionId(created.id);
                    } else {
                      await api(
                        `projects/${project.id}/screens/${screen.id}/versions/${v.id}/image`,
                        {
                          method: "PUT",
                          body: file,
                          headers: {
                            "Content-Type": file.type,
                            "If-Match": String(screen.imageVersion ?? 0),
                          },
                        },
                      );
                    }
                  });
                }}
              />
            </>
          )}
        </div>
        <section className="version-carousel" aria-label="Screen versions">
          <div className="carousel-controls">
            <button
              aria-label="Previous version"
              disabled={index === 0 || busy}
              onClick={() => selectVersion(versions[index - 1].id)}
            >
              <ArrowLeft size={18} />
            </button>
            <span aria-live="polite">
              Version {v.number} · {index + 1} of {versions.length}
            </span>
            <button
              aria-label="Next version"
              disabled={index === versions.length - 1 || busy}
              onClick={() => selectVersion(versions[index + 1].id)}
            >
              <ArrowRight size={18} />
            </button>
            <button
              className="recommend-button"
              disabled={
                busy ||
                !can(actor, project.id, "screen-review") ||
                screen.recommendation?.versionId === v.id
              }
              onClick={() =>
                void run(() =>
                  write(
                    `projects/${project.id}/screens/${screen.id}/recommend`,
                    {
                      versionId: v.id,
                      version: screen.recommendationVersion || 0,
                    },
                  ),
                )
              }
            >
              <CheckCircle2 size={18} />
              {screen.recommendation?.versionId === v.id
                ? "Recommended screen"
                : "Recommend this screen"}
            </button>
          </div>
          {versions.length > 1 && (
            <div className="version-filmstrip" aria-label="Choose a version">
              {versions.map((version) => (
                <button
                  key={version.id}
                  aria-label={`Preview version ${version.number}`}
                  aria-pressed={version.id === v.id}
                  onClick={() => selectVersion(version.id)}
                >
                  {version.key ? (
                    <img
                      alt=""
                      src={`/api/v1/projects/${project.id}/files/${version.key}`}
                    />
                  ) : (
                    <ImageIcon />
                  )}
                  <span>
                    Version {version.number}
                    {screen.recommendation?.versionId === version.id
                      ? " · Recommended"
                      : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
          {screen.recommendation && (
            <p className="recommendation-note">
              Recommended by {screen.recommendation.actor}. Shown first in the
              stack.
            </p>
          )}
        </section>
        {old && (
          <div className="notice warning">
            You’re viewing an older version. Feedback and decisions stay with
            this image.
          </div>
        )}
        <div className={`screen-review-layout ${focus ? "focused" : ""}`}>
          <div className="preview-area">
            <div className="preview-tools">
              <span className="muted">
                {pinMode
                  ? "Tap the image to place a pin."
                  : "Review the details at your own pace."}
              </span>
              <button
                disabled={!v.key || !can(actor, project.id, "comment")}
                className={pinMode ? "selected" : ""}
                onClick={() => {
                  setPinMode(!pinMode);
                  setPin(undefined);
                }}
              >
                <MapPin size={16} />
                {pinMode ? "Cancel pin" : "Add pin"}
              </button>
            </div>
            {pinMode && (
              <button
                onClick={() => {
                  setPin({ x: 0.5, y: 0.5 });
                  setPinMode(false);
                  input.current?.focus();
                }}
              >
                Place pin at center (keyboard)
              </button>
            )}
            <div className={`image-stage ${pinMode ? "pinning" : ""}`}>
              {v.key ? (
                <div
                  className="image-relative"
                  onClick={(e) => {
                    if (!pinMode) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    setPin({
                      x: (e.clientX - rect.left) / rect.width,
                      y: (e.clientY - rect.top) / rect.height,
                    });
                    setPinMode(false);
                    input.current?.focus();
                  }}
                >
                  <img
                    alt={`${screen.title}, version ${v.number}`}
                    src={`/api/v1/projects/${project.id}/files/${v.key}`}
                  />
                  {roots
                    .filter((c) => c.pin)
                    .map((c) => (
                      <button
                        id={`pin-${c.id}`}
                        className={`pin ${activePin === c.id ? "active-pin" : ""}`}
                        aria-label={`View pin ${pinNumbers.get(c.id)}: ${c.text}`}
                        key={c.id}
                        style={{
                          left: `${c.pin!.x * 100}%`,
                          top: `${c.pin!.y * 100}%`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          revealPin(c.id, "comment");
                        }}
                      >
                        {pinNumbers.get(c.id)}
                      </button>
                    ))}
                  {pin && (
                    <span
                      className="pin pending"
                      style={{
                        left: `${pin.x * 100}%`,
                        top: `${pin.y * 100}%`,
                      }}
                    >
                      +
                    </span>
                  )}
                </div>
              ) : (
                <div className="placeholder large">
                  <ImageIcon size={44} />
                  <h3>A screen is taking shape</h3>
                  <p>Upload a screenshot when it’s ready for a closer look.</p>
                </div>
              )}
            </div>
            <div className="screen-navigation">
              {prev.map((e) => {
                const dest = journey?.nodes.find((n) => n.id === e.source);
                return (
                  dest && (
                    <button
                      key={e.id}
                      onClick={() => openScreen(dest.screenId)}
                    >
                      <ArrowLeft size={16} />
                      {
                        project.screens.find((s) => s.id === dest.screenId)
                          ?.title
                      }
                    </button>
                  )
                );
              })}
              {!prev.length && <span className="muted">Journey start</span>}
              <div>
                <small>
                  {next.length > 1 ? "CHOOSE THE NEXT SCREEN" : "NEXT SCREEN"}
                </small>
                {next.map((e) => {
                  const dest = journey?.nodes.find((n) => n.id === e.target);
                  return (
                    dest && (
                      <button
                        key={e.id}
                        onClick={() => openScreen(dest.screenId)}
                      >
                        {e.label ||
                          project.screens.find((s) => s.id === dest.screenId)
                            ?.title}
                        <ArrowRight size={16} />
                      </button>
                    )
                  );
                })}
                {!next.length && (
                  <span className="muted">End of this path</span>
                )}
              </div>
            </div>
          </div>
          <aside className="screen-discussion">
            <ErrorNotice error={error} />
            <div className="save-message" role="status">
              {busy ? "Saving…" : notice}
            </div>
            {can(actor, project.id, "upload") && (
              <section className="screen-management">
                <h3>Screen settings</h3>
                <form onSubmit={saveTitle}>
                  <Field label="Screen title">
                    <input
                      value={screenTitle}
                      onChange={(e) => setScreenTitle(e.target.value)}
                      maxLength={150}
                    />
                  </Field>
                  <button disabled={busy || !screenTitle.trim()}>
                    Save title
                  </button>
                </form>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => void deleteScreen()}
                >
                  <Trash2 size={16} />
                  Delete screen
                </button>
              </section>
            )}
            <h3>
              <MessageSquare size={18} />
              Discussion <span className="count">{roots.length}</span>
            </h3>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
              />
              Show resolved threads
            </label>
            {!roots.length && (
              <p className="discussion-empty">
                A fresh perspective helps. Leave a note or pin feedback to a
                detail.
              </p>
            )}
            {roots.map((c) => (
              <article
                className={`comment ${c.resolved ? "resolved" : ""} ${activePin === c.id ? "active-comment" : ""}`}
                tabIndex={-1}
                id={`comment-${c.id}`}
                key={c.id}
              >
                <div className="comment-author">
                  <span className="avatar small">{c.actor.slice(0, 2)}</span>
                  <strong>{c.actor}</strong>
                  {c.pin ? (
                    <button
                      className="comment-pin-label"
                      aria-label={`Show pin ${pinNumbers.get(c.id)} on screen`}
                      onClick={() => revealPin(c.id, "pin")}
                    >
                      <span>{pinNumbers.get(c.id)}</span> Pin{" "}
                      {pinNumbers.get(c.id)}
                    </button>
                  ) : (
                    <span className="general-comment-label">
                      General comment
                    </span>
                  )}
                </div>
                <small>
                  {stamp(c.at)}
                  {c.resolved ? " · Resolved" : ""}
                </small>
                <p>{c.text}</p>
                {can(actor, project.id, "comment") && (
                  <div className="comment-actions">
                    <button
                      onClick={() => {
                        setReply(c.id);
                        input.current?.focus();
                      }}
                    >
                      Reply
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          write(
                            `projects/${project.id}/comments/${c.id}`,
                            { resolved: !c.resolved },
                            "PATCH",
                          ),
                        )
                      }
                    >
                      {c.resolved ? "Reopen" : "Resolve"}
                    </button>
                    {owner &&
                      (project.tasks.some((t) => t.sourceCommentId === c.id) ? (
                        <button
                          onClick={() =>
                            openTask(
                              project.tasks.find(
                                (t) => t.sourceCommentId === c.id,
                              )!.id,
                            )
                          }
                        >
                          View linked task
                        </button>
                      ) : (
                        <button onClick={() => setCreateComment(c.id)}>
                          <Plus size={13} />
                          Create task
                        </button>
                      ))}
                  </div>
                )}
                {comments
                  .filter((r) => r.parentId === c.id)
                  .map((r) => (
                    <div className="reply" key={r.id}>
                      <strong>{r.actor}</strong>
                      <p>{r.text}</p>
                      <small>{stamp(r.at)}</small>
                    </div>
                  ))}
              </article>
            ))}
            {can(actor, project.id, "comment") && (
              <form
                className="comment-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await write(`projects/${project.id}/comments`, {
                      screenId: screen.id,
                      versionId: v.id,
                      text,
                      pin: reply ? undefined : pin,
                      parentId: reply || undefined,
                    });
                    setText("");
                    setPin(undefined);
                    setReply("");
                  });
                }}
              >
                {(pin || reply) && (
                  <div className="notice">
                    {reply ? "Replying to a thread" : "Pinned to this image"}
                    <button
                      type="button"
                      onClick={() => {
                        setPin(undefined);
                        setReply("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {pin && (
                  <div className="field-row">
                    <Field label="Pin horizontal (%)">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={Math.round(pin.x * 100)}
                        onChange={(e) =>
                          setPin({
                            ...pin,
                            x: Math.max(
                              0,
                              Math.min(1, Number(e.target.value) / 100),
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label="Pin vertical (%)">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={Math.round(pin.y * 100)}
                        onChange={(e) =>
                          setPin({
                            ...pin,
                            y: Math.max(
                              0,
                              Math.min(1, Number(e.target.value) / 100),
                            ),
                          })
                        }
                      />
                    </Field>
                  </div>
                )}
                <Field label={reply ? "Your reply" : "Add a comment"}>
                  <textarea
                    ref={input}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    required
                    rows={3}
                    maxLength={4000}
                    placeholder="What works well? What could be clearer?"
                  />
                </Field>
                <button className="primary" disabled={busy || !text.trim()}>
                  {reply ? "Post reply" : "Post comment"}
                </button>
              </form>
            )}
            {can(actor, project.id, "screen-review") && (
              <section className="screen-decision">
                <h3>Your review</h3>
                <p className="muted">
                  Your decision applies to version {v.number} only.
                </p>
                <Field
                  label="Review note"
                  hint="Required when requesting changes."
                >
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={2}
                  />
                </Field>
                <div className="form-actions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        write(
                          `projects/${project.id}/screens/${screen.id}/review`,
                          {
                            versionId: v.id,
                            reviewVersion: v.reviews.length,
                            decision: "Approved",
                            feedback,
                          },
                        ),
                      )
                    }
                  >
                    <Check size={17} />
                    Approve
                  </button>
                  <button
                    disabled={busy || !feedback.trim()}
                    onClick={() =>
                      void run(() =>
                        write(
                          `projects/${project.id}/screens/${screen.id}/review`,
                          {
                            versionId: v.id,
                            reviewVersion: v.reviews.length,
                            decision: "Changes requested",
                            feedback,
                          },
                        ),
                      )
                    }
                  >
                    Request changes
                  </button>
                </div>
              </section>
            )}
            {can(actor, project.id, "view-backlog") && (
              <section>
                <h3>
                  Linked tasks <span className="count">{linked.length}</span>
                </h3>
                {linked.map((t) => (
                  <button
                    className="linked-item"
                    key={t.id}
                    onClick={() => openTask(t.id)}
                  >
                    <CheckCircle2 size={15} />
                    {t.readableId} · {t.title}
                  </button>
                ))}
                {!linked.length && (
                  <p className="muted">No tasks linked yet.</p>
                )}
              </section>
            )}
            <details>
              <summary>Review history & activity</summary>
              {v.reviews.map((r, i) => (
                <div className="history-item" key={i}>
                  <strong>{r.decision}</strong>
                  <small>
                    {r.actor} · {stamp(r.at)}
                  </small>
                  <p>{r.feedback || "No additional note."}</p>
                </div>
              ))}
              {project.activity
                .filter((e) => e.entityId === screen.id)
                .toReversed()
                .slice(0, 20)
                .map((e) => (
                  <div className="history-item" key={e.cursor}>
                    <strong>{e.action}</strong>
                    <small>
                      {e.actor} · {stamp(e.at)}
                    </small>
                  </div>
                ))}
            </details>
          </aside>
        </div>
      </Modal>
      {createComment && (
        <CreateTask
          project={project}
          sourceCommentId={createComment}
          screenId={screen.id}
          initialTitle={project.comments
            .find((c) => c.id === createComment)!
            .text.slice(0, 100)}
          initialDescription={
            project.comments.find((c) => c.id === createComment)!.text
          }
          onClose={() => setCreateComment("")}
          onCreated={async () => {
            setCreateComment("");
            await refresh();
          }}
        />
      )}
    </>
  );
}
