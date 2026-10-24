import type { ConnectOptions } from 'mongoose';

export const DEFAULT_DB_NAME: string;
export function normalizeCluster(input: string): string;
export function getMongoUri(env?: NodeJS.ProcessEnv): string;
export function getConnectOptions(env?: NodeJS.ProcessEnv): ConnectOptions;
export function explainConnectionError(error: unknown): string;
