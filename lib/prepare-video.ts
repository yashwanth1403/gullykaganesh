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
/** Seek a little in: frame zero of a phone clip is often black or blurred. */
const POSTER_AT_S = 0.4;

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
  video.preload = "metadata";
  video.src = src;

  try {
    await once(video, "loadedmetadata");
    const durationS = Math.ceil(video.duration);
    if (!Number.isFinite(durationS) || durationS < 1) throw new VideoRejected("Couldn't read that video.");
    if (durationS > MAX_VIDEO_SECONDS) {
      throw new VideoRejected(`Keep videos under ${MAX_VIDEO_SECONDS} seconds — this one is ${durationS}s.`);
    }

    // Frame grab: seek, wait for the frame, draw it. `seeked` alone can fire
    // before the frame is painted on some browsers, so wait a tick as well.
    video.currentTime = Math.min(POSTER_AT_S, video.duration / 2);
    await once(video, "seeked");
    await new Promise(requestAnimationFrame);

    const scale = Math.min(1, POSTER_MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(video, 0, 0, width, height);
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
