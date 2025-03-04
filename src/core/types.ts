export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project extends BaseEntity {
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: Date;
  endDate: Date | null;
  owner: string;
  members: string[];
  metadata: Record<string, any>;
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface User extends BaseEntity {
  name: string;
  email: string;
  role: UserRole;
  preferences: UserPreferences;
  settings: Record<string, any>;
  metadata: Record<string, any>;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  VIEWER = 'VIEWER'
}

export interface UserPreferences {
  notifications: {
    email: boolean;
    desktop: boolean;
    mobile: boolean;
  };
  theme: {
    mode: 'light' | 'dark';
    color: string;
  };
  language: string;
  timezone: string;
}

export interface SystemConfig {
  version: string;
  environment: string;
  features: Record<string, boolean>;
  limits: {
    maxProjects: number;
    maxUsersPerProject: number;
    maxTasksPerProject: number;
    maxMemorySize: number;
  };
  security: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    passwordPolicy: {
      minLength: number;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
  };
  ai: {
    models: string[];
    defaultModel: string;
    maxTokens: number;
    temperature: number;
  };
  storage: {
    type: string;
    path: string;
    maxSize: number;
  };
}

export interface Error {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
  timestamp: Date;
  context?: {
    user?: string;
    project?: string;
    component?: string;
    action?: string;
  };
}

export interface ValidationError extends Error {
  field: string;
  value: any;
  constraints: Record<string, string>;
}

export interface SystemEvent {
  type: SystemEventType;
  source: string;
  data: any;
  timestamp: Date;
  metadata: Record<string, any>;
}

export enum SystemEventType {
  CONFIG_UPDATED = 'SYSTEM.CONFIG_UPDATED',
  FEATURE_ENABLED = 'SYSTEM.FEATURE_ENABLED',
  FEATURE_DISABLED = 'SYSTEM.FEATURE_DISABLED',
  ERROR_OCCURRED = 'SYSTEM.ERROR_OCCURRED',
  BACKUP_CREATED = 'SYSTEM.BACKUP_CREATED',
  MAINTENANCE_STARTED = 'SYSTEM.MAINTENANCE_STARTED',
  MAINTENANCE_COMPLETED = 'SYSTEM.MAINTENANCE_COMPLETED'
}

export interface SystemHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  components: {
    [key: string]: {
      status: 'up' | 'down' | 'degraded';
      message?: string;
      metrics?: Record<string, number>;
      lastCheck: Date;
    };
  };
  metrics: {
    uptime: number;
    memory: {
      total: number;
      used: number;
      free: number;
    };
    cpu: {
      usage: number;
      load: number[];
    };
    storage: {
      total: number;
      used: number;
      free: number;
    };
  };
}

export interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, error?: Error, context?: Record<string, any>): void;
}

export interface Cache<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

export interface Queue<T> {
  enqueue(item: T): Promise<void>;
  dequeue(): Promise<T | null>;
  peek(): Promise<T | null>;
  size(): Promise<number>;
  clear(): Promise<void>;
}

export interface Lock {
  acquire(key: string, ttl: number): Promise<boolean>;
  release(key: string): Promise<void>;
  isLocked(key: string): Promise<boolean>;
}

export interface Transaction {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}
