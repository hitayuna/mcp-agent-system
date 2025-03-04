/**
 * ロギングシステム
 * アプリケーション全体で一貫したロギングを提供する
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import config from '@config/default.json';

// ログ出力先ディレクトリの作成
const logDirectory = path.resolve(process.cwd(), config.logging?.directory || './logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// ログレベルの設定
const level = config.logging?.level || 'info';

// ログのフォーマット設定
const formats = {
  json: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  simple: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, ...metadata }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      
      if (Object.keys(metadata).length > 0 && metadata.stack) {
        msg = `${msg}\n${metadata.stack}`;
      } else if (Object.keys(metadata).length > 0) {
        msg = `${msg}\n${JSON.stringify(metadata, null, 2)}`;
      }
      
      return msg;
    })
  )
};

// ロガーの作成
export const logger = winston.createLogger({
  level,
  format: formats[config.logging?.format as 'json' | 'simple' || 'json'],
  defaultMeta: { service: 'mcp-agent-system' },
  transports: [
    // コンソール出力（開発環境用）
    new winston.transports.Console(),
    
    // ファイル出力
    new winston.transports.File({
      filename: path.join(logDirectory, 'error.log'),
      level: 'error',
      maxsize: getByteSize(config.logging?.maxSize || '10m'),
      maxFiles: config.logging?.maxFiles || 5,
    }),
    new winston.transports.File({
      filename: path.join(logDirectory, 'combined.log'),
      maxsize: getByteSize(config.logging?.maxSize || '10m'),
      maxFiles: config.logging?.maxFiles || 5,
    }),
  ],
});

/**
 * サイズ文字列をバイト数に変換
 * 例: '10m' -> 10485760
 */
function getByteSize(sizeStr: string): number {
  const units = {
    k: 1024,
    m: 1024 * 1024,
    g: 1024 * 1024 * 1024,
  };
  
  const match = sizeStr.match(/^(\d+)([kmg])?$/i);
  if (!match) {
    return 10 * 1024 * 1024; // デフォルト10MB
  }
  
  const size = parseInt(match[1], 10);
  const unit = match[2]?.toLowerCase() as keyof typeof units;
  
  return size * (unit ? units[unit] : 1);
}

// ロギングレベルのエクスポート
export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly',
};

// 型定義
export type LogLevel = keyof typeof LogLevel;
export type LogMetadata = Record<string, any>;

// ロギングAPIの拡張
export const log = {
  error: (message: string, metadata?: LogMetadata) => logger.error(message, metadata),
  warn: (message: string, metadata?: LogMetadata) => logger.warn(message, metadata),
  info: (message: string, metadata?: LogMetadata) => logger.info(message, metadata),
  http: (message: string, metadata?: LogMetadata) => logger.http(message, metadata),
  verbose: (message: string, metadata?: LogMetadata) => logger.verbose(message, metadata),
  debug: (message: string, metadata?: LogMetadata) => logger.debug(message, metadata),
  silly: (message: string, metadata?: LogMetadata) => logger.silly(message, metadata),
};
