const path = require('path');
const Fastify = require('fastify');
const fastifyMultipart = require('@fastify/multipart');
const cors = require('@fastify/cors');
const { uploadToDrive } = require('./drive');
const fs = require('fs');
const { finished } = require('stream/promises');
const pool = require('./db');

const fastify = Fastify({ logger: true });

// Habilita CORS
fastify.register(cors, {
  origin: '*',
});

// Habilita multipart/form-data
fastify.register(fastifyMultipart);


// Rota de upload no drive
fastify.post('/upload', async function (req, reply) {
  const parts = req.parts();
  let fileId = null;

  for await (const part of parts) {
    if (part.file) {
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

      const tempPath = path.join(tempDir, part.filename);
      const ws = fs.createWriteStream(tempPath);

      part.file.pipe(ws);
      await finished(ws);

      try {
        const uploaded = await uploadToDrive(tempPath, part.filename, part.mimetype);
        fileId = uploaded.id;
      } catch (err) {
        reply.code(500).send({ error: 'Erro ao enviar arquivo para o Drive' });
        return;
      }
    }
  }

  reply.send({ success: true, fileId });
});

// Rota de registro no banco de dados
fastify.post('/registro', async function (req, reply) {
  fastify.log.info('Requisição recebida em /registro');
  const {
    data,
    categoria,
    status,
    observacao,
    imagem,
    longitude,
    latitude,
    rua,
    bairro
  } = req.body;

  const query = `
  INSERT INTO registro_popular (
    data, categoria, status, observacao, imagem, geom, rua, bairro
  ) VALUES (
      $1, $2, $3, $4, $5,
      ST_SetSRID(ST_MakePoint($6, $7), 4326),
      $8, $9
  )`;

  try {
    await pool.query(query, [
      data,
      categoria,
      status,
      observacao,
      imagem,
      longitude,
      latitude,
      rua,
      bairro
    ]);

    reply.send({ success: true });

  } catch (err){
    console.error(err);
    reply.code(500).send({ error: err.message, detalhe: err.stack });
  }
})


fastify.get('/registro', async function(req, reply) {
  const query = `
    SELECT
      id,
      data,
      categoria,
      status,
      observacao,
      imagem,
      rua,
      bairro,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude
    FROM registro_popular
    ORDER BY data DESC
  `;

  try {
    const result = await pool.query(query);
    reply.send(result.rows);
  } catch (err) {
    console.error(err);
    reply.code(500).send({error: err.message, detalhe: err.stack});
  }
})


// Inicia o servidor
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
    console.log('Servidor rodando');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
