# 歌曲宝歌词批量获取工具

自动从本地音乐文件批量获取对应的LRC歌词文件。

## 功能特点

- 🎵 **智能识别** - 自动解析音乐文件名，提取歌手和歌名信息
- 🔍 **批量搜索** - 批量在歌曲宝网站搜索对应歌词
- 📝 **自动保存** - 将歌词保存为与原音乐文件同名的LRC文件
- 🚀 **高效处理** - 支持并发控制和请求延迟，避免频繁请求
- 📁 **递归扫描** - 支持递归扫描子文件夹中的音乐文件

## 快速开始

### 1. 最简单的使用方式

```bash
# 直接运行主程序
node gequbaoLrc/index.js
```

默认会扫描 `D:\chromeDownLoad\musicFlie` 文件夹，你需要修改 `index.js` 中的路径。

### 2. 代码中使用

```javascript
const { quickStart } = require('./gequbaoLrc');

// 处理音乐文件夹，获取前10个文件的歌词
await quickStart('D:\\你的音乐文件夹', 10);
```

### 3. 完整配置

```javascript
const { processFullPipeline } = require('./gequbaoLrc');

const results = await processFullPipeline('D:\\音乐文件夹', {
  recursive: true,        // 递归扫描子文件夹
  limit: 50,             // 限制处理50个文件
  delay: 2000,           // 请求间隔2秒
  saveIntermediateFiles: true  // 保存中间文件
});
```

## 工作流程

1. **扫描音乐文件** 
   - 扫描指定文件夹中的音乐文件（.mp3, .wav, .flac等）
   - 解析文件名，提取歌手和歌名信息

2. **生成搜索URL**
   - 根据歌手和歌名生成歌曲宝搜索URL
   - 保留原始文件名映射关系

3. **爬取歌词**
   - 访问歌曲宝网站搜索歌曲
   - 获取第一个搜索结果的详情页
   - 从 `#content-lrc` 元素提取歌词内容

4. **保存LRC文件**
   - 使用原始音乐文件名保存歌词
   - 保存位置：`./result/lrc/`
   - 文件名格式：`原始文件名.lrc`

## 文件说明

### 核心模块

- **index.js** - 主入口文件，运行完整流程
- **fullPipeline.js** - 完整处理流程实现
- **audioParser.js** - 音乐文件解析器
- **urlGenerator.js** - 搜索URL生成器
- **gequbaoCrawler.js** - 歌曲宝网站爬虫
- **domCrawler.js** - 通用DOM爬虫基类
- **crawlerFactory.js** - 爬虫工厂类

### 测试文件

- **testGequbao.js** - 爬虫功能测试
- **example.js** - 使用示例

### 输出文件

- **./result/lrc/** - LRC歌词文件保存目录
- **./music_list.json** - 扫描到的音乐文件列表
- **./result/*.json** - 爬取结果记录

## 支持的音乐格式

- .mp3
- .wav
- .flac
- .m4a
- .aac
- .ogg
- .wma

## 文件名解析规则

支持以下常见格式：
- `歌手 - 歌名.mp3`
- `歌手 － 歌名.mp3`（中文破折号）
- `歌手_歌名.mp3`
- `歌名【歌手】.mp3`
- `歌名[歌手].mp3`
- `歌名(歌手).mp3`
- `歌名 by 歌手.mp3`

## 配置选项

| 参数 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| recursive | Boolean | true | 是否递归扫描子文件夹 |
| limit | Number | null | 限制处理文件数量 |
| delay | Number | 2000 | 请求间隔（毫秒） |
| saveIntermediateFiles | Boolean | true | 是否保存中间文件 |
| maxConcurrent | Number | 2 | 最大并发请求数 |

## 注意事项

1. **请求频率** - 默认设置了2秒的请求延迟，避免对网站造成压力
2. **文件名匹配** - LRC文件名会完全匹配原始音乐文件名
3. **错误处理** - 如果某个文件获取失败，不会影响其他文件的处理
4. **歌词来源** - 歌词来自歌曲宝网站（gequbao.com）

## 使用示例

### 示例1：处理单个文件夹

```javascript
const { quickStart } = require('./gequbaoLrc');

// 只处理1个文件（测试用）
await quickStart('D:\\Music', 1);

// 处理前20个文件
await quickStart('D:\\Music', 20);
```

### 示例2：自定义配置

```javascript
const { processFullPipeline } = require('./gequbaoLrc');

const results = await processFullPipeline('D:\\Music', {
  recursive: false,      // 不递归子文件夹
  limit: 100,           // 处理100个文件
  delay: 3000,          // 3秒延迟
  saveIntermediateFiles: false  // 不保存中间文件
});

console.log(`成功获取 ${results.summary.lrcFiles} 个歌词文件`);
```

### 示例3：单独使用各模块

```javascript
const AudioParser = require('./gequbaoLrc/audioParser');
const { UrlGenerator } = require('./gequbaoLrc/urlGenerator');
const GequbaoCrawler = require('./gequbaoLrc/gequbaoCrawler');

// 1. 解析音乐文件
const parser = new AudioParser();
const musicFiles = await parser.parseFolder('D:\\Music');

// 2. 生成URL
const generator = new UrlGenerator();
const urls = generator.generateDetailedUrls(musicFiles);

// 3. 爬取歌词
const crawler = new GequbaoCrawler();
const results = await crawler.crawlBatchWithFileNames(urls, { limit: 10 });
```

## 故障排除

### 问题：找不到歌词
- 检查歌名和歌手是否正确解析
- 尝试修改文件名格式为 `歌手 - 歌名.mp3`

### 问题：爬取速度慢
- 适当减小 `delay` 参数（但不建议低于1000ms）
- 增加 `maxConcurrent` 参数（但不建议超过5）

### 问题：文件名包含特殊字符
- 程序会自动处理文件名中的特殊字符
- LRC文件名会移除不允许的字符

## 开发说明

本工具基于Node.js开发，主要依赖：
- `superagent` - HTTP请求
- `cheerio` - HTML解析
- `fs` - 文件操作

## License

仅供学习研究使用，请遵守相关网站的使用条款。