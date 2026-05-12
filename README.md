# Travel Planner — Planejador de Viagens com IA

> **Plataforma de planejamento de viagens** que usa IA generativa (Google Gemini) para criar roteiros personalizados, com lugares reais, cronograma detalhado, orçamento transparente e assistente virtual integrado.

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Gemini](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat&logo=google&logoColor=white)](https://ai.google.dev/)

🌐 **Demo ao vivo:** **[travel-planner-ggf3.onrender.com](https://travel-planner-ggf3.onrender.com)**

> ⏱️ Primeira request pode demorar ~30s (servidor em modo free hiberna após 15min sem uso).

---

## 🎯 O problema

Planejar uma viagem envolve dezenas de decisões: o que visitar, onde comer, quanto vou gastar, em que ordem ir. As ferramentas existentes geram listas genéricas (Top 10 atrações de X) sem considerar contexto — orçamento, tipo de viagem, preferências pessoais ou logística.

## 💡 A solução

Um wizard de 5 passos coleta informações relevantes (destino, dias, viajantes, orçamento, tipo de viagem, transporte, hospedagem, preferências), e a IA constrói um **roteiro cronológico completo** considerando:

- **Lugares reais** com nomes específicos (ex: "Castelo de São Jorge", não "Centro histórico")
- **Logística viável** — se o usuário escolheu "a pé", todas as atividades do dia são caminháveis
- **Agrupamento por bairro** — cada dia em uma região geográfica
- **Orçamento detalhado** com matemática transparente (hospedagem, alimentação, transporte, passeios, reserva)
- **Cronograma com horários** — manhã, almoço, tarde, jantar
- **Dicas práticas** para cada local (horário, fila, transporte)

---

## ✨ Principais features

| Feature | Descrição |
|---|---|
| 🧙 **Wizard multi-step** | Formulário em 5 etapas com progress bar e validação por etapa |
| 🔍 **Autocomplete de cidades** | Busca real via OpenStreetMap Nominatim com debounce de 350ms |
| 📍 **Geolocalização** | Botão "usar minha localização" preenche origem via Nominatim reverse |
| 🤖 **Roteiro com IA** | Gemini 2.5 Flash gera cronograma personalizado em JSON estruturado |
| 🖼️ **Imagens reais** | Cascata: Wikipedia do local → bairro → cidade → categoria curada |
| 💬 **Chat assistente** | IA contextual que conhece o roteiro do usuário e tira dúvidas específicas |
| 💰 **Breakdown de orçamento** | Cálculo transparente por categoria com fórmula explícita |
| 📅 **Export para agenda** | Gera arquivo `.ics` compatível com Google/Apple/Outlook Calendar |
| ⭐ **Avaliações** | Formulário com rating de estrelas e persistência |
| 🔄 **Fallback sem IA** | Geração baseada em regras se a API key não estiver configurada |

---

## 🛠️ Stack técnica

**Backend**
- Node.js + Express 5
- Google Gemini 2.5 Flash (geração estruturada via JSON Schema)
- OpenStreetMap Nominatim API (geocoding e autocomplete)
- Wikipedia REST API (imagens de pontos turísticos reais)

**Frontend**
- HTML + JavaScript vanilla
- Tailwind CSS 4 (utility-first)
- SSR/SPA híbrido (página única, conteúdo dinâmico via fetch)

**Outras decisões**
- Sem framework no frontend (mostrar fundamentos de JS sem abstrações)
- Sem banco de dados (reviews em memória — escopo de portfólio)
- Schema-first com a IA (estrutura JSON garantida pela API do Gemini)
- Acessibilidade básica (labels, foco, navegação por teclado)

---

## 🚀 Rodando localmente

```bash
git clone https://github.com/SEU-USUARIO/travel-planner.git
cd travel-planner
npm install
```

Crie um arquivo `.env`:

```env
GEMINI_API_KEY=sua-chave-aqui
```

A chave é **gratuita** em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (1.500 requests/dia, sem cartão de crédito).

```bash
npm run dev
```

Acesse http://localhost:3000

> Sem a chave do Gemini, o projeto funciona em modo "rule-based" (templates de roteiro), permitindo demo sem dependências externas.

---

## 📂 Arquitetura

```
travel-planner/
├── server.js              Express + 5 endpoints
│   ├── GET  /                 Página principal
│   ├── GET  /api/cities       Autocomplete de cidades
│   ├── POST /api/planner      Geração de roteiro (IA ou fallback)
│   ├── POST /api/chat         Chat assistente contextual
│   ├── POST /api/calendar     Export .ics
│   └── GET/POST /api/reviews  Avaliações dos usuários
├── views/index.html       Página única (wizard + resultado + chat)
├── public/
│   ├── js/app.js          Lógica de wizard, render, chat e export
│   └── css/output.css     Tailwind compilado
└── src/input.css          Tailwind source (com @source para detecção)
```

---

## 🎓 Decisões técnicas notáveis

**1. Schema estruturado para a IA**
Em vez de pedir um texto livre e dar parse, defino um JSON Schema no `responseSchema` do Gemini. Resultado: nunca recebo dados mal formatados, e os campos são previsíveis.

**2. Cascata de imagens em 4 níveis**
Imagens são o calcanhar de Aquiles de apps gerados por IA. Implementei: (1) Wikipedia do local exato → (2) Wikipedia do bairro → (3) Wikipedia da cidade → (4) imagem curada por categoria. Cada nível tem label "Foto ilustrativa" para transparência.

**3. Orçamento determinístico + atividades pela IA**
A matemática do breakdown não passa pela IA — é calculada com taxas reais de mercado (hospedagem por noite, alimentação por pessoa/dia, etc). Apenas o conteúdo qualitativo (atividades, restaurantes) vem da IA. Isso evita números inventados.

**4. Chat contextual**
O endpoint `/api/chat` recebe não só a mensagem do usuário, mas também o roteiro gerado. A IA responde com base no contexto específico da viagem, não como assistente genérico.

**5. Logística realista**
Quando o usuário escolhe "a pé" como transporte, o prompt da IA recebe uma restrição crítica: **todas as atividades de um dia em raio de 2km**. Resolve o problema clássico de roteiros que jogam o usuário entre bairros distantes.

---

## 🗺️ Roadmap

- [x] Wizard multi-step com validação
- [x] Geração de roteiro com IA
- [x] Cronograma detalhado com horários
- [x] Chat assistente contextual
- [x] Export para Google Calendar (.ics)
- [ ] Integração com banco de dados (persistir roteiros gerados)
- [ ] Login e roteiros salvos por usuário
- [ ] Compartilhamento de roteiro por URL única
- [ ] Integração com APIs reais de hotéis (Booking) e voos
- [ ] Versão PWA para uso offline durante a viagem

---

## 👨‍💻 Autor

Projeto de portfólio desenvolvido por **Kauã**. Disponível para oportunidades em desenvolvimento full-stack.
