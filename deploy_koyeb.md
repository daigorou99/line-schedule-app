# Koyeb（koyeb.com）クレジットカード不要デプロイ＆公開マニュアル

クレジットカード登録が一切不要で、FastAPI + SQLite アプリを無料でインターネット上に公開できるプラットフォーム **Koyeb（コイエブ）** へのデプロイ手順書です。

---

## ⚠️ SQLite データベースとデータ永続化について

Koyeb の**無料Nanoインスタンス**はコンテナ型サービスのため、新しいデプロイやサーバー再起動が発生すると**コンテナ内のファイルシステムが初期化される（エフェメラル領域）**仕様となっています。

- **一次的な利用（飲み会やイベントの調整）**:
  数日〜1週間程度の日程調整であれば、再起動がなければそのまま問題なく利用できます。
- **完全なデータの永久保存が必要な場合**:
  **Turso (SQLite互換無料クラウドDB)** や **Supabase (PostgreSQL)** などの外部無料データベースへ接続するように改修することで、完全に無料でデータを半永久的に保持できます。

---

## Step 1: GitHub へ最新コードをプッシュする

パソコンのターミナル（PowerShell / VS Codeターミナルなど）で以下を実行して、新しく作成した `Procfile` などを GitHub に送信します。

```bash
cd C:\Users\odeng\.gemini\antigravity\scratch\line-schedule-app

git push origin main
```

---

## Step 2: Koyeb (koyeb.com) でサービスを作成する

### 1. サインアップ
1. [Koyeb 公式サイト (koyeb.com)](https://www.koyeb.com/) にアクセスし、**「Sign Up」** をクリックします。
2. **「Continue with GitHub」** を選択すると、クレジットカード情報の入力なしで即座にアカウントが作成されます。

### 2. 新しいサービスの作成
1. Koyebダッシュボードで **「Create Service」** または **「Web Service」** をクリックします。
2. Deployment method で **「GitHub」** を選択します。
3. リポジトリ一覧から **`daigorou99/line-schedule-app`** を選択します。
4. ブランチに **`main`** を指定します。

### 3. ビルドと環境設定
- **Builder**: `Buildpack` (Pythonが自動選択されます)
- **Environment variables (環境変数)**:
  - Key: `PORT` / Value: `8000`
- **Instance category**: `Free` (Nano インスタンス)
- **Regions**: 最寄りの `Tokyo (tok)` または `Frankfurt/Washington` を選択

### 4. デプロイ実行
- 画面最下部の **「Deploy」** ボタンをクリックします。
- 数分でビルドとコンテナ起動が完了し、以下のような公開用ドメイン（URL）が自動発行されます！
  `https://line-schedule-app-yourname.koyeb.app`

---

## Step 3: LINEグループや外部メンバーへの共有

発行された `https://xxx.koyeb.app` のURLをコピーし、LINEグループやメール、各種SNS等に共有すれば、誰でもスマホやPCのブラウザからスケジュール調整・回答が可能になります！
