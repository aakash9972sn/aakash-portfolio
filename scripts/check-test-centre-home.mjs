import assert from 'node:assert/strict';

export async function checkTestCentreHome(browser, base) {
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https?:\/\//, route => new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue() : route.abort());
  const el = selector => page.locator(selector);
  const click = selector => el(selector).click();
  const panels = '#overview,#tests-catalog,#gate-pyp,#ai-generator,#neet-pyp-notice,#branch-ai-notice';
  async function only(panel) {
    await el('#' + panel).waitFor();
    assert.deepEqual(await el(panels).evaluateAll(nodes => nodes.filter(n => !n.hidden).map(n => n.id)), [panel]);
  }
  try {
    await page.goto(base);
    await only('overview');
    await el('#quick-list a').first().waitFor();
    assert.equal(await el('#quick-list a').count(), 3);
    assert.equal(await el('#study-tools .aakash-command-trigger').evaluate(node => getComputedStyle(node).position), 'static');
    await click('#study-tools .aakash-command-trigger');
    await el('.aakash-command-dialog[open]').waitFor();
    await page.keyboard.press('Escape');
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({width, height: 844});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Overflow at ' + width);
      const rect = await el('#quick-list a').first().boundingBox();
      assert.ok(rect.y + rect.height <= 844, 'First paper requires scrolling at ' + width);
    }
    await page.setViewportSize({width: 390, height: 844});
    await click('#feature-action');
    await only('gate-pyp');
    assert.equal(await el('[data-gate-mode="paper"]').getAttribute('aria-pressed'), 'true');
    await page.goBack();
    await only('overview');
    await click('#quick-list a:first-child');
    await el('#controls input').first().check();
    await page.goBack();
    await only('overview');
    await el('#gate-resume a').first().waitFor();
    assert.match(await el('#gate-resume').innerText(), /1\/65 answered/);
    await click('#activity-history summary');
    assert.equal(await el('#daily-performance-history').isVisible(), true);
    for (const [branch, label] of [['gate-ee', 'GATE EE'], ['gate-cs', 'GATE CS']]) {
      await click('#change-track');
      await click('[data-branch="' + branch + '"]');
      await only('overview');
      assert.equal(await el('#track-title').innerText(), label);
      await el('#quick-list a').first().waitFor();
      assert.ok((await el('#quick-list a').first().innerText()).includes(label));
      assert.equal(await el('#gate-resume').isVisible(), false);
      await click('[data-view="pyp"]');
      await only('gate-pyp');
      await click('[data-view="ai"]');
      await only('branch-ai-notice');
    }
    await click('#change-track');
    await click('[data-track="neet"]');
    await click('#quick-list button:first-child');
    await only('tests-catalog');
    assert.notEqual(await el('#subject-filter').inputValue(), 'all');
    await el('#search').fill('zzzzzzzz');
    await el('#home-empty').waitFor();
    await click('[data-view="pyp"]');
    await only('neet-pyp-notice');
    await click('#neet-pyp-practice');
    await only('tests-catalog');
    assert.equal(await el('#search').inputValue(), '');
    await click('[data-view="ai"]');
    await only('ai-generator');
    assert.equal(await el('#ai-gen-batch').isVisible(), false);
    await click('.ai-gen-settings summary');
    await el('#ai-gen-batch').selectOption('2');
    await click('#change-track');
    await click('[data-track="cuet-pg"]');
    await click('#feature-action');
    await only('tests-catalog');
    assert.ok(await el('#test-grid .card').count() > 0);
    await el('#search').fill('2023');
    assert.equal(await el('[data-view="pyp"]').getAttribute('aria-pressed'), 'true');
    assert.ok(await el('#test-grid .card').count() > 0);
    await page.reload();
    await only('tests-catalog');
    assert.equal(await el('#track-title').innerText(), 'CUET PG');
    await click('#change-track');
    await click('[data-track="gate"]');
    await click('[data-branch="gate"]');
    await el('#gate-resume a').first().waitFor();
    const theme = await el('html').getAttribute('data-theme');
    await click('#theme-toggle');
    assert.notEqual(await el('html').getAttribute('data-theme'), theme);
    assert.deepEqual(errors, []);
    console.log('PASS Test Centre home at four widths, all five exam tracks, navigation, saved paper, filters and theme');
  } finally {
    await page.close();
  }
}
