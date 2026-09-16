import { createTheme, type MantineColorsTuple } from "@mantine/core";

/**
 * Mefie Tickets brand palette. `brand.8`/`brand.9` are the two exact
 * navy shades from Mefie's brand guidelines (also the logo wordmark's
 * ink color) — `.8` for text (headings, links), `.9` for solid fills
 * (buttons, badges, the discover hero background). 0-7 are generated
 * tints of the same hue for lighter surfaces/variants; nothing outside
 * `.8`/`.9` is a guideline-specified value.
 */
const brand: MantineColorsTuple = [
  "#f1f6fb",
  "#d7e6f4",
  "#b3cee8",
  "#85b0d8",
  "#5892c9",
  "#3977b1",
  "#2f6190",
  "#264e73",
  "#1c3c59",
  "#152b40",
];

/**
 * The eyebrow/accent green — `.5` is Mefie's exact brand green (also the
 * logo's "TICKET" ink color). 0-4/6-9 are generated tints/shades of the
 * same hue; never use this as a text color on white (fails contrast).
 */
const lime: MantineColorsTuple = [
  "#f9fdef",
  "#f2fbdb",
  "#e8f8bf",
  "#daf39b",
  "#c8eb70",
  "#93c01f",
  "#86af1d",
  "#729518",
  "#5e7a15",
  "#495f11",
];

/** Color/Primitive/Grey — the app's neutral scale for text/surfaces/borders. */
const grey: MantineColorsTuple = [
  "#fafafa",
  "#f5f5f5",
  "#e5e5e5",
  "#d4d4d4",
  "#a3a3a3",
  "#737373",
  "#525252",
  "#404040",
  "#262626",
  "#171717",
];

/**
 * Brand text-navy (`.8`), swapped for a lighter tint (`.3`) in dark mode
 * where `.8` reads as near-invisible low-contrast grey-blue. Exported for
 * the handful of headings styled as `Text component="h1"` instead of
 * `Title` (which gets this from `components.Title.defaultProps` below),
 * so they don't each hand-roll the same `light-dark()` string.
 */
export const brandTextColor = "light-dark(var(--mantine-color-brand-8), var(--mantine-color-brand-3))";

export const theme = createTheme({
  primaryColor: "brand",
  colors: {
    brand,
    lime,
    grey,
  },
  // Fills (buttons, badges, avatars) use `.9` — the darker brand navy.
  // Dark mode stays on a lighter `.6` so filled elements still stand out
  // against an already-dark app background, mirroring the previous
  // scale's light/dark split.
  primaryShade: { light: 9, dark: 6 },
  defaultRadius: "md",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: {
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: "700",
  },
  defaultGradient: {
    from: "brand.6",
    to: "brand.9",
    deg: 135,
  },
  components: {
    Button: {
      defaultProps: {
        radius: "md",
      },
    },
    Card: {
      defaultProps: {
        radius: "lg",
      },
    },
    // Headings and links use the brand text-navy (see brandTextColor).
    Title: {
      defaultProps: {
        c: brandTextColor,
      },
    },
    Anchor: {
      defaultProps: {
        c: brandTextColor,
      },
    },
  },
});
