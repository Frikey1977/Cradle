(function() {
  var url = window.location.href;
  var pageText = document.body.innerText;
  
  // 获取分页参数（从 window 对象或 URL 参数）
  var pageSize = (typeof window !== 'undefined' && window.douyinPageSize) || 12;
  var pageNum = (typeof window !== 'undefined' && window.douyinPageNum) || 1;
  
  // 下载按钮样式
  var downloadBtnStyle = 'position: absolute; top: 8px; right: 8px; z-index: 100; background: rgba(0, 0, 0, 0.7); color: #fff; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s;';
  
  // 解析数量（万/亿转换）
  function parseCount(str) {
    if (!str) return undefined;
    var num = parseFloat(str);
    if (isNaN(num)) return undefined;
    if (str.includes('万')) return Math.round(num * 10000);
    if (str.includes('亿')) return Math.round(num * 100000000);
    return Math.round(num);
  }
  
  // 从视频卡片提取视频数据（参考 datatool 插件逻辑）
  function extractVideoDataFromCard(cardElement) {
    try {
      // 方法1: 从 React Fiber 提取（datatool 插件方式）
      var reactKey = Object.keys(cardElement).find(function(k) { 
        return k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'); 
      });
      
      if (reactKey && cardElement[reactKey]) {
        var fiber = cardElement[reactKey];
        var current = fiber;
        var maxDepth = 20;
        while (current && maxDepth-- > 0) {
          if (current.memoizedProps) {
            if (current.memoizedProps.videoData) {
              return current.memoizedProps.videoData;
            }
            if (current.memoizedProps.children) {
              var children = Array.isArray(current.memoizedProps.children) 
                ? current.memoizedProps.children 
                : [current.memoizedProps.children];
              for (var i = 0; i < children.length; i++) {
                if (children[i] && children[i].props && children[i].props.videoData) {
                  return children[i].props.videoData;
                }
              }
            }
          }
          current = current.return || current._debugOwner;
        }
      }
      
      // 方法2: 从 DOM 属性提取
      var videoId = cardElement.getAttribute('data-video-id');
      if (videoId) {
        return { id: videoId };
      }
      
      // 方法3: 从链接提取
      var link = cardElement.querySelector('a[href*="/video/"]');
      if (link) {
        var href = link.getAttribute('href');
        var match = href && href.match(/\/video\/(\d+)/);
        if (match) {
          return { id: match[1] };
        }
      }
    } catch (e) {
      console.log('[DouyinDownload] Extract error:', e);
    }
    return null;
  }
  
  // 获取视频下载地址
  function getVideoDownloadUrl(videoData) {
    if (!videoData) return null;
    
    // 从 video.bitrateInfo 获取（datatool 插件逻辑）
    if (videoData.video && videoData.video.bitrateInfo && videoData.video.bitrateInfo.length > 0) {
      var playAddr = videoData.video.bitrateInfo[0].PlayAddr;
      if (playAddr && playAddr.UrlList && playAddr.UrlList.length > 0) {
        return {
          url: playAddr.UrlList[0],
          size: playAddr.DataSize,
          format: 'mp4'
        };
      }
    }
    
    // 备用：从 playAddr 直接获取
    if (videoData.video && videoData.video.playAddr) {
      var addr = videoData.video.playAddr;
      if (addr.urlList && addr.urlList.length > 0) {
        return {
          url: addr.urlList[0],
          size: addr.size || 0,
          format: 'mp4'
        };
      }
    }
    
    return null;
  }
  
  // 创建下载按钮
  function createDownloadButton(videoData) {
    var btn = document.createElement('button');
    btn.className = 'douyin-download-btn';
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>下载</span>';
    btn.style.cssText = downloadBtnStyle;
    
    btn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      var downloadInfo = getVideoDownloadUrl(videoData);
      if (downloadInfo && downloadInfo.url) {
        // 发送消息给父窗口或扩展
        window.postMessage({
          type: 'DOUYIN_DOWNLOAD',
          videoId: videoData.id,
          downloadUrl: downloadInfo.url,
          title: videoData.title || videoData.desc
        }, '*');
        
        console.log('[DouyinDownload] Download URL:', downloadInfo.url);
        alert('视频下载地址已获取，请在扩展面板中查看');
      } else {
        console.log('[DouyinDownload] No download URL found');
        alert('无法获取视频下载地址，请重试');
      }
    };
    
    return btn;
  }
  
  // 注入下载按钮到视频卡片
  function injectDownloadButtons() {
    // 查找所有视频卡片
    var cards = document.querySelectorAll('a[href^="/video/"], div[class*="VideoCard"], a[class*="videoCard"]');
    
    cards.forEach(function(card) {
      // 避免重复注入
      if (card.querySelector('.douyin-download-btn')) {
        return;
      }
      
      // 确保卡片有相对定位
      var computedStyle = window.getComputedStyle(card);
      if (computedStyle.position === 'static') {
        card.style.position = 'relative';
      }
      
      // 提取视频数据
      var videoData = extractVideoDataFromCard(card);
      
      if (videoData && videoData.id) {
        // 创建并注入下载按钮
        var btn = createDownloadButton(videoData);
        card.appendChild(btn);
        
        console.log('[DouyinDownload] Button injected for video:', videoData.id);
      }
    });
    
    return cards.length;
  }
  
  // 初始化下载按钮注入
  function initDownloadButtons() {
    // 立即执行一次
    injectDownloadButtons();
    
    // 监听 DOM 变化，为新加载的视频注入按钮
    var observer = new MutationObserver(function(mutations) {
      var shouldInject = false;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes.length > 0) {
          shouldInject = true;
          break;
        }
      }
      if (shouldInject) {
        setTimeout(injectDownloadButtons, 500);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('[DouyinDownload] Observer initialized');
  }
  
  // 启动注入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDownloadButtons);
  } else {
    initDownloadButtons();
  }
  
  function extractUserProfile() {
    var secUidMatch = url.match(/\/user\/([A-Za-z0-9_-]+)/);
    var secUid = secUidMatch ? secUidMatch[1] : '';
    
    // 尝试多种方式获取昵称
    var nickname = '';
    
    // 方法1: 从 document.title 提取 (格式: "昵称的抖音 - 抖音")
    var titleMatch = document.title.match(/(.+?)的抖音/);
    if (titleMatch) {
      nickname = titleMatch[1].trim();
    }
    
    // 方法2: 从 h1 元素提取
    if (!nickname) {
      var h1El = document.querySelector('h1');
      if (h1El && h1El.textContent) {
        nickname = h1El.textContent.trim();
      }
    }
    
    // 方法3: 从 pageText 提取
    if (!nickname) {
      var nicknameMatch = pageText.match(/(.+?)的抖音/);
      nickname = nicknameMatch ? nicknameMatch[1].trim() : '';
    }
    
    // 获取抖音号
    var douyinId = '';
    var douyinIdMatch = pageText.match(/抖音号[:：]\s*(\d+)/);
    if (douyinIdMatch) {
      douyinId = douyinIdMatch[1];
    }
    
    // 获取主页地址（优先使用短链接）
    var homepageUrl = '';
    
    // 方法1: 尝试从页面文本中提取短链接
    var shortUrlMatch = pageText.match(/(https:\/\/v\.douyin\.com\/[a-zA-Z0-9_-]+)/);
    if (shortUrlMatch) {
      homepageUrl = shortUrlMatch[1];
    }
    
    // 方法2: 使用长链接作为备选
    if (!homepageUrl && secUid) {
      homepageUrl = 'https://www.douyin.com/user/' + secUid;
    }
    
    // 获取IP属地
    var ipLocation = '';
    var ipMatch = pageText.match(/IP属地[:：]\s*([^\r\n]+)/);
    if (ipMatch) {
      ipLocation = ipMatch[1].trim();
    }
    
    // 获取年龄
    var age = '';
    var ageMatch = pageText.match(/(\d+)岁/);
    if (ageMatch) {
      age = ageMatch[1];
    }
    
    // 获取关注数、粉丝数、获赞数
    var followingCount = undefined;
    var followerCount = undefined;
    var likeCount = undefined;
    
    var statEls = document.querySelectorAll('[class*="stat"], [data-e2e="user-info-stats"] *');
    statEls.forEach(function(el) {
      var text = el.textContent || '';
      if (text.includes('关注')) {
        var match = text.match(/(\d+\.?\d*[万亿]?)/);
        if (match) followingCount = parseCount(match[1]);
      }
      if (text.includes('粉丝')) {
        var match = text.match(/(\d+\.?\d*[万亿]?)/);
        if (match) followerCount = parseCount(match[1]);
      }
      if (text.includes('获赞')) {
        var match = text.match(/(\d+\.?\d*[万亿]?)/);
        if (match) likeCount = parseCount(match[1]);
      }
    });
    
    if (!followerCount) {
      var fansMatch = pageText.match(/粉丝(\d+\.?\d*[万亿]?)/);
      followerCount = fansMatch ? parseCount(fansMatch[1]) : undefined;
    }
    if (!likeCount) {
      var likeMatch = pageText.match(/获赞(\d+\.?\d*[万亿]?)/);
      likeCount = likeMatch ? parseCount(likeMatch[1]) : undefined;
    }
    
    // 获取作品数量（从页面统计信息）
    var worksCount = undefined;
    var worksMatch = pageText.match(/作品[:：]?\s*(\d+)/);
    if (worksMatch) {
      worksCount = parseInt(worksMatch[1], 10);
    }
    
    // 如果页面没有显示，尝试从其他位置获取
    if (!worksCount) {
      var worksEl = document.querySelector('[data-e2e="user-tab-count"], [class*="works"]');
      if (worksEl) {
        var worksText = worksEl.textContent || '';
        var worksNumMatch = worksText.match(/(\d+)/);
        if (worksNumMatch) {
          worksCount = parseInt(worksNumMatch[1], 10);
        }
      }
    }
    
    return {
      userId: douyinId || secUid,
      secUid: secUid,
      nickname: nickname,
      douyinId: douyinId,
      homepageUrl: homepageUrl,
      ipLocation: ipLocation,
      age: age,
      followingCount: followingCount,
      followerCount: followerCount,
      likeCount: likeCount,
      worksCount: worksCount
    };
  }
  
  function extractVideoElements() {
    var selector = "a[href^='/video/']:not([href*='source='])";
    var links = document.querySelectorAll(selector);
    var allElements = [];
    var seen = new Set();
    var index = 0;
    
    links.forEach(function(link) {
      var href = link.getAttribute('href');
      if (!href || seen.has(href)) return;
      
      var videoIdMatch = href.match(/\/video\/(\d+)/);
      if (!videoIdMatch) return;
      
      seen.add(href);
      var text = link.textContent || '';
      var videoId = videoIdMatch[1];
      
      var likeMatch = text.match(/(置顶)?(\d+\.?\d*[万亿])/);
      var likeCount = likeMatch ? (likeMatch[2] || likeMatch[1]) : '';
      var title = text.replace(/(置顶)?\d+\.?\d*[万亿]/, '').replace(/^\d+/, '').trim();
      
      // 尝试从卡片提取更详细的数据
      var card = link.closest('a[class*="VideoCard"], div[class*="VideoCard"], a[class*="videoCard"]') || link;
      var videoData = extractVideoDataFromCard(card);
      var downloadBtn = card.querySelector('.douyin-download-btn');
      
      allElements.push({
        ref: 'r' + (++index),
        type: 'video',
        videoId: videoId,
        title: title,
        likeCount: likeCount,
        selector: 'a[href="' + href + '"]'
      });
    });
    
    return allElements;
  }
  
  // 获取分页视频列表
  function getPagedVideoElements(allElements, pageNum, pageSize) {
    var startIndex = (pageNum - 1) * pageSize;
    var endIndex = startIndex + pageSize;
    
    // 确保不超出范围
    if (startIndex >= allElements.length) {
      return [];
    }
    
    return allElements.slice(startIndex, endIndex);
  }
  
  // 获取所有视频元素
  var allVideoElements = extractVideoElements();
  
  // 获取分页后的视频元素
  var pagedElements = getPagedVideoElements(allVideoElements, pageNum, pageSize);
  
  // 获取用户信息
  var userProfile = extractUserProfile();
  
  // 如果用户作品数量未获取到，使用实际加载的视频数量
  if (!userProfile.worksCount) {
    userProfile.worksCount = allVideoElements.length;
  }
  
  return {
    platform: 'douyin',
    pageType: 'user',
    pagination: {
      pageNum: pageNum,
      pageSize: pageSize,
      totalLoaded: allVideoElements.length,
      returned: pagedElements.length,
      hasMore: allVideoElements.length > pageNum * pageSize
    },
    elements: pagedElements,
    user: userProfile,
    pageText: pageText.slice(0, 50000)
  };
})();