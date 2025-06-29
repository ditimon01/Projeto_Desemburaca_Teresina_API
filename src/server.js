const path = require('path');
const Fastify = require('fastify');
const fastifyMultipart = require('@fastify/multipart');
const cors = require('@fastify/cors');
const { uploadToDrive } = require('./drive');
const { reversaoGeografica } = require('./reversao-geografica');
const fs = require('fs');
const { finished } = require('stream/promises');
const pool = require('./db');


const fastify = Fastify({ logger: true });

// Habilita CORS
fastify.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
});

// Habilita multipart/form-data
fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});


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



// Rota do banco de dados
fastify.post('/registro', async function (req, reply) {
  
  const {
    data,
    categoria,
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
      $1, $2, 10, $3, $4,
      ST_SetSRID(ST_MakePoint($5, $6), 4326),
      $7, $8
  )`;

  try {
    await pool.query(query, [
      data,
      categoria,
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

fastify.get('/registro', async function (req, reply) {

  const query = `
    SELECT
      fid,
      TO_CHAR(data, 'DD-MM-YYYY') AS data,
      categoria,
      status,
      observacao,
      imagem,
      rua,
      bairro,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude
    FROM registro_popular 
    ORDER BY fid
  `;

  try {
    const result = await pool.query(query);
    reply.send(result.rows);
  } catch (err) {
    console.error(err);
    reply.code(500).send({error: err.message, detalhe: err.stack});
  }
});

fastify.get('/registro/:id', async function (req, reply) {

  const { id } = req.params;

  query = `
    SELECT 
      fid,
      TO_CHAR(data, 'DD-MM-YYYY') AS data,
      categoria,
      status,
      observacao,
      imagem,
      rua,
      bairro,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude
    FROM registro_popular
    WHERE fid = $1
  `;

  try {
    const result = await pool.query(query, [id]);

    if(result.rows.length === 0) {
      return reply.code(404).send({ error: 'Registro não encontrado'})
    }

    reply.send(result.rows[0]);
    
  } catch (err) {
    console.error(err);
    reply.code(500).send({error: err.message, detalhe: err.stack});
    
  }
  
})

fastify.delete('/registro/:id', async function (req, reply) {
  const { id } = req.params;

  query = `
    DELETE FROM registro_popular 
    WHERE fid = $1
  `;

  try {

    const result = await pool.query(query, [id]);

    if(result.rowCount === 0) {
      return reply.code(404).send({error: 'Registro não encontrado' });
    }

    reply.send({ sucess: true, message: `Registro ${id} deletado com sucesso.`})

    
  } catch (err) {
    console.error(err);
    reply.code(500).send({ error: err.message, detalhe: err.stack});
    
  }

})

fastify.put('/registro/:id', async function (req, reply) {

  const { id } = req.params;
  const newData = req.body;
  
  let queryBody = [];
  let toSendBody = [];

  let cont = 1;
  let updateGeom = false;

  const campos = [
    "data",
    "categoria",
    "observacao",
    "imagem",
    "longitude",
    "latitude",
    "rua",
    "bairro"
  ]

  for(const key in newData) {

    if(key === 'latitude' || key === 'longitude'){
      updateGeom = true;
      continue;
    } 

    if(campos.includes(key)){
      queryBody.push(`${key} = $${cont}`);
      toSendBody.push(newData[key]);
      cont++;
    }
  }

  if(updateGeom) {
    queryBody.push(`geom = ST_SetSRID(ST_MakePoint($${cont}, $${cont + 1}), 4326)`);
    toSendBody.push(newData['longitude'], newData['latitude'])
    cont += 2;
  }

  if(queryBody.length === 0){
    return reply.code(400).send({sucess: false, message: 'Nenhum campo inserido para atualizar'});
  }

  const query = `
    UPDATE registro_popular 
    SET ${queryBody.join(', ')}
    WHERE fid = $${cont}
  `;

  toSendBody.push(id);

  try {
    const result = await pool.query(query, toSendBody);

    if(result.rowCount === 0 ) {
      return reply.code(404).send({ sucess: false, message: `Registro ${id} não encontrado.`});
    }

    reply.send({ sucess: true, message: `Registro ${id} atualizado com sucesso.`});

  } catch (err) {
    console.error(err);
    reply.code(500).send({error: err.message, detalhe: err.stack});
  }
})



// Rota para reversão geográfica
fastify.get('/reversao-geografica', async function (req, reply) {

  const { lat, lon } = req.query;

  if(!lat || !lon){
    reply.code(400).send({ error: 'Parâmetros lat e lon são obrigatórios!' });
  }

  const result = await reversaoGeografica(lat, lon);

  if(result.error) {
    reply.code(500).send(result);
  }

  reply.send(result);
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
