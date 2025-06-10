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
  const {
    fid,
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
      fid, data, categoria, status, observacao, imagem, geom, rua, bairro
  ) VALUES (
      $1, $2, $3, $4, $5, $6,
      ST_SetSRID(ST_MakePoint($7, $8), 4326),
      $9, $10
  )`;

  try {
    await pool.query(query, [
      fid,
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
  } catch (err){
    console.error(err);
    reply.code(500).send({ error: err.message, detalhe: err.stack });
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
