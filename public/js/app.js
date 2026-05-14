// ============================================================
// State
// ============================================================
const state = {
  currentStep: 1,
  totalSteps: 5,
  tripType: null,
  transport: null,
  hasLodging: null,
  lodgingPrefs: [],
  preferences: []
}

const STEP_TITLES = {
  1: 'Sobre a viagem',
  2: 'Tipo de viagem',
  3: 'Transporte',
  4: 'Hospedagem',
  5: 'Preferências'
}

// ============================================================
// Elements
// ============================================================
const form = document.getElementById('form')
const geoBtn = document.getElementById('geoBtn')
const originInput = document.getElementById('origin')
const destInput = document.getElementById('destination')
const submitBtn = document.getElementById('submitBtn')
const nextBtn = document.getElementById('nextBtn')
const prevBtn = document.getElementById('prevBtn')
const progressBar = document.getElementById('progress-bar')
const stepLabel = document.getElementById('step-label')
const stepTitle = document.getElementById('step-title')

// ============================================================
// Wizard navigation
// ============================================================
function showStep(n) {
  state.currentStep = n
  document.querySelectorAll('.step').forEach(el => {
    el.classList.toggle('hidden', Number(el.dataset.step) !== n)
  })
  progressBar.style.width = `${(n / state.totalSteps) * 100}%`
  stepLabel.textContent = `Passo ${n} de ${state.totalSteps}`
  stepTitle.textContent = STEP_TITLES[n]
  prevBtn.disabled = n === 1
  nextBtn.classList.toggle('hidden', n === state.totalSteps)
  submitBtn.classList.toggle('hidden', n !== state.totalSteps)
  form.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function validateStep(n) {
  if (n === 1) {
    const destination = destInput.value.trim()
    const days = Number(document.getElementById('days').value)
    const travelers = Number(document.getElementById('travelers').value)
    const budget = Number(document.getElementById('budget').value)
    if (!destination) return flash(destInput)
    if (!days || days < 1) return flash(document.getElementById('days'))
    if (!travelers || travelers < 1) return flash(document.getElementById('travelers'))
    if (!budget || budget < 1) return flash(document.getElementById('budget'))
    return true
  }
  if (n === 2 && !state.tripType) return alert('Selecione o tipo de viagem')
  if (n === 3 && !state.transport) return alert('Selecione como vai se locomover')
  if (n === 4 && !state.hasLodging) return alert('Responda sobre a hospedagem')
  return true
}

function flash(el) {
  el.style.borderColor = '#ef4444'
  el.focus()
  setTimeout(() => { el.style.borderColor = '' }, 2000)
  return false
}

nextBtn.addEventListener('click', () => {
  if (validateStep(state.currentStep) !== true) return
  if (state.currentStep < state.totalSteps) showStep(state.currentStep + 1)
})

prevBtn.addEventListener('click', () => {
  if (state.currentStep > 1) showStep(state.currentStep - 1)
})

// ============================================================
// Chip selectors (single-select for trip type, transport, lodging)
// ============================================================
function setupSingleSelect(gridId, stateKey, onChange) {
  const grid = document.getElementById(gridId)
  if (!grid) return
  grid.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('button').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      state[stateKey] = btn.dataset.value
      if (onChange) onChange(btn.dataset.value)
    })
  })
}

setupSingleSelect('trip-type-grid', 'tripType')
setupSingleSelect('transport-grid', 'transport')
setupSingleSelect('lodging-grid', 'hasLodging', (value) => {
  const prefs = document.getElementById('lodging-prefs')
  prefs.classList.toggle('hidden', value !== 'Não')
  prefs.classList.toggle('flex', value === 'Não')
})

// ============================================================
// Multi-select chips (lodging prefs and personal prefs)
// ============================================================
function setupMultiSelect(containerId, stateKey, attr) {
  const container = document.getElementById(containerId)
  if (!container) return
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = btn.dataset[attr]
      const isSelected = btn.classList.toggle('selected')
      if (isSelected) {
        if (!state[stateKey].includes(value)) state[stateKey].push(value)
      } else {
        state[stateKey] = state[stateKey].filter(v => v !== value)
      }
    })
  })
}

setupMultiSelect('lodging-prefs', 'lodgingPrefs', 'pref')
setupMultiSelect('prefs-grid', 'preferences', 'pref')

// ============================================================
// City autocomplete
// ============================================================
function setupAutocomplete(input, onSelect) {
  let dropdown = null
  let timer = null
  const wrapper = input.parentElement
  wrapper.style.position = 'relative'

  input.addEventListener('input', () => {
    onSelect(false)
    clearTimeout(timer)
    const q = input.value.trim()
    if (q.length < 2) { removeDropdown(); return }
    showLoading()
    timer = setTimeout(() => fetchAndShow(q), 350)
  })

  input.addEventListener('focus', () => {
    const q = input.value.trim()
    if (q.length >= 2) fetchAndShow(q)
  })

  async function fetchAndShow(q) {
    try {
      const res = await fetch(`/api/cities?q=${encodeURIComponent(q)}`)
      const cities = await res.json()
      showDropdown(cities)
    } catch (err) {
      console.error('Autocomplete error:', err)
      removeDropdown()
    }
  }

  function createContainer() {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'absolute', top: 'calc(100% + 6px)', left: '0', right: '0',
      background: '#0f172a', border: '1px solid #334155', borderRadius: '14px',
      zIndex: '50', overflow: 'hidden', maxHeight: '280px', overflowY: 'auto',
      boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
    })
    return el
  }

  function showLoading() {
    removeDropdown()
    dropdown = createContainer()
    const item = document.createElement('div')
    item.textContent = 'Buscando...'
    Object.assign(item.style, { padding: '14px 18px', color: '#64748b', fontSize: '14px', fontStyle: 'italic' })
    dropdown.appendChild(item)
    wrapper.appendChild(dropdown)
  }

  function showDropdown(cities) {
    removeDropdown()
    if (!cities.length) {
      dropdown = createContainer()
      const item = document.createElement('div')
      item.textContent = 'Nenhuma cidade encontrada'
      Object.assign(item.style, { padding: '14px 18px', color: '#64748b', fontSize: '14px' })
      dropdown.appendChild(item)
      wrapper.appendChild(dropdown)
      return
    }
    dropdown = createContainer()
    cities.forEach((city, idx) => {
      const [cityName, country] = city.name.split(', ')
      const item = document.createElement('div')
      Object.assign(item.style, {
        padding: '14px 18px', cursor: 'pointer', color: '#e2e8f0', fontSize: '14px',
        borderBottom: idx < cities.length - 1 ? '1px solid #1e293b' : 'none',
        display: 'flex', flexDirection: 'column', gap: '2px'
      })
      item.innerHTML = `
        <span style="font-weight:500;color:#f1f5f9">${cityName}</span>
        ${country ? `<span style="font-size:12px;color:#64748b">${country}</span>` : ''}
      `
      item.addEventListener('mouseenter', () => item.style.background = '#1e293b')
      item.addEventListener('mouseleave', () => item.style.background = '')
      item.addEventListener('mousedown', (e) => {
        e.preventDefault()
        input.value = city.name
        input.style.borderColor = '#22c55e'
        onSelect(true)
        removeDropdown()
      })
      dropdown.appendChild(item)
    })
    wrapper.appendChild(dropdown)
  }

  function removeDropdown() {
    dropdown?.remove()
    dropdown = null
  }

  document.addEventListener('mousedown', (e) => {
    if (!dropdown) return
    if (input.contains(e.target) || dropdown.contains(e.target)) return
    removeDropdown()
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') removeDropdown()
  })
}

setupAutocomplete(originInput, () => {})
setupAutocomplete(destInput, () => {})

// ============================================================
// Geolocation
// ============================================================
geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return
  geoBtn.textContent = 'Buscando...'
  geoBtn.disabled = true
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
          { headers: { 'Accept-Language': 'pt-BR' } }
        )
        const data = await res.json()
        const city = data.address.city || data.address.town || data.address.county || ''
        const country = data.address.country || ''
        originInput.value = [city, country].filter(Boolean).join(', ')
        originInput.style.borderColor = '#22c55e'
      } catch (err) { console.error(err) }
      finally {
        geoBtn.textContent = 'Usar localização'
        geoBtn.disabled = false
      }
    },
    () => {
      geoBtn.textContent = 'Usar localização'
      geoBtn.disabled = false
    }
  )
})

// ============================================================
// Submit
// ============================================================
submitBtn.addEventListener('click', async () => {
  try {
    const origin = originInput.value.trim()
    const destination = destInput.value.trim()
    const days = Number(document.getElementById('days').value)
    const travelers = Number(document.getElementById('travelers').value) || 1
    const budget = Number(document.getElementById('budget').value)
    const travelDate = document.getElementById('travelDate').value
    const lodgingArea = document.getElementById('lodgingArea').value.trim()

    const result = document.getElementById('result')
    result.classList.remove('hidden')
    showLoadingResult()
    result.scrollIntoView({ behavior: 'smooth' })

    const res = await fetch('/api/planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin, destination, days, travelers, budget,
        travelDate, lodgingArea,
        tripType: state.tripType,
        transport: state.transport,
        hasLodging: state.hasLodging,
        lodgingPrefs: state.lodgingPrefs,
        preferences: state.preferences
      })
    })

    if (!res.ok) throw new Error(`Servidor retornou ${res.status}`)
    const data = await res.json()
    renderResult(data, origin)
    result.scrollIntoView({ behavior: 'smooth' })
  } catch (err) {
    console.error('Erro:', err)
    showError(err.message)
  }
})

const LOADING_MESSAGES = [
  'Consultando os melhores lugares do destino',
  'Buscando atrações reais e seus horários',
  'Selecionando restaurantes autênticos',
  'Calculando rotas e tempos de deslocamento',
  'Verificando hospedagens disponíveis',
  'Estimando custos realistas',
  'Adicionando dicas práticas para cada local',
  'Buscando fotos reais dos lugares',
  'Organizando o cronograma do dia',
  'Quase pronto! Finalizando seu roteiro'
]

let loadingIntervalId = null

function showLoadingResult() {
  stopLoading()
  let idx = 0

  document.getElementById('result-header').innerHTML = `
    <div style="padding:80px 24px 60px;text-align:center;max-width:480px;margin:0 auto">
      <div style="position:relative;width:88px;height:88px;margin:0 auto 32px">
        <div style="position:absolute;inset:0;border:3px solid #1e293b;border-radius:50%"></div>
        <div style="position:absolute;inset:0;border:3px solid transparent;border-top-color:#f97316;border-right-color:#f97316;border-radius:50%;animation:spin 1.2s linear infinite"></div>
        <div style="position:absolute;inset:14px;border:3px solid transparent;border-top-color:#fb923c;border-radius:50%;animation:spin 1.8s linear infinite reverse;opacity:0.6"></div>
        <div style="position:absolute;inset:28px;background:#f97316;border-radius:50%;opacity:0.2"></div>
      </div>

      <p id="loading-message" key="0" style="color:#f1f5f9;font-size:16px;font-weight:500;min-height:24px;animation:fade-in 0.4s ease-out">
        ${LOADING_MESSAGES[0]}
      </p>

      <div style="margin-top:14px;display:flex;justify-content:center;gap:6px">
        <span style="width:7px;height:7px;background:#f97316;border-radius:50%;animation:pulse-dot 1.4s infinite ease-in-out"></span>
        <span style="width:7px;height:7px;background:#f97316;border-radius:50%;animation:pulse-dot 1.4s infinite ease-in-out 0.2s"></span>
        <span style="width:7px;height:7px;background:#f97316;border-radius:50%;animation:pulse-dot 1.4s infinite ease-in-out 0.4s"></span>
      </div>

      <p style="color:#64748b;font-size:12px;margin-top:24px">
        A IA está montando seu roteiro. Isso pode levar até 30 segundos.
      </p>
    </div>
  `

  loadingIntervalId = setInterval(() => {
    idx = (idx + 1) % LOADING_MESSAGES.length
    const el = document.getElementById('loading-message')
    if (!el) return
    el.style.animation = 'none'
    void el.offsetWidth
    el.textContent = LOADING_MESSAGES[idx]
    el.style.animation = 'fade-in 0.4s ease-out'
  }, 2500)

  document.getElementById('result-budget').innerHTML = ''
  document.getElementById('result-lodging').innerHTML = ''
  document.getElementById('result-grid').innerHTML = ''
  document.getElementById('result-restaurants').innerHTML = ''
  document.getElementById('result-summary').innerHTML = ''
}

function stopLoading() {
  if (loadingIntervalId) {
    clearInterval(loadingIntervalId)
    loadingIntervalId = null
  }
}

function showError(msg) {
  stopLoading()
  document.getElementById('result-header').innerHTML = `<p class="text-red-400 text-center py-10">Erro: ${msg}</p>`
}

// ============================================================
// Render result
// ============================================================
function renderResult(data, origin) {
  stopLoading()
  state.lastRoteiro = { ...data, origin }
  const { destination, days, travelers, budget, tripType, transport, style, itinerary, budgetBreakdown, totalCost, lodging, restaurants } = data
  const styleLabel = { eco: 'Econômico', mid: 'Conforto médio', luxury: 'Luxo' }[style]
  const peopleLabel = travelers === 1 ? '1 pessoa' : `${travelers} pessoas`
  const overBudget = totalCost > budget
  const diff = Math.abs(totalCost - budget)

  // Header
  document.getElementById('result-header').innerHTML = `
    <span class="text-orange-500 text-xs font-semibold uppercase tracking-widest">Seu roteiro</span>
    <h2 class="text-4xl font-bold mt-2">${destination}</h2>
    <p class="text-slate-400 mt-3 text-base">
      ${origin ? `Saindo de <strong class="text-white">${origin}</strong> &middot; ` : ''}
      ${days} dias &middot; ${peopleLabel} &middot; ${tripType}
    </p>
    <p class="text-slate-500 text-sm mt-1">Estilo: ${styleLabel} &middot; ${transport}</p>
  `

  // Budget breakdown — agora com matemática detalhada
  document.getElementById('result-budget').innerHTML = `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-7">
      <div class="flex items-start justify-between mb-2">
        <div>
          <span class="text-orange-500 text-xs font-semibold uppercase tracking-widest">Estimativa realista</span>
          <h3 class="text-2xl font-bold mt-1">Quanto sua viagem vai custar</h3>
        </div>
        <div class="text-right">
          <p class="text-3xl font-bold ${overBudget ? 'text-red-400' : 'text-green-400'}">R$ ${totalCost.toLocaleString('pt-BR')}</p>
          <p class="text-xs text-slate-500 mt-1">Orçamento: R$ ${budget.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <div class="bg-${overBudget ? 'red' : 'green'}-500/10 border border-${overBudget ? 'red' : 'green'}-500/20 rounded-xl px-4 py-3 my-5 text-sm">
        ${overBudget
          ? `<span class="text-red-300"><strong>R$ ${diff.toLocaleString('pt-BR')} acima</strong> do seu orçamento. Considere reduzir dias, mudar o estilo, ou aumentar o orçamento.</span>`
          : `<span class="text-green-300"><strong>R$ ${diff.toLocaleString('pt-BR')} disponíveis</strong> dentro do seu orçamento — você tem folga.</span>`}
      </div>

      <div class="flex flex-col gap-5">
        ${budgetBreakdown.map(b => {
          const pct = Math.round((b.amount / totalCost) * 100)
          return `
            <div class="border-b border-slate-800 pb-5 last:border-b-0 last:pb-0">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <p class="text-slate-200 font-semibold">${b.category}</p>
                  <p class="text-slate-500 text-xs mt-0.5">${b.detail}</p>
                </div>
                <div class="text-right shrink-0 ml-4">
                  <p class="text-white font-bold">R$ ${b.amount.toLocaleString('pt-BR')}</p>
                  <p class="text-slate-600 text-xs">${pct}% do total</p>
                </div>
              </div>
              <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                <div class="h-full bg-orange-500/70 rounded-full" style="width: ${pct}%"></div>
              </div>
              <div class="bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 mt-2">
                <p class="text-slate-400 text-xs font-mono">
                  <span class="text-slate-600">Cálculo:</span> ${b.math}
                </p>
              </div>
            </div>
          `
        }).join('')}
      </div>
    </div>
  `

  // Lodging suggestions
  if (lodging && lodging.length > 0) {
    document.getElementById('result-lodging').innerHTML = `
      <div>
        <div class="flex items-end justify-between mb-5">
          <div>
            <span class="text-orange-500 text-xs font-semibold uppercase tracking-widest">Hospedagem</span>
            <h3 class="text-2xl font-bold mt-1">Onde ficar em ${destination.split(',')[0]}</h3>
          </div>
          <span class="text-xs text-slate-600">3 opções selecionadas</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          ${lodging.map(l => `
            <a href="${l.bookingUrl || '#'}" target="_blank" rel="noopener noreferrer"
              class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-orange-500/50 transition-colors block group">
              <div class="relative h-40" style="background:linear-gradient(135deg,#1e293b,#0f172a)">
                <img src="${l.imageUrl}" alt="${l.name}" class="w-full h-full object-cover" loading="lazy"
                  onerror="this.onerror=null;this.src='https://picsum.photos/seed/lodging${Math.random()}/600/400'">
                ${l.imageIsReal === false ? `<div class="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur text-slate-400 text-[10px] px-2 py-1 rounded-full">Foto ilustrativa</div>` : ''}
              </div>
              <div class="p-5">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-orange-400 font-semibold">${l.tag.toUpperCase()}</span>
                  <span class="text-xs text-slate-500">★ ${l.rating}</span>
                </div>
                <h4 class="font-semibold mb-1 leading-snug group-hover:text-orange-400 transition-colors">${l.name}</h4>
                <p class="text-slate-500 text-xs mb-1">${l.type}</p>
                ${l.neighborhood ? `<p class="text-slate-400 text-xs mb-1">${l.neighborhood}</p>` : ''}
                ${l.address ? `<p class="text-slate-600 text-xs mb-3 flex items-start gap-1.5">
                  <span class="text-orange-500/70 mt-0.5">◉</span>
                  <span>${l.address}</span>
                </p>` : '<div class="mb-3"></div>'}
                <div class="flex items-center justify-between pt-3 border-t border-slate-800">
                  <span class="text-orange-400 font-semibold">${l.price}</span>
                  <span class="text-slate-500 text-xs">Ver no Booking →</span>
                </div>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
    `
  }

  // Itinerary — cronograma detalhado por dia
  document.getElementById('result-grid').className = 'flex flex-col gap-6 mb-10'
  document.getElementById('result-grid').innerHTML = `
    <div class="mb-2 flex items-end justify-between gap-4 flex-wrap">
      <div>
        <span class="text-orange-500 text-xs font-semibold uppercase tracking-widest">Roteiro detalhado</span>
        <h3 class="text-2xl font-bold mt-1">${days} dias planejados</h3>
        <p class="text-slate-500 text-sm mt-1">Cronograma com horários e gastos estimados em ${destination.split(',')[0]}</p>
      </div>
      <button id="export-calendar"
        class="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-orange-500 transition-colors text-white text-sm font-medium px-4 py-2.5 rounded-xl flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        Adicionar à minha agenda
      </button>
    </div>
    ${itinerary.map((day) => `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <!-- Cover image -->
        <div class="relative h-56" style="background:linear-gradient(135deg,#1e293b,#0f172a)">
          <img src="${day.imageUrl}" alt="${day.theme || 'Dia ' + day.day}" class="w-full h-full object-cover" loading="lazy"
            onerror="this.onerror=null;this.src='https://picsum.photos/seed/day${day.day}/1200/450'">
          <div class="absolute top-4 left-4 bg-slate-950/80 backdrop-blur text-orange-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
            Dia ${day.day}
          </div>
          ${day.imageIsReal === false ? `<div class="absolute top-4 right-4 bg-slate-950/80 backdrop-blur text-slate-400 text-[10px] px-2 py-1 rounded-full">Foto ilustrativa</div>` : ''}
        </div>

        <!-- Day header -->
        <div class="px-5 sm:px-6 pt-5 sm:pt-6 pb-5 border-b border-slate-800">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div class="flex-1 min-w-0">
              <h4 class="text-xl sm:text-2xl font-bold leading-tight">${day.theme || 'Dia ' + day.day}</h4>
              <p class="text-slate-500 text-sm mt-2">${(day.activities || []).length} ${(day.activities || []).length === 1 ? 'atividade' : 'atividades'} programadas</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-slate-500 text-xs uppercase tracking-wider">Estimativa</p>
              <p class="text-orange-400 font-bold text-lg sm:text-xl mt-1">R$ ${day.dailyCost.toLocaleString('pt-BR')}</p>
              ${travelers > 1 ? `<p class="text-slate-600 text-xs">R$ ${day.dailyCostPerPerson.toLocaleString('pt-BR')}/pessoa</p>` : ''}
            </div>
          </div>
        </div>

        <!-- Timeline -->
        <div class="p-5 sm:p-6 flex flex-col gap-5">
          ${(day.activities || []).map((act, ai) => `
            <div class="flex gap-4">
              <div class="flex flex-col items-center shrink-0">
                <div class="bg-orange-500/10 border border-orange-500/30 rounded-lg px-2.5 py-1.5 text-orange-400 text-xs font-mono font-semibold">${act.time}</div>
                ${ai < day.activities.length - 1 ? '<div class="w-px flex-1 bg-slate-800 mt-2 min-h-[2rem]"></div>' : ''}
              </div>
              <div class="flex-1 pb-2">
                <div class="flex items-start justify-between gap-3 mb-1">
                  <div>
                    <span class="text-slate-500 text-xs uppercase tracking-wider">${act.period}${act.duration ? ` &middot; ${act.duration}` : ''}</span>
                    <h5 class="font-semibold mt-0.5">
                      ${act.mapsUrl
                        ? `<a href="${act.mapsUrl}" target="_blank" rel="noopener noreferrer" class="hover:text-orange-400 transition-colors inline-flex items-center gap-1.5">
                            ${act.title}
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-600">
                              <path d="M7 17L17 7"></path><path d="M7 7h10v10"></path>
                            </svg>
                          </a>`
                        : act.title}
                    </h5>
                  </div>
                  <span class="text-slate-400 text-sm shrink-0">R$ ${act.cost.toLocaleString('pt-BR')}</span>
                </div>
                ${act.location ? `<p class="text-slate-500 text-xs mb-2 flex items-start gap-1.5">
                  <span class="text-orange-500">◉</span>
                  <span>${act.location}</span>
                </p>` : ''}
                <p class="text-slate-400 text-sm leading-relaxed">${act.description}</p>
                ${act.tips ? `<div class="mt-2 bg-orange-500/5 border border-orange-500/20 rounded-lg p-2.5">
                  <p class="text-xs font-semibold text-orange-400 mb-0.5">DICA</p>
                  <p class="text-slate-300 text-xs leading-relaxed">${act.tips}</p>
                </div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}
  `

  // Restaurants
  document.getElementById('result-restaurants').innerHTML = `
    <div>
      <div class="flex items-end justify-between mb-5">
        <div>
          <span class="text-orange-500 text-xs font-semibold uppercase tracking-widest">Gastronomia</span>
          <h3 class="text-2xl font-bold mt-1">Onde comer</h3>
        </div>
        <span class="text-xs text-slate-600">Recomendado para você</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        ${restaurants.map(r => `
          <a href="${r.mapsUrl || '#'}" target="_blank" rel="noopener noreferrer"
            class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-orange-500/50 transition-colors block group">
            <div class="relative h-40" style="background:linear-gradient(135deg,#1e293b,#0f172a)">
              <img src="${r.imageUrl}" alt="${r.name}" class="w-full h-full object-cover" loading="lazy"
                onerror="this.onerror=null;this.src='https://picsum.photos/seed/food${Math.random()}/600/400'">
              ${r.imageIsReal === false ? `<div class="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur text-slate-400 text-[10px] px-2 py-1 rounded-full">Foto ilustrativa</div>` : ''}
            </div>
            <div class="p-5">
              <span class="text-xs text-orange-400 font-semibold">${r.tag.toUpperCase()}</span>
              <h4 class="font-semibold mt-1 mb-1 leading-snug group-hover:text-orange-400 transition-colors">${r.name}</h4>
              <p class="text-slate-500 text-xs">${r.cuisine} &middot; <span class="text-slate-400">${r.price}</span></p>
              ${r.neighborhood ? `<p class="text-slate-400 text-xs mt-1">${r.neighborhood}</p>` : ''}
              ${r.address ? `<p class="text-slate-600 text-xs mt-1 flex items-start gap-1.5">
                <span class="text-orange-500/70 mt-0.5">◉</span>
                <span>${r.address}</span>
              </p>` : ''}
              <p class="text-slate-500 text-xs mt-3 pt-3 border-t border-slate-800">Ver no Google Maps →</p>
            </div>
          </a>
        `).join('')}
      </div>
    </div>
  `

  // Affiliate partners — mocks realistas
  const originCity = origin ? origin.split(',')[0] : 'sua cidade'
  const destCity = destination.split(',')[0]
  document.getElementById('result-summary').innerHTML = `
    <div>
      <div class="mb-6">
        <span class="text-orange-500 text-xs font-semibold uppercase tracking-widest">Reserve sua viagem</span>
        <h3 class="text-2xl font-bold mt-1">Complete o planejamento</h3>
        <p class="text-slate-500 text-sm mt-1">Comparações ao vivo de nossos parceiros</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a href="#" class="bg-slate-900 hover:border-orange-500/50 border border-slate-800 rounded-2xl p-5 transition-colors flex gap-4 items-center">
          <div class="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-2xl shrink-0">✈</div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-slate-500 mb-0.5">PASSAGEM AÉREA</p>
            <p class="font-semibold truncate">${originCity} → ${destCity}</p>
            <p class="text-sm text-orange-400 mt-1">A partir de R$ ${Math.round((1000 + days * 200) * travelers).toLocaleString('pt-BR')}</p>
            <p class="text-xs text-slate-600 mt-0.5">LATAM, GOL, Azul · ida e volta para ${travelers}</p>
          </div>
          <span class="text-slate-600 shrink-0">→</span>
        </a>

        <a href="#" class="bg-slate-900 hover:border-orange-500/50 border border-slate-800 rounded-2xl p-5 transition-colors flex gap-4 items-center">
          <div class="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-2xl shrink-0">⌂</div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-slate-500 mb-0.5">HOSPEDAGEM</p>
            <p class="font-semibold truncate">Hotéis e Airbnb em ${destCity}</p>
            <p class="text-sm text-orange-400 mt-1">${(lodging && lodging.length) ? lodging[0].price : 'A partir de R$ 220/noite'}</p>
            <p class="text-xs text-slate-600 mt-0.5">Booking.com, Airbnb, Hoteis.com</p>
          </div>
          <span class="text-slate-600 shrink-0">→</span>
        </a>

        <a href="#" class="bg-slate-900 hover:border-orange-500/50 border border-slate-800 rounded-2xl p-5 transition-colors flex gap-4 items-center">
          <div class="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-2xl shrink-0">⌬</div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-slate-500 mb-0.5">ALUGUEL DE CARRO</p>
            <p class="font-semibold truncate">VW T-Cross ou similar</p>
            <p class="text-sm text-orange-400 mt-1">R$ 180/dia (${days} dias = R$ ${(180 * days).toLocaleString('pt-BR')})</p>
            <p class="text-xs text-slate-600 mt-0.5">Localiza, Movida, Unidas</p>
          </div>
          <span class="text-slate-600 shrink-0">→</span>
        </a>

        <a href="#" class="bg-slate-900 hover:border-orange-500/50 border border-slate-800 rounded-2xl p-5 transition-colors flex gap-4 items-center">
          <div class="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-2xl shrink-0">⛨</div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-slate-500 mb-0.5">SEGURO VIAGEM</p>
            <p class="font-semibold truncate">Cobertura completa ${destCity}</p>
            <p class="text-sm text-orange-400 mt-1">R$ ${Math.round(15 * days * travelers).toLocaleString('pt-BR')} (${days} dias)</p>
            <p class="text-xs text-slate-600 mt-0.5">World Nomads, Assist Card, SegurosPromo</p>
          </div>
          <span class="text-slate-600 shrink-0">→</span>
        </a>
      </div>
    </div>
  `

  // Calendar export button
  const exportBtn = document.getElementById('export-calendar')
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const original = exportBtn.innerHTML
      try {
        exportBtn.disabled = true
        exportBtn.textContent = 'Gerando agenda...'
        const res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination: data.destination,
            travelDate: document.getElementById('travelDate').value || null,
            itinerary: data.itinerary
          })
        })
        if (!res.ok) throw new Error('Erro')
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `roteiro-${data.destination.split(',')[0].replace(/\s+/g, '-')}.ics`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        exportBtn.innerHTML = '✓ Arquivo baixado'
        setTimeout(() => {
          exportBtn.innerHTML = original
          exportBtn.disabled = false
        }, 2500)
      } catch (err) {
        exportBtn.innerHTML = 'Erro — tente novamente'
        setTimeout(() => {
          exportBtn.innerHTML = original
          exportBtn.disabled = false
        }, 2500)
      }
    })
  }
}

// ============================================================
// Reviews
// ============================================================
const DEFAULT_REVIEWS = [
  { name: 'Mariana Costa', initial: 'M', rating: 5, comment: 'Planejei minha viagem pra Lisboa em 5 minutos. Roteiro veio com tudo, até sugestão de restaurantes.', date: null },
  { name: 'Rafael Mendes', initial: 'R', rating: 5, comment: 'Economizei muito tempo. O breakdown de orçamento me ajudou a planejar sem extrapolar.', date: null },
  { name: 'Juliana Almeida', initial: 'J', rating: 5, comment: 'Viagem em família com 3 crianças virou um sonho. Tudo organizado e dentro do orçamento.', date: null }
]

async function loadReviews() {
  let userReviews = []
  try {
    const res = await fetch('/api/reviews')
    if (res.ok) userReviews = await res.json()
  } catch (err) { console.error(err) }
  const all = [...userReviews, ...DEFAULT_REVIEWS].slice(0, 6)
  const grid = document.getElementById('reviews-grid')
  if (!grid) return
  grid.innerHTML = all.map(r => `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div class="text-orange-500 mb-3">${'★'.repeat(r.rating || 5)}<span class="text-slate-700">${'★'.repeat(5 - (r.rating || 5))}</span></div>
      <p class="text-slate-300 text-sm leading-relaxed mb-4">"${r.comment}"</p>
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-semibold">${r.initial || r.name.charAt(0)}</div>
        <div>
          <p class="font-medium text-sm">${r.name}</p>
          <p class="text-slate-500 text-xs">${r.date ? new Date(r.date).toLocaleDateString('pt-BR') : 'Recomenda'}</p>
        </div>
      </div>
    </div>
  `).join('')
}

// Star rating
let selectedRating = 0
const stars = document.querySelectorAll('#rating-stars span')
stars.forEach(star => {
  star.addEventListener('click', () => {
    selectedRating = Number(star.dataset.rating)
    stars.forEach((s, i) => {
      s.style.color = i < selectedRating ? '#f97316' : '#334155'
    })
  })
  star.addEventListener('mouseenter', () => {
    const hovered = Number(star.dataset.rating)
    stars.forEach((s, i) => {
      s.style.color = i < hovered ? '#fb923c' : '#334155'
    })
  })
})
document.getElementById('rating-stars')?.addEventListener('mouseleave', () => {
  stars.forEach((s, i) => {
    s.style.color = i < selectedRating ? '#f97316' : '#334155'
  })
})

// Char count
const commentEl = document.getElementById('review-comment')
commentEl?.addEventListener('input', () => {
  document.getElementById('review-char-count').textContent = commentEl.value.length
})

// Review submit
document.getElementById('review-form')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const name = document.getElementById('review-name').value.trim()
  const comment = document.getElementById('review-comment').value.trim()
  const feedback = document.getElementById('review-feedback')
  feedback.classList.remove('hidden', 'text-red-400', 'text-green-400')

  if (!name || !selectedRating || !comment) {
    feedback.textContent = 'Preencha nome, nota e comentário'
    feedback.classList.add('text-red-400')
    return
  }

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rating: selectedRating, comment })
    })
    if (!res.ok) throw new Error('Erro ao enviar')
    feedback.textContent = 'Avaliação enviada! Obrigado.'
    feedback.classList.add('text-green-400')
    document.getElementById('review-name').value = ''
    document.getElementById('review-comment').value = ''
    document.getElementById('review-char-count').textContent = '0'
    selectedRating = 0
    stars.forEach(s => s.style.color = '#334155')
    loadReviews()
  } catch (err) {
    feedback.textContent = 'Erro ao enviar. Tente novamente.'
    feedback.classList.add('text-red-400')
  }
})

loadReviews()

// ============================================================
// Chat assistant
// ============================================================
const chatToggle = document.getElementById('chat-toggle')
const chatPanel = document.getElementById('chat-panel')
const chatIconOpen = document.getElementById('chat-icon-open')
const chatIconClose = document.getElementById('chat-icon-close')
const chatForm = document.getElementById('chat-form')
const chatInput = document.getElementById('chat-input')
const chatSend = document.getElementById('chat-send')
const chatMessages = document.getElementById('chat-messages')

const chatHistory = []

function toggleChat() {
  const opening = chatPanel.classList.contains('hidden')
  chatPanel.classList.toggle('hidden', !opening)
  chatPanel.classList.toggle('flex', opening)
  chatIconOpen.classList.toggle('hidden', opening)
  chatIconClose.classList.toggle('hidden', !opening)
  if (opening) setTimeout(() => chatInput.focus(), 100)
}

chatToggle.addEventListener('click', toggleChat)

function appendChatMessage(role, text) {
  const wrapper = document.createElement('div')
  wrapper.className = role === 'user' ? 'flex justify-end' : 'flex justify-start'
  const bubble = document.createElement('div')
  bubble.className = role === 'user'
    ? 'bg-orange-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap'
    : 'bg-slate-800 text-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap'
  bubble.textContent = text
  wrapper.appendChild(bubble)
  chatMessages.appendChild(wrapper)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function showTyping() {
  const wrapper = document.createElement('div')
  wrapper.className = 'flex justify-start'
  wrapper.id = 'chat-typing'
  wrapper.innerHTML = `
    <div class="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
      <span style="width:6px;height:6px;background:#94a3b8;border-radius:50%;animation:typing 1.4s infinite"></span>
      <span style="width:6px;height:6px;background:#94a3b8;border-radius:50%;animation:typing 1.4s infinite;animation-delay:0.2s"></span>
      <span style="width:6px;height:6px;background:#94a3b8;border-radius:50%;animation:typing 1.4s infinite;animation-delay:0.4s"></span>
    </div>
  `
  chatMessages.appendChild(wrapper)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function removeTyping() {
  document.getElementById('chat-typing')?.remove()
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const message = chatInput.value.trim()
  if (!message) return

  appendChatMessage('user', message)
  chatHistory.push({ role: 'user', content: message })
  chatInput.value = ''
  chatInput.disabled = true
  chatSend.disabled = true
  showTyping()

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: chatHistory,
        context: state.lastRoteiro || null
      })
    })

    removeTyping()

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      appendChatMessage('assistant', errData.error || 'Não consegui responder agora. Tente novamente.')
      return
    }

    const data = await res.json()
    appendChatMessage('assistant', data.reply)
    chatHistory.push({ role: 'model', content: data.reply })
  } catch (err) {
    removeTyping()
    appendChatMessage('assistant', 'Erro de conexão. Verifique sua internet.')
  } finally {
    chatInput.disabled = false
    chatSend.disabled = false
    chatInput.focus()
  }
})

// Initialize
showStep(1)
