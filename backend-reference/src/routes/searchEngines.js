const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/search-engines — 获取搜索引擎列表（公开）
router.get('/', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const [rows] = await pool.query(
      'SELECT * FROM `search_engines` WHERE `is_active` = 1 ORDER BY `sort_order` ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取搜索引擎失败' });
  }
});

// POST /api/search-engines — 创建搜索引擎（需认证）
router.post('/', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { name, url_template, icon, sort_order } = req.body;

    const [result] = await pool.query(
      'INSERT INTO `search_engines` (`name`, `url_template`, `icon`, `sort_order`, `is_active`) VALUES (?, ?, ?, ?, 1)',
      [name, url_template, icon || null, sort_order || 10]
    );

    const [created] = await pool.query('SELECT * FROM `search_engines` WHERE `id` = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '创建搜索引擎失败' });
  }
});

// PUT /api/search-engines/:id — 更新搜索引擎（需认证）
router.put('/:id', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { id } = req.params;
    const { name, url_template, icon, sort_order, is_active } = req.body;

    await pool.query(
      'UPDATE `search_engines` SET `name` = ?, `url_template` = ?, `icon` = ?, `sort_order` = ?, `is_active` = ? WHERE `id` = ?',
      [name, url_template, icon || null, sort_order, is_active !== undefined ? is_active : 1, id]
    );

    const [updated] = await pool.query('SELECT * FROM `search_engines` WHERE `id` = ?', [id]);
    if (updated.length === 0) {
      return res.status(404).json({ message: '搜索引擎不存在' });
    }
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '更新搜索引擎失败' });
  }
});

// DELETE /api/search-engines/:id — 删除搜索引擎（需认证，软删除）
router.delete('/:id', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { id } = req.params;

    await pool.query('UPDATE `search_engines` SET `is_active` = 0 WHERE `id` = ?', [id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '删除搜索引擎失败' });
  }
});

module.exports = router;