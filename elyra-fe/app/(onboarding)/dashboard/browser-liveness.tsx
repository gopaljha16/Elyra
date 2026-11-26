"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { selfieLimit } from "../../../../elyra-be/src/onboarding/options";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FaceApi = typeof import("@vladmandic/face-api");
type Step = "center" | "turn" | "hold" | "submitting";

let models: Promise<FaceApi> | undefined;

function loadModels() {
  models ??= import("@vladmandic/face-api")
    .then(async (faceapi) => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/face-model"),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri("/face-model"),
      ]);
      return faceapi;
    })
    .catch((error) => {
      models = undefined;
      throw error;
    });
  return models;
}

function measureBrightness(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return 128;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let light = 0;
  for (let i = 0; i < data.length; i += 4)
    light += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  return light / (data.length / 4);
}

async function captureFrame(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn’t capture your camera frame.");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.92, 0.84, 0.72, 0.58]) {
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (jpeg && jpeg.size < selfieLimit) return jpeg;
  }
  throw new Error("Couldn’t compress the camera frame. Try again.");
}

async function openCameraStream(deviceId?: string) {
  const videoConstraints: MediaTrackConstraints = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
    : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } };
  try {
    return await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "OverconstrainedError" || error.name === "NotFoundError")
    ) {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    throw error;
  }
}

function yawRatio(points: { x: number; y: number }[]) {
  // Tiny 68-point landmarks: 36..41 left eye, 42..47 right eye, 30 nose tip.
  const leftEyeX = (points[36].x + points[39].x) / 2;
  const rightEyeX = (points[42].x + points[45].x) / 2;
  const eyeDistance = Math.abs(rightEyeX - leftEyeX);
  if (eyeDistance < 8) return 0;
  const eyeMidX = (leftEyeX + rightEyeX) / 2;
  return Math.abs(points[30].x - eyeMidX) / eyeDistance;
}

const stepLabel: Record<Step, string> = {
  center: "Step 1 of 3 — Center your face in the oval",
  turn: "Step 2 of 3 — Turn your head slightly left or right",
  hold: "Step 3 of 3 — Look straight at the camera",
  submitting: "Verifying your live capture…",
};

export function BrowserLiveness({
  onComplete,
  onCancel,
}: {
  onComplete: (capture: Blob) => Promise<void>;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [generation, setGeneration] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [step, setStep] = useState<Step>("center");
  const [hint, setHint] = useState("Starting your camera…");
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const node = videoRef.current;
    const sample = document.createElement("canvas");
    sample.width = sample.height = 40;

    let currentStep: Step = "center";
    let stepStableCount = 0;

    async function start() {
      if (!node) return;
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Camera access requires HTTPS or localhost.");
        stream = await openCameraStream(selectedDeviceId || undefined);
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        node.srcObject = stream;
        await node.play();

        if (navigator.mediaDevices?.enumerateDevices) {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
          if (!stopped) {
            setDevices(videoInputs);
            const activeTrack = stream.getVideoTracks()[0];
            const activeId = activeTrack?.getSettings()?.deviceId;
            if (activeId && !selectedDeviceId) setSelectedDeviceId(activeId);
          }
        }

        const faceapi = await loadModels();
        if (stopped) return;
        setHint("Position your face inside the oval");

        const inspect = async () => {
          if (stopped || !node.videoWidth || currentStep === "submitting") return;
          const brightness = measureBrightness(node, sample);
          const detections = await faceapi
            .detectAllFaces(node, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.45 }))
            .withFaceLandmarks(true);
          if (stopped) return;

          if (brightness < 42) {
            stepStableCount = 0;
            setHint("Move to brighter lighting");
          } else if (brightness > 238) {
            stepStableCount = 0;
            setHint("Avoid direct glare behind you");
          } else if (detections.length === 0) {
            stepStableCount = 0;
            setHint("Show your face clearly in the oval");
          } else if (detections.length > 1) {
            stepStableCount = 0;
            setHint("Make sure only you are in frame");
          } else {
            const { detection, landmarks } = detections[0];
            const { box } = detection;
            const centered =
              Math.abs(box.x + box.width / 2 - node.videoWidth / 2) < node.videoWidth * 0.25 &&
              Math.abs(box.y + box.height / 2 - node.videoHeight / 2) < node.videoHeight * 0.28;

            if (box.width < node.videoWidth * 0.14) {
              stepStableCount = 0;
              setHint("Move a little closer");
            } else if (!centered) {
              stepStableCount = 0;
              setHint("Center your face in the oval");
            } else {
              const yaw = yawRatio(landmarks.positions);
              if (currentStep === "center") {
                if (yaw <= 0.14) {
                  stepStableCount += 1;
                  setHint("Hold still…");
                  if (stepStableCount >= 3) {
                    currentStep = "turn";
                    stepStableCount = 0;
                    setStep("turn");
                    setHint("Slowly turn your head slightly left or right");
                  }
                } else {
                  stepStableCount = 0;
                  setHint("Look straight at the camera");
                }
              } else if (currentStep === "turn") {
                if (yaw >= 0.14) {
                  stepStableCount += 1;
                  setHint("Great, now look straight back at the camera");
                  if (stepStableCount >= 2) {
                    currentStep = "hold";
                    stepStableCount = 0;
                    setStep("hold");
                    setHint("Look straight and hold still…");
                  }
                } else {
                  setHint("Turn your head slightly left or right");
                }
              } else if (currentStep === "hold") {
                if (yaw <= 0.12) {
                  stepStableCount += 1;
                  setHint("Capturing…");
                  if (stepStableCount >= 2) {
                    currentStep = "submitting";
                    setStep("submitting");
                    const blob = await captureFrame(node);
                    await onCompleteRef.current(blob);
                    return;
                  }
                } else {
                  stepStableCount = 0;
                  setHint("Look straight at the camera");
                }
              }
            }
          }
          timer = setTimeout(inspect, 160);
        };

        timer = setTimeout(inspect, 250);
      } catch (error) {
        if (!stopped) {
          setCameraError(true);
          setHint(
            error instanceof Error && error.message.includes("HTTPS")
              ? error.message
              : "Allow camera access in your browser to continue.",
          );
        }
      }
    }

    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (node) node.srcObject = null;
    };
  }, [generation, selectedDeviceId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
        <span>{stepLabel[step]}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={step === "submitting"}>
          Cancel
        </Button>
      </div>

      {devices.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Camera:</span>
          <Select
            value={selectedDeviceId}
            onValueChange={(value) => {
              setSelectedDeviceId(value);
              setStep("center");
              setCameraError(false);
              setHint("Switching camera…");
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Choose camera" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device, idx) => (
                <SelectItem key={device.deviceId} value={device.deviceId} className="text-xs">
                  {device.label || `Camera ${idx + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-border bg-foreground/95 aspect-[4/3]">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full -scale-x-100 object-cover"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "h-[68%] w-[46%] rounded-full border-2 transition-colors duration-200",
              step === "hold" || step === "submitting"
                ? "border-primary shadow-[0_0_0_9999px_rgba(26,22,21,0.42)]"
                : "border-white/75 shadow-[0_0_0_9999px_rgba(26,22,21,0.48)]",
            )}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/90 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
            {step === "submitting" && <Loader2 className="size-3.5 animate-spin text-primary" />}
            <span>{hint}</span>
          </div>
        </div>
      </div>

      {cameraError && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCameraError(false);
              setStep("center");
              setHint("Starting your camera…");
              setGeneration((n) => n + 1);
            }}
          >
            <RefreshCw className="size-3.5" />
            <span>Retry camera</span>
          </Button>
        </div>
      )}
    </div>
  );
}
