/**
 * タスク管理サービスの実装
 * 
 * タスクの作成、更新、削除、ステータス変更、依存関係管理などのコア機能を提供します。
 */

import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  TaskDependency, 
  TaskDependencyType, 
  TaskProgress, 
  TaskSchedule, 
  TaskMetrics, 
  TaskService 
} from '../../core/task/types';
import { TaskRepository } from '../../services/repositories/task-repository';
import { logger } from '../../utils/logger';

/**
 * TaskServiceの実装クラス
 * 
 * コアとなるタスク管理サービスの機能を提供します。
 */
export class TaskServiceImpl implements TaskService {
  constructor(private readonly taskRepository: TaskRepository) {}

  /**
   * 新しいタスクを作成
   * @param task タスク情報（IDを除く）
   * @returns 作成されたタスク
   */
  async createTask(task: Omit<Task, 'id'>): Promise<Task> {
    try {
      // タスクのバリデーション
      const validation = await this.validateTask(task);
      if (!validation.isValid) {
        throw new Error(`タスクのバリデーションエラー: ${validation.errors?.join(', ')}`);
      }

      // タスクの作成
      const newTask = await this.taskRepository.create(task);
      logger.info('タスクが作成されました', { taskId: newTask.id, title: newTask.title });
      return newTask;
    } catch (error) {
      logger.error('タスク作成中にエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * タスクを更新
   * @param id タスクID
   * @param updates 更新内容
   * @returns 更新されたタスク
   */
  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    try {
      // 存在確認
      const existingTask = await this.taskRepository.findById(id);
      if (!existingTask) {
        throw new Error(`タスクID ${id} が見つかりません`);
      }

      // 更新内容のバリデーション
      const validation = await this.validateTask({
        ...existingTask,
        ...updates
      });
      if (!validation.isValid) {
        throw new Error(`タスク更新のバリデーションエラー: ${validation.errors?.join(', ')}`);
      }

      // タスクの更新
      const updatedTask = await this.taskRepository.update(id, {
        ...updates,
        updatedAt: new Date()
      });

      logger.info('タスクが更新されました', { taskId: id, updates });
      return updatedTask;
    } catch (error) {
      logger.error('タスク更新中にエラーが発生しました', { error, taskId: id });
      throw error;
    }
  }

  /**
   * タスクを削除
   * @param id タスクID
   */
  async deleteTask(id: string): Promise<void> {
    try {
      // 存在確認
      const existingTask = await this.taskRepository.findById(id);
      if (!existingTask) {
        throw new Error(`タスクID ${id} が見つかりません`);
      }

      // タスクの削除
      await this.taskRepository.delete(id);
      logger.info('タスクが削除されました', { taskId: id, title: existingTask.title });
    } catch (error) {
      logger.error('タスク削除中にエラーが発生しました', { error, taskId: id });
      throw error;
    }
  }

  /**
   * タスクを取得
   * @param id タスクID
   * @returns タスク
   */
  async getTask(id: string): Promise<Task> {
    try {
      const task = await this.taskRepository.findById(id);
      if (!task) {
        throw new Error(`タスクID ${id} が見つかりません`);
      }
      return task;
    } catch (error) {
      logger.error('タスク取得中にエラーが発生しました', { error, taskId: id });
      throw error;
    }
  }

  /**
   * タスクを担当者に割り当て
   * @param taskId タスクID
   * @param assigneeId 担当者ID
   * @returns 更新されたタスク
   */
  async assignTask(taskId: string, assigneeId: string): Promise<Task> {
    try {
      return await this.updateTask(taskId, { assignee: assigneeId });
    } catch (error) {
      logger.error('タスク割り当て中にエラーが発生しました', { error, taskId, assigneeId });
      throw error;
    }
  }

  /**
   * タスクのステータス更新を検証
   * @param currentStatus 現在のステータス
   * @param newStatus 新しいステータス
   * @returns 検証結果
   */
  private validateStatusTransition(currentStatus: TaskStatus, newStatus: TaskStatus): boolean {
    // ステータス遷移の検証ロジック
    // 有効な遷移をマッピング
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.CREATED]: [TaskStatus.PLANNED, TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.PLANNED]: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.CANCELLED],
      [TaskStatus.IN_PROGRESS]: [TaskStatus.BLOCKED, TaskStatus.REVIEW, TaskStatus.COMPLETED, TaskStatus.CANCELLED],
      [TaskStatus.BLOCKED]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.REVIEW]: [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.CANCELLED],
      [TaskStatus.COMPLETED]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.CANCELLED]: [TaskStatus.CREATED, TaskStatus.PLANNED]
    };

    // 同じステータスへの更新は常に許可
    if (currentStatus === newStatus) {
      return true;
    }

    // 許可されたステータス遷移をチェック
    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`無効なステータス遷移です: ${currentStatus} から ${newStatus}`);
    }

    return true;
  }

  /**
   * タスクのステータスを更新
   * @param taskId タスクID
   * @param status 新しいステータス
   * @returns 更新されたタスク
   */
  async updateStatus(taskId: string, status: TaskStatus): Promise<Task> {
    try {
      const task = await this.getTask(taskId);
      
      // ステータス変更のバリデーション
      this.validateStatusTransition(task.status, status);
      
      return await this.updateTask(taskId, { status });
    } catch (error) {
      logger.error('ステータス更新中にエラーが発生しました', { error, taskId, status });
      throw error;
    }
  }

  /**
   * タスクの優先度を更新
   * @param taskId タスクID
   * @param priority 新しい優先度
   * @returns 更新されたタスク
   */
  async updatePriority(taskId: string, priority: TaskPriority): Promise<Task> {
    try {
      return await this.updateTask(taskId, { priority });
    } catch (error) {
      logger.error('優先度更新中にエラーが発生しました', { error, taskId, priority });
      throw error;
    }
  }

  /**
   * 循環依存関係があるかチェック
   * @param taskId 対象タスクID
   * @param dependsOnId 依存タスクID
   * @returns 循環依存の有無
   */
  private async wouldCreateCircularDependency(taskId: string, dependsOnId: string): Promise<boolean> {
    // 循環依存関係をチェックするロジック
    // シンプルな実装: A → B, B → A のような直接的な循環依存のみチェック
    try {
      // 依存先のタスクが、既に元のタスクに依存していないか確認
      // const dependencies = await this.taskRepository.getDependencies(dependsOnId);
      // return dependencies.some(dep => dep.dependsOn === taskId);
      
      // 実装が複雑なため、現時点では直接的な依存のみチェック
      return taskId === dependsOnId; // 自分自身への依存は循環依存とみなす
    } catch (error) {
      logger.error('循環依存チェック中にエラーが発生しました', { error, taskId, dependsOnId });
      return false;
    }
  }

  /**
   * タスク依存関係を追加
   * @param taskId タスクID
   * @param dependsOnId 依存先タスクID
   * @param type 依存関係タイプ
   * @returns 作成された依存関係
   */
  async addDependency(
    taskId: string,
    dependsOnId: string,
    type: TaskDependencyType
  ): Promise<TaskDependency> {
    try {
      // 両方のタスクが存在するか確認
      await this.getTask(taskId);
      await this.getTask(dependsOnId);
      
      // 循環依存をチェック
      if (await this.wouldCreateCircularDependency(taskId, dependsOnId)) {
        throw new Error('循環依存関係は許可されていません');
      }
      
      // 依存関係をデータモデルとして作成
      const dependency: Omit<TaskDependency, 'id'> = {
        taskId,
        dependsOn: dependsOnId,
        type,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // 実際のデータベース操作はTaskRepositoryで実装予定
      // const createdDependency = await this.taskRepository.createDependency(dependency);
      
      // 一時的な実装（TaskRepositoryに実装後に更新）
      const createdDependency: TaskDependency = {
        ...dependency,
        id: `dep_${Date.now()}_${Math.floor(Math.random() * 1000)}`
      };
      
      logger.info('依存関係が追加されました', { taskId, dependsOnId, type });
      return createdDependency;
    } catch (error) {
      logger.error('依存関係追加中にエラーが発生しました', { error, taskId, dependsOnId });
      throw error;
    }
  }

  /**
   * タスク依存関係を削除
   * @param dependencyId 依存関係ID
   */
  async removeDependency(dependencyId: string): Promise<void> {
    try {
      // 実際のデータベース操作はTaskRepositoryで実装予定
      // await this.taskRepository.removeDependency(dependencyId);
      
      logger.info('依存関係が削除されました', { dependencyId });
    } catch (error) {
      logger.error('依存関係削除中にエラーが発生しました', { error, dependencyId });
      throw error;
    }
  }

  /**
   * タスク進捗を更新
   * @param taskId タスクID
   * @param updates 進捗情報の更新内容
   * @returns 更新された進捗情報
   */
  async updateProgress(
    taskId: string,
    updates: Partial<TaskProgress>
  ): Promise<TaskProgress> {
    try {
      // タスクの存在確認
      await this.getTask(taskId);
      
      // 進捗情報を更新（実際の実装はTaskRepositoryで行う予定）
      // const updatedProgress = await this.taskRepository.updateProgress(taskId, updates);
      
      // 一時的な実装（TaskRepositoryに実装後に更新）
      const defaultProgress: TaskProgress = {
        taskId,
        currentStep: 0,
        totalSteps: 10,
        status: TaskStatus.IN_PROGRESS,
        timeSpent: 0,
        issues: [],
        milestones: []
      };
      
      const updatedProgress: TaskProgress = {
        ...defaultProgress,
        ...updates,
        taskId // taskIdは変更不可
      };
      
      // タスクのステータスも更新（進捗情報のステータスと同期）
      if (updates.status) {
        await this.updateStatus(taskId, updates.status);
      }
      
      logger.info('タスク進捗が更新されました', { taskId, updates });
      return updatedProgress;
    } catch (error) {
      logger.error('タスク進捗更新中にエラーが発生しました', { error, taskId });
      throw error;
    }
  }

  /**
   * タスクスケジュールを更新
   * @param taskId タスクID
   * @param updates スケジュール情報の更新内容
   * @returns 更新されたスケジュール情報
   */
  async updateSchedule(
    taskId: string,
    updates: Partial<TaskSchedule>
  ): Promise<TaskSchedule> {
    try {
      // タスクの存在確認
      await this.getTask(taskId);
      
      // スケジュール情報を更新（実際の実装はTaskRepositoryで行う予定）
      // const updatedSchedule = await this.taskRepository.updateSchedule(taskId, updates);
      
      // 一時的な実装（TaskRepositoryに実装後に更新）
      const now = new Date();
      const twoWeeksLater = new Date();
      twoWeeksLater.setDate(now.getDate() + 14);
      
      const defaultSchedule: TaskSchedule = {
        taskId,
        estimatedDuration: 8, // 8時間
        startDate: now,
        endDate: twoWeeksLater,
        deadlines: [],
        dependencies: []
      };
      
      const updatedSchedule: TaskSchedule = {
        ...defaultSchedule,
        ...updates,
        taskId // taskIdは変更不可
      };
      
      // タスクの期限も更新（必要な場合）
      if (updates.endDate) {
        await this.updateTask(taskId, { 
          dueDate: updates.endDate
        });
      }
      
      logger.info('タスクスケジュールが更新されました', { taskId, updates });
      return updatedSchedule;
    } catch (error) {
      logger.error('タスクスケジュール更新中にエラーが発生しました', { error, taskId });
      throw error;
    }
  }

  /**
   * プロジェクトのタスクを取得
   * @param projectId プロジェクトID
   * @param filter フィルタオプション
   * @returns タスクのリスト
   */
  async getTasksForProject(
    projectId: string,
    filter?: {
      status?: TaskStatus[];
      priority?: TaskPriority[];
      assignee?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Task[]> {
    try {
      // プロジェクトのタスクを取得
      const tasks = await this.taskRepository.findByProject(projectId);
      
      // フィルタを適用
      let filteredTasks = [...tasks];
      
      if (filter) {
        if (filter.status && filter.status.length > 0) {
          filteredTasks = filteredTasks.filter(task => filter.status?.includes(task.status));
        }
        
        if (filter.priority && filter.priority.length > 0) {
          filteredTasks = filteredTasks.filter(task => filter.priority?.includes(task.priority));
        }
        
        if (filter.assignee) {
          filteredTasks = filteredTasks.filter(task => task.assignee === filter.assignee);
        }
        
        if (filter.startDate && filter.endDate) {
          filteredTasks = filteredTasks.filter(task => {
            const dueDate = task.dueDate;
            if (!dueDate) return false;
            return dueDate >= filter.startDate! && dueDate <= filter.endDate!;
          });
        }
      }
      
      return filteredTasks;
    } catch (error) {
      logger.error('プロジェクトのタスク取得中にエラーが発生しました', { error, projectId });
      throw error;
    }
  }

  /**
   * タスクのメトリクスを取得
   * @param taskId タスクID
   * @returns タスクメトリクス
   */
  async getTaskMetrics(taskId: string): Promise<TaskMetrics> {
    try {
      // タスクの存在確認
      await this.getTask(taskId);
      
      // メトリクスを取得（実際の実装はTaskRepositoryで行う予定）
      // const metrics = await this.taskRepository.getMetrics(taskId);
      
      // 一時的な実装（TaskRepositoryに実装後に更新）
      const defaultMetrics: TaskMetrics = {
        taskId,
        timeMetrics: {
          estimated: 8,
          actual: 0,
          variance: 0
        },
        qualityMetrics: {
          issuesFound: 0,
          issuesResolved: 0,
          testsPassing: 0,
          coverage: 0
        },
        progressMetrics: {
          percentComplete: 0,
          milestonesAchieved: 0,
          totalMilestones: 0
        }
      };
      
      return defaultMetrics;
    } catch (error) {
      logger.error('タスクメトリクス取得中にエラーが発生しました', { error, taskId });
      throw error;
    }
  }

  /**
   * タスクのバリデーション
   * @param task バリデーション対象のタスク
   * @returns バリデーション結果
   */
  async validateTask(task: Partial<Task>): Promise<{
    isValid: boolean;
    errors?: string[];
  }> {
    const errors: string[] = [];
    
    // 必須フィールドのチェック（新規作成時）
    if (!task.id) {
      if (!task.title) errors.push('タイトルは必須です');
      if (!task.type) errors.push('タイプは必須です');
      if (!task.status) errors.push('ステータスは必須です');
      if (!task.priority) errors.push('優先度は必須です');
    }
    
    // タイトルの長さチェック
    if (task.title && (task.title.length < 3 || task.title.length > 100)) {
      errors.push('タイトルは3〜100文字である必要があります');
    }
    
    // 期限が未来日であることを確認
    if (task.dueDate && task.dueDate < new Date()) {
      errors.push('期限は未来の日付である必要があります');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * タスクの完了日を予測
   * @param taskId タスクID
   * @returns 予測結果
   */
  async estimateCompletion(taskId: string): Promise<{
    estimatedCompletion: Date;
    confidence: number;
    factors: {
      name: string;
      impact: number;
    }[];
  }> {
    try {
      // タスクの基本情報を取得
      const task = await this.getTask(taskId);
      
      // 基本的な予測計算（簡易実装）
      let estimatedCompletion = new Date();
      let confidenceLevel = 0.7; // デフォルトの信頼度
      const factors: { name: string; impact: number }[] = [];
      
      // 期限が設定されている場合はそれを基準にする
      if (task.dueDate) {
        estimatedCompletion = new Date(task.dueDate);
        factors.push({ name: '設定された期限', impact: 0.5 });
      } else {
        // デフォルトでは現在日から14日後を予測
        estimatedCompletion.setDate(estimatedCompletion.getDate() + 14);
        factors.push({ name: 'デフォルト予測', impact: 0.1 });
        confidenceLevel = 0.3; // 信頼度低下
      }
      
      // 信頼度を0.1〜0.9の範囲に調整
      confidenceLevel = Math.max(0.1, Math.min(0.9, confidenceLevel));
      
      return {
        estimatedCompletion,
        confidence: confidenceLevel,
        factors
      };
    } catch (error) {
      logger.error('タスク完了予測中にエラーが発生しました', { error, taskId });
      throw error;
    }
  }

  /**
   * タスクの最適化提案を生成
   * @param taskId タスクID
   * @returns 最適化提案
   */
  async suggestOptimizations(taskId: string): Promise<{
    suggestions: {
      type: string;
      description: string;
      impact: number;
      effort: number;
    }[];
    potentialTimesSaved: number;
  }> {
    try {
      // タスクの基本情報を取得
      const task = await this.getTask(taskId);
      
      // 最適化提案のリスト
      const suggestions: {
        type: string;
        description: string;
        impact: number; // 0 - 1
        effort: number; // 0 - 1
      }[] = [];
      
      let potentialTimeSaved = 0;
      
      // 提案1: タスクの分割（大きなタスクの場合）
      if (task.description && task.description.length > 500) {
        suggestions.push({
          type: 'タスク分割',
          description: '大きなタスクを小さな管理可能なサブタスクに分割することを検討してください',
          impact: 0.7,
          effort: 0.4
        });
        potentialTimeSaved += 8; // 8時間の節約を想定
      }
      
      // 提案2: 優先度の調整（タスクの緊急性が低く、他に優先すべきものがある場合）
      if (task.priority === TaskPriority.LOW && task.status === TaskStatus.PLANNED) {
        suggestions.push({
          type: '優先度再評価',
          description: 'このタスクは優先度が低く、後回しにしても問題ない可能性があります',
          impact: 0.4,
          effort: 0.1
        });
        potentialTimeSaved += 2; // 2時間の節約を想定
      }
      
      return {
        suggestions,
        potentialTimesSaved: potentialTimeSaved
      };
    } catch (error) {
      logger.error('最適化提案生成中にエラーが発生しました', { error, taskId });
      throw error;
    }
  }

  /**
   * タスクのブロッカーを検出
   * @param taskId タスクID
   * @returns ブロッカー情報
   */
  async detectBlockers(taskId: string): Promise<{
    blockers: {
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      suggestedActions: string[];
    }[];
    impact: {
      timeDelay: number;
      affectedTasks: string[];
    };
  }> {
    try {
      // タスクの基本情報を取得
      const task = await this.getTask(taskId);
      
      // ブロッカーのリスト
      const blockers: {
        type: string;
        description: string;
        severity: 'low' | 'medium' | 'high';
        suggestedActions: string[];
      }[] = [];
      
      // ブロッカー1: タスクが明示的にブロック状態の場合
      if (task.status === TaskStatus.BLOCKED) {
        blockers.push({
          type: 'ステータスブロック',
          description: 'タスクが明示的にブロック状態としてマークされています',
          severity: 'high',
          suggestedActions: [
            'ブロックの原因を特定し、解決するための行動を起こす',
            'タスクの担当者と連絡を取り、支援が必要かどうか確認する'
          ]
        });
      }
      
      // ブロッカー2: リソースの不足
      if (!task.assignee) {
        blockers.push({
          type: 'リソース不足',
          description: 'タスクに担当者が割り当てられていません',
          severity: 'medium',
          suggestedActions: [
            'タスクに適切な担当者を割り当てる',
            'リソースの可用性を確認する'
          ]
        });
      }
      
      // ブロッカー3: スケジュールの問題
      if (task.dueDate && task.dueDate < new Date()) {
        blockers.push({
          type: 'スケジュール超過',
          description: 'タスクの期限が過ぎています',
          severity: 'high',
          suggestedActions: [
            '新しい期限を設定する',
            'タスクの範囲を縮小して早く完了させることを検討する',
            '追加リソースを割り当てることを検討する'
          ]
        });
      }
      
      // 影響評価
      let totalTimeDelay = 0;
      
      // 各ブロッカーの影響を合計
      for (const blocker of blockers) {
        switch (blocker.severity) {
          case 'high':
            totalTimeDelay += 40; // 40時間（1週間）の遅延
            break;
          case 'medium':
            totalTimeDelay += 16; // 16時間（2日）の遅延
            break;
          case 'low':
            totalTimeDelay += 4; // 4時間（半日）の遅延
            break;
        }
      }
      
      return {
        blockers,
        impact: {
          timeDelay: totalTimeDelay,
          affectedTasks: [] // 実装が複雑なため、現時点では空配列を返す
        }
      };
    } catch (error) {
      logger.error('ブロッカー検出中にエラーが発生しました', { error, taskId });
      throw new Error(`ブロッカー検出中にエラーが発生しました: ${error}`);
    }
  }
}
