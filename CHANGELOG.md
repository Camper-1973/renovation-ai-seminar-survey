# CHANGELOG

## 2026-09-19 — 既存Webアプリ設定をPreviewで保持

- 本番の既存Deploymentから確認した `ANYONE_ANONYMOUS` / `USER_DEPLOYING` をappsscript.jsonへ明記。
- GitHub ActionsのPreviewで設定が欠落し、テストデプロイが開けない問題を修正。
- 既存の公開範囲、実行者、URLを維持。診断・回答保存・個人結果・イベント別集計のロジックは変更しない。
- v0.6.3で既に追加済みの結果画面から同じイベントのダッシュボードへ進むボタンを利用。
