/**
 * SQLiteリポジトリの基底クラス
 * 
 * すべてのSQLiteリポジトリの基本となる抽象クラスを提供します。
 * 基本的なCRUD操作の共通実装を含みます。
 */

import * as sqlite3 from 'sqlite3';
import { Repository, FilterOptions } from '../../../core/repository/repository.interface';
import { dbConnection } from './connection';

export abstract class BaseSQLiteRepository<T extends { id?: string | number }, ID = string | number> implements Repository<T, ID> {
  protected abstract tableName: string;
  protected abstract primaryKey: string;

  /**
   * エンティティをテーブル行に変換（サブクラスでオーバーライド可能）
   * @param entity エンティティオブジェクト
   * @returns テーブル行として表現可能なオブジェクト
   */
  protected entityToRow(entity: T): Record<string, any> {
    return { ...entity };
  }

  /**
   * テーブル行をエンティティに変換（サブクラスでオーバーライド可能）
   * @param row テーブル行のオブジェクト
   * @returns エンティティオブジェクト
   */
  protected rowToEntity(row: Record<string, any>): T {
    return row as T;
  }

  /**
   * フィルタオプションからWHERE句を作成
   * @param filter フィルタオプション
   * @returns [WHERE句の文字列, パラメータの配列]
   */
  protected buildWhereClause(filter?: FilterOptions): [string, any[]] {
    if (!filter) {
      return ['', []];
    }

    const { limit, offset, orderBy, orderDirection, ...conditions } = filter;
    const params: any[] = [];
    const whereConditions: string[] = [];

    for (const [key, value] of Object.entries(conditions)) {
      whereConditions.push(`${key} = ?`);
      params.push(value);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    return [whereClause, params];
  }

  /**
   * フィルタオプションからORDER BYとLIMIT句を作成
   * @param filter フィルタオプション
   * @returns SQL句の文字列
   */
  protected buildOrderAndLimit(filter?: FilterOptions): string {
    if (!filter) {
      return '';
    }

    const { orderBy, orderDirection, limit, offset } = filter;
    let clause = '';

    if (orderBy) {
      clause += ` ORDER BY ${orderBy} ${orderDirection || 'ASC'}`;
    }

    if (limit !== undefined) {
      clause += ` LIMIT ${limit}`;
      if (offset !== undefined) {
        clause += ` OFFSET ${offset}`;
      }
    }

    return clause;
  }

  /**
   * SQLクエリを実行し、結果を配列として取得
   * @param sql SQL文
   * @param params バインドパラメータ
   * @returns クエリ結果の配列
   */
  protected async query<R = Record<string, any>>(sql: string, params: any[] = []): Promise<R[]> {
    return dbConnection.all<R>(sql, params);
  }

  /**
   * SQLクエリを実行し、最初の結果を取得
   * @param sql SQL文
   * @param params バインドパラメータ
   * @returns 最初の結果または undefined
   */
  protected async queryOne<R = Record<string, any>>(sql: string, params: any[] = []): Promise<R | undefined> {
    return dbConnection.get<R>(sql, params);
  }

  /**
   * SQLクエリを実行（INSERT, UPDATE, DELETE用）
   * @param sql SQL文
   * @param params バインドパラメータ
   * @returns 影響を受けた行数
   */
  protected async execute(sql: string, params: any[] = []): Promise<number> {
    const result = await dbConnection.run(sql, params);
    return result.changes;
  }

  /**
   * IDによるエンティティの検索
   * @param id エンティティのID
   * @returns エンティティが見つかった場合はそのエンティティ、見つからない場合はundefined
   */
  async findById(id: ID): Promise<T | undefined> {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    const row = await this.queryOne(sql, [id]);
    return row ? this.rowToEntity(row) : undefined;
  }

  /**
   * 条件に一致するすべてのエンティティを取得
   * @param filter フィルタオプション
   * @returns エンティティの配列
   */
  async findAll(filter?: FilterOptions): Promise<T[]> {
    const [whereClause, params] = this.buildWhereClause(filter);
    const orderAndLimit = this.buildOrderAndLimit(filter);
    
    const sql = `SELECT * FROM ${this.tableName} ${whereClause} ${orderAndLimit}`;
    const rows = await this.query(sql, params);
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * 条件に一致する最初のエンティティを取得
   * @param filter フィルタオプション
   * @returns エンティティが見つかった場合はそのエンティティ、見つからない場合はundefined
   */
  async findOne(filter: FilterOptions): Promise<T | undefined> {
    const [whereClause, params] = this.buildWhereClause(filter);
    const sql = `SELECT * FROM ${this.tableName} ${whereClause} LIMIT 1`;
    const row = await this.queryOne(sql, params);
    return row ? this.rowToEntity(row) : undefined;
  }

  /**
   * 新しいエンティティを作成
   * @param entity 作成するエンティティ
   * @returns 作成されたエンティティ（ID付き）
   */
  async create(entity: Omit<T, 'id'>): Promise<T> {
    const row = this.entityToRow(entity as T);
    const columns = Object.keys(row).filter(key => key !== 'id');
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(column => row[column]);
    
    const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    const result = await dbConnection.run(sql, values);
        
    // lastIDを使用して作成されたエンティティを返す
    const createdEntity = { 
      ...entity as any,
      id: result.lastID
    } as T;
    
    return createdEntity;
  }

  /**
   * 既存のエンティティを更新
   * @param id 更新するエンティティのID
   * @param entity 更新するフィールド
   * @returns 更新されたエンティティ
   */
  async update(id: ID, entity: Partial<T>): Promise<T> {
    const row = this.entityToRow(entity as T);
    const columns = Object.keys(row).filter(key => key !== 'id' && row[key] !== undefined);
    
    if (columns.length === 0) {
      // 更新するフィールドがない場合は、現在のエンティティを返す
      return this.findById(id) as Promise<T>;
    }
    
    const setClause = columns.map(column => `${column} = ?`).join(', ');
    const values = [...columns.map(column => row[column]), id];
    
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${this.primaryKey} = ?`;
    await this.execute(sql, values);
    
    // 更新後のエンティティを取得して返す
    const updatedEntity = await this.findById(id);
    if (!updatedEntity) {
      throw new Error(`エンティティ更新後の取得に失敗しました: ID ${id}`);
    }
    
    return updatedEntity;
  }

  /**
   * エンティティを削除
   * @param id 削除するエンティティのID
   * @returns 削除に成功した場合はtrue、失敗した場合はfalse
   */
  async delete(id: ID): Promise<boolean> {
    const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    const result = await this.execute(sql, [id]);
    return result > 0;
  }

  /**
   * 条件に一致するエンティティの数を取得
   * @param filter フィルタオプション
   * @returns エンティティの数
   */
  async count(filter?: FilterOptions): Promise<number> {
    const [whereClause, params] = this.buildWhereClause(filter);
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
    const result = await this.queryOne(sql, params);
    return result ? result.count : 0;
  }

  /**
   * 複数のエンティティを一括で作成
   * @param entities 作成するエンティティの配列
   * @returns 作成されたエンティティの配列
   */
  async createMany(entities: Array<Omit<T, 'id'>>): Promise<T[]> {
    // トランザクション内で複数のエンティティを作成
    return this.transaction(async () => {
      const createdEntities: T[] = [];
      for (const entity of entities) {
        const createdEntity = await this.create(entity);
        createdEntities.push(createdEntity);
      }
      return createdEntities;
    });
  }

  /**
   * 複数のエンティティを一括で更新
   * @param entities 更新するエンティティの配列
   * @returns 更新されたエンティティの配列
   */
  async updateMany(entities: Array<T>): Promise<T[]> {
    // トランザクション内で複数のエンティティを更新
    return this.transaction(async () => {
      const updatedEntities: T[] = [];
      for (const entity of entities) {
        const id = entity.id as unknown as ID;
        if (!id) {
          throw new Error('更新するエンティティにIDが必要です');
        }
        const updatedEntity = await this.update(id, entity);
        updatedEntities.push(updatedEntity);
      }
      return updatedEntities;
    });
  }

  /**
   * 複数のエンティティを一括で削除
   * @param ids 削除するエンティティのID配列
   * @returns 削除されたエンティティの数
   */
  async deleteMany(ids: ID[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    
    // トランザクション内で複数のエンティティを削除
    return this.transaction(async () => {
      const placeholders = ids.map(() => '?').join(', ');
      const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} IN (${placeholders})`;
      const result = await this.execute(sql, ids);
      return result;
    });
  }

  /**
   * トランザクション内で操作を実行
   * @param callback トランザクション内で実行する処理
   * @returns コールバックの戻り値
   */
  async transaction<R>(callback: () => Promise<R>): Promise<R> {
    try {
      await dbConnection.beginTransaction();
      const result = await callback();
      await dbConnection.commit();
      return result;
    } catch (error) {
      await dbConnection.rollback();
      throw error;
    }
  }
}
