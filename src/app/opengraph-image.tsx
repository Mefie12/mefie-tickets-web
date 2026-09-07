import { ImageResponse } from "next/og";

// The link-preview image for any page that doesn't provide its own —
// i.e. the home page, /discover, and events with no cover uploaded yet.
export const alt = "Mefie Tickets — discover live experiences";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          color: "#ffffff",
          backgroundImage: "linear-gradient(135deg, #4263eb 0%, #7048e8 60%, #9c36b5 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 600, opacity: 0.9, letterSpacing: 2 }}>MEFIE TICKETS</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.1, marginTop: 24 }}>
          Find something worth showing up for.
        </div>
        <div style={{ fontSize: 30, opacity: 0.85, marginTop: 28 }}>
          Concerts, festivals, talks and parties — get your tickets.
        </div>
      </div>
    ),
    { ...size },
  );
}
