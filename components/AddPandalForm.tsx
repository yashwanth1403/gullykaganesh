"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Icon, { Spinner, type IconName } from "./Icon";
import LocationPicker from "./LocationPicker";
import { createPandal, requestUploadUrls } from "@/app/add/actions";
import { updatePandal } from "@/app/p/[id]/actions";
import { VISARJAN_DAYS, visarjanDate, type PandalPhoto, type VisarjanDay } from "@/lib/pandals";
import { resizeImage, type ResizedPhoto } from "@/lib/resize-image";
import { prepareVideo, VideoRejected, type PreparedVideo } from "@/lib/prepare-video";
import type { Place } from "@/lib/geocode";
import { MAX_PHOTOS, MAX_VIDEOS, MAX_VIDEO_SECONDS, PHOTO_CONTENT_TYPE } from "@/lib/validation";

/** A PUT to R2 that didn't land, with which object and why — the generic message hid this. */
class UploadFailed extends Error {}

/** Something picked in this session: a resized photo, or a video with its poster. */
type LocalMedia = ({ kind: "photo" } & ResizedPhoto) | ({ kind: "video" } & PreparedVideo);

function fmtDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Stage =
  | { kind: "idle" }
  /** `pending` = photos still being resized; `step` = which submit stage is running. */
  | { kind: "busy"; label: string; pending?: number; step?: 1 | 2 }
  | { kind: "error"; message: string };

const SUBMIT_STEPS = ["Uploading photos", "Putting it on the map"] as const;

const field =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-dim/60 shadow-[inset_0_1px_2px_rgba(36,18,8,0.04)] focus:border-turmeric focus:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40";

function SectionTitle({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-turmeric/18 text-ink">
        <Icon name={icon} size={16} strokeWidth={2.1} />
      </span>
      <span className="display text-[24px] text-ink">{children}</span>
    </h2>
  );
}

/** Two ticks that fill in as the upload moves — the wait has a shape. */
function SubmitProgress({ step }: { step: 1 | 2 }) {
  return (
    <ol className="animate-rise space-y-2 rounded-xl border border-line bg-paper-warm px-4 py-3.5" aria-live="polite">
      {SUBMIT_STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2;
        const state = n < step ? "done" : n === step ? "active" : "todo";
        return (
          <li key={label} className="flex items-center gap-2.5 text-[13px]">
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                state === "done"
                  ? "animate-pop bg-leaf text-paper"
                  : state === "active"
                    ? "text-kumkum"
                    : "border border-line text-transparent"
              }`}
            >
              {state === "done" && <Icon name="check" size={12} strokeWidth={3} />}
              {state === "active" && <Spinner size={18} />}
            </span>
            <span className={state === "todo" ? "text-ink-dim/70" : state === "done" ? "text-ink-dim line-through decoration-line" : "font-semibold text-ink"}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-ink">
        {label}
        {hint && <span className="text-[11.5px] font-normal text-ink-dim">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function PhotoInput({
  capture,
  onPick,
  icon,
  label,
  primary,
  accept = "image/*",
}: {
  capture?: boolean;
  onPick: (files: FileList | null) => void;
  icon: "camera" | "image";
  label: string;
  primary?: boolean;
  accept?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-full py-3 transition-transform duration-150 ease-out hover:-translate-y-px focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-turmeric active:translate-y-px ${
        primary
          ? "bg-turmeric text-ink shadow-[0_2px_0_rgba(36,18,8,0.22)]"
          : "border border-line bg-paper text-ink hover:bg-paper-warm"
      }`}
    >
      <Icon name={icon} size={15} strokeWidth={2.2} />
      <span className="numeric text-[11px] uppercase tracking-[0.06em]">{label}</span>
      <input
        type="file"
        accept={accept}
        multiple={!capture}
        capture={capture ? "environment" : undefined}
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

/** An existing pandal, when the form is editing rather than adding. */
export type EditInitial = {
  id: string;
  name: string;
  gully: string;
  area: string;
  instagramHandle: string | null;
  heightFt: number | null;
  establishedYear: number | null;
  ecoFriendly: boolean;
  theme: string | null;
  visarjanDay: VisarjanDay;
  lat: number;
  lng: number;
  /** Seeded landmarks may have no photos, and may keep having none. */
  landmark: boolean;
  photos: PandalPhoto[];
  /** Which existing photo is on the map pin; null when likes decide. */
  pinPhotoId: string | null;
};

/** The small "this one's on the map" mark on the chosen photo tile. */
function PinBadge() {
  return (
    <span className="numeric pointer-events-none absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-turmeric py-1 pr-2 pl-1.5 text-[9.5px] uppercase tracking-[0.07em] text-ink shadow-[0_1px_0_rgba(36,18,8,0.22)]">
      <Icon name="pin" size={10} strokeWidth={2.6} />
      On the map
    </span>
  );
}

/** Says "this one moves" on a tile that is showing a still. */
function VideoBadge({ durationS }: { durationS: number }) {
  return (
    <span className="numeric pointer-events-none absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full bg-ink/70 py-1 pr-2 pl-1.5 text-[9.5px] tracking-[0.04em] text-paper backdrop-blur">
      <Icon name="play" size={9} strokeWidth={2.4} className="fill-current" />
      {fmtDuration(durationS)}
    </span>
  );
}

const tile = "relative aspect-[4/5] overflow-hidden rounded-xl bg-paper-warm shadow-[var(--shadow-elevated)]";
const tileButton =
  "block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-turmeric disabled:cursor-default";
const tileActive = "ring-2 ring-turmeric ring-offset-2 ring-offset-paper";

/**
 * One form for adding and editing. In edit mode the fields start filled,
 * the photos already on the pandal sit ahead of any new ones, and the
 * submit goes to updatePandal instead of createPandal.
 */
export default function AddPandalForm({ initial }: { initial?: EditInitial }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<LocalMedia[]>([]);
  // Existing photos are never re-uploaded; removal is a set of ids, undoable
  // until Save so a mis-tap doesn't cost anyone a photo.
  const existing = initial?.photos ?? [];
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const kept = existing.length - removed.size;
  // Which photo goes in the map pin. Keys are `e:<id>` for photos already on
  // the pandal and `n:<previewUrl>` for new ones, so removing a photo never
  // shifts the choice onto its neighbour. If the chosen one is gone, or none
  // was chosen, the first photo still standing is the pin — the preview on
  // the map below always shows what will actually be saved.
  const [pinKey, setPinKey] = useState<string | null>(initial?.pinPhotoId ? `e:${initial.pinPhotoId}` : null);
  const pinnable = [
    ...existing.filter((p) => !removed.has(p.id)).map((p) => ({ key: `e:${p.id}`, url: p.url })),
    ...photos.map((p) => ({ key: `n:${p.previewUrl}`, url: p.previewUrl })),
  ];
  const pin = pinnable.find((p) => p.key === pinKey) ?? pinnable[0] ?? null;
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    initial ? { lat: initial.lat, lng: initial.lng } : null,
  );
  // Gully and area are controlled so the pin can fill them in. Once the
  // user has typed in a field it is theirs — the map stops overwriting it.
  // In edit mode both start as "typed": the saved values win over the pin.
  const [gully, setGully] = useState(initial?.gully ?? "");
  const [area, setArea] = useState(initial?.area ?? "");
  const [typed, setTyped] = useState({ gully: !!initial, area: !!initial });
  const [fromPin, setFromPin] = useState({ gully: false, area: false });

  function fillFromPin(p: Place) {
    if (!typed.gully && p.gully) {
      setGully(p.gully);
      setFromPin((f) => ({ ...f, gully: true }));
    }
    if (!typed.area && p.area) {
      setArea(p.area);
      setFromPin((f) => ({ ...f, area: true }));
    }
  }
  // No default: a wrong day recorded silently is worse than one more tap.
  const [visarjanDay, setVisarjanDay] = useState<(typeof VISARJAN_DAYS)[number] | null>(
    initial?.visarjanDay ?? null,
  );
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  // Object URLs leak until revoked — but only once nothing shows them. The
  // pin preview re-mounts its <img> on every switch, so a URL revoked early
  // (as a cleanup keyed on `photos` would do) turns into a broken image.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  async function pickPhotos(files: FileList | null) {
    // Cancelling the picker fires change with nothing in it on some browsers.
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - kept - photos.length;
    const picked = Array.from(files).slice(0, room);
    // Videos are capped separately: they cost 100× the bytes of a photo.
    const videosNow =
      existing.filter((p) => p.video && !removed.has(p.id)).length + photos.filter((p) => p.kind === "video").length;
    if (videosNow + picked.filter((f) => f.type.startsWith("video/")).length > MAX_VIDEOS) {
      return setStage({ kind: "error", message: `Up to ${MAX_VIDEOS} videos per mandapam; the rest can be photos.` });
    }
    setStage({ kind: "busy", label: "Preparing photos…", pending: picked.length });
    try {
      const next = await Promise.all(
        picked.map(async (f): Promise<LocalMedia> =>
          f.type.startsWith("video/")
            ? { kind: "video", ...(await prepareVideo(f)) }
            : { kind: "photo", ...(await resizeImage(f)) },
        ),
      );
      setPhotos((cur) => [...cur, ...next]);
      setStage({ kind: "idle" });
    } catch (err) {
      setStage({
        kind: "error",
        message: err instanceof VideoRejected ? err.message : "One of those files isn't a photo we can read.",
      });
    }
  }

  function removePhoto(i: number) {
    URL.revokeObjectURL(photos[i].previewUrl);
    setPhotos((cur) => cur.filter((_, n) => n !== i));
  }

  function toggleExisting(id: string) {
    setRemoved((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (kept + photos.length === 0 && !initial?.landmark) {
      return setStage({ kind: "error", message: initial ? "Keep at least one photo." : "Add at least one photo." });
    }
    if (!location) return setStage({ kind: "error", message: "Put the pin on the mandapam." });
    if (!visarjanDay) return setStage({ kind: "error", message: "Pick the visarjan day." });

    const form = new FormData(e.currentTarget);
    try {
      type Uploaded = {
        key: string;
        width: number;
        height: number;
        kind: "photo" | "video";
        posterKey?: string;
        durationS?: number;
      };
      let uploaded: Uploaded[] = [];
      if (photos.length > 0) {
        setStage({ kind: "busy", label: "Uploading photos…", step: 1 });
        // One slot per object: a photo is one, a video is two (file + poster).
        const types = photos.flatMap((p) =>
          p.kind === "video" ? [p.contentType, PHOTO_CONTENT_TYPE] : [PHOTO_CONTENT_TYPE],
        );
        const slots = await requestUploadUrls(types);
        const put = async (url: string, type: string, body: Blob) => {
          const res = await fetch(url, { method: "PUT", headers: { "Content-Type": type }, body }).catch(() => {
            throw new UploadFailed(`${type.startsWith("video/") ? "The video" : "A photo"} couldn't be sent. Check your signal and try again.`);
          });
          if (!res.ok) {
            throw new UploadFailed(
              `${type.startsWith("video/") ? "The video" : "A photo"} was refused by storage (HTTP ${res.status}). Try again.`,
            );
          }
        };
        let n = 0;
        uploaded = await Promise.all(
          photos.map(async (p) => {
            const slot = slots[n++];
            if (p.kind === "video") {
              const posterSlot = slots[n++];
              await Promise.all([put(slot.url, p.contentType, p.blob), put(posterSlot.url, PHOTO_CONTENT_TYPE, p.poster)]);
              return { key: slot.key, width: p.width, height: p.height, kind: "video" as const, posterKey: posterSlot.key, durationS: p.durationS };
            }
            await put(slot.url, PHOTO_CONTENT_TYPE, p.blob);
            return { key: slot.key, width: p.width, height: p.height, kind: "photo" as const };
          }),
        );
      }

      setStage({ kind: "busy", label: initial ? "Saving…" : "Putting it on the map…", step: 2 });
      const fields = {
        name: form.get("name"),
        gully: form.get("gully"),
        area: form.get("area"),
        instagramHandle: form.get("instagramHandle") ?? "",
        heightFt: form.get("heightFt"),
        establishedYear: form.get("establishedYear"),
        ecoFriendly: form.get("ecoFriendly") === "on",
        theme: form.get("theme") ?? "",
        visarjanDay,
        lat: location.lat,
        lng: location.lng,
        photos: uploaded,
        pinIndex: pin?.key.startsWith("n:") ? photos.findIndex((p) => `n:${p.previewUrl}` === pin.key) : undefined,
      };
      const result = initial
        ? await updatePandal({
            ...fields,
            id: initial.id,
            removePhotoIds: [...removed],
            pinPhotoId: pin?.key.startsWith("e:") ? pin.key.slice(2) : undefined,
          })
        : await createPandal(fields);
      if (!result.ok) return setStage({ kind: "error", message: result.error });
      router.push(`/?p=${result.id}`);
    } catch (err) {
      setStage({
        kind: "error",
        message: err instanceof UploadFailed ? err.message : "Upload didn't go through. Check your signal and try again.",
      });
    }
  }

  const busy = stage.kind === "busy";
  const pending = stage.kind === "busy" ? (stage.pending ?? 0) : 0;
  const step = stage.kind === "busy" ? stage.step : undefined;

  return (
    <form onSubmit={submit} className="space-y-7" aria-busy={busy}>
      {step && <div className="progress-bar fixed inset-x-0 top-0 z-30" aria-hidden />}
      {/* Photos first: they are the whole reason the map exists. */}
      <section>
        <SectionTitle icon="camera">Photos</SectionTitle>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">
          The idol, the mandapam, the lane. Up to {MAX_PHOTOS}, and up to {MAX_VIDEOS} of them short videos
          (under {MAX_VIDEO_SECONDS}s).{pinnable.length > 1 && " Tap one to put it on the map pin."}
        </p>
        <div
          role="radiogroup"
          aria-label="Photo for the map pin"
          className={`mt-3 grid grid-cols-3 gap-2 transition-opacity duration-300 ${step ? "opacity-60" : ""}`}
        >
          {existing.map((p) => {
            const gone = removed.has(p.id);
            const onPin = pin?.key === `e:${p.id}`;
            return (
              <div key={p.id} className={`${tile} ${onPin ? tileActive : ""}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={onPin}
                  aria-label={onPin ? "On the map pin" : "Put this photo on the map pin"}
                  disabled={gone}
                  onClick={() => setPinKey(`e:${p.id}`)}
                  className={tileButton}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- already-optimised R2 upload */}
                  <img
                    src={p.url}
                    alt=""
                    className={`h-full w-full object-cover transition-opacity duration-200 ${gone ? "opacity-30" : ""}`}
                  />
                </button>
                {p.video && <VideoBadge durationS={p.video.durationS} />}
                {onPin && <PinBadge />}
                <button
                  type="button"
                  onClick={() => toggleExisting(p.id)}
                  aria-label={gone ? "Keep this photo" : "Remove this photo"}
                  aria-pressed={gone}
                  className={`absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full text-paper backdrop-blur transition-transform duration-150 ease-out hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric active:scale-95 ${
                    gone ? "bg-leaf" : "bg-ink/70"
                  }`}
                >
                  <Icon name={gone ? "plus" : "x"} size={13} strokeWidth={2.4} />
                </button>
                {gone && (
                  <span className="numeric absolute inset-x-0 bottom-0 bg-ink/70 py-1 text-center text-[9.5px] uppercase tracking-[0.07em] text-paper">
                    Removed on save
                  </span>
                )}
              </div>
            );
          })}
          {photos.map((p, i) => {
            const onPin = pin?.key === `n:${p.previewUrl}`;
            return (
              <div key={p.previewUrl} className={`${tile} ${onPin ? tileActive : ""}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={onPin}
                  aria-label={onPin ? "On the map pin" : "Put this photo on the map pin"}
                  onClick={() => setPinKey(`n:${p.previewUrl}`)}
                  className={tileButton}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                  <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                </button>
                {p.kind === "video" && <VideoBadge durationS={p.durationS} />}
                {onPin && <PinBadge />}
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-ink/70 text-paper backdrop-blur transition-transform duration-150 ease-out hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric active:scale-95"
                >
                  <Icon name="x" size={13} strokeWidth={2.4} />
                </button>
              </div>
            );
          })}
          {Array.from({ length: pending }, (_, i) => (
            <div key={`pending-${i}`} className="skeleton relative aspect-[4/5]">
              <span className="absolute inset-0 grid place-items-center text-ink-dim">
                <Spinner size={22} />
              </span>
            </div>
          ))}
        </div>
        {kept + photos.length < MAX_PHOTOS && (
          <div className={`grid gap-2 ${kept + photos.length === 0 ? "mt-3 grid-cols-2" : "mt-2 grid-cols-2"}`}>
            {/* Two inputs on purpose: `capture` opens the camera directly on a
                phone, and the same attribute hides the gallery, so each gets
                its own button. Desktop ignores `capture` and both pick files. */}
            <PhotoInput capture onPick={pickPhotos} icon="camera" label="Take a photo" primary={kept + photos.length === 0} />
            <PhotoInput onPick={pickPhotos} icon="image" label="Choose from gallery" accept="image/*,video/*" />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionTitle icon="pin">Where is it</SectionTitle>
        <LocationPicker value={location} onChange={setLocation} onPlace={fillFromPin} photo={pin?.url} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gully" hint={fromPin.gully && !typed.gully ? "from the pin" : "the lane"}>
            <input
              name="gully"
              required
              maxLength={80}
              className={field}
              placeholder="Road No. 12"
              autoComplete="off"
              value={gully}
              onChange={(e) => {
                setGully(e.target.value);
                setTyped((t) => ({ ...t, gully: true }));
              }}
            />
          </Field>
          <Field label="Area" hint={fromPin.area && !typed.area ? "from the pin" : undefined}>
            <input
              name="area"
              required
              maxLength={60}
              className={field}
              placeholder="Banjara Hills"
              autoComplete="off"
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setTyped((t) => ({ ...t, area: true }));
              }}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle icon="pen">About the mandapam</SectionTitle>
        {/* The name *is* the organisation — the committee, team, or colony
            that puts it up is what everyone calls the mandapam. */}
        <Field label="Name" hint="team name or what the Ganesh is known as">
          <input name="name" required maxLength={80} className={field} placeholder="Team Adidev / Bahubali Ganesh" autoComplete="organization" defaultValue={initial?.name} />
        </Field>
        {/* The glyph in the field says what to paste; a URL is fine too. */}
        <Field label="Instagram" hint="optional">
          <span className="relative block">
            <Icon
              name="instagram"
              size={16}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-dim"
            />
            <input
              name="instagramHandle"
              maxLength={60}
              className={`${field} pl-10`}
              placeholder="@handle or profile link"
              autoCapitalize="none"
              autoComplete="off"
              defaultValue={initial?.instagramHandle ?? undefined}
            />
          </span>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Height" hint="in feet">
            <input name="heightFt" type="number" inputMode="numeric" required min={1} max={150} className={field} placeholder="12" defaultValue={initial?.heightFt ?? undefined} />
          </Field>
          <Field label="Since" hint="year, optional">
            <input name="establishedYear" type="number" inputMode="numeric" min={1800} max={new Date().getFullYear()} className={field} placeholder="1954" defaultValue={initial?.establishedYear ?? undefined} />
          </Field>
        </div>
        <Field label="Theme" hint="optional">
          <input name="theme" maxLength={80} className={field} placeholder="ISRO, Ayodhya temple…" autoComplete="off" defaultValue={initial?.theme ?? undefined} />
        </Field>
        {/* A native checkbox styled as a pill: the label is the whole hit area. */}
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-3.5 py-3 transition-[background-color] duration-150 ease-out hover:bg-paper-warm has-[:checked]:border-leaf has-[:checked]:bg-leaf/8 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-turmeric">
          <input name="ecoFriendly" type="checkbox" defaultChecked={initial?.ecoFriendly} className="h-4 w-4 accent-leaf" />
          <span className="text-[14px] text-ink">Clay idol</span>
          <span className="ml-auto text-[12px] text-ink-dim">eco-friendly, no plaster</span>
        </label>
      </section>

      <section>
        <SectionTitle icon="waves">Visarjan day</SectionTitle>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">
          When does this Ganesh go into the water? The map turns red for the last two days.
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Visarjan day">
          {VISARJAN_DAYS.map((d) => {
            const on = d === visarjanDay;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setVisarjanDay(d)}
                className={`numeric flex flex-col items-center rounded-xl border py-2 transition-transform duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:scale-95 ${
                  on ? "border-kumkum bg-kumkum text-paper" : "border-line bg-paper-warm text-ink-dim hover:bg-paper"
                }`}
              >
                <span className="text-[16px] leading-none">Day {d}</span>
                <span className="mt-1 text-[9.5px] uppercase tracking-[0.05em] opacity-80">
                  {visarjanDate({ visarjanDay: d } as never).replace(/^\w+, /, "")}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {stage.kind === "error" && (
        <p role="alert" className="rounded-xl border border-kumkum/40 bg-kumkum/8 px-3.5 py-3 text-[13.5px] text-kumkum">
          {stage.message}
        </p>
      )}

      {step && <SubmitProgress step={step} />}

      <button
        type="submit"
        disabled={busy}
        className="numeric flex w-full items-center justify-center gap-2 rounded-full bg-turmeric py-4 text-[12px] uppercase tracking-[0.08em] text-ink shadow-[0_2px_0_rgba(36,18,8,0.22)] transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-px disabled:opacity-70"
      >
        {busy ? <Spinner size={15} /> : <Icon name="pin" size={15} strokeWidth={2.2} />}
        {stage.kind === "busy" ? stage.label : initial ? "Save changes" : "Put it on the map"}
      </button>
    </form>
  );
}
