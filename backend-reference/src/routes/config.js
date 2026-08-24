const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/config — 获取所有配置（公开）
router.get('/', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const [rows] = await pool.query('SELECT `key`, `value` FROM `config`');
    const result = {};
    rows.forEach(row => { result[row.key] = row.value || ''; });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取配置失败' });
  }
});

// GET /api/config/:key — 获取单个配置
router.get('/:key', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const [rows] = await pool.query('SELECT `value` FROM `config` WHERE `key` = ?', [req.params.key]);
    if (rows.length === 0) {
      return res.json({ value: null });
    }
    res.json({ value: rows[0].value || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取配置失败' });
  }
});

// PUT /api/config/:key — 更新配置（需认证）
router.put('/:key', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { key } = req.params;
    const { value } = req.body;

    const [existing] = await pool.query('SELECT `key` FROM `config` WHERE `key` = ?', [key]);

    if (existing.length > 0) {
      await pool.query('UPDATE `config` SET `value` = ? WHERE `key` = ?', [value, key]);
    } else {
      await pool.query('INSERT INTO `config` (`key`, `value`) VALUES (?, ?)', [key, value]);
    }

    res.json({ message: '保存成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '保存配置失败' });
  }
});

module.exports = router;