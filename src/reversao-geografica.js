
const axios = require('axios');

async function reversaoGeografica(latitude, longitude) {
    const API_KEY = 'pk.7ac70b80805183e2466b163c071075dc';
    const url = `https://us1.locationiq.com/v1/reverse.php?key=${API_KEY}&lat=${latitude}&lon=${longitude}&format=json`;

    try{
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'GeoAPI/1.0'
            }
        });

        const address = response.data.address;
        const rua = address.road || 'Rua não encontrada';
        const bairro = address.suburb || 'Bairro não encontrado';

        return { rua, bairro };

    } catch (err) {
        console.error(err);
        return reply.code(500).send({ error: 'Erro ao buscar dados da API de geolocalização.'});
    }
    
}

module.exports = { reversaoGeografica };