/**
 * Ludo board geometry on a 15x15 grid (x = column, y = row, 0-based, top-left origin).
 * Yards: red top-left, green top-right, yellow bottom-right, blue bottom-left. Play runs clockwise.
 *
 * A token's progress is 0..56:
 *   -1      in the yard
 *   0..50   on the shared 52-square loop (0 = its start square)
 *   51..55  its own coloured home lane
 *   56      home (centre)
 */
export type Color = "red" | "green" | "yellow" | "blue";
export const COLORS: Color[] = ["red", "green", "yellow", "blue"];

export const YARD = -1;
export const LAST_LOOP = 50;
export const HOME = 56;

function seg(xs: number[], ys: number[]): [number, number][] {
  return xs.map((x, i) => [x, ys[i]]);
}
const range = (a: number, b: number) => {
  const out: number[] = [];
  if (a <= b) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
};
const fill = (v: number, n: number) => Array(n).fill(v);

/** The 52 shared squares, starting at red's start square and going clockwise. */
export const LOOP: [number, number][] = [
  ...seg(range(1, 5), fill(6, 5)),
  ...seg(fill(6, 6), range(5, 0)),
  ...seg([7, 8], [0, 0]),
  ...seg(fill(8, 5), range(1, 5)),
  ...seg(range(9, 14), fill(6, 6)),
  ...seg([14, 14], [7, 8]),
  ...seg(range(13, 9), fill(8, 5)),
  ...seg(fill(8, 6), range(9, 14)),
  ...seg([7, 6], [14, 14]),
  ...seg(fill(6, 5), range(13, 9)),
  ...seg(range(5, 0), fill(8, 6)),
  ...seg([0, 0], [7, 6]),
];

export const START: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 };

export const LANES: Record<Color, [number, number][]> = {
  red: seg(range(1, 5), fill(7, 5)),
  green: seg(fill(7, 5), range(1, 5)),
  yellow: seg(range(13, 9), fill(7, 5)),
  blue: seg(fill(7, 5), range(13, 9)),
};

/** Safe squares (loop indices): the four start squares and the four stars 8 steps after them. */
export const SAFE = new Set<number>(COLORS.flatMap((c) => [START[c], (START[c] + 8) % 52]));

export const YARD_SPOTS: Record<Color, [number, number][]> = {
  red: [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]],
  green: [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]],
  yellow: [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]],
  blue: [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]],
};

export const HOME_SPOT: Record<Color, [number, number]> = { red: [6.6, 7.5], green: [7.5, 6.6], yellow: [8.4, 7.5], blue: [7.5, 8.4] };

/** Loop index for a token's progress, or null if it isn't on the shared loop. */
export function loopIndex(color: Color, progress: number): number | null {
  if (progress < 0 || progress > LAST_LOOP) return null;
  return (START[color] + progress) % 52;
}

/** Cell-centre coordinate (in cell units) where a token is drawn. */
export function tokenXY(color: Color, progress: number, token: number): [number, number] {
  if (progress === YARD) {
    const [x, y] = YARD_SPOTS[color][token];
    return [x + 0.5, y + 0.5];
  }
  if (progress >= HOME) return HOME_SPOT[color];
  if (progress > LAST_LOOP) {
    const [x, y] = LANES[color][progress - LAST_LOOP - 1];
    return [x + 0.5, y + 0.5];
  }
  const [x, y] = LOOP[loopIndex(color, progress)!];
  return [x + 0.5, y + 0.5];
}
