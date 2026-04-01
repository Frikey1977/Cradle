import { requestClient } from "#/api/request";

export namespace TranslationApi {
  export interface SyncTranslationDto {
    key: string;
    values?: {
      zh?: string;
      en?: string;
    };
  }

  export interface BatchSyncTranslationDto {
    items: Array<{
      key: string;
      values?: {
        zh?: string;
        en?: string;
      };
    }>;
  }

  export interface SyncResult {
    success: boolean;
    message: string;
  }

  export interface BatchSyncResult {
    success: boolean;
    results: Array<{
      key: string;
      success: boolean;
      message: string;
    }>;
  }
}

/**
 * 同步单个翻译键
 * @param data 翻译数据
 */
export async function syncTranslation(data: TranslationApi.SyncTranslationDto) {
  return requestClient.post<TranslationApi.SyncResult>("/translation/sync", data);
}

/**
 * 批量同步翻译键
 * @param data 批量翻译数据
 */
export async function batchSyncTranslations(data: TranslationApi.BatchSyncTranslationDto) {
  return requestClient.post<TranslationApi.BatchSyncResult>("/translation/batch-sync", data);
}
