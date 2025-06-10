const { Pool } = require('pg');

const pool = new Pool(process.env.DB_POOL)

module.exports = pool;