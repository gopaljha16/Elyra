"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { photoLimit, photoTypes } from "../../../../elyra-be/src/onboarding/options";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    const compressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82),
    );
    if (!compressed || compressed.type !== "image/webp" || compressed.size >= file.size)
      return file;
    return new File([compressed], file.name.replace(/\.[^.]+$/, "") + ".webp", {
      type: "image/webp",
    });
  } finally {
    bitmap.close();
  }
}

function Preview({ api, id, file, alt }: { api?: Api; id?: string; file?: File; alt: string }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      try {
        const blob =
          file ??
          (api && id
            ? await (await api(`/photos/${id}`, { signal: controller.signal })).blob()
            : null);
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

  return (
    <div className="grid place-items-center aspect-[4/5] bg-muted overflow-hidden">
      {url ? (
        <Image
          unoptimized
          src={url}
          alt={alt}
          width={240}
          height={280}
          className="size-full object-cover"
        />
      ) : (
        <span className="px-3 text-center text-xs text-muted-foreground">
          {failed ? "Preview unavailable" : "Loading photo…"}
        </span>
      )}
    </div>
  );
}

export function PhotoStep({
  api,
  status,
  update,
  onBack,
  onNext,
}: {
  api: Api;
  status: PhotoStatus;
  update: (status: PhotoStatus) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);

  async function upload(list: Pending[], initialErrors: string[] = []) {
    if (!list.length) {
      setErrors(initialErrors);
      return;
    }
    setBusy(true);
    setErrors(initialErrors);
    setPending(list);
    const remaining: Pending[] = [];
    const failures = [...initialErrors];
    for (const item of list) {
      let path = item.uploadPath;
      try {
        if (!path) {
          const signed = await api(
            "/photos/upload-url",
            json("POST", { type: item.file.type, size: item.file.size }),
          );
          const { uploadPath } = (await signed.json()) as { uploadPath: string };
          path = uploadPath.replace(/^\/api\/onboarding/, "");
        }
        const result = await api(path, { method: "PUT", body: item.file });
        update(await result.json());
        setPending((photos) => photos.filter((photo) => photo.id !== item.id));
      } catch (error) {
        remaining.push({
          ...item,
          uploadPath:
            error instanceof Error && error.message.includes("expired") ? undefined : path,
        });
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
      if (!(photoTypes as readonly string[]).includes(file.type))
        invalid.push(`${file.name} — Choose JPEG, PNG, or WebP.`);
      else if (file.size > photoLimit)
        invalid.push(`${file.name} — Each photo must be 5 MB or smaller.`);
      else if (valid.length >= available)
        invalid.push(`${file.name} — You can upload up to 5 photos.`);
      else {
        try {
          valid.push({ file: await compressPhoto(file), id: crypto.randomUUID() });
        } catch {
          invalid.push(`${file.name} — Couldn’t read this image.`);
        }
      }
    }
    void upload(valid, invalid);
  }

  async function change(path: string, method: string) {
    setBusy(true);
    setErrors([]);
    try {
      update(await (await api(path, { method })).json());
    } catch (error) {
      setErrors([message(error)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl sm:text-5xl font-medium leading-[1.06] tracking-tight text-foreground">
          Add your photos
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          Choose 2 to 5 recent photos. Use JPEG, PNG, or WebP, up to 5 MB each.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {status.photos.map(({ id }, index) => {
          const isPrimary = status.primaryPhotoId === id;
          return (
            <article
              key={id}
              className="group overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-md"
            >
              <Preview api={api} id={id} alt={`Profile photo ${index + 1}`} />
              <div className="flex flex-wrap items-center justify-between gap-1 px-2 py-1.5 min-h-10 bg-card">
                {isPrimary ? (
                  <Badge variant="secondary" className="text-[11px] px-2 py-0.5 text-primary">
                    <Star className="size-3 fill-primary text-primary" />
                    Primary
                  </Badge>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => change(`/photos/${id}/primary`, "PATCH")}
                    className="text-xs font-semibold text-primary hover:underline px-1 py-1 cursor-pointer disabled:opacity-50"
                  >
                    Make primary
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => change(`/photos/${id}`, "DELETE")}
                  aria-label={`Remove photo ${index + 1}`}
                  className="inline-flex items-center gap-1 rounded-md p-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </article>
          );
        })}
        {pending.map(({ id, file }) => (
          <article key={id} className="overflow-hidden rounded-xl border border-border bg-card">
            <Preview file={file} alt={file.name} />
            <div className="flex items-center justify-center px-2 py-2 text-xs font-medium text-muted-foreground">
              {busy ? "Uploading…" : "Upload failed"}
            </div>
          </article>
        ))}
      </div>

      {!pending.length && status.photos.length < 5 && (
        <label
          className={`relative flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#ae8294] bg-card/50 px-4 py-6 text-sm font-semibold text-primary transition-colors hover:bg-secondary/40 focus-within:ring-3 focus-within:ring-ring/40 ${busy ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <ImagePlus className="size-5" aria-hidden="true" />
          <span>Add photos</span>
          <input
            type="file"
            accept={photoTypes.join(",")}
            multiple
            disabled={busy}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            onChange={(e) => {
              void select(Array.from(e.currentTarget.files ?? []));
              e.currentTarget.value = "";
            }}
          />
        </label>
      )}

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {!!pending.length && !busy && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPending([]);
              setErrors([]);
            }}
          >
            Clear failed uploads
          </Button>
          <Button variant="outline" size="sm" onClick={() => upload(pending)}>
            <RefreshCw className="size-3.5" />
            <span>Retry uploads</span>
          </Button>
        </div>
      )}

      <p className="text-xs font-semibold text-primary" aria-live="polite">
        {status.photos.length} of 5 photos uploaded
      </p>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" disabled={busy} onClick={onBack}>
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </Button>
        <Button
          type="button"
          disabled={busy || status.photos.length < 2 || !status.primaryPhotoId}
          onClick={onNext}
        >
          <span>Continue</span>
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
