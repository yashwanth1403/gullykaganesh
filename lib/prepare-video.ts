import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, VIDEO_CONTENT_TYPES, type VideoContentType } from "./validation";

/**
 * A video ready to upload, plus the poster frame the rest of the site shows
 * in its place. There is no transcoding here — a phone's own encoder does a
 * better job than anything the browser could — so the file goes up as
 * recorded, and the work is in never *downloading* it until someone asks.
 */
export type PreparedVideo = {
  /** A copy of the clip held in memory — not the picker's File, see below. */
  blob: Blob;
  contentType: VideoContentType;
  poster: Blob;
  width: number;
  height: number;
  durationS: number;
  /** Object URL of the poster: what the tile and the pin preview show. */
  previewUrl: string;
};

export class VideoRejected extends Error {}

const POSTER_MAX_EDGE = 1600;
/** Mean luminance (0–255) below which a frame is "black" and we try the next. */
const BLACK_BELOW = 10;

/**
 * Where to try grabbing the poster. Frame zero of a phone clip is often
 * black or blurred, and a fade-in can make the first half-second black too,
 * so there are fallbacks further into the clip.
 */
function posterTimes(duration: number): number[] {
  const last = Math.max(0, duration - 0.1);
  return [...new Set([0.4, 1.0, duration * 0.25, duration * 0.5].map((t) => Math.min(t, last)))];
}

export async function prepareVideo(file: File): Promise<PreparedVideo> {
  if (!(VIDEO_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    throw new VideoRejected("That video format isn't supported. MP4 or MOV from the phone camera works.");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new VideoRejected(`Videos need to be under ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB. Trim it and try again.`);
  }

  const src = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;

  try {
    await once(video, "loadedmetadata");
    const durationS = Math.ceil(video.duration);
    if (!Number.isFinite(durationS) || durationS < 1) throw new VideoRejected("Couldn't read that video.");
    if (durationS > MAX_VIDEO_SECONDS) {
      throw new VideoRejected(`Keep videos under ${MAX_VIDEO_SECONDS} seconds — this one is ${durationS}s.`);
    }

    const scale = Math.min(1, POSTER_MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    // Frame grab. Phones don't decode a frame on seek alone — `seeked` fires
    // with nothing to draw, and drawImage gives a black canvas (iOS always,
    // Android often). So: seek, start muted playback (allowed without a
    // gesture), wait until a frame has actually been *presented*, pause,
    // draw. Then check it isn't black anyway and move later into the clip
    // if it is.
    // A genuinely dark clip (night, unlit lane) keeps its last attempt.
    for (const t of posterTimes(video.duration)) {
      await presentFrameAt(video, t);
      ctx.drawImage(video, 0, 0, width, height);
      if (meanLuminance(ctx, width, height) >= BLACK_BELOW) break;
    }

    const poster = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!poster) throw new Error("Could not encode poster");

    // Copy the bytes now. The File from a phone's gallery picker is a handle
    // to a temp export (iOS) or a content URI (Android) that the browser may
    // release once the input is reset or the picker closes — reading it at
    // submit time, minutes later, then fails with a bare "Failed to fetch".
    // Photos never hit this because the resized JPEG is already a Blob.
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });

    return {
      blob,
      contentType: file.type as VideoContentType,
      poster,
      width,
      height,
      durationS,
      previewUrl: URL.createObjectURL(poster),
    };
  } finally {
    // The <video> was only ever a decoder; release the file handle.
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(src);
  }
}

/** Seek to `t` and return once the browser has put that frame on screen. */
async function presentFrameAt(video: HTMLVideoElement, t: number): Promise<void> {
  video.pause();
  video.currentTime = t;
  await once(video, "seeked");
  // requestVideoFrameCallback fires when a frame is composited — the one
  // signal that means drawImage will see pixels. Fall back to `timeupdate`
  // where it isn't implemented (Firefox). Either way, cap the wait: a stalled
  // decoder should degrade to a black poster, not hang the form.
  const presented = new Promise<void>((resolve) => {
    if (typeof video.requestVideoFrameCallback === "function") video.requestVideoFrameCallback(() => resolve());
    else video.addEventListener("timeupdate", () => resolve(), { once: true });
  });
  await video.play().catch(() => {});
  await Promise.race([presented, new Promise<void>((r) => setTimeout(r, 1500))]);
  video.pause();
}

/** Average brightness of the canvas, sampled on a coarse grid. */
function meanLuminance(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  const { data } = ctx.getImageData(0, 0, width, height);
  let sum = 0;
  let n = 0;
  const step = Math.max(4, Math.floor(Math.sqrt((width * height) / 2000))) * 4;
  for (let i = 0; i < data.length; i += step) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    n++;
  }
  return n ? sum / n : 0;
}

function once(el: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new VideoRejected("Couldn't read that video."));
    };
    const cleanup = () => {
      el.removeEventListener(event, ok);
      el.removeEventListener("error", fail);
    };
    el.addEventListener(event, ok, { once: true });
    el.addEventListener("error", fail, { once: true });
  });
}
