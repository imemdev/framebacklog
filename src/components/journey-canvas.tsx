"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  BaseEdge,
  type EdgeProps,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeProps,
  type ReactFlowInstance,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { routeConnection } from "@/lib/edge-routing";
import { Undo2, Redo2, Network, Plus, ImageIcon, Trash2 } from "lucide-react";
import { screenVersions, type Project, type Journey } from "@/lib/model";
import { write, Modal, Field, ErrorNotice } from "./ui";
type ScreenData = {
  title: string;
  image?: string;
  version: number;
  count: number;
  recommended: boolean;
  status: string;
  comments: number;
  tasks: number;
  open: () => void;
};
function ScreenNode({ data }: { data: ScreenData }) {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <button
        className={`canvas-screen ${data.count > 1 ? "version-stack" : ""}`}
        onClick={data.open}
      >
        <div className="canvas-image">
          {data.image ? (
            <img src={data.image} alt={data.title} />
          ) : (
            <ImageIcon size={30} />
          )}
        </div>
        <div className="canvas-info">
          <small>
            VERSION {data.version} · {data.count} versions
            {data.recommended ? " · Recommended" : ` · ${data.status}`}
          </small>
          <strong>{data.title}</strong>
          <span>
            {data.comments} open comments · {data.tasks} tasks
          </span>
        </div>
      </button>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
const nodeTypes = {
  screen: ScreenNode as unknown as React.ComponentType<NodeProps>,
};
function RoutedEdge({ id, data, markerEnd, label, selected }: EdgeProps) {
  const route = data?.route as ReturnType<typeof routeConnection> | undefined;
  if (!route) return null;
  return (
    <BaseEdge
      id={id}
      path={route.path}
      markerEnd={markerEnd}
      interactionWidth={28}
      style={{
        stroke: selected ? "#2563eb" : "#586b86",
        strokeWidth: selected ? 2.8 : 2,
      }}
      label={label}
      labelX={route.label.x}
      labelY={route.label.y}
      labelStyle={{ fill: "#17212f", fontSize: 12, fontWeight: 500 }}
      labelBgStyle={{ fill: "#ffffff", stroke: "#d9e1ec", strokeWidth: 1 }}
      labelBgPadding={[10, 6]}
      labelBgBorderRadius={6}
    />
  );
}
const edgeTypes = { routed: RoutedEdge };
type Layout = Pick<Journey, "nodes" | "edges">;
export default function JourneyCanvas({
  journey,
  project,
  editable,
  refresh,
  openScreen,
  createScreen,
}: {
  journey: Journey;
  project: Project;
  editable: boolean;
  refresh: () => Promise<void>;
  openScreen: (id: string) => void;
  createScreen?: (position: { x: number; y: number }) => void;
}) {
  const [layout, setLayout] = useState<Layout>({
      nodes: journey.nodes,
      edges: journey.edges,
    }),
    [version, setVersion] = useState(journey.version),
    [saveState, setSaveState] = useState("Saved"),
    [error, setError] = useState(""),
    [history, setHistory] = useState<Layout[]>([]),
    [future, setFuture] = useState<Layout[]>([]),
    [connect, setConnect] = useState(false),
    [zoom, setZoom] = useState(100),
    [minimap, setMinimap] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const flow = useRef<ReactFlowInstance | null>(null);
  const [createAt, setCreateAt] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [removeEdge, setRemoveEdge] = useState<string | null>(null);
  const baseline = useRef(layout);
  const saving = useRef(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (journey.version !== version && !dirty && !saving.current) {
      setLayout({ nodes: journey.nodes, edges: journey.edges });
      setVersion(journey.version);
    }
  }, [journey, version, dirty]);
  const persist = useCallback(
    async (next: Layout) => {
      if (saving.current) {
        setDirty(true);
        setSaveState("Unsaved changes");
        return;
      }
      saving.current = true;
      setSaveState("Saving…");
      setError("");
      try {
        const r = await write<{ version: number }>(
          `projects/${project.id}/journeys/${journey.id}`,
          { ...next, version },
          "PUT",
        );
        setVersion(r.version);
        setSaveState("Saved");
        setDirty(false);
        await refresh();
      } catch (e) {
        setError((e as Error).message);
        setSaveState("Could not save");
        setDirty(true);
      } finally {
        saving.current = false;
      }
    },
    [project.id, journey.id, version, refresh],
  );
  function change(next: Layout) {
    if (saving.current) return;
    setHistory((h) => [...h.slice(-29), layout]);
    setFuture([]);
    setLayout(next);
    setDirty(true);
    void persist(next);
  }
  const nodes: Node[] = layout.nodes.map((n) => {
    const s = project.screens.find((s) => s.id === n.screenId)!;
    const v = screenVersions(s)[0];
    return {
      id: n.id,
      type: "screen",
      width: 180,
      height: 320,
      measured: { width: 180, height: 320 },
      position: n.position,
      selected: selected.includes(n.id),
      data: {
        title: s.title,
        image: v.key
          ? `/api/v1/projects/${project.id}/files/${v.key}`
          : undefined,
        version: v.number,
        count: s.versions.length,
        recommended: s.recommendation?.versionId === v.id,
        status: v.status,
        comments: project.comments.filter(
          (c) => c.versionId === v.id && !c.resolved && !c.parentId,
        ).length,
        tasks: project.tasks.filter((t) => t.screenIds.includes(s.id)).length,
        open: () => openScreen(s.id),
      },
    };
  });
  const edges: Edge[] = useMemo(() => {
    const boxes = layout.nodes.map((n) => ({
      ...n.position,
      width: 180,
      height: 320,
    }));
    return layout.edges.map((e, index) => {
      const source = layout.nodes.find((n) => n.id === e.source);
      const target = layout.nodes.find((n) => n.id === e.target);
      return {
        ...e,
        type: "routed",
        ariaLabel: `Connection: ${e.label || "Continue"}`,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#586b86",
          width: 20,
          height: 20,
        },
        data: {
          route:
            source && target
              ? routeConnection(
                  { x: source.position.x + 180, y: source.position.y + 160 },
                  { x: target.position.x, y: target.position.y + 160 },
                  boxes,
                  index,
                )
              : undefined,
        },
      };
    });
  }, [layout.nodes, layout.edges]);
  function nodeChanges(changes: NodeChange[]) {
    const changed = applyNodeChanges(changes, nodes);
    setSelected(changed.filter((n) => n.selected).map((n) => n.id));
    setLayout((l) => ({
      ...l,
      nodes: changed.map((n) => ({
        id: n.id,
        screenId: l.nodes.find((old) => old.id === n.id)!.screenId,
        position: n.position,
      })),
    }));
  }
  function edgeChanges(changes: EdgeChange[]) {
    if (changes.some((c) => c.type === "remove")) {
      const next = applyEdgeChanges<Edge>(changes, edges);
      change({
        ...layout,
        edges: next.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: String(e.label || ""),
        })),
      });
    }
  }
  function addConnection(c: Connection) {
    if (!c.source || !c.target || c.source === c.target) return;
    change({
      ...layout,
      edges: [
        ...layout.edges,
        {
          id: crypto.randomUUID(),
          source: c.source,
          target: c.target,
          label: "Continue",
        },
      ],
    });
  }
  return (
    <>
      <div className="canvas-actions">
        <div className="save-indicator" role="status">
          <span
            className={`tiny-dot ${saveState === "Saved" ? "green" : ""}`}
          />
          {saveState}
          {journey.version > version && " · Newer version available"}
        </div>
        {editable && (
          <>
            <button
              aria-label="Undo layout"
              disabled={!history.length || saving.current}
              onClick={() => {
                const prev = history.at(-1)!;
                setFuture((f) => [layout, ...f]);
                setHistory((h) => h.slice(0, -1));
                setLayout(prev);
                void persist(prev);
              }}
            >
              <Undo2 size={17} />
            </button>
            <button
              aria-label="Redo layout"
              disabled={!future.length || saving.current}
              onClick={() => {
                const next = future[0];
                setHistory((h) => [...h, layout]);
                setFuture((f) => f.slice(1));
                setLayout(next);
                void persist(next);
              }}
            >
              <Redo2 size={17} />
            </button>
            <button
              disabled={saving.current}
              onClick={() =>
                change({
                  ...layout,
                  nodes: layout.nodes.map((n, i) => ({
                    ...n,
                    position: { x: (i % 3) * 330, y: Math.floor(i / 3) * 400 },
                  })),
                })
              }
            >
              <Network size={16} />
              Arrange
            </button>
            <button
              disabled={selected.length < 2 || saving.current}
              onClick={() => {
                const top = Math.min(
                  ...layout.nodes
                    .filter((n) => selected.includes(n.id))
                    .map((n) => n.position.y),
                );
                change({
                  ...layout,
                  nodes: layout.nodes.map((n) =>
                    selected.includes(n.id)
                      ? { ...n, position: { ...n.position, y: top } }
                      : n,
                  ),
                });
              }}
            >
              Align top
            </button>
            <button onClick={() => setConnect(true)}>
              <Plus size={16} />
              Connection
            </button>
          </>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={minimap}
            onChange={(e) => setMinimap(e.target.checked)}
          />
          Minimap
        </label>
        <span className="zoom-label">{zoom}%</span>
      </div>
      <ErrorNotice error={error} />
      {error && (
        <div className="conflict-actions">
          <p>
            Your layout is still visible. Reload to compare the saved version
            before retrying.
          </p>
          <button onClick={() => void refresh()}>Fetch latest</button>
          <button
            onClick={() => {
              setLayout({ nodes: journey.nodes, edges: journey.edges });
              setVersion(journey.version);
              setDirty(false);
              setError("");
              setSaveState("Saved");
            }}
          >
            Discard local layout
          </button>
          <button
            onClick={() => {
              setVersion(journey.version);
              setError("");
              setSaveState("Unsaved changes");
            }}
          >
            Keep layout with latest version
          </button>
        </div>
      )}
      {dirty && !saving.current && (
        <button onClick={() => void persist(layout)}>
          Save current layout
        </button>
      )}
      <div
        className="canvas-wrap"
        onDoubleClick={(e) => {
          if (
            !createScreen ||
            saving.current ||
            dirty ||
            !(e.target as HTMLElement).classList.contains("react-flow__pane")
          )
            return;
          const position = flow.current?.screenToFlowPosition({
            x: e.clientX,
            y: e.clientY,
          });
          if (position) createScreen(position);
        }}
      >
        <ReactFlow
          onInit={(instance) => {
            flow.current = instance;
          }}
          zoomOnDoubleClick={false}
          onPaneContextMenu={(e) => {
            if (!createScreen) return;
            e.preventDefault();
            if (saving.current || dirty) return;
            const position = flow.current?.screenToFlowPosition({
              x: e.clientX,
              y: e.clientY,
            });
            if (position) setCreateAt(position);
          }}
          onEdgeClick={
            editable
              ? (e, edge) => {
                  e.stopPropagation();
                  setRemoveEdge(edge.id);
                }
              : undefined
          }
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={editable ? nodeChanges : undefined}
          onEdgesChange={editable ? edgeChanges : undefined}
          onConnect={editable ? addConnection : undefined}
          nodesDraggable={editable && !saving.current}
          nodesConnectable={editable && !saving.current}
          onNodeDragStart={() => {
            baseline.current = structuredClone(layout);
          }}
          onNodeDragStop={() => {
            setHistory((h) => [...h.slice(-29), baseline.current]);
            setFuture([]);
            void persist(layout);
          }}
          onMove={(_, viewport) => setZoom(Math.round(viewport.zoom * 100))}
          fitView
          fitViewOptions={{ padding: 0.35 }}
          minZoom={0.2}
          maxZoom={2}
          deleteKeyCode={null}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
          {minimap && <MiniMap pannable zoomable />}
        </ReactFlow>
        <div className="canvas-hint">
          Drag to arrange · Scroll to zoom
          {createScreen && " · Double-click empty space to add a screen"}
        </div>
      </div>
      {editable && layout.edges.length > 0 && (
        <details className="connections-list">
          <summary>Edit connections without dragging</summary>
          {layout.edges.map((e) => (
            <div key={e.id}>
              <span>
                {
                  project.screens.find(
                    (s) =>
                      s.id ===
                      layout.nodes.find((n) => n.id === e.source)?.screenId,
                  )?.title
                }{" "}
                →{" "}
                {
                  project.screens.find(
                    (s) =>
                      s.id ===
                      layout.nodes.find((n) => n.id === e.target)?.screenId,
                  )?.title
                }
              </span>
              <input
                aria-label="Connection label"
                defaultValue={e.label}
                key={`${e.id}-${e.label}`}
                onBlur={(ev) => {
                  if (ev.target.value !== e.label)
                    change({
                      ...layout,
                      edges: layout.edges.map((edge) =>
                        edge.id === e.id
                          ? { ...edge, label: ev.target.value }
                          : edge,
                      ),
                    });
                }}
              />
              <button
                aria-label={`Remove ${e.label} connection`}
                onClick={() => setRemoveEdge(e.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </details>
      )}
      {createAt && createScreen && (
        <Modal title="Canvas actions" onClose={() => setCreateAt(null)}>
          <div className="panel-body">
            <button
              className="primary"
              onClick={() => {
                createScreen(createAt);
                setCreateAt(null);
              }}
            >
              <Plus size={16} />
              Create screen here
            </button>
          </div>
        </Modal>
      )}
      {removeEdge && editable && (
        <Modal title="Delete connection?" onClose={() => setRemoveEdge(null)}>
          <div className="panel-body">
            <p>
              Remove “
              {layout.edges.find((e) => e.id === removeEdge)?.label ||
                "Continue"}
              ” from this journey? Both screens will stay in place. You can undo
              this change.
            </p>
            <button
              className="danger"
              disabled={saving.current || dirty}
              onClick={() => {
                change({
                  ...layout,
                  edges: layout.edges.filter((e) => e.id !== removeEdge),
                });
                setRemoveEdge(null);
              }}
            >
              Delete connection
            </button>
            <button onClick={() => setRemoveEdge(null)}>Keep connection</button>
          </div>
        </Modal>
      )}
      {connect && (
        <Modal title="Add a connection" onClose={() => setConnect(false)}>
          <form
            className="panel-body"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (f.get("source") === f.get("target")) return;
              change({
                ...layout,
                edges: [
                  ...layout.edges,
                  {
                    id: crypto.randomUUID(),
                    source: String(f.get("source")),
                    target: String(f.get("target")),
                    label: String(f.get("label")),
                  },
                ],
              });
              setConnect(false);
            }}
          >
            {["source", "target"].map((name) => (
              <Field
                key={name}
                label={name === "source" ? "From screen" : "To screen"}
              >
                <select name={name} required>
                  {layout.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {project.screens.find((s) => s.id === n.screenId)?.title}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
            <Field label="Connection label">
              <input
                name="label"
                placeholder="e.g. Create an account"
                maxLength={100}
              />
            </Field>
            <button className="primary">Add connection</button>
          </form>
        </Modal>
      )}
    </>
  );
}
