/**
 * 浏览器自动化模块 - 工具函数
 */

export {
  assertBrowserNavigationAllowed,
  assertBrowserNavigationRedirectChainAllowed,
  isAllowedUrl,
} from "./ssrf.js";

export {
  BrowserError,
  BrowserProfileUnavailableError,
  BrowserNavigationBlockedError,
  BrowserTimeoutError,
  BrowserElementNotFoundError,
} from "./errors.js";
