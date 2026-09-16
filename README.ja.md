# @castachick/erd

[![npm version](https://img.shields.io/npm/v/%40castachick%2Ferd)](https://www.npmjs.com/package/@castachick/erd)
[![Node.js version](https://img.shields.io/node/v/%40castachick%2Ferd)](https://www.npmjs.com/package/@castachick/erd)

[English](README.md) | **日本語**

PostgreSQLの実スキーマを読み取り、関連するテーブルを分割したMermaid ER図を生成するCLIです。ORMやmigrationファイルには依存せず、テーブルの行データは読みません。

## プレビュー

顧客・注文・注文明細・決済・商品・カテゴリ・在庫の7テーブルからなる架空のECスキーマです。CLIと同じ生成APIでSVGを作成しています。

### 全体図

対象の全テーブルと外部キーを、カラムを省略して表示します。

![架空のECスキーマの全体図](docs/example/overview.svg)

### 詳細図

関連するテーブルをhub（中心テーブル）の周囲にまとめます。別グループの隣接テーブルもcontextとして表示するため、グループをまたぐ関係を確認できます。

![注文グループのカラムとcontextの商品テーブルを含む詳細図](docs/example/02-orders.svg)

[すべての図とMermaidソース](docs/example/index.md) · [サンプル生成スクリプト](scripts/generate-example.ts)

リポジトリで `npm ci` → `npm run docs:example` を実行すると再生成できます。DBは不要ですが、後述のChromeが必要です。サンプルの設定は `maxTables: 4`、`maxContextTables: 1`、`columns: 'all'` です。ドキュメントやサンプルの変更時は、英語版・日本語版を一緒に更新してください。

## インストール

Node.js 20以上が必要です。

```bash
npm install -g @castachick/erd
export DATABASE_URL='postgresql://user:password@localhost:5432/app'
erd --schema public --max-tables 15 --out ./docs/erd
```

プロジェクトに開発依存として追加する場合は `npm install -D @castachick/erd`、実行は `npx erd` です。インストールせず一度だけ実行する場合は `npx --package @castachick/erd erd --schema public` を使用できます。

SVGの生成にはPuppeteerが管理するChromeを使用します。通常はnpmインストール時に自動取得されます（ブラウザー分のダウンロード容量が増えます）。取得をスキップした環境では、次のコマンドで対応ブラウザーを導入してください。

```bash
npx --package puppeteer@24.43.1 puppeteer browsers install chrome
```

既存Chromeを使う場合は `PUPPETEER_EXECUTABLE_PATH` に実行ファイルのパスを指定できます。LinuxではChromeの実行に必要な共有ライブラリも必要です。SVG生成はローカルで行い、DBスキーマを外部の描画サービスには送信しません。

## ソースから開発

```bash
npm ci
npm run build
export DATABASE_URL='postgresql://user:password@localhost:5432/app'
node dist/cli.js --schema public --max-tables 15 --out ./docs/erd
```

開発中は `npm run dev -- --schema public --out ./docs/erd` でも実行できます。パッケージをグローバルインストールすると `erd` コマンドが使えます。

```bash
npm install -g .
erd --schema public --schema auth --out ./docs/erd
```

## オプション

| オプション | デフォルト | 内容 |
| --- | --- | --- |
| `--database-url <url>` | `DATABASE_URL` | 接続URL。明示指定を優先 |
| `--schema <schema>` | `public` | 対象schema。繰り返し指定可能 |
| `--out <directory>` | `./erd` | 出力先 |
| `--max-tables <number>` | `15` | 各図の主テーブル数の上限。1以上 |
| `--context-depth <number>` | `1` | 隣接テーブルを追加。0または1 |
| `--max-context-tables <number>` | `5` | 別枠で追加するcontext数の上限。0以上 |
| `--columns <all\|keys\|none>` | `keys` | 全カラム／PK・FK・UNIQUEカラム／カラムなし |
| `--cardinality <inferred\|simple>` | `inferred` | 制約から推定／両端0..Nの簡略表示 |
| `--include-table <glob>` | すべて | テーブル名または`schema.table`にマッチ。繰り返し指定可能 |
| `--exclude-table <glob>` | なし | 除外glob。繰り返し指定可能。includeより優先 |
| `--help` | | 使用方法 |

```bash
erd --schema public --exclude-table '__drizzle_*' --columns keys --out ./docs/erd
```

globはシェルで展開されないよう引用してください。システムschemaは対象外です。アプリケーションのテーブルを暗黙に除外しないため、migration管理テーブルの除外は明示指定してください。

## 出力

```text
docs/erd/
├── index.md
├── overview.mmd
├── overview.svg
├── 01-products.mmd
├── 01-products.svg
├── 02-orders.mmd
├── 02-orders.svg
└── graph.json
```

`index.md`にoverviewと各部分図のSVGを画像として埋め込み、hub、主テーブルとcontext、警告を記載します。MarkdownプレビューでER図を直接確認でき、各図にはSVG単体とMermaidソースへのリンクもあります。すべての`.mmd`に同じベース名の`.svg`を1対1で生成します。`.mmd`はMermaid対応ビューアで開けます。`overview.mmd`は全対象テーブルとFKをカラムなしで表示し、各図にはhub/contextの表示ラベルを付けます。`graph.json`には元の型、カラム順、複合PK・UNIQUE・FK、参照動作とcommunityを保存します。

同じDB状態・オプション・依存バージョン・Chrome／フォント環境では、時刻を含めず同じ出力を生成します。SVGのサイズや配置はOSやフォントにより変わる場合があります。SVG生成に失敗した場合はエラー終了し、新しいindexは書き込みません。生成対象と同名のファイルは上書きします。以前の実行の図や利用者のファイルは削除しないため、分割条件を変更した際は`index.md`を現行の図の一覧として利用してください。

## 分割と関係の解釈

- FK制約1個を重み1とする単純無向グラフを解析します。同じテーブル対の複数FKは重みを加算し、複合FKは1個として扱います。
- Louvainを固定順で実行し、大きすぎるcommunityは再分割します。分割できない場合は接続の強い隣接ノードを順に追加するgreedy法へ切り替えます。
- 全テーブルはちょうど1つの主グループに所属します。hubは内部の隣接テーブル数、全体の隣接数、テーブルIDの順で選びます。
- contextは主グループとのFK数、hubとの直接接続、全体の隣接数、IDの順で選びます。context同士の関係や2 hop先の関係は描きません。
- `max-tables`は**主テーブルだけ**の上限です。図全体の上限は`max-tables + max-context-tables`です。
- 他の対象テーブルと接続のないテーブルは独立グループにまとめます。自己参照FKは解析の重みから除外し、図とJSONには残します。
- 対象外schemaやfilterで除外されたテーブルへのFKはJSONに保持し、図では省略して警告します。必要なschemaは`--schema`で追加してください。

FKカラムがすべてNOT NULLなら親側は1、nullableなカラムがあれば0..1です。FKカラム集合がPK／UNIQUE制約の全カラムを含む場合、子側は0..1、それ以外は0..Nです。FKカラムがすべて子のPKに含まれる場合は実線、それ以外は破線で描画します。

Mermaidの`UK`は複合UNIQUEの構成カラムにも付きますが、コメントで複合制約のメンバーであることを示します。個々のカラムが単独でuniqueという意味ではありません。元の制約単位はJSONで確認できます。特殊文字を持つ名前や型はMermaid用に正規化し、表示ラベル／カラムコメントとJSONに元の名前を保持します。

v1では通常テーブルとpartitioned table（子partitionを含む）が対象です。view・materialized view・foreign table、UNIQUE制約ではない独立unique index、FKのMATCH FULLやアプリケーション上の関係は推定しません。`simple`は両端を0..Nとする概略表示で、制約の正確な再現には使用しないでください。ドット等を含む識別子はJSON内のテーブルIDをSQL形式で引用し、衝突を避けます。

## 安全性とエラー

メタデータ取得は`REPEATABLE READ READ ONLY`トランザクションで行い、接続タイムアウト10秒・SQLタイムアウト30秒を設定します。接続ユーザーには対象schemaのメタデータを参照できる権限を用意してください。認証情報や接続URLは生成物・ログに含めず、DBドライバーの生のエラーも表示しません。

接続失敗、存在しないschema、対象0件、出力失敗、不正オプションは終了コード1となります。外部FKの省略・孤立テーブル・fallback分割は警告です。

## 検証

```bash
npm run check
npm test
npm run build
```

通常テストはグラフの不変条件、決定性、複合制約、cardinality、CLIの引数検証・認証情報非表示、実際のMermaidパーサーによる構文検証、ChromeによるSVG生成・決定性・1対1対応・indexの画像参照の検証を含みます。通常テストにもChromeが必要です。

PostgreSQL統合テストは専用テストDBを指定して実行します。指定がなければスキップします。指定DBに一時schemaを作成し、テスト後に削除します。PostgreSQL 16で検証しています。

```bash
TEST_DATABASE_URL='postgresql://localhost/erd_test' npm run test:integration
```

統合テストでは複合FKの順序、同名制約、複数schema、型とNULL制約、partition、CLI出力と再実行の一致、失敗ケースを検証します。

## 構成

`src/postgres`がSQL・接続、`src/schema-graph`が中間モデルとfilter、`src/analysis`がグラフ分割、`src/render`がMermaid・JSON・indexを担当します。`generate()`はブラウザー不要の同期APIで従来のMermaid・JSON・リンク型indexを返します。`await generateWithSvg()`はSVGと画像埋め込みindexを含む生成APIです。`run()`とCLIはDB取得からSVGを含む全ファイルの出力までを行います。

設計の基準は[handoff](https://github.com/CastaChick/erd/blob/main/postgresql-er-diagram-cli-handoff.md)です。Mermaidのcardinalityは[公式構文](https://mermaid.js.org/syntax/entityRelationshipDiagram.html)、Louvainの設定は[Graphology公式ドキュメント](https://graphology.github.io/standard-library/communities-louvain.html)と採用パッケージの宣言・実装を確認しています。

## npm公開手順（メンテナー向け）

公開名は `@castachick/erd` です。`publishConfig`でnpm公式registryとpublic公開を指定しています。

マージ後、最新のmainで以下を実行します。

```bash
npm ci
npm run test:package
npm publish --dry-run
# 配布内容とバージョンを確認してから実際に公開
npm publish
```

`test:package`はtarballを生成し、一時ディレクトリへ本番依存だけでインストールしてCLI・ESM API・SVG生成を検証します。終了時に一時ファイルを削除します。`npm publish`では`prepublishOnly`が型チェックとテストを実行し、`prepack`がdistを再生成します。配布内容はdist、両言語のREADME、生成済みサンプル、LICENSE、package.jsonに限定し、開発用ソースやテストは含めません。

DB統合テストも実行する場合は、専用DBの`TEST_DATABASE_URL`を設定してください。未指定時は統合テストをスキップします。`--dry-run`は実際の公開や2FA認証の成功を保証するものではありません。公開時にnpmから認証を要求された場合はその案内に従ってください。

以後のリリースでは未公開のバージョンへ更新します。同じバージョンの再公開はできません。公開後は `npm view @castachick/erd version` と `npx --package @castachick/erd erd --help` で確認できます。

## ライセンス

[MITライセンス](LICENSE)で公開しています。
