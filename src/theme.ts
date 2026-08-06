import { createTheme, type MantineColorsTuple } from "@mantine/core";

/**
 * Mefie Tickets brand palette.
 *
 * No formal design system exists yet (that comes later, per the MVP roadmap).
 * This is a deliberately confident placeholder direction — dark-first,
 * high-contrast, a single vivid accent — so early screens look intentional
 * rather than default-Bootstrap while the real UI design work is pending.
 */
const brand: MantineColorsTuple = [
  "#f1edff",
  "#dcd4ff",
  "#b6a5ff",
  "#8d73ff",
  "#6b49fe",
  "#552efd",
  "#4a1ffd",
  "#3a15e0",
  "#3010c9",
  "#230aad",
];

export const theme = createTheme({
  primaryColor: "brand",
  colors: {
    brand,
  },
  primaryShade: { light: 5, dark: 4 },
  defaultRadius: "lg",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: {
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: "700",
  },
  defaultGradient: {
    from: "brand.5",
    to: "grape.6",
    deg: 135,
  },
  components: {
    Button: {
      defaultProps: {
        radius: "lg",
      },
    },
    Card: {
      defaultProps: {
        radius: "lg",
      },
    },
  },
});
