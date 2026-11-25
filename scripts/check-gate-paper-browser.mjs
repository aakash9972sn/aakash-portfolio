import assert from 'node:assert/strict';

// Exercise the actual runner after MathJax and each source image has loaded.
export async function checkGatePaper(page, paper, bank) {
  await page.waitForFunction(() => !!window.MathJax?.typesetPromise);
  let equations = 0, figures = 0;
  for (const [index, question] of paper.questions.entries()) {
    const id = paper.id + ' Q' + (index + 1);
    const record = bank[index];
    const native = question.native || record.native;
    const mathCount = (native.join(' ').match(/\\[([]/g) || []).length;
    const ink = (record?.ink || []).filter(Boolean);
    await page.locator('#palette button').nth(index).evaluate(button => button.click());
    await page.waitForFunction(count =>
      document.querySelectorAll('#question-content mjx-container').length === count, mathCount,
      {timeout:8000}).catch(() => { throw new Error('Equation count differs for ' + id); });
    const result = await page.locator('#question-content').evaluate(async content => {
      const choices = [...content.querySelectorAll('#controls .opt')];
      const images = [...content.querySelectorAll('img')];
      await Promise.all(images.map(image => image.decode()));
      const error = content.querySelector('[data-mml-node="merror"], [data-mjx-error], mjx-merror, [fill="red"], [stroke="red"]');
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      let raw = '';
      while (walker.nextNode()) {
        if (!walker.currentNode.parentElement.closest('mjx-container')) raw += walker.currentNode.textContent;
      }
      return {
        error:error?.outerHTML.slice(0,350) || '',
        raw, stem:!!content.querySelector('#prompt > p'), open:!!content.querySelector('details[open]'),
        options:choices.map(el => !!(el.querySelector('.opt-text')?.textContent.trim() ||
          el.querySelector('mjx-container') || el.querySelector('img')?.naturalWidth)),
        files:images.map(image => new URL(image.src).pathname.split('/').pop())
      };
    });
    assert.ok(result.stem, id);
    assert.equal(result.error, '', id + ' ' + result.error);
    assert.doesNotMatch(result.raw,/\\[()[\]a-zA-Z]|[\x00-\x08\x0b-\x1f]/,id);
    assert.equal(result.open,false,id);
    assert.deepEqual(result.files,ink,id);
    assert.deepEqual(result.options,Array(question.type === 'NAT' ? 0 : 4).fill(true),id);
    equations += mathCount;
    figures += ink.length;
  }
  console.log('PASS',paper.id, '65 questions,',equations,'typeset expressions,',figures,'original figure crops');
}
