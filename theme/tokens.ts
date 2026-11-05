export const colors = {
  bg: '#FFFFFF',
  ink: '#1E1B4B',
  ink2: '#8E8C96',
  soft: '#625F6A',
  faint: '#A5A29C',
  line: '#E7E5E1',
  tint: '#F7F6FD', // very light violet, same hue family as ink (#1E1B4B)
  good: '#0F766E',
  goodBg: '#E3F3F1',
  warm: '#B45309',
  warmBg: '#FDF1E4',
  bad: '#B91C1C',
  frame: '#EFEDEA',
} as const;

/**
 * Category colors for charts, assigned by rank (biggest first).
 * Distinct, muted hues (not a single indigo ramp) so slices are readable at a glance.
 */
export const categoryRamp = [
  '#1E1B4B', // ink
  '#0F766E', // teal
  '#D98324', // amber
  '#C2546F', // rose
  '#3A7CA5', // steel blue
  '#7A9A3C', // olive
  '#8A6BB8', // soft violet
  '#9C9486', // warm grey
] as const;
