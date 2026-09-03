const express = require('express');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');

const router = express.Router();

// bcrypt 哈希识别：$2a/$2b/$2y + 成本 + 53 位盐密文（共 60 字符），避免对已哈希值二次哈希
const isBcryptHash = (v) => typeof v === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(v);
const BCRYPT_COST = 10; // 与 neon_schema.sql / README 约定一致（成本因子固定 10）

// GET /api/config — 获取所有配置（公开；admin_pwd 屏蔽不回显）
router.get('/', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const [rows] = await pool.query('SELECT `key`, `value` FROM `config`');
    const result = {};
    rows.forEach(row => {
      if (row.key === 'admin_pwd') return; // 密码哈希永不通过读接口返回
      result[row.key] = row.value || '';
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取配置失败' });
  }
});

// GET /api/config/:key — 获取单个配置（admin_pwd 不回显）
router.get('/:key', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    if (req.params.key === 'admin_pwd') {
      return res.json({ value: null });
    }
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

// PUT /api/config/:key — 更新配置（需认证；admin_pwd 安全特判：留空不修改、明文 bcrypt 哈希后存储）
router.put('/:key', auth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { key } = req.params;
    const { value } = req.body;

    // admin_pwd：留空不修改；已是 bcrypt 哈希则原样保存；否则哈希后存储
    if (key === 'admin_pwd') {
      const trimmed = typeof value === 'string' ? value.trim() : '';
      if (!trimmed) {
        return res.json({ message: '密码未修改' });
      }
      if (!isBcryptHash(trimmed)) {
        const hash = await bcrypt.hash(trimmed, BCRYPT_COST);
        const [existing] = await pool.query('SELECT `key` FROM `config` WHERE `key` = ?', [key]);
        if (existing.length > 0) {
          await pool.query('UPDATE `config` SET `value` = ? WHERE `key` = ?', [hash, key]);
        } else {
          await pool.query('INSERT INTO `config` (`key`, `value`) VALUES (?, ?)', [key, hash]);
        }
        return res.json({ message: '密码已更新' });
      }
    }

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