"use client";

import { useEffect, useRef, useState } from "react";
import { selfieLimit } from "../../../../elyra-be/src/onboarding/options";

type FaceApi = typeof import("@vladmandic/face-api");
let detector: Promise<FaceApi> | undefined;

function loadDetector() {
  detector ??= import("@vladmandic/face-api").then(async (faceapi) => {
    await faceapi.nets.tinyFaceDetector.loadFromUri("/face-model");
    return faceapi;
  }).catch((error) => {
    detector = undefined;
    throw error;
  });
  return detector;
}

function lighting(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return 128;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let light = 0;
  for (let i = 0; i < data.length; i += 4) light += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  return light / (data.length / 4);
}

async function captureFrame(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn’t capture the selfie.");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.9, 0.8, 0.7, 0.55]) {
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (jpeg && jpeg.size < selfieLimit) return jpeg;
  }
  throw new Error("Couldn’t compress the selfie. Try again.");
}

export function Camera({ onCapture }: { onCapture: (photo: Blob) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [generation, setGeneration] = useState(0);
  const [guidance, setGuidance] = useState("Starting your camera…");
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const node = video.current;
    const sample = document.createElement("canvas");
    sample.width = sample.height = 40;
    async function start() {
      if (!node) return;
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access requires HTTPS or localhost.");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
        if (stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
        node.srcObject = stream;
        await node.play();
        if (stopped) return;
        setGuidance("Loading face detection…");
        const faceapi = await loadDetector();
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
        const failure = () => {
          if (stopped) return;
          setReady(false);
          setGuidance("Face detection stopped. Restart the camera to try again.");
          setCameraError(true);
          stream?.getTracks().forEach((track) => track.stop());
        };
        async function check() {
          if (stopped || !node) return;
          try {
            if (node.readyState >= 2 && node.videoWidth) {
              const light = lighting(node, sample);
              const faces = await faceapi.detectAllFaces(node, options);
              if (stopped) return;
              const faceWidth = faces[0]?.box.width ?? 0;
              const tip = light < 48 ? "Move somewhere brighter." : light > 218 ? "Move away from bright light."
                : faces.length > 1 ? "Only one person should be in the frame."
                : faces.length === 0 ? "Center your face in the frame."
                : faceWidth < node.videoWidth * 0.17 ? "Move a little closer." : "Face detected. You’re ready to capture.";
              setReady(light >= 48 && light <= 218 && faces.length === 1 && faceWidth >= node.videoWidth * 0.17);
              setGuidance(tip);
            } else setReady(false);
            timer = setTimeout(check, 220);
          } catch { failure(); }
        }
        for (const track of stream.getVideoTracks()) track.addEventListener("ended", failure, { once: true });
        void check();
      } catch (error) {
        if (stopped) return;
        stream?.getTracks().forEach((track) => track.stop());
        setCameraError(true);
        setReady(false);
        setGuidance(error instanceof Error && error.name === "NotAllowedError"
          ? "Allow camera access in your browser and try again."
          : error instanceof Error && error.message.includes("HTTPS") ? error.message
          : "Couldn’t start the camera or face detection. Try again.");
      }
    }
    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (node) node.srcObject = null;
    };
  }, [generation]);

  async function capture() {
    if (!video.current || !ready) return;
    setCapturing(true);
    try { onCapture(await captureFrame(video.current)); }
    catch (error) { setGuidance(error instanceof Error ? error.message : "Couldn’t capture the selfie."); }
    finally { setCapturing(false); }
  }

  return <>
    <div className="viewfinder">
      <video ref={video} muted playsInline aria-label="Live camera preview" />
      <div className={`face-outline${ready ? " ready" : ""}`} aria-hidden="true" />
    </div>
    <p className={ready ? "camera-ready" : ""} role="status">{guidance}</p>
    <div className="actions">
      {cameraError ? <button className="outline" onClick={() => {
        setCameraError(false); setGuidance("Starting your camera…"); setGeneration((n) => n + 1);
      }}>Restart camera</button> : <button className="action" disabled={!ready || capturing} onClick={capture}>Capture selfie</button>}
    </div>
  </>;
}
