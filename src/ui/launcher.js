import { deleteSetting, getSetting, setSetting, SETTINGS } from "../core/settings.js";

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function installLauncherControls({ ids, version, addStyles, openOverlay }) {
  let detachLauncherViewport = null;
  let ignoreLauncherClickUntil = 0;

  function launcherViewportBounds(launcher) {
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const availableWidth = Math.max(0, viewportWidth - launcher.offsetWidth);
    const availableHeight = Math.max(0, viewportHeight - launcher.offsetHeight);
    const insetX = Math.min(12, availableWidth / 2);
    const insetY = Math.min(12, availableHeight / 2);
    return {
      minLeft: viewportLeft + insetX,
      maxLeft: viewportLeft + availableWidth - insetX,
      minTop: viewportTop + insetY,
      maxTop: viewportTop + availableHeight - insetY,
    };
  }

  function normalizedLauncherPosition() {
    const saved = getSetting(SETTINGS.launcherPosition, { x: 1, y: 1 });
    return {
      x: Number.isFinite(saved?.x) ? clamp(saved.x, 0, 1) : 1,
      y: Number.isFinite(saved?.y) ? clamp(saved.y, 0, 1) : 1,
    };
  }

  function placeLauncher(launcher, position = normalizedLauncherPosition()) {
    if (!launcher?.isConnected) return;
    const bounds = launcherViewportBounds(launcher);
    launcher.style.right = "auto";
    launcher.style.bottom = "auto";
    launcher.style.left = `${bounds.minLeft + position.x * (bounds.maxLeft - bounds.minLeft)}px`;
    launcher.style.top = `${bounds.minTop + position.y * (bounds.maxTop - bounds.minTop)}px`;
  }

  function persistLauncherPosition(launcher) {
    const bounds = launcherViewportBounds(launcher);
    const left = clamp(parseFloat(launcher.style.left) || bounds.minLeft, bounds.minLeft, bounds.maxLeft);
    const top = clamp(parseFloat(launcher.style.top) || bounds.minTop, bounds.minTop, bounds.maxTop);
    const width = bounds.maxLeft - bounds.minLeft;
    const height = bounds.maxTop - bounds.minTop;
    setSetting(SETTINGS.launcherPosition, {
      x: width ? (left - bounds.minLeft) / width : 0,
      y: height ? (top - bounds.minTop) / height : 0,
    });
  }

  function attachLauncherDragging(launcher) {
    let drag = null;
    launcher.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: parseFloat(launcher.style.left) || 0,
        startTop: parseFloat(launcher.style.top) || 0,
        moved: false,
      };
      launcher.classList.add("dragging");
      launcher.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    launcher.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (Math.hypot(deltaX, deltaY) > 5) drag.moved = true;
      const bounds = launcherViewportBounds(launcher);
      launcher.style.left = `${clamp(drag.startLeft + deltaX, bounds.minLeft, bounds.maxLeft)}px`;
      launcher.style.top = `${clamp(drag.startTop + deltaY, bounds.minTop, bounds.maxTop)}px`;
    });
    const finishDrag = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.moved) {
        persistLauncherPosition(launcher);
        ignoreLauncherClickUntil = performance.now() + 600;
      }
      drag = null;
      launcher.classList.remove("dragging");
      launcher.releasePointerCapture?.(event.pointerId);
    };
    launcher.addEventListener("pointerup", finishDrag);
    launcher.addEventListener("pointercancel", finishDrag);
  }

  function removeLauncher() {
    detachLauncherViewport?.();
    detachLauncherViewport = null;
    document.getElementById(ids.launcher)?.remove();
  }

  function installLauncher() {
    if (getSetting(SETTINGS.launcherHidden, false)) return;
    if (document.getElementById(ids.launcher)) return;
    addStyles(ids);
    const launcher = document.createElement("button");
    launcher.id = ids.launcher;
    launcher.type = "button";
    launcher.textContent = "Pociťátko";
    launcher.title = `Vybrat zdroj a zkontrolovat kolo; tlačítko lze přetáhnout (v${version})`;
    launcher.addEventListener("click", (event) => {
      if (performance.now() < ignoreLauncherClickUntil) {
        event.preventDefault();
        return;
      }
      openOverlay();
    });
    document.body.appendChild(launcher);
    placeLauncher(launcher);
    attachLauncherDragging(launcher);

    const sync = () => placeLauncher(launcher);
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    detachLauncherViewport = () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }

  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("Skrýt tlačítko Pociťátko", () => {
      setSetting(SETTINGS.launcherHidden, true);
      removeLauncher();
    });
    GM_registerMenuCommand("Zobrazit tlačítko Pociťátko", () => {
      setSetting(SETTINGS.launcherHidden, false);
      installLauncher();
    });
    GM_registerMenuCommand("Resetovat polohu a zobrazit Pociťátko", () => {
      deleteSetting(SETTINGS.launcherPosition);
      setSetting(SETTINGS.launcherHidden, false);
      removeLauncher();
      installLauncher();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installLauncher, { once: true });
  } else {
    installLauncher();
  }
}
