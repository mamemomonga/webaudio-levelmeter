# web-level-meter

Webブラウザだけで動作する、ライブ配信・DTM向けのオーディオレベルメータです。
マイクやライン入力のレベルを手軽にチェックし、ステレオの状態や不正な結線を確認できます。

## 特徴

- **対数表示のステレオピークレベルメータ** — L/R独立、ピークホールド付き。
- **ラウドネスメータ** — ITU-R BS.1770準拠。ターゲットは -15 LUFS 固定で、モメンタリー(400ms)を表示。
- **わかりやすい適正表示** — ショートターム(3秒)を基準に「小さい」「ちょうどいい」「大きい」を表示。
- **ピークランプ** — トゥルーピークが -1.0 dBTP を超えると点灯し、3秒間保持。
- **ステレオ状態の検出** — 「ステレオ」「モノラル」「片チャンネル」「逆位相」を自動判定。
- **オーディオデバイス選択** — 入力デバイスを切り替え可能。
- ノイズ抑制・自動ゲイン(AGC)・エコー除去はすべて無効化して計測します。

## 技術スタック

- Vite + React による静的ファイルのみのシングルページアプリ。
- 計測は AudioWorklet 上で実行(K特性フィルタ、4倍オーバーサンプリングによるトゥルーピーク検出、ステレオ相関算出)。
- GitHub Pages で公開。

## 使い方(開発)

操作は `Makefile` に集約しています。

```sh
make install   # 依存パッケージをインストール
make dev       # 開発サーバを起動
make build     # 本番用ビルド(dist/ を生成)
make preview   # ビルド結果をローカルで確認
make deploy    # gh-pages ブランチへ手動公開
```

`make` のみ、または `make help` でタスク一覧を表示します。

## 公開

`main` ブランチへの push で GitHub Actions が自動的にビルドし、GitHub Pages へデプロイします
(`.github/workflows/deploy.yml`)。リポジトリの Settings → Pages で、Source を
「GitHub Actions」に設定してください。

## 動作要件

- getUserMedia / AudioWorklet に対応したモダンブラウザ(Chrome, Edge, Firefox, Safari など)。
- マイク/ライン入力へのアクセス許可。HTTPS もしくは localhost での実行が必要です。

## ライセンス

MIT
