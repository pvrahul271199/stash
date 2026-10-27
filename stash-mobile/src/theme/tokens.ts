export const colors = {
  bg: '#FFFFFF',
  ink: '#1E1B4B',
  ink2: '#8B88C2',
  soft: '#5F5C80',
  faint: '#A9A7C4',
  line: '#E4E3F0',
  tint: '#F5F5FA',
  good: '#0F766E',
  goodBg: '#E3F3F1',
  warm: '#B45309',
  warmBg: '#FDF1E4',
  frame: '#EEEEF6',
} as const;

/**
 * Category colors for charts, assigned by rank (biggest first).
 * NOTE: the spec was cut off after the 5th value; the rest continue the
 * same indigo/teal alternation. Adjust if you have the original values.
 */
export const categoryRamp = [
  '#1E1B4B',
  '#0F766E',
  '#4B47A0',
  '#4FA39B',
  '#7E7BBF',
  '#8CC7C0',
  '#B5B3DA',
  '#C9E4E1',
] as const;
