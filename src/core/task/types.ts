import { BaseEntity } from '../types';

export interface Task extends BaseEntity {
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  project?: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export enum TaskType {
  DEVELOPMENT = 'DEVELOPMENT',
  REVIEW = 'REVIEW',
  TESTING = 'TESTING',
  DOCUMENTATION = 'DOCUMENTATION',
  PLANNING = 'PLANNING',
  MAINTENANCE = 'MAINTENANCE',
  SUPPORT = 'SUPPORT'
}

export enum TaskStatus {
  CREATED = 'CREATED',
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  REVIEW = 'REVIEW',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface TaskDependency extends BaseEntity {
  taskId: string;
  dependsOn: string;
  type: TaskDependencyType;
  metadata: Record<string, any>;
}

export enum TaskDependencyType {
  BLOCKS = 'BLOCKS',
  REQUIRED_BY = 'REQUIRED_BY',
  RELATES_TO = 'RELATES_TO',
  PART_OF = 'PART_OF'
}

export interface TaskProgress {
  taskId: string;
  currentStep: number;
  totalSteps: number;
  status: TaskStatus;
  completedAt?: Date;
  timeSpent: number;
  issues: {
    description: string;
    severity: 'low' | 'medium' | 'high';
    status: 'open' | 'resolved';
  }[];
  milestones: {
    name: string;
    completed: boolean;
    date?: Date;
  }[];
}

export interface TaskSchedule {
  taskId: string;
  estimatedDuration: number;
  actualDuration?: number;
  startDate: Date;
  endDate: Date;
  deadlines: {
    name: string;
    date: Date;
    met?: boolean;
  }[];
  dependencies: {
    taskId: string;
    type: TaskDependencyType;
    lag: number;
  }[];
}

export interface TaskMetrics {
  taskId: string;
  timeMetrics: {
    estimated: number;
    actual: number;
    variance: number;
  };
  qualityMetrics: {
    issuesFound: number;
    issuesResolved: number;
    testsPassing: number;
    coverage: number;
  };
  progressMetrics: {
    percentComplete: number;
    milestonesAchieved: number;
    totalMilestones: number;
  };
}

export interface TaskRepository {
  create(task: Omit<Task, 'id'>): Promise<Task>;
  update(id: string, task: Partial<Task>): Promise<Task>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Task | null>;
  
  findByStatus(status: TaskStatus): Promise<Task[]>;
  findByAssignee(assigneeId: string): Promise<Task[]>;
  findByProject(projectId: string): Promise<Task[]>;
  findByDueDate(startDate: Date, endDate: Date): Promise<Task[]>;
  
  createDependency(dependency: Omit<TaskDependency, 'id'>): Promise<TaskDependency>;
  getDependencies(taskId: string): Promise<TaskDependency[]>;
  removeDependency(dependencyId: string): Promise<void>;
  
  updateProgress(taskId: string, progress: Partial<TaskProgress>): Promise<TaskProgress>;
  getProgress(taskId: string): Promise<TaskProgress | null>;
  
  updateSchedule(taskId: string, schedule: Partial<TaskSchedule>): Promise<TaskSchedule>;
  getSchedule(taskId: string): Promise<TaskSchedule | null>;
  
  updateMetrics(taskId: string, metrics: Partial<TaskMetrics>): Promise<TaskMetrics>;
  getMetrics(taskId: string): Promise<TaskMetrics | null>;
}

export interface TaskService {
  createTask(task: Omit<Task, 'id'>): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  getTask(id: string): Promise<Task>;
  
  assignTask(taskId: string, assigneeId: string): Promise<Task>;
  updateStatus(taskId: string, status: TaskStatus): Promise<Task>;
  updatePriority(taskId: string, priority: TaskPriority): Promise<Task>;
  
  addDependency(
    taskId: string,
    dependsOnId: string,
    type: TaskDependencyType
  ): Promise<TaskDependency>;
  
  removeDependency(dependencyId: string): Promise<void>;
  
  updateProgress(
    taskId: string,
    updates: Partial<TaskProgress>
  ): Promise<TaskProgress>;
  
  updateSchedule(
    taskId: string,
    updates: Partial<TaskSchedule>
  ): Promise<TaskSchedule>;
  
  getTasksForProject(
    projectId: string,
    filter?: {
      status?: TaskStatus[];
      priority?: TaskPriority[];
      assignee?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Task[]>;
  
  getTaskMetrics(taskId: string): Promise<TaskMetrics>;
  
  validateTask(task: Partial<Task>): Promise<{
    isValid: boolean;
    errors?: string[];
  }>;
  
  estimateCompletion(taskId: string): Promise<{
    estimatedCompletion: Date;
    confidence: number;
    factors: {
      name: string;
      impact: number;
    }[];
  }>;
  
  suggestOptimizations(taskId: string): Promise<{
    suggestions: {
      type: string;
      description: string;
      impact: number;
      effort: number;
    }[];
    potentialTimesSaved: number;
  }>;
  
  detectBlockers(taskId: string): Promise<{
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
  }>;
}
