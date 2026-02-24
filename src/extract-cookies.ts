#!/usr/bin/env node
/**
 * 打开独立 Chrome 窗口 → 手动登录任意 Twitter 账号 → 自动保存 Cookie
 *
 * 不影响你的主 Chrome，使用临时 profile + 真实 Chrome 二进制（不被 Twitter 检测）。
 *
 * 用法: npm run extract-cookies
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

const authDir = process.env.AUTH_DIR || "playwright/.auth";
const authFile = path.join(authDir, "twitter.json");
const CDP_PORT = 9333; // 避免和其他调试端口冲突
const TEMP_PROFILE = path.join(
  process.env.TMPDIR || "/tmp",
  "twitter-mcp-chrome-profile"
);

async function waitForCDP(port: number, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (resp.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  fs.mkdirSync(authDir, { recursive: true });

  // 查找 Chrome 二进制
  const chromePath =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!fs.existsSync(chromePath)) {
    console.error("未找到 Google Chrome，请先安装");
    process.exit(1);
  }

  console.log("启动独立 Chrome 窗口（临时 profile）...");
  console.log("请在弹出的浏览器中登录你想要使用的 Twitter 账号\n");

  // open -n -a 强制启动新 Chrome 实例，不影响已运行的 Chrome
  const chrome = spawn("open", [
    "-n",
    "-a",
    "Google Chrome",
    "--args",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${TEMP_PROFILE}`,
    "--no-first-run",
    "--no-default-browser-check",
    "https://x.com/login",
  ]);

  // 等待 Chrome CDP 就绪
  const ready = await waitForCDP(CDP_PORT);
  if (!ready) {
    console.error("Chrome 启动超时，请重试");
    process.exit(1);
  }

  // 连接 Chrome
  const browser = await chromium.connectOverCDP(
    `http://127.0.0.1:${CDP_PORT}`
  );
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.error("没有找到浏览器上下文");
    await browser.close();
    process.exit(1);
  }

  const context = contexts[0];
  const pages = context.pages();
  // 找到 Twitter 登录页
  let page = pages.find(
    (p) => p.url().includes("x.com") || p.url().includes("twitter.com")
  );
  if (!page && pages.length > 0) {
    page = pages[0];
  }
  if (!page) {
    console.error("未找到浏览器页面");
    await browser.close();
    process.exit(1);
  }

  console.log("===========================================");
  console.log("  请在浏览器中登录你的 Twitter/X 账号");
  console.log("  登录成功后会自动检测并保存 Cookie");
  console.log("  超时时间：5 分钟");
  console.log("===========================================\n");

  // 轮询检测登录成功（检查 auth_token cookie 出现）
  const startTime = Date.now();
  const TIMEOUT = 5 * 60 * 1000;
  let cookies: Awaited<ReturnType<typeof context.cookies>> = [];

  while (Date.now() - startTime < TIMEOUT) {
    cookies = await context.cookies(["https://x.com", "https://twitter.com"]);
    const hasAuth = cookies.some((c) => c.name === "auth_token");
    if (hasAuth) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  const authToken = cookies.find((c) => c.name === "auth_token");
  if (!authToken) {
    console.error("超时：5 分钟内未检测到登录成功");
    await browser.close();
    process.exit(1);
  }

  // 多等几秒确保所有 cookie 加载完成
  await new Promise((r) => setTimeout(r, 3000));
  cookies = await context.cookies(["https://x.com", "https://twitter.com"]);

  const ct0 = cookies.find((c) => c.name === "ct0");
  console.log(`\n找到 ${cookies.length} 个 Cookie`);
  console.log(`  auth_token: ${"*".repeat(10)}...`);
  console.log(`  ct0: ${ct0 ? "*".repeat(10) + "..." : "未找到"}`);

  // 保存
  const storageState = { cookies, origins: [] as any[] };
  fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2));
  console.log(`\nCookie 已保存到: ${authFile}`);
  console.log("twitter-mcp 服务将自动使用此登录状态");
  console.log("\n你可以关闭弹出的 Chrome 窗口了。");

  await browser.close();

  // 清理临时 profile
  fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });

  process.exit(0);
}

main().catch((err) => {
  console.error("错误:", err.message);
  // 清理
  fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
  process.exit(1);
});
