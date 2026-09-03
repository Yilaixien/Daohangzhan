-- ============================================
-- 网址导航站 - MySQL Schema
-- ============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 1. categories 表（分组）
-- ============================================
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 10,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_categories_sort` (`sort_order`, `is_visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分组';

-- ============================================
-- 2. links 表（链接）
-- ============================================
DROP TABLE IF EXISTS `links`;
CREATE TABLE `links` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `url` VARCHAR(2048) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `category_id` INT UNSIGNED NOT NULL,
  `icon` TEXT,
  `sort_order` INT NOT NULL DEFAULT 10,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_links_category` (`category_id`, `is_visible`, `sort_order`),
  INDEX `idx_links_visible` (`is_visible`, `sort_order`),
  CONSTRAINT `fk_links_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='链接';

-- ============================================
-- 3. config 表（站点配置）
-- ============================================
DROP TABLE IF EXISTS `config`;
CREATE TABLE `config` (
  `key` VARCHAR(50) PRIMARY KEY,
  `value` TEXT,
  `description` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='站点配置';

-- ============================================
-- 4. apply 表（收录申请）
-- ============================================
DROP TABLE IF EXISTS `apply`;
CREATE TABLE `apply` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `url` VARCHAR(2048) NOT NULL,
  `category_id` INT UNSIGNED NOT NULL,
  `icon` TEXT,
  `description` VARCHAR(255) DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_apply_status` (`status`, `created_at`),
  CONSTRAINT `fk_apply_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收录申请';

-- ============================================
-- 5. search_engines 表（搜索引擎）
-- ============================================
DROP TABLE IF EXISTS `search_engines`;
CREATE TABLE `search_engines` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL,
  `url_template` VARCHAR(2048) NOT NULL,
  `icon` TEXT,
  `sort_order` INT NOT NULL DEFAULT 10,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  INDEX `idx_se_active` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='搜索引擎';

-- ============================================
-- 6. click_stats 表（点击统计）
-- ============================================
DROP TABLE IF EXISTS `click_stats`;
CREATE TABLE `click_stats` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `link_id` INT UNSIGNED NOT NULL,
  `clicked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_agent` VARCHAR(500) DEFAULT NULL,
  INDEX `idx_click_link` (`link_id`, `clicked_at`),
  INDEX `idx_click_time` (`clicked_at`),
  CONSTRAINT `fk_click_link` FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='点击统计';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- 种子数据
-- ============================================

-- 分组
INSERT INTO `categories` (`id`, `name`, `sort_order`) VALUES
  (1, '常用导航', 10),
  (2, '设计视觉', 20),
  (3, '社交存储', 30),
  (4, '工具', 40),
  (5, '开发', 50),
  (6, '游戏娱乐', 60);

-- 链接（常用导航）
INSERT INTO `links` (`title`, `url`, `category_id`, `icon`, `sort_order`) VALUES
  ('百度', 'https://www.baidu.com/', 1, 'https://www.baidu.com/favicon.ico', 10),
  ('腾讯视频', 'https://v.qq.com/', 1, 'https://v.qq.com/favicon.ico', 20),
  ('哔哩哔哩', 'https://www.bilibili.com/', 1, 'https://www.bilibili.com/favicon.ico', 30),
  ('微博', 'https://www.weibo.com/', 1, 'https://www.weibo.com/favicon.ico', 40),
  ('QQ邮箱', 'https://mail.qq.com/', 1, 'https://mail.qq.com/favicon.ico', 50),
  ('百度贴吧', 'https://tieba.baidu.com/', 1, 'https://tieba.baidu.com/favicon.ico', 60),
  ('CCTV直播', 'https://tv.cctv.com/live/index.shtml', 1, 'https://tv.cctv.com/favicon.ico', 70),
  ('抖音网页版', 'https://www.douyin.com/', 1, 'https://www.douyin.com/favicon.ico', 80),
  ('酷狗音乐', 'https://www.kugou.com/', 1, 'https://www.kugou.com/favicon.ico', 90),
  ('虎牙直播', 'https://www.huya.com/', 1, 'https://www.huya.com/favicon.ico', 100);

-- 链接（设计视觉）
INSERT INTO `links` (`title`, `url`, `category_id`, `icon`, `sort_order`) VALUES
  ('Office模板', 'https://www.officeplus.cn/', 2, 'https://www.officeplus.cn/favicon.ico', 10),
  ('搞定设计', 'https://www.gaoding.com/', 2, 'https://www.gaoding.com/favicon.ico', 20),
  ('千库网', 'https://588ku.com/', 2, 'https://588ku.com/favicon.ico', 30),
  ('图怪兽', 'https://818ps.com/', 2, 'https://818ps.com/favicon.ico', 40),
  ('站酷', 'https://www.zcool.com.cn/', 2, 'https://www.zcool.com.cn/favicon.ico', 50),
  ('阿里图标', 'https://www.iconfont.cn/', 2, 'https://www.iconfont.cn/favicon.ico', 60),
  ('IconFinder', 'https://www.iconfinder.com/', 2, 'https://www.iconfinder.com/favicon.ico', 70),
  ('优设教程', 'https://uiiiuiii.com/', 2, 'https://uiiiuiii.com/favicon.ico', 80);

-- 链接（社交存储）
INSERT INTO `links` (`title`, `url`, `category_id`, `icon`, `sort_order`) VALUES
  ('知乎', 'https://www.zhihu.com/explore', 3, 'https://www.zhihu.com/favicon.ico', 10),
  ('豆瓣', 'https://www.douban.com/', 3, 'https://www.douban.com/favicon.ico', 20),
  ('简书', 'https://www.jianshu.com/', 3, 'https://www.jianshu.com/favicon.ico', 30),
  ('阿里云盘', 'https://www.aliyundrive.com/', 3, 'https://www.aliyundrive.com/favicon.ico', 40),
  ('百度网盘', 'https://pan.baidu.com/', 3, 'https://pan.baidu.com/favicon.ico', 50),
  ('蓝奏云', 'https://www.lanzou.com/', 3, 'https://www.lanzou.com/favicon.ico', 60),
  ('迅雷云盘', 'https://pan.xunlei.com/', 3, 'https://pan.xunlei.com/favicon.ico', 70),
  ('OneDrive', 'https://onedrive.live.com/', 3, 'https://onedrive.live.com/favicon.ico', 80),
  ('Gmail', 'https://mail.google.com/', 3, 'https://mail.google.com/favicon.ico', 90),
  ('网易邮箱', 'https://mail.163.com/', 3, 'https://mail.163.com/favicon.ico', 100);

-- 链接（工具）
INSERT INTO `links` (`title`, `url`, `category_id`, `icon`, `sort_order`) VALUES
  ('在线工具', 'https://tool.lu/', 4, 'https://tool.lu/favicon.ico', 10),
  ('IP查询', 'https://ip.cn/', 4, 'https://ip.cn/favicon.ico', 20),
  ('文档在线转换', 'https://xpdf.net/', 4, 'https://xpdf.net/favicon.ico', 30),
  ('谷歌翻译', 'https://translate.google.cn/?hl=zh-CN', 4, 'https://translate.google.cn/favicon.ico', 40),
  ('有道翻译', 'https://fanyi.youdao.com/', 4, 'https://fanyi.youdao.com/favicon.ico', 50),
  ('HTML在线运行', 'https://c.runoob.com/front-end/61/', 4, 'https://c.runoob.com/favicon.ico', 60),
  ('在线PS', 'https://www.photopea.com/', 4, 'https://www.photopea.com/favicon.ico', 70),
  ('站长工具', 'http://tool.chinaz.com/', 4, 'https://tool.chinaz.com/favicon.ico', 80);

-- 链接（开发）
INSERT INTO `links` (`title`, `url`, `category_id`, `icon`, `sort_order`) VALUES
  ('GitHub', 'https://github.com/', 5, 'https://github.com/favicon.ico', 10),
  ('码云Gitee', 'https://gitee.com/', 5, 'https://gitee.com/favicon.ico', 20),
  ('W3school', 'http://www.w3school.com.cn/', 5, 'https://www.w3school.com.cn/favicon.ico', 30),
  ('CSDN', 'https://www.csdn.net/', 5, 'https://www.csdn.net/favicon.ico', 40),
  ('CdnJs', 'https://cdnjs.com/', 5, 'https://cdnjs.com/favicon.ico', 50),
  ('Font Awesome', 'https://fontawesome.com/', 5, 'https://fontawesome.com/favicon.ico', 60),
  ('MSDN我告诉你', 'https://msdn.itellyou.cn/', 5, 'https://msdn.itellyou.cn/favicon.ico', 70),
  ('腾讯云', 'https://cloud.tencent.com/', 5, 'https://cloud.tencent.com/favicon.ico', 80),
  ('阿里云', 'https://www.aliyun.com/', 5, 'https://www.aliyun.com/favicon.ico', 90);

-- 链接（游戏娱乐）
INSERT INTO `links` (`title`, `url`, `category_id`, `icon`, `sort_order`) VALUES
  ('4399小游戏', 'http://www.4399.com/', 6, 'https://www.4399.com/favicon.ico', 10),
  ('7k7k小游戏', 'http://www.7k7k.com/', 6, 'https://www.7k7k.com/favicon.ico', 20),
  ('英雄联盟', 'https://lol.qq.com/', 6, 'https://lol.qq.com/favicon.ico', 30),
  ('永劫无间', 'https://www.yjwujian.cn/', 6, 'https://www.yjwujian.cn/favicon.ico', 40),
  ('STEAM', 'https://store.steampowered.com/', 6, 'https://store.steampowered.com/favicon.ico', 50),
  ('王者荣耀', 'https://pvp.qq.com/', 6, 'https://pvp.qq.com/favicon.ico', 60),
  ('3DM GAME', 'https://www.3dmgame.com/', 6, 'https://www.3dmgame.com/favicon.ico', 70);

-- 搜索引擎
INSERT INTO `search_engines` (`name`, `url_template`, `sort_order`) VALUES
  ('百度', 'https://www.baidu.com/s?wd={keyword}', 10),
  ('必应', 'https://www.bing.com/search?q={keyword}', 20),
  ('谷歌', 'https://www.google.com/search?q={keyword}', 30),
  ('知乎', 'https://www.zhihu.com/search?type=content&q={keyword}', 40),
  ('哔哩哔哩', 'https://search.bilibili.com/all?keyword={keyword}', 50);

-- 站点配置
INSERT INTO `config` (`key`, `value`, `description`) VALUES
  ('title', '上网导航', '网站标题'),
  ('home-title', '<h2 class="title">上网，从这里开始！</h2>', '首页标题'),
  ('description', '简洁高效无广告的上网导航和搜索入口', '网站描述'),
  ('keywords', '网址导航,上网导航,网站导航', '关键字'),
  ('logo', '', '网站LOGO'),
  ('background', '', '背景图片'),
  ('copyright', 'Copyright © 2026 All Rights Reserved.', '版权信息'),
  ('icp', '', 'ICP备案号'),
  ('apply', '1', '收录申请开关(0=关闭,1=审核,2=关闭)'),
  ('apply_gg', '<b>收录说明：</b><br>1. 禁止提交违规违法站点<br>2. 页面整洁，无恶意跳转<br>3. 非盈利性网站优先收录', '收录公告'),
  ('about_content', '<h3>关于本站</h3><p>感谢来访，本站致力于简洁高效的上网导航和搜索入口。</p>', '关于页面内容'),
  ('template', 'default', '当前模板'),
  ('admin_user', 'admin', '管理员账号'),
  ('admin_pwd', '', '管理员密码 bcrypt 哈希（服务端写入时自动加密）'),
  ('fetch_title_api', 'https://lianjie.hjke.cn/api/title?url={url}', '自动获取网站名称 API（{url}=URL编码占位，留空用默认）'),
  ('fetch_icon_api', 'https://a.favicon.im/{hostname}', '自动获取网站图标 API（{hostname}/{url} 占位，留空用默认）');