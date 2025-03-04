/**
 * 通知リポジトリの実装
 * 
 * 通知関連のデータアクセスを提供します。
 */

import { 
  Notification, 
  NotificationType, 
  NotificationPriority, 
  NotificationStatus,
  NotificationAction,
  NotificationTemplate
} from '../../core/notification/types';
import { Repository, FilterOptions } from '../../core/repository/repository.interface';
import { BaseSQLiteRepository } from '../database/sqlite/base-repository';

export interface NotificationFilterOptions extends FilterOptions {
  type?: NotificationType;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  source?: string;
  fromDate?: Date;
  toDate?: Date;
  expiresAfter?: Date;
  expiresBefore?: Date;
  search?: string;
}

export class NotificationRepository extends BaseSQLiteRepository<Notification, string> {
  protected tableName = 'notifications';
  protected primaryKey = 'id';

  /**
   * エンティティをテーブル行に変換
   * @param notification 通知エンティティ
   * @returns テーブル行オブジェクト
   */
  protected entityToRow(notification: Notification): Record<string, any> {
    return {
      ...notification,
      timestamp: notification.timestamp.toISOString(),
      expiresAt: notification.expiresAt ? notification.expiresAt.toISOString() : null,
      actions: notification.actions ? JSON.stringify(notification.actions) : null,
      metadata: notification.metadata ? JSON.stringify(notification.metadata) : '{}',
      createdAt: notification.createdAt ? notification.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * テーブル行をエンティティに変換
   * @param row テーブル行
   * @returns 通知エンティティ
   */
  protected rowToEntity(row: Record<string, any>): Notification {
    // 必須フィールドのデフォルト値
    const defaults = {
      id: '',
      type: NotificationType.SYSTEM,
      priority: NotificationPriority.MEDIUM,
      title: '',
      message: '',
      source: 'system',
      timestamp: new Date(),
      status: NotificationStatus.PENDING,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // rowにidがない場合はエラー（通常発生しないはず）
    if (!row.id) {
      console.error('データベースレコードにIDが含まれていません', row);
    }
    
    return {
      ...defaults,
      ...row,
      id: row.id || defaults.id,
      timestamp: row.timestamp ? new Date(row.timestamp) : defaults.timestamp,
      expiresAt: row.expiresAt ? new Date(row.expiresAt) : undefined,
      actions: row.actions ? JSON.parse(row.actions) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : defaults.metadata,
      createdAt: row.createdAt ? new Date(row.createdAt) : defaults.createdAt,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : defaults.updatedAt,
    };
  }

  /**
   * 拡張フィルタオプションからWHERE句を作成
   * @param filter 拡張フィルタオプション
   * @returns [WHERE句の文字列, パラメータの配列]
   */
  protected buildWhereClause(filter?: NotificationFilterOptions): [string, any[]] {
    if (!filter) {
      return ['', []];
    }

    const { 
      type, 
      priority, 
      status, 
      source, 
      fromDate, 
      toDate,
      expiresAfter,
      expiresBefore,
      search,
      ...standardFilter 
    } = filter;

    const conditions: string[] = [];
    const params: any[] = [];

    // 標準フィルタの処理
    const [standardWhere, standardParams] = super.buildWhereClause(standardFilter);
    if (standardWhere) {
      conditions.push(standardWhere.replace('WHERE ', ''));
      params.push(...standardParams);
    }

    // 通知固有のフィルタ
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (priority) {
      conditions.push('priority = ?');
      params.push(priority);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (source) {
      conditions.push('source = ?');
      params.push(source);
    }

    if (fromDate) {
      conditions.push('timestamp >= ?');
      params.push(fromDate.toISOString());
    }

    if (toDate) {
      conditions.push('timestamp <= ?');
      params.push(toDate.toISOString());
    }

    if (expiresAfter) {
      conditions.push('expiresAt >= ?');
      params.push(expiresAfter.toISOString());
    }

    if (expiresBefore) {
      conditions.push('expiresAt <= ?');
      params.push(expiresBefore.toISOString());
    }

    // タイトルとメッセージの検索
    if (search) {
      conditions.push('(title LIKE ? OR message LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    return [whereClause, params];
  }

  /**
   * 通知ステータスを更新する
   * @param id 通知ID
   * @param status 新しいステータス
   * @param metadata 追加のメタデータ（オプション）
   * @returns 更新された通知
   */
  async markAs(
    id: string,
    status: NotificationStatus,
    metadata?: Record<string, any>
  ): Promise<Notification> {
    const notification = await this.findById(id);
    if (!notification) {
      throw new Error(`通知が見つかりません: ID ${id}`);
    }

    // メタデータをマージ
    const updatedMetadata = {
      ...notification.metadata,
      ...metadata,
      statusHistory: [
        ...(notification.metadata.statusHistory || []),
        {
          from: notification.status,
          to: status,
          timestamp: new Date().toISOString()
        }
      ]
    };

    // ステータスと更新日時と追加メタデータを更新
    return this.update(id, { 
      status, 
      updatedAt: new Date(),
      metadata: updatedMetadata
    });
  }

  /**
   * 指定したステータスの通知を取得
   * @param status ステータス
   * @param options オプション（limit, offset）
   * @returns 通知の配列
   */
  async findByStatus(
    status: NotificationStatus,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Notification[]> {
    return this.findAll({ 
      status,
      limit: options?.limit,
      offset: options?.offset
    });
  }

  /**
   * 未読通知の数を取得
   * @param filter フィルタオプション
   * @returns 未読通知の数
   */
  async getUnreadCount(filter?: {
    types?: NotificationType[];
    priorities?: NotificationPriority[];
  }): Promise<number> {
    let conditions: string[] = [`status = '${NotificationStatus.DELIVERED}'`];
    const params: any[] = [];

    if (filter?.types && filter.types.length > 0) {
      const typePlaceholders = filter.types.map(() => '?').join(',');
      conditions.push(`type IN (${typePlaceholders})`);
      params.push(...filter.types);
    }

    if (filter?.priorities && filter.priorities.length > 0) {
      const priorityPlaceholders = filter.priorities.map(() => '?').join(',');
      conditions.push(`priority IN (${priorityPlaceholders})`);
      params.push(...filter.priorities);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
    const result = await this.queryOne(sql, params);
    return result ? result.count : 0;
  }

  /**
   * 期限切れの通知を検索
   * @returns 期限切れの通知の配列
   */
  async findExpiredNotifications(): Promise<Notification[]> {
    const now = new Date();
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE expiresAt IS NOT NULL 
      AND expiresAt <= ? 
      AND status NOT IN (?, ?)
    `;
    
    const rows = await this.query(sql, [
      now.toISOString(), 
      NotificationStatus.EXPIRED, 
      NotificationStatus.DISMISSED
    ]);
    
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * 特定のソースからの通知を検索
   * @param source 通知ソース
   * @returns 通知の配列
   */
  async findBySource(source: string): Promise<Notification[]> {
    return this.findAll({ source });
  }

  /**
   * 条件に基づいた統計情報を生成
   * @param startDate 開始日
   * @param endDate 終了日
   * @param filter フィルタ条件
   * @returns 統計情報
   */
  async getStatistics(
    startDate: Date,
    endDate: Date,
    filter?: {
      types?: NotificationType[];
      priorities?: NotificationPriority[];
      sources?: string[];
    }
  ): Promise<Record<string, any>> {
    // 条件構築
    let conditions = ['timestamp >= ? AND timestamp <= ?'];
    const params: any[] = [startDate.toISOString(), endDate.toISOString()];

    if (filter?.types && filter.types.length > 0) {
      const typePlaceholders = filter.types.map(() => '?').join(',');
      conditions.push(`type IN (${typePlaceholders})`);
      params.push(...filter.types);
    }

    if (filter?.priorities && filter.priorities.length > 0) {
      const priorityPlaceholders = filter.priorities.map(() => '?').join(',');
      conditions.push(`priority IN (${priorityPlaceholders})`);
      params.push(...filter.priorities);
    }

    if (filter?.sources && filter.sources.length > 0) {
      const sourcePlaceholders = filter.sources.map(() => '?').join(',');
      conditions.push(`source IN (${sourcePlaceholders})`);
      params.push(...filter.sources);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 合計数
    const totalSql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
    const totalResult = await this.queryOne(totalSql, params);
    const total = totalResult ? totalResult.count : 0;

    // タイプ別カウント
    const byTypeSql = `
      SELECT type, COUNT(*) as count 
      FROM ${this.tableName} 
      ${whereClause} 
      GROUP BY type
    `;
    const byTypeResults = await this.query(byTypeSql, params);
    const byType: Record<string, number> = {};
    byTypeResults.forEach(row => {
      byType[row.type] = row.count;
    });

    // 優先度別カウント
    const byPrioritySql = `
      SELECT priority, COUNT(*) as count 
      FROM ${this.tableName} 
      ${whereClause} 
      GROUP BY priority
    `;
    const byPriorityResults = await this.query(byPrioritySql, params);
    const byPriority: Record<string, number> = {};
    byPriorityResults.forEach(row => {
      byPriority[row.priority] = row.count;
    });

    // ステータス別カウント
    const byStatusSql = `
      SELECT status, COUNT(*) as count 
      FROM ${this.tableName} 
      ${whereClause} 
      GROUP BY status
    `;
    const byStatusResults = await this.query(byStatusSql, params);
    const byStatus: Record<string, number> = {};
    byStatusResults.forEach(row => {
      byStatus[row.status] = row.count;
    });

    return {
      period: {
        start: startDate,
        end: endDate
      },
      total,
      byType,
      byPriority,
      byStatus
    };
  }

  // 通知テンプレート関連のメソッド
  // テンプレートは別テーブルで管理するため、実際のプロダクションコードでは別のリポジトリに分離することも検討
  
  /**
   * 通知テンプレートを作成
   * @param template 作成するテンプレート
   * @returns 作成されたテンプレート
   */
  async createTemplate(template: Omit<NotificationTemplate, 'id'>): Promise<NotificationTemplate> {
    // テンプレート用のテーブルに保存する実装
    // この実装は簡略化のため省略
    throw new Error('テンプレート機能は未実装です');
  }

  /**
   * 通知テンプレートを更新
   * @param id テンプレートID
   * @param template 更新するテンプレート情報
   * @returns 更新されたテンプレート
   */
  async updateTemplate(id: string, template: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    // 実際の実装では、テンプレート用のテーブルを更新する
    throw new Error('テンプレート機能は未実装です');
  }

  /**
   * 通知テンプレートを削除
   * @param id テンプレートID
   */
  async deleteTemplate(id: string): Promise<void> {
    // 実際の実装では、テンプレート用のテーブルからレコードを削除する
    throw new Error('テンプレート機能は未実装です');
  }

  /**
   * テンプレートIDによるテンプレートの検索
   * @param id テンプレートID
   * @returns テンプレート
   */
  async findTemplateById(id: string): Promise<NotificationTemplate | null> {
    // 実際の実装では、テンプレート用のテーブルからレコードを取得する
    throw new Error('テンプレート機能は未実装です');
  }
}
