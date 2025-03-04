/**
 * メモリリポジトリの実装
 * 
 * メモリ（知識管理）関連のデータアクセスを提供します。
 */

import { 
  Memory, 
  MemoryType, 
  MemoryRelationship, 
  RelationType,
  MemoryContext,
  MemoryQuery,
  MemoryStatistics
} from '../../core/memory/types';
import { Repository, FilterOptions } from '../../core/repository/repository.interface';
import { BaseSQLiteRepository } from '../database/sqlite/base-repository';
import { logger } from '../../utils/logger';

export interface MemoryFilterOptions extends FilterOptions {
  type?: MemoryType;
  context?: string;
  tags?: string[];
  importance?: { min?: number; max?: number };
  confidence?: { min?: number; max?: number };
  startDate?: Date;
  endDate?: Date;
  lastAccessedAfter?: Date;
  minAccessCount?: number;
  search?: string;
}

export class MemoryRepository extends BaseSQLiteRepository<Memory, string> {
  protected tableName = 'memories';
  protected primaryKey = 'id';
  
  /**
   * エンティティをテーブル行に変換
   * @param memory メモリエンティティ
   * @returns テーブル行オブジェクト
   */
  protected entityToRow(memory: Memory): Record<string, any> {
    return {
      ...memory,
      timestamp: memory.timestamp.toISOString(),
      lastAccessed: memory.lastAccessed ? memory.lastAccessed.toISOString() : null,
      tags: JSON.stringify(memory.tags),
      metadata: JSON.stringify(memory.metadata),
      relationships: JSON.stringify(memory.relationships),
      createdAt: memory.createdAt ? memory.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * テーブル行をエンティティに変換
   * @param row テーブル行
   * @returns メモリエンティティ
   */
  protected rowToEntity(row: Record<string, any>): Memory {
    // 必須フィールドのデフォルト値
    const defaults = {
      id: '',
      type: MemoryType.CONCEPT,
      content: '',
      context: '',
      importance: 0.5,
      confidence: 0.5,
      source: 'system',
      timestamp: new Date(),
      accessCount: 0,
      tags: [],
      metadata: {},
      relationships: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // rowにidがない場合はエラー（通常発生しないはず）
    if (!row.id) {
      logger.error('データベースレコードにIDが含まれていません', { row });
    }
    
    return {
      ...defaults,
      ...row,
      id: row.id || defaults.id,
      timestamp: row.timestamp ? new Date(row.timestamp) : defaults.timestamp,
      lastAccessed: row.lastAccessed ? new Date(row.lastAccessed) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : defaults.tags,
      metadata: row.metadata ? JSON.parse(row.metadata) : defaults.metadata,
      relationships: row.relationships ? JSON.parse(row.relationships) : defaults.relationships,
      createdAt: row.createdAt ? new Date(row.createdAt) : defaults.createdAt,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : defaults.updatedAt,
    };
  }

  /**
   * 拡張フィルタオプションからWHERE句を作成
   * @param filter 拡張フィルタオプション
   * @returns [WHERE句の文字列, パラメータの配列]
   */
  protected buildWhereClause(filter?: MemoryFilterOptions): [string, any[]] {
    if (!filter) {
      return ['', []];
    }

    const { 
      type, 
      context, 
      tags, 
      importance, 
      confidence, 
      startDate, 
      endDate,
      lastAccessedAfter,
      minAccessCount,
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

    // メモリ固有のフィルタ
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (context) {
      conditions.push('context = ?');
      params.push(context);
    }

    // 重要度範囲
    if (importance) {
      if (importance.min !== undefined) {
        conditions.push('importance >= ?');
        params.push(importance.min);
      }

      if (importance.max !== undefined) {
        conditions.push('importance <= ?');
        params.push(importance.max);
      }
    }

    // 確信度範囲
    if (confidence) {
      if (confidence.min !== undefined) {
        conditions.push('confidence >= ?');
        params.push(confidence.min);
      }

      if (confidence.max !== undefined) {
        conditions.push('confidence <= ?');
        params.push(confidence.max);
      }
    }

    // 時間範囲フィルタ
    if (startDate) {
      conditions.push('timestamp >= ?');
      params.push(startDate.toISOString());
    }

    if (endDate) {
      conditions.push('timestamp <= ?');
      params.push(endDate.toISOString());
    }

    if (lastAccessedAfter) {
      conditions.push('lastAccessed >= ?');
      params.push(lastAccessedAfter.toISOString());
    }

    if (minAccessCount !== undefined) {
      conditions.push('accessCount >= ?');
      params.push(minAccessCount);
    }

    // タグ検索（JSONデータに部分一致）
    if (tags && tags.length > 0) {
      // SQLiteは複雑なJSON検索が得意ではないので、簡易的に実装
      // 各タグを個別に検索し、OR条件で結合
      const tagConditions = tags.map(() => 'tags LIKE ?');
      conditions.push(`(${tagConditions.join(' OR ')})`);
      
      // 各タグに対して、JSON配列内に存在するかをチェック
      params.push(...tags.map(tag => `%${tag}%`));
    }

    // コンテンツとコンテキストの検索
    if (search) {
      conditions.push('(content LIKE ? OR context LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    return [whereClause, params];
  }

  /**
   * メモリ検索を実行
   * @param query メモリクエリ
   * @param options 検索オプション
   * @returns メモリの配列
   */
  async search(
    query: MemoryQuery,
    options?: {
      limit?: number;
      offset?: number;
      sort?: {
        field: 'importance' | 'confidence' | 'timestamp' | 'accessCount';
        order: 'asc' | 'desc';
      };
    }
  ): Promise<Memory[]> {
    // クエリをフィルタオプションに変換
    const filter: MemoryFilterOptions = {};
    
    // タイプフィルタ
    if (query.type && query.type.length > 0) {
      // 複数タイプの場合は個別に検索してマージする必要がある
      // ここでは簡略化のため、最初のタイプのみ使用
      filter.type = query.type[0];
    }
    
    // コンテキストフィルタ
    if (query.context && query.context.length > 0) {
      // 複数コンテキストの場合は個別に検索してマージする必要がある
      // ここでは簡略化のため、最初のコンテキストのみ使用
      filter.context = query.context[0];
    }
    
    // タグフィルタ
    if (query.tags && query.tags.length > 0) {
      filter.tags = query.tags;
    }
    
    // 時間範囲フィルタ
    if (query.timeRange) {
      filter.startDate = query.timeRange.start;
      filter.endDate = query.timeRange.end;
    }
    
    // 重要度フィルタ
    if (query.importance) {
      filter.importance = query.importance;
    }
    
    // 確信度フィルタ
    if (query.confidence) {
      filter.confidence = query.confidence;
    }
    
    // ソートオプション
    if (options?.sort) {
      filter.orderBy = options.sort.field;
      filter.orderDirection = options.sort.order.toUpperCase() as any;
    }
    
    // ページングオプション
    if (options?.limit !== undefined) {
      filter.limit = options.limit;
    }
    
    if (options?.offset !== undefined) {
      filter.offset = options.offset;
    }
    
    // 関連性フィルタは複雑なため、ここでは基本的なテキスト検索として実装
    if (query.relevance) {
      filter.search = query.relevance.content;
    }
    
    // 関係性フィルタは複雑なため、基本的な実装のみ行う
    if (query.relationships) {
      // ベースとなるメモリを取得し、その後関係性でフィルタリングする必要がある
      const memories = await this.findAll(filter);
      
      if (query.relationships.targetId) {
        // 特定のターゲットIDとの関係を持つメモリのみをフィルタリング
        return memories.filter(memory => 
          memory.relationships.some(rel => 
            rel.targetId === query.relationships!.targetId && 
            query.relationships!.type.includes(rel.type)
          )
        );
      } else {
        // 指定されたタイプの関係を持つメモリのみをフィルタリング
        return memories.filter(memory => 
          memory.relationships.some(rel => 
            query.relationships!.type.includes(rel.type)
          )
        );
      }
    }
    
    // 基本的なフィルタリングのみを使用する場合
    return this.findAll(filter);
  }

  /**
   * 類似メモリの検索（ベクトル検索）
   * @param content 検索内容
   * @param options 検索オプション
   * @returns 類似度とメモリのペアの配列
   */
  async findSimilar(
    content: string,
    options?: {
      context?: string[];
      threshold?: number;
      limit?: number;
    }
  ): Promise<{ memory: Memory; similarity: number }[]> {
    // 本格的なベクトル検索の実装は複雑であるため、ここでは簡易的な実装を行う
    // 実際のプロダクション実装では、外部ベクトルデータベースや埋め込みモデルを使用する
    
    // 簡易的なテキストベースの類似度検索
    const limit = options?.limit || 10;
    const threshold = options?.threshold || 0.5;
    
    // コンテンツのトークン化（単純な単語分割）
    const contentTokens = content.toLowerCase().split(/\W+/).filter(t => t.length > 0);
    
    // コンテキストフィルタを適用
    const filter: MemoryFilterOptions = {};
    if (options?.context && options.context.length > 0) {
      filter.context = options.context[0];  // 簡略化のため、最初のコンテキストのみ使用
    }
    
    // すべてのメモリを取得
    const memories = await this.findAll(filter);
    
    // 各メモリに対する類似度を計算
    const results = memories.map(memory => {
      // メモリコンテンツのトークン化
      const memoryTokens = memory.content.toLowerCase().split(/\W+/).filter(t => t.length > 0);
      
      // 単純なJaccard類似度を計算
      const intersection = contentTokens.filter(t => memoryTokens.includes(t)).length;
      const union = new Set([...contentTokens, ...memoryTokens]).size;
      
      const similarity = union === 0 ? 0 : intersection / union;
      
      return { memory, similarity };
    });
    
    // 類似度でソートし、閾値以上のものだけを返す
    return results
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * メモリアクセスを記録
   * @param id メモリID
   * @returns 更新されたメモリ
   */
  async recordAccess(id: string): Promise<Memory> {
    const memory = await this.findById(id);
    if (!memory) {
      throw new Error(`メモリが見つかりません: ID ${id}`);
    }
    
    // アクセスカウントを増やし、最終アクセス日時を更新
    return this.update(id, {
      accessCount: memory.accessCount + 1,
      lastAccessed: new Date()
    });
  }

  /**
   * メモリコンテキストの作成
   * @param context コンテキスト情報
   * @returns 作成されたコンテキスト
   */
  async createContext(context: Omit<MemoryContext, 'id'>): Promise<MemoryContext> {
    // コンテキスト用のテーブルに保存する実装
    // この実装は簡略化のため省略
    throw new Error('コンテキスト機能は未実装です');
  }

  /**
   * メモリコンテキストの更新
   * @param id コンテキストID
   * @param context 更新するコンテキスト情報
   * @returns 更新されたコンテキスト
   */
  async updateContext(id: string, context: Partial<MemoryContext>): Promise<MemoryContext> {
    // 実際の実装では、コンテキスト用のテーブルを更新する
    throw new Error('コンテキスト機能は未実装です');
  }

  /**
   * メモリコンテキストの削除
   * @param id コンテキストID
   */
  async deleteContext(id: string): Promise<void> {
    // 実際の実装では、コンテキスト用のテーブルからレコードを削除する
    throw new Error('コンテキスト機能は未実装です');
  }

  /**
   * コンテキストIDによるコンテキストの検索
   * @param id コンテキストID
   * @returns コンテキスト
   */
  async findContextById(id: string): Promise<MemoryContext | null> {
    // 実際の実装では、コンテキスト用のテーブルからレコードを取得する
    throw new Error('コンテキスト機能は未実装です');
  }

  /**
   * メモリ統計情報の取得
   * @param filter フィルタ条件
   * @returns 統計情報
   */
  async getStatistics(
    filter?: {
      types?: MemoryType[];
      contexts?: string[];
      timeRange?: {
        start: Date;
        end: Date;
      };
    }
  ): Promise<Record<string, any>> {
    // 条件構築
    let conditions: string[] = [];
    const params: any[] = [];

    if (filter?.timeRange) {
      conditions.push('timestamp >= ? AND timestamp <= ?');
      params.push(filter.timeRange.start.toISOString(), filter.timeRange.end.toISOString());
    }

    if (filter?.types && filter.types.length > 0) {
      const typePlaceholders = filter.types.map(() => '?').join(',');
      conditions.push(`type IN (${typePlaceholders})`);
      params.push(...filter.types);
    }

    if (filter?.contexts && filter.contexts.length > 0) {
      const contextPlaceholders = filter.contexts.map(() => '?').join(',');
      conditions.push(`context IN (${contextPlaceholders})`);
      params.push(...filter.contexts);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 合計数
    const totalSql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
    const totalResult = await this.queryOne(totalSql, params);
    const total = totalResult ? totalResult.count : 0;

    // タイプ別カウント
    const byTypeSql = `
      SELECT type, COUNT(*) as count 
      FROM ${this.tableName} 
      ${whereClause} 
      GROUP BY type
    `;
    const byTypeResults = await this.query(byTypeSql, params);
    const byType: Record<string, number> = {};
    byTypeResults.forEach(row => {
      byType[row.type] = row.count;
    });

    // コンテキスト別カウント
    const byContextSql = `
      SELECT context, COUNT(*) as count 
      FROM ${this.tableName} 
      ${whereClause} 
      GROUP BY context
    `;
    const byContextResults = await this.query(byContextSql, params);
    const byContext: Record<string, number> = {};
    byContextResults.forEach(row => {
      byContext[row.context] = row.count;
    });

    // 重要度と確信度の平均
    const avgsSql = `
      SELECT AVG(importance) as avgImportance, AVG(confidence) as avgConfidence
      FROM ${this.tableName} 
      ${whereClause}
    `;
    const avgsResult = await this.queryOne(avgsSql, params);
    const averageImportance = avgsResult ? avgsResult.avgImportance : 0;
    const averageConfidence = avgsResult ? avgsResult.avgConfidence : 0;

    return {
      total,
      byType,
      byContext,
      averageImportance,
      averageConfidence
    };
  }
}
