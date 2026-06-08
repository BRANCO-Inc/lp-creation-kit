---
name: pdf-transcribe
description: PDF（ウェビナースライド・セミナー資料・提案書など）を文字起こしする。PDFパスを渡すと、各ページを画像化してVision OCRし、「文字起こしだけ」と「構造化md」の2本を出力する。PDF文字起こし、スライドOCR、資料をMD化、に使う。
---

# PDF文字起こし

PDFから、文字起こしを2形式で作る。

- `<name>_transcript.md` — 文字起こしだけ（本文テキストのみ。読み返し・素材用）
- `<name>_structured.md` — 構造化md（スライド別に A.文字情報 / B.視覚事実。分析・参照用）

ローカルで完結する。外部サービスには保存しない。出力は `./output/<name>/` に置く。

## セットアップ（初回のみ）

PDFの画像化に PyMuPDF を使う。

```bash
pip install pymupdf
```

## 手順

`<name>` は出力フォルダ名（省略時はPDFのファイル名を使う）。

### 1. 各ページをPNGに変換する

```bash
python3 scripts/pdf-to-images.py "<PDFパス>" --output ./output/<name>
```

`./output/<name>/images/page_0001.png` 〜 が作られ、総ページ数と推奨バッチ数（20pにつき1）が表示される。
小さい文字や注釈が多い資料は `--scale 1.0` を付けて解像度を上げる。

### 2. OCRプロンプトを読み込む

```
Read: ocr-prompt.md
```

これが出力フォーマットの唯一の定義。以降のVision OCRはこの形式に厳密に従う（`Slide [ページ番号]` で始め、A.文字情報 / B.視覚事実 を書く）。

### 3. 全ページをVision OCRする

`./output/<name>/images/` の `page_XXXX.png` を、ページ番号順に読み込み、`ocr-prompt.md` の形式でOCRする。

- 20ページごとに1エージェント（Task）を並列起動する
- 各エージェントは担当範囲のPNGを一括読み込みし、1回のOCR呼び出しに渡して、部分MDに書き出す
- 全エージェント完了後、ページ番号順に結合して1本の構造化MDにする

改行保持: スライド内の改行を原文のまま残す。一行にまとめない。
Rate Limit が出たら60秒待ってリトライする。

### 4. 構造化MDを書き出す

保存先: `./output/<name>/<name>_structured.md`

```md
# {資料名} 文字起こし

**ファイル**: {ファイル名}（{総ページ数}ページ）
**生成日**: {YYYY-MM-DD}

---
Slide 1

A. 文字情報
...

B. 視覚事実
...
---
```

### 5. 「文字起こしだけ」を生成する

```bash
python3 scripts/extract-transcript.py ./output/<name>/<name>_structured.md
```

`./output/<name>/<name>_transcript.md` が作られる（視覚事実・分析を落として、スライドの文字だけを残す）。

### 6. 完了報告

出力フォルダのパスと、2本のMD（transcript / structured）、ページ数を報告する。

## 出力まとめ

```
./output/<name>/
├── <name>_transcript.md   ← 文字起こしだけ
├── <name>_structured.md   ← 構造化md
└── images/                ← ページ別PNG
```

## 注意

- 画像解像度は `--scale 0.75`（約1080px）が標準。`1.0` まで上げてよい。`1.5` 以上は2000px制限でOCRが失敗しやすい
- バッチが途中で失敗したら、そのバッチのページだけ再OCRして結合し直す
- アニメーションで段階的に増えるスライドは、最終状態の1枚だけを記述する
