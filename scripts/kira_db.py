#!/usr/bin/env python3
"""
Kira v3 — External SQLite Memory Management CLI

Allows managing, viewing, editing, adding, and syncing Kira's SQLite database (`kira_memory.db`)
outside of the web application.

Usage:
  python3 scripts/kira_db.py init
  python3 scripts/kira_db.py list
  python3 scripts/kira_db.py add "Loves building AI models" --category preference
  python3 scripts/kira_db.py delete <id>
  python3 scripts/kira_db.py edit <id> "Updated text"
  python3 scripts/kira_db.py set-profile username "Alex"
  python3 scripts/kira_db.py sync-to-kira
"""

import sys
import os
import sqlite3
import json
import argparse
import time

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "kira_memory.db")
EXPORT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "kira_db_export.json")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT DEFAULT 'general',
        text TEXT NOT NULL,
        affection INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL,
        tags TEXT DEFAULT ''
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS word_banks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        word TEXT NOT NULL,
        mood TEXT DEFAULT 'all',
        intensity INTEGER DEFAULT 1
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_profile (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )
    """)
    
    conn.commit()
    conn.close()
    print(f"[OK] Database initialized at: {DB_PATH}")

def list_all():
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    
    print("\n=== KIRA MEMORIES (SQLite DB) ===")
    cursor.execute("SELECT * FROM memories ORDER BY id ASC")
    memories = cursor.fetchall()
    if not memories:
        print("  (No memories stored yet)")
    else:
        for m in memories:
            ts = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(m['timestamp'] / 1000))
            print(f"  [{m['id']}] ({m['category'].upper()}) {m['text']} (added: {ts})")

    print("\n=== USER PROFILE (SQLite DB) ===")
    cursor.execute("SELECT * FROM user_profile ORDER BY key ASC")
    profile = cursor.fetchall()
    if not profile:
        print("  (No profile facts set yet)")
    else:
        for p in profile:
            print(f"  {p['key']}: {p['value']}")

    conn.close()

def add_memory(text, category="general", tags=""):
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    ts = int(time.time() * 1000)
    cursor.execute("INSERT INTO memories (category, text, timestamp, tags) VALUES (?, ?, ?, ?)",
                   (category, text, ts, tags))
    conn.commit()
    mem_id = cursor.lastrowid
    conn.close()
    print(f"[OK] Added memory ID {mem_id}: \"{text}\" ({category})")
    sync_to_kira()

def delete_memory(mem_id):
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM memories WHERE id = ?", (mem_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    if deleted:
        print(f"[OK] Deleted memory ID {mem_id}")
        sync_to_kira()
    else:
        print(f"[WARN] Memory ID {mem_id} not found. Nothing deleted.")

def edit_memory(mem_id, new_text):
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    ts = int(time.time() * 1000)
    cursor.execute("UPDATE memories SET text = ?, timestamp = ? WHERE id = ?", (new_text, ts, mem_id))
    conn.commit()
    updated = cursor.rowcount > 0
    conn.close()
    if updated:
        print(f"[OK] Updated memory ID {mem_id}: \"{new_text}\"")
        sync_to_kira()
    else:
        print(f"[WARN] Memory ID {mem_id} not found. Nothing updated.")

def set_profile(key, value):
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    ts = int(time.time() * 1000)
    cursor.execute("INSERT OR REPLACE INTO user_profile (key, value, updated_at) VALUES (?, ?, ?)",
                   (key, value, ts))
    conn.commit()
    conn.close()
    print(f"[OK] Profile set: {key} = \"{value}\"")
    sync_to_kira()

def sync_to_kira():
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM memories ORDER BY id ASC")
    memories = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM user_profile")
    profile = {r['key']: r['value'] for r in cursor.fetchall()}

    cursor.execute("SELECT * FROM word_banks")
    words = [dict(r) for r in cursor.fetchall()]

    payload = {
        "source": "kira_memory.db",
        "updated_at": int(time.time() * 1000),
        "memories": memories,
        "profile": profile,
        "word_banks": words
    }

    with open(EXPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)

    conn.close()
    print(f"[OK] Synced {len(memories)} memories to: {EXPORT_PATH}")

def main():
    parser = argparse.ArgumentParser(description="Kira SQLite Memory Tool")
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("init", help="Initialize SQLite DB")
    subparsers.add_parser("list", help="List all memories and profile facts")

    add_parser = subparsers.add_parser("add", help="Add a new memory")
    add_parser.add_argument("text", type=str, help="Memory text")
    add_parser.add_argument("--category", type=str, default="general", help="Category (preference, personal, disclosure, general)")
    add_parser.add_argument("--tags", type=str, default="", help="Comma-separated tags")

    del_parser = subparsers.add_parser("delete", help="Delete a memory by ID")
    del_parser.add_argument("id", type=int, help="Memory ID")

    edit_parser = subparsers.add_parser("edit", help="Edit a memory by ID")
    edit_parser.add_argument("id", type=int, help="Memory ID")
    edit_parser.add_argument("text", type=str, help="New text")

    prof_parser = subparsers.add_parser("set-profile", help="Set a user profile key/value")
    prof_parser.add_argument("key", type=str, help="Profile key (e.g., username)")
    prof_parser.add_argument("value", type=str, help="Profile value")

    subparsers.add_parser("sync-to-kira", help="Export SQLite DB to Kira JSON bundle")

    args = parser.parse_args()

    if args.command == "init":
        init_db()
    elif args.command == "list":
        list_all()
    elif args.command == "add":
        add_memory(args.text, args.category, args.tags)
    elif args.command == "delete":
        delete_memory(args.id)
    elif args.command == "edit":
        edit_memory(args.id, args.text)
    elif args.command == "set-profile":
        set_profile(args.key, args.value)
    elif args.command == "sync-to-kira" or args.command is None:
        sync_to_kira()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
