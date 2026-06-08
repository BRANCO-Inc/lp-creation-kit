# mkt-lp-write

meta/SNS広告 → LINE誘導の無料ウェビナーLP本文を作る、配布用の独立Skill。

Claude Code / Codex の両runtimeでSkillとして動く。

## 何をするか

1. **3段階ヒアリング** — ターゲット / コンセプト / その他情報を、ユーザーへの質問と一次情報ファイルの2系統で集める
2. **3型を並列生成** — 集めた材料から、性格の異なる3つの型を各1エージェントで同時に書く
   - 型A: 特典ご利益先出し型
   - 型B: 悩み共感・型反転型
   - 型C: 逆転ストーリー・権威先出し型
3. **99点まで自己監査** — 各原稿を99点ルーブリックで採点し、未達なら直してから出す

## 使い方

Claude Code:

```
/mkt-lp-write
```

Codex:

```
$mkt-lp-write でLP本文を作って
```

起動後、3段階のヒアリングに答える（音声入力で思いつくまま話してOK）。一次情報ファイルがあればパス/URLを渡す。3型のLP本文Markdownが返る。

## 構成

```text
mkt-lp-write/
├── SKILL.md                              # 実行手順（ヒアリング→3型並列生成→監査）
├── agents/openai.yaml                    # Codex互換マニフェスト
└── references/
    ├── hearing-guide.md                  # 3段階ヒアリングの質問文
    ├── line-lp-structure.md              # セクション型・文字量・CTA設計・3型の構成
    ├── japanese-expression-rules.md      # LP臭を消す表現ルール（巧い表現7原則・禁止表現）
    ├── audit-checklist.md                # 99点ルーブリック
    ├── copy-swipe-file.md                # 実LP8本から抽出した原文コピー集
    └── templates/
        ├── type-a-offer-first.md
        ├── type-b-empathy-pasona.md
        └── type-c-story-authority.md
```

## 設計の裏付け

`references/` の型・表現・監査基準は、meta→LINE誘導の実LP8本（fusion-ai / linkup / realus / opt-in / zeromin 系）の文字起こしを分析して作った。LP常套句や誇大表現を避け、具体・口語・人間味で書くことを優先している。

## バリデーション

配布前にCodex skill validatorを実行する。

```bash
python3 path/to/quick_validate.py path/to/mkt-lp-write
```
