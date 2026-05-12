# Travel Planner

Planejador de viagens inteligente com IA generativa. O usuário responde algumas perguntas (destino, dias, tipo de viagem, transporte, preferências) e recebe um roteiro completo com:

- Cronograma detalhado por dia (manhã, tarde, jantar) com horários
- Lugares reais (atrações, restaurantes, hotéis) — não genéricos
- Breakdown de orçamento por categoria com matemática transparente
- Chat assistente para tirar dúvidas sobre a viagem
- Exportação do roteiro para Google Calendar / Apple Calendar (`.ics`)

## Stack

- **Backend:** Node.js + Express
- **Frontend:** HTML, vanilla JavaScript, Tailwind CSS
- **IA:** Google Gemini 2.5 Flash (geração de roteiros + chat)
- **APIs externas:** OpenStreetMap Nominatim (autocomplete e geocoding), Wikipedia REST API (imagens reais dos locais)

## Funcionalidades

| Recurso | Descrição |
|---|---|
| Wizard multi-step | Formulário em 5 etapas (destino, tipo, transporte, hospedagem, preferências) |
| Autocomplete de cidades | Busca real via Nominatim com debounce |
| Geolocalização | Botão "usar minha localização" preenche origem automaticamente |
| Roteiro personalizado | IA respeita transporte escolhido (a pé = bairros próximos) |
| Imagens reais | Cascata: Wikipedia do local → bairro → cidade → categoria curada |
| Chat contextual | Assistente que conhece o roteiro do usuário e tira dúvidas específicas |
| Export para agenda | Gera arquivo `.ics` compatível com Google/Apple/Outlook |
| Avaliações | Formulário de feedback com persistência em memória |
| Fallback sem IA | Funciona com geração baseada em regras se a API key não estiver configurada |

## Rodando localmente

```bash
git clone https://github.com/SEU-USUARIO/travel-planner.git
cd travel-planner
npm install
```

Crie um arquivo `.env`:

```
GEMINI_API_KEY=sua-chave-aqui
```

A chave é gratuita em [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

```bash
npm run dev
```

Abra http://localhost:3000

## Estrutura

```
travel-planner/
├── server.js              Express + endpoints (/api/planner, /api/chat, /api/calendar, /api/cities, /api/reviews)
├── views/index.html       Página única
├── public/
│   ├── js/app.js          Lógica do wizard, render, chat e export
│   └── css/output.css     Tailwind compilado
└── src/input.css          Tailwind source
```
