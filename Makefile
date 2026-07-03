# web-level-meter ビルドタスク
#
# ローカルでの操作はこの Makefile に集約する。

.DEFAULT_GOAL := help

.PHONY: help install dev build preview deploy clean

help: ## このヘルプを表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## 依存パッケージをインストール
	npm install

dev: ## 開発サーバを起動
	npm run dev

build: ## 本番用にビルド(dist/ を生成)
	npm run build

preview: build ## ビルド結果をローカルで確認
	npm run preview

deploy: build ## dist/ を gh-pages ブランチへ公開
	npx gh-pages -d dist

clean: ## 生成物と依存を削除
	rm -rf dist node_modules
