import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getDouyinUserScript(): string {
  // 从外部文件读取脚本，避免模板字符串转义问题
  // 尝试多个可能的路径（开发环境和生产环境）
  const possiblePaths = [
    join(__dirname, 'douyin-user.js'),
    join(__dirname, '..', '..', '..', '..', 'src', 'agent', 'browser', 'scripts', 'douyin-user.js'),
    join(process.cwd(), 'src', 'agent', 'browser', 'scripts', 'douyin-user.js'),
  ];

  for (const path of possiblePaths) {
    try {
      return readFileSync(path, 'utf-8');
    } catch {
      // Continue to next path
    }
  }

  throw new Error('Could not find douyin-user.js script file');
}

export function getDouyinVideoScript(): string {
  // Read the script from external file to avoid template string escaping issues
  // Try multiple possible paths for different environments
  const possiblePaths = [
    join(__dirname, 'douyin-video.js'),
    join(__dirname, '..', '..', '..', '..', 'src', 'agent', 'browser', 'scripts', 'douyin-video.js'),
    join(process.cwd(), 'src', 'agent', 'browser', 'scripts', 'douyin-video.js'),
  ];
  
  for (const path of possiblePaths) {
    try {
      return readFileSync(path, 'utf-8');
    } catch {
      // Continue to next path
    }
  }
  
  // Fallback: return inline script if file not found
  return `(function() {
    var url = window.location.href;
    var pageText = document.body.innerText;
    
    function extractVideoData() {
      // Try to extract from window._SSR_HYDRATED_DATA
      if (window._SSR_HYDRATED_DATA) {
        try {
          var data = window._SSR_HYDRATED_DATA;
          if (data.video && data.video.videoInfo) {
            return data.video.videoInfo;
          }
        } catch (e) {}
      }
      
      // Try to extract from __INITIAL_STATE__
      if (window.__INITIAL_STATE__) {
        try {
          var state = window.__INITIAL_STATE__;
          if (state.video && state.video.videoInfo) {
            return state.video.videoInfo;
          }
        } catch (e) {}
      }
      
      return null;
    }
    
    function extractComments() {
      var comments = [];
      var commentEls = document.querySelectorAll('[data-e2e="comment-list"] > div, .comment-item, [class*="CommentItem"]');
      
      commentEls.forEach(function(el, index) {
        var textEl = el.querySelector('[data-e2e="comment-content"], .comment-text, [class*="Content"]');
        var authorEl = el.querySelector('[data-e2e="comment-username"], .comment-user, [class*="UserName"]');
        var likeEl = el.querySelector('[data-e2e="comment-like-count"], .comment-like, [class*="LikeCount"]');
        
        if (textEl) {
          comments.push({
            ref: 'c' + (index + 1),
            type: 'comment',
            text: textEl.textContent || '',
            author: authorEl ? authorEl.textContent : '',
            likeCount: likeEl ? likeEl.textContent : '0'
          });
        }
      });
      
      return comments;
    }
    
    function extractVideoInfo() {
      var videoData = extractVideoData();
      var urlMatch = url.match(/\\/video\\/(\\d+)/);
      var videoId = urlMatch ? urlMatch[1] : '';
      
      return {
        videoId: videoId,
        title: document.querySelector('h1, [data-e2e="video-title"]')?.textContent || '',
        description: videoData?.desc || '',
        author: videoData?.author?.nickname || '',
        likeCount: videoData?.stats?.diggCount || '0',
        commentCount: videoData?.stats?.commentCount || '0',
        shareCount: videoData?.stats?.shareCount || '0',
        downloadUrl: videoData?.video?.playAddr?.urlList?.[0] || null
      };
    }
    
    return {
      platform: 'douyin',
      pageType: 'video',
      video: extractVideoInfo(),
      comments: extractComments(),
      elements: [],
      pageText: pageText.slice(0, 50000)
    };
  })`;
}

// Home page script for Douyin
export function getDouyinHomeScript(): string {
  return `function() {
    var url = window.location.href;
    var pageText = document.body.innerText;
    
    function getInteractiveElements() {
      var elements = [];
      var index = 0;
      
      // Video cards
      var cards = document.querySelectorAll('a[href^="/video/"]');
      cards.forEach(function(card) {
        var href = card.getAttribute('href');
        var videoIdMatch = href && href.match(/\\/video\\/(\\d+)/);
        if (videoIdMatch) {
          elements.push({
            ref: 'r' + (++index),
            type: 'video',
            videoId: videoIdMatch[1],
            selector: 'a[href="' + href + '"]'
          });
        }
      });
      
      // User links
      var users = document.querySelectorAll('a[href^="/user/"]');
      users.forEach(function(user) {
        var href = user.getAttribute('href');
        var userIdMatch = href && href.match(/\\/user\\/([A-Za-z0-9_-]+)/);
        if (userIdMatch) {
          elements.push({
            ref: 'r' + (++index),
            type: 'user',
            userId: userIdMatch[1],
            selector: 'a[href="' + href + '"]' 
          });
        }
      });
      
      return elements;
    }
    
    return {
      platform: 'douyin',
      pageType: 'home',
      elements: getInteractiveElements(),
      pageText: pageText.slice(0, 50000)
    };
  }`;
}

// Search page script for Douyin
export function getDouyinSearchScript(): string {
  return `function() {
    var url = window.location.href;
    var pageText = document.body.innerText;
    
    function extractVideoList() {
      var videos = [];
      var items = document.querySelectorAll('a[href*="/video/"]');
      var index = 0;
      
      items.forEach(function(item) {
        var href = item.getAttribute('href');
        var match = href && href.match(/\\/video\\/(\\d+)/);
        if (match) {
          var text = item.textContent || '';
          var likeMatch = text.match(/(\\d+\\.?\\d*[万亿])/);
          
          videos.push({
            ref: 'r' + (++index),
            type: 'video',
            videoId: match[1],
            title: text.slice(0, 100),
            likeCount: likeMatch ? likeMatch[1] : '',
            selector: 'a[href="' + href + '"]'
          });
        }
      });
      
      return videos;
    }
    
    function getInteractiveElements() {
      var elements = [];
      var index = 0;
      
      // Search input
      var searchInput = document.querySelector('input[type="search"], input[placeholder*="搜索"], [data-e2e="search-input"]');
      if (searchInput) {
        elements.push({
          ref: 'r' + (++index),
          type: 'input',
          selector: 'input[type="search"]'
        });
      }
      
      // Tab buttons
      var tabs = document.querySelectorAll('[role="tab"], .tab, [data-e2e="search-tab"]');
      tabs.forEach(function(tab, i) {
        elements.push({
          ref: 'r' + (++index),
          type: 'tab',
          selector: '[role="tab"]:nth-child(' + (i + 1) + ')'
        });
      });
      
      // Video cards
      var videos = extractVideoList();
      elements = elements.concat(videos);
      
      return elements;
    }
    
    return {
      platform: 'douyin',
      pageType: 'search',
      videos: extractVideoList(),
      elements: getInteractiveElements(),
      pageText: pageText.slice(0, 50000)
    };
  }`;
}
