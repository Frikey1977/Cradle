#!/usr/bin/env node
/**
 * better-sqlite3 预编译二进制文件部署脚本
 * 
 * 自动将预编译的二进制文件复制到 node_modules 中的正确位置
 */

import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = join(__dirname, '..');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

// 主函数
async function main() {
  logSection('better-sqlite3 预编译二进制文件部署');

  // 检测平台
  const platform = process.platform;
  const arch = process.arch;
  const nodeVersion = process.version;
  const abiVersion = process.versions.modules;

  log(`当前平台: ${platform} (${arch})`, 'cyan');
  log(`Node.js 版本: ${nodeVersion}`, 'cyan');
  log(`ABI 版本: ${abiVersion}\n`, 'cyan');

  // 检查预编译文件是否存在
  const prebuiltDir = join(__dirname, platform + '-' + arch);
  const versionFile = join(prebuiltDir, 'version.json');
  const binaryFile = join(prebuiltDir, 'better_sqlite3.node');

  if (!existsSync(binaryFile)) {
    log(`✗ 错误: 找不到预编译的二进制文件`, 'red');
    log(`  路径: ${binaryFile}\n`);
    log(`当前平台 ${platform}-${arch} 的预编译文件不存在。\n`, 'yellow');
    log('可用方案：\n', 'bright');
    log('  1. 在 ${platform}-${arch} 平台上运行打包脚本生成二进制文件');
    log('  2. 切换到 MySQL 数据库（无需预编译文件）');
    log('  3. 手动编译 better-sqlite3\n');
    process.exit(1);
  }

  // 读取版本信息
  if (existsSync(versionFile)) {
    try {
      const versionInfo = JSON.parse(readFileSync(versionFile, 'utf-8'));
      log('预编译文件信息：', 'bright');
      log(`  打包平台: ${versionInfo.platform}-${versionInfo.arch}`);
      log(`  Node.js 版本: ${versionInfo.nodeVersion}`);
      log(`  ABI 版本: ${versionInfo.abiVersion}`);
      log(`  better-sqlite3 版本: ${versionInfo.betterSqlite3Version}`);
      log(`  打包时间: ${versionInfo.packagedAt}\n`);

      // 检查 ABI 版本兼容性
      if (versionInfo.abiVersion !== abiVersion) {
        log(`⚠ 警告: ABI 版本不匹配`, 'yellow');
        log(`  预编译文件 ABI: ${versionInfo.abiVersion}`);
        log(`  当前环境 ABI: ${abiVersion}\n`);
        log('这可能导致二进制文件无法使用。建议：\n', 'yellow');
        log('  1. 使用相同 Node.js 版本重新打包');
        log('  2. 切换到 MySQL 数据库\n');
        
        // 询问是否继续
        log('按 Ctrl+C 取消，或按 Enter 继续尝试...\n', 'cyan');
        await waitForEnter();
      }
    } catch (error) {
      log(`⚠ 无法读取版本信息: ${error.message}\n`, 'yellow');
    }
  }

  // 检查目标目录
  const targetDir = join(rootDir, 'node_modules', 'better-sqlite3', 'build', 'Release');
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
    log(`✓ 创建目录: ${targetDir}\n`, 'green');
  }

  // 复制二进制文件
  const targetFile = join(targetDir, 'better_sqlite3.node');
  copyFileSync(binaryFile, targetFile);
  log(`✓ 部署成功: ${targetFile}\n`, 'green');

  logSection('部署完成');
  log('better-sqlite3 预编译二进制文件已部署！\n', 'green');
  log('现在可以正常运行项目：npx pnpm run gateway:master\n', 'bright');
}

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.once('data', () => resolve());
  });
}

main().catch((error) => {
  log(`\n✗ 错误: ${error.message}\n`, 'red');
  process.exit(1);
});
