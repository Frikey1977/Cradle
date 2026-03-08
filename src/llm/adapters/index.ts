/**
 * 模型适配器模块导出
 */

// 接口定义
export type {
  IModelAdapter,
  IRealtimeSession,
  AdapterConfig,
  ModelType,
  ModelCapability,
  MultimodalInput,
  TTSOptions,
  STTOptions,
  RealtimeSessionConfig,
  RoutingDecision,
} from "./model-adapter-interface.js";

// 基础类
export { BaseModelAdapter } from "./base-adapter.js";

// 具体适配器实现
export { OpenAICompatibleAdapter } from "./openai-compatible-adapter.js";
export { QwenOmniAdapter } from "./qwen-omni-adapter.js";
export { RealtimeSpeechAdapter } from "./realtime-speech-adapter.js";
export { SpeechRecognitionAdapter } from "./speech-recognition-adapter.js";

// 工厂
export {
  AdapterFactory,
  createAdapter,
  createFromInstanceConfig,
  type AdapterFactoryOptions,
} from "./adapter-factory.js";
