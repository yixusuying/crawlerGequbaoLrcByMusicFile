const request = require("superagent");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

/**
 * 通用DOM爬虫模块
 * 支持API请求和HTML页面解析
 */
class DomCrawler {
  constructor(config = {}) {
    this.defaultHeaders = {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
      ...config.defaultHeaders
    };
    this.outputDir = config.outputDir || "./result";
    this.timeout = config.timeout || 30000;
    this.retryTimes = config.retryTimes || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * 发送HTTP请求
   * @param {Object} options - 请求配置
   * @returns {Promise} 请求结果
   */
  async fetchData(options) {
    const {
      url,
      method = "GET",
      headers = {},
      data = null,
      responseType = "auto"
    } = options;

    let req = request[method.toLowerCase()](url)
      .set({ ...this.defaultHeaders, ...headers })
      .timeout(this.timeout);

    if (data && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      req = req.send(data);
    }

    let retries = 0;
    while (retries < this.retryTimes) {
      try {
        const response = await req;
        return responseType === "json" ? response.body : response;
      } catch (error) {
        retries++;
        if (retries >= this.retryTimes) {
          throw error;
        }
        await this.delay(this.retryDelay);
      }
    }
  }

  /**
   * 解析HTML内容
   * @param {String} html - HTML内容
   * @param {Object} rules - 解析规则
   * @returns {Array} 解析结果
   */
  parseHtml(html, rules) {
    const $ = cheerio.load(html);
    const results = [];
    
    if (rules.selector) {
      const elements = $(rules.selector);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const item = {};
        
        for (const [key, extractor] of Object.entries(rules.fields || {})) {
          if (typeof extractor === "string") {
            // 简单选择器
            item[key] = $(element).find(extractor).text().trim();
          } else if (typeof extractor === "object") {
            // 复杂提取规则
            const { selector, attr, transform } = extractor;
            let value;
            
            if (attr) {
              value = selector ? $(element).find(selector).attr(attr) : $(element).attr(attr);
            } else {
              value = selector ? $(element).find(selector).text().trim() : $(element).text().trim();
            }
            
            if (transform && typeof transform === "function") {
              value = transform(value, $, element);
            }
            
            item[key] = value;
          } else if (typeof extractor === "function") {
            // 自定义提取函数
            item[key] = extractor($, element);
          }
        }
        
        if (Object.keys(item).length > 0) {
          results.push(item);
        }
      }
    }
    
    return results;
  }

  /**
   * 解析JSON数据
   * @param {Object} data - JSON数据
   * @param {Object} rules - 解析规则
   * @returns {Array} 解析结果
   */
  parseJson(data, rules) {
    const results = [];
    const items = this.getNestedProperty(data, rules.dataPath || "");
    
    if (Array.isArray(items)) {
      for (const item of items) {
        const parsed = {};
        
        for (const [key, path] of Object.entries(rules.fields || {})) {
          if (typeof path === "string") {
            parsed[key] = this.getNestedProperty(item, path);
          } else if (typeof path === "object") {
            const { path: fieldPath, transform } = path;
            let value = this.getNestedProperty(item, fieldPath);
            
            if (transform && typeof transform === "function") {
              value = transform(value, item);
            }
            
            parsed[key] = value;
          } else if (typeof path === "function") {
            parsed[key] = path(item);
          }
        }
        
        if (Object.keys(parsed).length > 0) {
          results.push(parsed);
        }
      }
    }
    
    return results;
  }

  /**
   * 获取嵌套对象属性
   * @param {Object} obj - 对象
   * @param {String} path - 属性路径
   * @returns {*} 属性值
   */
  getNestedProperty(obj, path) {
    if (!path) return obj;
    
    const keys = path.split(".");
    let result = obj;
    
    for (const key of keys) {
      if (result && typeof result === "object" && key in result) {
        result = result[key];
      } else {
        return undefined;
      }
    }
    
    return result;
  }

  /**
   * 保存数据到文件
   * @param {Array} data - 数据
   * @param {String} filename - 文件名
   * @returns {Promise} 保存结果
   */
  async saveData(data, filename) {
    // 检查并创建输出目录
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const fullFilename = filename.includes("{timestamp}") 
      ? filename.replace("{timestamp}", timestamp)
      : `${filename}-${timestamp}.json`;
    
    const filepath = path.join(this.outputDir, fullFilename);
    
    return new Promise((resolve, reject) => {
      fs.writeFile(filepath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(filepath);
        }
      });
    });
  }

  /**
   * 延迟函数
   * @param {Number} ms - 延迟毫秒数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 批量爬取
   * @param {Array} tasks - 任务列表
   * @returns {Promise} 爬取结果
   */
  async crawlBatch(tasks) {
    const results = [];
    const errors = [];
    
    const promises = tasks.map(async (task) => {
      try {
        const result = await this.crawl(task);
        results.push({ task, result, success: true });
      } catch (error) {
        errors.push({ task, error, success: false });
      }
    });
    
    await Promise.all(promises);
    
    return { results, errors };
  }

  /**
   * 单个爬取任务
   * @param {Object} task - 任务配置
   * @returns {Promise} 爬取结果
   */
  async crawl(task) {
    const {
      name,
      request: requestConfig,
      parseRules,
      parseType = "auto",
      saveConfig
    } = task;
    
    try {
      // 发送请求
      const response = await this.fetchData(requestConfig);
      
      // 解析数据
      let data;
      if (parseType === "html" || (parseType === "auto" && response.text)) {
        data = this.parseHtml(response.text, parseRules);
      } else if (parseType === "json" || (parseType === "auto" && response.body)) {
        data = this.parseJson(response.body, parseRules);
      } else {
        throw new Error("无法确定解析类型");
      }
      
      // 保存数据
      if (saveConfig && saveConfig.enabled !== false) {
        const filename = saveConfig.filename || name || "crawled-data-{timestamp}";
        const filepath = await this.saveData(data, filename);
        console.log(`[${name}] 数据已保存到: ${filepath}`);
      }
      
      return data;
    } catch (error) {
      console.error(`[${name}] 爬取失败:`, error.message);
      throw error;
    }
  }
}

module.exports = DomCrawler;