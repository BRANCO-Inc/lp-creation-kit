# mkt-lp-write

無料オファー・体験・予約・診断・登録などへ誘導するLPの本文Markdownを作るSkill。

Claude Code / Codex の両runtimeでSkillとして動く。ユーザー入力・添付ファイル・このSkill内の `references/` だけで完結する。

## 何をするか

1. 3段階ヒアリング — ターゲット / コンセプト / その他情報を、ユーザーへの質問と一次情報ファイルの2系統で集める
2. 3型を並列生成 — 集めた材料から、性格の異なる3つの型を各1エージェントで同時に書く
   - 型1 オファー先出し型（報酬を先に見せる / Offer-led）
   - 型2 自己投影・反転型（読者自身を鏡に映す / Mirror-led）
   - 型3 権威・実証先出し型（信頼を先に立てる / Proof-led）
3. 99点まで自己監査 — 各原稿を99点ルーブリックで採点し、未達なら直してから出す

## 使い方

Claude Code:

```
/mkt-lp-write
```

Codex:

```
$mkt-lp-write でLP本文を作って
```

起動後、3段階のヒアリングに答える（思いつくまま話してOK）。一次情報ファイルがあればパス/URLを渡す。3型のLP本文Markdownが返る。

## 構成

```text
mkt-lp-write/
├── SKILL.md                              # 実行手順（ヒアリング→3型並列生成→監査）
├── agents/openai.yaml                    # Codex互換マニフェスト
└── references/
    ├── hearing-guide.md                  # 3段階ヒアリングの質問文
    ├── line-lp-structure.md              # セクション型・文字量・CTA設計・3型の構成
    ├── japanese-expression-rules.md      # LP臭を消す表現ルール（巧い表現・禁止表現）
    ├── audit-checklist.md                # 99点ルーブリック
    └── templates/
        ├── type-1-offer.md               # 型1 オファー先出し型
        ├── type-2-mirror.md              # 型2 自己投影・反転型
        └── type-3-proof.md               # 型3 権威・実証先出し型
```
