import { useEffect } from 'react'

/**
 * Publishes the *visually* available height as `--app-height`.
 *
 * On iOS Safari the on-screen keyboard does not shrink the layout viewport, so `100dvh`
 * still reports the full screen and the app quietly extends underneath the keyboard —
 * taking the seed and the section header with it. `visualViewport` is the only thing that
 * reports what the player can actually see, so everything sized against the screen reads
 * this variable rather than `vh`.
 */
export function useViewportHeight(): void {
  useEffect(() => {
    const vv = window.visualViewport

    const apply = () => {
      const height = vv?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`)
      // iOS scrolls the layout viewport to reveal a focused field. Nothing here scrolls,
      // so that only ever pushes the header off the top — put it back.
      if (window.scrollY !== 0) window.scrollTo(0, 0)
    }

    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)

    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
    }
  }, [])
}
