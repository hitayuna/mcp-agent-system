/**
 * タスクリポジトリの実装
 * 
 * タスク関連のデータアクセスを提供します。
 */

import { Task, TaskStatus, TaskType, TaskPriority } from '../../core/task/types';
import { Repository, FilterOptions } from '../../core/repository/repository.interface';
import { BaseSQLiteRepository } from '../database/sqlite/base-repository';

export interface TaskFilterOptions extends FilterOptions {
  status?: TaskStatus;
  type?: TaskType;
  priority?: TaskPriority;
  assignee?: string;
  project?: string;
  dueDateStart?: Date;
  dueDateEnd?: Date;
  search?: string;
}

export class TaskRepository extends BaseSQLiteRepository<Task, string> {
  protected tableName = 'tasks';
  protected primaryKey = 'id';

  /**
   * エンティティをテーブル行に変換
   * @param task タスクエンティティ
   * @returns テーブル行オブジェクト
   */
  protected entityToRow(task: Task): Record<string, any> {
    return {
      ...task,
      metadata: task.metadata ? JSON.stringify(task.metadata) : null,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      createdAt: task.createdAt ? task.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * テーブル行をエンティティに変換
   * @param row テーブル行
   * @returns タスクエンティティ
   */
  protected rowToEntity(row: Record<string, any>): Task {
    // 必須フィールドのデフォルト値
    const defaults = {
      id: '',  // IDは必須フィールド
      title: '無題タスク',
      description: '',
      type: TaskType.DEVELOPMENT,
      status: TaskStatus.CREATED,
      priority: TaskPriority.MEDIUM,
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
      id: row.id || defaults.id, // IDが必ず含まれるようにする
      metadata: row.metadata ? JSON.parse(row.metadata) : defaults.metadata,
      dueDate: row.dueDate ? new Date(row.dueDate) : undefined,
      createdAt: row.createdAt ? new Date(row.createdAt) : defaults.createdAt,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : defaults.updatedAt,
    };
  }

  /**
   * 拡張フィルタオプションからWHERE句を作成
   * @param filter 拡張フィルタオプション
   * @returns [WHERE句の文字列, パラメータの配列]
   */
  protected buildWhereClause(filter?: TaskFilterOptions): [string, any[]] {
    if (!filter) {
      return ['', []];
    }

    const { 
      status, 
      type, 
      priority, 
      assignee, 
      project, 
      dueDateStart, 
      dueDateEnd,
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

    // タスク固有のフィルタ
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (priority) {
      conditions.push('priority = ?');
      params.push(priority);
    }

    if (assignee) {
      conditions.push('assignee = ?');
      params.push(assignee);
    }

    if (project) {
      conditions.push('project = ?');
      params.push(project);
    }

    // 期日範囲
    if (dueDateStart) {
      conditions.push('dueDate >= ?');
      params.push(dueDateStart.toISOString());
    }

    if (dueDateEnd) {
      conditions.push('dueDate <= ?');
      params.push(dueDateEnd.toISOString());
    }

    // 検索（タイトルと説明）
    if (search) {
      conditions.push('(title LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    return [whereClause, params];
  }

  /**
   * ステータスでタスクを検索
   * @param status タスクステータス
   * @returns タスクの配列
   */
  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return this.findAll({ status });
  }

  /**
   * 担当者でタスクを検索
   * @param assignee 担当者ID
   * @returns タスクの配列
   */
  async findByAssignee(assignee: string): Promise<Task[]> {
    return this.findAll({ assignee });
  }

  /**
   * プロジェクトでタスクを検索
   * @param project プロジェクトID
   * @returns タスクの配列
   */
  async findByProject(project: string): Promise<Task[]> {
    return this.findAll({ project });
  }

  /**
   * 期日範囲でタスクを検索
   * @param startDate 開始日
   * @param endDate 終了日
   * @returns タスクの配列
   */
  async findByDueDate(startDate: Date, endDate: Date): Promise<Task[]> {
    return this.findAll({
      dueDateStart: startDate,
      dueDateEnd: endDate
    });
  }

  /**
   * プロジェクトのタスクをフィルタ条件で検索
   * @param projectId プロジェクトID
   * @param filter フィルタオプション
   * @returns タスクの配列
   */
  async findByProjectWithFilter(
    projectId: string,
    filter?: {
      status?: TaskStatus[];
      priority?: TaskPriority[];
      assignee?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Task[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    conditions.push('project = ?');
    params.push(projectId);

    if (filter?.status && filter.status.length > 0) {
      const statusPlaceholders = filter.status.map(() => '?').join(', ');
      conditions.push(`status IN (${statusPlaceholders})`);
      params.push(...filter.status);
    }

    if (filter?.priority && filter.priority.length > 0) {
      const priorityPlaceholders = filter.priority.map(() => '?').join(', ');
      conditions.push(`priority IN (${priorityPlaceholders})`);
      params.push(...filter.priority);
    }

    if (filter?.assignee) {
      conditions.push('assignee = ?');
      params.push(filter.assignee);
    }

    if (filter?.startDate) {
      conditions.push('dueDate >= ?');
      params.push(filter.startDate.toISOString());
    }

    if (filter?.endDate) {
      conditions.push('dueDate <= ?');
      params.push(filter.endDate.toISOString());
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    
    const sql = `SELECT * FROM ${this.tableName} ${whereClause}`;
    const rows = await this.query(sql, params);
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * タイトルまたは説明にキーワードを含むタスクを検索
   * @param keyword 検索キーワード
   * @returns タスクの配列
   */
  async searchByKeyword(keyword: string): Promise<Task[]> {
    return this.findAll({ search: keyword });
  }

  /**
   * 進行中のタスクで期限切れまたは期限間近のものを検索
   * @param daysThreshold 期限までの日数のしきい値
   * @returns タスクの配列
   */
  async findUpcomingDeadlines(daysThreshold: number = 3): Promise<Task[]> {
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(now.getDate() + daysThreshold);
    
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE status = ? 
      AND dueDate IS NOT NULL 
      AND dueDate <= ? 
      ORDER BY dueDate ASC
    `;
    
    const rows = await this.query(sql, [TaskStatus.IN_PROGRESS, threshold.toISOString()]);
    return rows.map(row => this.rowToEntity(row));
  }
}
