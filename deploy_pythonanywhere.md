# PythonAnywhere（pythonanywhere.com）完全無料＆SQLite永続化デプロイマニュアル

クレジットカード登録が**一切不要**で、FastAPI + SQLite アプリのデータ（`schedule.db`）が再起動後も**半永久的に保持される**プラットフォーム **PythonAnywhere** への完全デプロイ手順書です。

---

## ✨ PythonAnywhere の主なメリット

1. **クレジットカード登録が完全不要**:
   サインアップ時にカード情報の入力が求められません。
2. **SQLite データが消えない**:
   コンテナ型ではなく永続ファイルシステムが提供されるため、SQLiteに保存したイベントや回答データがリセットされません。

---

## Step 1: ローカルの最新コードを GitHub に送信

ご自身のパソコンのターミナル（PowerShell / VS Code ターミナルなど）で以下を実行し、最新のコードを送信します。

```bash
cd C:\Users\odeng\.gemini\antigravity\scratch\line-schedule-app

git push origin main
```

---

## Step 2: PythonAnywhere アカウントの作成（カード不要）

1. [PythonAnywhere 公式サイト (pythonanywhere.com)](https://www.pythonanywhere.com/) にアクセスします。
2. 右上の **「Pricing & signup」** をクリックします。
3. **「Create a Beginner account」** （無料枠）をクリックします。
4. ユーザー名（Username）、メールアドレス、パスワードを入力して登録完了です。
   ※発行されるWebサイトのURLは `https://<ユーザー名>.pythonanywhere.com` になります。

---

## Step 3: Bash コンソールでコード取得と仮想環境の設定

1. PythonAnywhere ダッシュボードで **「Consoles」** タブを開き、**「Bash」** をクリックして黒い端末画面を開きます。
2. 以下のコマンドを上から順に実行します：

```bash
# 1. GitHub からリポジトリを取得
git clone https://github.com/daigorou99/line-schedule-app.git

# 2. Python 3.10 の仮想環境を作成
mkvirtualenv --python=/usr/bin/python3.10 line-env

# 3. 必要なライブラリを一括インストール
pip install -r ~/line-schedule-app/requirements.txt
```

---

## Step 4: Web アプリの設定 (Web タブ)

1. 画面右上のメニューから **「Web」** タブを開きます。
2. **「Add a new web app」** ボタンを押します。
3. ダイアログが表示されたら次のように選択します：
   - ドメイン確認 -> **「Next」**
   - フレームワーク選択 -> **「Manual configuration」** (※DjangoやFlaskではなくManualを選択)
   - Pythonバージョン -> **「Python 3.10」** -> **「Next」**
4. 設定画面が開いたら、以下の **2項目** を設定します：

### ① Virtualenv (仮想環境) のパスを設定
- **Virtualenv:** 項目にある `Enter path to a virtualenv...` をクリックし、以下のように入力して青いチェックを押します。
  `/home/<あなたのユーザー名>/.virtualenvs/line-env`
  *(※ `<あなたのユーザー名>` はご自身の PythonAnywhere ユーザー名に置き換えてください)*

### ② Code & WSGI 設定ファイルの編集
- **Code** セクションにある **「WSGI configuration file:」** のリンク（例: `/var/www/yourusername_pythonanywhere_com_wsgi.py`）をクリックして編集画面を開きます。
- 画面内の既存コードをすべて消去し、代わりに以下の **5行のコード** を貼り付けて、右上 **「Save」** ボタンを押します。

```python
import sys
import os

# あなたのユーザー名に書き換えてください
path = '/home/YOUR_USERNAME/line-schedule-app'
if path not in sys.path:
    sys.path.append(path)

os.chdir(path)

# FastAPIをWSGI互換で呼び出し
from main import wsgi_app as application
```
*(※ `YOUR_USERNAME` 部分をご自身の PythonAnywhere ユーザー名に変更してください)*

---

## Step 5: アプリの起動と確認

1. 編集後、**「Web」** タブに戻ります。
2. ページ上部にある緑色の **「Reload <ユーザー名>.pythonanywhere.com」** ボタンを押します。
3. これでデプロイ完了です！表示されている URL にアクセスしてください。

🔗 **公開URL**: `https://<あなたのユーザー名>.pythonanywhere.com`

---

## 💡 LINEグループやメンバーへの共有

作成したURL（`https://<ユーザー名>.pythonanywhere.com`）を LINE やチャットに共有するだけで、だれでもスマホ・PCからアクセスしてイベント作成や空き状況の回答が利用できます。データは SQLite（`schedule.db`）に安全に永久保存されます。
