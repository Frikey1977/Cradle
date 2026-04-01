/**
 * 快照增强器
 * 
 * 将标记配置注入页面，生成带索引的快照
 */

import type { Page } from "playwright-core";
import type { 
  SiteConfig, 
  PageConfig, 
  MarkedElement, 
  ActionGroup,
  EnhancedSnapshotResult 
} from "./types.js";
import { globalConfigManager } from "./config-manager.js";

/**
 * 快照增强器
 */
export class SnapshotEnhancer {
  /**
   * 为页面注入标记配置
   */
  async injectMarkers(page: Page, url: string): Promise<{ config: SiteConfig | null; pageConfig: PageConfig | null }> {
    // 获取配置
    const result = await globalConfigManager.getConfigForUrl(url);
    
    if (!result) {
      return { config: null, pageConfig: null };
    }
    
    const { config, page: pageConfig } = result;
    
    // 注入全局脚本
    if (config.globalScript) {
      await page.addInitScript(config.globalScript);
    }
    
    // 注入页面特定脚本
    if (pageConfig.pageScript) {
      await page.addInitScript(pageConfig.pageScript);
    }
    
    // 注入标记索引脚本
    await this.injectRefMarkers(page, pageConfig.elements);
    
    return { config, pageConfig };
  }

  /**
   * 注入元素引用标记
   * 使用静默方式，避免触发页面事件
   */
  private async injectRefMarkers(page: Page, elements: MarkedElement[]): Promise<void> {
    const script = `
      (function() {
        // 静默模式：暂停所有音频播放
        const audios = document.querySelectorAll('audio, video');
        audios.forEach(media => {
          if (!media.paused) {
            media.pause();
          }
        });
        
        // 清除旧的标记
        document.querySelectorAll('[data-cradle-ref]').forEach(el => {
          el.removeAttribute('data-cradle-ref');
        });
        
        // 注入新的标记
        const elements = ${JSON.stringify(elements)};
        
        for (const el of elements) {
          try {
            let element = null;
            
            // 根据选择器类型查找元素
            if (el.selectorType === 'xpath' || el.selector.startsWith('xpath=')) {
              // XPath 选择器
              const xpath = el.selector.startsWith('xpath=') 
                ? el.selector.substring(6) 
                : el.selector;
              const result = document.evaluate(
                xpath, 
                document, 
                null, 
                XPathResult.FIRST_ORDERED_NODE_TYPE, 
                null
              );
              element = result.singleNodeValue;
            } else {
              // CSS 选择器
              element = document.querySelector(el.selector);
            }
            
            if (element) {
              // 使用 try-catch 避免属性设置失败
              try {
                element.setAttribute('data-cradle-ref', el.ref);
                element.setAttribute('data-cradle-type', el.type);
                element.setAttribute('data-cradle-desc', el.description);
              } catch (attrError) {
                // 忽略属性设置错误
              }
            }
          } catch (e) {
            console.warn('[Cradle] Failed to mark element:', el.ref, e);
          }
        }
        
        return elements.length;
      })();
    `;
    
    try {
      const count = await page.evaluate(script);
      console.log(`[SnapshotEnhancer] Injected ${count} element markers`);
    } catch (error) {
      console.error('[SnapshotEnhancer] Failed to inject markers:', error);
    }
  }

  /**
   * 获取增强快照
   */
  async getEnhancedSnapshot(page: Page, url: string): Promise<EnhancedSnapshotResult> {
    // 首先注入标记
    const { config, pageConfig } = await this.injectMarkers(page, url);
    
    // 获取原始快照
    const originalSnapshot = await this.captureOriginalSnapshot(page);
    
    // 如果没有配置，返回原始快照
    if (!config || !pageConfig) {
      return {
        originalSnapshot,
        markedElements: [],
        actionGroups: [],
        config: null,
      };
    }
    
    // 获取页面特定数据
    const pageData = await this.extractPageData(page, pageConfig);
    
    // 构建增强快照文本
    const enhancedSnapshot = this.buildEnhancedSnapshotText(
      originalSnapshot,
      pageConfig.elements,
      pageConfig.actionGroups || [],
      pageData
    );
    
    return {
      originalSnapshot: enhancedSnapshot,
      markedElements: pageConfig.elements,
      actionGroups: pageConfig.actionGroups || [],
      pageData,
      config,
    };
  }

  /**
   * 捕获原始快照
   */
  private async captureOriginalSnapshot(page: Page): Promise<string> {
    // 获取页面文本内容
    const pageText = await page.evaluate(() => {
      // 移除脚本和样式内容
      const clone = document.body.cloneNode(true) as HTMLElement;
      
      // 移除脚本和样式标签
      clone.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());
      
      // 获取文本
      return clone.innerText || '';
    });
    
    return pageText;
  }

  /**
   * 提取页面特定数据
   */
  private async extractPageData(page: Page, pageConfig: PageConfig): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    
    // 提取所有标记元素的当前内容
    if (pageConfig.elements && pageConfig.elements.length > 0) {
      const elementData: Record<string, { text?: string; value?: string; exists: boolean }> = {};
      
      for (const element of pageConfig.elements) {
        try {
          // 使用 data-cradle-ref 属性查找元素（注入标记时添加的）
          const locator = page.locator(`[data-cradle-ref="${element.ref}"]:not(span.cradle-marker-label)`);
          const count = await locator.count();
          const exists = count > 0;
          
          if (exists) {
            let text: string | undefined;
            let value: string | undefined;
            
            // 根据元素类型提取内容
            if (element.type === 'text' || element.type === 'chat') {
              text = await locator.textContent() || undefined;
            } else if (element.type === 'input') {
              value = await locator.inputValue().catch(() => undefined);
            }
            
            elementData[element.ref] = {
              text,
              value,
              exists: true
            };
          } else {
            elementData[element.ref] = {
              exists: false
            };
          }
        } catch (error) {
          console.error(`[SnapshotEnhancer] Failed to extract data for ${element.ref}:`, error);
          elementData[element.ref] = {
            exists: false,
            error: String(error)
          };
        }
      }
      
      result.elements = elementData;
    }
    
    // 执行页面特定的数据提取脚本（如果配置了）
    if (pageConfig.snapshotScript) {
      try {
        const customData = await page.evaluate(pageConfig.snapshotScript);
        Object.assign(result, customData);
      } catch (error) {
        console.error('[SnapshotEnhancer] Failed to extract custom page data:', error);
      }
    }
    
    return result;
  }

  /**
   * 构建增强快照文本
   */
  private buildEnhancedSnapshotText(
    originalSnapshot: string,
    elements: MarkedElement[],
    actionGroups: ActionGroup[],
    pageData?: Record<string, unknown>
  ): string {
    const lines: string[] = [];
    
    // 添加标记元素信息
    if (elements.length > 0) {
      lines.push('=== 可交互元素 ===');
      lines.push('');
      
      // 获取元素数据（如果有）
      const elementData = pageData?.elements as Record<string, { text?: string; value?: string; exists: boolean }> | undefined;
      
      for (const el of elements) {
        lines.push(`[${el.ref}] ${el.type}: ${el.description}`);
        
        // 添加当前内容（从 pageData 中获取）
        const currentData = elementData?.[el.ref];
        if (currentData) {
          if (currentData.exists) {
            if (currentData.text) {
              const displayText = currentData.text.substring(0, 100).replace(/\n/g, ' ');
              lines.push(`  当前文本: ${displayText}${currentData.text.length > 100 ? '...' : ''}`);
            }
            if (currentData.value) {
              lines.push(`  当前值: ${currentData.value}`);
            }
          } else {
            lines.push(`  状态: 元素不存在`);
          }
        } else if (el.text && el.text !== el.description) {
          // 回退到配置中的文本
          lines.push(`  文本: ${el.text.substring(0, 50)}${el.text.length > 50 ? '...' : ''}`);
        }
        lines.push('');
      }
    }
    
    // 添加操作组信息
    if (actionGroups.length > 0) {
      lines.push('=== 操作组 ===');
      lines.push('');
      
      for (const group of actionGroups) {
        lines.push(`[组: ${group.id}] ${group.name}`);
        lines.push(`  描述: ${group.description}`);
        lines.push(`  操作序列: ${group.elementRefs.join(' -> ')}`);
        lines.push('');
      }
    }
    
    // 添加页面数据
    if (pageData && Object.keys(pageData).length > 0) {
      lines.push('=== 页面数据 ===');
      lines.push('');
      lines.push(JSON.stringify(pageData, null, 2));
      lines.push('');
    }
    
    // 添加原始页面内容
    lines.push('=== 页面内容 ===');
    lines.push('');
    lines.push(originalSnapshot);
    
    return lines.join('\n');
  }

  /**
   * 执行批处理操作
   */
  async executeBatchActions(
    page: Page,
    actions: { ref: string; type: string; value?: string }[],
    delayMs: number = 1000
  ): Promise<{ success: boolean; results: { ref: string; success: boolean; error?: string }[] }> {
    const results: { ref: string; success: boolean; error?: string }[] = [];
    
    for (const action of actions) {
      try {
        await this.executeSingleAction(page, action);
        results.push({ ref: action.ref, success: true });
      } catch (error) {
        results.push({ ref: action.ref, success: false, error: String(error) });
      }
      
      // 等待间隔
      if (delayMs > 0) {
        await page.waitForTimeout(delayMs);
      }
    }
    
    return {
      success: results.every(r => r.success),
      results,
    };
  }

  /**
   * 标准化的聊天/评论发送方法
   * 支持 contenteditable 富文本编辑器
   * 
   * @param element - Playwright Locator 对象
   * @param message - 要发送的消息内容
   * @param options - 可选配置
   */
  private async sendChatMessage(
    element: any,
    message: string,
    options: {
      triggerEvents?: string[];  // 触发的事件列表，默认 ['input']
      sendKey?: string;          // 发送按键，默认 'Enter'
      delay?: number;            // 发送前延迟（毫秒），默认 100
    } = {}
  ): Promise<void> {
    const { 
      triggerEvents = ['input'], 
      sendKey = 'Enter',
      delay = 100 
    } = options;

    // 1. 尝试使用 Playwright 的 fill 方法
    try {
      await element.fill(message);
    } catch (fillError) {
      // 2. 如果 fill 失败，使用 JavaScript 注入（支持 contenteditable）
      await element.evaluate((el: HTMLElement, val: string) => {
        // 检查是否是 contenteditable 元素
        if (el.isContentEditable) {
          // 设置 innerText
          el.innerText = val;
          
          // 触发必要的事件
          triggerEvents.forEach(eventName => {
            el.dispatchEvent(new Event(eventName, { bubbles: true }));
          });
        } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          // 普通 input/textarea
          (el as HTMLInputElement | HTMLTextAreaElement).value = val;
          
          // 触发必要的事件
          triggerEvents.forEach(eventName => {
            el.dispatchEvent(new Event(eventName, { bubbles: true }));
          });
        }
      }, message);
    }

    // 3. 等待一小段时间确保内容已更新
    await element.page().waitForTimeout(delay);

    // 4. 模拟发送按键
    await element.press(sendKey);
  }

  /**
   * 执行单个操作
   */
  private async executeSingleAction(
    page: Page,
    action: { ref: string; type: string; value?: string }
  ): Promise<void> {
    const { ref, type, value } = action;
    
    // 查找元素 - 排除标签元素（span.cradle-marker-label）
    const element = page.locator(`[data-cradle-ref="${ref}"]:not(span.cradle-marker-label)`);
    
    // 等待元素可见
    await element.waitFor({ state: 'visible', timeout: 5000 });
    
    switch (type) {
      case 'click':
        await element.click();
        break;
      case 'input':
        // 使用标准化输入方法（不发送）
        await this.sendChatMessage(element, value || '', { 
          triggerEvents: ['input', 'change'],
          sendKey: '',  // 不发送
          delay: 0 
        });
        break;
      case 'text':
        // 读取元素文本内容
        const textContent = await element.textContent();
        console.log(`[ElementMarker] Text content of ${ref}:`, textContent);
        break;
      case 'hover':
        await element.hover();
        break;
      case 'focus':
        await element.focus();
        break;
      case 'submit':
        await element.press('Enter');
        break;
      case 'chat':
        // 使用标准化的聊天发送方法
        await this.sendChatMessage(element, value || '', {
          triggerEvents: ['input'],
          sendKey: 'Enter',
          delay: 100
        });
        break;
      case 'select':
        if (value) {
          await element.selectOption(value);
        }
        break;
      case 'scroll':
        await element.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        break;
      default:
        // 默认点击
        await element.click();
    }
  }

  /**
   * 执行操作组
   */
  async executeActionGroup(
    page: Page,
    group: ActionGroup,
    elements: MarkedElement[]
  ): Promise<{ success: boolean; error?: string }> {
    // 检查前置条件
    if (group.preCondition) {
      try {
        if (group.preCondition.selector) {
          const locator = page.locator(group.preCondition.selector);
          await locator.waitFor({ 
            state: group.preCondition.visible !== false ? 'visible' : 'attached',
            timeout: group.preCondition.timeout || 5000,
          });
        }
      } catch (error) {
        return { success: false, error: `Pre-condition not met: ${error}` };
      }
    }
    
    // 构建操作序列
    const actions = group.elementRefs.map(ref => {
      const element = elements.find(e => e.ref === ref);
      return {
        ref,
        type: element?.type || 'click',
        value: element?.metadata?.defaultValue as string,
      };
    });
    
    // 执行操作
    const result = await this.executeBatchActions(page, actions, group.delayBetweenActions);
    
    if (!result.success) {
      return { 
        success: false, 
        error: `Action group execution failed: ${result.results.filter(r => !r.success).map(r => r.ref).join(', ')}` 
      };
    }
    
    // 验证后置条件
    if (group.postValidation) {
      try {
        if (group.postValidation.selector) {
          const element = page.locator(group.postValidation.selector);
          await element.waitFor({ state: 'visible', timeout: group.postValidation.timeout || 5000 });
          
          if (group.postValidation.textContains) {
            const text = await element.textContent();
            if (!text?.includes(group.postValidation.textContains)) {
              return { success: false, error: 'Post-validation failed: text not found' };
            }
          }
        }
      } catch (error) {
        return { success: false, error: `Post-validation failed: ${error}` };
      }
    }
    
    return { success: true };
  }
}

// 全局快照增强器实例
export const globalSnapshotEnhancer = new SnapshotEnhancer();
