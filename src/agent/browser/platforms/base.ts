/**
 * 平台适配器 - 基础抽象类
 */

import type {
  PlatformAdapter,
  PlatformName,
  PlatformVideo,
  PlatformVideoDetail,
  PlatformUserProfile,
  PlatformElement,
  PlatformSnapshotResult,
} from "./types.js";

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly name: PlatformName;
  abstract readonly displayName: string;
  
  abstract match(url: string): boolean;
  
  getScrollContainer(): string {
    return "window";
  }
  
  getVideoListSelector(): string {
    return "";
  }
  
  extractVideoList(): PlatformVideo[] {
    return [];
  }
  
  extractVideoDetail(): PlatformVideoDetail | null {
    return null;
  }
  
  extractUserProfile(): PlatformUserProfile | null {
    return null;
  }
  
  getInteractiveElements(): PlatformElement[] {
    return [];
  }
  
  getPageType(url: string): PlatformSnapshotResult["pageType"] {
    return "unknown";
  }
  
  createSnapshotResult(
    url: string,
    pageText: string
  ): PlatformSnapshotResult {
    const user = this.extractUserProfile();
    return {
      platform: this.name,
      pageType: this.getPageType(url),
      videos: this.extractVideoList(),
      user: user || undefined,
      elements: this.getInteractiveElements(),
      pageText,
    };
  }
}
