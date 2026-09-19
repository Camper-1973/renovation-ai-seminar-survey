# CI/CD安全化 — 2026-09-19

GitHub mainが正本。main更新・手動実行・旧Preview入口は同じ必須ゲートを通す。

`test → 検証済みpayload → 本番未公開ソースへpush → 認証付き/dev検証 → 既存Deployment更新`

Releaseはtest/preview成功に依存する。失敗・スキップ時はReleaseしない。continue-on-errorによる迂回は禁止。構文チェックだけ、またはpushだけをPreview成功として扱わない。

共有の配備処理ではApps Script APIからHEAD全ファイルを読み戻し、テスト済みpayloadと照合する。/dev検証後にも照合し、不変の版を作成して同じpayloadであることを確認する。Releaseはその検証済み版だけを既存Deployment IDへ設定する。更新応答と反映後の版番号・URL一致を確認する。新しいDeploymentや別DEV Scriptは作らない。

Artifact・SHA256・source SHAで対象を固定し、Release直前にmain SHA一致を確認する。ジョブsummaryにsource SHA、テスト、Preview、Deployment更新結果、検証版・payloadハッシュを記録する。既存Secrets・ID・URLを維持し、BAT/PC手動claspを使わない。

## このシステムの検証範囲

GAS/HTML構文、診断計算、旧38列→39列保存互換、重複抑止、イベント別集計、dashboardリンク、3/5/10%境界をメモリ内でテストする。10%以上はレアラベルなしで出現率を保持、5%以上10%未満はレア、3%以上5%未満はかなりレア、3%未満は激レア。アプリ機能・閾値は変更していない。

認証付き/devの実ブラウザで10問の入力、fixture結果の6軸・dashboardリンク、実際の読み取り専用dashboard RPCと集計画面を確認する。回答送信や実シートへのテストデータ追加は行わない。
