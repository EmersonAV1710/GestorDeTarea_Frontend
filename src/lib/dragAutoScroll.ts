export function createDragAutoScroll(viewport: Window) {
  let running = false;
  let frame: number | null = null;
  let pointerY: number | null = null;
  let previousTime: number | null = null;

  function track(event: Event) {
    const y = (event as DragEvent).clientY;
    pointerY = Number.isFinite(y) ? y : null;
  }

  function tick(time: number) {
    if (!running) return;
    const elapsed = previousTime === null ? 16 : Math.min(Math.max(time - previousTime, 0), 32);
    previousTime = time;
    const edge = Math.min(100, viewport.innerHeight / 4);
    let speed = 0;
    if (pointerY !== null && pointerY >= 0 && pointerY <= viewport.innerHeight && edge > 0) {
      if (pointerY < edge) speed = -720 * (1 - pointerY / edge);
      else if (pointerY > viewport.innerHeight - edge) speed = 720 * (1 - (viewport.innerHeight - pointerY) / edge);
    }
    if (speed) viewport.scrollBy({ top: speed * elapsed / 1000, left: 0, behavior: "instant" });
    frame = viewport.requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    pointerY = null;
    previousTime = null;
    if (frame !== null) viewport.cancelAnimationFrame(frame);
    frame = null;
    viewport.removeEventListener("dragover", track);
    viewport.removeEventListener("dragend", stop);
    viewport.removeEventListener("drop", stop);
    viewport.removeEventListener("blur", stop);
  }

  function start(y: number) {
    stop();
    running = true;
    pointerY = Number.isFinite(y) ? y : null;
    viewport.addEventListener("dragover", track);
    viewport.addEventListener("dragend", stop);
    viewport.addEventListener("drop", stop);
    viewport.addEventListener("blur", stop);
    frame = viewport.requestAnimationFrame(tick);
  }

  return { start, stop };
}
