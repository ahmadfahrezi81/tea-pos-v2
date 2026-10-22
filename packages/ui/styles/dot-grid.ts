import type { CSSProperties } from "react";

/** A dot grid from one gradient (no image, no element per dot), fading out at the edges. Paint it on a sized layer behind the art. */
export const DOT_GRID: CSSProperties = {
    backgroundImage: "radial-gradient(rgba(0,0,0,0.12) 1px, transparent 1px)",
    backgroundSize: "14px 14px",
    WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 72%)",
    maskImage: "radial-gradient(ellipse at center, black 20%, transparent 72%)",
};
