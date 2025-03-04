/**
 * 初期データベーススキーママイグレーション
 * 
 * このマイグレーションでは以下のテーブルを作成します：
 * - tasks: タスク管理用テーブル
 * - task_tags: タスクに関連するタグ情報
 * - time_entries: 時間記録用テーブル
 * - time_entry_tags: 時間記録に関連するタグ情報
 * - notifications: 通知情報
 */

import { dbConnection } from '../sqlite/connection';

export async function up(): Promise<void> {
  const db = dbConnection;
  
  try {
    await db.beginTransaction();
    
    // タスクテーブル
    await db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        due_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        assignee_id TEXT,
        project_id TEXT,
        parent_task_id TEXT,
        FOREIGN KEY(parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL
      )
    `);
    
    // タスクタグテーブル
    await db.run(`
      CREATE TABLE IF NOT EXISTS task_tags (
        task_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY(task_id, tag),
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);
    
    // インデックス作成
    await db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`);
    
    // 時間記録テーブル
    await db.run(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        task_id TEXT,
        project_id TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration INTEGER,
        description TEXT,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
      )
    `);
    
    // 時間記録タグテーブル
    await db.run(`
      CREATE TABLE IF NOT EXISTS time_entry_tags (
        time_entry_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY(time_entry_id, tag),
        FOREIGN KEY(time_entry_id) REFERENCES time_entries(id) ON DELETE CASCADE
      )
    `);
    
    // インデックス作成
    await db.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_start ON time_entries(start_time)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_type ON time_entries(type)`);
    
    // 通知テーブル
    await db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        priority TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        read BOOLEAN DEFAULT FALSE,
        expires_at DATETIME,
        action_type TEXT,
        action_target TEXT,
        action_label TEXT
      )
    `);
    
    // インデックス作成
    await db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp DESC)`);
    
    // メモリ（知識管理）テーブル
    await db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT, -- JSON形式で保存
        context TEXT,
        source TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires DATETIME,
        importance REAL NOT NULL DEFAULT 0.5
      )
    `);
    
    // メモリタグテーブル
    await db.run(`
      CREATE TABLE IF NOT EXISTS memory_tags (
        memory_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY(memory_id, tag),
        FOREIGN KEY(memory_id) REFERENCES memories(id) ON DELETE CASCADE
      )
    `);
    
    // メモリ埋め込みテーブル（ベクトル検索用）
    await db.run(`
      CREATE TABLE IF NOT EXISTS memory_embeddings (
        memory_id TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        FOREIGN KEY(memory_id) REFERENCES memories(id) ON DELETE CASCADE
      )
    `);
    
    // メモリ全文検索用仮想テーブル
    await db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        content,
        context,
        content='memories',
        content_rowid='id'
      )
    `);
    
    // トリガー設定: メモリ追加時に全文検索インデックスを更新
    await db.run(`
      CREATE TRIGGER IF NOT EXISTS memories_after_insert AFTER INSERT ON memories
      BEGIN
        INSERT INTO memory_fts(rowid, content, context)
        VALUES (new.id, new.content, new.context);
      END
    `);
    
    // トリガー設定: メモリ更新時に全文検索インデックスを更新
    await db.run(`
      CREATE TRIGGER IF NOT EXISTS memories_after_update AFTER UPDATE ON memories
      BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, content, context)
        VALUES('delete', old.id, old.content, old.context);
        INSERT INTO memory_fts(rowid, content, context)
        VALUES (new.id, new.content, new.context);
      END
    `);
    
    // トリガー設定: メモリ削除時に全文検索インデックスを更新
    await db.run(`
      CREATE TRIGGER IF NOT EXISTS memories_after_delete AFTER DELETE ON memories
      BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, content, context)
        VALUES('delete', old.id, old.content, old.context);
      END
    `);
    
    await db.commit();
    console.log('Migration 001-initial-schema: SUCCESS');
  } catch (error) {
    await db.rollback();
    console.error('Migration 001-initial-schema: FAILED', error);
    throw error;
  }
}

export async function down(): Promise<void> {
  const db = dbConnection;
  
  try {
    await db.beginTransaction();
    
    // トリガーの削除
    await db.run(`DROP TRIGGER IF EXISTS memories_after_insert`);
    await db.run(`DROP TRIGGER IF EXISTS memories_after_update`);
    await db.run(`DROP TRIGGER IF EXISTS memories_after_delete`);
    
    // テーブルの削除（依存関係を考慮した順序）
    await db.run(`DROP TABLE IF EXISTS memory_fts`);
    await db.run(`DROP TABLE IF EXISTS memory_embeddings`);
    await db.run(`DROP TABLE IF EXISTS memory_tags`);
    await db.run(`DROP TABLE IF EXISTS memories`);
    
    await db.run(`DROP TABLE IF EXISTS notifications`);
    
    await db.run(`DROP TABLE IF EXISTS time_entry_tags`);
    await db.run(`DROP TABLE IF EXISTS time_entries`);
    
    await db.run(`DROP TABLE IF EXISTS task_tags`);
    await db.run(`DROP TABLE IF EXISTS tasks`);
    
    await db.commit();
    console.log('Migration 001-initial-schema rollback: SUCCESS');
  } catch (error) {
    await db.rollback();
    console.error('Migration 001-initial-schema rollback: FAILED', error);
    throw error;
  }
}
