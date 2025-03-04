/**
 * 時間記録リポジトリの実装
 * 
 * 時間記録関連のデータアクセスを提供します。
 */

import { TimeEntry, TimeCategory } from '../../core/time/types';
import { Repository, FilterOptions } from '../../core/repository/repository.interface';
import { BaseSQLiteRepository } from '../database/sqlite/base-repository';

export interface TimeEntryFilterOptions extends FilterOptions {
  taskId?: string;
  startTimeFrom?: Date;
  startTimeTo?: Date;
  endTimeFrom?: Date;
  endTimeTo?: Date;
  minDuration?: number;
  maxDuration?: number;
  category?: TimeCategory;
  tags?: string[];
  search?: string;
}

export class TimeEntryRepository extends BaseSQLiteRepository<TimeEntry, string> {
  protected tableName = 'time_entries';
  protected primaryKey = 'id';

  /**
   * エンティティをテーブル行に変換
   * @param timeEntry 時間記録エンティティ
   * @returns テーブル行オブジェクト
   */
  protected entityToRow(timeEntry: TimeEntry): Record<string, any> {
    return {
      ...timeEntry,
      startTime: timeEntry.startTime.toISOString(),
      endTime: timeEntry.endTime ? timeEntry.endTime.toISOString() : null,
      tags: timeEntry.tags ? JSON.stringify(timeEntry.tags) : '[]',
      metadata: timeEntry.metadata ? JSON.stringify(timeEntry.metadata) : '{}',
      createdAt: timeEntry.createdAt ? timeEntry.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * テーブル行をエンティティに変換
   * @param row テーブル行
   * @returns 時間記録エンティティ
   */
  protected rowToEntity(row: Record<string, any>): TimeEntry {
    // 必須フィールドのデフォルト値
    const defaults = {
      id: '',
      startTime: new Date(),
      duration: 0,
      category: TimeCategory.DEVELOPMENT,
      description: '',
      tags: [],
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
      startTime: row.startTime ? new Date(row.startTime) : defaults.startTime,
      endTime: row.endTime ? new Date(row.endTime) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : defaults.tags,
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
  protected buildWhereClause(filter?: TimeEntryFilterOptions): [string, any[]] {
    if (!filter) {
      return ['', []];
    }

    const { 
      taskId, 
      startTimeFrom, 
      startTimeTo, 
      endTimeFrom, 
      endTimeTo,
      minDuration,
      maxDuration,
      category,
      tags,
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

    // 時間記録固有のフィルタ
    if (taskId) {
      conditions.push('taskId = ?');
      params.push(taskId);
    }

    if (startTimeFrom) {
      conditions.push('startTime >= ?');
      params.push(startTimeFrom.toISOString());
    }

    if (startTimeTo) {
      conditions.push('startTime <= ?');
      params.push(startTimeTo.toISOString());
    }

    if (endTimeFrom) {
      conditions.push('endTime >= ?');
      params.push(endTimeFrom.toISOString());
    }

    if (endTimeTo) {
      conditions.push('endTime <= ?');
      params.push(endTimeTo.toISOString());
    }

    if (minDuration !== undefined) {
      conditions.push('duration >= ?');
      params.push(minDuration);
    }

    if (maxDuration !== undefined) {
      conditions.push('duration <= ?');
      params.push(maxDuration);
    }

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    // タグ検索（JSONデータに部分一致）
    if (tags && tags.length > 0) {
      // SQLiteは複雑なJSON検索が得意ではないので、簡易的に実装
      // 各タグを個別に検索し、OR条件で結合
      const tagConditions = tags.map(() => 'tags LIKE ?');
      conditions.push(`(${tagConditions.join(' OR ')})`);
      
      // 各タグに対して、JSON配列内に存在するかをチェック
      params.push(...tags.map(tag => `%${tag}%`));
    }

    // 説明の検索
    if (search) {
      conditions.push('description LIKE ?');
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    return [whereClause, params];
  }

  /**
   * タスクIDによる時間記録の検索
   * @param taskId タスクID
   * @returns 時間記録の配列
   */
  async findByTaskId(taskId: string): Promise<TimeEntry[]> {
    return this.findAll({ taskId });
  }

  /**
   * 期間内の時間記録を検索
   * @param startDate 開始日時
   * @param endDate 終了日時
   * @returns 時間記録の配列
   */
  async findByTimeRange(startDate: Date, endDate: Date): Promise<TimeEntry[]> {
    return this.findAll({
      startTimeFrom: startDate,
      startTimeTo: endDate
    });
  }

  /**
   * カテゴリによる時間記録の検索
   * @param category 時間カテゴリ
   * @returns 時間記録の配列
   */
  async findByCategory(category: TimeCategory): Promise<TimeEntry[]> {
    return this.findAll({ category });
  }

  /**
   * タグによる時間記録の検索
   * @param tag タグ
   * @returns 時間記録の配列
   */
  async findByTag(tag: string): Promise<TimeEntry[]> {
    return this.findAll({ tags: [tag] });
  }

  /**
   * 現在実行中（endTimeがnull）の時間記録を検索
   * @returns 時間記録の配列
   */
  async findActiveEntries(): Promise<TimeEntry[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE endTime IS NULL`;
    const rows = await this.query(sql);
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * 特定の期間内の合計時間を集計
   * @param startDate 開始日時
   * @param endDate 終了日時
   * @param groupBy グループ化する項目（カテゴリ, タスク, 日付）
   * @returns 集計結果
   */
  async sumDurationByPeriod(
    startDate: Date,
    endDate: Date,
    groupBy: 'category' | 'taskId' | 'date' = 'category'
  ): Promise<Record<string, number>> {
    let groupByClause: string;
    let keyExtractor: (row: any) => string;

    switch (groupBy) {
      case 'category':
        groupByClause = 'category';
        keyExtractor = (row) => row.category;
        break;
      case 'taskId':
        groupByClause = 'taskId';
        keyExtractor = (row) => row.taskId || 'none';
        break;
      case 'date':
        // SQLiteでは日付操作が限定的なので、単純化
        groupByClause = "date(startTime)";
        keyExtractor = (row) => row.date;
        break;
    }

    const sql = `
      SELECT ${groupByClause} as groupKey, SUM(duration) as totalDuration
      FROM ${this.tableName}
      WHERE startTime >= ? AND startTime <= ?
      GROUP BY ${groupByClause}
    `;

    const rows = await this.query(sql, [startDate.toISOString(), endDate.toISOString()]);
    
    const result: Record<string, number> = {};
    rows.forEach(row => {
      result[keyExtractor(row)] = row.totalDuration;
    });
    
    return result;
  }
}
