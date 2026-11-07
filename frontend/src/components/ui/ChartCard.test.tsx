import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChartCard } from './ChartCard'

function card() {
  render(
    <ChartCard title="Spending by month" description="What the group spent" columns={['Month', 'Amount']} rows={[['Nov 26', '25.50'], ['Dec 26', '10.00']]}>
      <svg data-testid="picture" />
    </ChartCard>,
  )
}

describe('ChartCard', () => {
  it('gives the same figures as a table to people who cannot see the picture', () => {
    card()

    const table = screen.getByRole('table', { name: 'Spending by month' })

    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(table).toHaveTextContent('Nov 26')
    expect(table).toHaveTextContent('10.00')
  })

  it('hides the picture from screen readers, which have the table instead', () => {
    card()

    expect(screen.getByTestId('picture').closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.getByRole('table').closest('[aria-hidden="true"]')).toBeNull()
  })

  it('hides the table with a box around it, never with a class on the table: a hidden <table> still shows its caption', () => {
    card()

    const table = screen.getByRole('table')

    expect(table).not.toHaveClass('sr-only')
    expect(table.parentElement).toHaveClass('sr-only')
    // the caption must be inside the hidden box too
    expect(table.parentElement).toContainElement(table.querySelector('caption'))
  })

  it('shows the title once, as a heading', () => {
    card()

    expect(screen.getAllByRole('heading', { name: 'Spending by month' })).toHaveLength(1)
  })
})
