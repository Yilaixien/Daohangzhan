require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// 路由
const authRoutes = require('./routes/auth');
const linksRoutes = require('./routes/links');
const categoriesRoutes = require('./routes/categories');
const configRoutes = require('./routes/config');
const applyRoutes = require('./routes/apply');
const searchEnginesRoutes = require('./routes/searchEngines');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

// 数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'nav_site',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

// 将 pool 挂载到 app 上，供路由使用
app.set('pool', pool);
app.set('jwtSecret', process.env.JWT_SECRET || 'default-secret');

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/config', configRoutes);
app.use('/api/apply', applyRoutes);
app.use('/api/search-engines', searchEnginesRoutes);
app.use('/api/stats', statsRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});