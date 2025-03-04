/**
 * SQLiteデータベース接続管理クラス
 * データベースへの接続と基本的なクエリ実行機能を提供
 */

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { logger } from '@utils/logger';
import config from '@config/default.json';

export class SQLiteConnection {
  private static instance: SQLiteConnection;
  private db: Database | null = null;
  private dbPath: string;
  private isOpen = false;

  private constructor() {
    this.dbPath = path.resolve(process.cwd(), config.database.path);
    
    // データベースファイルのディレクトリが存在しない場合は作成
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  /**
   * SQLiteConnection のシングルトンインスタンスを取得
   */
  public static getInstance(): SQLiteConnection {
    if (!SQLiteConnection.instance) {
      SQLiteConnection.instance = new SQLiteConnection();
    }
    return SQLiteConnection.instance;
  }

  /**
   * データベース接続を開く
   */
  public async open(): Promise<Database> {
    if (this.isOpen && this.db) {
      return this.db;
    }

    try {
      const openAsync = promisify<string, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, Database>(
        (filename, mode, callback) => {
          const db = new sqlite3.Database(filename, mode, callback);
          return db;
        }
      );

      this.db = await openAsync(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
      
      // WALモードを有効化（パフォーマンスと信頼性向上のため）
      await this.run('PRAGMA journal_mode = WAL;');
      
      // 外部キー制約を有効化
      await this.run('PRAGMA foreign_keys = ON;');
      
      this.isOpen = true;
      logger.info(`SQLiteデータベース接続を確立: ${this.dbPath}`);
      
      return this.db;
    } catch (error) {
      logger.error('データベース接続オープン中にエラーが発生しました', { error, path: this.dbPath });
      throw new Error(`データベース接続に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * データベース接続を閉じる
   */
  public async close(): Promise<void> {
    if (!this.isOpen || !this.db) {
      return;
    }

    try {
      const closeAsync = promisify<void>(
        (callback) => {
          this.db?.close(callback);
        }
      );

      await closeAsync();
      this.isOpen = false;
      this.db = null;
      logger.info('データベース接続を終了しました');
    } catch (error) {
      logger.error('データベース接続クローズ中にエラーが発生しました', { error });
      throw new Error(`データベース接続クローズに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * SQLクエリを実行（INSERT, UPDATE, DELETEなど）
   */
  public async run(sql: string, params: any = []): Promise<{ lastID: number; changes: number }> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(this: sqlite3.RunResult, err) {
        if (err) {
          logger.error('SQLクエリ実行エラー', { sql, params, error: err });
          reject(err);
          return;
        }
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * SQLクエリを実行し、最初の行を返す
   */
  public async get<T>(sql: string, params: any = []): Promise<T | undefined> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) {
          logger.error('SQLクエリ実行エラー (get)', { sql, params, error: err });
          reject(err);
          return;
        }
        resolve(row as T | undefined);
      });
    });
  }

  /**
   * SQLクエリを実行し、すべての行を返す
   */
  public async all<T>(sql: string, params: any = []): Promise<T[]> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('SQLクエリ実行エラー (all)', { sql, params, error: err });
          reject(err);
          return;
        }
        resolve(rows as T[]);
      });
    });
  }

  /**
   * トランザクションを開始
   */
  public async beginTransaction(): Promise<void> {
    await this.run('BEGIN TRANSACTION');
  }

  /**
   * トランザクションをコミット
   */
  public async commit(): Promise<void> {
    await this.run('COMMIT');
  }

  /**
   * トランザクションをロールバック
   */
  public async rollback(): Promise<void> {
    await this.run('ROLLBACK');
  }

  /**
   * 接続が確立されていることを確認
   */
  private async ensureConnection(): Promise<void> {
    if (!this.isOpen || !this.db) {
      await this.open();
    }
  }
}

// シングルトンインスタンスをエクスポート
export const dbConnection = SQLiteConnection.getInstance();
