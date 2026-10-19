/**
 * Design tokens. Mirrors the CSS custom properties in `tokens.css`; change both together and
 * update docs/design-system.md (see AGENTS.md).
 */
export const color = {
  bgDeep: "#071a14",
  bgField: "#0d2f24",
  bgPanel: "#12382c",
  chalk: "#e8efe6",
  chalkDim: "#9db5a8",
  lime: "#b8e23a",
  limeHot: "#d4ff5a",
  amber: "#f0a020",
  danger: "#e85d4c",
  ok: "#5ecf8a",
  dirtTop: "#c4a574",
  dirtBottom: "#9a7a4f",
  mound: "#b8956a",
} as const;

export const font = {
  display: '"Bebas Neue", "Arial Narrow", sans-serif',
  body: '"Manrope", "Segoe UI", sans-serif',
  svg: "Manrope,sans-serif",
} as const;

export const layout = {
  phoneWidth: 390,
  radius: 14,
  minTapTarget: 44,
} as const;

export const tokens = { color, font, layout } as const;
export type Tokens = typeof tokens;
