/** Chosen once at load: phones and small tablets get fewer lights, no shadow maps and a lower pixel-ratio cap. */
export const lowPower =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 820px)').matches)

export const MAX_DPR = lowPower ? 1.5 : 1.75
