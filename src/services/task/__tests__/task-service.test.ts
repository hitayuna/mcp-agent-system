/**
 * TaskServiceの単体テスト
 */
import { TaskServiceImpl } from '../task-service';
import { TaskRepository } from '../../repositories/task-repository';
import { Task, TaskStatus, TaskType, TaskPriority } from '../../../core/task/types';
import { logger } from '../../../utils/logger';

// モック
jest.mock('../../repositories/task-repository');
jest.mock('../../../utils/logger');

describe('TaskServiceImpl', () => {
  let taskService: TaskServiceImpl;
  let mockTaskRepository: jest.Mocked<TaskRepository>;

  // テスト用のタスクサンプル
  const sampleTask: Task = {
    id: 'task-1',
    title: 'テストタスク',
    description: 'これはテスト用のタスクです',
    type: TaskType.DEVELOPMENT,
    status: TaskStatus.PLANNED,
    priority: TaskPriority.MEDIUM,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    metadata: {}
  };

  // 新規タスク作成用のデータ
  const newTaskData: Omit<Task, 'id'> = {
    title: '新しいタスク',
    description: '新しいタスクの説明',
    type: TaskType.DEVELOPMENT,
    status: TaskStatus.CREATED,
    priority: TaskPriority.HIGH,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {}
  };

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();
    
    // TaskRepositoryのモックを作成
    mockTaskRepository = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
      findByStatus: jest.fn(),
      findByAssignee: jest.fn(),
      findByProject: jest.fn(),
      findByDueDate: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      buildWhereClause: jest.fn(),
      entityToRow: jest.fn(),
      rowToEntity: jest.fn(),
      query: jest.fn()
    } as unknown as jest.Mocked<TaskRepository>;

    // TaskServiceのインスタンスを作成
    taskService = new TaskServiceImpl(mockTaskRepository);
  });

  describe('createTask', () => {
    it('タスクを正常に作成できること', async () => {
      // モックの設定
      mockTaskRepository.create.mockResolvedValue({
        ...newTaskData,
        id: 'new-task-id'
      });

      // メソッドの実行
      const result = await taskService.createTask(newTaskData);

      // 検証
      expect(mockTaskRepository.create).toHaveBeenCalledWith(newTaskData);
      expect(result).toEqual({
        ...newTaskData,
        id: 'new-task-id'
      });
      expect(logger.info).toHaveBeenCalled();
    });

    it('バリデーションエラー時に例外をスローすること', async () => {
      // 無効なタスクデータ（タイトルなし）
      const invalidTask = { ...newTaskData, title: '' };

      // メソッドの実行と検証
      await expect(taskService.createTask(invalidTask)).rejects.toThrow();
      expect(mockTaskRepository.create).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getTask', () => {
    it('指定IDのタスクを正常に取得できること', async () => {
      // モックの設定
      mockTaskRepository.findById.mockResolvedValue(sampleTask);

      // メソッドの実行
      const result = await taskService.getTask('task-1');

      // 検証
      expect(mockTaskRepository.findById).toHaveBeenCalledWith('task-1');
      expect(result).toEqual(sampleTask);
    });

    it('存在しないタスクIDの場合に例外をスローすること', async () => {
      // モックの設定
      mockTaskRepository.findById.mockResolvedValue(null);

      // メソッドの実行と検証
      await expect(taskService.getTask('non-existent-id')).rejects.toThrow();
      expect(mockTaskRepository.findById).toHaveBeenCalledWith('non-existent-id');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('updateTask', () => {
    it('タスクを正常に更新できること', async () => {
      // モックの設定
      mockTaskRepository.findById.mockResolvedValue(sampleTask);
      const updatedTask = {
        ...sampleTask,
        title: '更新されたタイトル',
        updatedAt: new Date()
      };
      mockTaskRepository.update.mockResolvedValue(updatedTask);

      // メソッドの実行
      const result = await taskService.updateTask('task-1', { title: '更新されたタイトル' });

      // 検証
      expect(mockTaskRepository.findById).toHaveBeenCalledWith('task-1');
      expect(mockTaskRepository.update).toHaveBeenCalled();
      expect(result).toEqual(updatedTask);
      expect(logger.info).toHaveBeenCalled();
    });

    it('存在しないタスクの更新の場合に例外をスローすること', async () => {
      // モックの設定
      mockTaskRepository.findById.mockResolvedValue(null);

      // メソッドの実行と検証
      await expect(taskService.updateTask('non-existent-id', { title: '更新' })).rejects.toThrow();
      expect(mockTaskRepository.findById).toHaveBeenCalledWith('non-existent-id');
      expect(mockTaskRepository.update).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteTask', () => {
    it('タスクを正常に削除できること', async () => {
      // モックの設定
      mockTaskRepository.findById.mockResolvedValue(sampleTask);
      mockTaskRepository.delete.mockResolvedValue();

      // メソッドの実行
      await taskService.deleteTask('task-1');

      // 検証
      expect(mockTaskRepository.findById).toHaveBeenCalledWith('task-1');
      expect(mockTaskRepository.delete).toHaveBeenCalledWith('task-1');
      expect(logger.info).toHaveBeenCalled();
    });

    it('存在しないタスクの削除の場合に例外をスローすること', async () => {
      // モックの設定
      mockTaskRepository.findById.mockResolvedValue(null);

      // メソッドの実行と検証
      await expect(taskService.deleteTask('non-existent-id')).rejects.toThrow();
      expect(mockTaskRepository.findById).toHaveBeenCalledWith('non-existent-id');
      expect(mockTaskRepository.delete).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('タスクのステータスを正常に更新できること', async () => {
      // モックの設定
      mockTaskRepository.findById.mockResolvedValue(sampleTask);
      const updatedTask = {
        ...sampleTask,
        status: TaskStatus.IN_PROGRESS,
        updatedAt: new Date()
      };
      mockTaskRepository.update.mockResolvedValue(updatedTask);

      // メソッドの実行
      const result = await taskService.updateStatus('task-1', TaskStatus.IN_PROGRESS);

      // 検証
      expect(mockTaskRepository.findById).toHaveBeenCalledWith('task-1');
      expect(mockTaskRepository.update).toHaveBeenCalled();
      expect(result).toEqual(updatedTask);
    });

    it('無効なステータス遷移の場合に例外をスローすること', async () => {
      // モックの設定
      const currentTask = {
        ...sampleTask,
        status: TaskStatus.CREATED
      };
      mockTaskRepository.findById.mockResolvedValue(currentTask);

      // CREATED → REVIEW は無効な遷移
      await expect(taskService.updateStatus('task-1', TaskStatus.REVIEW)).rejects.toThrow();
      expect(mockTaskRepository.findById).toHaveBeenCalledWith('task-1');
      expect(mockTaskRepository.update).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getTasksForProject', () => {
    it('プロジェクトのタスクを正常に取得できること', async () => {
      // モックの設定
      const projectTasks = [
        { ...sampleTask, id: 'task-1', project: 'project-1' },
        { ...sampleTask, id: 'task-2', project: 'project-1' }
      ];
      mockTaskRepository.findByProject.mockResolvedValue(projectTasks);

      // メソッドの実行
      const result = await taskService.getTasksForProject('project-1');

      // 検証
      expect(mockTaskRepository.findByProject).toHaveBeenCalledWith('project-1');
      expect(result).toEqual(projectTasks);
    });

    it('フィルタを適用してプロジェクトのタスクを取得できること', async () => {
      // モックの設定
      const projectTasks = [
        { ...sampleTask, id: 'task-1', project: 'project-1', status: TaskStatus.IN_PROGRESS, assignee: 'user-1' },
        { ...sampleTask, id: 'task-2', project: 'project-1', status: TaskStatus.COMPLETED, assignee: 'user-2' },
        { ...sampleTask, id: 'task-3', project: 'project-1', status: TaskStatus.IN_PROGRESS, assignee: 'user-2' }
      ];
      mockTaskRepository.findByProject.mockResolvedValue(projectTasks);

      // フィルタを設定
      const filter = {
        status: [TaskStatus.IN_PROGRESS],
        assignee: 'user-2'
      };

      // メソッドの実行
      const result = await taskService.getTasksForProject('project-1', filter);

      // 検証
      expect(mockTaskRepository.findByProject).toHaveBeenCalledWith('project-1');
      // フィルタリング後は1件のみ（task-3）が残るはず
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-3');
    });
  });

  describe('validateTask', () => {
    it('有効なタスクを正常に検証できること', async () => {
      // メソッドの実行
      const result = await taskService.validateTask(newTaskData);

      // 検証
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('必須フィールドが不足している場合にエラーを返すこと', async () => {
      // 不完全なタスクデータ
      const invalidTask = {
        description: '説明のみのタスク'
        // title, type, status, priorityが欠けている
      };

      // メソッドの実行
      const result = await taskService.validateTask(invalidTask);

      // 検証
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('過去の期限日の場合にエラーを返すこと', async () => {
      // 過去の期限を持つタスク
      const pastDueTask = {
        ...newTaskData,
        dueDate: new Date('2020-01-01') // 過去の日付
      };

      // モックを適用（現在日を固定）
      const realDateNow = Date.now.bind(global.Date);
      global.Date.now = jest.fn(() => new Date('2025-01-01').getTime());

      // メソッドの実行
      const result = await taskService.validateTask(pastDueTask);

      // モックをリストア
      global.Date.now = realDateNow;

      // 検証
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some(error => error.includes('期限'))).toBe(true);
    });
  });
});
