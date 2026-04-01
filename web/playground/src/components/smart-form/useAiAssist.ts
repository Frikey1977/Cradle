import { h, render } from "vue";
import { Button, message } from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";
import { getSmartFormSuggestion, type SmartFormRequest } from "#/api/ai/smart-form";

export interface AiAssistOptions {
  /** 模块标识 */
  module: string;
  /** 表单类型 */
  formType: string;
  /** 目标字段名 */
  fieldName: string;
  /** 提示词 */
  prompt?: string;
  /** 最大长度 */
  maxLength?: number;
  /** 获取表单数据的函数 */
  getFormData: () => Record<string, any> | Promise<Record<string, any>>;
  /** 按钮底部偏移量（像素），用于调整按钮位置，默认28px */
  buttonOffset?: number;
}

/**
 * 为输入框添加 AI 辅助功能
 * 动态挂载 AI 生成按钮到指定输入框
 */
export function useAiAssist(options: AiAssistOptions) {
  let aiButtonContainer: HTMLDivElement | null = null;
  let targetElement: HTMLElement | null = null;
  let isLoading = false;

  /**
   * 创建 AI 按钮
   */
  function createAiButton() {
    const container = document.createElement("div");
    container.className = "ai-assist-button-wrapper";
    const offset = options.buttonOffset ?? 28;
    container.style.cssText = `
      position: absolute;
      bottom: ${offset}px;
      right: 8px;
      z-index: 10;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    `;

    // 创建 Vue 组件
    const buttonVNode = h(
      Button,
      {
        type: "text",
        size: "small",
        class: "ai-assist-btn flex items-center gap-1 text-primary hover:text-primary/80",
        style: {
          padding: "2px 8px",
          borderRadius: "4px",
          background: "rgba(var(--primary), 0.1)",
        },
        onClick: handleAiAssist,
      },
      {
        default: () => [
          h(IconifyIcon, { icon: "mdi:sparkles", class: "text-sm" }),
          h("span", { class: "text-xs" }, "AI 生成"),
        ],
      }
    );

    render(buttonVNode, container);
    return container;
  }

  /**
   * 创建加载状态
   */
  function createLoadingIndicator() {
    const container = document.createElement("div");
    container.className = "ai-assist-loading-wrapper";
    const offset = options.buttonOffset ?? 28;
    container.style.cssText = `
      position: absolute;
      bottom: ${offset}px;
      right: 8px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--primary);
    `;

    const loadingVNode = h(
      "div",
      { class: "flex items-center gap-1 text-primary" },
      [
        h(IconifyIcon, {
          icon: "mdi:loading",
          class: "text-sm animate-spin",
        }),
        h("span", { class: "text-xs" }, "生成中..."),
      ]
    );

    render(loadingVNode, container);
    return container;
  }

  /**
   * 处理 AI 生成
   */
  async function handleAiAssist() {
    if (isLoading) return;

    isLoading = true;
    showLoading();

    try {
      const formData = await options.getFormData();

      const request: SmartFormRequest = {
        module: options.module,
        formType: options.formType,
        formData: formData,
        targetField: options.fieldName,
        prompt: options.prompt,
        validation: {
          maxLength: options.maxLength || 300,
        },
      };

      const response = await getSmartFormSuggestion(request);

      if (response.suggestion && targetElement) {
        // 设置值到输入框
        if (targetElement instanceof HTMLTextAreaElement) {
          targetElement.value = response.suggestion;
          // 触发 input 事件让表单知道值变了
          targetElement.dispatchEvent(new Event("input", { bubbles: true }));
          targetElement.dispatchEvent(new Event("change", { bubbles: true }));
        }
        message.success("AI 生成成功");
      } else {
        message.warning("AI 未能生成建议，请手动输入");
      }
    } catch (error) {
      console.error("AI 生成失败:", error);
      message.error("AI 生成失败，请稍后重试");
    } finally {
      isLoading = false;
      hideLoading();
    }
  }

  /**
   * 显示按钮
   */
  function showButton() {
    if (aiButtonContainer) {
      aiButtonContainer.style.opacity = "1";
      aiButtonContainer.style.pointerEvents = "auto";
    }
  }

  /**
   * 隐藏按钮
   */
  function hideButton() {
    if (aiButtonContainer && !isLoading) {
      aiButtonContainer.style.opacity = "0";
      aiButtonContainer.style.pointerEvents = "none";
    }
  }

  /**
   * 显示加载状态
   */
  function showLoading() {
    if (aiButtonContainer) {
      aiButtonContainer.style.display = "none";
    }
    const loadingEl = targetElement?.parentElement?.querySelector(
      ".ai-assist-loading-wrapper"
    );
    if (loadingEl) {
      (loadingEl as HTMLElement).style.display = "flex";
    }
  }

  /**
   * 隐藏加载状态
   */
  function hideLoading() {
    const loadingEl = targetElement?.parentElement?.querySelector(
      ".ai-assist-loading-wrapper"
    );
    if (loadingEl) {
      (loadingEl as HTMLElement).style.display = "none";
    }
    if (aiButtonContainer) {
      aiButtonContainer.style.display = "block";
    }
  }

  /**
   * 挂载到指定元素
   */
  function mount(element: HTMLElement) {
    targetElement = element;

    // 确保父元素有相对定位
    const parent = element.parentElement;
    if (!parent) return;

    const computedStyle = window.getComputedStyle(parent);
    if (computedStyle.position === "static") {
      parent.style.position = "relative";
    }

    // 添加底部 padding 为按钮预留空间
    parent.style.paddingBottom = "24px";

    // 创建并挂载按钮
    aiButtonContainer = createAiButton();
    parent.appendChild(aiButtonContainer);

    // 创建并挂载加载指示器（初始隐藏）
    const loadingContainer = createLoadingIndicator();
    loadingContainer.style.display = "none";
    parent.appendChild(loadingContainer);

    // 绑定事件
    parent.addEventListener("mouseenter", showButton);
    parent.addEventListener("mouseleave", () => {
      setTimeout(hideButton, 300);
    });

    return {
      unmount,
    };
  }

  /**
   * 卸载
   */
  function unmount() {
    if (aiButtonContainer) {
      render(null, aiButtonContainer);
      aiButtonContainer.remove();
      aiButtonContainer = null;
    }

    const parent = targetElement?.parentElement;
    if (parent) {
      const loadingEl = parent.querySelector(".ai-assist-loading-wrapper");
      if (loadingEl) {
        render(null, loadingEl as HTMLDivElement);
        loadingEl.remove();
      }
    }

    targetElement = null;
  }

  return {
    mount,
    unmount,
  };
}
