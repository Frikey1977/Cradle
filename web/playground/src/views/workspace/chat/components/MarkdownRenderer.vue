<script setup lang="ts">
/**
 * Markdown 渲染组件
 * 使用 react-markdown 渲染 Markdown 内容
 * 支持切换原始文本和 Markdown 渲染
 * 支持流式输出优化
 */
import { ref, onMounted, watch, onUnmounted } from 'vue';
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button, message } from 'ant-design-vue';
import { IconifyIcon } from "@vben/icons";

interface Props {
  content: string;
  showToggle?: boolean; // 是否显示切换按钮
  isStreaming?: boolean; // 是否正在流式输出
}

const props = withDefaults(defineProps<Props>(), {
  showToggle: true,
  isStreaming: false
});

const containerRef = ref<HTMLElement | null>(null);
let root: Root | null = null;

// 是否使用 Markdown 渲染
const useMarkdown = ref(true);
// 流式输出时使用纯文本模式
const isStreamMode = ref(false);

// 切换渲染模式
function toggleRenderMode() {
  useMarkdown.value = !useMarkdown.value;
  renderContent();
}

// 复制文本到剪贴板
async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.content);
    message.success('已复制到剪贴板');
  } catch (err) {
    console.error('复制失败:', err);
    message.error('复制失败');
  }
}

// 统一的渲染函数
function renderContent() {
  if (!containerRef.value) return;

  if (!root) {
    root = createRoot(containerRef.value);
  }

  // 流式输出时使用纯文本，非流式时根据 useMarkdown 决定
  const shouldUseMarkdown = !props.isStreaming && useMarkdown.value;

  if (shouldUseMarkdown) {
    renderMarkdown();
  } else {
    renderPlainText();
  }
}

function renderMarkdown() {
  // 使用 React.createElement 而不是 JSX
  const markdownElement = React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm],
    components: {
      // 自定义段落渲染，减少段落间距
      p: ({ children }: { children?: React.ReactNode }) => {
        return React.createElement('p', { style: { marginBottom: '0.25em', marginTop: 0 } }, children);
      },
      // 自定义列表渲染，减少间距
      ul: ({ children }: { children?: React.ReactNode }) => {
        return React.createElement('ul', { style: { marginBottom: '0.5em', marginTop: 0, paddingLeft: '1.5em' } }, children);
      },
      ol: ({ children }: { children?: React.ReactNode }) => {
        return React.createElement('ol', { style: { marginBottom: '0.5em', marginTop: 0, paddingLeft: '1.5em' } }, children);
      },
      li: ({ children }: { children?: React.ReactNode }) => {
        return React.createElement('li', { style: { marginBottom: '0.15em', lineHeight: 1.5 } }, children);
      },
      // 自定义标题渲染
      h1: ({ children }: { children?: React.ReactNode }) => {
        return React.createElement('h1', { style: { marginTop: '0.75em', marginBottom: '0.5em', fontSize: '1.5em', fontWeight: 600 } }, children);
      },
      h2: ({ children }: { children?: React.ReactNode }) => {
        return React.createElement('h2', { style: { marginTop: '0.75em', marginBottom: '0.5em', fontSize: '1.3em', fontWeight: 600 } }, children);
      },
      h3: ({ children }: { children?: React.ReactNode }) => {
        return React.createElement('h3', { style: { marginTop: '0.5em', marginBottom: '0.4em', fontSize: '1.15em', fontWeight: 600 } }, children);
      },
      code: ({ inline, className, children }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
        if (inline) {
          return React.createElement('code', { className }, children);
        }
        const match = /language-(\w+)/.exec(className || '');
        return React.createElement('pre', { className: 'code-block' },
          match ? React.createElement('div', { className: 'code-language' }, match[1]) : null,
          React.createElement('code', { className }, children)
        );
      },
      a: ({ children, href }: { href?: string; children?: React.ReactNode }) => {
        return React.createElement('a', {
          href,
          target: '_blank',
          rel: 'noopener noreferrer'
        }, children);
      }
    }
  }, props.content);

  root!.render(markdownElement);
}

function renderPlainText() {
  // 渲染纯文本，保留换行符
  const textElement = React.createElement('div', {
    className: 'plain-text-stream',
    style: {
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      lineHeight: 1.5
    }
  }, props.content);

  root!.render(textElement);
}

onMounted(() => {
  renderContent();
});

// 监听内容变化
watch(() => props.content, () => {
  renderContent();
});

// 监听流式状态变化
watch(() => props.isStreaming, (newValue, oldValue) => {
  // 流式输出结束时，切换到 Markdown 渲染
  if (oldValue && !newValue && useMarkdown.value) {
    renderMarkdown();
  }
});

onUnmounted(() => {
  if (root) {
    root.unmount();
    root = null;
  }
});
</script>

<template>
  <div class="markdown-wrapper">
    <!-- 内容区域 -->
    <div ref="containerRef" class="markdown-body"></div>
    <!-- 操作按钮组 - 只在非流式时显示，位于气泡右侧底边对齐 -->
    <div v-if="showToggle && !isStreaming" class="action-buttons-wrapper">
      <Button
        type="link"
        size="small"
        class="action-button"
        @click="toggleRenderMode"
        :title="useMarkdown ? '切换到原始文本' : '切换到 Markdown'"
      >
        <IconifyIcon :icon="useMarkdown ? 'mdi:code-braces' : 'mdi:markdown'" />
      </Button>
      <Button
        type="link"
        size="small"
        class="action-button"
        @click="copyContent"
        title="复制文本"
      >
        <IconifyIcon icon="mdi:content-copy" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
.markdown-wrapper {
  position: relative;
  display: flex;
  align-items: flex-end;
}

.action-buttons-wrapper {
  flex-shrink: 0;
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;
  align-self: flex-end;
  padding-bottom: 4px;
  display: flex;
  gap: 4px;
}

.markdown-wrapper:hover .action-buttons-wrapper {
  opacity: 1;
}

.action-button {
  font-size: 16px;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-button :deep(svg) {
  width: 18px;
  height: 18px;
}

.markdown-body :deep(*) {
  margin: 0;
  padding: 0;
}

.markdown-body :deep(p) {
  margin-bottom: 0.25em;
  margin-top: 0;
  line-height: 1.5;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

/* 处理软换行 */
.markdown-body :deep(br) {
  display: block;
  content: "";
  margin-bottom: 0.25em;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-body :deep(h1) { font-size: 1.5em; }
.markdown-body :deep(h2) { font-size: 1.3em; }
.markdown-body :deep(h3) { font-size: 1.15em; }
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) { font-size: 1em; }

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin-bottom: 0.75em;
  padding-left: 1.5em;
}

.markdown-body :deep(li) {
  margin-bottom: 0.25em;
}

.markdown-body :deep(code) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.9em;
}

.markdown-body :deep(.code-block) {
  background-color: #f6f8fa;
  border-radius: 6px;
  padding: 1em;
  overflow-x: auto;
  margin-bottom: 0.75em;
}

.markdown-body :deep(.code-block code) {
  background-color: transparent;
  padding: 0;
}

.markdown-body :deep(.code-language) {
  color: #666;
  font-size: 0.8em;
  margin-bottom: 0.5em;
  text-transform: uppercase;
}

.markdown-body :deep(blockquote) {
  border-left: 4 solid #ddd;
  padding-left: 1em;
  margin-bottom: 0.75em;
  color: #666;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 0.75em;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #ddd;
  padding: 0.5em;
  text-align: left;
}

.markdown-body :deep(th) {
  background-color: #f6f8fa;
  font-weight: 600;
}

.markdown-body :deep(a) {
  color: #0366d6;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid #ddd;
  margin: 1em 0;
}

.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
}

/* 流式输出时的纯文本样式 */
.markdown-body :deep(.plain-text-stream) {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}
</style>
