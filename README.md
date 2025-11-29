# kdbxttrc

## 環境構築

1. deno を任意の方法でインストール
2. git clone する
3. prettier を有効化する
4. VSCode の場合

- 拡張機能: [Deno](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno)をインストールする
- `Ctrl + Shift + p` > `Deno: Initialize Workspace Configuration` を実行する
  - Node 拡張機能がその workspace で無効化されて赤線が消える

## 実行方法

```bash
deno task start
```

`localhost:8000`で起動する。

### 使い方例

- API の確認（例: hello ハンドラ）

```bash
curl http://localhost:8000/api/hello
```

- ブラウザで静的ページを開く例。
  - いずれの指定も可。

```
http://localhost:8000/hello.html
http://localhost:8000/hello
http://localhost:8000/hello/
```

## ファイル構成

```
.
├── api                 APIサーバ
├── deno.json
├── deno.lock
├── pages               ページ
└── server.ts
```

## 開発メモ

- ページの追加
  - `pages/` にフォルダを作成し、HTML/CSS/JS を配置する。
- 新しい API の追加
  - `api/` に TypeScript ファイルを作成する
