import { normalizeState } from "./storage.js";

export const BACKUP_APP_ID = "subscription-management";
export const BACKUP_VERSION = 1;

export function createBackup(state, exportedAt = new Date()) {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    data: normalizeState(state),
  };
}

export function parseBackup(text) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("バックアップファイルを読み込めませんでした。");
  }

  const rawState = parsed?.app === BACKUP_APP_ID ? parsed.data : parsed;
  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) {
    throw new Error("バックアップファイルの形式が正しくありません。");
  }

  return normalizeState(rawState);
}

export function backupFileName(date = new Date()) {
  return `subscription-management-backup-${date.toISOString().slice(0, 10)}.json`;
}
