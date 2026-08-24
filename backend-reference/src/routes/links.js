const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// 死链检测参数
const DEAD_URL_TIMEOUT = 5000; // 单链接超时（毫秒）
const DETECT_CONCURRENCY = 5;  // 同时检测的链接数

// 单链接检测：优先 HEAD，被拒/异常时回退 GET（Request Range 只取少量数据），返回 HTTP 状态码，不可达返回 0
async function detectUrl(url, timeoutMs) {
  let controller = new AbortController();
  const withTimeout = (ms) => {
    controller.abort();
    controller = new AbortController();
    return setTimeout(() => controller.abort(), ms);
  };

  // 1) HEAD
  let timer = withTimeout(timeoutMs);
  try {
    const resp = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (resp.status >= 400 || resp.status === 405 || resp.status === 403) {
      // 视为该方式被拒，回退 GET
    } else {
      return resp.status;
    }
  } catch {
    // 超时或网络异常，回退 GET
  } finally {
    clearTimeout(timer);
  }

  // 2) 回退 GET
  timer = withTimeout(timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    return resp.status;
  } catch {
    return 0; // 不可达，判为死链
  } finally {
    clearTimeout(timer);
  }
}

// 并发执行器：按 limit 分片，控制同时在途的 worker 数量
async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let index = 0;
  async function runner() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  }
  const runners = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    runners.push(runner());
  }
  await Promise.all(runners);
  return results;
}

// GET /api/links — 获取链接列表（公开）
router.get('/', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { category_id, id } = req.query;

    let sql = 'SELECT * FROM `links` WHERE `is_visible` = 1';
    const params = [];

    if (id) {
      sql = 'SELECT * FROM `links` WHERE `id` = ?';
      params.push(id);
    } else if (category_id) {
      sql += ' AND `category_id` = ? ORDER BY `sort_order` ASC';
      params.push(category_id);
    } else {
      sql += ' ORDER BY `sort_order` ASC';
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取链接失败' });
  }
});

// POST /api/links — 创建链接（需认证）
router.post('/', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { title, url, description, category_id, icon, sort_order } = req.body;

    // 自动计算 sort_order
    let finalSortOrder = sort_order;
    if (!finalSortOrder && category_id) {
      const [rows] = await pool.query(
        'SELECT MAX(`sort_order`) as max_order FROM `links` WHERE `category_id` = ?',
        [category_id]
      );
      finalSortOrder = (rows[0]?.max_order || 0) + 10;
    }

    const [result] = await pool.query(
      'INSERT INTO `links` (`title`, `url`, `description`, `category_id`, `icon`, `sort_order`, `is_visible`) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [title, url, description || null, category_id, icon || null, finalSortOrder || 10]
    );

    const [created] = await pool.query('SELECT * FROM `links` WHERE `id` = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '创建链接失败' });
  }
});

// PUT /api/links/:id — 更新链接（需认证）
router.put('/:id', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { id } = req.params;
    const { title, url, description, category_id, icon, sort_order } = req.body;

    await pool.query(
      'UPDATE `links` SET `title` = ?, `url` = ?, `description` = ?, `category_id` = ?, `icon` = ?, `sort_order` = ? WHERE `id` = ?',
      [title, url, description || null, category_id, icon || null, sort_order, id]
    );

    const [updated] = await pool.query('SELECT * FROM `links` WHERE `id` = ?', [id]);
    if (updated.length === 0) {
      return res.status(404).json({ message: '链接不存在' });
    }
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '更新链接失败' });
  }
});

// DELETE /api/links/:id — 删除链接（需认证，软删除）
router.delete('/:id', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { id } = req.params;

    await pool.query('UPDATE `links` SET `is_visible` = 0 WHERE `id` = ?', [id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '删除链接失败' });
  }
});

// POST /api/links/reorder — 重新排序（需认证）
router.post('/reorder', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { items } = req.body;

    for (const item of items) {
      await pool.query('UPDATE `links` SET `sort_order` = ? WHERE `id` = ?', [item.sort_order, item.id]);
    }

    res.json({ message: '排序成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '排序失败' });
  }
});

// GET /api/links/check-dead — 死链检测（需认证）
router.get('/check-dead', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const [links] = await pool.query("SELECT `id`, `url` FROM `links` WHERE `is_visible` = 1");

    const results = await runWithConcurrency(links, DETECT_CONCURRENCY, async (link) => ({
      id: link.id,
      status: await detectUrl(link.url, DEAD_URL_TIMEOUT),
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '死链检测失败' });
  }
});

module.exports = router;