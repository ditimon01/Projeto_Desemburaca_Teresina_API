const fs = require('fs');
const { google } = require('googleapis');



/**
 * Faz upload de um arquivo ao Google Drive
 * @param {string} filePath - Caminho do arquivo local
 * @param {string} fileName - Nome que será usado no Drive
 * @param {string} mimeType - Tipo MIME do arquivo
 */

async function uploadToDrive(filePath, fileName, mimeType) {

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })

  const drive = google.drive({ version: 'v3', auth });

  const fileMetadata = {
    name: fileName,
    parents: [process.env.GDRIVE_FOLDER_ID], // Pasta no Drive, configurada como variável de ambiente
  };

  const media = {
    mimeType,
    body: fs.createReadStream(filePath),
  };

  try {

    const res = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, name',
    });

    fs.unlink(filePath, () => {}); // remove arquivo temporário
    
    return res.data;

  } catch (err) {
    console.error('Erro ao fazer upload no Google Drive: ', err.response?.data || err.message);
    throw err;
  }
}

module.exports = { uploadToDrive };
