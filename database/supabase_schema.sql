-- ============================================
-- 网址导航站 - Supabase (PostgreSQL) Schema
-- ============================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. categories 表（分组）
-- ============================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 10,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_categories_sort ON categories(sort_order, is_visible);

-- ============================================
-- 2. links 表（链接）
-- ============================================
CREATE TABLE links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  description VARCHAR(255),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 10,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_links_category ON links(category_id, is_visible, sort_order);
CREATE INDEX idx_links_visible ON links(is_visible, sort_order);
CREATE INDEX idx_links_updated ON links(updated_at);

-- ============================================
-- 3. config 表（站点配置）
-- ============================================
CREATE TABLE config (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  description VARCHAR(255)
);

-- ============================================
-- 4. apply 表（收录申请）
-- ============================================
CREATE TABLE apply (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  icon TEXT,
  description VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_apply_status ON apply(status, created_at);
CREATE INDEX idx_apply_category ON apply(category_id);

-- ============================================
-- 5. search_engines 表（搜索引擎）
-- ============================================
CREATE TABLE search_engines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  url_template VARCHAR(2048) NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 索引
CREATE INDEX idx_se_active ON search_engines(is_active, sort_order);

-- ============================================
-- 6. click_stats 表（点击统计）
-- ============================================
CREATE TABLE click_stats (
  id BIGSERIAL PRIMARY KEY,
  link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent VARCHAR(500)
);

-- 索引
CREATE INDEX idx_click_link ON click_stats(link_id, clicked_at);
CREATE INDEX idx_click_time ON click_stats(clicked_at);

-- ============================================
-- RLS 策略（Row Level Security）
-- ============================================

-- 启用 RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE apply ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_engines ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_stats ENABLE ROW LEVEL SECURITY;

-- 匿名用户：只读可见数据
CREATE POLICY "anon_select_categories" ON categories FOR SELECT USING (is_visible = true);
CREATE POLICY "anon_select_links" ON links FOR SELECT USING (is_visible = true);
CREATE POLICY "anon_select_config" ON config FOR SELECT USING (true);
CREATE POLICY "anon_select_search_engines" ON search_engines FOR SELECT USING (is_active = true);
CREATE POLICY "anon_insert_click_stats" ON click_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_select_apply" ON apply FOR SELECT USING (true);

-- 认证用户：全部权限
CREATE POLICY "auth_all_categories" ON categories FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_links" ON links FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_config" ON config FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_apply" ON apply FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_search_engines" ON search_engines FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_click_stats" ON click_stats FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 种子数据
-- ============================================

-- 分组
INSERT INTO categories (id, name, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', '常用导航', 10),
  ('a0000000-0000-0000-0000-000000000002', '设计视觉', 20),
  ('a0000000-0000-0000-0000-000000000003', '社交存储', 30),
  ('a0000000-0000-0000-0000-000000000004', '工具', 40),
  ('a0000000-0000-0000-0000-000000000005', '开发', 50),
  ('a0000000-0000-0000-0000-000000000006', '游戏娱乐', 60);

-- 链接（常用导航）
INSERT INTO links (title, url, category_id, icon, sort_order) VALUES
  ('百度', 'https://www.baidu.com/', 'a0000000-0000-0000-0000-000000000001', 'https://www.baidu.com/favicon.ico', 10),
  ('腾讯视频', 'https://v.qq.com/', 'a0000000-0000-0000-0000-000000000001', 'https://v.qq.com/favicon.ico', 20),
  ('哔哩哔哩', 'https://www.bilibili.com/', 'a0000000-0000-0000-0000-000000000001', 'https://www.bilibili.com/favicon.ico', 30),
  ('微博', 'https://www.weibo.com/', 'a0000000-0000-0000-0000-000000000001', 'https://www.weibo.com/favicon.ico', 40),
  ('QQ邮箱', 'https://mail.qq.com/', 'a0000000-0000-0000-0000-000000000001', 'https://mail.qq.com/favicon.ico', 50),
  ('百度贴吧', 'https://tieba.baidu.com/', 'a0000000-0000-0000-0000-000000000001', 'https://tieba.baidu.com/favicon.ico', 60),
  ('CCTV直播', 'https://tv.cctv.com/live/index.shtml', 'a0000000-0000-0000-0000-000000000001', 'https://tv.cctv.com/favicon.ico', 70),
  ('抖音网页版', 'https://www.douyin.com/', 'a0000000-0000-0000-0000-000000000001', 'https://www.douyin.com/favicon.ico', 80),
  ('酷狗音乐', 'https://www.kugou.com/', 'a0000000-0000-0000-0000-000000000001', 'https://www.kugou.com/favicon.ico', 90),
  ('虎牙直播', 'https://www.huya.com/', 'a0000000-0000-0000-0000-000000000001', 'https://www.huya.com/favicon.ico', 100);

-- 链接（设计视觉）
INSERT INTO links (title, url, category_id, icon, sort_order) VALUES
  ('Office模板', 'https://www.officeplus.cn/', 'a0000000-0000-0000-0000-000000000002', 'https://www.officeplus.cn/favicon.ico', 10),
  ('搞定设计', 'https://www.gaoding.com/', 'a0000000-0000-0000-0000-000000000002', 'https://www.gaoding.com/favicon.ico', 20),
  ('千库网', 'https://588ku.com/', 'a0000000-0000-0000-0000-000000000002', 'https://588ku.com/favicon.ico', 30),
  ('图怪兽', 'https://818ps.com/', 'a0000000-0000-0000-0000-000000000002', 'https://818ps.com/favicon.ico', 40),
  ('站酷', 'https://www.zcool.com.cn/', 'a0000000-0000-0000-0000-000000000002', 'https://www.zcool.com.cn/favicon.ico', 50),
  ('阿里图标', 'https://www.iconfont.cn/', 'a0000000-0000-0000-0000-000000000002', 'https://www.iconfont.cn/favicon.ico', 60),
  ('IconFinder', 'https://www.iconfinder.com/', 'a0000000-0000-0000-0000-000000000002', 'https://www.iconfinder.com/favicon.ico', 70),
  ('优设教程', 'https://uiiiuiii.com/', 'a0000000-0000-0000-0000-000000000002', 'https://uiiiuiii.com/favicon.ico', 80);

-- 链接（社交存储）
INSERT INTO links (title, url, category_id, icon, sort_order) VALUES
  ('知乎', 'https://www.zhihu.com/explore', 'a0000000-0000-0000-0000-000000000003', 'https://www.zhihu.com/favicon.ico', 10),
  ('豆瓣', 'https://www.douban.com/', 'a0000000-0000-0000-0000-000000000003', 'https://www.douban.com/favicon.ico', 20),
  ('简书', 'https://www.jianshu.com/', 'a0000000-0000-0000-0000-000000000003', 'https://www.jianshu.com/favicon.ico', 30),
  ('阿里云盘', 'https://www.aliyundrive.com/', 'a0000000-0000-0000-0000-000000000003', 'https://www.aliyundrive.com/favicon.ico', 40),
  ('百度网盘', 'https://pan.baidu.com/', 'a0000000-0000-0000-0000-000000000003', 'https://pan.baidu.com/favicon.ico', 50),
  ('蓝奏云', 'https://www.lanzou.com/', 'a0000000-0000-0000-0000-000000000003', 'https://www.lanzou.com/favicon.ico', 60),
  ('迅雷云盘', 'https://pan.xunlei.com/', 'a0000000-0000-0000-0000-000000000003', 'https://pan.xunlei.com/favicon.ico', 70),
  ('OneDrive', 'https://onedrive.live.com/', 'a0000000-0000-0000-0000-000000000003', 'https://onedrive.live.com/favicon.ico', 80),
  ('Gmail', 'https://mail.google.com/', 'a0000000-0000-0000-0000-000000000003', 'https://mail.google.com/favicon.ico', 90),
  ('网易邮箱', 'https://mail.163.com/', 'a0000000-0000-0000-0000-000000000003', 'https://mail.163.com/favicon.ico', 100);

-- 链接（工具）
INSERT INTO links (title, url, category_id, icon, sort_order) VALUES
  ('在线工具', 'https://tool.lu/', 'a0000000-0000-0000-0000-000000000004', 'https://tool.lu/favicon.ico', 10),
  ('IP查询', 'https://ip.cn/', 'a0000000-0000-0000-0000-000000000004', 'https://ip.cn/favicon.ico', 20),
  ('文档在线转换', 'https://xpdf.net/', 'a0000000-0000-0000-0000-000000000004', 'https://xpdf.net/favicon.ico', 30),
  ('谷歌翻译', 'https://translate.google.cn/?hl=zh-CN', 'a0000000-0000-0000-0000-000000000004', 'https://translate.google.cn/favicon.ico', 40),
  ('有道翻译', 'https://fanyi.youdao.com/', 'a0000000-0000-0000-0000-000000000004', 'https://fanyi.youdao.com/favicon.ico', 50),
  ('HTML在线运行', 'https://c.runoob.com/front-end/61/', 'a0000000-0000-0000-0000-000000000004', 'https://c.runoob.com/favicon.ico', 60),
  ('在线PS', 'https://www.photopea.com/', 'a0000000-0000-0000-0000-000000000004', 'https://www.photopea.com/favicon.ico', 70),
  ('站长工具', 'http://tool.chinaz.com/', 'a0000000-0000-0000-0000-000000000004', 'https://tool.chinaz.com/favicon.ico', 80);

-- 链接（开发）
INSERT INTO links (title, url, category_id, icon, sort_order) VALUES
  ('GitHub', 'https://github.com/', 'a0000000-0000-0000-0000-000000000005', 'https://github.com/favicon.ico', 10),
  ('码云Gitee', 'https://gitee.com/', 'a0000000-0000-0000-0000-000000000005', 'https://gitee.com/favicon.ico', 20),
  ('W3school', 'http://www.w3school.com.cn/', 'a0000000-0000-0000-0000-000000000005', 'https://www.w3school.com.cn/favicon.ico', 30),
  ('CSDN', 'https://www.csdn.net/', 'a0000000-0000-0000-0000-000000000005', 'https://www.csdn.net/favicon.ico', 40),
  ('CdnJs', 'https://cdnjs.com/', 'a0000000-0000-0000-0000-000000000005', 'https://cdnjs.com/favicon.ico', 50),
  ('Font Awesome', 'https://fontawesome.com/', 'a0000000-0000-0000-0000-000000000005', 'https://fontawesome.com/favicon.ico', 60),
  ('MSDN我告诉你', 'https://msdn.itellyou.cn/', 'a0000000-0000-0000-0000-000000000005', 'https://msdn.itellyou.cn/favicon.ico', 70),
  ('腾讯云', 'https://cloud.tencent.com/', 'a0000000-0000-0000-0000-000000000005', 'https://cloud.tencent.com/favicon.ico', 80),
  ('阿里云', 'https://www.aliyun.com/', 'a0000000-0000-0000-0000-000000000005', 'https://www.aliyun.com/favicon.ico', 90);

-- 链接（游戏娱乐）
INSERT INTO links (title, url, category_id, icon, sort_order) VALUES
  ('4399小游戏', 'http://www.4399.com/', 'a0000000-0000-0000-0000-000000000006', 'https://www.4399.com/favicon.ico', 10),
  ('7k7k小游戏', 'http://www.7k7k.com/', 'a0000000-0000-0000-0000-000000000006', 'https://www.7k7k.com/favicon.ico', 20),
  ('英雄联盟', 'https://lol.qq.com/', 'a0000000-0000-0000-0000-000000000006', 'https://lol.qq.com/favicon.ico', 30),
  ('永劫无间', 'https://www.yjwujian.cn/', 'a0000000-0000-0000-0000-000000000006', 'https://www.yjwujian.cn/favicon.ico', 40),
  ('STEAM', 'https://store.steampowered.com/', 'a0000000-0000-0000-0000-000000000006', 'https://store.steampowered.com/favicon.ico', 50),
  ('王者荣耀', 'https://pvp.qq.com/', 'a0000000-0000-0000-0000-000000000006', 'https://pvp.qq.com/favicon.ico', 60),
  ('3DM GAME', 'https://www.3dmgame.com/', 'a0000000-0000-0000-0000-000000000006', 'https://www.3dmgame.com/favicon.ico', 70);

-- 搜索引擎
INSERT INTO search_engines (name, url_template, sort_order) VALUES
  ('百度', 'https://www.baidu.com/s?wd={keyword}', 10),
  ('必应', 'https://www.bing.com/search?q={keyword}', 20),
  ('谷歌', 'https://www.google.com/search?q={keyword}', 30),
  ('知乎', 'https://www.zhihu.com/search?type=content&q={keyword}', 40),
  ('哔哩哔哩', 'https://search.bilibili.com/all?keyword={keyword}', 50);

-- 站点配置
INSERT INTO config (key, value, description) VALUES
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
  ('admin_pwd', '', '管理员密码（Supabase Auth 管理，此字段仅作参考）');