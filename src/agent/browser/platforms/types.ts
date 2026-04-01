/**
 * 平台适配器 - 类型定义
 */

export type PlatformName = "douyin" | "bilibili" | "xiaohongshu" | "tiktok" | "youtube" | "generic";

export interface PlatformAdapter {
  readonly name: PlatformName;
  readonly displayName: string;
  
  match(url: string): boolean;
  
  getScrollContainer(): string;
  
  getVideoListSelector(): string;
  
  extractVideoList(): PlatformVideo[];
  
  extractVideoDetail(): PlatformVideoDetail | null;
  
  extractUserProfile(): PlatformUserProfile | null;
  
  getInteractiveElements(): PlatformElement[];
}

export interface PlatformVideo {
  videoId: string;
  url: string;
  title: string;
  likeCount?: string;
  commentCount?: string;
  shareCount?: string;
  collectCount?: string;
  publishTime?: string;
  coverUrl?: string;
  duration?: string;
}

export interface PlatformVideoDetail extends PlatformVideo {
  author?: string;
  authorId?: string;
  authorAvatar?: string;
  authorFans?: string;
  description?: string;
  videoUrl?: string;
  tags?: string[];
}

export interface PlatformUserProfile {
  /** 用户ID（抖音号优先） */
  userId: string;
  /** 用户的 secUid */
  secUid?: string;
  /** 抖音号 */
  douyinId?: string;
  /** 昵称 */
  nickname: string;
  /** 头像URL */
  avatar?: string;
  /** 个人简介 */
  signature?: string;
  /** 主页地址 */
  homepageUrl?: string;
  /** IP属地 */
  ipLocation?: string;
  /** 年龄 */
  age?: string;
  /** 关注数 */
  followingCount?: number;
  /** 粉丝数 */
  followerCount?: number;
  /** 作品数 */
  videoCount?: number;
  /** 获赞数 */
  likeCount?: number;
}

export interface PlatformElement {
  /** 元素引用标识，格式为 r1~r100，供 Agent 操作使用 */
  ref: string;
  type: "video" | "user" | "button" | "link" | "tab" | "other";
  /** CSS 选择器，用于 Agent 操作元素 */
  selector: string;
  /** 视频ID（视频类型元素） */
  videoId?: string;
  /** 视频标题（视频类型元素） */
  title?: string;
  /** 点赞数（视频类型元素） */
  likeCount?: string;
  /** 元素描述 */
  description?: string;
  /** 额外数据 */
  data?: Record<string, unknown>;
}

export interface PlatformComment {
  index: number;
  author: string;
  content: string;
  likeCount: string;
  time: string;
  location: string;
}

export interface PlatformSnapshotResult {
  platform: PlatformName;
  pageType: "user" | "video" | "search" | "home" | "unknown";
  /** @deprecated 使用 elements 替代，elements 已融合视频数据和交互信息 */
  videos?: PlatformVideo[];
  user?: PlatformUserProfile;
  comments?: PlatformComment[];
  /** 融合后的元素列表，视频类型元素包含完整数据和交互信息 */
  elements: PlatformElement[];
  pageText: string;
}

export const PLATFORM_PATTERNS: Record<PlatformName, RegExp[]> = {
  douyin: [/douyin\.com/i],
  bilibili: [/bilibili\.com/i, /space\.bilibili\.com/i],
  xiaohongshu: [/xiaohongshu\.com/i, /xhslink\.com/i],
  tiktok: [/tiktok\.com/i],
  youtube: [/youtube\.com/i, /youtu\.be/i],
  generic: [/.*/],
};
