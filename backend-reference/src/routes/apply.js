const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/apply — 获取申请列表（需认证）
router.get('/', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { status } = req.query;

    let sql = 'SELECT * FROM `apply`';
    const params = [];

    if (status) {
      sql += ' WHERE `status` = ?';
      params.push(status);
    }

    sql += ' ORDER BY `created_at` DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取申请列表失败' });
  }
});

// POST /api/apply — 提交申请（公开）
router.post('/', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { name, url, category_id, icon, description } = req.body;

    const [result] = await pool.query(
      'INSERT INTO `apply` (`name`, `url`, `category_id`, `icon`, `description`, `status`) VALUES (?, ?, ?, ?, ?, ?)',
      [name, url, category_id, icon || null, description || null, 'pending']
    );

    const [created] = await pool.query('SELECT * FROM `apply` WHERE `id` = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '提交申请失败' });
  }
});

// POST /api/apply/:id/approve — 通过申请（需认证）
router.post('/:id/approve', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { id } = req.params;

    // 获取申请信息
    const [applyRows] = await pool.query('SELECT * FROM `apply` WHERE `id` = ?', [id]);
    if (applyRows.length === 0) {
      return res.status(404).json({ message: '申请不存在' });
    }

    const apply = applyRows[0];

    // 自动创建链接
    const [orderRows] = await pool.query(
      'SELECT MAX(`sort_order`) as max_order FROM `links` WHERE `category_id` = ?',
      [apply.category_id]
    );
    const maxOrder = orderRows[0]?.max_order || 0;

    await pool.query(
      'INSERT INTO `links` (`title`, `url`, `category_id`, `icon`, `description`, `sort_order`, `is_visible`) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [apply.name, apply.url, apply.category_id, apply.icon, apply.description, maxOrder + 10]
    );

    // 更新申请状态
    await pool.query("UPDATE `apply` SET `status` = 'approved' WHERE `id` = ?", [id]);

    res.json({ message: '已通过并创建链接' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '审核失败' });
  }
});

// POST /api/apply/:id/reject — 拒绝申请（需认证）
router.post('/:id/reject', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { id } = req.params;

    await pool.query("UPDATE `apply` SET `status` = 'rejected' WHERE `id` = ?", [id]);

    res.json({ message: '已拒绝' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '操作失败' });
  }
});

module.exports = router;