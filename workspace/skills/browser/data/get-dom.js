// 获取完整 DOM 的 JavaScript 代码
// 可以通过 browser-tool 的 evaluate 功能执行

// 方法 1: 获取完整 HTML
const getFullHTML = () => {
  return document.documentElement.outerHTML;
};

// 方法 2: 获取 body 内 HTML（更简洁）
const getBodyHTML = () => {
  return document.body.innerHTML;
};

// 方法 3: 获取序列化的 DOM 结构（包含关键信息）
const getDOMStructure = () => {
  const traverse = (node, depth = 0) => {
    if (depth > 10) return null; // 限制深度
    
    const info = {
      tag: node.tagName?.toLowerCase(),
      id: node.id || undefined,
      class: node.className || undefined,
      text: node.textContent?.substring(0, 100), // 限制文本长度
      children: []
    };
    
    // 只保留关键属性
    if (node.src) info.src = node.src;
    if (node.href) info.href = node.href;
    if (node.dataset) info.data = { ...node.dataset };
    
    // 递归处理子节点（限制数量）
    if (node.children && node.children.length > 0) {
      for (let i = 0; i < Math.min(node.children.length, 50); i++) {
        const child = traverse(node.children[i], depth + 1);
        if (child) info.children.push(child);
      }
    }
    
    return info;
  };
  
  return traverse(document.body);
};

// 方法 4: 获取视频相关元素
const getVideoElements = () => {
  const videos = document.querySelectorAll('video, [class*="video"], [class*="player"]');
  return Array.from(videos).map(v => ({
    tag: v.tagName,
    id: v.id,
    class: v.className,
    src: v.src,
    currentSrc: v.currentSrc,
    poster: v.poster,
    dataset: { ...v.dataset },
    parent: v.parentElement?.className
  }));
};

// 方法 5: 获取所有链接（可能包含视频链接）
const getAllLinks = () => {
  const links = document.querySelectorAll('a[href]');
  return Array.from(links).map(a => ({
    href: a.href,
    text: a.textContent?.trim().substring(0, 50),
    class: a.className
  })).filter(l => l.href.includes('video') || l.href.includes('douyin'));
};

// 执行并返回结果
const result = {
  url: window.location.href,
  title: document.title,
  html: getBodyHTML(),
  structure: getDOMStructure(),
  videos: getVideoElements(),
  links: getAllLinks()
};

// 限制返回大小
JSON.stringify(result).length;
