require('dotenv').config()
const express = require('express')
const path = require('path')
const { GoogleGenAI } = require('@google/genai')

const app = express()
const PORT = process.env.PORT || 3000

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null

if (!gemini) {
  console.warn('⚠ GEMINI_API_KEY não encontrada — usando geração rule-based')
} else {
  console.log('✓ Gemini API configurada — roteiros serão gerados por IA')
}

const ROTEIRO_SCHEMA = {
  type: 'object',
  properties: {
    itinerary: {
      type: 'array',
      description: 'Lista de dias, cada um com 3-4 atividades cronológicas',
      items: {
        type: 'object',
        properties: {
          day: { type: 'integer', description: 'Número do dia (1, 2, 3...)' },
          theme: { type: 'string', description: 'Tema/foco do dia em poucas palavras (ex: "Imersão histórica em Alfama")' },
          activities: {
            type: 'array',
            description: 'Atividades cronológicas do dia (3-4 atividades cobrindo manhã, almoço, tarde, noite)',
            items: {
              type: 'object',
              properties: {
                time: { type: 'string', description: 'Horário sugerido no formato HH:MM (ex: "09:00", "13:30", "20:00")' },
                period: { type: 'string', enum: ['manhã', 'almoço', 'tarde', 'jantar', 'noite'], description: 'Período do dia' },
                title: { type: 'string', description: 'Nome REAL do local ou atividade' },
                location: { type: 'string', description: 'Bairro ou região' },
                description: { type: 'string', description: '1-2 frases descrevendo o que fazer' },
                duration: { type: 'string', description: 'Duração estimada (ex: "2 horas", "1h30")' },
                cost_per_person: { type: 'integer', description: 'Custo por pessoa em BRL' },
                category: { type: 'string', description: 'Categoria curta' },
                tips: { type: 'string', description: 'Dica prática' }
              },
              required: ['time', 'period', 'title', 'location', 'description', 'duration', 'cost_per_person', 'category', 'tips']
            }
          }
        },
        required: ['day', 'theme', 'activities']
      }
    },
    lodging: {
      type: 'array',
      description: 'Três sugestões de hospedagem reais ou plausíveis',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome real ou plausível do hotel/Airbnb/pousada' },
          type: { type: 'string', description: 'Tipo (ex: "Hotel boutique 4 estrelas")' },
          neighborhood: { type: 'string', description: 'Bairro' },
          address: { type: 'string', description: 'Endereço aproximado ou ponto de referência (ex: "Av. Vieira Souto, próximo à Praia de Ipanema")' },
          price_per_night: { type: 'integer', description: 'Preço por noite em BRL' },
          rating: { type: 'number', description: 'Nota de 4.0 a 5.0' },
          tag: { type: 'string', description: 'Diferencial principal' }
        },
        required: ['name', 'type', 'neighborhood', 'address', 'price_per_night', 'rating', 'tag']
      }
    },
    restaurants: {
      type: 'array',
      description: 'Três restaurantes reais da cidade',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome REAL de restaurante existente na cidade' },
          cuisine: { type: 'string', description: 'Tipo de culinária' },
          neighborhood: { type: 'string', description: 'Bairro' },
          address: { type: 'string', description: 'Endereço aproximado ou ponto de referência' },
          price_range: { type: 'string', enum: ['$', '$$', '$$$', '$$$$'] },
          tag: { type: 'string', description: 'Categoria especial' }
        },
        required: ['name', 'cuisine', 'neighborhood', 'address', 'price_range', 'tag']
      }
    }
  },
  required: ['itinerary', 'lodging', 'restaurants']
}

async function generateAIRoteiro(input) {
  const { destination, origin, days, travelers, tripType, transport, hasLodging, preferences, style, travelDate, lodgingArea } = input
  const styleLabel = { eco: 'econômico', mid: 'conforto médio', luxury: 'luxo' }[style]

  let seasonInfo = ''
  if (travelDate) {
    const d = new Date(travelDate)
    const month = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    seasonInfo = `\n- Período da viagem: ${month} (considere clima, temporada turística, eventos sazonais e horários de funcionamento)`
  }

  let lodgingAnchor = ''
  if (lodgingArea) {
    lodgingAnchor = `\n- Hospedagem em: ${lodgingArea} (USE COMO ÂNCORA — atividades preferencialmente neste bairro ou bairros adjacentes/caminháveis)`
  }

  let transportRule = ''
  if (transport === 'A pé') {
    transportRule = `\n\nRESTRIÇÃO CRÍTICA: Usuário escolheu deslocamento A PÉ. Todas as atividades de um mesmo dia DEVEM estar em raio máximo de 2 km (preferencialmente no mesmo bairro). Atrações distantes (mais de 30 min a pé) NÃO podem aparecer no mesmo dia. Se for inviável visitar uma atração icônica caminhando, substitua por algo equivalente próximo.`
  } else if (transport === 'Transporte público') {
    transportRule = `\n\nRESTRIÇÃO: Usuário usa transporte público. Agrupe atividades por linha/região do metrô/ônibus. Evite mais de 2 trocas de transporte por dia.`
  } else if (transport === 'Carro alugado') {
    transportRule = `\n\nNOTA: Usuário tem carro. Atividades podem estar mais espalhadas, mas considere tempo de deslocamento e estacionamento em áreas centrais (pode ser caótico).`
  }

  const prompt = `Você é um especialista em viagens com conhecimento profundo de cidades do mundo todo. Crie roteiros usando exclusivamente LUGARES REAIS — nomes específicos de atrações, restaurantes, bairros e hotéis que de fato existem. Nunca use descrições genéricas como "Centro histórico" ou "Museu local" — use os nomes reais.

Crie um roteiro de viagem PERSONALIZADO e LOGISTICAMENTE VIÁVEL usando LUGARES REAIS de ${destination}.

Contexto:
- Destino: ${destination}
- Origem: ${origin || 'não informada'}
- Duração: ${days} dias
- Viajantes: ${travelers} ${travelers === 1 ? 'pessoa' : 'pessoas'}${seasonInfo}${lodgingAnchor}
- Tipo de viagem: ${tripType}
- Estilo: ${styleLabel}
- Transporte: ${transport}
- Já possui hospedagem: ${hasLodging || 'não informado'}
- Preferências: ${preferences && preferences.length ? preferences.join(', ') : 'nenhuma específica'}${transportRule}

REGRA DE OURO: Cada DIA deve ser planejado em UMA região/bairro (ou bairros adjacentes). Não pule de Alfama de manhã para Belém à tarde se for inviável logisticamente. Organize o roteiro inteiro de forma que cada dia faça sentido geograficamente.

Instruções obrigatórias:
1. Gere EXATAMENTE ${days} dias planejados. Cada dia deve ter 3 a 4 atividades CRONOLÓGICAS cobrindo manhã, almoço, tarde, jantar/noite.
2. Atividades de um mesmo dia DEVEM estar geograficamente próximas (mesmo bairro ou bairros vizinhos).
3. Os horários devem considerar tempo realista de deslocamento entre atividades.
4. Cada atividade tem horário (HH:MM), duração estimada, local REAL, descrição curta e dica prática.
5. Pelo menos uma atividade de cada dia deve ser gastronomia (almoço ou jantar) em restaurante REAL próximo das atividades do dia.
6. O "theme" do dia deve resumir o foco geográfico/temático (ex: "Alfama histórica", "Belém e os Descobrimentos").
7. ${hasLodging === 'Não' ? 'Sugira 3 hospedagens reais ou plausíveis para ' + travelers + ' pessoa(s)' + (lodgingArea ? ' na região de ' + lodgingArea : '') + '.' : 'Sugira 3 opções de hospedagem.'}
8. Sugira 3 restaurantes REAIS adicionais (diferentes dos do roteiro) alinhados com o tipo de viagem.
9. Custos em BRL realistas para 2026.
10. Considere horários de funcionamento típicos (museus geralmente fecham segundas, restaurantes têm horários específicos).`

  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: ROTEIRO_SCHEMA
    }
  })

  if (!response.text) throw new Error('Resposta da IA sem conteúdo')
  return JSON.parse(response.text)
}

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => res.set('Cache-Control', 'no-store')
}))

app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.sendFile(path.join(__dirname, 'views', 'index.html'))
})

app.get('/api/cities', async (req, res) => {
  const { q } = req.query
  if (!q || q.length < 2) return res.json([])

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=7`,
      {
        headers: {
          'User-Agent': 'TravelPlanner/1.0',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
        }
      }
    )
    const data = await response.json()

    const seen = new Set()
    const cities = data
      .filter(item => item.class === 'place' || item.class === 'boundary')
      .map(item => {
        const parts = item.display_name.split(', ')
        const name = `${parts[0]}, ${parts[parts.length - 1]}`
        return { name }
      })
      .filter(item => {
        if (seen.has(item.name)) return false
        seen.add(item.name)
        return true
      })

    res.json(cities)
  } catch (err) {
    console.error('Cities error:', err)
    res.json([])
  }
})

const BASE_ACTIVITIES = {
  Turismo: [
    { title: 'Centro histórico', desc: 'Caminhada pelos pontos icônicos e marcos arquitetônicos da cidade.', cost: 80, keyword: 'historic+street+downtown', search: 'centro histórico' },
    { title: 'Principais museus', desc: 'Visita aos museus mais relevantes com acervo cultural local.', cost: 120, keyword: 'museum+art+gallery', search: 'museum' },
    { title: 'Mirantes e vistas', desc: 'Pontos panorâmicos para fotos e contemplação da cidade.', cost: 60, keyword: 'viewpoint+skyline+panorama', search: 'viewpoint mirante' },
    { title: 'Igreja ou catedral histórica', desc: 'Patrimônio religioso e arquitetônico da cidade.', cost: 40, keyword: 'church+cathedral+architecture', search: 'cathedral church' },
    { title: 'Parque urbano', desc: 'Tarde relaxante nos espaços verdes da cidade.', cost: 30, keyword: 'park+nature+urban', search: 'park parque' },
  ],
  'Casal romântico': [
    { title: 'Jantar romântico com vista', desc: 'Restaurante intimista escolhido para criar memórias.', cost: 280, keyword: 'romantic+dinner+couple', search: 'fine dining restaurant' },
    { title: 'Pôr do sol em mirante', desc: 'Vista panorâmica no momento mais romântico do dia.', cost: 50, keyword: 'sunset+viewpoint+romantic', search: 'viewpoint sunset' },
    { title: 'Praça ou jardim charmoso', desc: 'Caminhada a dois pelos pontos mais bonitos.', cost: 0, keyword: 'square+plaza+romantic', search: 'plaza praça' },
    { title: 'Passeio de barco', desc: 'Experiência tranquila e cinematográfica.', cost: 200, keyword: 'boat+sunset+couple', search: 'marina port' },
    { title: 'Vinícola ou bistrô', desc: 'Tarde de vinhos e gastronomia.', cost: 180, keyword: 'wine+tasting+vineyard', search: 'wine bar bistro' },
  ],
  'Família': [
    { title: 'Atração familiar principal', desc: 'Local pensado para todas as idades.', cost: 150, keyword: 'family+kids+attraction', search: 'theme park family' },
    { title: 'Parque público', desc: 'Espaço para as crianças correrem e brincarem.', cost: 60, keyword: 'park+playground+family', search: 'park playground' },
    { title: 'Aquário ou zoológico', desc: 'Aprendizado e diversão para os pequenos.', cost: 120, keyword: 'aquarium+zoo+kids', search: 'aquarium zoo' },
    { title: 'Praia ou piscina pública', desc: 'Dia inteiro de lazer aquático.', cost: 80, keyword: 'beach+family+water', search: 'beach praia' },
    { title: 'Centro cultural infantil', desc: 'Museus e espaços interativos para crianças.', cost: 200, keyword: 'family+restaurant+lunch', search: 'science museum children' },
  ],
  'Negócios': [
    { title: 'Distrito comercial', desc: 'Conheça a região financeira e de negócios.', cost: 0, keyword: 'business+district+downtown', search: 'business district' },
    { title: 'Café para reuniões', desc: 'Local sofisticado para reuniões e networking.', cost: 60, keyword: 'cafe+coworking+business', search: 'coworking cafe' },
    { title: 'Restaurante executivo', desc: 'Casa refinada para fechar acordos.', cost: 250, keyword: 'fine+dining+executive', search: 'fine dining restaurant' },
    { title: 'Hotel boutique', desc: 'Hospedagem com facilidades para o profissional.', cost: 0, keyword: 'boutique+hotel+business', search: 'boutique hotel' },
    { title: 'Tour express turístico', desc: 'Visita rápida aos cartões-postais da cidade.', cost: 80, keyword: 'landmark+tourism+express', search: 'landmark tourism' },
  ],
  'Mochilão econômico': [
    { title: 'Marco gratuito principal', desc: 'Atração sem custo de entrada.', cost: 0, keyword: 'street+free+sightseeing', search: 'landmark monument' },
    { title: 'Mercado popular', desc: 'Comida de rua autêntica e barata.', cost: 30, keyword: 'street+food+local', search: 'market mercado' },
    { title: 'Hostel central', desc: 'Economia máxima e socialização.', cost: 0, keyword: 'hostel+backpacker+social', search: 'hostel backpacker' },
    { title: 'Trilha urbana', desc: 'Caminhada gratuita pelos melhores pontos.', cost: 0, keyword: 'hiking+trail+nature', search: 'trail path' },
    { title: 'Feira de rua', desc: 'Compre lanches e itens baratos.', cost: 25, keyword: 'market+local+cheap', search: 'street market' },
  ],
  'Luxo': [
    { title: 'Hotel 5 estrelas', desc: 'Hospedagem premium com todas as comodidades.', cost: 0, keyword: 'luxury+hotel+5+star', search: 'luxury hotel 5 star' },
    { title: 'Restaurante premiado', desc: 'Experiência gastronômica de alto nível.', cost: 600, keyword: 'fine+dining+michelin', search: 'michelin restaurant' },
    { title: 'Galeria de arte', desc: 'Tour exclusivo nas galerias de arte da cidade.', cost: 800, keyword: 'private+tour+luxury', search: 'art gallery' },
    { title: 'Spa premium', desc: 'Dia completo de relaxamento e bem-estar.', cost: 500, keyword: 'luxury+spa+wellness', search: 'luxury spa' },
    { title: 'Shopping de grife', desc: 'Compras nas marcas mais exclusivas.', cost: 1500, keyword: 'helicopter+yacht+luxury', search: 'luxury shopping' },
  ],
  'Aventura': [
    { title: 'Trilha desafiadora', desc: 'Caminhada longa com vistas espetaculares.', cost: 80, keyword: 'hiking+adventure+mountain', search: 'hiking trail mountain' },
    { title: 'Esportes radicais', desc: 'Rapel, tirolesa ou paraglider.', cost: 350, keyword: 'extreme+sports+adventure', search: 'climbing extreme sport' },
    { title: 'Praia para mergulho', desc: 'Vida marinha e águas cristalinas.', cost: 280, keyword: 'diving+snorkel+ocean', search: 'beach diving' },
    { title: 'Parque nacional', desc: 'Imersão na natureza da região.', cost: 200, keyword: 'offroad+bike+adventure', search: 'national park' },
    { title: 'Cachoeira ou rio', desc: 'Conexão pura com a natureza.', cost: 60, keyword: 'camping+wild+nature', search: 'waterfall river' },
  ],
  'Gastronomia': [
    { title: 'Mercado gastronômico', desc: 'Variedade de sabores locais em um só lugar.', cost: 100, keyword: 'food+market+gastronomy', search: 'food market mercado' },
    { title: 'Padaria tradicional', desc: 'Doces e pães típicos da região.', cost: 50, keyword: 'cooking+class+chef', search: 'bakery padaria' },
    { title: 'Restaurante consagrado', desc: 'Casa famosa pela alta gastronomia.', cost: 500, keyword: 'restaurant+gourmet+chef', search: 'restaurant gourmet' },
    { title: 'Cervejaria artesanal', desc: 'Pubs e cervejarias artesanais.', cost: 150, keyword: 'brewery+craft+beer', search: 'brewery craft beer' },
    { title: 'Cafeteria especial', desc: 'Cafés especiais e doceria local.', cost: 50, keyword: 'street+food+local', search: 'cafe coffee shop' },
  ],
  'Vida noturna': [
    { title: 'Bar de coquetelaria', desc: 'Drinks autorais em ambiente sofisticado.', cost: 180, keyword: 'cocktail+bar+nightlife', search: 'cocktail bar' },
    { title: 'Casa noturna', desc: 'Pista de dança até de madrugada.', cost: 250, keyword: 'club+night+dance', search: 'nightclub' },
    { title: 'Bar com música ao vivo', desc: 'Bar com banda local tocando ao vivo.', cost: 120, keyword: 'live+music+bar', search: 'live music bar' },
    { title: 'Rooftop bar', desc: 'Bar no topo com vista da cidade.', cost: 200, keyword: 'rooftop+bar+skyline', search: 'rooftop bar' },
    { title: 'Pub tradicional', desc: 'Cerveja em pub clássico da cidade.', cost: 150, keyword: 'pub+crawl+night', search: 'pub' },
  ],
}

function extractCorePlaceName(title) {
  let name = title.replace(/\s*\([^)]*\)\s*/g, '').trim()
  if (name.includes(' e ')) name = name.split(' e ')[0].trim()
  name = name.replace(/^(Visita ao? |Explorar? |Excursão a |Tour pel[oa] |Passeio pel[oa] |Exploração )/i, '').trim()
  return name
}

async function searchWikipediaImage(lang, query) {
  try {
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'TravelPlanner/1.0' } })
    const searchData = await searchRes.json()
    const title = searchData[1]?.[0]
    if (!title) return null

    const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    const summaryRes = await fetch(summaryUrl, { headers: { 'User-Agent': 'TravelPlanner/1.0' } })
    if (!summaryRes.ok) return null
    const summary = await summaryRes.json()

    const thumb = summary.thumbnail?.source
    if (!thumb) return null
    return thumb.replace(/\/\d+px-/, '/800px-')
  } catch {
    return null
  }
}

async function findWikipediaImage(rawTitle, city) {
  const core = extractCorePlaceName(rawTitle)
  const queries = [
    core,
    rawTitle,
    `${core} ${city}`
  ]
  for (const lang of ['pt', 'en']) {
    for (const query of queries) {
      const result = await searchWikipediaImage(lang, query)
      if (result) return result
    }
  }
  return null
}

// Imagens curadas por categoria (Unsplash, URLs estáveis)
const CATEGORY_IMAGES = {
  gastronomia: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80&auto=format&fit=crop',
  restaurante: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80&auto=format&fit=crop',
  comida: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80&auto=format&fit=crop',
  cafeteria: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80&auto=format&fit=crop',
  bar: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800&q=80&auto=format&fit=crop',
  noturna: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80&auto=format&fit=crop',
  historico: 'https://images.unsplash.com/photo-1564660335-2e7a3aa2f1bf?w=800&q=80&auto=format&fit=crop',
  museu: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=800&q=80&auto=format&fit=crop',
  cultural: 'https://images.unsplash.com/photo-1565060169187-5284c6332b71?w=800&q=80&auto=format&fit=crop',
  cultura: 'https://images.unsplash.com/photo-1565060169187-5284c6332b71?w=800&q=80&auto=format&fit=crop',
  natureza: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80&auto=format&fit=crop',
  parque: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=800&q=80&auto=format&fit=crop',
  trilha: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80&auto=format&fit=crop',
  praia: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80&auto=format&fit=crop',
  compras: 'https://images.unsplash.com/photo-1481437156560-3205f6a55735?w=800&q=80&auto=format&fit=crop',
  mercado: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80&auto=format&fit=crop',
  vista: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&q=80&auto=format&fit=crop',
  panoramica: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&q=80&auto=format&fit=crop',
  mirante: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80&auto=format&fit=crop',
  igreja: 'https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800&q=80&auto=format&fit=crop',
  templo: 'https://images.unsplash.com/photo-1528164344705-47542687000d?w=800&q=80&auto=format&fit=crop',
  hotel: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80&auto=format&fit=crop',
  hospedagem: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80&auto=format&fit=crop',
  airbnb: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80&auto=format&fit=crop',
  aventura: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80&auto=format&fit=crop',
  spa: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80&auto=format&fit=crop',
  default: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80&auto=format&fit=crop'
}

function getCategoryImage(text) {
  if (!text) return CATEGORY_IMAGES.default
  const normalized = text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [key, url] of Object.entries(CATEGORY_IMAGES)) {
    if (normalized.includes(key)) return url
  }
  return CATEGORY_IMAGES.default
}

async function findBestImage({ placeName, location, city, category }) {
  const placeImg = await findWikipediaImage(placeName, city)
  if (placeImg) return { url: placeImg, isReal: true }

  if (location) {
    const locImg = await searchWikipediaImage('pt', location) || await searchWikipediaImage('en', location)
    if (locImg) return { url: locImg, isReal: false }
  }

  const cityImg = await searchWikipediaImage('pt', city) || await searchWikipediaImage('en', city)
  if (cityImg) return { url: cityImg, isReal: false }

  return { url: getCategoryImage(category || placeName), isReal: false }
}

async function findRealPlace(city, searchTerm) {
  try {
    const query = `${searchTerm} ${city}`
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=pt-BR`
    const res = await fetch(url, { headers: { 'User-Agent': 'TravelPlanner/1.0' } })
    const data = await res.json()
    const cityLower = city.toLowerCase()
    const candidate = data.find(p =>
      p.display_name.toLowerCase().includes(cityLower) &&
      p.class !== 'boundary'
    ) || data[0]
    if (!candidate || !candidate.name) return null
    return {
      name: candidate.name,
      address: candidate.display_name.split(',').slice(0, 3).join(',').trim()
    }
  } catch (err) {
    console.error('findRealPlace error:', err)
    return null
  }
}

function getStyle(tripType, preferences = []) {
  if (preferences.includes('economia') || tripType === 'Mochilão econômico') return 'eco'
  if (preferences.includes('conforto') || tripType === 'Luxo') return 'luxury'
  return 'mid'
}

// Custos REAIS médios de mercado em BRL (pesquisados em Booking/Airbnb/Decolar 2025)
const STYLE_RATES = {
  eco: {
    lodgingPerNight: 120,           // hostel privativo ou hotel simples
    lodgingType: 'hostel ou hotel simples (quarto duplo)',
    foodPerPersonPerDay: 70,        // 3 refeições econômicas (PFs, lanches)
    foodDesc: '3 refeições econômicas (PFs, lanches)',
    attractionMultiplier: 0.6,
    hotelStars: 2
  },
  mid: {
    lodgingPerNight: 320,           // hotel 3 estrelas ou Airbnb bom
    lodgingType: 'hotel 3 estrelas ou Airbnb confortável',
    foodPerPersonPerDay: 140,       // restaurantes médios
    foodDesc: '3 refeições em restaurantes médios',
    attractionMultiplier: 1.0,
    hotelStars: 3
  },
  luxury: {
    lodgingPerNight: 780,           // hotel 4-5 estrelas
    lodgingType: 'hotel 4-5 estrelas',
    foodPerPersonPerDay: 320,       // restaurantes premium
    foodDesc: '3 refeições em restaurantes premium',
    attractionMultiplier: 1.5,
    hotelStars: 5
  }
}

// Custo de transporte por dia (BRL) — algumas categorias dividem entre pessoas
function getTransportCost(mode, travelers) {
  switch (mode) {
    case 'Carro alugado':
      // Diária do carro é dividida entre os ocupantes (mesmo custo total)
      return { perDay: 180, shared: true, desc: 'aluguel + combustível (dividido entre o grupo)' }
    case 'Uber / Táxi':
      // Custo cresce com pessoas (carros maiores) mas não linearmente
      return { perDay: Math.round(80 + 30 * (travelers - 1)), shared: true, desc: 'corridas estimadas para o grupo' }
    case 'Transporte público':
      return { perDay: 25 * travelers, shared: false, desc: 'passagens diárias por pessoa' }
    case 'A pé':
      return { perDay: 0, shared: true, desc: 'sem custo de deslocamento' }
    default:
      return { perDay: 50 * travelers, shared: false, desc: 'estimativa mista' }
  }
}

function pickActivities(tripType, days, style) {
  const baseActs = BASE_ACTIVITIES[tripType] || BASE_ACTIVITIES.Turismo
  const mult = STYLE_RATES[style].attractionMultiplier
  return Array.from({ length: days }, (_, i) => {
    const act = baseActs[i % baseActs.length]
    return {
      title: act.title,
      description: act.desc,
      search: act.search,
      keyword: act.keyword,
      costPerPerson: Math.round(act.cost * mult)
    }
  })
}

function buildBudgetBreakdown({ days, travelers, transport, hasLodging, style, itinerary }) {
  const rates = STYLE_RATES[style]
  const breakdown = []

  if (!hasLodging) {
    const amount = rates.lodgingPerNight * days
    const peopleNote = travelers > 1 ? ` (quarto compartilhado por ${travelers} pessoas)` : ''
    breakdown.push({
      category: 'Hospedagem',
      amount,
      math: `${days} ${days === 1 ? 'noite' : 'noites'} × R$ ${rates.lodgingPerNight}/noite${peopleNote}`,
      detail: rates.lodgingType
    })
  }

  const foodTotal = days * travelers * rates.foodPerPersonPerDay
  breakdown.push({
    category: 'Alimentação',
    amount: foodTotal,
    math: `${days} ${days === 1 ? 'dia' : 'dias'} × ${travelers} ${travelers === 1 ? 'pessoa' : 'pessoas'} × R$ ${rates.foodPerPersonPerDay} por pessoa/dia`,
    detail: rates.foodDesc
  })

  const t = getTransportCost(transport, travelers)
  const transportTotal = t.perDay * days
  const transportNote = t.shared
    ? `(custo do grupo: R$ ${t.perDay}/dia)`
    : `(R$ ${Math.round(t.perDay / travelers)} por pessoa/dia × ${travelers} ${travelers === 1 ? 'pessoa' : 'pessoas'})`
  breakdown.push({
    category: 'Transporte',
    amount: transportTotal,
    math: `${days} ${days === 1 ? 'dia' : 'dias'} × R$ ${t.perDay}/dia ${transportNote}`,
    detail: `${transport || 'A definir'} — ${t.desc}`
  })

  const attractionsPerPerson = itinerary.reduce((s, d) => s + (d.dailyCostPerPerson ?? d.costPerPerson ?? 0), 0)
  const attractionsTotal = attractionsPerPerson * travelers
  breakdown.push({
    category: 'Passeios e atrações',
    amount: attractionsTotal,
    math: travelers === 1
      ? `R$ ${attractionsPerPerson} (soma das atividades por pessoa)`
      : `R$ ${attractionsPerPerson} por pessoa × ${travelers} pessoas`,
    detail: `${itinerary.length} ${itinerary.length === 1 ? 'dia' : 'dias'} de atividades`
  })

  const subtotal = breakdown.reduce((s, b) => s + b.amount, 0)
  const emergency = Math.round(subtotal * 0.10)
  breakdown.push({
    category: 'Reserva de emergência',
    amount: emergency,
    math: `10% do subtotal (R$ ${subtotal.toLocaleString('pt-BR')})`,
    detail: 'Recomendado para imprevistos da viagem'
  })

  return breakdown
}

function buildLodgingSuggestions(city, prefs, style, travelers) {
  const base = STYLE_RATES[style].lodgingPerNight
  const capacity = travelers > 2 ? `Acomoda ${travelers} pessoas` : (travelers === 2 ? 'Casal' : 'Individual')

  return [
    {
      name: `${city} Central Hotel`,
      type: `Hotel ${STYLE_RATES[style].hotelStars} estrelas`,
      price: `R$ ${Math.round(base * 0.95)}/noite`,
      rating: 4.6,
      tag: prefs[0] || 'melhor localização',
      capacity,
      keyword: 'boutique+hotel+room'
    },
    {
      name: `Airbnb no centro de ${city}`,
      type: 'Apartamento inteiro',
      price: `R$ ${Math.round(base * 0.75)}/noite`,
      rating: 4.8,
      tag: 'melhor custo-benefício',
      capacity,
      keyword: 'apartment+airbnb+modern'
    },
    {
      name: `${city} Boutique`,
      type: `Hotel ${STYLE_RATES[style].hotelStars + 1} estrelas`,
      price: `R$ ${Math.round(base * 1.4)}/noite`,
      rating: 4.7,
      tag: 'conforto premium',
      capacity,
      keyword: 'hotel+lobby+luxury'
    }
  ]
}

function buildRestaurantSuggestions(city, tripType, prefs) {
  const restaurants = [
    { name: `Cozinha de ${city}`, cuisine: 'Comida típica', price: '$$', tag: 'gastronomia local', keyword: 'restaurant+local+food' },
    { name: 'Verde & Raízes', cuisine: 'Vegano e fitness', price: '$$', tag: 'opção fitness/vegana', keyword: 'vegan+healthy+bowl' },
    { name: 'Sabor & Brasa', cuisine: 'Churrasco premium', price: '$$$', tag: 'experiência local', keyword: 'steak+restaurant+grill' },
    { name: `Bistrô ${city}`, cuisine: 'Internacional', price: '$$$', tag: 'romântico', keyword: 'bistro+romantic+candle' },
    { name: 'Cantina do Bairro', cuisine: 'Caseira', price: '$', tag: 'opção econômica', keyword: 'casual+restaurant+lunch' },
  ]

  if (tripType === 'Casal romântico') return [restaurants[3], restaurants[2], restaurants[0]]
  if (tripType === 'Mochilão econômico') return [restaurants[4], restaurants[0], restaurants[1]]
  if (tripType === 'Luxo' || tripType === 'Gastronomia') return [restaurants[2], restaurants[3], restaurants[0]]
  if (prefs.includes('economia')) return [restaurants[4], restaurants[0], restaurants[1]]
  if (prefs.includes('gastronomia local')) return [restaurants[0], restaurants[2], restaurants[4]]
  return [restaurants[0], restaurants[1], restaurants[3]]
}

function imgUrl(city, keyword, seed) {
  const c = encodeURIComponent(city.toLowerCase())
  return `https://loremflickr.com/800/450/${c},${keyword}?lock=${seed}`
}

app.post('/api/planner', async (req, res) => {
  const {
    origin, destination, days, travelers = 1, budget,
    tripType, transport, hasLodging, lodgingPrefs = [],
    preferences = [], travelDate, lodgingArea
  } = req.body

  const city = destination.split(',')[0].trim()
  const style = getStyle(tripType, preferences)
  const imgKey = (text) => encodeURIComponent(String(text).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim() || 'city')

  let itinerary
  let aiLodging = null
  let aiRestaurants = null

  if (gemini) {
    try {
      const aiData = await generateAIRoteiro({
        destination, origin, days, travelers, tripType, transport, hasLodging, preferences, style, travelDate, lodgingArea
      })

      itinerary = await Promise.all(aiData.itinerary.map(async (day) => {
        const mainActivity = day.activities?.[0]
        const coverImg = mainActivity
          ? await findBestImage({ placeName: mainActivity.title, location: mainActivity.location, city, category: mainActivity.category })
          : { url: getCategoryImage('default'), isReal: false }

        const activitiesEnriched = await Promise.all((day.activities || []).map(async (act) => {
          const actImg = await findBestImage({ placeName: act.title, location: act.location, city, category: act.category })
          return {
            time: act.time,
            period: act.period,
            title: act.title,
            location: act.location,
            description: act.description,
            duration: act.duration,
            costPerPerson: act.cost_per_person,
            cost: act.cost_per_person * travelers,
            category: act.category,
            tips: act.tips,
            imageUrl: actImg.url,
            imageIsReal: actImg.isReal,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.title + ' ' + city)}`
          }
        }))

        const dailyCostPerPerson = activitiesEnriched.reduce((s, a) => s + a.costPerPerson, 0)

        return {
          day: day.day,
          theme: day.theme,
          activities: activitiesEnriched,
          dailyCostPerPerson,
          dailyCost: dailyCostPerPerson * travelers,
          imageUrl: coverImg.url,
          imageIsReal: coverImg.isReal
        }
      }))

      aiLodging = await Promise.all(aiData.lodging.map(async (l) => {
        const img = await findBestImage({ placeName: l.name, location: l.neighborhood, city, category: l.type + ' hotel' })
        return {
          name: l.name,
          type: l.type,
          neighborhood: l.neighborhood,
          address: l.address,
          price: `R$ ${l.price_per_night.toLocaleString('pt-BR')}/noite`,
          rating: l.rating,
          tag: l.tag,
          imageUrl: img.url,
          imageIsReal: img.isReal,
          bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(l.name + ' ' + city)}`
        }
      }))

      aiRestaurants = await Promise.all(aiData.restaurants.map(async (r) => {
        const img = await findBestImage({ placeName: r.name, location: r.neighborhood, city, category: r.cuisine + ' restaurante' })
        return {
          name: r.name,
          cuisine: r.cuisine,
          neighborhood: r.neighborhood,
          address: r.address,
          price: r.price_range,
          tag: r.tag,
          imageUrl: img.url,
          imageIsReal: img.isReal,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + city)}`
        }
      }))
    } catch (err) {
      console.error('AI generation failed, falling back to rule-based:', err.message)
    }
  }

  if (!itinerary) {
    const activities = pickActivities(tripType, days, style)
    itinerary = await Promise.all(
      activities.map(async (act, i) => {
        const real = await findRealPlace(city, act.search)
        const title = real?.name || act.title
        const img = await findBestImage({ placeName: title, location: real?.address, city, category: act.title })
        const activity = {
          time: '10:00',
          period: 'manhã',
          title,
          location: real?.address || city,
          description: act.description,
          duration: '2-3 horas',
          costPerPerson: act.costPerPerson,
          cost: act.costPerPerson * travelers,
          category: act.title,
          tips: 'Confirme horários de funcionamento antes da visita',
          imageUrl: img.url,
          imageIsReal: img.isReal
        }
        return {
          day: i + 1,
          theme: act.title,
          activities: [activity],
          dailyCostPerPerson: act.costPerPerson,
          dailyCost: act.costPerPerson * travelers,
          imageUrl: img.url,
          imageIsReal: img.isReal
        }
      })
    )
  }

  const budgetBreakdown = buildBudgetBreakdown({
    days, travelers, transport,
    hasLodging: hasLodging === 'Sim',
    style, itinerary
  })
  const totalCost = budgetBreakdown.reduce((s, b) => s + b.amount, 0)

  const lodging = aiLodging
    ? (hasLodging === 'Não' ? aiLodging : [])
    : (hasLodging === 'Não'
        ? buildLodgingSuggestions(city, lodgingPrefs, style, travelers).map((l, i) => ({ ...l, imageUrl: imgUrl(city, l.keyword, 100 + i) }))
        : [])

  const restaurants = aiRestaurants
    || buildRestaurantSuggestions(city, tripType, preferences)
        .map((r, i) => ({ ...r, imageUrl: imgUrl(city, r.keyword, 200 + i) }))

  res.json({
    destination, origin, days, travelers, budget,
    tripType, transport, style,
    aiGenerated: !!gemini && itinerary[0]?.activities?.length > 0,
    itinerary, budgetBreakdown, totalCost,
    lodging, restaurants
  })
})

function pad(n) { return String(n).padStart(2, '0') }

function formatLocalICS(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function formatUTCStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function parseLocalDate(dateStr) {
  if (!dateStr) return new Date()
  const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10))
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d)
}

function escapeICS(text) {
  if (!text) return ''
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function buildICS({ destination, startDate, itinerary }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Travel Planner//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ]

  const start = parseLocalDate(startDate)

  itinerary.forEach((day, dayIdx) => {
    const dayDate = new Date(start)
    dayDate.setDate(start.getDate() + dayIdx)

    ;(day.activities || []).forEach((act, actIdx) => {
      const [h, m] = (act.time || '09:00').split(':').map(n => parseInt(n, 10))
      const eventStart = new Date(dayDate)
      eventStart.setHours(h || 9, m || 0, 0, 0)

      const durationMatch = (act.duration || '2 horas').match(/(\d+)\s*h(?:oras?)?(?:\s*(\d+))?|(\d+)\s*min/i)
      let durationMinutes = 120
      if (durationMatch) {
        if (durationMatch[1]) durationMinutes = parseInt(durationMatch[1], 10) * 60 + (parseInt(durationMatch[2], 10) || 0)
        else if (durationMatch[3]) durationMinutes = parseInt(durationMatch[3], 10)
      }
      const eventEnd = new Date(eventStart.getTime() + durationMinutes * 60 * 1000)

      const description = [
        act.description,
        act.tips ? `\nDICA: ${act.tips}` : '',
        act.cost ? `\nCusto estimado: R$ ${act.cost.toLocaleString('pt-BR')}` : ''
      ].filter(Boolean).join('')

      lines.push(
        'BEGIN:VEVENT',
        `UID:travel-${dayIdx}-${actIdx}-${Date.now()}@travelplanner`,
        `DTSTAMP:${formatUTCStamp(new Date())}`,
        `DTSTART:${formatLocalICS(eventStart)}`,
        `DTEND:${formatLocalICS(eventEnd)}`,
        `SUMMARY:${escapeICS(act.title)}`,
        `LOCATION:${escapeICS(act.location || destination)}`,
        `DESCRIPTION:${escapeICS(description)}`,
        'END:VEVENT'
      )
    })
  })

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

app.post('/api/calendar', (req, res) => {
  const { destination, travelDate, itinerary } = req.body
  if (!itinerary || !itinerary.length) {
    return res.status(400).json({ error: 'Roteiro inválido' })
  }
  try {
    const ics = buildICS({ destination, startDate: travelDate, itinerary })
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="roteiro-${destination?.split(',')[0]?.replace(/\s+/g, '-') || 'viagem'}.ics"`)
    res.send(ics)
  } catch (err) {
    console.error('Calendar error:', err)
    res.status(500).json({ error: 'Erro ao gerar agenda' })
  }
})

app.post('/api/chat', async (req, res) => {
  if (!gemini) {
    return res.status(503).json({ error: 'Assistente de IA não está configurado' })
  }

  const { messages = [], context } = req.body
  if (!messages.length) {
    return res.status(400).json({ error: 'Nenhuma mensagem enviada' })
  }

  let contextBlock = ''
  if (context && context.destination) {
    const activities = (context.itinerary || []).map((d) => {
      const acts = (d.activities || []).map(a => `  ${a.time} - ${a.title} (${a.location})`).join('\n')
      return `Dia ${d.day}: ${d.theme}\n${acts}`
    }).join('\n\n')
    contextBlock = `\n\nCONTEXTO DA VIAGEM DO USUÁRIO:
- Destino: ${context.destination}
- Origem: ${context.origin || 'não informada'}
- Duração: ${context.days} dias
- Viajantes: ${context.travelers || 1}
- Tipo: ${context.tripType || 'turismo'}
- Transporte: ${context.transport || 'não informado'}
- Orçamento total: R$ ${(context.budget || 0).toLocaleString('pt-BR')}
- Custo estimado: R$ ${(context.totalCost || 0).toLocaleString('pt-BR')}

ROTEIRO PLANEJADO:
${activities || 'Nenhuma atividade gerada ainda'}`
  }

  const systemPrompt = `Você é um assistente de viagem amigável, prático e direto. Seu papel é tirar dúvidas sobre planejamento de viagens, dar dicas práticas, sugerir alternativas e responder perguntas culturais ou logísticas.

Diretrizes:
- Respostas curtas e diretas (2-4 parágrafos no máximo)
- Sempre que possível, dê informações concretas (horários, preços, dicas)
- Se o usuário tem um roteiro planejado (ver contexto), use-o ao responder
- Não invente informações específicas que não tem certeza — diga "vale confirmar antes da viagem"${contextBlock}`

  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }))

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: { systemInstruction: systemPrompt }
    })
    res.json({ reply: response.text })
  } catch (err) {
    console.error('Chat error:', err)
    res.status(500).json({ error: 'Erro ao gerar resposta' })
  }
})

const userReviews = []

app.get('/api/reviews', (req, res) => {
  res.json(userReviews)
})

app.post('/api/reviews', (req, res) => {
  const { name, rating, comment } = req.body
  if (!name || !rating || !comment) {
    return res.status(400).json({ error: 'Preencha todos os campos' })
  }
  const review = {
    name: String(name).slice(0, 50),
    rating: Math.min(5, Math.max(1, Number(rating))),
    comment: String(comment).slice(0, 280),
    initial: String(name).charAt(0).toUpperCase(),
    date: new Date().toISOString()
  }
  userReviews.unshift(review)
  if (userReviews.length > 12) userReviews.pop()
  res.json({ ok: true, review })
})

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
})
