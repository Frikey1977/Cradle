/**
 * 平台适配器 - 注册表
 */

import type { PlatformAdapter, PlatformName, PlatformSnapshotResult } from "./types.js";
import { douyinAdapter } from "./douyin.js";

class PlatformRegistry {
  private adapters: Map<PlatformName, PlatformAdapter> = new Map();
  
  constructor() {
    this.register(douyinAdapter);
  }
  
  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }
  
  get(name: PlatformName): PlatformAdapter | undefined {
    return this.adapters.get(name);
  }
  
  detect(url: string): PlatformAdapter {
    const adapters = Array.from(this.adapters.values());
    for (const adapter of adapters) {
      if (adapter.match(url)) {
        return adapter;
      }
    }
    return this.get("generic")!;
  }
  
  getAll(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const platformRegistry = new PlatformRegistry();

export function getPlatformAdapter(url: string): PlatformAdapter {
  return platformRegistry.detect(url);
}

export function createPlatformSnapshotScript(platformName: PlatformName): string {
  const adapter = platformRegistry.get(platformName);
  if (!adapter) {
    return `
      (function() {
        return {
          platform: 'generic',
          pageType: 'unknown',
          videos: [],
          elements: [],
          pageText: document.body.innerText
        };
      })()
    `;
  }
  
  return `
    (function() {
      const url = window.location.href;
      const pageText = document.body.innerText;
      
      // 提取视频列表
      function extractVideoList() {
        const selector = "${adapter.getVideoListSelector()}";
        if (!selector) return [];
        
        const links = document.querySelectorAll(selector);
        const videos = [];
        
        links.forEach(function(link, index) {
          var el = link;
          var href = el.getAttribute('href');
          var text = el.textContent || '';
          
          var videoIdMatch = href ? href.match(/\\/video\\/(\\d+)/) : null;
          if (!videoIdMatch) return;
          
          var videoId = videoIdMatch[1];
          var likeMatch = text.match(/(置顶)?(\\d+\\.?\\d*[万亿])/);
          var likeCount = likeMatch ? (likeMatch[2] || likeMatch[1]) : '';
          var title = text.replace(/(置顶)?\\d+\\.?\\d*[万亿]/, '').replace(/^\\d+/, '').trim();
          
          videos.push({
            videoId: videoId,
            url: 'https://www.douyin.com' + href,
            title: title,
            likeCount: likeCount
          });
        });
        
        return videos;
      }
      
      // 判断页面类型
      function getPageType(url) {
        if (/\\/user\\//i.test(url)) return 'user';
        if (/\\/video\\//i.test(url)) return 'video';
        if (/\\/search/i.test(url)) return 'search';
        if (/^https?:\\/\\/(www\\.)?douyin\\.com\\/?$/i.test(url)) return 'home';
        return 'unknown';
      }
      
      // 提取用户信息
      function extractUserProfile() {
        var url = window.location.href;
        if (!/\\/user\\//i.test(url)) return null;
        
        var secUidMatch = url.match(/\\/user\\/([A-Za-z0-9_-]+)/);
        var secUid = secUidMatch ? secUidMatch[1] : '';
        
        var pageText = document.body.innerText;
        var nicknameMatch = pageText.match(/(.+?)的抖音/);
        var nickname = nicknameMatch ? nicknameMatch[1].trim() : '';
        
        var fansMatch = pageText.match(/粉丝(\\d+\\.?\\d*[万亿]?)/);
        var followerCount = fansMatch ? parseCount(fansMatch[1]) : undefined;
        
        var worksMatch = pageText.match(/作品(\\d+)/);
        var videoCount = worksMatch ? parseInt(worksMatch[1], 10) : undefined;
        
        return {
          userId: secUid,
          secUid: secUid,
          nickname: nickname,
          followerCount: followerCount,
          videoCount: videoCount
        };
      }
      
      // 解析数字
      function parseCount(str) {
        if (!str) return undefined;
        var num = parseFloat(str);
        if (isNaN(num)) return undefined;
        if (str.includes('万')) return Math.round(num * 10000);
        if (str.includes('亿')) return Math.round(num * 100000000);
        return Math.round(num);
      }
      
      // 获取交互元素
      function getInteractiveElements() {
        var elements = [];
        var pageType = getPageType(url);
        
        if (pageType === 'user') {
          var videoLinks = document.querySelectorAll("${adapter.getVideoListSelector()}");
          videoLinks.forEach(function(link, index) {
            var href = link.getAttribute('href') || '';
            var videoIdMatch = href.match(/\\/video\\/(\\d+)/);
            if (videoIdMatch) {
              elements.push({
                ref: 'video-' + index,
                type: 'video',
                selector: 'a[href="' + href + '"]',
                description: '视频 #' + (index + 1),
                data: {
                  videoId: videoIdMatch[1],
                  url: 'https://www.douyin.com' + href
                }
              });
            }
          });
        }
        
        return elements;
      }
      
      // 提取评论
      function extractComments() {
        var comments = [];
        var lines = pageText.split('\\n');
        var currentComment = null;
        var commentIndex = 0;
        
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          
          if (line === '大家都在搜：') break;
          if (line === '获取评论') continue;
          if (line === '加载中') break;
          if (line.includes('前往西瓜视频')) continue;
          if (line === '分享' || line === '回复') continue;
          if (line.startsWith('展开') && line.endsWith('条回复')) continue;
          if (line === '...') continue;
          
          var timeLocationMatch = line.match(/^(\\d+[^\\d]+前|刚刚)·(.+)$/);
          if (timeLocationMatch && currentComment) {
            currentComment.time = timeLocationMatch[1];
            currentComment.location = timeLocationMatch[2];
            continue;
          }
          
          var likeMatch = line.match(/^(\\d+)$/);
          if (likeMatch && currentComment && currentComment.time) {
            currentComment.likeCount = likeMatch[1];
            comments.push(currentComment);
            currentComment = null;
            continue;
          }
          
          if (line.length > 2 && !currentComment) {
            currentComment = {
              index: commentIndex++,
              author: line,
              content: '',
              likeCount: '',
              time: '',
              location: ''
            };
            continue;
          }
          
          if (currentComment && line.length > 2 && !currentComment.time) {
            if (currentComment.content) {
              currentComment.content += '\\n' + line.slice(0, 200);
            } else {
              currentComment.content = line.slice(0, 200);
            }
          }
        }
        
        return comments.slice(0, 20);
      }
      
      return {
        platform: '${adapter.name}',
        pageType: getPageType(url),
        videos: extractVideoList(),
        user: extractUserProfile(),
        comments: extractComments(),
        elements: getInteractiveElements(),
        pageText: pageText.slice(0, 50000)
      };
    })()
  `;
}

export function createScrollScript(platformName: PlatformName): string {
  const adapter = platformRegistry.get(platformName);
  const container = adapter?.getScrollContainer() || "window";
  
  if (container === "window") {
    return `window.scrollTo(0, document.body.scrollHeight)`;
  }
  
  return `
    (function() {
      var container = document.querySelector('${container}');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    })()
  `;
}
