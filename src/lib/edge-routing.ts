/** Orthogonal routes around screen bounds, including backward and cross-row links. */
export type Point = { x: number; y: number };
export type Box = Point & { width: number; height: number };
export function routeConnection(
  start: Point,
  end: Point,
  boxes: Box[],
  lane = 0,
) {
  const gap = 22;
  const verticalGap = gap + (lane % 8) * 32;
  const obstacles = boxes.map((b) => ({
    left: b.x - gap,
    right: b.x + b.width + gap,
    top: b.y - verticalGap,
    bottom: b.y + b.height + verticalGap,
  }));
  const a = { x: start.x + gap, y: start.y },
    b = { x: end.x - gap, y: end.y };
  const xs = [
    ...new Set([a.x, b.x, ...obstacles.flatMap((r) => [r.left, r.right])]),
  ].sort((x, y) => x - y);
  const ys = [
    ...new Set([a.y, b.y, ...obstacles.flatMap((r) => [r.top, r.bottom])]),
  ].sort((x, y) => x - y);
  function clear(p: Point, q: Point) {
    return !obstacles.some((r) =>
      p.y === q.y
        ? p.y > r.top &&
          p.y < r.bottom &&
          Math.max(p.x, q.x) > r.left &&
          Math.min(p.x, q.x) < r.right
        : p.x > r.left &&
          p.x < r.right &&
          Math.max(p.y, q.y) > r.top &&
          Math.min(p.y, q.y) < r.bottom,
    );
  }
  type Step = {
    x: number;
    y: number;
    dir: number;
    cost: number;
    score: number;
    prev?: Step;
  };
  const queue: Step[] = [];
  function push(s: Step) {
    queue.push(s);
    let i = queue.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (queue[p].score <= s.score) break;
      queue[i] = queue[p];
      i = p;
    }
    queue[i] = s;
  }
  function pop() {
    const top = queue[0],
      tail = queue.pop()!;
    if (queue.length) {
      let i = 0;
      while (i * 2 + 1 < queue.length) {
        let c = i * 2 + 1;
        if (c + 1 < queue.length && queue[c + 1].score < queue[c].score) c++;
        if (queue[c].score >= tail.score) break;
        queue[i] = queue[c];
        i = c;
      }
      queue[i] = tail;
    }
    return top;
  }
  const costs = new Map<string, number>();
  push({ x: xs.indexOf(a.x), y: ys.indexOf(a.y), dir: 0, cost: 0, score: 0 });
  let found: Step | undefined;
  while (queue.length) {
    const s = pop();
    const p = { x: xs[s.x], y: ys[s.y] };
    if (p.x === b.x && p.y === b.y) {
      found = s;
      break;
    }
    for (const [dx, dy, dir] of [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 2],
      [0, -1, 2],
    ]) {
      const x = s.x + dx,
        y = s.y + dy;
      if (x < 0 || y < 0 || x >= xs.length || y >= ys.length) continue;
      const q = { x: xs[x], y: ys[y] };
      if (!clear(p, q)) continue;
      const cost =
        s.cost +
        Math.abs(q.x - p.x) +
        Math.abs(q.y - p.y) +
        (s.dir && s.dir !== dir ? 30 : 0);
      const key = `${x},${y},${dir}`;
      if ((costs.get(key) ?? Infinity) <= cost) continue;
      costs.set(key, cost);
      push({
        x,
        y,
        dir,
        cost,
        score: cost + Math.abs(q.x - b.x) + Math.abs(q.y - b.y),
        prev: s,
      });
    }
  }
  const inner: Point[] = [];
  while (found) {
    inner.unshift({ x: xs[found.x], y: ys[found.y] });
    found = found.prev;
  }
  // Overlapping cards can hide their ports; retain a visible outer loop in that case.
  const outerY = Math.min(start.y, end.y, ...obstacles.map((r) => r.top)) - gap;
  const raw = [
    start,
    ...(inner.length
      ? inner
      : [a, { x: a.x, y: outerY }, { x: b.x, y: outerY }, b]),
    end,
  ];
  const points = raw
    .filter((p, i) => !i || p.x !== raw[i - 1].x || p.y !== raw[i - 1].y)
    .filter(
      (p, i, all) =>
        !i ||
        i === all.length - 1 ||
        !(
          (all[i - 1].x === p.x && p.x === all[i + 1].x) ||
          (all[i - 1].y === p.y && p.y === all[i + 1].y)
        ),
    );
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i],
      prev = points[i - 1],
      next = points[i + 1];
    if (!next) {
      path += ` L ${p.x} ${p.y}`;
      continue;
    }
    const r = Math.min(
      12,
      Math.hypot(p.x - prev.x, p.y - prev.y) / 2,
      Math.hypot(next.x - p.x, next.y - p.y) / 2,
    );
    const before = {
      x: p.x - Math.sign(p.x - prev.x) * r,
      y: p.y - Math.sign(p.y - prev.y) * r,
    };
    const after = {
      x: p.x + Math.sign(next.x - p.x) * r,
      y: p.y + Math.sign(next.y - p.y) * r,
    };
    path += ` L ${before.x} ${before.y} Q ${p.x} ${p.y} ${after.x} ${after.y}`;
  }
  let best = 0,
    label = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  points.slice(1).forEach((p, i) => {
    const prev = points[i];
    const length = Math.hypot(p.x - prev.x, p.y - prev.y);
    if (length > best) {
      best = length;
      label = { x: (p.x + prev.x) / 2, y: (p.y + prev.y) / 2 };
    }
  });
  return { path, label, points };
}
