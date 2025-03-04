import { BaseEntity } from '../types';
import { AIModelType } from '../ai/types';
import { TaskType, TaskStatus } from '../task/types';
import { TimeStatistics } from '../time/types';

export interface AnalyticsData extends BaseEntity {
  type: AnalyticsType;
  source: string;
  timestamp: Date;
  metrics: Record<string, number>;
  dimensions: Record<string, string>;
  tags: string[];
  metadata: Record<string, any>;
}

export enum AnalyticsType {
  TASK = 'TASK',
  TIME = 'TIME',
  AI = 'AI',
  PERFORMANCE = 'PERFORMANCE',
  USER = 'USER',
  SYSTEM = 'SYSTEM'
}

export interface PerformanceMetrics {
  period: {
    start: Date;
    end: Date;
  };
  taskCompletion: {
    total: number;
    onTime: number;
    delayed: number;
    rate: number;
  };
  timeEfficiency: {
    planned: number;
    actual: number;
    variance: number;
  };
  resourceUtilization: {
    [key: string]: {
      allocated: number;
      used: number;
      efficiency: number;
    };
  };
  quality: {
    errors: number;
    fixes: number;
    rating: number;
  };
}

export interface AIMetrics {
  modelPerformance: {
    [key in AIModelType]: {
      requests: number;
      successes: number;
      failures: number;
      averageLatency: number;
      tokenUsage: number;
    };
  };
  taskAssistance: {
    suggestions: number;
    acceptanceRate: number;
    improvementRate: number;
  };
  contextualLearning: {
    newPatterns: number;
    adaptations: number;
    accuracy: number;
  };
}

export interface TaskAnalytics {
  distribution: {
    byType: Record<TaskType, number>;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<string, number>;
  };
  timing: {
    averageCompletion: number;
    standardDeviation: number;
    trendline: {
      date: Date;
      value: number;
    }[];
  };
  dependencies: {
    count: number;
    complexity: number;
    bottlenecks: string[];
  };
  predictive: {
    estimatedCompletion: Date;
    riskFactors: string[];
    confidenceScore: number;
  };
}

export interface AnalyticsDashboard {
  summary: {
    period: {
      start: Date;
      end: Date;
    };
    highlights: {
      metric: string;
      value: number;
      change: number;
      trend: 'up' | 'down' | 'stable';
    }[];
  };
  performance: PerformanceMetrics;
  ai: AIMetrics;
  tasks: TaskAnalytics;
  time: TimeStatistics;
  insights: {
    key: string;
    description: string;
    impact: number;
    recommendations: string[];
  }[];
}

export interface AnalyticsQuery {
  type?: AnalyticsType[];
  source?: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
  metrics?: string[];
  dimensions?: string[];
  filters?: {
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains';
    value: any;
  }[];
  aggregations?: {
    field: string;
    function: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct';
    groupBy?: string[];
  }[];
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  }[];
  limit?: number;
  offset?: number;
}

export interface AnalyticsRepository {
  store(data: Omit<AnalyticsData, 'id'>): Promise<AnalyticsData>;
  
  query(query: AnalyticsQuery): Promise<{
    data: AnalyticsData[];
    total: number;
    aggregations?: Record<string, any>;
  }>;
  
  batchStore(data: Omit<AnalyticsData, 'id'>[]): Promise<{
    stored: number;
    failed: number;
    errors?: Error[];
  }>;
  
  deleteByQuery(query: Omit<AnalyticsQuery, 'metrics' | 'dimensions'>): Promise<{
    deleted: number;
  }>;
  
  getDashboard(
    timeRange: {
      start: Date;
      end: Date;
    },
    options?: {
      metrics?: string[];
      filters?: Record<string, any>;
      refreshInterval?: number;
    }
  ): Promise<AnalyticsDashboard>;
  
  getMetricHistory(
    metricName: string,
    timeRange: {
      start: Date;
      end: Date;
    },
    interval: 'hour' | 'day' | 'week' | 'month'
  ): Promise<{
    timestamps: Date[];
    values: number[];
    statistics: {
      min: number;
      max: number;
      avg: number;
      stdDev: number;
    };
  }>;
}

export interface AnalyticsService {
  trackEvent(
    type: AnalyticsType,
    data: {
      metrics: Record<string, number>;
      dimensions?: Record<string, string>;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<AnalyticsData>;
  
  queryAnalytics(query: AnalyticsQuery): Promise<{
    data: AnalyticsData[];
    total: number;
    aggregations?: Record<string, any>;
  }>;
  
  generateDashboard(
    timeRange: {
      start: Date;
      end: Date;
    },
    options?: {
      metrics?: string[];
      filters?: Record<string, any>;
      refreshInterval?: number;
    }
  ): Promise<AnalyticsDashboard>;
  
  generateReport(
    query: AnalyticsQuery,
    options: {
      format: 'json' | 'csv' | 'pdf' | 'html';
      title?: string;
      description?: string;
      includeVisualizations?: boolean;
      template?: string;
    }
  ): Promise<{
    data: any;
    metadata: {
      generatedAt: Date;
      reportType: string;
      parameters: Record<string, any>;
      visualizations?: {
        type: string;
        data: any;
        config: any;
      }[];
    };
  }>;
  
  detectAnomalies(
    metricName: string,
    timeRange: {
      start: Date;
      end: Date;
    },
    options?: {
      sensitivity?: number;
      baseline?: {
        start: Date;
        end: Date;
      };
      dimensions?: string[];
    }
  ): Promise<{
    anomalies: {
      timestamp: Date;
      value: number;
      expectedValue: number;
      deviation: number;
      severity: 'low' | 'medium' | 'high';
      context?: Record<string, any>;
    }[];
    analysis: {
      pattern: string;
      confidence: number;
      impactedMetrics: string[];
      suggestedActions: {
        action: string;
        priority: number;
        expectedImpact: string;
      }[];
    };
  }>;
  
  forecastMetric(
    metricName: string,
    options: {
      historicalData: {
        timestamp: Date;
        value: number;
        dimensions?: Record<string, string>;
      }[];
      horizon: number;
      interval: 'hour' | 'day' | 'week' | 'month';
      seasonality?: boolean;
      externalFactors?: {
        name: string;
        values: {
          timestamp: Date;
          value: number;
        }[];
      }[];
    }
  ): Promise<{
    predictions: {
      timestamp: Date;
      value: number;
      confidence: {
        lower: number;
        upper: number;
      };
      factors?: {
        name: string;
        impact: number;
      }[];
    }[];
    accuracy: {
      metric: string;
      value: number;
    }[];
    seasonalityPatterns?: {
      period: string;
      strength: number;
      phase: number;
    }[];
  }>;
  
  setAlerts(
    alerts: {
      metricName: string;
      conditions: {
        operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
        value: number;
        duration?: number;
      }[];
      frequency: number;
      channels: string[];
      metadata?: Record<string, any>;
    }[]
  ): Promise<{
    created: number;
    updated: number;
    errors?: Error[];
  }>;
  
  correlateMetrics(
    metrics: string[],
    timeRange: {
      start: Date;
      end: Date;
    },
    options?: {
      method: 'pearson' | 'spearman' | 'kendall';
      minCorrelation?: number;
      lagOptions?: {
        maxLag: number;
        direction: 'forward' | 'backward' | 'both';
      };
    }
  ): Promise<{
    correlations: {
      metric1: string;
      metric2: string;
      coefficient: number;
      significance: number;
      lag?: number;
    }[];
    insights: {
      description: string;
      strength: 'weak' | 'moderate' | 'strong';
      actionable: boolean;
      recommendation?: string;
    }[];
  }>;
}
