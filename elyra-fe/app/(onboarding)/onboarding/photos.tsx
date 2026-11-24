"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { photoLimit, photoTypes } from "../../../../elyra-be/src/onboarding/options";
import { json, message, type Api, type PhotoStatus } from "@/lib/onboarding";

type Pending = { file: File; id: string; uploadPath?: string };

async function compressPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!compressed || compressed.type !== "image/webp" || compressed.size >= file.size) return file;
    return new File([compressed], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } finally { bitmap.close(); }
}

function Preview({ api, id, file, alt }: { api?: Api; id?: string; file?: File; alt: string }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      try {
        const blob = file ?? (api && id ? await (await api(`/photos/${id}`, { signal: controller.signal })).blob() : null);
        if (blob && !controller.signal.aborted) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, file, id]);
  return <div className="photo-preview">
    {url ? <Image unoptimized src={url} alt={alt} width={240} height={280} />
      : <span>{failed ? "Preview unavailable" : "Loading photo…"}</span>}
  </div>;
}

export function PhotoStep({ api, status, update, onBack, onNext }: {
  api: Api; status: PhotoStatus; update: (status: PhotoStatus) => void; onBack: () => void; onNext: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);

  async function upload(list: Pending[], initialErrors: string[] = []) {
    if (!list.length) { setErrors(initialErrors); return; }
    setBusy(true);
    setErrors(initialErrors);
    setPending(list);
    const remaining: Pending[] = [];
    const failures = [...initialErrors];
    for (const item of list) {
      let path = item.uploadPath;
      try {
        if (!path) {
          const signed = await api("/photos/upload-url", json("POST", { type: item.file.type, size: item.file.size }));
          const { uploadPath } = await signed.json() as { uploadPath: string };
          path = uploadPath.replace(/^\/api\/onboarding/, "");
        }
        const result = await api(path, { method: "PUT", body: item.file });
        update(await result.json());
        setPending((photos) => photos.filter((photo) => photo.id !== item.id));
      } catch (error) {
        remaining.push({ ...item, uploadPath: error instanceof Error && error.message.includes("expired") ? undefined : path });
        failures.push(`${item.file.name} — ${message(error)}`);
      }
    }
    setPending(remaining);
    setErrors(failures);
    setBusy(false);
  }

  async function select(files: File[]) {
    const valid: Pending[] = [];
    const invalid: string[] = [];
    const available = 5 - status.photos.length;
    for (const file of files) {
      if (!(photoTypes as readonly string[]).includes(file.type)) invalid.push(`${file.name} — Choose JPEG, PNG, or WebP.`);
      else if (file.size > photoLimit) invalid.push(`${file.name} — Each photo must be 5 MB or smaller.`);
      else if (valid.length >= available) invalid.push(`${file.name} — You can upload up to 5 photos.`);
      else {
        try { valid.push({ file: await compressPhoto(file), id: crypto.randomUUID() }); }
        catch { invalid.push(`${file.name} — Couldn’t read this image.`); }
      }
    }
    void upload(valid, invalid);
  }

  async function change(path: string, method: string) {
    setBusy(true);
    setErrors([]);
    try { update(await (await api(path, { method })).json()); }
    catch (error) { setErrors([message(error)]); }
    finally { setBusy(false); }
  }

  return <>
    <h1>Add your photos</h1><p>Choose 2 to 5 recent photos. Use JPEG, PNG, or WebP, up to 5 MB each.</p>
    <div className="photo-grid">
      {status.photos.map(({ id }, index) => <article className="photo-item" key={id}>
        <Preview api={api} id={id} alt={`Profile photo ${index + 1}`} />
        <div className="photo-controls">
          {status.primaryPhotoId === id ? <strong>Primary</strong>
            : <button className="quiet" disabled={busy} onClick={() => change(`/photos/${id}/primary`, "PATCH")}>Make primary</button>}
          <button className="quiet" disabled={busy} onClick={() => change(`/photos/${id}`, "DELETE")} aria-label={`Remove photo ${index + 1}`}>Remove</button>
        </div>
      </article>)}
      {pending.map(({ id, file }) => <article className="photo-item" key={id}>
        <Preview file={file} alt={file.name} /><span className="photo-controls">{busy ? "Uploading…" : "Upload failed"}</span>
      </article>)}
    </div>
    {!pending.length && status.photos.length < 5 && <label className="upload">
      <span aria-hidden="true">＋</span> Add photos
      <input type="file" accept={photoTypes.join(",")} multiple disabled={busy} onChange={(e) => {
        void select(Array.from(e.currentTarget.files ?? []));
        e.currentTarget.value = "";
      }} />
    </label>}
    {errors.length > 0 && <ul className="notice" role="alert">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    {!!pending.length && !busy && <div className="actions">
      <button className="quiet" onClick={() => { setPending([]); setErrors([]); }}>Clear failed uploads</button>
      <button className="outline" onClick={() => upload(pending)}>Retry uploads</button>
    </div>}
    <p className="step-label" aria-live="polite">{status.photos.length} of 5 photos uploaded</p>
    <div className="actions"><button className="quiet" disabled={busy} onClick={onBack}>Back</button>
      <button className="action" disabled={busy || status.photos.length < 2 || !status.primaryPhotoId} onClick={onNext}>Continue</button></div>
  </>;
}
