/**
 * 歌曲宝歌词批量获取工具
 * 自动从本地音乐文件获取对应的LRC歌词文件
 */

const { processFullPipeline, quickStart } = require("./fullPipeline");
const AudioParser = require("./audioParser");
const { UrlGenerator } = require("./urlGenerator");
const GequbaoCrawler = require("./gequbaoCrawler");
const DomCrawler = require("./domCrawler");
const CrawlerFactory = require("./crawlerFactory");

// 主执行函数
async function main() {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║     歌曲宝歌词批量获取工具 v1.0        ║");
  console.log("╚════════════════════════════════════════╝\n");

  // 默认音乐文件夹路径（请根据实际情况修改）
  const musicFolderPath = "D:\\chromeDownLoad\\musicFlie";
  
  // 配置选项
  const config = {
    recursive: true,        // 递归扫描子文件夹
    limit: null,           // 不限制数量（设置数字可限制处理数量）
    delay: 2000,           // 请求间隔2秒
    saveIntermediateFiles: true  // 保存中间文件
  };

  console.log(`音乐文件夹: ${musicFolderPath}`);
  console.log(`配置: 递归=${config.recursive}, 延迟=${config.delay}ms`);
  
  if (config.limit) {
    console.log(`限制处理: 前 ${config.limit} 个文件`);
  } else {
    console.log(`处理模式: 全部文件`);
  }
  
  console.log("\n开始处理...\n");

  try {
    // 执行完整流程
    const results = await processFullPipeline(musicFolderPath, config);
    
    // 输出最终统计
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║              处理完成                   ║");
    console.log("╚════════════════════════════════════════╝");
    
    if (results.summary.lrcFiles > 0) {
      console.log(`\n✅ 成功获取 ${results.summary.lrcFiles} 个歌词文件`);
      console.log(`📁 保存位置: ./result/lrc/`);
    }
    
    if (results.summary.failed > 0) {
      console.log(`\n⚠️  ${results.summary.failed} 个文件处理失败`);
    }

  } catch (error) {
    console.error("\n❌ 处理失败:", error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}

// 导出所有模块供外部使用
module.exports = {
  // 主要功能
  processFullPipeline,
  quickStart,
  
  // 核心类
  AudioParser,
  UrlGenerator,
  GequbaoCrawler,
  DomCrawler,
  CrawlerFactory,
  
  // 便捷函数
  run: main
};