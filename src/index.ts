/**
 * MCPエージェントシステムのエントリーポイント
 * 
 * アプリケーションの起動と初期化を担当
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { dbConnection } from './services/database/sqlite/connection';
import { migrationManager } from './services/database/migration-manager';
import { container } from './core/container';
import { logger } from './utils/logger';
import config from '@config/default.json';

// データディレクトリの作成
import fs from 'fs';
import path from 'path';

const dataDirectory = path.resolve(process.cwd(), './data');
if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

class MCPAgentSystem {
  private server: Server;

  constructor() {
    // MCPサーバーの初期化
    this.server = new Server(
      {
        name: 'mcp-agent-system',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // エラーハンドリング
    this.server.onerror = (error) => {
      logger.error('MCPサーバーエラー', { error });
    };

    // シグナルハンドラの設定
    process.on('SIGINT', async () => {
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.shutdown();
      process.exit(0);
    });

    // 未処理の例外ハンドラ
    process.on('uncaughtException', (error) => {
      logger.error('未処理の例外', { error });
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未処理のPromise拒否', { reason, promise });
    });
  }

  /**
   * アプリケーションの初期化
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('MCPエージェントシステムを初期化中...');

      // データベース接続
      await dbConnection.open();
      logger.info('データベース接続が確立されました');

      // マイグレーション実行
      await migrationManager.migrateUp();
      
      // その他の初期化処理...
      
      logger.info('初期化完了');
    } catch (error) {
      logger.error('初期化中にエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * MCP機能のセットアップ
   */
  private setupMCP(): void {
    // DIコンテナからサービスを取得
    const taskService = container.get('taskService');
    
    // TODO: TaskServiceを使用したMCPリソースやツールのセットアップ
    // 例: this.server.setRequestHandler(...);
    
    logger.info('MCPサービスがセットアップされました');
  }

  /**
   * アプリケーションの実行
   */
  public async run(): Promise<void> {
    try {
      // MCPのセットアップ
      this.setupMCP();

      // MCPサーバーの起動
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('MCPエージェントシステムが起動しました');
    } catch (error) {
      logger.error('アプリケーション実行中にエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * アプリケーションのシャットダウン
   */
  public async shutdown(): Promise<void> {
    try {
      logger.info('MCPエージェントシステムをシャットダウン中...');
      
      // MCPサーバーの終了
      await this.server.close();
      
      // データベース接続の終了
      await dbConnection.close();
      
      logger.info('シャットダウン完了');
    } catch (error) {
      logger.error('シャットダウン中にエラーが発生しました', { error });
    }
  }
}

/**
 * メイン関数
 */
async function main(): Promise<void> {
  const app = new MCPAgentSystem();
  
  try {
    await app.initialize();
    await app.run();
  } catch (error) {
    logger.error('アプリケーション起動に失敗しました', { error });
    process.exit(1);
  }
}

// アプリケーション開始
if (require.main === module) {
  main();
}

// モジュールとしてインポートされた場合のためにエクスポート
export { MCPAgentSystem };
