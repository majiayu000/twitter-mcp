#!/usr/bin/env node
/**
 * 手动登录脚本：打开浏览器 → 你手动登录 → 自动保存 Cookie
 * 用法: npx ts-node -T src/manual-login.ts
 */
import "dotenv/config";
import { chromium, devices } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import path from "path";
import fs from "fs";

chromium.use(StealthPlugin());

const authDir = process.env.AUTH_DIR || "playwright/.auth";
const authFile = path.join(authDir, "twitter.json");

async function manualLogin() {
  // 确保目录存在
  fs.mkdirSync(authDir, { recursive: true });

  console.log("启动浏览器...");
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    locale: "en-US",
  });

  await context.addInitScript(
    "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
  );

  const page = await context.newPage();
  await page.goto("https://x.com/login");

  console.log("\n===========================================");
  console.log("  请在浏览器中手动登录你的 X/Twitter 账号");
  console.log("  登录成功后会自动保存 Cookie");
  console.log("===========================================\n");

  // 等待用户登录成功（检测到 home 页面）
  try {
    await page.waitForURL("**/home", { timeout: 300000 }); // 5 分钟超时
  } catch {
    console.error("超时：5 分钟内未完成登录");
    await browser.close();
    process.exit(1);
  }

  // 多等几秒确保 Cookie 完全加载
  await page.waitForTimeout(3000);

  // 保存 Cookie
  await context.storageState({ path: authFile });
  console.log(`\nCookie 已保存到: ${authFile}`);
  console.log("下次启动 MCP 服务将自动使用此登录状态\n");

  await browser.close();
  process.exit(0);
}

manualLogin().catch((err) => {
  console.error("错误:", err);
  process.exit(1);
});
