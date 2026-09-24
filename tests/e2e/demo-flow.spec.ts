import { expect, test } from '@playwright/test'

/**
 * PRD §15 demo flow through the Console UI, against a running runtime.
 * The demo harness endpoint emits through the test observer plugin, so the
 * chain behaves exactly like a real observer (and stops once disabled).
 *
 * Preconditions: a freshly started runtime (empty stores) and the Console.
 * See README "Run the full stack locally"; restart the runtime between runs
 * when it uses the in-memory store driver.
 */
test.describe('phase 1 demo flow', () => {
  test('plugin -> observation -> memory -> revision -> timeline -> disable', async ({ page, request }) => {
    const baseline = await request.get('/api/timeline?kind=observation')
    const baselineObservations = ((await baseline.json()) as { items: unknown[] }).items.length

    // 1. Plugins page shows the observer and enables it (tolerates auto-enable)
    await page.goto('/plugins')
    const pluginRow = page.getByRole('row').filter({ hasText: 'Test Observer' })
    await expect(pluginRow).toBeVisible()
    // wait for the async list to render its action button before branching
    await expect(pluginRow.getByRole('button', { name: /^(enable|disable)$/i })).toBeVisible()
    const enableButton = pluginRow.getByRole('button', { name: /^enable$/i })
    if ((await enableButton.count()) > 0) {
      await enableButton.click()
    }
    await expect(pluginRow.getByText('enabled', { exact: true })).toBeVisible()

    // 2. Observer delivers a new opportunity (10:00)
    const firstEmit = await request.post('/api/demo/observations', {
      data: { payload: { customer: 'Acme', stage: 'lead' } },
    })
    expect(firstEmit.status()).toBe(201)

    // 3. Timeline shows the observation and the resulting memory change
    await page.goto('/timeline')
    await expect(page.getByText('test.observation').first()).toBeVisible()
    const createdChange = page.getByText(/opportunity memory created/i).first()
    await expect(createdChange).toBeVisible()
    await createdChange.click()
    await expect(page.getByText('Open Memory Detail')).toBeVisible()

    // 4. Stage change (10:05) -> memory updated with a readable diff
    const secondEmit = await request.post('/api/demo/observations', {
      data: { payload: { customer: 'Acme', stage: 'negotiation' } },
    })
    expect(secondEmit.status()).toBe(201)

    await page.reload()
    const updatedChange = page.getByText(/opportunity memory updated/i).first()
    await expect(updatedChange).toBeVisible()
    await updatedChange.click()
    await expect(page.getByText('stage changed from lead to negotiation').first()).toBeVisible()
    await expect(page.getByText('- lead').first()).toBeVisible()
    await expect(page.getByText('+ negotiation').first()).toBeVisible()

    // 5. Memory viewer: current memory + revision history + diff
    await page.goto('/memory')
    await page.getByRole('link', { name: 'opportunity' }).first().click()
    await expect(page.getByText('Current Content')).toBeVisible()
    await expect(page.getByText('Source Evidence')).toBeVisible()
    await expect(page.getByText('Revision History')).toBeVisible()

    await page.getByRole('button', { name: /Revision #2/ }).first().click()
    await expect(page.getByText('stage changed from lead to negotiation').first()).toBeVisible()
    await expect(page.getByText('- lead').first()).toBeVisible()
    await expect(page.getByText('+ negotiation').first()).toBeVisible()

    await page.getByRole('button', { name: /Revision #1/ }).first().click()
    await expect(page.getByText('opportunity observed').first()).toBeVisible()

    // 6. Disable the plugin: no new observations are produced
    await page.goto('/plugins')
    const rowAfter = page.getByRole('row').filter({ hasText: 'Test Observer' })
    const disableButton = rowAfter.getByRole('button', { name: /^disable$/i })
    await expect(disableButton).toBeVisible()
    await disableButton.click()
    await expect(rowAfter.getByText('disabled', { exact: true })).toBeVisible()

    const blocked = await request.post('/api/demo/observations', {
      data: { payload: { customer: 'Acme', stage: 'won' } },
    })
    expect(blocked.status()).toBeGreaterThanOrEqual(400)

    // the timeline gained exactly the two observations produced by this flow
    const observationsAfter = await request.get('/api/timeline?kind=observation')
    expect(observationsAfter.ok()).toBeTruthy()
    const body = (await observationsAfter.json()) as { items: unknown[] }
    expect(body.items).toHaveLength(baselineObservations + 2)
  })
})
