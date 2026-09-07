/**
 * Geometry helpers for the event cover crop. The browser only *frames*
 * the image — it reads dimensions, drives the crop UI, and hands the
 * backend a rectangle. The backend keeps the original and cuts every
 * derivative from that rectangle, so the source is never destroyed.
 */

export const COVER_ASPECT = 16 / 9;
/** Hard floor — below this the framed 16:9 region can't make a passable cover. */
export const COVER_MIN_CROP_WIDTH = 640;
/** Ideal minimum — 640..this is accepted but the crop modal shows a "looks sharper if larger" note. */
export const COVER_RECOMMENDED_CROP_WIDTH = 1600;
/** A source already within this ratio band is treated as landscape-enough to skip the crop modal. */
export const COVER_RATIO_BAND: readonly [number, number] = [1.7, 1.9];

export type PixelCrop = { x: number; y: number; width: number; height: number };

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}

export async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The largest centred 16:9 rectangle that fits inside width×height. */
export function centeredCrop(width: number, height: number, aspect = COVER_ASPECT): PixelCrop {
  const cropWidth = Math.min(width, height * aspect);
  const cropHeight = cropWidth / aspect;
  return {
    x: Math.round((width - cropWidth) / 2),
    y: Math.round((height - cropHeight) / 2),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  };
}

/**
 * What to do with a freshly-picked source of `width`×`height`:
 *  - "reject": even a perfect 16:9 crop would be under COVER_MIN_CROP_WIDTH
 *  - "auto": recommended quality AND already ~16:9 — centre-crop and upload, no modal
 *  - "crop": open the framing modal (also covers the "acceptable but below
 *    recommended" band, so the organiser sees the quality note)
 */
export function coverOutcome(width: number, height: number): "reject" | "auto" | "crop" {
  const bestCropWidth = Math.min(width, height * COVER_ASPECT);
  if (bestCropWidth < COVER_MIN_CROP_WIDTH) return "reject";
  const ratio = width / height;
  const [min, max] = COVER_RATIO_BAND;
  return bestCropWidth >= COVER_RECOMMENDED_CROP_WIDTH && ratio >= min && ratio <= max ? "auto" : "crop";
}

/** The API's expected crop field names for a rectangle. */
export function cropFields(rect: PixelCrop): {
  crop_x: number;
  crop_y: number;
  crop_width: number;
  crop_height: number;
} {
  return {
    crop_x: Math.round(rect.x),
    crop_y: Math.round(rect.y),
    crop_width: Math.round(rect.width),
    crop_height: Math.round(rect.height),
  };
}
