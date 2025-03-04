import { BaseEntity } from '../types';

export interface Memory extends BaseEntity {
  type: MemoryType;
  content: string;
  context: string;
  importance: number;
  confidence: number;
  source: string;
  timestamp: Date;
  lastAccessed?: Date;
  accessCount: number;
  tags: string[];
  metadata: Record<string, any>;
  relationships: MemoryRelationship[];
}

export enum MemoryType {
  CHAT = 'CHAT',
  TASK = 'TASK',
  CODE = 'CODE',
  DECISION = 'DECISION',
  INSIGHT = 'INSIGHT',
  CONCEPT = 'CONCEPT',
  EVENT = 'EVENT'
}

export interface MemoryRelationship {
  targetId: string;
  type: RelationType;
  strength: number;
  metadata: Record<string, any>;
}

export enum RelationType {
  SIMILAR_TO = 'SIMILAR_TO',
  PART_OF = 'PART_OF',
  DEPENDS_ON = 'DEPENDS_ON',
  LEADS_TO = 'LEADS_TO',
  CONTRADICTS = 'CONTRADICTS',
  SUPPORTS = 'SUPPORTS'
}

export interface MemoryContext {
  id: string;
  name: string;
  description: string;
  type: 'project' | 'conversation' | 'domain' | 'task';
  parent?: string;
  children: string[];
  metadata: Record<string, any>;
}

export interface MemoryQuery {
  type?: MemoryType[];
  context?: string[];
  tags?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  importance?: {
    min?: number;
    max?: number;
  };
  confidence?: {
    min?: number;
    max?: number;
  };
  relevance?: {
    content: string;
    threshold: number;
  };
  relationships?: {
    type: RelationType[];
    targetId?: string;
  };
}

export interface MemoryStatistics {
  total: number;
  byType: Record<MemoryType, number>;
  byContext: Record<string, number>;
  byTimeRange: {
    range: string;
    count: number;
  }[];
  averageImportance: number;
  averageConfidence: number;
  topTags: {
    tag: string;
    count: number;
  }[];
  relationshipStats: {
    type: RelationType;
    count: number;
    averageStrength: number;
  }[];
}

export interface MemoryAnalytics {
  accessPatterns: {
    timeOfDay: Record<number, number>;
    dayOfWeek: Record<number, number>;
    contextual: Record<string, number>;
  };
  retention: {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
  };
  usage: {
    queries: number;
    retrievals: number;
    updates: number;
    byType: Record<MemoryType, number>;
  };
  relationships: {
    density: number;
    clustering: number;
    centrality: Record<string, number>;
  };
}

export interface MemoryRepository {
  create(memory: Omit<Memory, 'id'>): Promise<Memory>;
  update(id: string, memory: Partial<Memory>): Promise<Memory>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Memory | null>;
  
  search(
    query: MemoryQuery,
    options?: {
      limit?: number;
      offset?: number;
      sort?: {
        field: 'importance' | 'confidence' | 'timestamp' | 'accessCount';
        order: 'asc' | 'desc';
      };
    }
  ): Promise<Memory[]>;
  
  findSimilar(
    content: string,
    options?: {
      context?: string[];
      threshold?: number;
      limit?: number;
    }
  ): Promise<{
    memory: Memory;
    similarity: number;
  }[]>;
  
  createContext(context: Omit<MemoryContext, 'id'>): Promise<MemoryContext>;
  updateContext(id: string, context: Partial<MemoryContext>): Promise<MemoryContext>;
  deleteContext(id: string): Promise<void>;
  
  getStatistics(
    filter?: {
      types?: MemoryType[];
      contexts?: string[];
      timeRange?: {
        start: Date;
        end: Date;
      };
    }
  ): Promise<MemoryStatistics>;
  
  getAnalytics(
    timeRange: {
      start: Date;
      end: Date;
    }
  ): Promise<MemoryAnalytics>;
}

export interface MemoryService {
  store(
    content: string,
    options: {
      type: MemoryType;
      context: string;
      importance?: number;
      confidence?: number;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<Memory>;
  
  recall(
    query: MemoryQuery,
    options?: {
      limit?: number;
      minConfidence?: number;
      includeMetadata?: boolean;
    }
  ): Promise<{
    memories: Memory[];
    relevanceScores: Record<string, number>;
  }>;
  
  forget(
    criteria: {
      before?: Date;
      types?: MemoryType[];
      contexts?: string[];
      importanceBelow?: number;
      confidenceBelow?: number;
    }
  ): Promise<{
    deleted: number;
    remaining: number;
  }>;
  
  merge(
    memories: string[],
    options?: {
      strategy: 'union' | 'intersection' | 'weighted';
      weights?: Record<string, number>;
    }
  ): Promise<Memory>;
  
  relate(
    sourceId: string,
    targetId: string,
    relationship: {
      type: RelationType;
      strength: number;
      metadata?: Record<string, any>;
    }
  ): Promise<MemoryRelationship>;
  
  analyzeContext(
    contextId: string,
    timeRange?: {
      start: Date;
      end: Date;
    }
  ): Promise<{
    summary: string;
    keyInsights: string[];
    patterns: {
      type: string;
      description: string;
      confidence: number;
    }[];
    recommendations: {
      type: string;
      suggestion: string;
      impact: number;
    }[];
  }>;
  
  consolidate(
    options?: {
      strategy: 'importance' | 'recency' | 'frequency' | 'hybrid';
      threshold?: number;
    }
  ): Promise<{
    processed: number;
    consolidated: number;
    savings: number;
  }>;
  
  suggestConnections(
    memoryId: string,
    options?: {
      types?: RelationType[];
      minStrength?: number;
      maxResults?: number;
    }
  ): Promise<{
    suggestions: {
      targetMemory: Memory;
      relationType: RelationType;
      strength: number;
      reason: string;
    }[];
  }>;
}
