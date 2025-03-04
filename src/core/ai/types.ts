import { BaseEntity } from '../types';
import { MemoryType } from '../memory/types';
import { TaskType } from '../task/types';

export enum AIModelType {
  TEXT_GENERATION = 'TEXT_GENERATION',
  CODE_GENERATION = 'CODE_GENERATION',
  TASK_PLANNING = 'TASK_PLANNING',
  MEMORY_ANALYSIS = 'MEMORY_ANALYSIS',
  DECISION_SUPPORT = 'DECISION_SUPPORT',
  LEARNING = 'LEARNING',
  EXPLAINABILITY = 'EXPLAINABILITY'
}

export interface AIModel extends BaseEntity {
  type: AIModelType;
  name: string;
  version: string;
  capabilities: string[];
  parameters: Record<string, any>;
  metadata: Record<string, any>;
}

export interface AIRequest {
  modelType: AIModelType;
  input: {
    content: string;
    context?: Record<string, any>;
    parameters?: Record<string, any>;
  };
  constraints?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
  metadata?: Record<string, any>;
}

export interface AIResponse {
  modelType: AIModelType;
  output: {
    content: string;
    tokens: number;
    confidence: number;
  };
  alternatives?: {
    content: string;
    confidence: number;
  }[];
  metadata: {
    processingTime: number;
    modelVersion: string;
    tokensUsed: {
      input: number;
      output: number;
      total: number;
    };
  };
}

export interface AIContext {
  type: 'chat' | 'code' | 'task' | 'memory';
  content: string;
  relevance: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface AIMemory {
  type: MemoryType;
  content: string;
  importance: number;
  confidence: number;
  context: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface AITask {
  type: TaskType;
  description: string;
  priority: number;
  deadline?: Date;
  dependencies: string[];
  constraints: Record<string, any>;
}

export interface AIRepository {
  loadModel(type: AIModelType): Promise<AIModel>;
  
  executeRequest(request: AIRequest): Promise<AIResponse>;
  
  storeContext(
    context: AIContext
  ): Promise<{
    id: string;
    stored: boolean;
  }>;
  
  retrieveContext(
    query: {
      type?: string;
      relevance?: number;
      timeRange?: {
        start: Date;
        end: Date;
      };
    },
    limit?: number
  ): Promise<AIContext[]>;
  
  updateModelParameters(
    modelType: AIModelType,
    parameters: Record<string, any>
  ): Promise<AIModel>;
  
  getModelMetrics(
    modelType: AIModelType,
    timeRange: {
      start: Date;
      end: Date;
    }
  ): Promise<{
    requests: number;
    tokensUsed: number;
    averageLatency: number;
    errorRate: number;
    contextUtilization: number;
  }>;
}

export interface AIService {
  generateText(
    prompt: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      context?: AIContext[];
      format?: 'text' | 'json' | 'markdown';
    }
  ): Promise<{
    content: string;
    confidence: number;
    metadata: Record<string, any>;
  }>;
  
  generateCode(
    specification: string,
    options?: {
      language?: string;
      framework?: string;
      context?: AIContext[];
      testCases?: boolean;
    }
  ): Promise<{
    code: string;
    explanation: string;
    tests?: string;
    metadata: Record<string, any>;
  }>;
  
  planTask(
    task: AITask,
    options?: {
      context?: AIContext[];
      optimizationCriteria?: string[];
      riskAnalysis?: boolean;
    }
  ): Promise<{
    steps: {
      description: string;
      estimatedDuration: number;
      dependencies: string[];
    }[];
    risks: {
      description: string;
      probability: number;
      impact: number;
      mitigation: string;
    }[];
    metadata: Record<string, any>;
  }>;
  
  analyzeMemory(
    memories: AIMemory[],
    options?: {
      analysisType: 'pattern' | 'insight' | 'summary';
      context?: AIContext[];
      depth?: 'shallow' | 'medium' | 'deep';
    }
  ): Promise<{
    patterns: {
      description: string;
      confidence: number;
      supporting_evidence: string[];
    }[];
    insights: {
      description: string;
      importance: number;
      action_items: string[];
    }[];
    metadata: Record<string, any>;
  }>;
  
  provideDecisionSupport(
    context: {
      problem: string;
      options: string[];
      constraints: string[];
      criteria: string[];
    },
    options?: {
      additionalContext?: AIContext[];
      analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
      uncertaintyHandling?: boolean;
    }
  ): Promise<{
    recommendation: string;
    analysis: {
      option: string;
      pros: string[];
      cons: string[];
      score: number;
    }[];
    rationale: string;
    confidence: number;
    metadata: Record<string, any>;
  }>;
  
  learn(
    trainingData: {
      input: string;
      output: string;
      context?: Record<string, any>;
    }[],
    options?: {
      modelType: AIModelType;
      validationSplit?: number;
      iterations?: number;
    }
  ): Promise<{
    modelUpdated: boolean;
    performance: {
      accuracy: number;
      loss: number;
      iterations: number;
    };
    insights: {
      learningRate: number;
      significantPatterns: string[];
      improvements: string[];
    };
  }>;
  
  explain(
    target: {
      type: 'decision' | 'prediction' | 'recommendation';
      content: string;
      context?: Record<string, any>;
    },
    options?: {
      detailLevel: 'basic' | 'detailed' | 'technical';
      format?: 'text' | 'structured';
      includeConfidence?: boolean;
    }
  ): Promise<{
    explanation: string;
    factors: {
      name: string;
      importance: number;
      description: string;
    }[];
    confidence: number;
    metadata: Record<string, any>;
  }>;
}
