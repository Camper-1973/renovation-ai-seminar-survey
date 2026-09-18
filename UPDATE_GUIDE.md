# 更新・反映手順

## 基本原則

- GitHub `main` がコードの唯一の正本。
- Apps Scriptは本番プロジェクト1つだけを使用する。
- 別DEV Apps Scriptは作らない。
- Windows BAT、PCからの手動`clasp push`は通常運用に使わない。
- 本番GASの未公開ソースへPreviewし、`/dev`で確認後に既存`/exec`をReleaseする。

## 初回設定

GitHub Environment `production` に次を登録する。

- `CLASPRC_JSON`
- `SEMINAR_PROD_SCRIPT_ID`
- `SEMINAR_PROD_DEPLOYMENT_ID`

## 通常更新

### Preview

`main` の次の4ファイルが変わると `Preview seminar survey on PROD source` が本番Apps Scriptの未公開ソースへ反映する。

- `appsscript.json`
- `Code.gs`
- `Index.html`
- `Dashboard.html`

この段階では公開中の `/exec` は変更しない。

### 確認

Apps Scriptのテストデプロイ `/dev` で以下を確認する。

- 参加者10問フォーム
- 診断結果
- 回答保存と重複防止
- イベントID
- ダッシュボード集計
- 既存回答との互換性

### Release

問題がなければ `Release seminar survey to PROD` を実行する。通常は `source_ref = main` のまま使用する。

## ロールバック

戻したいcommit SHAを `source_ref` に指定してReleaseする。

## 廃止した運用

- 更新BAT
- 別DEV Apps Script
- PC手動`clasp push`
- Apps Scriptエディタを正本として直接修正する運用
- 更新ごとに新しい公開URLを作る運用
