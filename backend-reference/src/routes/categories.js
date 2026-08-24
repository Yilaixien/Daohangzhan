const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/categories — 获取分组列表（公开）
router.get('/', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const [rows] = await pool.query(
      'SELECT * FROM `categories` WHERE `is_visible` = 1 ORDER BY `sort_order` ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取分组失败' });
  }
});

// GET /api/categories/:id
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const [rows] = await pool.query('SELECT * FROM `categories` WHERE `id` = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: '分组不存在' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取分组失败' });
  }
});

// POST /api/categories — 创建分组（需认证）
router.post('/', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { name, sort_order } = req.body;

    let finalSortOrder = sort_order;
    if (!finalSortOrder) {
      const [rows] = await pool.query('SELECT MAX(`sort_order`) as max_order FROM `categories`');
      finalSortOrder = (rows[0]?.max_order || 0) + 10;
    }

    const [result] = await pool.query(
      'INSERT INTO `categories` (`name`, `sort_order`, `is_visible`) VALUES (?, ?, 1)',
      [name, finalSortOrder || 10]
    );

    const [created] = await pool.query('SELECT * FROM `categories` WHERE `id` = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '创建分组失败' });
  }
});

// PUT /api/categories/:id — 更新分组（需认证）
router.put('/:id', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { id } = req.params;
    const { name, sort_order } = req.body;

    await pool.query(
      'UPDATE `categories` SET `name` = ?, `sort_order` = ? WHERE `id` = ?',
      [name, sort_order, id]
    );

    const [updated] = await pool.query('SELECT * FROM `categories` WHERE `id` = ?', [id]);
    if (updated.length === 0) {
      return res.status(404).json({ message: '分组不存在' });
    }
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '更新分组失败' });
  }
});

// DELETE /api/categories/:id — 删除分组（需认证，软删除）
router.delete('/:id', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { id } = req.params;

    await pool.query('UPDATE `categories` SET `is_visible` = 0 WHERE `id` = ?', [id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '删除分组失败' });
  }
});

// POST /api/categories/reorder — 重新排序（需认证）
router.post('/reorder', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { items } = req.body;

    for (const item of items) {
      await pool.query('UPDATE `categories` SET `sort_order` = ? WHERE `id` = ?', [item.sort_order, item.id]);
    }

    res.json({ message: '排序成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '排序失败' });
  }
});

module.exports = router;