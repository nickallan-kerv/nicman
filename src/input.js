import { UP, DOWN, LEFT, RIGHT, JOYSTICK_RADIUS_RATIO, JOYSTICK_DEADZONE } from "./config.js";

export function createInput({ forceMobileControls, onTurn, env, dom }) {
  const { document, window } = env;
  const { joystick, joystickKnob } = dom;

  let joystickPointerId = null;

  let mobileGestureLockBound = false;

  const KEY_DIRS = {
    ArrowUp: UP,
    ArrowDown: DOWN,
    ArrowLeft: LEFT,
    ArrowRight: RIGHT,
    Numpad8: UP,
    Numpad2: DOWN,
    Numpad4: LEFT,
    Numpad6: RIGHT
  };

  function isMobileJoystickEnabled() {
    if (forceMobileControls) {
      return true;
    }
    return window.matchMedia("(any-pointer: coarse)").matches;
  }

  function setupMobileGestureLock() {
    if (mobileGestureLockBound || !isMobileJoystickEnabled()) {
      return;
    }

    // Prevent pull-to-refresh and page panning on touch devices while playing.
    document.addEventListener("touchmove", (event) => {
      event.preventDefault();
    }, { passive: false });

    mobileGestureLockBound = true;
  }

  function setJoystickKnobOffset(dx, dy) {
    if (!joystickKnob) {
      return;
    }
    joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  function resetJoystick() {
    joystickPointerId = null;
    setJoystickKnobOffset(0, 0);
  }

  function joystickDirection(dx, dy, maxRadius) {
    if (!Number.isFinite(maxRadius) || maxRadius <= 0) {
      return null;
    }

    const nx = dx / maxRadius;
    const ny = dy / maxRadius;
    const magnitude = Math.hypot(nx, ny);
    if (magnitude < JOYSTICK_DEADZONE) {
      return null;
    }

    if (Math.abs(nx) >= Math.abs(ny)) {
      return nx >= 0 ? RIGHT : LEFT;
    }
    return ny >= 0 ? DOWN : UP;
  }

  function handleJoystickInput(clientX, clientY) {
    if (!joystick) {
      return;
    }

    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width * JOYSTICK_RADIUS_RATIO;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > maxRadius && distance > 0) {
      const scale = maxRadius / distance;
      dx *= scale;
      dy *= scale;
    }

    setJoystickKnobOffset(dx, dy);
    const dir = joystickDirection(dx, dy, maxRadius);
    if (!dir) {
      return;
    }

    onTurn(dir);
  }

  function bind() {
      document.addEventListener("keydown", (event) => {
        const dir = KEY_DIRS[event.key] || KEY_DIRS[event.code];
        if (!dir) {
          return;
        }
        event.preventDefault();
        onTurn(dir);
      });

      if (joystick) {
        joystick.addEventListener("pointerdown", (event) => {
          if (!isMobileJoystickEnabled()) {
            return;
          }
          event.preventDefault();
          joystickPointerId = event.pointerId;
          joystick.setPointerCapture(event.pointerId);
          handleJoystickInput(event.clientX, event.clientY);
        });

        joystick.addEventListener("pointermove", (event) => {
          if (event.pointerId !== joystickPointerId) {
            return;
          }
          event.preventDefault();
          handleJoystickInput(event.clientX, event.clientY);
        });

        const finishJoystickPointer = (event) => {
          if (event.pointerId !== joystickPointerId) {
            return;
          }
          event.preventDefault();
          resetJoystick();
        };

        joystick.addEventListener("pointerup", finishJoystickPointer);
        joystick.addEventListener("pointercancel", finishJoystickPointer);
        joystick.addEventListener("lostpointercapture", resetJoystick);
      }
    }

  return { bind, setupMobileGestureLock };
}
