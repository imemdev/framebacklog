"use client";
import { useState } from "react";
import {
  CheckCheck,
  CheckCircle2,
  ImageIcon,
  MessageSquare,
  ArrowUpRight,
} from "lucide-react";
import { priorities, type Actor, type Project, type Task } from "@/lib/model";
import { Modal, Field, ErrorNotice, Status, write, stamp, api } from "./ui";
export default function TaskPanel({
  task,
  project,
  actor,
  onClose,
  refresh,
  openScreen,
}: {
  task: Task;
  project: Project;
  actor: Actor;
  onClose: () => void;
  refresh: () => Promise<void>;
  openScreen: (id: string) => void;
}) {
  const [draft, setDraft] = useState(task),
    [tab, setTab] = useState("details"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [comment, setComment] = useState(""),
    [summary, setSummary] = useState(""),
    [verification, setVerification] = useState("");
  const owner = actor.role === "owner";
  const editable = owner && ["To do", "In progress"].includes(task.status);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      const updated = await api<Task>(
        `projects/${project.id}/tasks/${task.id}`,
      );
      if (updated.status !== task.status) setDraft(updated);
      await refresh();
      setMessage("Saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const patch = (key: keyof Task, value: string | string[]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const progressPath = `projects/${project.id}/tasks/${task.id}`;
  return (
    <Modal
      title={task.readableId}
      description="Task details and review"
      onClose={onClose}
    >
      <div className="panel-body">
        <div className="task-title-row">
          <Status status={task.status} />
          <span className="muted">Version {task.version}</span>
        </div>
        <h1 className="detail-title">{task.title}</h1>
        <div className="tabs">
          <button
            className={tab === "details" ? "selected" : ""}
            onClick={() => setTab("details")}
          >
            Requirements & progress
          </button>
          <button
            className={tab === "activity" ? "selected" : ""}
            onClick={() => setTab("activity")}
          >
            Activity{" "}
            <span className="count">
              {project.activity.filter((a) => a.entityId === task.id).length}
            </span>
          </button>
        </div>
        <ErrorNotice error={error} />
        {error && (
          <button
            onClick={async () => {
              await refresh();
              setMessage(
                "Latest server version loaded. Your draft is retained. Compare before saving.",
              );
            }}
          >
            Reload latest version
          </button>
        )}
        {draft.version !== task.version && (
          <div className="notice warning">
            The server has version {task.version}; your draft started at version{" "}
            {draft.version}.
            <button
              onClick={() => setDraft((d) => ({ ...d, version: task.version }))}
            >
              Use latest version for this draft
            </button>
            <button onClick={() => setDraft(task)}>
              Discard draft & reload
            </button>
          </div>
        )}
        <div className="save-message" role="status">
          {busy ? "Saving…" : message}
        </div>
        {tab === "activity" ? (
          <div className="activity-list">
            {project.activity
              .filter((a) => a.entityId === task.id)
              .toReversed()
              .map((a) => (
                <div className="activity" key={a.cursor}>
                  <span className="activity-dot" />
                  <div>
                    <strong>{a.action}</strong>
                    <small>
                      {a.actor} · {stamp(a.at)}
                    </small>
                    <p>{a.detail}</p>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <>
            {editable ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const result = await write<{ version: number }>(
                      `${progressPath}/progress`,
                      {
                        version: draft.version,
                        title: draft.title,
                        description: draft.description,
                        acceptanceCriteria: draft.acceptanceCriteria,
                        status: draft.status,
                        priority: draft.priority,
                        assignee: draft.assignee,
                        progressSummary: draft.progressSummary,
                        remainingWork: draft.remainingWork,
                        nextStep: draft.nextStep,
                        blockerReason: draft.blockerReason,
                        dependencies: draft.dependencies,
                        screenIds: draft.screenIds,
                      },
                      "PATCH",
                    );
                    setDraft((d) => ({ ...d, version: result.version }));
                  });
                }}
              >
                <Field label="Title">
                  <input
                    value={draft.title}
                    required
                    onChange={(e) => patch("title", e.target.value)}
                  />
                </Field>
                <div className="field-row">
                  <Field label="Status">
                    <select
                      value={draft.status}
                      onChange={(e) => patch("status", e.target.value)}
                    >
                      <option>To do</option>
                      <option>In progress</option>
                    </select>
                  </Field>
                  <Field label="Priority">
                    <select
                      value={draft.priority}
                      onChange={(e) => patch("priority", e.target.value)}
                    >
                      {priorities.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Assignee">
                  <input
                    value={draft.assignee}
                    onChange={(e) => patch("assignee", e.target.value)}
                    placeholder="Name or AI service identity"
                    list="assignees"
                  />
                  <datalist id="assignees">
                    {[
                      actor.name,
                      ...new Set(project.tasks.map((t) => t.assignee)),
                    ].map((a, i) => (
                      <option key={i} value={a} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Description">
                  <textarea
                    value={draft.description}
                    onChange={(e) => patch("description", e.target.value)}
                    rows={4}
                  />
                </Field>
                <Field label="Acceptance criteria">
                  <textarea
                    value={draft.acceptanceCriteria}
                    onChange={(e) =>
                      patch("acceptanceCriteria", e.target.value)
                    }
                    rows={3}
                    placeholder="What does a good result look like?"
                  />
                </Field>
                <h3 className="section-title">
                  Keep the next person up to date
                </h3>
                <Field label="Progress summary">
                  <textarea
                    value={draft.progressSummary}
                    onChange={(e) => patch("progressSummary", e.target.value)}
                    rows={3}
                  />
                </Field>
                <Field label="Remaining work">
                  <textarea
                    value={draft.remainingWork}
                    onChange={(e) => patch("remainingWork", e.target.value)}
                    rows={2}
                  />
                </Field>
                <Field label="Next step">
                  <input
                    value={draft.nextStep}
                    onChange={(e) => patch("nextStep", e.target.value)}
                  />
                </Field>
                <Field
                  label="Blocker reason"
                  hint="Leave blank if this task is not blocked."
                >
                  <input
                    value={draft.blockerReason}
                    onChange={(e) => patch("blockerReason", e.target.value)}
                  />
                </Field>
                <details>
                  <summary>Linked screens & dependencies</summary>
                  <Field
                    label="Linked screens"
                    hint="Select one or more screens."
                  >
                    <select
                      multiple
                      value={draft.screenIds}
                      onChange={(e) =>
                        patch(
                          "screenIds",
                          Array.from(e.target.selectedOptions, (o) => o.value),
                        )
                      }
                    >
                      {project.screens.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Depends on"
                    hint="Dependencies must be Done or Done reviewed before completion."
                  >
                    <select
                      multiple
                      value={draft.dependencies}
                      onChange={(e) =>
                        patch(
                          "dependencies",
                          Array.from(e.target.selectedOptions, (o) => o.value),
                        )
                      }
                    >
                      {project.tasks
                        .filter((t) => t.id !== task.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.readableId} · {t.title}
                          </option>
                        ))}
                    </select>
                  </Field>
                </details>
                <button className="primary" disabled={busy}>
                  Save task
                </button>
              </form>
            ) : (
              <>
                <section className="prose">
                  <h3>Description</h3>
                  <p>{task.description || "No description yet."}</p>
                  <h3>Acceptance criteria</h3>
                  <p>
                    {task.acceptanceCriteria ||
                      "No acceptance criteria recorded."}
                  </p>
                  <h3>Progress</h3>
                  <p>{task.progressSummary || "No progress recorded."}</p>
                  {task.remainingWork && (
                    <>
                      <h3>Remaining work</h3>
                      <p>{task.remainingWork}</p>
                    </>
                  )}
                  {task.nextStep && (
                    <>
                      <h3>Next step</h3>
                      <p>{task.nextStep}</p>
                    </>
                  )}
                </section>
              </>
            )}
            {task.screenIds.length > 0 && (
              <section>
                <h3 className="section-title">Linked screens</h3>
                {task.screenIds.map((id) => (
                  <button
                    key={id}
                    className="linked-item"
                    onClick={() => openScreen(id)}
                  >
                    <ImageIcon size={17} />
                    {project.screens.find((s) => s.id === id)?.title}
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </section>
            )}
            {task.sourceCommentId && (
              <section className="source-comment">
                <MessageSquare size={18} />
                <div>
                  <strong>Created from feedback</strong>
                  <p>
                    {
                      project.comments.find(
                        (c) => c.id === task.sourceCommentId,
                      )?.text
                    }
                  </p>
                  <small>
                    Completing this task does not resolve its source comment.
                  </small>
                </div>
              </section>
            )}
            {["Done", "Done reviewed"].includes(task.status) && (
              <section className="completion-card">
                <span className="eyebrow">COMPLETION RECORD</span>
                <h3>What changed</h3>
                <p>{task.completionSummary}</p>
                <h3>Verification</h3>
                <p>{task.verification}</p>
              </section>
            )}
            {editable && (
              <details
                className="completion-form"
                open={
                  typeof window !== "undefined" &&
                  new URLSearchParams(location.search).get("action") ===
                    "complete"
                    ? true
                    : undefined
                }
              >
                <summary>
                  <CheckCircle2 size={17} />
                  Mark implementation done
                </summary>
                <p className="muted">
                  Save your edits first. Record what changed and what was
                  actually checked.
                </p>
                <Field label="Completion summary">
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={3}
                  />
                </Field>
                <Field
                  label="Verification record"
                  hint="If a check was not run, say so and explain why."
                >
                  <textarea
                    value={verification}
                    onChange={(e) => setVerification(e.target.value)}
                    rows={3}
                  />
                </Field>
                <button
                  className="primary"
                  disabled={busy || !summary.trim() || !verification.trim()}
                  onClick={() =>
                    void run(() =>
                      write(
                        `${progressPath}/complete`,
                        {
                          version: task.version,
                          completionSummary: summary,
                          verification,
                        },
                        "POST",
                        true,
                      ),
                    )
                  }
                >
                  <CheckCircle2 size={16} />
                  Mark done
                </button>
              </details>
            )}
            {owner && ["Done", "Done reviewed"].includes(task.status) && (
              <section className="review-actions">
                <h3>
                  {task.status === "Done"
                    ? "Your review"
                    : "Reopen reviewed work"}
                </h3>
                <Field
                  label="Review feedback"
                  hint="Required when requesting changes or reopening."
                >
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={3}
                    placeholder="What should happen next?"
                  />
                </Field>
                <div className="form-actions">
                  {task.status === "Done" && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          write(`${progressPath}/review`, {
                            version: task.version,
                            decision: "approve",
                            feedback,
                          }),
                        )
                      }
                    >
                      <CheckCheck size={17} />
                      Mark done reviewed
                    </button>
                  )}
                  <button
                    disabled={busy || !feedback.trim()}
                    onClick={() =>
                      void run(() =>
                        write(`${progressPath}/review`, {
                          version: task.version,
                          decision:
                            task.status === "Done" ? "changes" : "reopen",
                          feedback,
                        }),
                      )
                    }
                  >
                    {task.status === "Done" ? "Request changes" : "Reopen task"}
                  </button>
                </div>
              </section>
            )}
            <section>
              <h3 className="section-title">Task discussion</h3>
              {(task.comments || []).map((c) => (
                <div className="history-item" key={c.id}>
                  <strong>{c.actor}</strong>
                  <small>{stamp(c.at)}</small>
                  <p>{c.text}</p>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await write(`${progressPath}/comments`, { text: comment });
                    setComment("");
                  });
                }}
              >
                <Field label="Task comment">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                    maxLength={4000}
                    rows={3}
                  />
                </Field>
                <button disabled={busy || !comment.trim()}>
                  Post task comment
                </button>
              </form>
            </section>
            {task.reviews.length > 0 && (
              <section>
                <h3 className="section-title">Review history</h3>
                {task.reviews.map((r, i) => (
                  <div className="history-item" key={i}>
                    <strong>
                      {r.decision === "approve"
                        ? "Done reviewed"
                        : r.decision === "changes"
                          ? "Changes requested"
                          : "Reopened"}
                    </strong>
                    <small>
                      {r.actor} · {stamp(r.at)}
                    </small>
                    <p>
                      {r.feedback || "Approved without an additional note."}
                    </p>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
