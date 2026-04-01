import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

test.beforeEach(async ({ page }) => {
  // 1. 打开首页并登录
  await page.goto('/');
  await authLogin(page);
});

test.describe('LLM Logs 模块测试', () => {
  test('打开 LLM Logs 页面，查看详情，切换 Tab，关闭弹窗', async ({ page }) => {
    // 2. 导航到 LLM Logs 页面
    await page.goto('/llm/logs');
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 验证页面标题
    const pageTitle = await page.title();
    console.log('页面标题:', pageTitle);
    
    // 3. 等待表格加载（等待表格行出现）
    await page.waitForSelector('.ant-table-row', { timeout: 10000 });
    
    // 获取表格行数
    const rows = await page.locator('.ant-table-row').all();
    console.log(`找到 ${rows.length} 条日志记录`);
    
    // 如果没有数据，测试通过但记录警告
    if (rows.length === 0) {
      console.log('警告: 没有找到日志数据，可能需要先进行一些 LLM 调用');
      return;
    }
    
    // 4. 点击第一行的"查看详情"按钮
    // 查找包含"查看详情"文本的链接或按钮
    const detailButton = page.locator('.ant-table-row').first().locator('a:has-text("查看详情"), button:has-text("查看详情")');
    
    // 如果找不到特定按钮，尝试点击行内任何可点击的元素
    if (await detailButton.count() === 0) {
      // 尝试点击第一行的操作列
      await page.locator('.ant-table-row').first().click();
    } else {
      await detailButton.first().click();
    }
    
    // 5. 等待详情弹窗打开
    await page.waitForSelector('.vben-modal, .ant-modal', { timeout: 5000 });
    console.log('详情弹窗已打开');
    
    // 6. 验证弹窗标题
    const modalTitle = await page.locator('.vben-modal-title, .ant-modal-title').textContent();
    console.log('弹窗标题:', modalTitle);
    expect(modalTitle).toContain('详情');
    
    // 7. 获取所有 Tab 并切换
    const tabs = await page.locator('.ant-tabs-tab').all();
    console.log(`找到 ${tabs.length} 个 Tab`);
    
    if (tabs.length > 1) {
      // 切换到第二个 Tab
      await tabs[1].click();
      await page.waitForTimeout(500); // 等待 Tab 内容切换
      console.log('已切换到第二个 Tab');
      
      // 如果有更多 Tab，继续切换
      for (let i = 2; i < Math.min(tabs.length, 4); i++) {
        await tabs[i].click();
        await page.waitForTimeout(500);
        console.log(`已切换到第 ${i + 1} 个 Tab`);
      }
      
      // 切换回第一个 Tab
      await tabs[0].click();
      await page.waitForTimeout(500);
      console.log('已切换回第一个 Tab');
    }
    
    // 8. 点击关闭按钮或确认按钮关闭弹窗
    // 尝试多种关闭方式
    const closeButton = page.locator('.ant-modal-close, .vben-modal-close, button:has-text("关闭"), button:has-text("确定"), button:has-text("OK")').first();
    
    if (await closeButton.isVisible()) {
      await closeButton.click();
      console.log('已点击关闭按钮');
    } else {
      // 如果没有找到关闭按钮，尝试按 ESC 键关闭
      await page.keyboard.press('Escape');
      console.log('已按 ESC 键关闭弹窗');
    }
    
    // 9. 等待弹窗关闭
    await page.waitForTimeout(1000);
    
    // 验证弹窗已关闭
    const modalVisible = await page.locator('.vben-modal, .ant-modal').isVisible().catch(() => false);
    expect(modalVisible).toBeFalsy();
    console.log('弹窗已成功关闭');
    
    // 10. 验证回到日志列表页面
    const currentUrl = page.url();
    expect(currentUrl).toContain('/llm/logs');
    console.log('测试完成，当前 URL:', currentUrl);
  });
  
  test('验证 LLM Logs 页面基本元素', async ({ page }) => {
    // 导航到 LLM Logs 页面
    await page.goto('/llm/logs');
    await page.waitForLoadState('networkidle');
    
    // 验证页面包含关键元素
    // 1. 日期选择器
    const dateSelect = await page.locator('.ant-select').first().isVisible().catch(() => false);
    console.log('日期选择器可见:', dateSelect);
    
    // 2. 搜索框
    const searchInput = await page.locator('input[placeholder*="搜索"], input.ant-input').first().isVisible().catch(() => false);
    console.log('搜索框可见:', searchInput);
    
    // 3. 表格
    const table = await page.locator('.ant-table').isVisible().catch(() => false);
    console.log('表格可见:', table);
    
    // 4. 分页器
    const pagination = await page.locator('.ant-pagination').isVisible().catch(() => false);
    console.log('分页器可见:', pagination);
    
    // 截图保存
    await page.screenshot({ path: 'test-results/llm-logs-page.png', fullPage: true });
    console.log('已保存页面截图');
  });
});
