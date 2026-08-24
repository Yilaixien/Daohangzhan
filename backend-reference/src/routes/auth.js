const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const pool = req.app.get('pool');
    const secret = req.app.get('jwtSecret');

    // 从 config 表读取管理员账号
    const [rows] = await pool.query(
      "SELECT `value` FROM `config` WHERE `key` IN ('admin_user', 'admin_pwd')"
    );

    const config = {};
    rows.forEach(row => { config[row.key] = row.value; });

    const adminUser = config.admin_user || process.env.ADMIN_USER || 'admin';
    const adminPwd = config.admin_pwd || process.env.ADMIN_PASSWORD || '';

    if (username !== adminUser) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    // 如果 config 中有密码，使用 bcrypt 比较；否则使用环境变量
    let passwordValid = false;
    if (adminPwd) {
      passwordValid = await bcrypt.compare(password, adminPwd);
    } else {
      const envPwd = process.env.ADMIN_PASSWORD || 'admin123';
      passwordValid = password === envPwd;
    }

    if (!passwordValid) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { username: adminUser, role: 'admin' },
      secret,
      { expiresIn: '7d' }
    );

    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: '登录失败' });
  }
});

module.exports = router;