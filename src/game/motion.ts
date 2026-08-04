/**
 * How long motion is allowed to take, as a multiplier.
 *
 * GSAP writes styles directly, so the stylesheet's reduced-motion rule — which only reaches
 * CSS animations and transitions — cannot touch it. Every GSAP duration and stagger in the
 * app is scaled by this instead, and 0 collapses the whole sequence into its end state
 * while still running the callbacks the screens hand over on.
 *
 * Read per animation rather than once at import, so the setting takes effect on the next
 * thing that moves rather than needing a reload.
 */
export const motion = (): number =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1
