import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Default preview only; event and series metadata provide their own cover images.
export const alt = "Mefie Tickets — find your next unforgettable moment";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logo = await readFile(join(process.cwd(), "public/images/mefie-logo-dark.png"), "base64");
const photo = await readFile(join(process.cwd(), "public/images/discover-hero.jpg"), "base64");

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#152b40", color: "#ffffff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 640, padding: "52px 54px", justifyContent: "space-between" }}>
          {/* ImageResponse embeds these assets directly; next/image is not supported here. */}
          <img src={`data:image/png;base64,${logo}`} alt="Mefie Tickets" width={260} height={80} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
              Find your next unforgettable moment.
            </div>
            <div style={{ fontSize: 25, lineHeight: 1.4, color: "#d8e1e8", marginTop: 26 }}>
              Discover music, culture, food, ideas and people shaping your city.
            </div>
          </div>
          <div style={{ width: 64, height: 5, background: "#a4ce39" }} />
        </div>
        <img src={`data:image/jpeg;base64,${photo}`} alt="A singer performing into a microphone" width={560} height={630} style={{ objectFit: "cover", objectPosition: "35% center" }} />
      </div>
    ),
    { ...size },
  );
}
