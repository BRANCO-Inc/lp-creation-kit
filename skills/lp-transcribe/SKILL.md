---
name: lp-transcribe
description: 競合・参考のランディングページ(LP)を文字起こしする。URLを渡すと、ページをスクリーンショットしてセクション分割し、Vision OCRで「文字起こしだけ」と「構造化md」の2本を出力する。LP文字起こし、競合LP調査、LPスクショ、LPをMD化、に使う。
---

# LP文字起こし

LPのURLから、ページの文字起こしを2形式で作る。

- `<name>_transcript.md` — 文字起こしだけ（本文テキストのみ。読み返し・素材用）
- `<name>_structured.md` — 構造化md（セクション別に A.テキスト情報 / B.視覚事実。分析・参照用）

ローカルで完結する。クラウドや外部サービスには保存しない。出力はすべて `./output/<name>/` に置く。

## セットアップ（初回のみ）

スクリーンショットに Playwright を使う。このスキル（lp-transcribe）のフォルダ内で一度だけ実行する。

```bash
npm install && npx playwright install chromium
```

Python 側は PyMuPDF 不要（LPはNode/Playwrightで取得）。`split-images.py` は Pillow を使う（`pip install pillow`）。

## 手順

`<name>` は出力フォルダ名（英数字。例: `competitor-a`）。

### 1. LPをキャプチャしてセクション分割する

```bash
node scripts/capture-lp.js "<URL>" --output ./output/<name>
```

出力:
- `./output/<name>/images/section-XX-*.png` — セクション別スクショ
- `./output/<name>/images/full-page.png` — 全体
- `./output/<name>/sections.json` — セクション別のDOMテキスト
- `./output/<name>/metadata.json` — URL・取得日時・ページタイトル

縦長の1枚画像で構成されたLP（セクションが1〜2枚しか取れない場合）は、全体画像を一定の高さで割る:

```bash
python3 scripts/split-images.py ./output/<name> --height 1500
```

`images/part-01.png` 〜 が作られる。以降は section / part どちらの連番画像でも同じ手順。

### 2. OCRプロンプトを読み込む

```
Read: lp-ocr-prompt.md
```

これが出力フォーマットの唯一の定義。以降のVision OCRはこの形式に厳密に従う（`## Part [番号]: [タイプ名]` で始め、A.テキスト情報 / B.視覚事実 を書く）。

### 3. 全セクション画像をVision OCRする

`./output/<name>/images/` の連番PNG（`full-page.png` を除く）を、ファイル名の昇順で読み込み、`lp-ocr-prompt.md` の形式でOCRする。ファイル番号順に Part 01, 02, ... と採番する。

- 画像が15枚未満: 全画像を一度に読み込んで1回でOCRする
- 15枚以上: 15枚ごとに1エージェント（Task）を並列起動し、各エージェントが担当範囲をOCRして部分MDに書き出す → 後でファイル番号順に結合する

DOM補完: `sections.json` の `text.raw` が20字以上あるパートは、対応する `## Part XX:` ブロックの末尾に「C. DOM補完テキスト（sections.json より）」として追記する。

### 4. 構造化MDを書き出す

`metadata.json` からヘッダーを作り、OCR結果をパート番号順に連結して書き出す。

保存先: `./output/<name>/<name>_structured.md`

```md
# LP文字起こし: {ページタイトル/サービス名}

**URL**: {URL}
**取得日**: {YYYY-MM-DD}
**デバイス**: モバイル (375px)
**パート数**: {N}

---

## Part 01: ...
A. テキスト情報
...
B. 視覚事実
...
```

### 5. 「文字起こしだけ」を生成する

構造化MDから、本文テキストだけを抜いた読みやすい文字起こしを作る。

```bash
python3 scripts/extract-transcript.py ./output/<name>/<name>_structured.md
```

`./output/<name>/<name>_transcript.md` が作られる（視覚事実・DOM補完・分析は落として、コピー本文だけを残す）。

### 6. 完了報告

出力フォルダのパスと、2本のMD（transcript / structured）、パート数を報告する。

## 出力まとめ

```
./output/<name>/
├── <name>_transcript.md   ← 文字起こしだけ
├── <name>_structured.md   ← 構造化md
├── images/                ← セクション別スクショ
├── sections.json
└── metadata.json
```

## 注意

- 広告LPはリダイレクトが多い。リダイレクト後の最終URLでうまく取れないときは、元URLでも試す
- 画像主体のLPはDOMテキストが空になりやすい。Vision OCRを主、`sections.json` を補完に使う
- ログインが必要なページは取得できない
