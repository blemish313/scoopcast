
// Tiny helper: debounce
function debounce(fn, wait=200){let t; return (...args)=>{clearTimeout(t); t=setTimeout(()=>fn(...args), wait)}}

// Load data.json, then render
const state = {
  data: [],
  q: '',
  sort: 'relevance'
};

const qEl = document.getElementById('q');
const resultsEl = document.getElementById('results');
const statsEl = document.getElementById('stats');
const sortEl = document.getElementById('sort');

fetch('data.json')
  .then(r=>r.json())
  .then(json=>{
    state.data = json;
    render();
  });

qEl.addEventListener('input', debounce(()=>{
  state.q = qEl.value.trim();
  render();
}, 150));

sortEl.addEventListener('change', ()=>{
  state.sort = sortEl.value;
  render();
});

function render(){
  const { items, matches, totalTs } = search(state.data, state.q);
  const sorted = sort(items, state.sort, state.q);
  statsEl.textContent = state.q
    ? `Showing ${sorted.length} of ${state.data.length} episodes • ${matches} matches in ${totalTs} timestamps`
    : `Episodes: ${state.data.length} • Timestamps: ${totalTs}`;
  resultsEl.innerHTML = '';
  for(const ep of sorted){
    resultsEl.appendChild(renderCard(ep, state.q));
  }
}

function sort(items, mode, q){
  const copy = [...items];
  if(mode==='newest'){
    copy.sort((a,b)=> new Date(b.date) - new Date(a.date));
  }else if(mode==='oldest'){
    copy.sort((a,b)=> new Date(a.date) - new Date(b.date));
  }else{ // relevance
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    copy.sort((a,b)=> score(b, words) - score(a, words));
  }
  return copy;
}

function score(ep, words){
  if(!words.length) return 0;
  const title = ep.title.toLowerCase();
  let s = 0;
  for(const w of words){
    if(title.includes(w)) s += 5;
    for(const t of ep.timestamps) if(t.topic.toLowerCase().includes(w)) s += 1;
  }
  return s;
}

function search(data, q){
  const totalTs = data.reduce((n,e)=>n+(e.timestamps?.length||0), 0);
  if(!q) return { items: data, matches: 0, totalTs };

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const items = [];
  let matches = 0;

  for(const ep of data){
    const title = ep.title.toLowerCase();
    const keepByTitle = words.some(w=>title.includes(w));
    const filteredTs = [];
    for(const t of ep.timestamps || []){
      const topic = t.topic.toLowerCase();
      const hit = words.some(w=>topic.includes(w));
      if(hit) { filteredTs.push(t); matches++; }
    }
    if(keepByTitle || filteredTs.length){
      items.push({...ep, timestamps: filteredTs.length ? filteredTs : ep.timestamps});
    }
  }
  return { items, matches, totalTs };
}

// -------- Rendering --------
const cardTpl = document.getElementById('episode-card');
const tsTpl = document.getElementById('timestamp-item');

function renderCard(ep, q){
  const node = cardTpl.content.cloneNode(true);
  node.querySelector('[data-ep]').textContent = ep.episode_number;
  node.querySelector('[data-date]').textContent = new Date(ep.date).toLocaleDateString();
  node.querySelector('[data-title]').innerHTML = highlight(ep.title, q);
  node.querySelector('[data-count]').textContent = ep.timestamps?.length || 0;

  const yt = `https://www.youtube.com/watch?v=${ep.youtube_id}`;
  node.querySelector('[data-yt]').href = yt;
  node.querySelector('[data-copy]').addEventListener('click',()=>copy(yt));

  const ul = node.querySelector('[data-ts]');
  for(const t of ep.timestamps || []){
    const li = tsTpl.content.cloneNode(true);
    const url = `${yt}&t=${hmsToSeconds(t.timestamp)}s`;
    const a = li.querySelector('[data-ts-link]');
    a.href = url;
    a.innerHTML = `<strong>${t.timestamp}</strong> – ${highlight(t.topic, q)}`;
    li.querySelector('[data-copy-ts]').addEventListener('click',()=>copy(url));
    ul.appendChild(li);
  }
  return node;
}

function copy(text){
  navigator.clipboard?.writeText(text);
}

function hmsToSeconds(hms){
  const [h,m,s] = hms.split(':').map(Number);
  return (h*3600)+(m*3600?m*60:m*60)+(s||0);
}

function highlight(text, q){
  if(!q) return escape(text);
  const words = q.split(/\s+/).filter(Boolean).map(escapeRegExp);
  if(!words.length) return escape(text);
  const re = new RegExp(`(${words.join('|')})`,'ig');
  return escape(text).replace(re,'<mark>$1</mark>');
}

// Very small escape helpers
function escape(s){return s.replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}
