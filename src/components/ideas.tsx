"use client";
import { can } from "@/lib/access";
import { useState } from "react";
import {
  Lightbulb,
  Plus,
  Search,
  Check,
  Tag,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Actor, Project } from "@/lib/model";
import { type Idea, starterTags } from "@/lib/ideas";
import { Modal, Field, ErrorNotice, Empty, stamp, write } from "./ui";
export default function Ideas({
  project,
  actor,
  refresh,
}: {
  project: Project;
  actor: Actor;
  refresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Idea | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const tags = project.ideaTags || starterTags;
  const ideas = (project.ideas || [])
    .toReversed()
    .filter(
      (idea) =>
        (!filter || idea.tags.includes(filter)) &&
        `${idea.title} ${idea.description} ${idea.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  return (
    <>
      <div className="heading-row">
        <div className="page-heading">
          <div className="eyebrow">ROOM FOR WHAT’S NEXT</div>
          <h1>Ideas</h1>
          <p>
            A shared place for marketing, mobile UI, features, and everything
            worth exploring.
          </p>
        </div>
        <button
          className="primary"
          disabled={!can(actor, project.id, "ideas")}
          onClick={() => setEditing("new")}
        >
          <Plus size={18} />
          Add idea
        </button>
      </div>
      <div className="ideas-toolbar">
        <label className="idea-search">
          <Search size={17} />
          <input
            aria-label="Search ideas"
            placeholder="Search ideas…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter ideas by tag"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag}>{tag}</option>
          ))}
        </select>
      </div>
      {ideas.length ? (
        <div className="ideas-grid">
          {ideas.map((idea) => (
            <article className="idea-card" key={idea.id}>
              <div className="idea-card-heading">
                <Lightbulb size={20} />
                <h2>{idea.title}</h2>
                {(can(actor, project.id, "ideas-manage") ||
                  (can(actor, project.id, "ideas") &&
                    idea.authorId === actor.id)) && (
                  <button
                    aria-label={`Edit idea: ${idea.title}`}
                    onClick={() => setEditing(idea)}
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>
              <p className="idea-description">
                {idea.description || "An idea to explore together."}
              </p>
              <div className="idea-tags">
                {idea.tags.map((tag) => (
                  <button key={tag} onClick={() => setFilter(tag)}>
                    <Tag size={12} />
                    {tag}
                  </button>
                ))}
              </div>
              <small>
                {idea.author} · {stamp(idea.createdAt)}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            query || filter
              ? "No matching ideas"
              : "Make room for your next idea"
          }
        >
          {query || filter
            ? "Try another tag or search."
            : "Add a thought, give it a few tags, and explore it together."}
        </Empty>
      )}
      {editing && (
        <IdeaForm
          idea={editing === "new" ? undefined : editing}
          project={project}
          tags={tags}
          refresh={refresh}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
function IdeaForm({
  idea,
  project,
  tags,
  refresh,
  onClose,
}: {
  idea?: Idea;
  project: Project;
  tags: string[];
  refresh: () => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(idea?.title || ""),
    [description, setDescription] = useState(idea?.description || ""),
    [selected, setSelected] = useState(idea?.tags || []),
    [tag, setTag] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false),
    [notice, setNotice] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addTag() {
    if (!tag.trim() || selected.length >= 12) return;
    await run(async () => {
      const saved = await write<{ name: string }>(
        `projects/${project.id}/idea-tags`,
        { name: tag },
      );
      setSelected((current) =>
        current.includes(saved.name) ? current : [...current, saved.name],
      );
      setTag("");
      setNotice(`“${saved.name}” is saved for next time.`);
      await refresh();
    });
  }
  return (
    <Modal
      title={idea ? "Edit idea" : "Add an idea"}
      description="Capture a thought and choose reusable tags."
      onClose={onClose}
    >
      <form
        className="panel-body idea-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await write(
              `projects/${project.id}/ideas${idea ? `/${idea.id}` : ""}`,
              {
                title,
                description,
                tags: selected,
                ...(idea ? { version: idea.version } : {}),
              },
              idea ? "PATCH" : "POST",
            );
            await refresh();
            onClose();
          });
        }}
      >
        <ErrorNotice error={error} />
        <Field label="Idea title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={150}
            autoFocus
            placeholder="What should we explore?"
          />
        </Field>
        <Field label="Details">
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={10000}
            placeholder="Describe the idea, who it helps, or why it matters…"
          />
        </Field>
        <fieldset className="idea-tag-picker">
          <legend>Tags</legend>
          <p className="muted">
            Choose up to 12 tags. New tags are saved for everyone in this
            project.
          </p>
          <div className="idea-tags">
            {tags.map((name) => (
              <button
                type="button"
                key={name}
                aria-pressed={selected.includes(name)}
                disabled={
                  busy || (!selected.includes(name) && selected.length >= 12)
                }
                onClick={() =>
                  setSelected((current) =>
                    current.includes(name)
                      ? current.filter((t) => t !== name)
                      : [...current, name],
                  )
                }
              >
                {selected.includes(name) && <Check size={14} />} {name}
              </button>
            ))}
          </div>
          <div className="new-idea-tag">
            <input
              aria-label="New tag"
              maxLength={40}
              placeholder="Create a new tag…"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addTag();
                }
              }}
            />
            <button
              type="button"
              disabled={busy || !tag.trim() || selected.length >= 12}
              onClick={() => void addTag()}
            >
              <Plus size={16} />
              Save tag
            </button>
          </div>
          <p role="status" className="muted">
            {notice}
          </p>
        </fieldset>
        <div className="form-actions">
          <button className="primary" disabled={busy || !title.trim()}>
            {busy ? "Saving…" : idea ? "Save changes" : "Save idea"}
          </button>
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {idea && (
            <button
              type="button"
              className="delete-task-button"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} />
              Delete idea
            </button>
          )}
        </div>
        {confirmDelete && idea && (
          <div className="delete-task-confirm">
            <p>Delete this idea? Its saved tags remain available.</p>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await write(
                    `projects/${project.id}/ideas/${idea.id}`,
                    { version: idea.version },
                    "DELETE",
                  );
                  await refresh();
                  onClose();
                })
              }
            >
              Delete permanently
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Keep idea
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
