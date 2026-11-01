import { ImageResponse } from "next/og";

export const alt = "GymBrat — centrum treningowe";
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
          padding: 80,
          background: "#07080d",
          color: "#f5f5f5",
        }}
      >
        <div style={{ fontSize: 140, fontWeight: 800, color: "#DDBB6D" }}>GymBrat</div>
        <div style={{ fontSize: 48, marginTop: 24 }}>
          Dziennik treningowy i żywieniowy: plany, historia, raporty.
        </div>
      </div>
    ),
    size,
  );
}
