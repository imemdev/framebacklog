"use client";
import { useEffect, useState } from "react";
import { Plus, UserRound, ShieldCheck } from "lucide-react";
import {
  permissionOptions,
  permissionNames,
  normalizeGrants,
  dependencies,
} from "@/lib/access";
import { api, write, Modal, Field, ErrorNotice } from "./ui";
type Partner = {
  id: string;
  name: string;
  username: string;
  role: string;
  grants: Record<string, string[]>;
  version: number;
};
type ProjectOption = { id: string; name: string };
export default function Partners() {
  const [people, setPeople] = useState<Partner[]>([]),
    [projects, setProjects] = useState<ProjectOption[]>([]),
    [editing, setEditing] = useState<Partner | "new" | null>(null),
    [error, setError] = useState("");
  async function load() {
    try {
      const [members, projects] = await Promise.all([
        api<Partner[]>("partners"),
        api<ProjectOption[]>("projects"),
      ]);
      setPeople(members);
      setProjects(projects);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <div className="settings-content">
      <section className="settings-card">
        <div className="heading-row">
          <div>
            <h2>Partners & project access</h2>
            <p>
              You are the only owner. Give each partner access to selected
              projects and actions.
            </p>
          </div>
          <button className="primary" onClick={() => setEditing("new")}>
            <Plus size={16} />
            Create partner
          </button>
        </div>
        <ErrorNotice error={error} />
        {people.map((p) => (
          <div className="member" key={p.id}>
            <UserRound size={20} />
            <div>
              <strong>{p.username || p.name}</strong>
              <small>
                {p.role === "owner"
                  ? "Owner · all projects"
                  : `${Object.keys(p.grants).length} assigned projects`}
              </small>
            </div>
            {p.role === "partner" ? (
              <button onClick={() => setEditing(p)}>Manage access</button>
            ) : (
              <ShieldCheck size={18} />
            )}
          </div>
        ))}
      </section>
      {editing && (
        <PartnerForm
          key={editing === "new" ? "new" : editing.id}
          partner={editing === "new" ? undefined : editing}
          projects={projects}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await load();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
function PartnerForm({
  partner,
  projects,
  onClose,
  onSaved,
}: {
  partner?: Partner;
  projects: ProjectOption[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [grants, setGrants] = useState<Record<string, string[]>>(
      partner?.grants || {},
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [invite, setInvite] = useState(false),
    [link, setLink] = useState("");
  function setProject(id: string, values: string[]) {
    setGrants((current) => {
      const next = { ...current };
      if (values.length) next[id] = values;
      else delete next[id];
      return next;
    });
  }
  return (
    <Modal
      title={
        partner
          ? `Access for ${partner.username || partner.name}`
          : "Create partner account"
      }
      description="Assign projects and choose exactly what this partner can do."
      onClose={onClose}
    >
      <form
        className="panel-body"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const normalized = normalizeGrants(grants);
            if (partner)
              await write(
                `partners/${partner.id}`,
                { grants: normalized, version: partner.version },
                "PATCH",
              );
            else if (invite) {
              const result = await write<{ url: string }>("invitations", {
                username,
                grants: normalized,
              });
              setLink(result.url);
              return;
            } else
              await write("partners", {
                username,
                password,
                grants: normalized,
              });
            await onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ErrorNotice error={error} />
        {!partner && (
          <>
            <Field label="Partner username">
              <input
                required
                minLength={3}
                maxLength={40}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={invite}
                onChange={(e) => setInvite(e.target.checked)}
              />
              Let the partner choose a password using an invitation
            </label>
            {!invite && (
              <Field label="Initial password">
                <input
                  type="password"
                  required
                  minLength={3}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
          </>
        )}
        <p className="notice">
          Unselected projects are private. New projects are never shared
          automatically. Selecting an editing action also grants the viewing
          access it requires.
        </p>
        <div className="partner-projects">
          {projects.map((project) => (
            <section className="partner-project" key={project.id}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={!!grants[project.id]?.length}
                  onChange={(e) =>
                    setProject(
                      project.id,
                      e.target.checked ? ["view-screens"] : [],
                    )
                  }
                />
                <strong>{project.name}</strong>
              </label>
              {!!grants[project.id]?.length && (
                <>
                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() =>
                        setProject(project.id, [...permissionNames])
                      }
                    >
                      All project actions
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setProject(project.id, [
                          "view-screens",
                          "comment",
                          "screen-review",
                          "view-ideas",
                          "ideas",
                        ])
                      }
                    >
                      Screen reviewer
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setProject(project.id, [
                          "view-backlog",
                          "view-screens",
                          "view-ideas",
                        ])
                      }
                    >
                      View only
                    </button>
                  </div>
                  <div className="permission-options">
                    {permissionOptions.map(([key, label]) => (
                      <label className="checkbox" key={key}>
                        <input
                          type="checkbox"
                          checked={grants[project.id].includes(key)}
                          onChange={(e) =>
                            setProject(
                              project.id,
                              e.target.checked
                                ? normalizeGrants({
                                    [project.id]: [...grants[project.id], key],
                                  })[project.id]
                                : grants[project.id].filter(
                                    (value) =>
                                      value !== key &&
                                      !dependencies[value]?.includes(key),
                                  ),
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </section>
          ))}
        </div>
        <p className="muted">
          Project creation, partner accounts, access grants, API credentials and
          installation settings always remain owner-only.
        </p>
        <div className="form-actions">
          <button className="primary" disabled={busy}>
            {busy
              ? "Saving…"
              : partner
                ? "Save access"
                : invite
                  ? "Create invitation"
                  : "Create partner"}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
        {link && (
          <Field label="Invitation link">
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
          </Field>
        )}
      </form>
    </Modal>
  );
}
