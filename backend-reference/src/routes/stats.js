const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/stats/overview — 统计概览（需认证）
router.get('/overview', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');

    const [[{ total_links }]] = await pool.query(
      "SELECT COUNT(*) as total_links FROM `links` WHERE `is_visible` = 1"
    );
    const [[{ total_clicks }]] = await pool.query(
      "SELECT COUNT(*) as total_clicks FROM `click_stats`"
    );
    const [[{ today_clicks }]] = await pool.query(
      "SELECT COUNT(*) as today_clicks FROM `click_stats` WHERE DATE(`clicked_at`) = CURDATE()"
    );
    const [[{ week_clicks }]] = await pool.query(
      "SELECT COUNT(*) as week_clicks FROM `click_stats` WHERE `clicked_at` >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );

    res.json({
      total_links: Number(total_links),
      total_clicks: Number(total_clicks),
      today_clicks: Number(today_clicks),
      week_clicks: Number(week_clicks),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取统计失败' });
  }
});

// GET /api/stats/top-links — 热门链接（需认证）
router.get('/top-links', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const limit = parseInt(req.query.limit) || 20;

    const [rows] = await pool.query(
      `SELECT cs.link_id, l.title, COUNT(*) as count
       FROM click_stats cs
       JOIN links l ON cs.link_id = l.id
       GROUP BY cs.link_id, l.title
       ORDER BY count DESC
       LIMIT ?`,
      [limit]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取热门链接失败' });
  }
});

// GET /api/stats/trend — 点击趋势（需认证）
router.get('/trend', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const days = parseInt(req.query.days) || 7;

    const [rows] = await pool.query(
      `SELECT DATE(clicked_at) as date, COUNT(*) as count
       FROM click_stats
       WHERE clicked_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(clicked_at)
       ORDER BY date ASC`,
      [days]
    );

    // 填充没有数据的日期
    const result = [];
    const dateMap = {};
    rows.forEach(row => { dateMap[row.date] = row.count; });

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      result.push({ date: dateStr, count: dateMap[dateStr] || 0 });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取趋势失败' });
  }
});

// POST /api/stats/click — 记录点击（公开）
router.post('/click', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { link_id } = req.body;
    const userAgent = (req.headers['user-agent'] || '').substring(0, 500);

    await pool.query(
      'INSERT INTO `click_stats` (`link_id`, `user_agent`) VALUES (?, ?)',
      [link_id, userAgent]
    );

    res.json({ message: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '记录失败' });
  }
});

module.exports = router;