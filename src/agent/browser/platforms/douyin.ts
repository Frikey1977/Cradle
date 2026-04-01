/**
 * 抖音平台适配器
 */

import type {
  PlatformVideo,
  PlatformVideoDetail,
  PlatformUserProfile,
  PlatformElement,
  PlatformSnapshotResult,
} from "./types.js";
import { BasePlatformAdapter } from "./base.js";

export class DouyinAdapter extends BasePlatformAdapter {
  readonly name = "douyin" as const;
  readonly displayName = "抖音";
  
  match(url: string): boolean {
    return /douyin\.com/i.test(url);
  }
  
  getScrollContainer(): string {
    return ".route-scroll-container, [class*='route-scroll']";
  }
  
  getVideoListSelector(): string {
    return "a[href^='/video/']:not([href*='source='])";
  }
  
  getPageType(url: string): PlatformSnapshotResult["pageType"] {
    if (/\/user\//i.test(url)) return "user";
    if (/\/video\//i.test(url)) return "video";
    if (/\/search/i.test(url)) return "search";
    if (/^https?:\/\/(www\.)?douyin\.com\/?$/i.test(url)) return "home";
    return "unknown";
  }
  
  extractVideoList(): PlatformVideo[] {
    const selector = this.getVideoListSelector();
    const links = document.querySelectorAll(selector);
    const videos: PlatformVideo[] = [];
    
    links.forEach((link) => {
      const el = link as HTMLAnchorElement;
      const href = el.getAttribute("href");
      const text = el.textContent || "";
      
      const videoIdMatch = href?.match(/\/video\/(\d+)/);
      if (!videoIdMatch) return;
      
      const videoId = videoIdMatch[1];
      
      const likeMatch = text.match(/(置顶)?(\d+\.?\d*[万亿])/);
      const likeCount = likeMatch?.[2] || likeMatch?.[1] || "";
      
      const title = text
        .replace(/(置顶)?\d+\.?\d*[万亿]/, "")
        .replace(/^\d+/, "")
        .trim();
      
      videos.push({
        videoId,
        url: `https://www.douyin.com${href}`,
        title,
        likeCount,
      });
    });
    
    return videos;
  }
  
  extractVideoDetail(): PlatformVideoDetail | null {
    const url = window.location.href;
    const videoIdMatch = url.match(/\/video\/(\d+)/);
    if (!videoIdMatch) return null;
    
    const videoId = videoIdMatch[1];
    const pageText = document.body.innerText;
    
    const titleMatch = pageText.match(/展开(.+?)收起/);
    const title = titleMatch?.[1] || document.title.replace(" - 抖音", "");
    
    const publishMatch = pageText.match(/发布时间[：:]\s*(\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2})/);
    const publishTime = publishMatch?.[1];
    
    const likeMatch = pageText.match(/(\d+\.?\d*[万亿])\s*点赞/);
    const likeCount = likeMatch?.[1];
    
    const authorMatch = pageText.match(/@(.+?)\s/);
    const author = authorMatch?.[1];
    
    const fansMatch = pageText.match(/粉丝(\d+\.?\d*[万亿])/);
    const authorFans = fansMatch?.[1];
    
    return {
      videoId,
      url,
      title,
      likeCount,
      publishTime,
      author,
      authorFans,
    };
  }
  
  extractUserProfile(): PlatformUserProfile | null {
    const url = window.location.href;
    if (!/\/user\//i.test(url)) return null;
    
    const secUidMatch = url.match(/\/user\/([A-Za-z0-9_-]+)/);
    const secUid = secUidMatch?.[1];
    
    const pageText = document.body.innerText;
    
    const nicknameMatch = pageText.match(/(.+?)的抖音/);
    const nickname = nicknameMatch?.[1]?.trim();
    
    const fansMatch = pageText.match(/粉丝(\d+\.?\d*[万亿]?)/);
    const followerCount = this.parseCount(fansMatch?.[1]);
    
    const followMatch = pageText.match(/关注(\d+)/);
    const followingCount = this.parseCount(followMatch?.[1]);
    
    const worksMatch = pageText.match(/作品(\d+)/);
    const videoCount = worksMatch ? parseInt(worksMatch[1], 10) : undefined;
    
    const likesMatch = pageText.match(/获赞(\d+\.?\d*[万亿]?)/);
    const likeCount = this.parseCount(likesMatch?.[1]);
    
    return {
      userId: secUid || "",
      secUid,
      nickname: nickname || "",
      followerCount,
      followingCount,
      videoCount,
      likeCount,
    };
  }
  
  getInteractiveElements(): PlatformElement[] {
    const elements: PlatformElement[] = [];
    const url = window.location.href;
    const pageType = this.getPageType(url);
    
    if (pageType === "user") {
      const videoLinks = document.querySelectorAll(this.getVideoListSelector());
      videoLinks.forEach((link, index) => {
        const el = link as HTMLAnchorElement;
        const href = el.getAttribute("href") || "";
        const videoIdMatch = href.match(/\/video\/(\d+)/);
        
        if (videoIdMatch) {
          elements.push({
            ref: `video-${index}`,
            type: "video",
            selector: `a[href="${href}"]`,
            description: `视频 #${index + 1}`,
            data: {
              videoId: videoIdMatch[1],
              url: `https://www.douyin.com${href}`,
            },
          });
        }
      });
      
      const tabs = document.querySelectorAll("[class*='tab']");
      tabs.forEach((tab, index) => {
        elements.push({
          ref: `tab-${index}`,
          type: "tab",
          selector: `[class*='tab']:nth-child(${index + 1})`,
          description: tab.textContent?.trim() || `标签 #${index + 1}`,
        });
      });
    }
    
    if (pageType === "video") {
      const likeBtn = document.querySelector("[class*='like'], [data-e2e='like']");
      if (likeBtn) {
        elements.push({
          ref: "like-btn",
          type: "button",
          selector: "[class*='like'], [data-e2e='like']",
          description: "点赞按钮",
        });
      }
      
      const commentBtn = document.querySelector("[class*='comment'], [data-e2e='comment']");
      if (commentBtn) {
        elements.push({
          ref: "comment-btn",
          type: "button",
          selector: "[class*='comment'], [data-e2e='comment']",
          description: "评论按钮",
        });
      }
    }
    
    return elements;
  }
  
  private parseCount(str?: string): number | undefined {
    if (!str) return undefined;
    
    const num = parseFloat(str);
    if (isNaN(num)) return undefined;
    
    if (str.includes("万")) {
      return Math.round(num * 10000);
    }
    if (str.includes("亿")) {
      return Math.round(num * 100000000);
    }
    return Math.round(num);
  }
}

export const douyinAdapter = new DouyinAdapter();
