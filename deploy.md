# Render.com（Render）デプロイ＆公開マニュアル

本アプリ（FastAPI + SQLite）をクラウドプラットフォーム **Render.com** にデプロイし、インターネット上に無料公開してLINEグループや外部メンバーに共有する手順をまとめたマニュアルです。

---

## ⚠️ SQLite データベースとデータ永続化に関する重要注意点

 Render の**無料Webサービスプラン（Free Tier）**では、サーバーの非アクティブ時（15分以上アクセスがない場合）のスリープ解除や、新しいデプロイ・サーバー再起動のタイミングで**ファイルシステムが初期化される（エフェメラル領域）**仕様になっています。

そのため、デフォルトの SQLite 設定（`schedule.db`）のままだと、サーバー再起動時に作成したイベントや回答データがリセットされます。

### 💡 データ永続化のための3つの対応案

1. **【暫定利用（無料）】**:
   - そのまま無料でデプロイ。数日間の飲み会調整など、一次的な用途として利用する（再起動がなければデータは保持されます）。

2. **【Render Disk（永続ストレージ）を利用（有料 $1/月〜）】**:
   - Renderダッシュボードで `Persistent Disk` を追加マウント（例: `/var/data`）。
   - 環境変数 `DB_PATH` を `/var/data/schedule.db` に設定することで、再起動後も完全にSQLiteデータが永続保持されます。

3. **【無料クラウドDBへの移行（完全無料永続化）】**:
   - **Turso (SQLite互換クラウドDB)** や **Supabase (PostgreSQL)**、**Render PostgreSQL** などの外部無料データベースへ接続するように改修する（今後の機能拡張時におすすめ）。

---

## Step 1: ローカル Git リポジトリの準備（完了済み）

プロジェクトディレクトリで以下のファイルが準備されています。
- [render.yaml](file:///C:/Users/odeng/.gemini/antigravity/scratch/line-schedule-app/render.yaml) (Render自動認識ファイル)
- [requirements.txt](file:///C:/Users/odeng/.gemini/antigravity/scratch/line-schedule-app/requirements.txt) (gunicorn, uvicorn, fastapi 等)
- [.gitignore](file:///C:/Users/odeng/.gemini/antigravity/scratch/line-schedule-app/.gitignore) (DBファイルや一時ファイルを除外)

---

## Step 2: GitHub へコードをプッシュする

1. [GitHub](https://github.com/) にログインし、右上「**+**」 -> **「New repository」** を選択。
2. リポジトリ名を入力（例: `line-schedule-app`）し、**Public**（またはPrivate）のまま **「Create repository」** ボタンを押す。
3. パソコンのターミナル（PowerShellなど）で以下を実行して GitHub にコードを送信します。

```bash
cd C:\Users\odeng\.gemini\antigravity\scratch\line-schedule-app

# GitHubのURLに置き換えて実行してください
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/line-schedule-app.git
git branch -M main
git push -u origin main
```

---

## Step 3: Render (render.com) でデプロイする

1. [Render.com](https://render.com/) にアクセスし、**「Sign Up」**（GitHubアカウントでサインインが最も便利です）。
2. ダッシュボード右上の **「New +」** ボタンを押します。

### 方法 A: Blueprint を使う場合（最もおすすめ・自動設定）
1. **「Blueprint」** を選択します。
2. 先ほど GitHub に作成した `line-schedule-app` リポジトリを接続 (Connect) します。
3. `render.yaml` が自動検出されますので、**「Apply」** を押します。
4. 数分でビルド・デプロイが完了し、公開用URL（例: `https://line-schedule-app.onrender.com`）が発行されます！

### 方法 B: Web Service を手動で作成する場合
1. **「Web Service」** を選択し、リポジトリを Connect します。
2. 設定項目を以下のように入力します：
   - **Name**: `line-schedule-app`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
   - **Instance Type**: `Free`
3. **「Create Web Service」** をクリックします。

---

## Step 4: 動作確認とLINE共有

1. デプロイ完了後に発行されたURL（`https://xxx.onrender.com`）にアクセスします。
2. イベントを作成し、発行されたURLをスマホ（LINEや各種SNS）から開いてみてください。
3. 外部のメンバーから正常に空き状況の入力・閲覧ができることを確認できます！
