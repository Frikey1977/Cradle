/**
 * 模型适配器工厂
 * 根据模型类型和配置创建对应的适配器实例
 */

import type { IModelAdapter, AdapterConfig, ModelType } from "./model-adapter-interface.js";
import { OpenAICompatibleAdapter } from "./openai-compatible-adapter.js";
import { QwenOmniAdapter } from "./qwen-omni-adapter.js";
import { RealtimeSpeechAdapter } from "./realtime-speech-adapter.js";
import { SpeechRecognitionAdapter } from "./speech-recognition-adapter.js";

/** 适配器创建选项 */
export interface AdapterFactoryOptions {
  /** 强制使用特定适配器类型 */
  forceAdapter?: string;
  /** 重试配置 */
  retryConfig?: {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
  };
}

/** 适配器工厂类 */
export class AdapterFactory {
  private static instance: AdapterFactory;
  private adapterCache = new Map<string, IModelAdapter>();
  
  /**
   * 获取单例实例
   */
  static getInstance(): AdapterFactory {
    if (!AdapterFactory.instance) {
      AdapterFactory.instance = new AdapterFactory();
    }
    return AdapterFactory.instance;
  }
  
  /**
   * 创建适配器
   * @param config 适配器配置
   * @param options 创建选项
   */
  createAdapter(config: AdapterConfig, options: AdapterFactoryOptions = {}): IModelAdapter {
    // 检查缓存
    const cacheKey = this.getCacheKey(config);
    if (this.adapterCache.has(cacheKey)) {
      console.log(`[AdapterFactory] Using cached adapter for: ${config.modelName}`);
      return this.adapterCache.get(cacheKey)!;
    }
    
    // 根据配置选择适配器类型
    const adapterType = this.determineAdapterType(config, options);
    console.log(`[AdapterFactory] Creating ${adapterType} adapter for: ${config.modelName}`);
    
    let adapter: IModelAdapter;
    
    switch (adapterType) {
      case "qwen-omni":
        adapter = new QwenOmniAdapter(config);
        break;
        
      case "realtime":
        adapter = new RealtimeSpeechAdapter(config);
        break;
        
      case "speech-recognition":
        adapter = new SpeechRecognitionAdapter(config);
        break;
        
      case "openai-compatible":
      default:
        adapter = new OpenAICompatibleAdapter(config);
        break;
    }
    
    // 缓存适配器
    this.adapterCache.set(cacheKey, adapter);
    
    return adapter;
  }
  
  /**
   * 确定适配器类型
   */
  private determineAdapterType(
    config: AdapterConfig,
    options: AdapterFactoryOptions
  ): string {
    // 如果强制指定了适配器类型
    if (options.forceAdapter) {
      return options.forceAdapter;
    }
    
    const modelName = config.modelName.toLowerCase();
    const provider = config.provider?.toLowerCase() || "";
    
    // 1. 检测实时语音模型
    if (
      modelName.includes("realtime") ||
      modelName.includes("live") ||
      modelName.includes("streaming-asr")
    ) {
      return "realtime";
    }
    
    // 2. 检测专用 ASR 模型
    if (
      modelName.includes("paraformer") ||
      modelName.includes("whisper") ||
      modelName.includes("asr") ||
      modelName.includes("speech-to-text")
    ) {
      return "speech-recognition";
    }
    
    // 3. 检测 Qwen-Omni 模型
    if (
      modelName.includes("qwen") &&
      (modelName.includes("omni") || modelName.includes("audio"))
    ) {
      return "qwen-omni";
    }
    
    // 4. 检测 GPT-4o Audio（实时语音）
    if (
      modelName.includes("gpt-4o") &&
      (modelName.includes("audio") || modelName.includes("realtime"))
    ) {
      return "realtime";
    }
    
    // 5. 默认使用 OpenAI 兼容适配器
    return "openai-compatible";
  }
  
  /**
   * 获取缓存键
   */
  private getCacheKey(config: AdapterConfig): string {
    return `${config.provider}:${config.modelName}:${config.apiKey.substring(0, 8)}`;
  }
  
  /**
   * 从数据库配置创建适配器
   * @param instanceConfig 数据库中的实例配置
   */
  createFromInstanceConfig(instanceConfig: {
    sid: string;
    name: string;
    providerName: string;
    modelName: string;
    baseUrl: string;
    apiKey: string;
    headers?: string;
    modelParams?: string;
  }): IModelAdapter {
    const config: AdapterConfig = {
      modelName: instanceConfig.modelName,
      provider: instanceConfig.providerName,
      baseUrl: instanceConfig.baseUrl,
      apiKey: instanceConfig.apiKey,
      headers: instanceConfig.headers ? JSON.parse(instanceConfig.headers) : undefined,
      modelParams: instanceConfig.modelParams ? JSON.parse(instanceConfig.modelParams) : undefined,
    };
    
    return this.createAdapter(config);
  }
  
  /**
   * 获取缓存的适配器
   */
  getCachedAdapter(cacheKey: string): IModelAdapter | undefined {
    return this.adapterCache.get(cacheKey);
  }
  
  /**
   * 移除缓存的适配器
   */
  removeCachedAdapter(cacheKey: string): boolean {
    const adapter = this.adapterCache.get(cacheKey);
    if (adapter) {
      adapter.dispose().catch(console.error);
      return this.adapterCache.delete(cacheKey);
    }
    return false;
  }
  
  /**
   * 清空所有缓存
   */
  async clearCache(): Promise<void> {
    for (const [key, adapter] of this.adapterCache) {
      await adapter.dispose().catch(console.error);
    }
    this.adapterCache.clear();
  }
  
  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.adapterCache.size,
      keys: Array.from(this.adapterCache.keys()),
    };
  }
}

/** 导出便捷函数 */
export function createAdapter(config: AdapterConfig, options?: AdapterFactoryOptions): IModelAdapter {
  return AdapterFactory.getInstance().createAdapter(config, options);
}

export function createFromInstanceConfig(instanceConfig: any): IModelAdapter {
  return AdapterFactory.getInstance().createFromInstanceConfig(instanceConfig);
}
