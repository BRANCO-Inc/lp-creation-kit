# LP制作キット

誘導LP（無料オファー・体験・予約・診断・登録などへ誘導するLP）を作るための、Claude Code / Codex 向けスキル集。

競合や参考のLP・資料を文字起こしして材料を集め、その材料から自分のLP本文を書くところまでを、3つのスキルでカバーする。すべてローカルで完結し、外部の非公開データには依存しない。

## 収録スキル

| スキル | 役割 |
|---|---|
| `skills/lp-transcribe` | 競合・参考LPのURLを文字起こし（スクショ→セクション分割→Vision OCR） |
| `skills/pdf-transcribe` | ウェビナースライド・資料PDFを文字起こし（ページ画像化→Vision OCR） |
| `skills/lp-write` | 集めた材料から、性格の異なる3型のLP本文を書く（3型並列生成→99点自己監査） |

文字起こし2スキルは、それぞれ **2形式**で保存する。

- `<name>_transcript.md` — 文字起こしだけ（本文テキストのみ）
- `<name>_structured.md` — 構造化md（セクション/スライド別に テキスト情報 と 視覚事実）

## 想定ワークフロー

```
1. 競合LP・参考資料を集める
      │  lp-transcribe（URL） / pdf-transcribe（PDF）
      ▼
2. 文字起こし（transcript ＋ structured の2形式）
      │  構成・コピー・CTA設計を観察する材料にする
      ▼
3. lp-write で自分のLP本文を3型生成 → 99点監査 → 推奨1本
```

## インストール

Claude Code / Codex のスキルディレクトリ（例: `$HOME/.claude/skills/`）に、`skills/` 配下の各フォルダを置く。

```bash
git clone https://github.com/BRANCO-Inc/mkt-lp-write.git
cp -R mkt-lp-write/skills/lp-transcribe  "$HOME/.claude/skills/"
cp -R mkt-lp-write/skills/pdf-transcribe "$HOME/.claude/skills/"
cp -R mkt-lp-write/skills/lp-write       "$HOME/.claude/skills/"
```

必要なものだけ入れてもよい（例: 文字起こしだけ使う、書く部分だけ使う）。各スキルは独立して動く。

### セットアップ

- `lp-transcribe`: Playwright が必要。スキルフォルダ内で `npm install && npx playwright install chromium`。`split-images.py` 用に `pip install pillow`。
- `pdf-transcribe`: `pip install pymupdf`。
- `lp-write`: 追加依存なし。

## 使い方

各スキルの `SKILL.md` に手順がある。Claude Code なら自然文で呼べる。

```
この競合LPを文字起こしして: https://example.com/lp
このスライドPDFを文字起こしして: ./slides.pdf
集めた材料でLPを書いて
```

## 出力

文字起こしは `./output/<name>/` に保存される。

```
./output/<name>/
├── <name>_transcript.md   ← 文字起こしだけ
├── <name>_structured.md   ← 構造化md
└── images/                ← セクション/ページ画像
```

LP本文は Markdown で出力される（型1 オファー先出し / 型2 自己投影・反転 / 型3 権威・実証先出し の3本＋推奨）。

## 注意

- 文字起こしは、対象ページ・資料の権利に配慮して、調査・学習の範囲で使う
- ログインが必要なページは取得できない
