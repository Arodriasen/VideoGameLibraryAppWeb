import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { readBarcode, type BarcodeResult } from '../../infrastructure/barcodeReader';

/** Capacidades de la cámara que aún no están en los tipos de TypeScript. */
interface CameraCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  zoom?: { min: number; max: number };
}

export type ScannerStatus = 'starting' | 'scanning' | 'denied' | 'unavailable';

const FRAME_PAUSE_MS = 80;

function statusFromError(e: unknown): ScannerStatus {
  return e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable';
}

/**
 * Enciende la cámara trasera y lee códigos hasta dar con uno. Solo analiza la franja central, que es
 * la que marca el visor: va mucho más rápido que la imagen entera.
 */
export function useBarcodeScanner(
  videoRef: RefObject<HTMLVideoElement | null>,
  onDetected: (result: BarcodeResult) => void,
) {
  const [status, setStatus] = useState<ScannerStatus>('starting');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomAvailable, setZoomAvailable] = useState(false);
  const [zoomOn, setZoomOn] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const onDetectedRef = useRef(onDetected);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    const canvas = document.createElement('canvas');

    async function scanLoop(video: HTMLVideoElement) {
      const context = canvas.getContext('2d', { willReadFrequently: true });

      while (!stopped && context) {
        const { videoWidth: width, videoHeight: height } = video;
        if (width > 0 && height > 0) {
          const stripHeight = Math.round(height * 0.45);
          canvas.width = width;
          canvas.height = stripHeight;
          context.drawImage(video, 0, (height - stripHeight) / 2, width, stripHeight, 0, 0, width, stripHeight);

          const result = await readBarcode(context.getImageData(0, 0, width, stripHeight));
          if (stopped) return;
          if (result) {
            onDetectedRef.current(result);
            return;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, FRAME_PAUSE_MS));
      }
    }

    async function start() {
      const video = videoRef.current;
      if (!video) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const [track] = stream.getVideoTracks();
        trackRef.current = track;
        const capabilities = (track.getCapabilities?.() ?? {}) as CameraCapabilities;
        setTorchAvailable(capabilities.torch === true);
        setZoomAvailable((capabilities.zoom?.max ?? 1) >= 2);

        video.srcObject = stream;
        await video.play();
        setStatus('scanning');
        await scanLoop(video);
      } catch (e) {
        if (!stopped) setStatus(statusFromError(e));
      }
    }

    void start();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
      trackRef.current = null;
    };
  }, [videoRef]);

  const applyCameraSetting = useCallback(async (setting: Record<string, unknown>) => {
    await trackRef.current?.applyConstraints({ advanced: [setting as MediaTrackConstraintSet] });
  }, []);

  const toggleTorch = useCallback(() => {
    const next = !torchOn;
    applyCameraSetting({ torch: next }).then(
      () => setTorchOn(next),
      () => setTorchAvailable(false),
    );
  }, [applyCameraSetting, torchOn]);

  const toggleZoom = useCallback(() => {
    const next = !zoomOn;
    applyCameraSetting({ zoom: next ? 2 : 1 }).then(
      () => setZoomOn(next),
      () => setZoomAvailable(false),
    );
  }, [applyCameraSetting, zoomOn]);

  return { status, torchAvailable, torchOn, toggleTorch, zoomAvailable, zoomOn, toggleZoom };
}
