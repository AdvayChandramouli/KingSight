import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LandingPage } from '@/pages/LandingPage'
import { renderWithApp } from '@/test/render'

describe('LandingPage', () => {
  it('has one h1, the explorer CTA, and the historical label above the fold', () => {
    renderWithApp(<LandingPage />)
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Every home has a neighborhood story.')

    const hero = h1s[0]!.closest('section')!
    expect(within(hero).getByRole('link', { name: /explore properties/i })).toHaveAttribute('href', '/explore')
    expect(within(hero).getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how-it-works')
    expect(within(hero).getByText('Historical estimates · 2014–2015 sales')).toBeInTheDocument()
    expect(document.getElementById('how-it-works')).not.toBeNull()
  })

  it('shows the preview estimate for KC-1042 and links to it', async () => {
    renderWithApp(<LandingPage />)
    expect(screen.getByRole('link', { name: /open this property/i })).toHaveAttribute(
      'href',
      '/explore?property=KC-1042',
    )
    expect(await screen.findByRole('heading', { name: 'Property KC-1042', level: 3 }, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Estimated historical value')).toBeInTheDocument()
    expect(await screen.findAllByText(/^\$[\d,]+$/, {}, { timeout: 3000 })).not.toHaveLength(0)
    expect(screen.getByText('Illustrative preview · demo data')).toBeInTheDocument()
  })

  it('labels contribution direction with text and signs', async () => {
    renderWithApp(<LandingPage />)
    const panel = (await screen.findAllByText(/^(raised|lowered)$/, {}, { timeout: 3000 }))[0]!
    const row = panel.closest('li')!
    expect(within(row).getByText(/^[+−]/)).toBeInTheDocument()
  })

  it('credits the dataset and states the appraisal disclaimer', () => {
    renderWithApp(<LandingPage />)
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: /kaggle/i })).toHaveAttribute(
      'href',
      'https://www.kaggle.com/datasets/harlfoxem/housesalesprediction',
    )
    expect(within(footer).getByText('Estimates are not professional appraisals.')).toBeInTheDocument()
  })
})
