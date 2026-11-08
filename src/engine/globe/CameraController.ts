// ============================================================================
// ALPHAFORGE ATMOSPHERE — CAMERA CONTROLLER
// Adapted from bilawalsidhu/gods-eye-view (MIT License):
// - src/app/viewer.js (installTrackpadPinchZoom, camera flight bounds)
// ============================================================================

export interface GlobeCameraPose {
  lat: number;
  lng: number;
  altitudeMeters: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  durationSeconds?: number;
}

const PINCH_ZOOM_MULTIPLIER = 8;
const MAX_PINCH_PIXEL_DELTA = 120;

function boundedPinchDelta(delta: number): number {
  if (!Number.isFinite(delta) || delta === 0) return delta;
  return (
    Math.sign(delta) *
    Math.min(Math.abs(delta) * PINCH_ZOOM_MULTIPLIER, MAX_PINCH_PIXEL_DELTA)
  );
}

/**
 * Installs trackpad pinch-zoom relay onto a Cesium Viewer container
 * (adapted from God's Eye View `src/app/viewer.js`).
 */
export function installTrackpadPinchZoom(viewer: any): () => void {
  const Cesium = (globalThis as any).Cesium;
  const controller = viewer?.scene?.screenSpaceCameraController;
  const container: HTMLElement | undefined = viewer?.container;
  const canvas: HTMLCanvasElement | undefined = viewer?.canvas;
  if (!Cesium || !controller || !container || !canvas) {
    return () => {};
  }

  const originalZoomEventTypes = controller.zoomEventTypes;
  const zoomEventTypes = Array.isArray(originalZoomEventTypes)
    ? originalZoomEventTypes
    : originalZoomEventTypes === undefined
    ? []
    : [originalZoomEventTypes];

  const alreadyHandlesControlWheel = zoomEventTypes.some(
    (binding: any) =>
      binding?.eventType === Cesium.CameraEventType.WHEEL &&
      binding?.modifier === Cesium.KeyboardEventModifier.CTRL
  );

  if (!alreadyHandlesControlWheel) {
    controller.zoomEventTypes = [
      ...zoomEventTypes,
      {
        eventType: Cesium.CameraEventType.WHEEL,
        modifier: Cesium.KeyboardEventModifier.CTRL,
      },
    ];
  }

  const relayedEvents = new WeakSet<Event>();
  const relayPinch = (event: WheelEvent) => {
    if (
      !event.ctrlKey ||
      relayedEvents.has(event) ||
      event.deltaMode !== 0 ||
      !Number.isFinite(event.deltaY) ||
      event.deltaY === 0
    ) {
      return;
    }
    try {
      const relayed = new WheelEvent('wheel', {
        deltaX: event.deltaX,
        deltaY: boundedPinchDelta(event.deltaY),
        deltaZ: event.deltaZ,
        deltaMode: event.deltaMode,
        screenX: event.screenX,
        screenY: event.screenY,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        view: window,
      });
      relayedEvents.add(relayed);
      event.preventDefault();
      event.stopPropagation();
      canvas.dispatchEvent(relayed);
    } catch {
      // Ignore
    }
  };

  container.addEventListener('wheel', relayPinch, {
    capture: true,
    passive: false,
  });

  return () => {
    container.removeEventListener('wheel', relayPinch, true);
  };
}
