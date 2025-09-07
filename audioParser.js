const fs = require("fs");
const path = require("path");

/**
 * 音频文件解析器
 * 用于解析本地文件夹中的音频文件，提取歌曲名和歌手信息
 */
class AudioParser {
  constructor() {
    // 支持的音频格式
    this.supportedFormats = [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".wma"];
    
    // 常见的文件名分隔符模式
    this.separatorPatterns = [
      { pattern: /^(.+?)\s*-\s*(.+?)$/, artistIndex: 1, titleIndex: 2 }, // 歌手 - 歌名
      { pattern: /^(.+?)\s*－\s*(.+?)$/, artistIndex: 1, titleIndex: 2 }, // 歌手 － 歌名（中文破折号）
      { pattern: /^(.+?)\s*_\s*(.+?)$/, artistIndex: 1, titleIndex: 2 },  // 歌手 _ 歌名
      { pattern: /^(.+?)\s*【(.+?)】$/, artistIndex: 2, titleIndex: 1 },   // 歌名【歌手】
      { pattern: /^(.+?)\s*\[(.+?)\]$/, artistIndex: 2, titleIndex: 1 },   // 歌名[歌手]
      { pattern: /^(.+?)\s*\((.+?)\)$/, artistIndex: 2, titleIndex: 1 },   // 歌名(歌手)
      { pattern: /^(.+?)\s*by\s*(.+?)$/i, artistIndex: 2, titleIndex: 1 }, // 歌名 by 歌手
    ];
  }

  /**
   * 解析文件夹中的音频文件
   * @param {string} folderPath - 文件夹路径
   * @param {object} options - 解析选项
   * @returns {Promise<Array>} 解析结果数组
   */
  async parseFolder(folderPath, options = {}) {
    const {
      recursive = false,        // 是否递归子文件夹
      includeMetadata = false,  // 是否读取文件元数据（需要额外依赖）
      customPatterns = []        // 自定义解析模式
    } = options;

    try {
      // 验证文件夹是否存在
      if (!fs.existsSync(folderPath)) {
        throw new Error(`文件夹不存在: ${folderPath}`);
      }

      const stats = fs.statSync(folderPath);
      if (!stats.isDirectory()) {
        throw new Error(`路径不是文件夹: ${folderPath}`);
      }

      // 获取音频文件列表
      const audioFiles = await this.getAudioFiles(folderPath, recursive);
      
      // 解析每个文件
      const results = [];
      for (const filePath of audioFiles) {
        const parsed = await this.parseAudioFile(filePath, {
          includeMetadata,
          customPatterns
        });
        if (parsed) {
          results.push(parsed);
        }
      }

      return results;
    } catch (error) {
      console.error("解析文件夹失败:", error.message);
      throw error;
    }
  }

  /**
   * 获取文件夹中的音频文件
   * @param {string} folderPath - 文件夹路径
   * @param {boolean} recursive - 是否递归
   * @returns {Promise<Array>} 文件路径数组
   */
  async getAudioFiles(folderPath, recursive = false) {
    const files = [];
    
    const scanDir = async (dirPath) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && recursive) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (this.supportedFormats.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };
    
    await scanDir(folderPath);
    return files;
  }

  /**
   * 解析单个音频文件
   * @param {string} filePath - 文件路径
   * @param {object} options - 解析选项
   * @returns {Promise<object>} 解析结果
   */
  async parseAudioFile(filePath, options = {}) {
    const { includeMetadata = false, customPatterns = [] } = options;
    
    try {
      const fileName = path.basename(filePath);
      const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
      
      // 基础信息
      const fileInfo = {
        filePath,
        fileName,
        fileSize: fs.statSync(filePath).size,
        fileExtension: path.extname(filePath).toLowerCase()
      };

      // 从文件名解析
      const parsed = this.parseFileName(fileNameWithoutExt, customPatterns);
      
      // 如果需要读取元数据（需要额外安装 music-metadata 包）
      let metadata = null;
      if (includeMetadata) {
        try {
          metadata = await this.readMetadata(filePath);
        } catch (err) {
          console.warn(`无法读取文件元数据: ${fileName}`);
        }
      }

      // 合并信息
      const result = {
        ...fileInfo,
        title: parsed.title || metadata?.title || fileNameWithoutExt,
        artist: parsed.artist || metadata?.artist || "未知歌手",
        album: metadata?.album || null,
        year: metadata?.year || null,
        genre: metadata?.genre || null,
        duration: metadata?.duration || null,
        parsedFromFileName: !metadata || (parsed.title && parsed.artist)
      };

      return result;
    } catch (error) {
      console.error(`解析文件失败: ${filePath}`, error.message);
      return null;
    }
  }

  /**
   * 从文件名解析歌曲信息
   * @param {string} fileName - 文件名（不含扩展名）
   * @param {Array} customPatterns - 自定义模式
   * @returns {object} 解析结果
   */
  parseFileName(fileName, customPatterns = []) {
    // 清理文件名
    let cleanName = fileName
      .replace(/^\d+[\.\-\s]*/, "")  // 移除开头的数字编号
      .replace(/\s+/g, " ")           // 规范化空格
      .trim();

    // 尝试所有模式（自定义模式优先）
    const allPatterns = [...customPatterns, ...this.separatorPatterns];
    
    for (const patternConfig of allPatterns) {
      const match = cleanName.match(patternConfig.pattern);
      if (match) {
        return {
          title: match[patternConfig.titleIndex]?.trim() || cleanName,
          artist: match[patternConfig.artistIndex]?.trim() || "未知歌手"
        };
      }
    }

    // 如果没有匹配的模式，返回默认值
    return {
      title: cleanName,
      artist: "未知歌手"
    };
  }

  /**
   * 读取音频文件元数据
   * @param {string} filePath - 文件路径
   * @returns {Promise<object>} 元数据
   */
  async readMetadata(filePath) {
    // 注意：这个功能需要安装 music-metadata 包
    // npm install music-metadata
    try {
      const mm = require("music-metadata");
      const metadata = await mm.parseFile(filePath);
      
      return {
        title: metadata.common.title,
        artist: metadata.common.artist || metadata.common.artists?.join(", "),
        album: metadata.common.album,
        year: metadata.common.year,
        genre: metadata.common.genre?.join(", "),
        duration: metadata.format.duration
      };
    } catch (error) {
      // 如果没有安装 music-metadata，返回 null
      return null;
    }
  }

  /**
   * 批量重命名文件（可选功能）
   * @param {Array} files - 文件信息数组
   * @param {string} pattern - 重命名模式
   */
  async batchRename(files, pattern = "{artist} - {title}") {
    const results = [];
    
    for (const file of files) {
      if (file.artist === "未知歌手" || !file.title) {
        console.warn(`跳过重命名: ${file.fileName} (信息不完整)`);
        continue;
      }

      const newName = pattern
        .replace("{artist}", file.artist)
        .replace("{title}", file.title)
        .replace("{album}", file.album || "")
        .replace("{year}", file.year || "");

      const newPath = path.join(
        path.dirname(file.filePath),
        newName + file.fileExtension
      );

      try {
        if (file.filePath !== newPath) {
          fs.renameSync(file.filePath, newPath);
          results.push({
            oldPath: file.filePath,
            newPath,
            success: true
          });
        }
      } catch (error) {
        results.push({
          oldPath: file.filePath,
          newPath,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * 导出解析结果
   * @param {Array} results - 解析结果
   * @param {string} outputPath - 输出路径
   * @param {string} format - 输出格式 (json, csv, txt)
   */
  async exportResults(results, outputPath, format = "json") {
    try {
      let content;
      
      switch (format.toLowerCase()) {
        case "json":
          content = JSON.stringify(results, null, 2);
          break;
          
        case "csv":
          content = this.toCSV(results);
          break;
          
        case "txt":
          content = results.map(r => 
            `${r.artist} - ${r.title} (${r.fileName})`
          ).join("\n");
          break;
          
        default:
          throw new Error(`不支持的格式: ${format}`);
      }

      fs.writeFileSync(outputPath, content, "utf8");
      console.log(`结果已导出到: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error("导出失败:", error.message);
      throw error;
    }
  }

  /**
   * 转换为CSV格式
   * @param {Array} results - 结果数组
   * @returns {string} CSV字符串
   */
  toCSV(results) {
    if (results.length === 0) return "";
    
    const headers = ["文件名", "歌手", "歌名", "专辑", "年份", "时长", "文件大小", "文件路径"];
    const rows = results.map(r => [
      r.fileName,
      r.artist,
      r.title,
      r.album || "",
      r.year || "",
      r.duration || "",
      r.fileSize,
      r.filePath
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    return csvContent;
  }
}

module.exports = AudioParser;