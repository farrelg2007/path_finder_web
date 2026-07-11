/**
 * MetroFlow v2 — Frontend Core Logic
 * Fitur Baru: Pan & Zoom Kanvas, Box Multi-Select, Mode Toolbar, Tutorial Onboarding
 */

// ============================================================
// STATE APLIKASI
// ============================================================
const state = {
    // Data Graf
    maps: [],
    currentMapId: null,
    currentMapName: 'Peta Baru',
    stations: [],       // { id, name, x, y }
    lines: [],          // { id, name, color }
    connections: [],    // { id, from_station_id, to_station_id, line_id, weight }

    // Viewport (Pan & Zoom)
    viewport: { tx: 0, ty: 0, scale: 1.0 },
    MIN_SCALE: 0.1,
    MAX_SCALE: 4.0,

    // Mode Kanvas: 'select' | 'pan' | 'connect' | 'add'
    mode: 'select',

    // Drag Node (mode: select)
    dragNode: null,        // { id, offsetX, offsetY }
    dragMoved: false,

    // Box Selection (mode: select)
    boxSelect: { active: false, startX: 0, startY: 0, curX: 0, curY: 0 },
    selectedStationIds: new Set(),

    // Multi-Node Drag (mode: select)
    multiDrag: { active: false, startMouseX: 0, startMouseY: 0, originalPositions: {} },

    // Pan (mode: pan)
    panDrag: { active: false, lastX: 0, lastY: 0 },

    // Connect Mode
    connectSourceId: null,  // ID stasiun asal untuk mode hubung

    // Pathfinding
    animationDelay: 500,
    isVisualizing: false,

    // Modal Edit
    editingStationId: null,
    editingConnectionId: null,

    // Flag: mencegah klik stasiun setelah drag
    justDragged: false,
};

// ============================================================
// REFERENSI ELEMEN DOM
// ============================================================
const svg         = document.getElementById('metro-canvas');
const viewport    = document.getElementById('viewport-group');
const nodeGroup   = document.getElementById('node-group');
const edgeGroup   = document.getElementById('edge-group');
const pathGroup   = document.getElementById('path-highlight-group');
const selBox      = document.getElementById('selection-box');

const API_URL = '/api/maps';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ============================================================
// 1. INISIALISASI
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    checkTutorial();
    initApp();
    setupCanvasEvents();
    setupSidebarEvents();
    setupModalEvents();
    setupKeyboardShortcuts();
    setMode('select');
});

async function initApp() {
    await loadMapsList();
    if (state.maps.length > 0) {
        await loadMap(state.maps[0].id);
    } else {
        createNewMapState();
    }
}

// ============================================================
// 2. TUTORIAL ONBOARDING
// ============================================================
function checkTutorial() {
    const hide = localStorage.getItem('metroflow_hide_tutorial');
    if (!hide) {
        document.getElementById('tutorial-modal').classList.remove('hidden');
    }
}

document.getElementById('btn-close-tutorial').addEventListener('click', () => {
    if (document.getElementById('tutorial-dont-show-again').checked) {
        localStorage.setItem('metroflow_hide_tutorial', '1');
    }
    document.getElementById('tutorial-modal').classList.add('hidden');
});

document.getElementById('btn-help').addEventListener('click', () => {
    document.getElementById('tutorial-modal').classList.remove('hidden');
});

// ============================================================
// 3. SISTEM MODE KANVAS
// ============================================================
function setMode(newMode) {
    state.mode = newMode;

    // Hapus state sementara mode lain
    state.connectSourceId = null;
    clearConnectSourceHighlight();
    clearBoxSelection();

    // Update CSS class pada SVG
    svg.className.baseVal = `mode-${newMode}`;

    // Update tombol toolbar aktif
    ['select', 'pan', 'connect', 'add'].forEach(m => {
        const btn = document.getElementById(`btn-mode-${m}`);
        if (btn) btn.classList.toggle('active', m === newMode);
    });

    // Update badge mode
    const badge = document.getElementById('active-mode-badge');
    const modeNames = {
        select:  '<i class="fa-solid fa-arrow-pointer"></i> Mode: Seleksi',
        pan:     '<i class="fa-solid fa-hand"></i> Mode: Geser Peta',
        connect: '<i class="fa-solid fa-link"></i> Mode: Hubung Rel',
        add:     '<i class="fa-solid fa-location-pin"></i> Mode: Tambah Stasiun',
    };
    badge.innerHTML = modeNames[newMode] || newMode;
    badge.className = `mode-badge mode-${newMode}`;
}

// ============================================================
// 4. PAN & ZOOM
// ============================================================
function applyViewport() {
    const { tx, ty, scale } = state.viewport;
    viewport.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`);
    document.getElementById('zoom-level-display').textContent = `${Math.round(scale * 100)}%`;
}

function zoomAt(cx, cy, factor) {
    const oldScale = state.viewport.scale;
    const newScale = Math.min(state.MAX_SCALE, Math.max(state.MIN_SCALE, oldScale * factor));
    if (newScale === oldScale) return;

    // Zoom ke titik (cx, cy) dalam koordinat layar
    const scaleDelta = newScale / oldScale;
    state.viewport.tx = cx - scaleDelta * (cx - state.viewport.tx);
    state.viewport.ty = cy - scaleDelta * (cy - state.viewport.ty);
    state.viewport.scale = newScale;
    applyViewport();
}

function fitToScreen() {
    if (state.stations.length === 0) {
        state.viewport = { tx: 0, ty: 0, scale: 1 };
        applyViewport();
        return;
    }
    const rect = svg.getBoundingClientRect();
    const padding = 60;
    const xs = state.stations.map(s => s.x);
    const ys = state.stations.map(s => s.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const scaleX = (rect.width - padding * 2) / contentW;
    const scaleY = (rect.height - padding * 2) / contentH;
    const scale = Math.min(scaleX, scaleY, state.MAX_SCALE);
    state.viewport.scale = scale;
    state.viewport.tx = (rect.width - contentW * scale) / 2 - minX * scale;
    state.viewport.ty = (rect.height - contentH * scale) / 2 - minY * scale;
    applyViewport();
}

// Konversi koordinat layar → koordinat dunia graf
function screenToWorld(sx, sy) {
    const { tx, ty, scale } = state.viewport;
    return { x: (sx - tx) / scale, y: (sy - ty) / scale };
}

// ============================================================
// 5. API BACKEND
// ============================================================
async function loadMapsList() {
    try {
        const res = await fetch(API_URL);
        state.maps = await res.json();
        populateMapSelector();
    } catch (e) { console.error('Gagal memuat daftar peta:', e); }
}

async function loadMap(id) {
    if (!id) return;
    try {
        clearVisualization();
        const res = await fetch(`${API_URL}/${id}`);
        const data = await res.json();

        state.currentMapId = data.map.id;
        state.currentMapName = data.map.name;
        document.getElementById('map-name-input').value = data.map.name;

        state.stations   = data.stations.map(s => ({ id: String(s.id), name: s.name, x: parseFloat(s.x), y: parseFloat(s.y) }));
        state.lines      = data.lines.map(l => ({ id: String(l.id), name: l.name, color: l.color }));
        state.connections = data.connections.map(c => ({
            id: String(c.id),
            from_station_id: String(c.from_station_id),
            to_station_id:   String(c.to_station_id),
            line_id:         String(c.line_id),
            weight:          parseFloat(c.weight)
        }));

        state.selectedLineId = state.lines.length > 0 ? state.lines[0].id : null;
        updateMapSelectorValue(id);
        renderLinesList();
        renderGraph();
        populateRouteSelectors();

        // Langsung fit ke layar saat memuat peta baru
        setTimeout(fitToScreen, 50);
    } catch (e) { console.error('Gagal memuat peta:', e); }
}

async function saveMap() {
    if (state.isVisualizing) return;
    const mapName = document.getElementById('map-name-input').value.trim() || 'Peta Tanpa Nama';
    state.currentMapName = mapName;

    const payload = { id: state.currentMapId, name: mapName, stations: state.stations, lines: state.lines, connections: state.connections };
    try {
        const res  = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await res.json();
        if (result.status === 'success') {
            const savedId = result.map_id;
            await loadMapsList();
            await loadMap(savedId);
        } else { alert('Gagal menyimpan: ' + result.message); }
    } catch (e) { alert('Kesalahan jaringan saat menyimpan.'); }
}

async function deleteMap() {
    if (!state.currentMapId) { alert('Peta belum disimpan di database.'); return; }
    if (!confirm(`Hapus peta "${state.currentMapName}"?`)) return;
    try {
        const res = await fetch(`${API_URL}/${state.currentMapId}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.status === 'success') {
            await loadMapsList();
            if (state.maps.length > 0) await loadMap(state.maps[0].id);
            else createNewMapState();
        }
    } catch (e) { console.error(e); }
}

function createNewMapState() {
    clearVisualization();
    clearBoxSelection();
    state.currentMapId = null;
    state.currentMapName = 'Peta Baru';
    document.getElementById('map-name-input').value = 'Peta Baru';
    state.stations   = [];
    state.lines      = [{ id: 'l_red', name: 'Jalur Merah', color: '#ff3366' }, { id: 'l_blue', name: 'Jalur Biru', color: '#3388ff' }];
    state.connections = [];
    state.selectedLineId = 'l_red';
    document.getElementById('map-selector').value = '';
    renderLinesList();
    renderGraph();
    populateRouteSelectors();
    state.viewport = { tx: 0, ty: 0, scale: 1 };
    applyViewport();
}

// ============================================================
// 6. RENDER GRAF
// ============================================================
function renderGraph() {
    nodeGroup.innerHTML = '';
    edgeGroup.innerHTML = '';

    // Gambar edges
    state.connections.forEach(conn => {
        const from = state.stations.find(s => s.id === conn.from_station_id);
        const to   = state.stations.find(s => s.id === conn.to_station_id);
        const line = state.lines.find(l => l.id === conn.line_id);
        if (!from || !to || !line) return;

        const el = makeSVGEl('line', {
            x1: from.x, y1: from.y, x2: to.x, y2: to.y,
            stroke: line.color, 'stroke-width': 5,
            class: 'metro-edge',
            id: `edge-${conn.id}`
        });
        el.addEventListener('click', e => { e.stopPropagation(); openConnectionModal(conn); });
        edgeGroup.appendChild(el);

        // Label bobot
        const wLabel = makeSVGEl('text', {
            x: (from.x + to.x) / 2,
            y: (from.y + to.y) / 2 - 9,
            fill: '#7a8394', 'font-family': 'JetBrains Mono', 'font-size': '10px',
            'text-anchor': 'middle', style: 'pointer-events:none;user-select:none;'
        });
        wLabel.textContent = `${conn.weight}m`;
        edgeGroup.appendChild(wLabel);
    });

    // Gambar nodes
    state.stations.forEach(s => {
        const g = makeSVGEl('g', {
            class: 'station-node hoverable draggable',
            id: `station-node-${s.id}`
        });
        if (state.selectedStationIds.has(s.id)) g.classList.add('selected');

        g.appendChild(makeSVGEl('circle', { cx: s.x, cy: s.y, r: 12, class: 'station-circle-bg' }));
        g.appendChild(makeSVGEl('circle', { cx: s.x, cy: s.y, r: 6,  class: 'station-circle-inner' }));

        const label = makeSVGEl('text', { x: s.x, y: s.y - 20, class: 'station-label' });
        label.textContent = s.name;
        g.appendChild(label);

        g.addEventListener('mousedown', e => handleNodeMouseDown(e, s.id));
        g.addEventListener('click',     e => handleNodeClick(e, s.id));
        nodeGroup.appendChild(g);
    });
}

function makeSVGEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

// ============================================================
// 7. INTERAKSI KANVAS — EVENT SETUP
// ============================================================
function setupCanvasEvents() {
    // SCROLL WHEEL → Zoom
    svg.addEventListener('wheel', e => {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        zoomAt(cx, cy, factor);
    }, { passive: false });

    // MOUSEDOWN pada kanvas kosong
    svg.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        if (e.target.closest('.station-node') || e.target.closest('.metro-edge')) return;

        const rect = svg.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        if (state.mode === 'pan') {
            // Mulai pan
            state.panDrag = { active: true, lastX: sx, lastY: sy };
            svg.classList.add('panning');
        } else if (state.mode === 'select') {
            // Mulai box select
            clearBoxSelection();
            state.boxSelect = { active: true, startX: sx, startY: sy, curX: sx, curY: sy };
            selBox.classList.remove('hidden');
        } else if (state.mode === 'connect') {
            // Klik area kosong saat connect → batalkan
            if (state.connectSourceId) {
                clearConnectSourceHighlight();
                state.connectSourceId = null;
            }
        }
    });

    // MOUSEMOVE global
    document.addEventListener('mousemove', e => {
        const rect = svg.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        // PAN
        if (state.panDrag.active) {
            state.viewport.tx += sx - state.panDrag.lastX;
            state.viewport.ty += sy - state.panDrag.lastY;
            state.panDrag.lastX = sx;
            state.panDrag.lastY = sy;
            applyViewport();
            return;
        }

        // BOX SELECT — update kotak
        if (state.boxSelect.active) {
            state.boxSelect.curX = sx;
            state.boxSelect.curY = sy;
            const bx = Math.min(state.boxSelect.startX, sx);
            const by = Math.min(state.boxSelect.startY, sy);
            const bw = Math.abs(sx - state.boxSelect.startX);
            const bh = Math.abs(sy - state.boxSelect.startY);
            selBox.setAttribute('x', bx);
            selBox.setAttribute('y', by);
            selBox.setAttribute('width', bw);
            selBox.setAttribute('height', bh);
            return;
        }

        // DRAG NODE (single atau multi)
        if (state.dragNode) {
            state.dragMoved = true;
            const world = screenToWorld(sx, sy);

            if (state.selectedStationIds.size > 1 && state.selectedStationIds.has(state.dragNode.id)) {
                // Multi-drag: geser semua node terpilih bersamaan
                if (!state.multiDrag.active) {
                    // Simpan posisi awal semua stasiun terpilih
                    state.multiDrag.active = true;
                    state.multiDrag.startMouseX = world.x;
                    state.multiDrag.startMouseY = world.y;
                    state.multiDrag.originalPositions = {};
                    state.selectedStationIds.forEach(id => {
                        const st = state.stations.find(s => s.id === id);
                        if (st) state.multiDrag.originalPositions[id] = { x: st.x, y: st.y };
                    });
                }
                const dx = world.x - state.multiDrag.startMouseX;
                const dy = world.y - state.multiDrag.startMouseY;
                state.selectedStationIds.forEach(id => {
                    const st = state.stations.find(s => s.id === id);
                    const orig = state.multiDrag.originalPositions[id];
                    if (st && orig) { st.x = orig.x + dx; st.y = orig.y + dy; }
                });
            } else {
                // Single-drag
                const st = state.stations.find(s => s.id === state.dragNode.id);
                if (st) {
                    st.x = world.x - state.dragNode.offsetX;
                    st.y = world.y - state.dragNode.offsetY;
                }
            }
            renderGraph();
            return;
        }

        // CONNECT MODE — preview garis sementara
        if (state.mode === 'connect' && state.connectSourceId) {
            const src = state.stations.find(s => s.id === state.connectSourceId);
            let preview = document.getElementById('connection-preview');
            if (!preview) {
                preview = makeSVGEl('line', { id: 'connection-preview', stroke: '#ffffff', 'stroke-dasharray': '6,4', 'stroke-width': 2.5, 'pointer-events': 'none' });
                svg.appendChild(preview);
            }
            const world = screenToWorld(sx, sy);
            if (src) {
                const wx = src.x * state.viewport.scale + state.viewport.tx;
                const wy = src.y * state.viewport.scale + state.viewport.ty;
                preview.setAttribute('x1', wx);
                preview.setAttribute('y1', wy);
                preview.setAttribute('x2', sx);
                preview.setAttribute('y2', sy);
            }
        }
    });

    // MOUSEUP global
    document.addEventListener('mouseup', e => {
        const rect = svg.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        // PAN selesai
        if (state.panDrag.active) {
            state.panDrag.active = false;
            svg.classList.remove('panning');
            return;
        }

        // BOX SELECT selesai
        if (state.boxSelect.active) {
            state.boxSelect.active = false;
            selBox.classList.add('hidden');
            selBox.setAttribute('width', 0);
            selBox.setAttribute('height', 0);
            finishBoxSelect(
                Math.min(state.boxSelect.startX, sx),
                Math.min(state.boxSelect.startY, sy),
                Math.abs(sx - state.boxSelect.startX),
                Math.abs(sy - state.boxSelect.startY)
            );
            return;
        }

        // Drag node selesai
        if (state.dragNode) {
            if (state.dragMoved) state.justDragged = true;
            state.dragNode = null;
            state.dragMoved = false;
            state.multiDrag = { active: false, startMouseX: 0, startMouseY: 0, originalPositions: {} };
        }
    });

    // DBLCLICK pada kanvas → Mode ADD: tambah stasiun
    svg.addEventListener('dblclick', e => {
        if (e.target.closest('.station-node') || e.target.closest('.metro-edge')) return;
        if (state.mode === 'add') {
            const rect = svg.getBoundingClientRect();
            const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
            addStation(world.x, world.y);
        }
    });

    // CLICK pada kanvas kosong → Mode ADD: tambah stasiun dengan single klik
    svg.addEventListener('click', e => {
        if (e.target.closest('.station-node') || e.target.closest('.metro-edge')) return;
        if (state.mode === 'add') {
            const rect = svg.getBoundingClientRect();
            const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
            addStation(world.x, world.y);
        }
    });
}

// ============================================================
// 8. INTERAKSI NODE
// ============================================================
function handleNodeMouseDown(e, stationId) {
    e.stopPropagation();
    if (e.button !== 0) return;

    if (state.mode === 'select') {
        const rect = svg.getBoundingClientRect();
        const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        const st = state.stations.find(s => s.id === stationId);
        if (st) {
            state.dragNode  = { id: stationId, offsetX: world.x - st.x, offsetY: world.y - st.y };
            state.dragMoved = false;
        }
    } else if (state.mode === 'pan') {
        const rect = svg.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        state.panDrag = { active: true, lastX: sx, lastY: sy };
        svg.classList.add('panning');
    }
}

function handleNodeClick(e, stationId) {
    e.stopPropagation();

    // Jika baru selesai drag, abaikan klik ini
    if (state.justDragged) { state.justDragged = false; return; }

    if (state.mode === 'select') {
        if (e.shiftKey) {
            // Shift+klik → toggle seleksi
            if (state.selectedStationIds.has(stationId)) {
                state.selectedStationIds.delete(stationId);
            } else {
                state.selectedStationIds.add(stationId);
            }
            updateSelectionUI();
            renderGraph();
        } else {
            // Klik biasa satu stasiun → buka modal edit
            clearBoxSelection();
            openStationModal(state.stations.find(s => s.id === stationId));
        }
    } else if (state.mode === 'connect') {
        handleConnectClick(stationId);
    } else if (state.mode === 'add') {
        // Di mode add, klik node tidak melakukan apa-apa
    }
}

function addStation(wx, wy) {
    const newStation = {
        id: `s_temp_${Date.now()}`,
        name: `Stasiun ${state.stations.length + 1}`,
        x: Math.round(wx),
        y: Math.round(wy)
    };
    state.stations.push(newStation);
    renderGraph();
    populateRouteSelectors();
}

// ============================================================
// 9. BOX SELECTION
// ============================================================
function finishBoxSelect(bx, by, bw, bh) {
    // Jika kotak terlalu kecil (hanya klik), clear selection
    if (bw < 5 && bh < 5) {
        clearBoxSelection();
        return;
    }

    // Cari stasiun di dalam kotak (koordinat layar)
    state.selectedStationIds.clear();
    state.stations.forEach(s => {
        // Konversi koordinat dunia → layar
        const sx = s.x * state.viewport.scale + state.viewport.tx;
        const sy = s.y * state.viewport.scale + state.viewport.ty;
        if (sx >= bx && sx <= bx + bw && sy >= by && sy <= by + bh) {
            state.selectedStationIds.add(s.id);
        }
    });

    updateSelectionUI();
    renderGraph();
}

function clearBoxSelection() {
    state.selectedStationIds.clear();
    updateSelectionUI();
    // Re-render jika ada yang ter-deselect
    const nodes = document.querySelectorAll('.station-node.selected');
    nodes.forEach(n => n.classList.remove('selected'));
    document.getElementById('selection-info-bar').classList.add('hidden');
}

function updateSelectionUI() {
    const count = state.selectedStationIds.size;
    const bar = document.getElementById('selection-info-bar');
    if (count > 0) {
        bar.classList.remove('hidden');
        document.getElementById('selection-count-text').innerHTML =
            `<i class="fa-solid fa-check-square"></i> ${count} stasiun dipilih`;
    } else {
        bar.classList.add('hidden');
    }
}

function deleteSelectedStations() {
    if (state.selectedStationIds.size === 0) return;
    if (!confirm(`Hapus ${state.selectedStationIds.size} stasiun terpilih beserta semua rel yang terhubung?`)) return;
    state.selectedStationIds.forEach(id => {
        state.stations = state.stations.filter(s => s.id !== id);
        state.connections = state.connections.filter(c => c.from_station_id !== id && c.to_station_id !== id);
    });
    clearBoxSelection();
    renderGraph();
    populateRouteSelectors();
}

// ============================================================
// 10. MODE CONNECT (Hubung Rel)
// ============================================================
function handleConnectClick(stationId) {
    // Hapus garis preview
    const preview = document.getElementById('connection-preview');
    if (preview) preview.remove();

    if (!state.connectSourceId) {
        // Pilih stasiun asal
        state.connectSourceId = stationId;
        const el = document.getElementById(`station-node-${stationId}`);
        if (el) el.classList.add('connect-source');
    } else if (state.connectSourceId === stationId) {
        // Klik stasiun yang sama → batalkan
        clearConnectSourceHighlight();
        state.connectSourceId = null;
    } else {
        // Hubungkan ke stasiun tujuan
        const fromId = state.connectSourceId;
        const toId   = stationId;

        if (!state.selectedLineId) {
            alert('Buat atau pilih jalur transit terlebih dahulu di sidebar kiri.');
        } else {
            const exists = state.connections.some(c =>
                (c.from_station_id === fromId && c.to_station_id === toId) ||
                (c.from_station_id === toId   && c.to_station_id === fromId)
            );
            if (!exists) {
                state.connections.push({
                    id: `c_temp_${Date.now()}`,
                    from_station_id: fromId,
                    to_station_id:   toId,
                    line_id:         state.selectedLineId,
                    weight:          3.0
                });
                renderGraph();
            }
        }
        clearConnectSourceHighlight();
        state.connectSourceId = null;
    }
}

function clearConnectSourceHighlight() {
    document.querySelectorAll('.station-node.connect-source').forEach(el => el.classList.remove('connect-source'));
    const preview = document.getElementById('connection-preview');
    if (preview) preview.remove();
}

// ============================================================
// 11. SIDEBAR EVENTS
// ============================================================
function setupSidebarEvents() {
    // Toolbar Mode Buttons
    ['select', 'pan', 'connect', 'add'].forEach(m => {
        document.getElementById(`btn-mode-${m}`).addEventListener('click', () => setMode(m));
    });

    // Zoom Controls
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
        const rect = svg.getBoundingClientRect();
        zoomAt(rect.width / 2, rect.height / 2, 1.25);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
        const rect = svg.getBoundingClientRect();
        zoomAt(rect.width / 2, rect.height / 2, 1 / 1.25);
    });
    document.getElementById('btn-zoom-fit').addEventListener('click', fitToScreen);
    document.getElementById('btn-zoom-reset').addEventListener('click', () => {
        state.viewport = { tx: 0, ty: 0, scale: 1 };
        applyViewport();
    });

    // Map Management
    document.getElementById('map-selector').addEventListener('change', e => loadMap(e.target.value));
    document.getElementById('btn-save-map').addEventListener('click', saveMap);
    document.getElementById('btn-new-map').addEventListener('click', createNewMapState);
    document.getElementById('btn-delete-map').addEventListener('click', deleteMap);

    // Speed Slider
    document.getElementById('speed-slider').addEventListener('input', e => {
        state.animationDelay = parseInt(e.target.value);
        document.getElementById('speed-value').textContent = `${state.animationDelay}ms`;
    });

    // Pathfinding
    document.getElementById('btn-find-path').addEventListener('click', runPathfinding);
    document.getElementById('btn-clear-path').addEventListener('click', clearVisualization);
    document.getElementById('btn-close-results').addEventListener('click', () =>
        document.getElementById('path-results-card').classList.add('hidden')
    );

    // Add Line
    document.getElementById('btn-add-line').addEventListener('click', () => {
        const name  = document.getElementById('new-line-name').value.trim();
        const color = document.getElementById('new-line-color').value;
        if (!name) { alert('Isi nama jalur baru.'); return; }
        const id = `l_temp_${Date.now()}`;
        state.lines.push({ id, name, color });
        state.selectedLineId = id;
        document.getElementById('new-line-name').value = '';
        renderLinesList();
        renderGraph();
    });

    // Selection actions
    document.getElementById('btn-delete-selection').addEventListener('click', deleteSelectedStations);
    document.getElementById('btn-clear-selection').addEventListener('click', () => { clearBoxSelection(); renderGraph(); });
}

// ============================================================
// 12. KEYBOARD SHORTCUTS
// ============================================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        // Jangan tangkap saat user sedang mengetik di input/textarea
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

        switch (e.key.toLowerCase()) {
            case 's': setMode('select'); break;
            case 'p': setMode('pan'); break;
            case 'c': setMode('connect'); break;
            case 'a': setMode('add'); break;
            case 'f': fitToScreen(); break;
            case '0': state.viewport = { tx: 0, ty: 0, scale: 1 }; applyViewport(); break;
            case '+': case '=': {
                const r = svg.getBoundingClientRect();
                zoomAt(r.width / 2, r.height / 2, 1.2);
                break;
            }
            case '-': {
                const r = svg.getBoundingClientRect();
                zoomAt(r.width / 2, r.height / 2, 1 / 1.2);
                break;
            }
            case 'escape': {
                // Batalkan mode connect
                if (state.connectSourceId) { clearConnectSourceHighlight(); state.connectSourceId = null; }
                // Batalkan box select
                if (state.boxSelect.active) { state.boxSelect.active = false; selBox.classList.add('hidden'); }
                // Deselect semua
                clearBoxSelection();
                renderGraph();
                break;
            }
            case 'delete':
            case 'backspace': {
                if (state.selectedStationIds.size > 0) deleteSelectedStations();
                break;
            }
        }
    });
}

// ============================================================
// 13. MODAL EVENTS
// ============================================================
function setupModalEvents() {
    document.getElementById('btn-close-station-modal').addEventListener('click', closeStationModal);
    document.getElementById('btn-save-station').addEventListener('click', saveStationDetails);
    document.getElementById('btn-delete-station').addEventListener('click', deleteStation);

    document.getElementById('btn-close-connection-modal').addEventListener('click', closeConnectionModal);
    document.getElementById('btn-save-connection').addEventListener('click', saveConnectionDetails);
    document.getElementById('btn-delete-connection').addEventListener('click', deleteConnection);
}

// Station Modal
function openStationModal(station) {
    if (!station) return;
    state.editingStationId = station.id;
    document.getElementById('station-name-input').value = station.name;
    document.getElementById('station-modal').classList.remove('hidden');
}
function closeStationModal() {
    document.getElementById('station-modal').classList.add('hidden');
    state.editingStationId = null;
}
function saveStationDetails() {
    const name = document.getElementById('station-name-input').value.trim();
    if (!name) { alert('Nama stasiun tidak boleh kosong.'); return; }
    const st = state.stations.find(s => s.id === state.editingStationId);
    if (st) { st.name = name; renderGraph(); populateRouteSelectors(); }
    closeStationModal();
}
function deleteStation() {
    if (!confirm('Hapus stasiun ini beserta semua rel yang terhubung?')) return;
    const id = state.editingStationId;
    state.stations   = state.stations.filter(s => s.id !== id);
    state.connections = state.connections.filter(c => c.from_station_id !== id && c.to_station_id !== id);
    renderGraph();
    populateRouteSelectors();
    closeStationModal();
}

// Connection Modal
function openConnectionModal(conn) {
    state.editingConnectionId = conn.id;
    const from = state.stations.find(s => s.id === conn.from_station_id);
    const to   = state.stations.find(s => s.id === conn.to_station_id);
    document.getElementById('connection-details-text').innerHTML =
        `<strong>${from?.name || '?'}</strong> &harr; <strong>${to?.name || '?'}</strong>`;
    document.getElementById('connection-weight-input').value = conn.weight;
    const sel = document.getElementById('connection-line-select');
    sel.innerHTML = '';
    state.lines.forEach(l => {
        const o = document.createElement('option');
        o.value = l.id; o.textContent = l.name;
        if (l.id === conn.line_id) o.selected = true;
        sel.appendChild(o);
    });
    document.getElementById('connection-modal').classList.remove('hidden');
}
function closeConnectionModal() {
    document.getElementById('connection-modal').classList.add('hidden');
    state.editingConnectionId = null;
}
function saveConnectionDetails() {
    const weight = parseFloat(document.getElementById('connection-weight-input').value);
    const lineId = document.getElementById('connection-line-select').value;
    if (isNaN(weight) || weight <= 0) { alert('Bobot waktu harus lebih dari 0.'); return; }
    const c = state.connections.find(c => c.id === state.editingConnectionId);
    if (c) { c.weight = weight; c.line_id = lineId; renderGraph(); }
    closeConnectionModal();
}
function deleteConnection() {
    if (!confirm('Hapus rel ini?')) return;
    state.connections = state.connections.filter(c => c.id !== state.editingConnectionId);
    renderGraph();
    closeConnectionModal();
}

// ============================================================
// 14. RENDER UI HELPER
// ============================================================
function populateMapSelector() {
    const sel = document.getElementById('map-selector');
    sel.innerHTML = state.maps.length === 0
        ? '<option value="">(Belum ada peta)</option>'
        : state.maps.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}
function updateMapSelectorValue(id) { document.getElementById('map-selector').value = id; }

function renderLinesList() {
    const list = document.getElementById('line-list');
    list.innerHTML = '';
    state.lines.forEach(line => {
        const li = document.createElement('li');
        const isActive = line.id === state.selectedLineId;
        if (isActive) li.style.background = 'rgba(0,240,255,0.07)';

        li.innerHTML = `
            <div class="line-info">
                <span class="line-color-badge" style="background:${line.color};box-shadow:0 0 4px ${line.color}66;"></span>
                <span style="font-weight:${isActive ? '700' : '400'}">${line.name}</span>
                ${isActive ? '<i class="fa-solid fa-pencil text-cyan" style="font-size:.65rem;"></i>' : ''}
            </div>
            <div class="line-actions">
                <button class="btn-icon-only-sm" data-id="${line.id}" title="Hapus jalur"><i class="fa-solid fa-trash"></i></button>
            </div>`;

        li.querySelector('.line-info').addEventListener('click', () => {
            state.selectedLineId = line.id;
            renderLinesList();
        });
        li.querySelector('.btn-icon-only-sm').addEventListener('click', ev => {
            ev.stopPropagation();
            if (confirm(`Hapus jalur "${line.name}"? Semua rel jalur ini akan terhapus.`)) {
                state.connections = state.connections.filter(c => c.line_id !== line.id);
                state.lines = state.lines.filter(l => l.id !== line.id);
                if (state.selectedLineId === line.id) {
                    state.selectedLineId = state.lines[0]?.id || null;
                }
                renderLinesList();
                renderGraph();
            }
        });
        list.appendChild(li);
    });
}

function populateRouteSelectors() {
    const startSel = document.getElementById('start-station');
    const endSel   = document.getElementById('end-station');
    const pStart = startSel.value, pEnd = endSel.value;
    const sorted = [...state.stations].sort((a, b) => a.name.localeCompare(b.name));
    const options = ['<option value="">-- Pilih Stasiun --</option>', ...sorted.map(s =>
        `<option value="${s.id}">${s.name}</option>`)].join('');
    startSel.innerHTML = options; startSel.value = pStart;
    endSel.innerHTML   = options; endSel.value   = pEnd;
}

// ============================================================
// 15. PATHFINDING
// ============================================================
async function runPathfinding() {
    if (state.isVisualizing) return;
    const startId = document.getElementById('start-station').value;
    const endId   = document.getElementById('end-station').value;
    const algo    = document.getElementById('algorithm-select').value;

    if (!startId || !endId) { alert('Pilih stasiun asal dan tujuan terlebih dahulu.'); return; }
    if (startId === endId)  { alert('Stasiun asal dan tujuan tidak boleh sama.'); return; }

    state.isVisualizing = true;
    clearVisualization();

    const result = algo === 'dijkstra'
        ? await solveDijkstra(startId, endId)
        : await solveBFS(startId, endId);

    if (result && result.path.length > 0) {
        renderShortestPath(result.path, result.edges);
        displayPathDirections(result.path, result.edges, result.distance);
    } else {
        alert('Jalur tidak ditemukan! Stasiun tidak terhubung dalam jaringan.');
        clearVisualization();
    }
    state.isVisualizing = false;
}

function getNeighbors(stationId) {
    const nbrs = [];
    state.connections.forEach(c => {
        if (c.from_station_id === stationId) nbrs.push({ to: c.to_station_id, weight: c.weight, connectionId: c.id });
        else if (c.to_station_id === stationId) nbrs.push({ to: c.from_station_id, weight: c.weight, connectionId: c.id });
    });
    return nbrs;
}

async function solveDijkstra(startId, endId) {
    const dist = {}, prev = {}, prevEdge = {};
    const unvisited = new Set();
    state.stations.forEach(s => { dist[s.id] = Infinity; prev[s.id] = null; prevEdge[s.id] = null; unvisited.add(s.id); });
    dist[startId] = 0;

    while (unvisited.size > 0) {
        let curr = null, minD = Infinity;
        unvisited.forEach(id => { if (dist[id] < minD) { minD = dist[id]; curr = id; } });
        if (curr === null || curr === endId) break;
        unvisited.delete(curr);

        const nodeEl = document.getElementById(`station-node-${curr}`);
        if (nodeEl) nodeEl.classList.add('visiting');
        await sleep(state.animationDelay);

        for (const edge of getNeighbors(curr)) {
            if (!unvisited.has(edge.to)) continue;
            const nd = dist[curr] + edge.weight;
            if (nd < dist[edge.to]) {
                dist[edge.to] = nd; prev[edge.to] = curr; prevEdge[edge.to] = edge.connectionId;
                const eEl = document.getElementById(`edge-${edge.connectionId}`);
                if (eEl) eEl.classList.add('visited-edge');
            }
        }
        if (nodeEl) { nodeEl.classList.remove('visiting'); nodeEl.classList.add('visited'); }
    }

    if (dist[endId] === Infinity) return null;
    const path = [], pathEdges = [];
    let cur = endId;
    while (cur !== null) { path.unshift(cur); if (prevEdge[cur]) pathEdges.unshift(prevEdge[cur]); cur = prev[cur]; }
    return { path, edges: pathEdges, distance: dist[endId] };
}

async function solveBFS(startId, endId) {
    const queue = [[startId]];
    const visited = new Set([startId]);
    const parentMap = {}, parentEdge = {};
    state.stations.forEach(s => { parentMap[s.id] = null; parentEdge[s.id] = null; });
    let found = false;

    while (queue.length > 0) {
        const path = queue.shift();
        const curr = path[path.length - 1];
        const nodeEl = document.getElementById(`station-node-${curr}`);
        if (nodeEl) nodeEl.classList.add('visiting');
        await sleep(state.animationDelay);
        if (curr === endId) { found = true; break; }
        for (const edge of getNeighbors(curr)) {
            if (!visited.has(edge.to)) {
                visited.add(edge.to);
                parentMap[edge.to] = curr; parentEdge[edge.to] = edge.connectionId;
                const eEl = document.getElementById(`edge-${edge.connectionId}`);
                if (eEl) eEl.classList.add('visited-edge');
                queue.push([...path, edge.to]);
            }
        }
        if (nodeEl) { nodeEl.classList.remove('visiting'); nodeEl.classList.add('visited'); }
    }

    if (!found) return null;
    const finalPath = [], finalEdges = [];
    let cur = endId;
    while (cur !== null) { finalPath.unshift(cur); if (parentEdge[cur]) finalEdges.unshift(parentEdge[cur]); cur = parentMap[cur]; }
    let totalW = 0;
    finalEdges.forEach(eid => { const c = state.connections.find(c => c.id === eid); if (c) totalW += c.weight; });
    return { path: finalPath, edges: finalEdges, distance: totalW };
}

function renderShortestPath(path, edges) {
    pathGroup.innerHTML = '';
    edges.forEach(eid => {
        const conn = state.connections.find(c => c.id === eid);
        if (!conn) return;
        const from = state.stations.find(s => s.id === conn.from_station_id);
        const to   = state.stations.find(s => s.id === conn.to_station_id);
        if (!from || !to) return;

        pathGroup.appendChild(makeSVGEl('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: 'path-edge-glow' }));
        pathGroup.appendChild(makeSVGEl('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: 'path-edge-core' }));
    });
    path.forEach(id => { const el = document.getElementById(`station-node-${id}`); if (el) el.classList.add('path-node'); });
}

function clearVisualization() {
    document.querySelectorAll('.station-node').forEach(n => n.classList.remove('visiting', 'visited', 'path-node'));
    document.querySelectorAll('.metro-edge').forEach(e => e.classList.remove('visited-edge'));
    pathGroup.innerHTML = '';
    document.getElementById('path-results-card').classList.add('hidden');
}

function displayPathDirections(path, edges, totalTime) {
    document.getElementById('res-total-time').textContent  = `${totalTime} menit`;
    document.getElementById('res-total-stops').textContent = `${path.length - 1} stasiun`;

    const list = document.getElementById('directions-list');
    list.innerHTML = '';
    let curLineId = null, curLineName = '', segStart = 0;

    for (let i = 0; i < edges.length; i++) {
        const conn = state.connections.find(c => c.id === edges[i]);
        const line = state.lines.find(l => l.id === conn.line_id);
        const from = state.stations.find(s => s.id === path[i]);
        const to   = state.stations.find(s => s.id === path[i+1]);

        if (line.id !== curLineId) {
            if (curLineId !== null) {
                const li = document.createElement('li');
                li.innerHTML = `Lalui ${i - segStart} stasiun di jalur <span class="direction-line-badge" style="background:${getLineColor(curLineId)}">${curLineName}</span>.`;
                list.appendChild(li);
                const tli = document.createElement('li');
                tli.innerHTML = `<i class="fa-solid fa-right-left text-cyan"></i> Transit di <strong>${from.name}</strong>, pindah ke <span class="direction-line-badge" style="background:${line.color}">${line.name}</span>.`;
                list.appendChild(tli);
            } else {
                const sli = document.createElement('li');
                sli.innerHTML = `<i class="fa-solid fa-circle-dot text-cyan"></i> Naik di <strong>${from.name}</strong> jalur <span class="direction-line-badge" style="background:${line.color}">${line.name}</span>.`;
                list.appendChild(sli);
            }
            curLineId = line.id; curLineName = line.name; segStart = i;
        }
        if (i === edges.length - 1) {
            const eli = document.createElement('li');
            eli.innerHTML = `Lalui ${i + 1 - segStart} stasiun, tiba di <strong>${to.name}</strong> 🎯.`;
            list.appendChild(eli);
        }
    }
    document.getElementById('path-results-card').classList.remove('hidden');
}

function getLineColor(lineId) {
    return state.lines.find(l => l.id === lineId)?.color || '#ffffff';
}
