const fs = require("fs");
const path = require("path");

/**
 * 生成歌曲宝搜索URL
 * 从音频解析结果生成搜索链接
 */
class UrlGenerator {
  constructor() {
    this.baseUrl = "https://www.gequbao.com/s/";
  }

  /**
   * 从JSON文件生成URL数组
   * @param {string} jsonFilePath - JSON文件路径
   * @returns {Array<string>} URL数组
   */
  generateUrlsFromFile(jsonFilePath) {
    try {
      // 读取JSON文件
      if (!fs.existsSync(jsonFilePath)) {
        throw new Error(`文件不存在: ${jsonFilePath}`);
      }

      const fileContent = fs.readFileSync(jsonFilePath, "utf8");
      const musicList = JSON.parse(fileContent);

      // 验证数据格式
      if (!Array.isArray(musicList)) {
        throw new Error("JSON文件格式错误：期望一个数组");
      }

      // 生成URL数组
      const urls = this.generateUrls(musicList);
      
      console.log(`成功生成 ${urls.length} 个搜索链接`);
      return urls;

    } catch (error) {
      console.error("生成URL失败:", error.message);
      throw error;
    }
  }

  /**
   * 从音乐数据数组生成URL数组
   * @param {Array} musicList - 音乐信息数组
   * @returns {Array<string>} URL数组
   */
  generateUrls(musicList) {
    const urls = [];
    
    for (const music of musicList) {
      // 跳过缺少必要信息的项
      if (!music.title || music.artist === "未知歌手") {
        console.warn(`跳过: ${music.fileName} (信息不完整)`);
        continue;
      }

      // 清理歌名和歌手名
      const cleanTitle = this.cleanString(music.title);
      const cleanArtist = this.cleanString(music.artist);
      
      // 生成搜索关键词
      const searchKeyword = `${cleanTitle} ${cleanArtist}`;
      
      // 编码并生成完整URL
      const encodedKeyword = encodeURIComponent(searchKeyword);
      const url = `${this.baseUrl}${encodedKeyword}`;
      
      urls.push(url);
    }
    
    return urls;
  }

  /**
   * 清理字符串（移除特殊字符等）
   * @param {string} str - 原始字符串
   * @returns {string} 清理后的字符串
   */
  cleanString(str) {
    return str
      .replace(/[《》【】\[\]\(\)（）]/g, "")  // 移除括号
      .replace(/[-_]/g, " ")                    // 替换分隔符为空格
      .replace(/\s+/g, " ")                      // 规范化空格
      .trim();
  }

  /**
   * 生成带详细信息的URL对象数组
   * @param {Array} musicList - 音乐信息数组
   * @returns {Array<object>} URL对象数组
   */
  generateDetailedUrls(musicList) {
    const results = [];
    
    for (const music of musicList) {
      if (!music.title || music.artist === "未知歌手") {
        continue;
      }

      const cleanTitle = this.cleanString(music.title);
      const cleanArtist = this.cleanString(music.artist);
      const searchKeyword = `${cleanTitle} ${cleanArtist}`;
      const encodedKeyword = encodeURIComponent(searchKeyword);
      const url = `${this.baseUrl}${encodedKeyword}`;
      
      results.push({
        title: music.title,
        artist: music.artist,
        searchKeyword,
        url,
        originalFile: music.fileName
      });
    }
    console.log(results, '////')
    return results;
  }

  /**
   * 保存URL列表到文件
   * @param {Array<string>} urls - URL数组
   * @param {string} outputPath - 输出文件路径
   * @param {string} format - 输出格式 (txt, json)
   */
  saveUrls(urls, outputPath, format = "txt") {
    try {
      let content;
      
      switch (format.toLowerCase()) {
        case "txt":
          content = urls.join("\n");
          break;
        case "json":
          content = JSON.stringify(urls, null, 2);
          break;
        default:
          throw new Error(`不支持的格式: ${format}`);
      }
      
      fs.writeFileSync(outputPath, content, "utf8");
      console.log(`URL列表已保存到: ${outputPath}`);
      
    } catch (error) {
      console.error("保存失败:", error.message);
      throw error;
    }
  }

  /**
   * 批量处理多个JSON文件
   * @param {Array<string>} jsonFiles - JSON文件路径数组
   * @returns {Array<string>} 合并后的URL数组
   */
  batchProcess(jsonFiles) {
    const allUrls = [];
    
    for (const jsonFile of jsonFiles) {
      try {
        const urls = this.generateUrlsFromFile(jsonFile);
        allUrls.push(...urls);
      } catch (error) {
        console.error(`处理文件失败 ${jsonFile}:`, error.message);
      }
    }
    
    // 去重
    const uniqueUrls = [...new Set(allUrls)];
    console.log(`总共生成 ${uniqueUrls.length} 个唯一URL (原始: ${allUrls.length})`);
    
    return uniqueUrls;
  }
}

// 便捷函数：直接从JSON文件生成URL数组
function parseJsonToUrls(jsonFilePath) {
  const generator = new UrlGenerator();
  return generator.generateUrlsFromFile(jsonFilePath);
}

// 便捷函数：从音乐数据生成URL数组
function generateSearchUrls(musicList) {
  const generator = new UrlGenerator();
  return generator.generateUrls(musicList);
}

module.exports = {
  UrlGenerator,
  parseJsonToUrls,
  generateSearchUrls
};