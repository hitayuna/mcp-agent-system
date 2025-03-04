/**
 * マイグレーション管理クラス
 * データベースマイグレーションの実行と履歴管理を担当
 */

import fs from 'fs';
import path from 'path';
import { dbConnection } from './sqlite/connection';
import { logger } from '@utils/logger';

interface Migration {
  id: string;
  filename: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

interface MigrationRecord {
  id: string;
  filename: string;
  applied_at: string;
}

export class MigrationManager {
  private migrationsPath: string;
  private migrations: Migration[] = [];

  constructor(migrationsPath?: string) {
    this.migrationsPath = migrationsPath || path.resolve(__dirname, 'migrations');
  }

  /**
   * マイグレーション実行履歴テーブルの初期化
   */
  private async initMigrationTable(): Promise<void> {
    const db = dbConnection;
    
    try {
      await db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      logger.error('マイグレーションテーブルの初期化に失敗しました', { error });
      throw new Error(`マイグレーションテーブルの作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * マイグレーションファイルのロード
   */
  private async loadMigrations(): Promise<void> {
    if (!fs.existsSync(this.migrationsPath)) {
      logger.warn(`マイグレーションディレクトリが存在しません: ${this.migrationsPath}`);
      return;
    }

    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();  // ファイル名でソートして順番に実行

    this.migrations = [];

    for (const file of files) {
      try {
        const fullPath = path.join(this.migrationsPath, file);
        // ESM形式でインポート
        const migration = await import(fullPath);
        
        if (!migration.up || !migration.down) {
          logger.warn(`マイグレーションファイルには up と down メソッドが必要です: ${file}`);
          continue;
        }

        // マイグレーションIDはファイル名から取得（例：001-initial-schema.ts -> 001）
        const id = file.split('-')[0];
        if (!id) {
          logger.warn(`無効なマイグレーションファイル名です: ${file}`);
          continue;
        }

        this.migrations.push({
          id,
          filename: file,
          up: migration.up,
          down: migration.down
        });
      } catch (error) {
        logger.error(`マイグレーションファイルのロードに失敗しました: ${file}`, { error });
      }
    }

    this.migrations.sort((a, b) => {
      return a.id.localeCompare(b.id);
    });

    logger.info(`${this.migrations.length}個のマイグレーションファイルをロードしました`);
  }

  /**
   * 適用済みマイグレーションの取得
   */
  private async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const db = dbConnection;
    
    try {
      return await db.all<MigrationRecord>('SELECT * FROM migrations ORDER BY id');
    } catch (error) {
      logger.error('適用済みマイグレーションの取得に失敗しました', { error });
      throw new Error(`適用済みマイグレーションの取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 未適用のマイグレーションを取得
   */
  private async getPendingMigrations(): Promise<Migration[]> {
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map(m => m.id));
    
    return this.migrations.filter(m => !appliedIds.has(m.id));
  }

  /**
   * マイグレーションの適用を記録
   */
  private async recordMigration(migration: Migration): Promise<void> {
    const db = dbConnection;
    
    try {
      await db.run(
        'INSERT INTO migrations (id, filename) VALUES (?, ?)',
        [migration.id, migration.filename]
      );
    } catch (error) {
      logger.error('マイグレーション記録の保存に失敗しました', { 
        migration: migration.filename, 
        error 
      });
      throw new Error(`マイグレーション記録の保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * マイグレーション記録の削除
   */
  private async removeMigrationRecord(migrationId: string): Promise<void> {
    const db = dbConnection;
    
    try {
      await db.run('DELETE FROM migrations WHERE id = ?', [migrationId]);
    } catch (error) {
      logger.error('マイグレーション記録の削除に失敗しました', { 
        migrationId, 
        error 
      });
      throw new Error(`マイグレーション記録の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 全マイグレーションを最新状態に更新
   */
  public async migrateUp(): Promise<void> {
    await this.initMigrationTable();
    await this.loadMigrations();
    
    const pendingMigrations = await this.getPendingMigrations();
    
    if (pendingMigrations.length === 0) {
      logger.info('適用するマイグレーションはありません。データベースは最新です。');
      return;
    }
    
    logger.info(`${pendingMigrations.length}個のマイグレーションを適用します...`);
    
    for (const migration of pendingMigrations) {
      try {
        logger.info(`マイグレーション適用中: ${migration.filename}`);
        await migration.up();
        await this.recordMigration(migration);
        logger.info(`マイグレーション成功: ${migration.filename}`);
      } catch (error) {
        logger.error(`マイグレーション失敗: ${migration.filename}`, { error });
        throw new Error(`マイグレーション ${migration.filename} の適用に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    logger.info('全てのマイグレーションが正常に適用されました');
  }

  /**
   * 指定したバージョンまでマイグレーションをロールバック
   * @param targetId ロールバック先のマイグレーションID (未指定の場合は1つ戻す)
   */
  public async migrateDown(targetId?: string): Promise<void> {
    await this.initMigrationTable();
    await this.loadMigrations();
    
    const appliedMigrations = await this.getAppliedMigrations();
    
    if (appliedMigrations.length === 0) {
      logger.info('ロールバックするマイグレーションはありません');
      return;
    }
    
    // ロールバックするマイグレーションを特定
    let migrationsToRollback: MigrationRecord[] = [];
    
    if (targetId) {
      // 指定したIDより新しいマイグレーションをロールバック
      const targetIndex = appliedMigrations.findIndex(m => m.id === targetId);
      
      if (targetIndex === -1) {
        logger.error(`指定されたマイグレーションIDが見つかりません: ${targetId}`);
        return;
      }
      
      migrationsToRollback = appliedMigrations.slice(targetIndex + 1).reverse();
    } else {
      // 最新のマイグレーションをロールバック
      migrationsToRollback = [appliedMigrations[appliedMigrations.length - 1]];
    }
    
    if (migrationsToRollback.length === 0) {
      logger.info('ロールバックするマイグレーションはありません');
      return;
    }
    
    logger.info(`${migrationsToRollback.length}個のマイグレーションをロールバックします...`);
    
    for (const record of migrationsToRollback) {
      const migration = this.migrations.find(m => m.id === record.id);
      
      if (!migration) {
        logger.warn(`マイグレーションファイルが見つかりません: ${record.filename}`);
        continue;
      }
      
      try {
        logger.info(`マイグレーションロールバック中: ${migration.filename}`);
        await migration.down();
        await this.removeMigrationRecord(migration.id);
        logger.info(`ロールバック成功: ${migration.filename}`);
      } catch (error) {
        logger.error(`ロールバック失敗: ${migration.filename}`, { error });
        throw new Error(`マイグレーション ${migration.filename} のロールバックに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    logger.info('ロールバックが完了しました');
  }

  /**
   * マイグレーションの現在のステータスを表示
   */
  public async status(): Promise<{ applied: MigrationRecord[], pending: Migration[] }> {
    await this.initMigrationTable();
    await this.loadMigrations();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const pendingMigrations = await this.getPendingMigrations();
    
    logger.info('=== マイグレーションステータス ===');
    logger.info(`適用済み: ${appliedMigrations.length}個`);
    appliedMigrations.forEach(m => {
      logger.info(`- ${m.id}: ${m.filename} (適用日時: ${m.applied_at})`);
    });
    
    logger.info(`未適用: ${pendingMigrations.length}個`);
    pendingMigrations.forEach(m => {
      logger.info(`- ${m.id}: ${m.filename}`);
    });
    
    return {
      applied: appliedMigrations,
      pending: pendingMigrations
    };
  }
}

// デフォルトインスタンスをエクスポート
export const migrationManager = new MigrationManager();
