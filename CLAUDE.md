# CLAUDE.md — kinmu-sr プロジェクト作法

> このファイルは Claude Code がプロジェクトに入る時に必ず最初に読むべきドキュメント。詳細仕様は `SPEC.md` を参照。

## このプロジェクトは何か

社労士向け勤怠管理・給与計算システム。第1号案件は **ノース社労士事務所**。詳細は `SPEC.md` 参照。

## 作業開始時のチェックリスト

新しいタスクを始める前に必ず:

1. [ ] `SPEC.md` の関連セクションを読んだか
2. [ ] `SPEC.md` Section 2（Non-Negotiable Rules）を読み返したか
3. [ ] 作業対象がどのフェーズ・スプリントか（`SPEC.md` Section 10）
4. [ ] 既存コードをgrepして類似実装がないか確認

## 開発の黄金律

### やること
- ✅ 小さく作って動かす（大きなPRを避ける）
- ✅ テストを書いてから実装する（特に `src/domain/rule-engine/`）
- ✅ 型を先に決める（`src/types/`, `src/domain/*/types.ts`）
- ✅ サーバー側で検証（Zod）、フロント側でUX検証
- ✅ コミットメッセージは Conventional Commits
- ✅ 不明点は `SPEC.md` Section 12 Open Questions に追記

### やらないこと
- ❌ 「とりあえず動く」コードを書かない（型付け・エラー処理必須）
- ❌ `any` 型を使わない
- ❌ 日付計算を自力で書かない（必ず `date-fns-tz`）
- ❌ クライアント側にサービスロールキーを漏らさない
- ❌ `SPEC.md` に書いてないスキーマを勝手に追加しない
- ❌ マイナンバーなど機微情報を扱うテーブル・カラムを絶対に追加しない

## ファイル配置のルール

```
src/
├── app/               # 画面・Server Actions・Route Handlers
├── components/        # UIコンポーネント
├── domain/            # 純粋ドメインロジック（DB非依存）
├── lib/               # 共通ユーティリティ
└── types/             # 型定義

supabase/
├── migrations/        # 順序付きSQL（YYYYMMDDHHMMSS_name.sql）
└── seed.sql

tests/
├── unit/              # Vitest (必須: domain/ 配下)
└── e2e/               # Playwright (主要フロー)
```

## コマンド

```bash
# 開発
npm run dev                     # Next.jsローカル起動
npm run db:reset                # Supabaseローカルリセット（migrations + seed）
npm run db:types                # DBスキーマから型生成

# 品質
npm run lint
npm run typecheck
npm run test                    # Vitest
npm run test:e2e                # Playwright

# デプロイ
npm run build
```

## コミュニケーション

- 不明点があれば実装を止めて質問する
- 複数の選択肢がある設計判断は、必ず人間に確認を取る
- SPECに反する実装が必要になったら、先にSPECの修正を提案する

## SPEC.md の章ポインタ（よく参照する）

| 何をやる？ | 見る章 |
|---|---|
| 新しいテーブル追加 | §5 Data Model |
| 新しい画面追加 | §9 Screen Flow & §4.2 Directory |
| 権限チェックを書く | §6 Authentication & Authorization |
| 給与計算ロジック | §8 Rule Engine |
| API追加 | §7 API Specification |
| 実装順序の確認 | §10 Implementation Phases |
| やっていいこと悪いこと | §2 Non-Negotiable Rules |

## 最後に

このプロジェクトは「小さな社労士事務所を助ける道具」です。豪華な機能より、**確実に動いて、現場の先生が安心して使える**ことを優先してください。迷ったら「ノース社労士の先生が明日これを使って困らないか？」と自問してください。

---

@AGENTS.md

