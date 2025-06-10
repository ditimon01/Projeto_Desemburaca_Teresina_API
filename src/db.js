const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:' + process.env.DB_PASSWORD + '@db.hvezapxfmgzmhppqllmi.supabase.co:5432/postgres?sslmode=require',
    ssl: {
        rejectUnauthorized: false
    }
})

module.exports = pool;