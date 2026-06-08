#!/usr/bin/env node
/**
 * LP Capture Script
 *
 * LPのフルページスクリーンショット + セクション分割撮影 + DOMテキスト抽出
 *
 * Usage:
 *   node capture-lp.js <URL> --output <dir> [--width 375]
 *
 * Output:
 *   <dir>/images/full-page.png
 *   <dir>/images/section-01-hero.png
 *   <dir>/images/section-02-xxx.png
 *   <dir>/sections.json   (セクション別テキスト+メタデータ)
 *   <dir>/metadata.json   (URL, 取得日時等)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function captureLp(url, outputDir, viewportWidth = 375) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const imagesDir = path.join(outputDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  console.log(`[LP Capture] URL: ${url}`);
  console.log(`[LP Capture] Output: ${outputDir}`);
  console.log(`[LP Capture] Viewport: ${viewportWidth}px`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: 800 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    // 1. ページロード（LPは広告トラッカーが多いのでdomcontentloadedで進める）
    console.log('[LP Capture] Loading page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    // 2. ポップアップ・チャットウィジェット除去
    console.log('[LP Capture] Removing overlays...');
    await removeOverlays(page);

    // 3. スクロールで遅延読み込み
    console.log('[LP Capture] Scrolling for lazy-load...');
    await autoScroll(page);
    await page.waitForTimeout(2000);

    // 再度オーバーレイ除去（スクロール後に出現するもの）
    await removeOverlays(page);

    // 4. フルページスクリーンショット
    console.log('[LP Capture] Taking full-page screenshot...');
    const fullPagePath = path.join(imagesDir, 'full-page.png');
    await page.screenshot({ path: fullPagePath, fullPage: true });
    console.log(`[LP Capture] Full page saved: ${fullPagePath}`);

    // 5. セクション検出
    console.log('[LP Capture] Detecting sections...');
    const sections = await detectSections(page);
    console.log(`[LP Capture] Found ${sections.length} sections`);

    // 6. セクション別スクリーンショット + テキスト抽出
    const results = [];
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const idx = String(i + 1).padStart(2, '0');
      const sectionName = section.name || `section-${idx}`;
      const fileName = `section-${idx}-${sectionName}.png`;
      const filePath = path.join(imagesDir, fileName);

      try {
        // セクション要素のスクリーンショット
        const element = await page.$(section.selector);
        if (element) {
          const box = await element.boundingBox();
          if (box && box.height > 20) {
            await element.screenshot({ path: filePath });
            console.log(`[LP Capture] Section ${idx}: ${sectionName} (${Math.round(box.height)}px)`);
          }
        }

        // DOMテキスト抽出
        const textData = await extractSectionText(page, section.selector);

        results.push({
          index: i + 1,
          name: sectionName,
          imagePath: fileName,
          selector: section.selector,
          bgColor: section.bgColor,
          height: section.height,
          text: textData,
        });
      } catch (err) {
        console.warn(`[LP Capture] Section ${idx} error: ${err.message}`);
        results.push({
          index: i + 1,
          name: sectionName,
          error: err.message,
        });
      }
    }

    // 7. JSON保存
    const sectionsPath = path.join(outputDir, 'sections.json');
    fs.writeFileSync(sectionsPath, JSON.stringify(results, null, 2));

    const metadata = {
      url,
      capturedAt: new Date().toISOString(),
      viewportWidth,
      totalSections: results.length,
      pageTitle: await page.title(),
    };
    const metadataPath = path.join(outputDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`\n[LP Capture] Done! ${results.length} sections captured.`);
    return { metadata, sections: results };

  } finally {
    await browser.close();
  }
}

/**
 * ポップアップ・チャットウィジェット・Cookie同意バナー等を除去
 */
async function removeOverlays(page) {
  await page.evaluate(() => {
    // 固定位置の要素を除去（チャット、Cookie、ポップアップ）
    const selectors = [
      '[class*="chat"]', '[id*="chat"]',
      '[class*="cookie"]', '[id*="cookie"]',
      '[class*="consent"]', '[id*="consent"]',
      '[class*="popup"]', '[id*="popup"]',
      '[class*="modal"]', '[id*="modal"]',
      '[class*="overlay"]',
      '[class*="floating"]', '[class*="float"]',
      '[class*="sticky-bar"]',
      'iframe[src*="chat"]', 'iframe[src*="widget"]',
    ];

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          el.remove();
        }
      });
    });

    // position:fixed の汎用除去（ナビバー以外）
    document.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' && el.offsetHeight < 300) {
        // 小さい固定要素（バナー、ボタン等）を除去
        el.remove();
      }
    });
  });
}

/**
 * ページ最下部までスクロール（遅延読み込み対応）
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight + 1000) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 150);
    });
  });
}

/**
 * セクション検出（HTML構造 + 背景色変化ベース）
 */
async function detectSections(page) {
  return await page.evaluate(() => {
    const results = [];

    // セクション候補の検出順位
    // 1. <section> タグ
    // 2. main 直下の div
    // 3. body 直下の div（mainがない場合）
    // 4. 背景色が変わる大きなブロック

    let candidates = [];

    // section タグ
    const sectionTags = document.querySelectorAll('section');
    if (sectionTags.length >= 3) {
      candidates = Array.from(sectionTags);
    }

    // section が少なければ main > div or body > div
    if (candidates.length < 3) {
      const main = document.querySelector('main') || document.querySelector('[role="main"]');
      const parent = main || document.body;
      const directChildren = Array.from(parent.children).filter(el => {
        const tag = el.tagName.toLowerCase();
        return ['div', 'section', 'article', 'aside', 'header', 'footer'].includes(tag);
      });

      if (directChildren.length >= 3) {
        candidates = directChildren;
      }
    }

    // それでも少なければ、再帰的に探す（2階層まで）
    if (candidates.length < 3) {
      const all = document.querySelectorAll('body > div > div, body > div > section, main > div > div');
      candidates = Array.from(all);
    }

    // 生成ユニークセレクター関数
    function getSelector(el) {
      if (el.id) return `#${el.id}`;
      const parent = el.parentElement;
      if (!parent) return el.tagName.toLowerCase();
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(el);
      const parentSel = parent.id
        ? `#${parent.id}`
        : parent === document.body
          ? 'body'
          : getSelector(parent);
      return `${parentSel} > ${el.tagName.toLowerCase()}:nth-child(${index + 1})`;
    }

    // セクション名推論
    function inferName(el, idx) {
      const text = (el.textContent || '').slice(0, 500).toLowerCase();
      const cls = (el.className || '').toLowerCase();
      const id = (el.id || '').toLowerCase();

      if (idx === 0) return 'hero';
      if (/hero|first-?view|fv|kv|key-?visual/.test(cls + id)) return 'hero';
      if (/悩み|こんな|お困り|problem/.test(text)) return 'problem';
      if (/特徴|メリット|選ばれる|feature|benefit/.test(text)) return 'features';
      if (/料金|価格|プラン|price|plan/.test(text)) return 'pricing';
      if (/お客様|体験談|口コミ|voice|testimonial|review/.test(text)) return 'testimonials';
      if (/流れ|ステップ|step|flow|process/.test(text)) return 'flow';
      if (/よくある|faq|質問/.test(text)) return 'faq';
      if (/申込|予約|無料|cta|entry|申し込み|カウンセリング|line/.test(text)) return 'cta';
      if (/footer|copyright|運営/.test(cls + id + text)) return 'footer';
      if (/比較|他社/.test(text)) return 'comparison';
      if (/実績|数字|data/.test(text)) return 'results';
      if (/医師|講師|チーム|staff|about/.test(text)) return 'staff';
      return `section-${String(idx + 1).padStart(2, '0')}`;
    }

    candidates.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const bgColor = style.backgroundColor;
      const height = rect.height;

      // 高さ50px以上のブロックのみ
      if (height >= 50) {
        results.push({
          selector: getSelector(el),
          name: inferName(el, idx),
          bgColor,
          height: Math.round(height),
        });
      }
    });

    return results;
  });
}

/**
 * セクション内テキストの構造化抽出
 */
async function extractSectionText(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { raw: '', headings: [], paragraphs: [], lists: [], buttons: [] };

    const headings = [];
    el.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
      headings.push({ tag: h.tagName, text: h.textContent.trim() });
    });

    const paragraphs = [];
    el.querySelectorAll('p').forEach(p => {
      const text = p.textContent.trim();
      if (text) paragraphs.push(text);
    });

    const lists = [];
    el.querySelectorAll('ul, ol').forEach(list => {
      const items = Array.from(list.querySelectorAll('li'))
        .map(li => li.textContent.trim())
        .filter(t => t);
      if (items.length) lists.push(items);
    });

    const buttons = [];
    el.querySelectorAll('button, a.btn, [class*="button"], [class*="btn"], [class*="cta"]').forEach(btn => {
      const text = btn.textContent.trim();
      if (text && text.length < 100) buttons.push(text);
    });

    // script/style除外した生テキスト
    const clone = el.cloneNode(true);
    clone.querySelectorAll('script, style, noscript').forEach(e => e.remove());
    const raw = clone.innerText || clone.textContent || '';

    return { raw: raw.trim(), headings, paragraphs, lists, buttons };
  }, selector);
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: node capture-lp.js <URL> --output <dir> [--width 375]

Example:
  node capture-lp.js "https://example.com/lp" --output ./output/lp/example
`);
    process.exit(1);
  }

  const url = args[0];
  let outputDir = './output/lp';
  let width = 375;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) outputDir = args[++i];
    if (args[i] === '--width' && args[i + 1]) width = parseInt(args[++i]);
  }

  captureLp(url, outputDir, width)
    .then(result => {
      console.log('\n[LP Capture] === Summary ===');
      console.log(JSON.stringify(result.metadata, null, 2));
    })
    .catch(err => {
      console.error('[LP Capture] Fatal:', err);
      process.exit(1);
    });
}

module.exports = { captureLp };
