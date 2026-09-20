import { expect, test } from "vitest";
import { routeConnection, type Box } from "../src/lib/edge-routing";
const boxes: Box[] = [
  { x: 0, y: 0, width: 180, height: 320 },
  { x: 330, y: 0, width: 180, height: 320 },
  { x: 660, y: 0, width: 180, height: 320 },
];
function verify(source: number, target: number, fixture = boxes) {
  const a = fixture[source],
    b = fixture[target];
  const route = routeConnection(
    { x: a.x + a.width, y: a.y + 160 },
    { x: b.x, y: b.y + 160 },
    fixture,
  );
  expect(route.path).not.toContain("NaN");
  for (let i = 1; i < route.points.length; i++) {
    const p = route.points[i - 1],
      q = route.points[i];
    expect(p.x === q.x || p.y === q.y).toBe(true);
    for (const box of fixture) {
      const crosses =
        p.y === q.y
          ? p.y > box.y &&
            p.y < box.y + box.height &&
            Math.max(p.x, q.x) > box.x &&
            Math.min(p.x, q.x) < box.x + box.width
          : p.x > box.x &&
            p.x < box.x + box.width &&
            Math.max(p.y, q.y) > box.y &&
            Math.min(p.y, q.y) < box.y + box.height;
      expect(crosses).toBe(false);
    }
  }
  return route;
}
test("forward, return, skipped screen and vertical connections avoid cards", () => {
  verify(0, 1);
  const back = verify(2, 0);
  expect(back.points.some((p) => p.y < 0 || p.y > 320)).toBe(true);
  verify(0, 2);
  verify(1, 0);
  verify(0, 1, [boxes[0], { ...boxes[1], x: 0, y: 500 }]);
});
test("parallel routes get separate outer lanes", () => {
  const a = routeConnection({ x: 840, y: 160 }, { x: 0, y: 160 }, boxes, 0);
  const b = routeConnection({ x: 840, y: 160 }, { x: 0, y: 160 }, boxes, 1);
  expect(a.path).not.toBe(b.path);
});
