import { BaseEntity } from '../types';
import { Task } from '../task/types';

export interface Notification extends BaseEntity {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  source: string;
  timestamp: Date;
  expiresAt?: Date;
  status: NotificationStatus;
  actions?: NotificationAction[];
  metadata: Record<string, any>;
}

export enum NotificationType {
  TASK = 'TASK',
  SYSTEM = 'SYSTEM',
  ALERT = 'ALERT',
  REMINDER = 'REMINDER',
  UPDATE = 'UPDATE',
  WARNING = 'WARNING'
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  ACTED_UPON = 'ACTED_UPON',
  DISMISSED = 'DISMISSED',
  EXPIRED = 'EXPIRED'
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'button' | 'link' | 'form';
  data?: Record<string, any>;
  callback?: string;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface NotificationChannel {
  id: string;
  type: 'desktop' | 'email' | 'slack' | 'webhook';
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  conditions?: {
    types?: NotificationType[];
    priorities?: NotificationPriority[];
    sources?: string[];
  };
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  titleTemplate: string;
  messageTemplate: string;
  priority: NotificationPriority;
  defaultActions?: NotificationAction[];
  metadata?: Record<string, any>;
}

export interface NotificationPreferences {
  channels: {
    channelId: string;
    enabled: boolean;
    schedule?: {
      start: string; // HH:mm format
      end: string;
      daysOfWeek: number[];
    };
    filters?: {
      types?: NotificationType[];
      priorities?: NotificationPriority[];
      sources?: string[];
    };
  }[];
  doNotDisturb?: {
    enabled: boolean;
    start: string;
    end: string;
    exceptions?: NotificationPriority[];
  };
  grouping?: {
    enabled: boolean;
    interval: number;
    maxGroup: number;
  };
}

export interface NotificationStatistics {
  period: {
    start: Date;
    end: Date;
  };
  total: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
  byStatus: Record<NotificationStatus, number>;
  responseRates: {
    read: number;
    acted: number;
    dismissed: number;
  };
  timing: {
    averageDeliveryTime: number;
    averageResponseTime: number;
  };
  channels: {
    channelId: string;
    sent: number;
    delivered: number;
    failed: number;
  }[];
}

export interface NotificationRepository {
  create(notification: Omit<Notification, 'id'>): Promise<Notification>;
  update(id: string, notification: Partial<Notification>): Promise<Notification>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  
  markAs(
    id: string,
    status: NotificationStatus,
    metadata?: Record<string, any>
  ): Promise<Notification>;
  
  findByStatus(
    status: NotificationStatus,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Notification[]>;
  
  getUnreadCount(filter?: {
    types?: NotificationType[];
    priorities?: NotificationPriority[];
  }): Promise<number>;
  
  createTemplate(template: Omit<NotificationTemplate, 'id'>): Promise<NotificationTemplate>;
  updateTemplate(id: string, template: Partial<NotificationTemplate>): Promise<NotificationTemplate>;
  deleteTemplate(id: string): Promise<void>;
  
  getStatistics(
    startDate: Date,
    endDate: Date,
    filter?: {
      types?: NotificationType[];
      priorities?: NotificationPriority[];
      channels?: string[];
    }
  ): Promise<NotificationStatistics>;
}

export interface NotificationService {
  send(
    notification: Omit<Notification, 'id' | 'status' | 'timestamp'>,
    channels?: string[]
  ): Promise<Notification>;
  
  sendFromTemplate(
    templateId: string,
    data: Record<string, any>,
    options?: {
      channels?: string[];
      priority?: NotificationPriority;
      expiration?: Date;
    }
  ): Promise<Notification>;
  
  scheduleNotification(
    notification: Omit<Notification, 'id' | 'status' | 'timestamp'>,
    scheduleTime: Date,
    options?: {
      repeat?: {
        pattern: 'daily' | 'weekly' | 'monthly';
        interval: number;
        endDate?: Date;
      };
      channels?: string[];
    }
  ): Promise<{
    notificationId: string;
    scheduleId: string;
  }>;
  
  updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences>;
  
  getNotifications(
    filter?: {
      status?: NotificationStatus[];
      types?: NotificationType[];
      priorities?: NotificationPriority[];
      startDate?: Date;
      endDate?: Date;
    },
    options?: {
      limit?: number;
      offset?: number;
      sort?: 'asc' | 'desc';
    }
  ): Promise<{
    notifications: Notification[];
    total: number;
    unread: number;
  }>;
  
  handleAction(
    notificationId: string,
    actionId: string,
    data?: Record<string, any>
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }>;
  
  registerChannel(
    channel: Omit<NotificationChannel, 'id'>
  ): Promise<NotificationChannel>;
  
  testChannel(
    channelId: string,
    testMessage?: string
  ): Promise<{
    success: boolean;
    delivered: boolean;
    error?: string;
    metadata?: Record<string, any>;
  }>;
  
  getDeliveryStatus(
    notificationId: string
  ): Promise<{
    status: NotificationStatus;
    channels: {
      channelId: string;
      status: 'pending' | 'delivered' | 'failed';
      timestamp?: Date;
      error?: string;
    }[];
  }>;
}
