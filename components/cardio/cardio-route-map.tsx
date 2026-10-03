"use client";

import { useMemo } from "react";

export type RouteMapPoint = { lat: number; lng: number };

const ZOOM = 16;
const TILE = 256;

function lon2x(lon: number, zoom: number) {
  return ((lon + 180) / 360) * 2 ** zoom * TILE;
}

function lat2y(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    2 ** zoom *
    TILE
  );
}

/** Ciemna mapa (Carto dark) + trasa + marker — bez leaflet. */
export function CardioRouteMap({
  points,
  className,
}: {
  points: RouteMapPoint[];
  className?: string;
}) {
  const center = points[points.length - 1] ?? { lat: 52.2297, lng: 21.0122 };

  const layout = useMemo(() => {
    const cx = lon2x(center.lng, ZOOM);
    const cy = lat2y(center.lat, ZOOM);
    const tileX = Math.floor(cx / TILE);
    const tileY = Math.floor(cy / TILE);
    const originX = (tileX - 1) * TILE;
    const originY = (tileY - 1) * TILE;
    const width = TILE * 3;
    const height = TILE * 3;

    const path = points
      .map((p, i) => {
        const x = lon2x(p.lng, ZOOM) - originX;
        const y = lat2y(p.lat, ZOOM) - originY;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    const markerX = cx - originX;
    const markerY = cy - originY;

    const tiles: { key: string; src: string; left: number; top: number }[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = tileX + dx;
        const y = tileY + dy;
        tiles.push({
          key: `${ZOOM}/${x}/${y}`,
          src: `https://basemaps.cartocdn.com/dark_all/${ZOOM}/${x}/${y}.png`,
          left: (dx + 1) * TILE,
          top: (dy + 1) * TILE,
        });
      }
    }

    return { tiles, path, markerX, markerY, width, height };
  }, [center.lat, center.lng, points]);

  return (
    <div className={className}>
      <div className="absolute inset-0 overflow-hidden bg-[#0b141a]">
        <div
          className="absolute"
          style={{
            width: layout.width,
            height: layout.height,
            left: `calc(50% - ${layout.markerX}px)`,
            top: `calc(50% - ${layout.markerY}px)`,
          }}
        >
          {layout.tiles.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={t.key}
              src={t.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute select-none"
              style={{ left: t.left, top: t.top, width: TILE, height: TILE }}
            />
          ))}
          <svg
            className="pointer-events-none absolute inset-0"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
          >
            {points.length > 1 ? (
              <path
                d={layout.path}
                fill="none"
                stroke="rgba(96,165,250,0.9)"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            <circle
              cx={layout.markerX}
              cy={layout.markerY}
              r={20}
              fill="rgba(52,211,153,0.2)"
            />
            <circle
              cx={layout.markerX}
              cy={layout.markerY}
              r={12}
              fill="rgba(255,255,255,0.2)"
            />
            <circle
              cx={layout.markerX}
              cy={layout.markerY}
              r={7}
              fill="#3b82f6"
              stroke="#fff"
              strokeWidth={2.5}
            />
          </svg>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/50 to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
