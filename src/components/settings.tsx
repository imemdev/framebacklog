"use client";
import Partners from "./partners";
import { useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  Copy,
  Download,
  Link,
  ShieldCheck,
  Trash2,
  ExternalLink,
  Upload,
} from "lucide-react";
import type { Actor, Project } from "@/lib/model";
import { api, write, Field, ErrorNotice, Modal, Empty } from "./ui";
type Credential = {
  id: string;
  name: string;
  permissions: string;
  expires: number | null;
  revoked: number;
  last_used: number | null;
  created: number;
};
export default function SettingsPage({
  actor,
  project,
  refresh,
}: {
  actor: Actor;
  project: Project;
  refresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState("ai"),
    [credentials, setCredentials] = useState<Credential[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState(false),
    [secret, setSecret] = useState(""),
    [invitation, setInvitation] = useState(""),
    [members, setMembers] = useState<
      {
        id: string;
        name: string;
        email: string;
        username?: string;
        role: string;
      }[]
    >([]),
    [busy, setBusy] = useState(false);
  const owner = actor.role === "owner";
  const base = typeof location !== "undefined" ? location.origin : "";
  async function load() {
    if (!owner) return;
    try {
      const [c, m] = await Promise.all([
        api<Credential[]>(`projects/${project.id}/credentials`),
        api<typeof members>("members"),
      ]);
      setCredentials(c);
      setMembers(m);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [project.id, owner]);
  async function run(fn: () => Promise<unknown>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to clipboard.");
    } catch {
      setError(
        "Clipboard access is unavailable. Select and copy the text manually.",
      );
    }
  }
  if (!owner)
    return (
      <>
        <div className="page-heading">
          <h1>Workspace settings</h1>
          <p>You’re signed in as a partner and reviewer.</p>
        </div>
        <Empty title="Managed by your workspace owner">
          Your owner manages members, project credentials, and data exports. You
          can review screens and leave feedback across this workspace.
        </Empty>
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">YOUR WORKSPACE, YOUR TOOLS</div>
        <h1>Settings</h1>
        <p>Keep access simple, intentional, and under your control.</p>
      </div>
      <div className="tabs">
        <button
          className={tab === "ai" ? "selected" : ""}
          onClick={() => setTab("ai")}
        >
          AI access
        </button>
        <button
          className={tab === "members" ? "selected" : ""}
          onClick={() => setTab("members")}
        >
          People
        </button>
        <button
          className={tab === "data" ? "selected" : ""}
          onClick={() => setTab("data")}
        >
          Data & portability
        </button>
      </div>
      <ErrorNotice error={error} />
      <div role="status" className="save-message">
        {busy ? "Working…" : notice}
      </div>
      {tab === "ai" && (
        <div className="settings-content">
          <section className="settings-card">
            <div className="heading-row">
              <div>
                <h2>
                  <KeyRound size={20} />
                  Project credentials
                </h2>
                <p>
                  Connect an assistant that already works in your coding
                  environment.
                </p>
              </div>
              <button className="primary" onClick={() => setModal(true)}>
                <Plus size={17} />
                Create credential
              </button>
            </div>
            {credentials.map((c) => (
              <div className="credential" key={c.id}>
                <div className="credential-icon">
                  <KeyRound size={20} />
                </div>
                <div>
                  <strong>{c.name}</strong>
                  <small>
                    {c.revoked
                      ? "Revoked"
                      : `Permissions: ${JSON.parse(c.permissions).join(", ")}`}
                  </small>
                  <small>
                    Last used:{" "}
                    {c.last_used
                      ? new Date(c.last_used).toLocaleString()
                      : "Never"}
                    {c.expires
                      ? ` · Expires ${new Date(c.expires).toLocaleDateString()}`
                      : ""}
                  </small>
                </div>
                {!c.revoked && (
                  <button
                    className="danger-quiet"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api(
                          `projects/${project.id}/credentials/${c.id}`,
                          { method: "DELETE" },
                        );
                        await load();
                      })
                    }
                  >
                    <Trash2 size={15} />
                    Revoke
                  </button>
                )}
              </div>
            ))}
            {!credentials.length && (
              <p className="muted">
                No credentials yet. Each credential is restricted to this
                project.
              </p>
            )}
          </section>
          {secret && (
            <section className="settings-card secret-card">
              <h2>Your new secret</h2>
              <p>
                Copy it now. It won’t be shown again after you leave this page.
              </p>
              <div className="copy-field">
                <input readOnly aria-label="New API secret" value={secret} />
                <button onClick={() => void copy(secret)}>
                  <Copy size={16} />
                  Copy
                </button>
              </div>
              <div className="form-actions">
                <button
                  onClick={() =>
                    void run(async () => {
                      await api(`projects/${project.id}/test-connection`, {
                        headers: { Authorization: `Bearer ${secret}` },
                      });
                      setNotice(
                        "Connection verified. This credential can reach its project.",
                      );
                      await load();
                    })
                  }
                >
                  <Link size={16} />
                  Test connection
                </button>
                <button onClick={() => setSecret("")}>I’ve saved it</button>
              </div>
            </section>
          )}
          <section className="settings-card">
            <h2>
              <ShieldCheck size={20} />
              Connect your assistant
            </h2>
            <p>
              Download a small connection kit with instructions, examples, and a
              configuration template. It contains no secrets.
            </p>
            <div className="connection-steps">
              <div>
                <span>1</span>
                <p>
                  Create a project credential with only the permissions your
                  assistant needs.
                </p>
              </div>
              <div>
                <span>2</span>
                <p>
                  Set the three environment variables in your assistant’s local
                  environment.
                </p>
              </div>
              <div>
                <span>3</span>
                <p>
                  Use the REST API or configure the local stdio MCP adapter.
                </p>
              </div>
            </div>
            <pre>{`CUSTOMBACKLOG_URL=${base}\nCUSTOMBACKLOG_PROJECT=${project.id}\nCUSTOMBACKLOG_TOKEN=<your-private-secret>`}</pre>
            <button
              onClick={() =>
                void copy(
                  `CUSTOMBACKLOG_URL=${base}\nCUSTOMBACKLOG_PROJECT=${project.id}\nCUSTOMBACKLOG_TOKEN=<your-private-secret>`,
                )
              }
            >
              <Copy size={16} />
              Copy configuration
            </button>
            <p className="muted">
              A remote assistant needs a reachable server and a compatible
              connector. An API key and documentation alone do not provide
              network access.
            </p>
            <div className="form-actions">
              <a
                className="button primary"
                href={`/api/v1/projects/${project.id}/connection-kit`}
              >
                <Download size={16} />
                Download connection kit
              </a>
              <a
                className="button"
                href="/api/openapi"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} />
                OpenAPI specification
              </a>
            </div>
          </section>
        </div>
      )}
      {tab === "members" && <Partners />}
      {tab === "data" && (
        <div className="settings-content">
          <section className="settings-card">
            <h2>Portable project export</h2>
            <p>
              Download screens, immutable versions, comments, tasks, journeys,
              and review history. Authentication credentials are excluded.
            </p>
            <a
              className="button primary"
              href={`/api/v1/projects/${project.id}/export`}
            >
              <Download size={16} />
              Export project
            </a>
            <p className="muted">
              Initial limits: 500 tasks, 100 screens, 20 versions per screen,
              1.5 MB metadata and 10 MB screenshots per export. Full backups are
              documented separately.
            </p>
          </section>
          <section className="settings-card">
            <h2>Import a project</h2>
            <p>
              Validated exports create a new project. Existing project data is
              preserved.
            </p>
            <label className="button">
              <Upload size={16} />
              Choose project export
              <input
                type="file"
                accept="application/json,.json"
                hidden
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  void run(async () => {
                    if (f.size > 15 * 1024 * 1024)
                      throw new Error("Import must be smaller than 15 MB.");
                    const r = await api<{ id: string }>(
                      `projects/${project.id}/import`,
                      {
                        method: "POST",
                        body: await f.text(),
                        headers: { "Content-Type": "application/json" },
                      },
                    );
                    await refresh();
                    setNotice(
                      `Project imported successfully. Select it in the project switcher. (${r.id})`,
                    );
                  });
                }}
              />
            </label>
          </section>
        </div>
      )}
      {modal && (
        <Modal
          title="Create an AI credential"
          description={`Restricted to ${project.name}. Never allowed to perform human reviews.`}
          onClose={() => setModal(false)}
        >
          <form
            className="panel-body"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                const r = await write<{ secret: string }>(
                  `projects/${project.id}/credentials`,
                  {
                    name: f.get("name"),
                    permissions: ["read", ...f.getAll("permission")],
                    expires: f.get("expires")
                      ? new Date(String(f.get("expires"))).getTime()
                      : null,
                  },
                );
                setSecret(r.secret);
                setModal(false);
                await load();
              });
            }}
          >
            <Field label="Credential name">
              <input
                name="name"
                required
                autoFocus
                placeholder="e.g. Local coding assistant"
                maxLength={100}
              />
            </Field>
            <fieldset>
              <legend>Allowed actions</legend>
              <label className="checkbox">
                <input type="checkbox" checked disabled />
                Read project context
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="permission"
                  value="tasks"
                  defaultChecked
                />
                Create tasks and save progress
              </label>
              <label className="checkbox">
                <input type="checkbox" name="permission" value="comment" />
                Add comments
              </label>
              <label className="checkbox">
                <input type="checkbox" name="permission" value="upload" />
                Upload screen versions
              </label>
            </fieldset>
            <Field label="Expiry (optional)">
              <input
                name="expires"
                type="date"
                min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
              />
            </Field>
            <ErrorNotice error={error} />
            <button className="primary" disabled={busy}>
              Create credential
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
