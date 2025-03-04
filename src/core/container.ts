/**
 * 依存性注入(DI)コンテナ
 * 
 * アプリケーション全体のサービスやコンポーネントを管理します。
 */

import { TaskRepository } from '../services/repositories/task-repository';
import { TaskServiceImpl } from '../services/task/task-service';
import { TaskService } from './task/types';

/**
 * シンプルなDIコンテナクラス
 */
export class Container {
  private static instance: Container;
  private services: Map<string, any>;

  private constructor() {
    this.services = new Map();
    this.registerServices();
  }

  /**
   * コンテナのシングルトンインスタンスを取得
   */
  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * 全サービスの登録
   */
  private registerServices(): void {
    // リポジトリの登録
    this.register('taskRepository', new TaskRepository());

    // サービスの登録
    this.register<TaskService>(
      'taskService',
      new TaskServiceImpl(this.get('taskRepository'))
    );
  }

  /**
   * サービスの登録
   * @param name サービス名
   * @param instance サービスインスタンス
   */
  public register<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  /**
   * サービスの取得
   * @param name サービス名
   * @returns サービスインスタンス
   */
  public get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`サービス "${name}" が登録されていません`);
    }
    return service as T;
  }

  /**
   * サービスが存在するか確認
   * @param name サービス名
   * @returns サービスの存在有無
   */
  public has(name: string): boolean {
    return this.services.has(name);
  }
}

// コンテナのシングルトンインスタンスをエクスポート
export const container = Container.getInstance();
