import { useCallback, useState } from 'react'
import { HelpDialog } from './components/HelpDialog'
import { useViewportHeight } from './game/useViewportHeight'
import { Intro } from './screens/Intro'
import { Playing } from './screens/Playing'

export default function App() {
  useViewportHeight()
  const [intro, setIntro] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)

  const enter = useCallback(() => setIntro(false), [])
  const goHome = useCallback(() => setIntro(true), [])
  const openHelp = useCallback(() => setHelpOpen(true), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])

  // The game is always mounted: the intro borrows its masthead and tier labels rather than
  // animating copies of them, so they have to exist for the whole sequence. Going home is a
  // look back at the title, not a reset — half-finished chains are still there on the way in.
  return (
    <>
      <Playing active={!intro} intro={intro} onHome={goHome} onOpenHelp={openHelp} />
      {intro && <Intro onDone={enter} onOpenHelp={openHelp} />}
      <HelpDialog open={helpOpen} onClose={closeHelp} />
    </>
  )
}
