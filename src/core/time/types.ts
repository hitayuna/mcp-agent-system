import { BaseEntity } from '../types';
import { Task } from '../task/types';

export interface TimeEntry extends BaseEntity {
  taskId?: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  category: TimeCategory;
  description: string;
  tags: string[];
  metadata: Record<string, any>;
}

export enum TimeCategory {
  DEVELOPMENT = 'DEVELOPMENT',
  MEETING = 'MEETING',
  REVIEW = 'REVIEW',
  PLANNING = 'PLANNING',
  LEARNING = 'LEARNING',
  MAINTENANCE = 'MAINTENANCE',
  BREAK = 'BREAK'
}

export interface TimeBlock {
  id: string;
  start: Date;
  end: Date;
  duration: number;
  type: TimeBlockType;
  priority: number;
  task?: Task;
  isLocked: boolean;
  recurrence?: TimeRecurrence;
}

export enum TimeBlockType {
  FOCUS = 'FOCUS',
  MEETING = 'MEETING',
  REVIEW = 'REVIEW',
  BREAK = 'BREAK',
  BUFFER = 'BUFFER'
}

export interface TimeRecurrence {
  pattern: 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek?: number[];
  endDate?: Date;
  exceptions?: Date[];
}

export interface TimeStatistics {
  period: {
    start: Date;
    end: Date;
  };
  total: number;
  byCategory: Record<TimeCategory, number>;
  byTag: Record<string, number>;
  dailyAverage: number;
  peakHours: {
    hour: number;
    productivity: number;
  }[];
  patterns: {
    type: string;
    frequency: number;
    duration: number;
  }[];
}

export interface TimePreferences {
  workingHours: {
    start: string; // HH:mm format
    end: string;
  };
  breakPreferences: {
    frequency: number; // minutes between breaks
    duration: number; // minutes
  };
  focusTime: {
    preferredDuration: number;
    preferredTimeOfDay: string[];
  };
  meetings: {
    maxPerDay: number;
    preferredDuration: number;
    bufferTime: number;
  };
  notifications: {
    beforeStart: number[];
    breakReminders: boolean;
    endOfDay: boolean;
  };
}

export interface TimeConstraint {
  id: string;
  type: 'fixed' | 'flexible';
  startTime?: Date;
  endTime?: Date;
  duration: number;
  priority: number;
  description: string;
  recurrence?: TimeRecurrence;
}

export interface TimeRepository {
  createEntry(entry: Omit<TimeEntry, 'id'>): Promise<TimeEntry>;
  updateEntry(id: string, entry: Partial<TimeEntry>): Promise<TimeEntry>;
  deleteEntry(id: string): Promise<void>;
  findById(id: string): Promise<TimeEntry | null>;
  
  createTimeBlock(block: Omit<TimeBlock, 'id'>): Promise<TimeBlock>;
  updateTimeBlock(id: string, block: Partial<TimeBlock>): Promise<TimeBlock>;
  deleteTimeBlock(id: string): Promise<void>;
  
  getTimeBlocks(
    startDate: Date,
    endDate: Date,
    filter?: {
      type?: TimeBlockType[];
      priority?: number;
    }
  ): Promise<TimeBlock[]>;
  
  getStatistics(
    startDate: Date,
    endDate: Date,
    filter?: {
      categories?: TimeCategory[];
      tags?: string[];
    }
  ): Promise<TimeStatistics>;
  
  getPreferences(): Promise<TimePreferences>;
  updatePreferences(preferences: Partial<TimePreferences>): Promise<TimePreferences>;
}

export interface TimeService {
  startTracking(
    taskId: string,
    category: TimeCategory,
    metadata?: Record<string, any>
  ): Promise<TimeEntry>;
  
  stopTracking(
    entryId: string,
    metadata?: Record<string, any>
  ): Promise<TimeEntry>;
  
  scheduleTimeBlock(
    block: Omit<TimeBlock, 'id'>,
    constraints?: TimeConstraint[]
  ): Promise<TimeBlock>;
  
  rescheduleTimeBlock(
    blockId: string,
    newStart: Date,
    constraints?: TimeConstraint[]
  ): Promise<TimeBlock>;
  
  optimizeSchedule(
    startDate: Date,
    endDate: Date,
    options?: {
      prioritizeFocus?: boolean;
      respectPreferences?: boolean;
      balanceWorkload?: boolean;
    }
  ): Promise<{
    timeBlocks: TimeBlock[];
    metrics: {
      focusTime: number;
      meetings: number;
      breaks: number;
      efficiency: number;
    };
  }>;
  
  analyzeProductivity(
    startDate: Date,
    endDate: Date
  ): Promise<{
    productiveHours: {
      hour: number;
      score: number;
    }[];
    patterns: {
      description: string;
      confidence: number;
      supporting_data: any[];
    }[];
    recommendations: {
      type: string;
      description: string;
      expected_impact: number;
    }[];
  }>;
  
  generateTimeReport(
    startDate: Date,
    endDate: Date,
    format: 'summary' | 'detailed' | 'analytics'
  ): Promise<{
    entries: TimeEntry[];
    statistics: TimeStatistics;
    insights: {
      key: string;
      description: string;
      data: any;
    }[];
  }>;
  
  handleConflicts(
    conflicts: {
      blockId: string;
      type: string;
      description: string;
    }[]
  ): Promise<{
    resolved: {
      blockId: string;
      solution: string;
    }[];
    unresolved: {
      blockId: string;
      reason: string;
    }[];
  }>;
}
