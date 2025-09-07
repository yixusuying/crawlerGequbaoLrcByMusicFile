const DomCrawler = require("./domCrawler");
const request = require("superagent");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

/**
 * 歌曲宝爬虫
 * 爬取歌曲宝网站的搜索结果和歌词信息
 */
class GequbaoCrawler {
  constructor(config = {}) {
    this.crawler = new DomCrawler({
      outputDir: config.outputDir || "./result",
      timeout: config.timeout || 30000,
      retryTimes: config.retryTimes || 3,
      retryDelay: config.retryDelay || 2000
    });
    
    this.delay = config.delay || 1000; // 请求间隔，避免频繁请求
    this.maxConcurrent = config.maxConcurrent || 3; // 最大并发数
  }

  /**
   * 爬取单个搜索URL
   * @param {string} url - 搜索URL
   * @param {object} options - 配置选项，包含原始文件名等
   * @returns {Promise<object>} 爬取结果
   */
  async crawlSearchUrl(url, options = {}) {
    try {
      console.log(`正在爬取: ${decodeURIComponent(url)}`);
      
      // 发送请求
      const response = await this.crawler.fetchData({
        url,
        method: "GET",
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Referer": "https://www.gequbao.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      // 解析HTML
      const $ = cheerio.load(response.text);
      
      // 提取搜索关键词
      const searchKeyword = decodeURIComponent(url.split('/s/')[1] || '');
      
      // 解析搜索结果
      const searchResults = this.parseSearchResults($);
      
      // 如果有搜索结果，获取第一个结果的详细信息
      let firstSongDetail = null;
      if (searchResults.length > 0) {
        const firstSong = searchResults[0];
        if (firstSong.detailUrl) {
          // 延迟后获取详情
          await this.crawler.delay(this.delay);
          firstSongDetail = await this.crawlSongDetail(firstSong.detailUrl, { 
            saveLrc: true,
            originalFileName: options.originalFileName  // 传递原始文件名
          });
        }
      }
      
      return {
        url,
        searchKeyword,
        totalResults: searchResults.length,
        results: searchResults,
        firstSongDetail,
        originalFileName: options.originalFileName,
        crawledAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`爬取失败 ${url}:`, error.message);
      return {
        url,
        error: error.message,
        crawledAt: new Date().toISOString()
      };
    }
  }

  /**
   * 解析搜索结果页面
   * @param {CheerioAPI} $ - Cheerio实例
   * @returns {Array} 搜索结果数组
   */
  parseSearchResults($) {
    const results = [];
    
    // 查找搜索结果列表
    // 注意：选择器可能需要根据实际页面结构调整
    $('body > div.container > div:nth-child(4) > div > div.card-text > div:nth-child(2) > div.col-8.col-content').each((index, element) => {
      const $item = $(element);
      const detailUrl = $item.find('a').attr('href');
      if (detailUrl) {
        results.push({
          detailUrl: 'https://www.gequbao.com' + detailUrl
        });
      }
    });
    console.log(results)

    // 如果上面的选择器没有找到结果，尝试其他可能的选择器
    if (results.length === 0) {
      console.log("啥也没有")
    }
    return results;
  }

  /**
   * 爬取歌曲详情页
   * @param {string} detailUrl - 详情页URL
   * @param {object} options - 配置选项
   * @returns {Promise<object>} 歌曲详情
   */
  async crawlSongDetail(detailUrl, options = {}) {
    try {
      console.log(`  获取详情: ${detailUrl}`);
      
      const response = await this.crawler.fetchData({
        url: detailUrl,
        method: "GET",
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Referer": "https://www.gequbao.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });

      const $ = cheerio.load(response.text);
      
      // 提取歌词 - 从id为content-lrc的元素
      const lyrics = this.extractLyrics($);
      
      // 提取歌曲标题和歌手信息
      let title = $('.song-title, h1, .title').first().text().trim();
      let artist = $('.artist, .singer').first().text().trim();
      
      // 如果没有找到，尝试从URL中提取
      if (!title && detailUrl) {
        const urlParts = detailUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart) {
          title = decodeURIComponent(lastPart).replace(/-/g, ' ');
        }
      }
      
      // 构建歌曲信息
      const songInfo = {
        title: title || 'unknown',
        artist: artist || 'unknown',
        album: $('.album').text().trim(),
        lyrics,
        hasLyrics: lyrics && lyrics.length > 0,
        detailUrl
      };
      
      // 如果有歌词且需要保存
      if (songInfo.hasLyrics && options.saveLrc !== false) {
        const lrcFileName = await this.saveLrcFile(songInfo, options.originalFileName);
        songInfo.lrcFile = lrcFileName;
      }
      
      return songInfo;
      
    } catch (error) {
      console.error(`  获取详情失败:`, error.message);
      return null;
    }
  }

  /**
   * 提取歌词
   * @param {CheerioAPI} $ - Cheerio实例
   * @returns {string} 歌词文本
   */
  extractLyrics($) {
    // 首先尝试从id为content-lrc的元素获取歌词
    const contentLrc = $('#content-lrc').text().trim();
    if (contentLrc) {
      console.log('  成功从 #content-lrc 提取歌词');
      return contentLrc;
    }
    
    // 如果没找到，尝试其他可能的歌词选择器
    const lyricsSelectors = [
      '#lrc, .lrc, .lyrics',
      '.lyric-content',
      '.song-lyrics',
      'pre.lyrics',
      '#lyrics-container',
      '.lrc-content'
    ];
    
    for (const selector of lyricsSelectors) {
      const lyrics = $(selector).text().trim();
      if (lyrics) {
        console.log(`  从 ${selector} 提取歌词`);
        return lyrics;
      }
    }
    
    // 如果没找到，尝试查找包含[00:00]格式的元素
    let lyricsText = '';
    $('*').each((i, elem) => {
      const text = $(elem).text();
      if (text.includes('[00:') || text.includes('[01:') || text.includes('[02:')) {
        lyricsText = text.trim();
        return false; // break
      }
    });
    
    if (lyricsText) {
      console.log('  通过时间标签格式找到歌词');
    } else {
      console.log('  未找到歌词');
    }
    
    return lyricsText;
  }

  /**
   * 保存LRC歌词文件
   * @param {object} songInfo - 歌曲信息
   * @param {string} originalFileName - 原始音乐文件名
   * @returns {Promise<string>} 保存的文件名
   */
  async saveLrcFile(songInfo, originalFileName) {
    try {
      // 创建LRC文件夹（如果不存在）
      const lrcDir = path.join(this.crawler.outputDir, 'lrc');
      if (!fs.existsSync(lrcDir)) {
        fs.mkdirSync(lrcDir, { recursive: true });
      }
      
      // 使用原始文件名（如果提供）
      let lrcFileName;
      if (originalFileName) {
        // 移除原始文件的扩展名，添加.lrc
        const nameWithoutExt = originalFileName.replace(/\.(mp3|wav|flac|m4a|aac|ogg|wma)$/i, '');
        lrcFileName = `${nameWithoutExt}.lrc`;
        console.log(`  使用原始文件名: ${lrcFileName}`);
      } else {
        // 如果没有原始文件名，使用歌手-歌名格式
        const safeFileName = `${songInfo.artist} - ${songInfo.title}`
          .replace(/[<>:"/\\|?*]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        lrcFileName = `${safeFileName}.lrc`;
      }
      
      const lrcFilePath = path.join(lrcDir, lrcFileName);
      
      // 添加LRC文件头信息
      let lrcContent = '';
      if (songInfo.title) {
        lrcContent += `[ti:${songInfo.title}]\n`;
      }
      if (songInfo.artist) {
        lrcContent += `[ar:${songInfo.artist}]\n`;
      }
      if (songInfo.album) {
        lrcContent += `[al:${songInfo.album}]\n`;
      }
      lrcContent += `[by:GequbaoCrawler]\n`;
      lrcContent += `[from:${songInfo.detailUrl}]\n\n`;
      
      // 添加歌词内容
      lrcContent += songInfo.lyrics;
      
      // 保存文件
      fs.writeFileSync(lrcFilePath, lrcContent, 'utf8');
      console.log(`  歌词已保存: ${lrcFileName}`);
      
      return lrcFileName;
      
    } catch (error) {
      console.error('  保存LRC文件失败:', error.message);
      return null;
    }
  }

  /**
   * 批量爬取URL数组
   * @param {Array<string>} urls - URL数组
   * @param {object} options - 爬取选项
   * @returns {Promise<Array>} 爬取结果数组
   */
  async crawlBatch(urls, options = {}) {
    const {
      limit = urls.length,  // 限制爬取数量
      saveResults = false,    // 是否保存结果
      outputFile = `gequbao-results-${Date.now()}.json`
    } = options;
    
    const results = [];
    const errors = [];
    
    // 限制爬取数量
    const urlsToProcess = urls.slice(0, limit);
    
    console.log(`开始爬取 ${urlsToProcess.length} 个URL...`);
    
    // 分批处理，控制并发
    for (let i = 0; i < urlsToProcess.length; i += this.maxConcurrent) {
      const batch = urlsToProcess.slice(i, i + this.maxConcurrent);
      
      const batchPromises = batch.map(async (url, index) => {
        try {
          // 添加延迟，避免请求过快
          if (index > 0) {
            await this.crawler.delay(this.delay * index);
          }
          
          const result = await this.crawlSearchUrl(url);
          results.push(result);
          
          console.log(`[${results.length}/${urlsToProcess.length}] 完成`);
          
        } catch (error) {
          errors.push({ url, error: error.message });
          console.error(`爬取失败: ${url}`);
        }
      });
      
      await Promise.all(batchPromises);
      
      // 批次间延迟
      if (i + this.maxConcurrent < urlsToProcess.length) {
        await this.crawler.delay(this.delay * 2);
      }
    }
    
    // 保存结果
    if (saveResults && results.length > 0) {
      const outputPath = path.join(this.crawler.outputDir, outputFile);
      await this.crawler.saveData(results, outputFile.replace('.json', ''));
      console.log(`\n结果已保存: ${outputPath}`);
    }
    
    console.log(`\n爬取完成: 成功 ${results.length}, 失败 ${errors.length}`);
    
    return {
      success: results,
      errors,
      summary: {
        total: urlsToProcess.length,
        succeeded: results.length,
        failed: errors.length,
        savedTo: saveResults ? path.join(this.crawler.outputDir, outputFile) : null
      }
    };
  }

  /**
   * 从音乐列表文件生成URL并爬取（带文件名映射）
   * @param {string} musicListFile - 音乐列表JSON文件路径
   * @param {object} options - 选项
   * @returns {Promise<Array>} 爬取结果
   */
  async crawlFromMusicList(musicListFile, options = {}) {
    const fs = require("fs");
    const { UrlGenerator } = require("../gequbao/urlGenerator");
    
    // 读取音乐列表
    const musicList = JSON.parse(fs.readFileSync(musicListFile, "utf8"));
    
    // 生成带详细信息的URL
    const generator = new UrlGenerator();
    const detailedUrls = generator.generateDetailedUrls(musicList);
    
    console.log(`从 ${musicListFile} 生成了 ${detailedUrls.length} 个URL`);
    
    // 爬取URL，保留原始文件名
    return await this.crawlBatchWithFileNames(detailedUrls, options);
  }

  /**
   * 批量爬取URL（带原始文件名）
   * @param {Array} urlObjects - URL对象数组，包含url和originalFile
   * @param {object} options - 爬取选项
   * @returns {Promise<object>} 爬取结果
   */
  async crawlBatchWithFileNames(urlObjects, options = {}) {
    const {
      limit = urlObjects.length,
      saveResults = false,
      outputFile = `gequbao-results-${Date.now()}.json`
    } = options;
    
    const results = [];
    const errors = [];
    
    // 限制爬取数量
    const itemsToProcess = urlObjects.slice(0, limit);
    
    console.log(`开始爬取 ${itemsToProcess.length} 个URL（带文件名映射）...`);
    
    // 分批处理，控制并发
    for (let i = 0; i < itemsToProcess.length; i += this.maxConcurrent) {
      const batch = itemsToProcess.slice(i, i + this.maxConcurrent);
      
      const batchPromises = batch.map(async (item, index) => {
        try {
          // 添加延迟
          if (index > 0) {
            await this.crawler.delay(this.delay * index);
          }
          
          console.log(`\n[${results.length + 1}/${itemsToProcess.length}] 处理: ${item.originalFile || item.title}`);
          
          // 爬取URL，传递原始文件名
          const result = await this.crawlSearchUrl(item.url, {
            originalFileName: item.originalFile
          });
          
          results.push(result);
          
          if (result.firstSongDetail && result.firstSongDetail.lrcFile) {
            console.log(`  ✓ 歌词已保存为: ${result.firstSongDetail.lrcFile}`);
          }
          
        } catch (error) {
          errors.push({ 
            url: item.url, 
            originalFile: item.originalFile,
            error: error.message 
          });
          console.error(`  ✗ 爬取失败: ${error.message}`);
        }
      });
      
      await Promise.all(batchPromises);
      
      // 批次间延迟
      if (i + this.maxConcurrent < itemsToProcess.length) {
        await this.crawler.delay(this.delay * 2);
      }
    }
    
    // 保存结果
    if (saveResults && results.length > 0) {
      await this.crawler.saveData(results, outputFile.replace('.json', ''));
      console.log(`\n结果已保存: ${path.join(this.crawler.outputDir, outputFile)}`);
    }
    
    console.log(`\n爬取完成: 成功 ${results.length}, 失败 ${errors.length}`);
    
    return {
      success: results,
      errors,
      summary: {
        total: itemsToProcess.length,
        succeeded: results.length,
        failed: errors.length,
        lrcFiles: results.filter(r => r.firstSongDetail?.lrcFile).length,
        savedTo: saveResults ? path.join(this.crawler.outputDir, outputFile) : null
      }
    };
  }
}

module.exports = GequbaoCrawler;