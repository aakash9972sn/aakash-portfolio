import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export async function checkBatchPapers(page, base) {
  const dir = new URL("../test-centre/gate-digitized/batch/", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", dir), "utf8"),
  );
  let count = 0;
  for (const id of Object.keys(manifest)) {
    const bank = JSON.parse(await readFile(new URL(id + ".json", dir), "utf8"));
    await page.goto(base + "gate-test.html?mode=paper&set=" + id, {
      waitUntil: "domcontentloaded",
    });
    await page.locator("#workbench").waitFor();
    for (const [index, record] of Object.entries(bank)) {
      await page
        .locator("#palette button")
        .nth(Number(index))
        .evaluate((b) => b.click());
      const mathCount = record.native.join(" ").match(/\\[([]/g)?.length || 0;
      await page.waitForFunction(
        (n) =>
          document.querySelectorAll("#question-content mjx-container")
            .length === n,
        mathCount,
      );
      assert.equal(
        await page
          .locator(
            '#question-content [data-mml-node="merror"], #question-content mjx-merror',
          )
          .count(),
        0,
      );
      assert.equal(
        await page.locator("#prompt > p").count(),
        record.printedStem ? 0 : 1,
      );
      assert.equal(
        await page.locator("#controls .opt").count(),
        record.native.length - 1,
      );
      if (record.figureBox) {
        const img = page.locator("#prompt > div img");
        await img.evaluate((el) => el.decode());
        assert.deepEqual(
          await img.evaluate((el) => [el.naturalWidth, el.naturalHeight]),
          [
            record.figureBox[2] - record.figureBox[0],
            record.figureBox[3] - record.figureBox[1],
          ],
        );
      }
      if (record.optionBoxes) {
        await page.waitForFunction(() =>
          [...document.querySelectorAll("#controls .opt")].every(
            (el) => el.querySelector("img")?.naturalWidth,
          ),
        );
      }
      if (!record.optionBoxes && !mathCount) {
        assert.deepEqual(
          await page.locator("#controls .opt-text").allTextContents(),
          record.native.slice(1),
        );
      }
      count++;
    }
  }
  console.log(
    "PASS",
    count,
    "batch questions, math, answer controls and original crops",
  );
}
