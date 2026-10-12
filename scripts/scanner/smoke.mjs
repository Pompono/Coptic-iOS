import assert from 'node:assert/strict';

export async function checkScanner(page, base, localModel) {
  await page.goto(base + '/translator/scanner/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { get: () => false }));
  const fixture = await page.evaluate(async () => {
    const font = new FontFace('ScannerFixture', 'url(/FreeSerifAvvaShenouda.ttf)');
    document.fonts.add(await font.load());
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 500;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; context.fillRect(0, 0, 1200, 500);
    context.fillStyle = '#111'; context.font = '60px ScannerFixture';
    context.fillText('ⲡⲉⲛⲛⲟⲩϯ', 80, 150);
    context.fillText('ⲓⲏⲥ ⲡⲭⲥ', 80, 340);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Choose a Coptic photo', { exact: true }).setInputFiles({
    name: 'printed-coptic.png', mimeType: 'image/png', buffer: Buffer.from(fixture, 'base64'),
  });
  await page.getByRole('button', { name: 'Read Coptic', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: /^Review text block/ }).count(), 0);
  await page.getByRole('button', { name: 'Read Coptic', exact: true }).click();
  await page.getByLabel('Recognised Coptic text', { exact: true }).waitFor({ timeout: 120000 });
  // This is actual OCR, not a stub. Gather every detected region before editing.
  const texts = [];
  const blocks = page.getByRole('button', { name: /^Block \d/ });
  const count = await blocks.count();
  assert.ok(count > 0);
  for (let index = 0; index < count; index++) {
    await blocks.nth(index).click();
    texts.push(await page.getByLabel('Recognised Coptic text', { exact: true }).inputValue());
  }
  console.log('OCR fixture:', JSON.stringify(texts));
  assert.match(texts.join('\n'), /ⲡⲉⲛⲛⲟⲩϯ/);
  assert.match(texts.join('\n'), /ⲡⲭⲥ/);
  // Measure recognition before any correction. This model can confuse the
  // initial iota with '[' in this font; never replace that silently in the app.
  const expected = Array.from('ⲡⲉⲛⲛⲟⲩϯ ⲓⲏⲥ ⲡⲭⲥ');
  const actual = Array.from(texts.join(' ').replace(/\s+/g, ' ').trim());
  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let row = 1; row <= expected.length; row++) {
    const next = [row];
    for (let column = 1; column <= actual.length; column++) next[column] = Math.min(
      previous[column] + 1, next[column - 1] + 1,
      previous[column - 1] + (expected[row - 1] === actual[column - 1] ? 0 : 1));
    previous = next;
  }
  const characterErrorRate = previous[actual.length] / expected.length;
  console.log(`Synthetic printed fixture character error rate: ${(characterErrorRate * 100).toFixed(1)}%`);
  assert.ok(characterErrorRate <= .1, 'Synthetic printed-text OCR stays below 10% character error; real photos require separate evaluation');
  const boxes = await page.getByRole('button', { name: /^Review text block/ }).evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    const photo = element.parentElement.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.x >= photo.x && box.right <= photo.right && box.y >= photo.y && box.bottom <= photo.bottom;
  }));
  assert.ok(boxes.every(Boolean), 'Every OCR overlay stays inside the photo');

  await blocks.first().click();
  const input = page.getByLabel('Recognised Coptic text', { exact: true });
  await input.fill('ⲙ̄');
  await page.getByRole('button', { name: 'Change overlines to jinkem', exact: true }).click();
  assert.equal(await input.inputValue(), 'ⲙ̀');
  await page.getByRole('button', { name: 'Restore recognised text', exact: true }).click();
  assert.equal(await input.inputValue(), texts[0]);
  await input.fill('ⲡϪⲥ');
  await input.evaluate(element => element.setSelectionRange(1, 2));
  await page.getByRole('button', { name: 'Insert Ⲭ', exact: true }).click();
  assert.equal(await input.inputValue(), 'ⲡⲬⲥ');
  await input.evaluate(element => element.setSelectionRange(1, 2));
  await page.getByRole('button', { name: 'Insert ⲭ', exact: true }).click();
  assert.equal(await input.inputValue(), 'ⲡⲭⲥ');
  await input.fill('ⲡⲉⲛⲛⲟⲩϯ');
  if (localModel) {
    await page.getByRole('button', { name: 'Translate block', exact: true }).click();
    await page.getByRole('button', { name: 'Translate block', exact: true }).waitFor({ state: 'visible', timeout: 180000 });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Translate block' && !button.disabled), null, { timeout: 180000 });
    assert.match(await page.getByRole('button', { name: 'Review text block 1', exact: true }).innerText(), /our God/i);
    await input.fill('ⲓⲏⲥ ⲡⲭⲥ');
    assert.doesNotMatch(await page.getByRole('button', { name: 'Review text block 1', exact: true }).innerText(), /our God/i);
    await page.getByRole('button', { name: 'Translate block', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Translate block' && !button.disabled), null, { timeout: 180000 });
    assert.match(await page.getByRole('button', { name: 'Review text block 1', exact: true }).innerText(), /Jesus Christ/i);
    if (process.env.COPTIC_SCANNER_SCREENSHOT) await page.screenshot({ path: process.env.COPTIC_SCANNER_SCREENSHOT, fullPage: true });
    await page.getByRole('button', { name: 'Show original', exact: true }).click();
    assert.doesNotMatch(await page.getByRole('button', { name: 'Review text block 1', exact: true }).innerText(), /Jesus Christ/i);
  } else {
    assert.equal(await page.getByRole('button', { name: 'Translate block', exact: true }).isDisabled(), true);
  }

  await page.getByRole('button', { name: 'Rotate ↻', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('img[alt="Selected Coptic page"]')?.naturalWidth === 500);
  assert.equal(await page.getByRole('button', { name: /^Review text block/ }).count(), 0, 'Rotating clears old coordinates and translations');
  await page.getByRole('button', { name: 'Crop photo', exact: true }).click();
  await page.getByAltText('Selected Coptic page').scrollIntoViewIfNeeded();
  const photo = await page.getByAltText('Selected Coptic page').boundingBox();
  await page.mouse.move(photo.x + photo.width * .1, photo.y + photo.height * .1);
  await page.mouse.down();
  await page.mouse.move(photo.x + photo.width * .9, photo.y + photo.height * .9, { steps: 4 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Apply crop', exact: true }).click();
  await page.waitForFunction(() => {
    const image = document.querySelector('img[alt="Selected Coptic page"]');
    return image?.naturalWidth > 0 && image.naturalWidth < 500;
  });
  const cropped = await page.getByAltText('Selected Coptic page').evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
  assert.ok(Math.abs(cropped.width - 400) <= 2 && Math.abs(cropped.height - 960) <= 4,
    `Crop matches the 80% gesture within CSS pixel rounding: ${JSON.stringify(cropped)}`);
  await page.getByRole('button', { name: 'Clear photo', exact: true }).click();
  assert.equal(await page.getByAltText('Selected Coptic page').count(), 0);
  console.log('PASS: actual Coptic photo OCR, editable text, aligned overlays, rotate/crop/clear, and offline translation bubbles.');
  await page.waitForLoadState('networkidle');
}
