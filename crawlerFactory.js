const DomCrawler = require("./domCrawler");

/**
 * 爬虫工厂类
 * 用于创建预配置的爬虫实例
 */
class CrawlerFactory {
  /**
   * 创建极客公园爬虫
   */
  static createGeekParkCrawler() {
    const crawler = new DomCrawler({
      outputDir: "./result",
      defaultHeaders: {
        Cookie: "_gid=GA1.2.1840963048.1686707197; _ga_7X8H30VQT1=GS1.2.1686707197.1.0.1686707197.0.0.0; _ga=GA1.1.1569309543.1686451504",
      }
    });

    // 定义爬取任务
    const tasks = [
      {
        name: "GeekPark-7Days-Hot",
        request: {
          url: "https://mainssl.geekpark.net/api/v1/posts/hot_in_week?per=7",
          method: "GET",
          headers: {
            Accept: "application/json, text/plain, */*"
          }
        },
        parseType: "json",
        parseRules: {
          dataPath: "posts",
          fields: {
            title: "title",
            coverimg: "cover_url",
            infomsg: "abstract",
            url: {
              path: "id",
              transform: (id) => `https://www.geekpark.net/news/${id}`
            },
            date: {
              path: "published_timestamp",
              transform: (timestamp) => new Date(timestamp * 1000).toLocaleDateString()
            },
            readcount: "views"
          }
        },
        saveConfig: {
          filename: "TopArticlesGeekParkSevenDays-{timestamp}"
        }
      },
      {
        name: "GeekPark-Homepage",
        request: {
          url: "https://www.geekpark.net/",
          method: "GET",
          headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        },
        parseType: "html",
        parseRules: {
          selector: "#index > div.main-content > div > div.article-list > article",
          fields: {
            title: {
              selector: "div.article-info > a:nth-child(3)",
              transform: (value) => value
            },
            url: {
              selector: "div.article-info > a:nth-child(3)",
              attr: "href"
            }
          }
        },
        saveConfig: {
          filename: "GeekParkHomeArticle-{timestamp}"
        }
      }
    ];

    return { crawler, tasks };
  }

  /**
   * 创建掘金爬虫
   */
  static createJuejinCrawler() {
    const crawler = new DomCrawler({
      outputDir: "./result"
    });

    const tasks = [
      {
        name: "Juejin-Recommend",
        request: {
          url: "https://api.juejin.cn/recommend_api/v1/article/recommend_cate_feed?aid=2608&uuid=7235364857821005312&spider=0",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Secsdk-Csrf-Token": "0001000000010cc22c6d3dca95c8411c1f89142fd1ccf9eb548cd0396bb0ca35bb6d8c5878521768aff2326ac03a"
          },
          data: {
            cate_id: "6809637767543259144",
            cursor: "0",
            id_type: 2,
            limit: 20,
            sort_type: 200
          }
        },
        parseType: "json",
        parseRules: {
          dataPath: "data",
          fields: {
            url: {
              path: "article_id",
              transform: (id) => `https://juejin.cn/post/${id}`
            },
            title: "article_info.title",
            infomsg: "article_info.brief_content",
            readcount: "article_info.view_count",
            coverimg: "article_info.cover_image",
            date: {
              path: "article_info.ctime",
              transform: (ctime) => new Date(ctime * 1000).toLocaleDateString()
            }
          }
        },
        saveConfig: {
          filename: "juejinRecommendPosts-{timestamp}"
        }
      }
    ];

    return { crawler, tasks };
  }

  /**
   * 创建通用爬虫
   * @param {Object} config - 爬虫配置
   */
  static createCustomCrawler(config = {}) {
    return new DomCrawler(config);
  }
}

module.exports = CrawlerFactory;