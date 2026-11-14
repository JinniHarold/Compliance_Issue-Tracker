import { flushSync } from "react-dom";
import type { NavigateFunction } from "react-router-dom";

export interface RevealOrigin {
  x: number;
  y: number;
}

function animateReveal(transition: ViewTransition, origin: RevealOrigin): void {
  void transition.ready.then(
    () => {
      const { x, y } = origin;
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );
      document.documentElement.animate(
        [
          { clipPath: `circle(0px at ${x}px ${y}px)` },
          { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
        ],
        {
          duration: 700,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    },
    () => undefined
  );
}

export function revealTransition(update: () => void, origin: RevealOrigin): void {
  if (
    typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return;
  }

  const transition = document.startViewTransition(() => {
    flushSync(update);
  });
  animateReveal(transition, origin);
}

export function navigateWithReveal(navigate: NavigateFunction, to: string, origin: RevealOrigin): void {
  revealTransition(() => navigate(to), origin);
}
