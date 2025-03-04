/**
 * リポジトリの基本インターフェース
 * 
 * すべてのリポジトリの基本となるインターフェースを定義します。
 * T: エンティティの型
 * ID: IDの型（通常はstringまたはnumber）
 */

export interface FilterOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  [key: string]: any;
}

export interface Repository<T, ID> {
  /**
   * IDによるエンティティの検索
   * @param id エンティティのID
   * @returns エンティティが見つかった場合はそのエンティティ、見つからない場合はundefined
   */
  findById(id: ID): Promise<T | undefined>;

  /**
   * 条件に一致するすべてのエンティティを取得
   * @param filter フィルタオプション
   * @returns エンティティの配列
   */
  findAll(filter?: FilterOptions): Promise<T[]>;

  /**
   * 条件に一致する最初のエンティティを取得
   * @param filter フィルタオプション
   * @returns エンティティが見つかった場合はそのエンティティ、見つからない場合はundefined
   */
  findOne(filter: FilterOptions): Promise<T | undefined>;

  /**
   * 新しいエンティティを作成
   * @param entity 作成するエンティティ（IDは自動生成されるため省略可）
   * @returns 作成されたエンティティ（ID付き）
   */
  create(entity: Omit<T, 'id'>): Promise<T>;

  /**
   * 既存のエンティティを更新
   * @param id 更新するエンティティのID
   * @param entity 更新するフィールド（部分的な更新が可能）
   * @returns 更新されたエンティティ
   */
  update(id: ID, entity: Partial<T>): Promise<T>;

  /**
   * エンティティを削除
   * @param id 削除するエンティティのID
   * @returns 削除に成功した場合はtrue、失敗した場合はfalse
   */
  delete(id: ID): Promise<boolean>;

  /**
   * 条件に一致するエンティティの数を取得
   * @param filter フィルタオプション
   * @returns エンティティの数
   */
  count(filter?: FilterOptions): Promise<number>;

  /**
   * 複数のエンティティを一括で作成
   * @param entities 作成するエンティティの配列
   * @returns 作成されたエンティティの配列
   */
  createMany(entities: Array<Omit<T, 'id'>>): Promise<T[]>;

  /**
   * 複数のエンティティを一括で更新
   * @param entities 更新するエンティティの配列（IDが必要）
   * @returns 更新されたエンティティの配列
   */
  updateMany(entities: Array<T>): Promise<T[]>;

  /**
   * 複数のエンティティを一括で削除
   * @param ids 削除するエンティティのID配列
   * @returns 削除されたエンティティの数
   */
  deleteMany(ids: ID[]): Promise<number>;

  /**
   * トランザクション内で操作を実行
   * @param callback トランザクション内で実行する処理
   * @returns コールバックの戻り値
   */
  transaction<R>(callback: () => Promise<R>): Promise<R>;
}
