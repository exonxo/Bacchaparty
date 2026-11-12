/** Motion springs for Puno — tuned for snappy 60fps transforms. */

export const throwSpring = { type: "spring" as const, stiffness: 420, damping: 26, mass: 0.85 };
export const snapSpring = { type: "spring" as const, stiffness: 520, damping: 32, mass: 0.7 };
export const fanSpring = { type: "spring" as const, stiffness: 380, damping: 30, mass: 0.75 };
export const slapSpring = { type: "spring" as const, stiffness: 600, damping: 18, mass: 0.55 };
export const pileSpring = { type: "spring" as const, stiffness: 480, damping: 22 };
