import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(
    os.environ.get("DB_PATH") or Path(__file__).resolve().parent.parent / "database.sqlite"
)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                embedding TEXT NOT NULL,
                criado_em TEXT NOT NULL
            )
            """
        )


def insert_user(nome: str, embedding: list[float]) -> int:
    criado_em = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        cursor = conn.execute(
            "INSERT INTO users (nome, embedding, criado_em) VALUES (?, ?, ?)",
            (nome, json.dumps(embedding), criado_em),
        )
        return cursor.lastrowid


def get_all_users() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute("SELECT id, nome, embedding, criado_em FROM users").fetchall()
    return [
        {
            "id": row["id"],
            "nome": row["nome"],
            "embedding": json.loads(row["embedding"]),
            "criado_em": row["criado_em"],
        }
        for row in rows
    ]


def get_user(user_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, nome, embedding, criado_em FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "nome": row["nome"],
        "embedding": json.loads(row["embedding"]),
        "criado_em": row["criado_em"],
    }


def delete_user(user_id: int) -> bool:
    with _connect() as conn:
        cursor = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        return cursor.rowcount > 0
