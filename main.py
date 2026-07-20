import os
import sqlite3
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from a2wsgi import WSGIMiddleware

DB_PATH = os.getenv("DB_PATH", "schedule.db")

app = FastAPI(title="Web Schedule Planner")

# WSGI アダプター (PythonAnywhere等のWSGIサーバー用)
wsgi_app = WSGIMiddleware(app)

# 静的ファイルの提供
os.makedirs("static/js", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    with get_db() as conn:
        cursor = conn.cursor()
        # イベントテーブル
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            memo TEXT,
            created_at TEXT NOT NULL
        )
        """)
        # 候補日時テーブル
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS candidate_dates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL,
            candidate_text TEXT NOT NULL,
            display_order INTEGER NOT NULL,
            FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
        )
        """)
        # 回答者テーブル
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            affiliation TEXT,
            pin_code TEXT,
            comment TEXT,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
            UNIQUE(event_id, user_name)
        )
        """)

        # 既存DBへのカラム追加互換チェック
        cursor.execute("PRAGMA table_info(responses)")
        columns = [column[1] for column in cursor.fetchall()]
        if "affiliation" not in columns:
            cursor.execute("ALTER TABLE responses ADD COLUMN affiliation TEXT")
        if "pin_code" not in columns:
            cursor.execute("ALTER TABLE responses ADD COLUMN pin_code TEXT")

        # 回答明細テーブル
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS response_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            response_id INTEGER NOT NULL,
            candidate_id INTEGER NOT NULL,
            status TEXT NOT NULL, -- 'ok', 'maybe', 'ng'
            FOREIGN KEY (response_id) REFERENCES responses (id) ON DELETE CASCADE,
            FOREIGN KEY (candidate_id) REFERENCES candidate_dates (id) ON DELETE CASCADE
        )
        """)
        conn.commit()


@app.on_event("startup")
def startup_event():
    init_db()


# テーブルの自動初期化（WSGI起動時用）
init_db()


# ----------------------------------------------------
# Pydantic Schemas
# ----------------------------------------------------
class EventCreateSchema(BaseModel):
    title: str
    memo: Optional[str] = ""
    candidates: List[str]


class ResponseSubmitSchema(BaseModel):
    user_name: str
    affiliation: Optional[str] = ""
    pin_code: Optional[str] = ""
    comment: Optional[str] = ""
    answers: Dict[int, str]  # candidate_id -> 'ok'|'maybe'|'ng'


class ResponseDeleteSchema(BaseModel):
    pin_code: Optional[str] = ""


# ----------------------------------------------------
# Page Routes
# ----------------------------------------------------
@app.get("/", response_class=FileResponse)
def read_index():
    return FileResponse("static/index.html")


@app.get("/e/{event_id}", response_class=FileResponse)
def read_event_page(event_id: str):
    return FileResponse("static/event.html")


# ----------------------------------------------------
# API Routes
# ----------------------------------------------------
@app.post("/api/events")
def create_event(payload: EventCreateSchema):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="イベント名を入力してください")

    valid_candidates = [c.strip() for c in payload.candidates if c.strip()]
    if not valid_candidates:
        raise HTTPException(
            status_code=400, detail="候補日時を少なくとも1つ入力してください"
        )

    event_id = str(uuid.uuid4())[:8]
    created_at = datetime.now().isoformat()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO events (id, title, memo, created_at) VALUES (?, ?, ?, ?)",
            (event_id, title, payload.memo, created_at),
        )
        for idx, cand in enumerate(valid_candidates):
            cursor.execute(
                "INSERT INTO candidate_dates (event_id, candidate_text, display_order) VALUES (?, ?, ?)",
                (event_id, cand, idx),
            )
        conn.commit()

    return {"event_id": event_id, "title": title, "url": f"/e/{event_id}"}


@app.get("/api/events/{event_id}")
def get_event_details(event_id: str):
    with get_db() as conn:
        cursor = conn.cursor()

        # イベント取得
        cursor.execute(
            "SELECT id, title, memo, created_at FROM events WHERE id = ?",
            (event_id,),
        )
        event_row = cursor.fetchone()
        if not event_row:
            raise HTTPException(
                status_code=404, detail="イベントが見つかりません"
            )

        event_data = dict(event_row)

        # 候補日時取得
        cursor.execute(
            "SELECT id, candidate_text FROM candidate_dates WHERE event_id = ? ORDER BY display_order ASC",
            (event_id,),
        )
        candidates = [dict(r) for r in cursor.fetchall()]

        # 回答取得
        cursor.execute(
            "SELECT id, user_name, affiliation, pin_code, comment, updated_at FROM responses WHERE event_id = ? ORDER BY updated_at ASC",
            (event_id,),
        )
        responses_rows = cursor.fetchall()

        responses_list = []
        for resp in responses_rows:
            resp_dict = dict(resp)
            resp_dict["has_pin"] = bool(resp_dict["pin_code"])
            del resp_dict["pin_code"]

            cursor.execute(
                "SELECT candidate_id, status FROM response_details WHERE response_id = ?",
                (resp_dict["id"],),
            )
            details = cursor.fetchall()
            resp_dict["answers"] = {
                str(d["candidate_id"]): d["status"] for d in details
            }
            responses_list.append(resp_dict)

        # 候補日ごとの集計
        summary = {}
        for cand in candidates:
            cand_id_str = str(cand["id"])
            summary[cand_id_str] = {
                "ok": 0,
                "maybe": 0,
                "ng": 0,
                "score": 0,
            }

        for resp in responses_list:
            for cand_id_str, status in resp["answers"].items():
                if cand_id_str in summary:
                    if status == "ok":
                        summary[cand_id_str]["ok"] += 1
                        summary[cand_id_str]["score"] += 2
                    elif status == "maybe":
                        summary[cand_id_str]["maybe"] += 1
                        summary[cand_id_str]["score"] += 1
                    elif status == "ng":
                        summary[cand_id_str]["ng"] += 1

        return {
            "event": event_data,
            "candidates": candidates,
            "responses": responses_list,
            "summary": summary,
        }


@app.post("/api/events/{event_id}/respond")
def submit_response(event_id: str, payload: ResponseSubmitSchema):
    user_name = payload.user_name.strip()
    if not user_name:
        raise HTTPException(
            status_code=400, detail="お名前を入力してください"
        )

    affiliation = payload.affiliation.strip() if payload.affiliation else ""
    pin_code = payload.pin_code.strip() if payload.pin_code else ""
    updated_at = datetime.now().isoformat()

    with get_db() as conn:
        cursor = conn.cursor()

        # イベント存在確認
        cursor.execute("SELECT id FROM events WHERE id = ?", (event_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404, detail="イベントが見つかりません"
            )

        # 既存ユーザー回答確認
        cursor.execute(
            "SELECT id, pin_code FROM responses WHERE event_id = ? AND user_name = ?",
            (event_id, user_name),
        )
        existing_resp = cursor.fetchone()

        if existing_resp:
            response_id = existing_resp["id"]
            db_pin = existing_resp["pin_code"] or ""

            if db_pin and db_pin != pin_code:
                raise HTTPException(
                    status_code=403,
                    detail="編集パスワードが一致しません。正しい暗証番号を入力してください。",
                )

            final_pin = pin_code if pin_code else db_pin

            cursor.execute(
                "UPDATE responses SET affiliation = ?, pin_code = ?, comment = ?, updated_at = ? WHERE id = ?",
                (affiliation, final_pin, payload.comment, updated_at, response_id),
            )
            cursor.execute(
                "DELETE FROM response_details WHERE response_id = ?",
                (response_id,),
            )
        else:
            cursor.execute(
                "INSERT INTO responses (event_id, user_name, affiliation, pin_code, comment, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (event_id, user_name, affiliation, pin_code, payload.comment, updated_at),
            )
            response_id = cursor.lastrowid

        # 回答明細の挿入
        for cand_id, status in payload.answers.items():
            if status in ["ok", "maybe", "ng"]:
                cursor.execute(
                    "INSERT INTO response_details (response_id, candidate_id, status) VALUES (?, ?, ?)",
                    (response_id, int(cand_id), status),
                )

        conn.commit()

    return {"status": "success", "message": "回答を送信しました"}


@app.post("/api/events/{event_id}/responses/{response_id}/delete")
def delete_response(event_id: str, response_id: int, payload: ResponseDeleteSchema):
    pin_code = payload.pin_code.strip() if payload.pin_code else ""

    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, pin_code FROM responses WHERE id = ? AND event_id = ?",
            (response_id, event_id),
        )
        resp = cursor.fetchone()
        if not resp:
            raise HTTPException(
                status_code=404, detail="回答が見つかりません"
            )

        db_pin = resp["pin_code"] or ""
        if db_pin and db_pin != pin_code:
            raise HTTPException(
                status_code=403,
                detail="パスワードが一致しません。正しい暗証番号を入力してください。",
            )

        cursor.execute("DELETE FROM responses WHERE id = ?", (response_id,))
        conn.commit()

    return {"status": "success", "message": "回答を削除しました"}
