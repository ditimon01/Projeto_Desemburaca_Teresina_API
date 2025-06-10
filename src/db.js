const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'db.hvezapxfmgzmhppqllmi.supabase.co',
    database: 'postgres',
    password: '10126824!euamopostgis',
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    }
})

module.exports = pool;