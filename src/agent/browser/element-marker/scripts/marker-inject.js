/**
 * 元素标记器 - 页面注入脚本
 *
 * 在目标页面注入，提供元素标记功能
 * - 按住右Alt键点击元素进行选择
 * - 显示面包屑导航进行精确选择
 * - 高亮显示已标记元素
 */

(function() {
  'use strict';

  // 标记器状态
  const markerState = {
    isActive: false,
    isMarking: false,
    markMode: false,
    selectedElement: null,
    markedElements: new Map(), // ref -> element info
    elementCounter: 0,
    currentGroup: null,
    highlightOverlay: null,
    breadcrumbPanel: null,
    configPanel: null,
    markedElementsOverlay: [],
    controlBtn: null,
  };

  // 配置
  const config = {
    highlightColor: 'rgba(59, 130, 246, 0.3)',
    markedColor: 'rgba(34, 197, 94, 0.3)',
    borderColor: '#3b82f6',
    markedBorderColor: '#22c55e',
    zIndex: 2147483647, // 最大z-index
  };

  // 初始化标记器
  function initMarker() {
    if (markerState.isActive) {
      console.log('[ElementMarker] Already initialized');
      return;
    }

    console.log('[ElementMarker] Initializing...');

    // 创建UI元素
    createHighlightOverlay();
    createBreadcrumbPanel();
    createConfigPanel();

    // 绑定事件
    bindEvents();

    markerState.isActive = true;
    console.log('[ElementMarker] Initialized');
  }

  // 销毁标记器
  function destroyMarker() {
    console.log('[ElementMarker] Destroying...');

    // 移除所有UI元素
    if (markerState.highlightOverlay) {
      markerState.highlightOverlay.remove();
    }
    if (markerState.breadcrumbPanel) {
      markerState.breadcrumbPanel.remove();
    }
    if (markerState.configPanel) {
      markerState.configPanel.remove();
    }
    if (markerState.controlBtn) {
      markerState.controlBtn.remove();
    }

    // 清除高亮
    clearMarkedHighlights();

    // 移除事件监听
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleClick, true);

    markerState.isActive = false;
    markerState.markMode = false;

    console.log('[ElementMarker] Destroyed');
  }

  // 创建高亮遮罩
  function createHighlightOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'cradle-marker-highlight';
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: ${config.zIndex};
      display: none;
      border: 2px solid ${config.borderColor};
      background: ${config.highlightColor};
      transition: all 0.1s ease;
    `;
    document.body.appendChild(overlay);
    markerState.highlightOverlay = overlay;
  }

  // 创建面包屑面板
  function createBreadcrumbPanel() {
    const panel = document.createElement('div');
    panel.id = 'cradle-marker-breadcrumb';
    panel.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: ${config.zIndex + 1};
      display: none;
      max-width: 600px;
      word-break: break-all;
      pointer-events: none;
    `;
    document.body.appendChild(panel);
    markerState.breadcrumbPanel = panel;
  }

  // 创建配置面板
  function createConfigPanel() {
    const panel = document.createElement('div');
    panel.id = 'cradle-marker-config';
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: ${config.zIndex};
      display: none;
      min-width: 400px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    document.body.appendChild(panel);
    markerState.configPanel = panel;
  }

  // 高亮元素
  function highlightElement(element, color, borderColor, label) {
    const overlay = markerState.highlightOverlay;
    if (!overlay) return;

    const rect = element.getBoundingClientRect();
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.background = color;
    overlay.style.borderColor = borderColor;
    overlay.style.display = 'block';

    if (label) {
      overlay.setAttribute('data-label', label);
    }
  }

  // 隐藏高亮
  function hideHighlight() {
    if (markerState.highlightOverlay) {
      markerState.highlightOverlay.style.display = 'none';
    }
  }

  // 显示面包屑
  function showBreadcrumb(breadcrumb) {
    const panel = markerState.breadcrumbPanel;
    if (!panel) return;

    panel.innerHTML = '';
    
    // 创建可点击的面包屑项
    breadcrumb.forEach((item, index) => {
      // 添加分隔符
      if (index > 0) {
        const separator = document.createElement('span');
        separator.textContent = ' > ';
        separator.style.color = '#6b7280';
        panel.appendChild(separator);
      }
      
      // 创建可点击的元素名
      const span = document.createElement('span');
      span.textContent = item.name;
      span.style.cssText = 'cursor: pointer; color: #3b82f6; text-decoration: underline; padding: 2px 4px; border-radius: 3px;';
      span.style.hover = 'background: #e5e7eb;';
      
      // 点击高亮对应元素
      span.onclick = (e) => {
        e.stopPropagation();
        // 高亮这个元素
        highlightElement(item.element, config.highlightColor, config.borderColor);
        // 更新选中元素
        markerState.selectedElement = item.element;
      };
      
      // 悬停效果
      span.onmouseenter = () => {
        span.style.background = '#e5e7eb';
      };
      span.onmouseleave = () => {
        span.style.background = 'transparent';
      };
      
      panel.appendChild(span);
    });
    
    panel.style.display = 'block';

    // 定位在鼠标附近
    const highlight = markerState.highlightOverlay;
    if (highlight && highlight.style.display !== 'none') {
      const rect = highlight.getBoundingClientRect();
      panel.style.left = rect.left + 'px';
      panel.style.top = (rect.top - panel.offsetHeight - 8) + 'px';
    }
  }

  // 隐藏面包屑
  function hideBreadcrumb() {
    if (markerState.breadcrumbPanel) {
      markerState.breadcrumbPanel.style.display = 'none';
    }
  }

  // 暂停标记模式
  function pauseMarkMode() {
    markerState.markMode = false;
    if (markerState.controlBtn) {
      markerState.controlBtn.textContent = '[PAUSED] Mark Mode';
      markerState.controlBtn.style.background = '#f59e0b';
    }
    document.body.style.cursor = '';
    hideHighlight();
    hideBreadcrumb();
    console.log('[ElementMarker] Marking mode PAUSED');
  }

  // 恢复标记模式
  function resumeMarkMode() {
    markerState.markMode = true;
    if (markerState.controlBtn) {
      markerState.controlBtn.textContent = '[ON] Mark Mode';
      markerState.controlBtn.style.background = '#22c55e';
    }
    document.body.style.cursor = 'crosshair';
    console.log('[ElementMarker] Marking mode RESUMED');
  }

  // 绑定事件
  function bindEvents() {
    markerState.markMode = false;

    console.log('[ElementMarker] Binding events...');

    // 创建浮动控制按钮
    const controlBtn = document.createElement('div');
    controlBtn.id = 'cradle-marker-control';
    controlBtn.textContent = '[OFF] Mark Mode (Press Alt/Shift/Ctrl+M to start)';
    controlBtn.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #6b7280;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      z-index: ${config.zIndex};
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      user-select: none;
    `;
    controlBtn.onclick = () => {
      markerState.markMode = !markerState.markMode;
      if (markerState.markMode) {
        controlBtn.textContent = '[ON] Mark Mode';
        controlBtn.style.background = '#22c55e';
        document.body.style.cursor = 'crosshair';
        console.log('[ElementMarker] Marking mode ON');
      } else {
        controlBtn.textContent = '[OFF] Mark Mode (Press Alt/Shift/Ctrl+M to start)';
        controlBtn.style.background = '#6b7280';
        document.body.style.cursor = '';
        hideHighlight();
        hideBreadcrumb();
        console.log('[ElementMarker] Marking mode OFF');
      }
    };
    document.body.appendChild(controlBtn);
    markerState.controlBtn = controlBtn;

    // 键盘事件
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // 鼠标移动事件
    document.addEventListener('mousemove', handleMouseMove);

    // 点击事件
    document.addEventListener('click', handleClick, true);

    console.log('[ElementMarker] Events bound successfully');
  }

  // 键盘按下
  function handleKeyDown(e) {
    // 支持多种快捷键：右Alt、Shift、Ctrl+M
    const isTriggerKey = e.code === 'AltRight' || 
                         e.key === 'AltGraph' || 
                         e.key === 'Shift' ||
                         (e.ctrlKey && e.key === 'm');
    
    if (isTriggerKey) {
      e.preventDefault(); // 阻止默认行为
      
      // 切换标记模式（按一次开启，再按一次关闭）
      markerState.markMode = !markerState.markMode;
      
      if (markerState.markMode) {
        // 开启标记模式
        if (markerState.controlBtn) {
          markerState.controlBtn.textContent = '[ON] Mark Mode (Click to mark)';
          markerState.controlBtn.style.background = '#22c55e';
        }
        document.body.style.cursor = 'crosshair';
        console.log('[ElementMarker] Marking mode ON - Click any element to mark');
      } else {
        // 关闭标记模式
        if (markerState.controlBtn) {
          markerState.controlBtn.textContent = '[OFF] Mark Mode (Press Alt/Shift/Ctrl+M to start)';
          markerState.controlBtn.style.background = '#6b7280';
        }
        document.body.style.cursor = '';
        hideHighlight();
        hideBreadcrumb();
        console.log('[ElementMarker] Marking mode OFF');
      }
    }
  }

  // 键盘释放 - 切换模式下不需要处理
  function handleKeyUp(e) {
    // 切换模式下不需要处理keyup
  }

  // 鼠标移动
  function handleMouseMove(e) {
    if (!markerState.markMode || !markerState.isActive) return;

    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (element && element !== markerState.selectedElement) {
      highlightElement(element, config.highlightColor, config.borderColor);
      showBreadcrumb(getElementBreadcrumb(element));
    }
  }

  // 点击事件
  function handleClick(e) {
    console.log('[ElementMarker] Click detected, markMode:', markerState.markMode, 'isActive:', markerState.isActive);
    
    if (!markerState.markMode || !markerState.isActive) {
      console.log('[ElementMarker] Click ignored - markMode or isActive is false');
      return;
    }

    // 检查是否点击了已标记元素的高亮遮罩
    const target = e.target;
    if (target && target.classList && target.classList.contains('cradle-marker-marked')) {
      console.log('[ElementMarker] Click ignored - clicked on marked element overlay');
      return;
    }

    // 检查是否点击了高亮遮罩的子元素
    const parentHighlight = target.closest ? target.closest('.cradle-marker-marked') : null;
    if (parentHighlight) {
      console.log('[ElementMarker] Click ignored - clicked inside marked element');
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    console.log('[ElementMarker] Click processed, showing config panel...');

    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (element) {
      markerState.selectedElement = element;
      const breadcrumb = getElementBreadcrumb(element);
      console.log('[ElementMarker] Element found:', element.tagName, 'Breadcrumb:', breadcrumb);
      showConfigPanel(element, breadcrumb);
    } else {
      console.log('[ElementMarker] No element found at click position');
    }
  }

  // 检测选择器类型
  function detectSelectorType(selector) {
    if (!selector) return 'css';
    
    // 显式 XPath 前缀
    if (selector.startsWith('xpath=')) {
      return 'xpath';
    }
    
    // 绝对路径 XPath（以 /html 或 / 开头）
    if (selector.startsWith('/html') || selector.startsWith('//')) {
      return 'xpath';
    }
    
    // 相对路径 XPath（以 .// 开头）
    if (selector.startsWith('.//')) {
      return 'xpath';
    }
    
    // 其他视为 CSS
    return 'css';
  }

  // 获取元素面包屑（返回包含元素引用的数组）
  function getElementBreadcrumb(element) {
    const breadcrumb = [];
    let current = element;

    while (current && current !== document.body) {
      let name = current.tagName.toLowerCase();

      if (current.id) {
        name += '#' + current.id;
      } else if (current.className && typeof current.className === 'string') {
        const firstClass = current.className.trim().split(/\s+/)[0];
        if (firstClass) {
          name += '.' + firstClass.substring(0, 20);
        }
      }
      
      // 保存元素引用
      breadcrumb.unshift({ name, element: current });

      current = current.parentElement;
    }

    return breadcrumb;
  }

  // 获取元素属性
  function getElementAttributes(element) {
    const attrs = {};
    for (const attr of element.attributes) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  // 生成选择器 - 只使用最稳定的方式：XPath文本定位
  function generateSelector(element) {
    const tagName = element.tagName.toLowerCase();
    const text = element.textContent ? element.textContent.trim() : '';

    // 1. 有文本内容的元素，使用XPath文本定位（最稳定）
    if (text && text.length > 0 && text.length < 100) {
      // 检查是否是容器元素（没有直接文本，但包含子元素的文本）
      const directText = Array.from(element.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join('');
      
      let xpathExpr;
      if (!directText && element.children.length > 0) {
        // 容器元素：使用 contains 匹配所有文本（取前30个字符避免过长）
        xpathExpr = '//' + tagName + '[contains(text(), "' + text.substring(0, 30) + '")]';
      } else {
        // 直接有文本的元素：使用精确匹配
        xpathExpr = '//' + tagName + '[text()="' + text + '"]';
      }
      
      // 验证这个 XPath 能否找到元素且唯一
      try {
        const result = document.evaluate(
          xpathExpr, 
          document, 
          null, 
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
          null
        );
        
        if (result.snapshotLength === 1) {
          // XPath 唯一，直接使用
          return 'xpath=' + xpathExpr;
        }
        
        // 如果文本不唯一，尝试结合父级元素
        if (result.snapshotLength > 1) {
          const parent = element.parentElement;
          if (parent) {
            const parentTag = parent.tagName.toLowerCase();
            const parentXpathExpr = '//' + parentTag + '/' + xpathExpr.substring(2);
            
            // 验证结合父级后的 XPath
            const parentResult = document.evaluate(
              parentXpathExpr, 
              document, 
              null, 
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
              null
            );
            
            if (parentResult.snapshotLength === 1) {
              return 'xpath=' + parentXpathExpr;
            }
          }
        }
      } catch (e) {
        console.warn('[ElementMarker] XPath evaluation failed:', e);
      }
    }

    // 2. input/textarea使用placeholder（非常稳定）
    if ((tagName === 'input' || tagName === 'textarea') && element.placeholder) {
      return tagName + '[placeholder="' + element.placeholder + '"]';
    }

    // 3. 使用ID
    if (element.id) {
      return '#' + element.id;
    }

    // 4. 使用name属性
    if (element.name) {
      return tagName + '[name="' + element.name + '"]';
    }

    // 5. 尝试使用class（过滤掉动态class）
    if (element.className && typeof element.className === 'string') {
      const classes = element.className
        .split(' ')
        .map(c => c.trim())
        .filter(c => c && 
          !c.startsWith('css-') && 
          !c.startsWith('dyn') && 
          !c.startsWith('style') &&
          c.length > 2);
      
      if (classes.length > 0) {
        // 尝试使用class，验证唯一性
        const classSelector = tagName + '.' + classes.join('.');
        const classResult = document.querySelectorAll(classSelector);
        if (classResult.length === 1) {
          return classSelector;
        }
      }
    }
    
    // 6. 尝试使用aria-label
    if (element.getAttribute('aria-label')) {
      const ariaSelector = tagName + '[aria-label="' + element.getAttribute('aria-label') + '"]';
      const ariaResult = document.querySelectorAll(ariaSelector);
      if (ariaResult.length === 1) {
        return ariaSelector;
      }
    }
    
    // 7. 尝试使用title
    if (element.title) {
      const titleSelector = tagName + '[title="' + element.title + '"]';
      const titleResult = document.querySelectorAll(titleSelector);
      if (titleResult.length === 1) {
        return titleSelector;
      }
    }

    // 8. 最后手段：使用XPath结构路径（比CSS nth-of-type更稳定）
    const path = [];
    let current = element;
    let depth = 0;
    const maxDepth = 5;

    while (current && current !== document.body && depth < maxDepth) {
      const tag = current.tagName.toLowerCase();
      
      // 如果有ID，使用ID并停止
      if (current.id) {
        path.unshift('//*[@id="' + current.id + '"]');
        break;
      }
      
      // 计算在父元素中的位置
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          path.unshift(tag + '[' + index + ']');
        } else {
          path.unshift(tag);
        }
      } else {
        path.unshift(tag);
      }
      
      current = parent;
      depth++;
    }
    
    // 构建XPath
    if (path.length > 0 && path[0].startsWith('//*[@id=')) {
      // 以ID开头
      return 'xpath=/' + path.join('/');
    } else {
      // 完整路径
      return 'xpath=//' + path.join('/');
    }
  }

  // 显示配置面板
  function showConfigPanel(element, breadcrumb) {
    console.log('[ElementMarker] showConfigPanel called');
    const panel = markerState.configPanel;
    if (!panel) {
      console.log('[ElementMarker] ERROR: configPanel is null!');
      return;
    }

    const selector = generateSelector(element);
    const isEdit = false;
    const ref = 'r' + (markerState.elementCounter + 1);

    panel.innerHTML = '';

    // 标题
    const title = document.createElement('h3');
    title.textContent = isEdit ? '[编辑模式] 标记 ' + ref : '[新建标记] 标记新元素';
    title.style.cssText = 'margin: 0 0 15px 0; color: ' + (isEdit ? '#22c55e' : '#3b82f6') + '; font-size: 16px;';
    panel.appendChild(title);

    // 面包屑（可点击）
    const crumbDiv = document.createElement('div');
    crumbDiv.style.cssText = 'background: #f3f4f6; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-family: monospace; font-size: 12px; word-break: break-all;';
    
    // 创建可点击的面包屑项
    breadcrumb.forEach((item, index) => {
      if (index > 0) {
        const separator = document.createElement('span');
        separator.textContent = ' > ';
        separator.style.color = '#6b7280';
        crumbDiv.appendChild(separator);
      }
      
      const span = document.createElement('span');
      span.textContent = item.name;
      span.style.cssText = 'cursor: pointer; color: #3b82f6; text-decoration: underline; padding: 1px 3px; border-radius: 2px;';
      
      // 点击切换到对应元素
      span.onclick = (e) => {
        e.stopPropagation();
        // 高亮这个元素
        highlightElement(item.element, config.highlightColor, config.borderColor);
        // 更新选中元素和面板
        markerState.selectedElement = item.element;
        const newSelector = generateSelector(item.element);
        selectorDiv.textContent = '选择器: ' + newSelector;
        // 高亮点击的面包屑项
        Array.from(crumbDiv.children).forEach(child => {
          if (child.tagName === 'SPAN' && child !== separator) {
            child.style.background = 'transparent';
            child.style.fontWeight = 'normal';
          }
        });
        span.style.background = '#dbeafe';
        span.style.fontWeight = 'bold';
      };
      
      // 悬停效果
      span.onmouseenter = () => {
        if (span.style.background !== 'rgb(219, 234, 254)') {
          span.style.background = '#e5e7eb';
        }
      };
      span.onmouseleave = () => {
        if (span.style.background !== 'rgb(219, 234, 254)') {
          span.style.background = 'transparent';
        }
      };
      
      crumbDiv.appendChild(span);
    });
    
    panel.appendChild(crumbDiv);

    // 选择器（可编辑）
    const selectorLabel = document.createElement('label');
    selectorLabel.textContent = '选择器:';
    selectorLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
    panel.appendChild(selectorLabel);
    
    const selectorInput = document.createElement('textarea');
    selectorInput.value = selector;
    selectorInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #d1d5db; border-radius: 4px; font-family: monospace; font-size: 11px; min-height: 60px; resize: vertical; box-sizing: border-box;';
    selectorInput.placeholder = '支持 CSS 或 XPath (xpath=//...) 选择器';
    panel.appendChild(selectorInput);
    
    // 选择器类型提示
    const selectorTypeHint = document.createElement('div');
    selectorTypeHint.style.cssText = 'font-size: 11px; color: #6b7280; margin-bottom: 15px;';
    selectorTypeHint.textContent = '提示: 可从 Chrome DevTools (F12) 复制 XPath';
    panel.appendChild(selectorTypeHint);

    // 类型选择
    const typeLabel = document.createElement('label');
    typeLabel.textContent = '交互类型:';
    typeLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
    panel.appendChild(typeLabel);

    const typeSelect = document.createElement('select');
    typeSelect.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #d1d5db; border-radius: 4px;';
    const types = ['click', 'input', 'chat', 'text', 'submit', 'hover', 'scroll', 'wait'];
    for (const type of types) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      if (isEdit && elementInfo && type === elementInfo.type) {
        option.selected = true;
      }
      typeSelect.appendChild(option);
    }
    panel.appendChild(typeSelect);

    // 描述输入
    const descLabel = document.createElement('label');
    descLabel.textContent = '描述:';
    descLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
    panel.appendChild(descLabel);

    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.placeholder = '描述这个元素的作用';
    descInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #d1d5db; border-radius: 4px; box-sizing: border-box;';
    panel.appendChild(descInput);

    // 按钮容器
    const btnDiv = document.createElement('div');
    btnDiv.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

    // 取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = 'padding: 8px 16px; border: none; background: #6b7280; color: white; border-radius: 4px; cursor: pointer;';
    cancelBtn.onclick = () => {
      panel.style.display = 'none';
      resumeMarkMode();
    };
    btnDiv.appendChild(cancelBtn);

    // 删除按钮（仅在编辑模式显示）
    if (isEdit) {
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '删除';
      deleteBtn.style.cssText = 'padding: 8px 16px; border: none; background: #ef4444; color: white; border-radius: 4px; cursor: pointer;';
      deleteBtn.onclick = () => {
        // 使用自定义确认对话框
        const confirmPanel = document.createElement('div');
        confirmPanel.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 2147483647; font-family: system-ui, -apple-system, sans-serif; text-align: center; min-width: 250px;';

        const msgDiv = document.createElement('div');
        msgDiv.style.cssText = 'margin-bottom: 15px; font-size: 14px; color: #333;';
        msgDiv.innerHTML = '确定要删除标记 <strong>' + ref + '</strong> 吗？';
        confirmPanel.appendChild(msgDiv);

        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center;';

        const yesBtn = document.createElement('button');
        yesBtn.textContent = '确定删除';
        yesBtn.style.cssText = 'padding: 8px 16px; border: none; background: #ef4444; color: white; border-radius: 4px; cursor: pointer;';
        yesBtn.onclick = () => {
          removeMarkedElement(ref);
          confirmPanel.remove();
          panel.style.display = 'none';
          resumeMarkMode();
        };
        btnContainer.appendChild(yesBtn);

        const noBtn = document.createElement('button');
        noBtn.textContent = '取消';
        noBtn.style.cssText = 'padding: 8px 16px; border: none; background: #6b7280; color: white; border-radius: 4px; cursor: pointer;';
        noBtn.onclick = () => {
          confirmPanel.remove();
        };
        btnContainer.appendChild(noBtn);

        confirmPanel.appendChild(btnContainer);
        document.body.appendChild(confirmPanel);
      };
      btnDiv.appendChild(deleteBtn);
    }

    // 保存按钮
    const saveBtn = document.createElement('button');
    saveBtn.textContent = isEdit ? '保存修改' : '保存标记';
    saveBtn.style.cssText = 'padding: 8px 16px; border: none; background: #3b82f6; color: white; border-radius: 4px; cursor: pointer;';
    saveBtn.onclick = () => {
      const type = typeSelect.value;
      const description = descInput.value;
      const editedSelector = selectorInput.value.trim();

      if (isEdit) {
        updateMarkedElement(ref, type, description, editedSelector);
      } else {
        saveMarkedElement(element, editedSelector, type, description, breadcrumb);
      }

      panel.style.display = 'none';
      resumeMarkMode();
    };
    btnDiv.appendChild(saveBtn);

    panel.appendChild(btnDiv);
    panel.style.display = 'block';
    console.log('[ElementMarker] Config panel displayed');

    // 暂停标记模式
    pauseMarkMode();
  }

  // 保存标记的元素
  function saveMarkedElement(element, selector, type, description, breadcrumb) {
    markerState.elementCounter++;
    const ref = 'r' + markerState.elementCounter;

    // 检测选择器类型
    const selectorType = detectSelectorType(selector);

    const markedElement = {
      ref,
      type,
      description: description || type + ' element ' + ref,
      selector,
      selectorType,
      tagName: element.tagName.toLowerCase(),
      breadcrumb,
      rect: element.getBoundingClientRect().toJSON(),
      attributes: getElementAttributes(element),
      text: element.textContent ? element.textContent.trim().substring(0, 100) : '',
      placeholder: element.placeholder,
    };

    markerState.markedElements.set(ref, markedElement);

    // 高亮已标记元素
    highlightMarkedElement(element, ref);

    // 发送消息给父页面
    if (window.__cradle_marker_callback) {
      window.__cradle_marker_callback({
        action: 'elementMarked',
        element: markedElement,
      });
    }

    console.log('[ElementMarker] Element marked:', markedElement);
  }

  // 更新标记的元素
  function updateMarkedElement(ref, type, description, newSelector) {
    const elementInfo = markerState.markedElements.get(ref);
    if (!elementInfo) return;

    elementInfo.type = type;
    elementInfo.description = description || elementInfo.description;
    if (newSelector) {
      elementInfo.selector = newSelector;
      elementInfo.selectorType = detectSelectorType(newSelector);
    }
    elementInfo.updatedAt = new Date().toISOString();

    // 重新高亮
    highlightAllMarkedElements();

    // 发送消息给父页面
    if (window.__cradle_marker_callback) {
      window.__cradle_marker_callback({
        action: 'elementUpdated',
        element: elementInfo,
      });
    }

    console.log('[ElementMarker] Element updated:', elementInfo);
  }

  // 高亮单个已标记元素 - 直接在原元素上添加样式
  function highlightMarkedElement(element, ref) {
    // 保存原始样式
    if (!element.dataset.cradleOriginalOutline) {
      element.dataset.cradleOriginalOutline = element.style.outline || '';
    }

    // 添加高亮样式
    element.style.outline = `3px solid ${config.markedBorderColor}`;
    element.style.outlineOffset = '3px';
    element.dataset.cradleRef = ref;

    // 获取元素位置
    const rect = element.getBoundingClientRect();

    // 创建标签（放在body上，避免被父元素裁剪）
    const label = document.createElement('span');
    label.className = 'cradle-marker-label';
    // 注意：标签不使用 data-cradle-ref，避免与元素冲突
    label.textContent = ref;
    label.style.cssText = `
      position: fixed;
      top: ${rect.top - 28}px;
      left: ${rect.left}px;
      background: ${config.markedBorderColor};
      color: white;
      padding: 4px 10px;
      font-size: 13px;
      font-weight: bold;
      border-radius: 4px;
      z-index: ${config.zIndex};
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      white-space: nowrap;
      transition: transform 0.1s;
    `;

    // 点击标签打开编辑面板
    label.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const elementInfo = markerState.markedElements.get(ref);
      if (elementInfo) {
        showEditPanel(elementInfo);
      }
    };

    // 悬停效果
    label.onmouseenter = () => {
      label.style.transform = 'scale(1.1)';
    };
    label.onmouseleave = () => {
      label.style.transform = 'scale(1)';
    };

    document.body.appendChild(label);

    // 保存引用以便清除
    markerState.markedElementsOverlay.push({ element, label });
  }

  // 显示编辑面板
  function showEditPanel(elementInfo) {
    const panel = markerState.configPanel;
    if (!panel) return;

    const ref = elementInfo.ref;
    const isEdit = true;

    panel.innerHTML = '';

    // 标题
    const title = document.createElement('h3');
    title.textContent = '[编辑模式] 标记 ' + ref;
    title.style.cssText = 'margin: 0 0 15px 0; color: #22c55e; font-size: 16px;';
    panel.appendChild(title);

    // 选择器（可编辑）
    const selectorLabel = document.createElement('label');
    selectorLabel.textContent = '选择器:';
    selectorLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
    panel.appendChild(selectorLabel);
    
    const selectorInput = document.createElement('textarea');
    selectorInput.value = elementInfo.selector;
    selectorInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #d1d5db; border-radius: 4px; font-family: monospace; font-size: 11px; min-height: 60px; resize: vertical; box-sizing: border-box;';
    selectorInput.placeholder = '支持 CSS 或 XPath (xpath=//...) 选择器';
    panel.appendChild(selectorInput);
    
    // 选择器类型提示
    const selectorTypeHint = document.createElement('div');
    selectorTypeHint.style.cssText = 'font-size: 11px; color: #6b7280; margin-bottom: 15px;';
    selectorTypeHint.textContent = '提示: 可从 Chrome DevTools (F12) 复制 XPath';
    panel.appendChild(selectorTypeHint);

    // 类型选择
    const typeLabel = document.createElement('label');
    typeLabel.textContent = '交互类型:';
    typeLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
    panel.appendChild(typeLabel);

    const typeSelect = document.createElement('select');
    typeSelect.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #d1d5db; border-radius: 4px;';
    const types = ['click', 'input', 'text', 'submit', 'hover', 'scroll', 'wait'];
    for (const type of types) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      if (type === elementInfo.type) {
        option.selected = true;
      }
      typeSelect.appendChild(option);
    }
    panel.appendChild(typeSelect);

    // 描述输入
    const descLabel = document.createElement('label');
    descLabel.textContent = '描述:';
    descLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
    panel.appendChild(descLabel);

    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.value = elementInfo.description || '';
    descInput.placeholder = '描述这个元素的作用';
    descInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #d1d5db; border-radius: 4px; box-sizing: border-box;';
    panel.appendChild(descInput);

    // 按钮容器
    const btnDiv = document.createElement('div');
    btnDiv.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

    // 取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = 'padding: 8px 16px; border: none; background: #6b7280; color: white; border-radius: 4px; cursor: pointer;';
    cancelBtn.onclick = () => {
      panel.style.display = 'none';
      resumeMarkMode();
    };
    btnDiv.appendChild(cancelBtn);

    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '删除';
    deleteBtn.style.cssText = 'padding: 8px 16px; border: none; background: #ef4444; color: white; border-radius: 4px; cursor: pointer;';
    deleteBtn.onclick = () => {
      // 使用自定义确认对话框
      const confirmPanel = document.createElement('div');
      confirmPanel.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 2147483647; font-family: system-ui, -apple-system, sans-serif; text-align: center; min-width: 250px;';

      const msgDiv = document.createElement('div');
      msgDiv.style.cssText = 'margin-bottom: 15px; font-size: 14px; color: #333;';
      msgDiv.innerHTML = '确定要删除标记 <strong>' + ref + '</strong> 吗？';
      confirmPanel.appendChild(msgDiv);

      const btnContainer = document.createElement('div');
      btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center;';

      const yesBtn = document.createElement('button');
      yesBtn.textContent = '确定删除';
      yesBtn.style.cssText = 'padding: 8px 16px; border: none; background: #ef4444; color: white; border-radius: 4px; cursor: pointer;';
      yesBtn.onclick = () => {
        removeMarkedElement(ref);
        confirmPanel.remove();
        panel.style.display = 'none';
        resumeMarkMode();
      };
      btnContainer.appendChild(yesBtn);

      const noBtn = document.createElement('button');
      noBtn.textContent = '取消';
      noBtn.style.cssText = 'padding: 8px 16px; border: none; background: #6b7280; color: white; border-radius: 4px; cursor: pointer;';
      noBtn.onclick = () => {
        confirmPanel.remove();
      };
      btnContainer.appendChild(noBtn);

      confirmPanel.appendChild(btnContainer);
      document.body.appendChild(confirmPanel);
    };
    btnDiv.appendChild(deleteBtn);

    // 保存按钮
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存修改';
    saveBtn.style.cssText = 'padding: 8px 16px; border: none; background: #3b82f6; color: white; border-radius: 4px; cursor: pointer;';
    saveBtn.onclick = () => {
      const type = typeSelect.value;
      const description = descInput.value;
      const editedSelector = selectorInput.value.trim();
      updateMarkedElement(ref, type, description, editedSelector);
      panel.style.display = 'none';
      resumeMarkMode();
    };
    btnDiv.appendChild(saveBtn);

    panel.appendChild(btnDiv);
    panel.style.display = 'block';

    // 暂停标记模式
    pauseMarkMode();
  }

  // 高亮所有已标记元素
  function highlightAllMarkedElements() {
    clearMarkedHighlights();

    for (const [ref, info] of markerState.markedElements) {
      try {
        let element;
        if (info.selector.startsWith('xpath=')) {
          // XPath选择器
          const xpath = info.selector.substring(6);
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          element = result.singleNodeValue;
        } else {
          // CSS选择器
          element = document.querySelector(info.selector);
        }

        if (element) {
          highlightMarkedElement(element, ref);
          console.log('[ElementMarker] Highlighted: ' + ref);
        } else {
          console.warn('[ElementMarker] Element not found: ' + ref + ', selector: ' + info.selector);
        }
      } catch (e) {
        console.warn('[ElementMarker] Failed to highlight:', ref, e);
      }
    }
  }

  // 清除已标记元素的高亮
  function clearMarkedHighlights() {
    // 移除所有标签
    document.querySelectorAll('.cradle-marker-label').forEach(label => {
      label.remove();
    });
    
    // 恢复所有元素的原始样式
    document.querySelectorAll('[data-cradle-ref]').forEach(element => {
      element.style.outline = element.dataset.cradleOriginalOutline || '';
      element.style.outlineOffset = '';
      delete element.dataset.cradleRef;
      delete element.dataset.cradleOriginalOutline;
    });
    
    markerState.markedElementsOverlay = [];
  }

  // 加载已标记的元素
  function loadMarkedElements(elements) {
    markerState.markedElements.clear();
    markerState.elementCounter = 0;

    for (const el of elements) {
      markerState.markedElements.set(el.ref, el);
      const num = parseInt(el.ref.replace(/^r/, ''), 10);
      if (num > markerState.elementCounter) {
        markerState.elementCounter = num;
      }
    }

    highlightAllMarkedElements();
  }

  // 删除标记的元素
  function removeMarkedElement(ref) {
    markerState.markedElements.delete(ref);
    highlightAllMarkedElements();
  }

  // 获取所有标记的元素
  function getMarkedElements() {
    return Array.from(markerState.markedElements.values());
  }

  // 暴露API
  window.__cradle_element_marker = {
    init: initMarker,
    destroy: destroyMarker,
    isActive: () => markerState.isActive,
    loadElements: loadMarkedElements,
    removeElement: removeMarkedElement,
    getElements: getMarkedElements,
    highlightAll: highlightAllMarkedElements,
    clearHighlights: clearMarkedHighlights,
  };

  console.log('[ElementMarker] Script loaded. Call __cradle_element_marker.init() to start.');
})();
