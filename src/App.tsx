import { useCallback, useRef, useState } from 'react'
import { HelpDialog } from './components/HelpDialog'
import { helpSeen, markHelpSeen } from './game/storage'
import { useViewportHeight } from './game/useViewportHeight'
import { Intro } from './screens/Intro'
import { Playing } from './screens/Playing'

export default function App() {
  useViewportHeight()
  const [intro, setIntro] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)
  /**
   * Have the rules been shown yet — ever, or in this session?
   *
   * A first Play opens them on the way through. The demo is the tutorial, and a tutorial
   * nobody taps is not one, so the first player is shown it rather than offered it — at the
   * moment they have said they want to play. Every Play after that goes straight to the game,
   * with "How to play" where it always was.
   *
   * Seeded from storage and then held here, so opening the dialog from the title button counts
   * too: read it there and Play has nothing left to teach.
   */
  const [taught, setTaught] = useState(helpSeen)
  /**
   * Owned up here because the intro needs it too. A phone only raises its keyboard for a
   * focus() made inside the tap that asked for it, and the intro's Play tap is the last
   * gesture before the game appears — by the time the handover animation ends, the
   * activation it granted is spent and focus() is silently ignored.
   */
  const inputRef = useRef<HTMLInputElement>(null)

  const enter = useCallback(() => setIntro(false), [])
  const goHome = useCallback(() => setIntro(true), [])
  const openHelp = useCallback(() => setHelpOpen(true), [])
  const closeHelp = useCallback(() => {
    setHelpOpen(false)
    setTaught(true)
    markHelpSeen()
    /* Dismissing the rules is a tap, and when the game is already behind them it is the last
       gesture before the player is looking at it — so the field takes focus here. The Play
       tap that would normally do it spent its activation opening this dialog. Skipped while
       the title is still up: nothing there wants a keyboard. */
    if (!intro) inputRef.current?.focus()
  }, [intro])

  // The game is always mounted: the intro borrows its masthead and tier labels rather than
  // animating copies of them, so they have to exist for the whole sequence. Going home is a
  // look back at the title, not a reset — half-finished chains are still there on the way in.
  return (
    <>
      <Playing
        // Not while the rules are up: the game is behind them, and a field that grabs focus
        // there raises a keyboard into the dialog's lap. closeHelp hands focus back.
        active={!intro && !helpOpen}
        intro={intro}
        inputRef={inputRef}
        onHome={goHome}
        onOpenHelp={openHelp}
      />
      {intro && (
        <Intro
          onDone={enter}
          inputRef={inputRef}
          onOpenHelp={openHelp}
          teachOnPlay={!taught}
        />
      )}
      <HelpDialog open={helpOpen} onClose={closeHelp} />
    </>
  )
}
