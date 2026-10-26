import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { renderWithApp } from '@/test/render'
import { HowItWorksDrawer } from './HowItWorksDrawer'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        How it works
      </button>
      <HowItWorksDrawer open={open} onOpenChange={setOpen} />
    </>
  )
}

describe('HowItWorksDrawer', () => {
  it('explains the period, graph rule, and demo mode, then closes with Escape', async () => {
    const user = userEvent.setup()
    const { client } = renderWithApp(<Harness />)
    const trigger = screen.getByRole('button', { name: 'How it works' })
    await user.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: 'How KingSight works' })
    expect(dialog).toHaveTextContent('May 2014 to May 2015')
    expect(dialog).toHaveTextContent('You’re viewing demo data')
    expect(dialog).toHaveTextContent('A model estimate is not a professional appraisal.')

    const metadata = await client.getMetadata()
    expect(await screen.findByText(metadata.graph.rule_label)).toBeInTheDocument()
    expect(screen.queryByText('How the models were evaluated')).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
