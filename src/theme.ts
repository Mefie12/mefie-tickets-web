import { createTheme, type MantineColorsTuple } from "@mantine/core";

/**
 * Mefie Tickets brand palette — sourced from the Discover Events Figma
 * file's published variables (Color/Primitive/Accent, Color/Primitive/Grey,
 * Color/Surface/*, Color/Text/*, Color/Border/*), replacing the earlier
 * placeholder violet palette now that a real design system exists.
 */
const brand: MantineColorsTuple = [
  "#eff6ff",
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#2563eb",
  "#1d4ed8",
  "#1e40af",
  "#1e3a8a",
];

/** The Discover hero's dark background — Color/Primitive/Accent/900. */
const navy: MantineColorsTuple = [
  "#e8ecf7",
  "#c6d0ea",
  "#a2b1dc",
  "#7c91cd",
  "#5a76c0",
  "#3f61b8",
  "#2f55b4",
  "#22459f",
  "#1a3890",
  "#1e3a8a",
];

/** The hero eyebrow/accent highlight — used sparingly, never as a text color on white. */
const lime: MantineColorsTuple = [
  "#fbffe8",
  "#f4ffc7",
  "#ecffa3",
  "#e4ff7d",
  "#dfff60",
  "#d8ff72",
  "#c8ef5e",
  "#b0d64c",
  "#98bd3d",
  "#7fa32c",
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

export const theme = createTheme({
  primaryColor: "brand",
  colors: {
    brand,
    navy,
    lime,
    grey,
  },
  primaryShade: { light: 6, dark: 5 },
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
    to: "navy.9",
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
  },
});
