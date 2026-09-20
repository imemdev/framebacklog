"use client";
import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, ImageIcon } from "lucide-react";
import { screenVersions, type Journey, type Project } from "@/lib/model";
import { Modal } from "./ui";

export default function JourneyPlayer({
  journey,
  project,
  onClose,
}: {
  journey: Journey;
  project: Project;
  onClose: () => void;
}) {
  // Keep a stable playback snapshot while the workspace refreshes in the background.
  const [snapshot] = useState(() => ({ journey, project }));
  const nodes = snapshot.journey.nodes;
  const edges = snapshot.journey.edges;
  const roots = nodes.filter((n) => !edges.some((e) => e.target === n.id));
  const starts = roots.length ? roots : nodes;
  const [current, setCurrent] = useState<string | null>(
    starts.length === 1 ? starts[0].id : null,
  );
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState("1");
  const [restartCount, setRestartCount] = useState(0);
  const [visited, setVisited] = useState<string[]>(
    starts.length === 1 ? [starts[0].id] : [],
  );
  const outgoing = edges.filter(
    (e) => e.source === current && nodes.some((n) => n.id === e.target),
  );
  const looping = outgoing.length === 1 && visited.includes(outgoing[0].target);
  const choice = outgoing.length > 1 || looping;
  const finished = current !== null && outgoing.length === 0;
  const screenFor = (nodeId: string) =>
    snapshot.project.screens.find(
      (s) => s.id === nodes.find((n) => n.id === nodeId)?.screenId,
    );
  const screen = current ? screenFor(current) : undefined;
  const version = screen ? screenVersions(screen)[0] : undefined;
  const nextId = outgoing.length === 1 && !looping ? outgoing[0].target : null;
  useEffect(() => {
    if (!playing || !current || !nextId) return;
    const timer = window.setTimeout(
      () => {
        setCurrent(nextId);
        setVisited((v) => [...v, nextId]);
      },
      4000 / Number(speed),
    );
    return () => window.clearTimeout(timer);
  }, [playing, current, nextId, speed, restartCount]);
  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);
  function continueTo(id: string) {
    setCurrent(id);
    // Starting a new lap requires an explicit choice, never an endless automatic loop.
    setVisited((v) => (v.includes(id) ? [id] : [...v, id]));
    setPlaying(true);
  }
  return (
    <Modal title={`Run journey · ${snapshot.journey.name}`} onClose={onClose}>
      <div className="panel-body journey-player">
        <div className="player-controls">
          <button
            disabled={!current || choice || finished}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
            {playing ? "Pause" : "Resume"}
          </button>
          <label>
            Speed{" "}
            <select
              aria-label="Playback speed"
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
            >
              {["0.5", "0.75", "1", "1.25"].map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setRestartCount((n) => n + 1);
              setCurrent(starts.length === 1 ? starts[0].id : null);
              setVisited(starts.length === 1 ? [starts[0].id] : []);
              setPlaying(true);
            }}
          >
            <RotateCcw size={17} />
            Restart
          </button>
        </div>
        <p role="status" className="muted">
          {!current
            ? "Choose where to start"
            : finished
              ? "Journey complete"
              : choice
                ? "Paused · Choose your next screen"
                : playing
                  ? `Playing · ${4 / Number(speed)} seconds per screen`
                  : "Paused"}
        </p>
        {screen && (
          <section aria-label="Current screen" className="player-screen">
            <h2>{screen.title}</h2>
            <p className="muted">
              Version {version?.number}
              {screen.recommendation?.versionId === version?.id
                ? " · Recommended"
                : ""}
            </p>
            {version?.key ? (
              <img
                src={`/api/v1/projects/${snapshot.project.id}/files/${version.key}`}
                alt={screen.title}
              />
            ) : (
              <div className="player-placeholder">
                <ImageIcon size={40} />
                <span>Screen preview not uploaded yet</span>
              </div>
            )}
          </section>
        )}
        {!current && (
          <div className="player-paths">
            {starts.map((n) => (
              <button key={n.id} onClick={() => continueTo(n.id)}>
                <Play size={16} />
                Start at {screenFor(n.id)?.title || "Screen"}
              </button>
            ))}
          </div>
        )}
        {choice && (
          <section className="player-paths" aria-label="Choose a path">
            <h3>Which screen would you like to continue to?</h3>
            {outgoing.map((e) => (
              <button key={e.id} onClick={() => continueTo(e.target)}>
                <span>{e.label || "Continue"}</span>
                <strong>→ {screenFor(e.target)?.title || "Screen"}</strong>
              </button>
            ))}
          </section>
        )}
        {finished && (
          <p>
            You’ve reached the end of this path. Restart to explore another
            route.
          </p>
        )}
      </div>
    </Modal>
  );
}
