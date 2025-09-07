/**
 * 完整流程示例：从音乐文件到歌词文件
 * 1. 解析本地音乐文件
 * 2. 生成搜索URL
 * 3. 爬取歌词
 * 4. 保存为与原文件同名的LRC文件
 */

const AudioParser = require("./audioParser");
const { UrlGenerator } = require("./urlGenerator");
const GequbaoCrawler = require("./gequbaoCrawler");
const fs = require("fs");
const path = require("path");

/**
 * 完整处理流程
 * @param {string} musicFolderPath - 音乐文件夹路径
 * @param {object} options - 配置选项
 */
async function processFullPipeline(musicFolderPath, options = {}) {
  const {
    recursive = true,      // 递归扫描子文件夹
    limit = null,          // 限制处理数量
    delay = 2000,          // 爬取延迟
    saveIntermediateFiles = true  // 保存中间文件
  } = options;

  console.log("========================================");
  console.log("  音乐文件歌词批量获取工具");
  console.log("========================================\n");

  try {
    // 步骤1：解析音乐文件
    console.log("【步骤1】扫描音乐文件...");
    const audioParser = new AudioParser();
    const musicFiles = await audioParser.parseFolder(musicFolderPath, { recursive });
    
    console.log(`找到 ${musicFiles.length} 个音乐文件`);
    
    if (musicFiles.length === 0) {
      console.log("没有找到音乐文件，退出");
      return;
    }

    // 保存音乐列表
    if (saveIntermediateFiles) {
      await audioParser.exportResults(musicFiles, "./music_list.json", "json");
      console.log("音乐列表已保存到 music_list.json\n");
    }

    // 步骤2：生成搜索URL
    console.log("【步骤2】生成搜索URL...");
    const urlGenerator = new UrlGenerator();
    const detailedUrls = urlGenerator.generateDetailedUrls(musicFiles);
    
    console.log(`生成 ${detailedUrls.length} 个搜索URL`);
    
    // 应用限制
    const urlsToProcess = limit ? detailedUrls.slice(0, limit) : detailedUrls;
    if (limit) {
      console.log(`限制处理前 ${limit} 个文件\n`);
    }

    // 步骤3：爬取歌词
    console.log("【步骤3】开始爬取歌词...");
    console.log("----------------------------------------");
    
    const crawler = new GequbaoCrawler({
      outputDir: "./result",
      delay: delay,
      maxConcurrent: 2  // 控制并发数
    });

    const results = await crawler.crawlBatchWithFileNames(urlsToProcess, {
      saveResults: saveIntermediateFiles,
      outputFile: `lyrics-batch-${Date.now()}.json`
    });

    // 步骤4：显示结果统计
    console.log("\n========================================");
    console.log("  处理完成");
    console.log("========================================");
    console.log(`总计处理: ${results.summary.total} 个文件`);
    console.log(`成功获取歌词: ${results.summary.lrcFiles} 个`);
    console.log(`失败: ${results.summary.failed} 个`);
    
    // 显示成功的文件
    if (results.summary.lrcFiles > 0) {
      console.log("\n成功获取歌词的文件:");
      let successCount = 0;
      results.success.forEach((item) => {
        if (item.firstSongDetail && item.firstSongDetail.lrcFile) {
          successCount++;
          console.log(`${successCount}. ${item.firstSongDetail.lrcFile}`);
        }
      });
    }

    // 显示失败的文件
    if (results.errors.length > 0) {
      console.log("\n失败的文件:");
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.originalFile || '未知'}: ${error.error}`);
      });
    }

    console.log("\n歌词文件保存在: ./result/lrc/");
    
    return results;

  } catch (error) {
    console.error("\n处理过程中发生错误:", error.message);
    throw error;
  }
}

/**
 * 快速开始函数
 * @param {string} musicFolderPath - 音乐文件夹路径
 * @param {number} limit - 限制处理数量
 */
async function quickStart(musicFolderPath, limit = 1) {
  return await processFullPipeline(musicFolderPath, {
    recursive: true,
    limit: limit,
    delay: 2000,
    saveIntermediateFiles: true
  });
}

// 主函数
async function main() {
  // 示例：处理音乐文件夹
  const musicFolderPath = "D:\\chromeDownLoad\\musicFlie"; // 修改为你的音乐文件夹路径
  
  // 测试模式：只处理第一个文件
  // await quickStart(musicFolderPath, 1);
  
  // 批量模式：处理前10个文件
  // await quickStart(musicFolderPath, 10);
  
  // 完整模式：处理所有文件（谨慎使用）
  await processFullPipeline(musicFolderPath, {
    recursive: true,
    delay: 2000,
    saveIntermediateFiles: true
  });
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  processFullPipeline,
  quickStart
};