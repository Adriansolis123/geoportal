const SUPABASE_URL = 'https://txjirclbukuitsmdmfst.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4amlyY2xidWt1aXRzbWRtZnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjU0ODIsImV4cCI6MjA4NTkwMTQ4Mn0.IKy47KhZdXlVScPEg_BHICesrKTIDqRh8SnR-zbSOlI';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let map;
let allLayersData = {};
let mapLayers = {};
let userMarker;

const colors = {
    v_cobertura: '#22c55e',
    v_incendios: '#ef4444',
    v_poblados: '#3b82f6',
    v_educativas: '#8b5cf6',
    v_vias: '#f59e0b'
};

// Escalas de riesgo de incendios
const fireRiskScales = {
    extremo: { min: 90, max: 100, color: '#7f1d1d', label: 'Extremo (90-100)' },
    muyAlto: { min: 75, max: 89, color: '#991b1b', label: 'Muy Alto (75-89)' },
    alto: { min: 50, max: 74, color: '#dc2626', label: 'Alto (50-74)' },
    medio: { min: 25, max: 49, color: '#f97316', label: 'Medio (25-49)' },
    bajo: { min: 0, max: 24, color: '#fbbf24', label: 'Bajo (0-24)' }
};

// ======= INICIALIZACIÓN =======
function init() {
    map = L.map('map').setView([-2.2431, -78.6047], 9);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 19
    }).addTo(map);
    
    setupEventListeners();
    getLocationAuto();
    addFireRiskLegend();
}

// ======= LEYENDA DE RIESGO DE INCENDIOS =======
function addFireRiskLegend() {
    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'fire-legend');
        div.style.background = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
        div.style.fontSize = '12px';
        div.style.maxWidth = '200px';
        
        let html = '<h4 style="margin: 0 0 10px 0; color: #065f46;">📊 Escala Riesgo Incendios</h4>';
        
        Object.entries(fireRiskScales).forEach(([key, scale]) => {
            html += `
                <div style="display: flex; align-items: center; gap: 8px; margin: 5px 0;">
                    <div style="width: 20px; height: 20px; background: ${scale.color}; border-radius: 50%; border: 1px solid #333;"></div>
                    <span>${scale.label}</span>
                </div>
            `;
        });
        
        div.innerHTML = html;
        return div;
    };
    
    legend.addTo(map);
}

function getFireRiskColor(value) {
    if (!value) return colors.v_incendios;
    
    const val = parseFloat(value);
    
    if (val >= 90) return fireRiskScales.extremo.color;
    if (val >= 75) return fireRiskScales.muyAlto.color;
    if (val >= 50) return fireRiskScales.alto.color;
    if (val >= 25) return fireRiskScales.medio.color;
    return fireRiskScales.bajo.color;
}

function getFireRiskLevel(value) {
    if (!value) return 'Desconocido';
    
    const val = parseFloat(value);
    
    if (val >= 90) return fireRiskScales.extremo.label;
    if (val >= 75) return fireRiskScales.muyAlto.label;
    if (val >= 50) return fireRiskScales.alto.label;
    if (val >= 25) return fireRiskScales.medio.label;
    return fireRiskScales.bajo.label;
}

function setupEventListeners() {
    // Capas
    document.querySelectorAll('.layer-checkbox').forEach(cb => {
        cb.addEventListener('change', async (e) => {
            if (e.target.checked) {
                await loadLayer(e.target.dataset.layer);
            } else {
                removeLayer(e.target.dataset.layer);
            }
        });
    });

    // Filtros
    document.getElementById('opacitySlider').addEventListener('input', (e) => {
        document.getElementById('opacityValue').textContent = e.target.value + '%';
        updateLayersOpacity(e.target.value / 100);
    });

    document.getElementById('radiusSlider').addEventListener('input', (e) => {
        document.getElementById('radiusValue').textContent = e.target.value;
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });

    // Modales
    setupModals();

    // Denuncias
    document.getElementById('btnDenuncias').addEventListener('click', openDenunciasModal);
    document.getElementById('btnGeolocate').addEventListener('click', getLocation);
    document.getElementById('formDenuncia').addEventListener('submit', submitDenuncia);

    // Análisis avanzado
    document.getElementById('btnBufferAnalysis').addEventListener('click', bufferAnalysis);
    document.getElementById('btnProximityAnalysis').addEventListener('click', proximityAnalysis);
    document.getElementById('btnHeatMap').addEventListener('click', heatMapAnalysis);
    document.getElementById('btnOverlay').addEventListener('click', overlayAnalysis);
    document.getElementById('btnSpatialStats').addEventListener('click', spatialStats);

    // Reportes
    document.getElementById('btnReportCobertura').addEventListener('click', reportCobertura);
    document.getElementById('btnReportIncendios').addEventListener('click', reportIncendios);
    document.getElementById('btnReportPoblacion').addEventListener('click', reportPoblacion);
    document.getElementById('btnReportIntegral').addEventListener('click', reportIntegral);
}

function setupModals() {
    const modals = ['denunciasModal', 'analysisModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        const closeBtn = modal.querySelector('.modal-close');
        
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });

    // Tabs modales
    document.querySelectorAll('.tab-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const parent = btn.closest('.tabs-modal');
            parent.querySelectorAll('.tab-modal').forEach(b => b.classList.remove('active'));
            parent.parentElement.querySelectorAll('.tab-modal-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            parent.parentElement.querySelector('#tab-' + btn.dataset.tabModal).classList.add('active');
        });
    });
}

// ======= CREAR HTML CON ATRIBUTOS =======
function createAttributesHTML(item, layerName) {
    let html = `<div style="max-width: 400px; max-height: 500px; overflow-y: auto;">
        <h3 style="color: #065f46; margin-bottom: 1rem;">${layerName.replace('v_', '').toUpperCase()}</h3>`;
    
    // Agregar información de riesgo para incendios
    if (layerName === 'v_incendios' && item.value) {
        const riskLevel = getFireRiskLevel(item.value);
        const riskColor = getFireRiskColor(item.value);
        html += `<div style="background: ${riskColor}; color: white; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; font-weight: bold;">
            🔥 ${riskLevel}
        </div>`;
    }
    
    html += `<table style="width: 100%; border-collapse: collapse;">`;
    
    Object.entries(item).forEach(([key, value]) => {
        if (key !== 'geom_json' && value !== null && typeof value !== 'object') {
            const displayValue = typeof value === 'number' ? value.toFixed(2) : value;
            html += `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 0.5rem; font-weight: 600; color: #065f46; width: 40%;">${key}</td>
                    <td style="padding: 0.5rem;">${displayValue}</td>
                </tr>`;
        }
    });
    
    html += '</table></div>';
    return html;
}

// ======= MOSTRAR ATRIBUTOS EN PANEL =======
function showAttributesPanel(item, layerName) {
    let html = `<h3>${layerName.replace('v_', '').toUpperCase()}</h3>`;
    
    // Información de riesgo para incendios
    if (layerName === 'v_incendios' && item.value) {
        const riskLevel = getFireRiskLevel(item.value);
        const riskColor = getFireRiskColor(item.value);
        html += `<div style="background: ${riskColor}; color: white; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; font-weight: bold; text-align: center;">
            🔥 ${riskLevel}
            <div style="font-size: 0.9rem; margin-top: 0.5rem;">Valor: ${item.value}</div>
        </div>`;
    }
    
    html += `<div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; background: #f9fafb;">
        <table style="width: 100%; border-collapse: collapse;">`;
    
    let count = 0;
    Object.entries(item).forEach(([key, value]) => {
        if (key !== 'geom_json' && value !== null && typeof value !== 'object') {
            count++;
            const displayValue = typeof value === 'number' ? value.toFixed(4) : value;
            html += `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 0.75rem; font-weight: 600; color: #065f46; width: 35%; background: #f0f4f8;">${key}</td>
                    <td style="padding: 0.75rem; word-break: break-word;">${displayValue}</td>
                </tr>`;
        }
    });
    
    html += `</table>
        <p style="margin-top: 1rem; font-size: 0.85rem; color: #666;">
            <i>Total de atributos: ${count}</i>
        </p>
        </div>`;
    
    document.getElementById('info-panel').innerHTML = html;
    
    // Cambiar a tab Info
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="info"]').classList.add('active');
    document.getElementById('tab-info').classList.add('active');
}

// ======= CARGAR CAPAS =======
async function loadLayer(layerName) {
    try {
        const { data, error } = await db.from(layerName).select('*').limit(10000);
        
        if (error || !data || data.length === 0) {
            console.warn(`No data for ${layerName}`);
            return;
        }
        
        allLayersData[layerName] = data;
        document.getElementById('count-' + layerName).textContent = data.length;
        
        const bounds = L.latLngBounds();
        const baseColor = colors[layerName];
        mapLayers[layerName] = L.featureGroup().addTo(map);
        
        data.forEach((item, idx) => {
            try {
                if (!item.geom_json) return;
                
                let geom = typeof item.geom_json === 'string' ? JSON.parse(item.geom_json) : item.geom_json;
                if (!geom || !geom.type || !geom.coordinates) return;
                
                const opacity = document.getElementById('opacitySlider').value / 100;
                const radius = parseInt(document.getElementById('radiusSlider').value);
                const attributesHtml = createAttributesHTML(item, layerName);
                
                // Determinar color basado en tipo de capa
                let color = baseColor;
                if (layerName === 'v_incendios' && item.value) {
                    color = getFireRiskColor(item.value);
                }
                
                // ===== POINT =====
                if (geom.type === 'Point') {
                    const [lng, lat] = geom.coordinates;
                    const marker = L.circleMarker([lat, lng], {
                        radius: radius,
                        color: color,
                        fillColor: color,
                        fillOpacity: opacity,
                        weight: 2
                    }).bindPopup(attributesHtml).addTo(mapLayers[layerName]);
                    
                    marker.on('click', () => {
                        showAttributesPanel(item, layerName);
                    });
                    
                    bounds.extend([lat, lng]);
                }
                
                // ===== LINESTRING =====
                else if (geom.type === 'LineString') {
                    const lineCoords = geom.coordinates.map(c => [c[1], c[0]]);
                    const line = L.polyline(lineCoords, {
                        color: color,
                        weight: 3,
                        opacity: opacity,
                        dashArray: '5, 3'
                    }).bindPopup(attributesHtml).addTo(mapLayers[layerName]);
                    
                    line.on('click', () => {
                        showAttributesPanel(item, layerName);
                    });
                    
                    lineCoords.forEach(c => bounds.extend(c));
                }
                
                // ===== POLYGON =====
                else if (geom.type === 'Polygon') {
                    const coords = geom.coordinates[0].map(c => [c[1], c[0]]);
                    
                    const polygon = L.polygon(coords, {
                        color: color,
                        weight: 2,
                        opacity: 1,
                        fillColor: color,
                        fillOpacity: opacity * 0.5
                    }).bindPopup(attributesHtml).addTo(mapLayers[layerName]);
                    
                    polygon.on('click', () => {
                        showAttributesPanel(item, layerName);
                    });
                    
                    coords.forEach(c => bounds.extend(c));
                }
                
                // ===== MULTIPOLYGON =====
                else if (geom.type === 'MultiPolygon') {
                    geom.coordinates.forEach((multiPoly, polyIdx) => {
                        const coords = multiPoly[0].map(c => [c[1], c[0]]);
                        
                        const polygon = L.polygon(coords, {
                            color: color,
                            weight: 2,
                            opacity: 1,
                            fillColor: color,
                            fillOpacity: opacity * 0.5
                        }).bindPopup(attributesHtml).addTo(mapLayers[layerName]);
                        
                        polygon.on('click', () => {
                            showAttributesPanel(item, layerName);
                        });
                        
                        coords.forEach(c => bounds.extend(c));
                    });
                }
                
                // ===== MULTILINESTRING =====
                else if (geom.type === 'MultiLineString') {
                    geom.coordinates.forEach((lineCoords, lineIdx) => {
                        const coords = lineCoords.map(c => [c[1], c[0]]);
                        const line = L.polyline(coords, {
                            color: color,
                            weight: 3,
                            opacity: opacity,
                            dashArray: '5, 3'
                        }).bindPopup(attributesHtml).addTo(mapLayers[layerName]);
                        
                        line.on('click', () => {
                            showAttributesPanel(item, layerName);
                        });
                        
                        coords.forEach(c => bounds.extend(c));
                    });
                }
                
            } catch (e) {
                console.warn(`Error en elemento ${idx}:`, e.message);
            }
        });
        
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        }
        
        updateInfoPanel(layerName);
        
    } catch (error) {
        console.error(`Error cargando ${layerName}:`, error);
    }
}

function removeLayer(layerName) {
    if (mapLayers[layerName]) {
        map.removeLayer(mapLayers[layerName]);
        delete mapLayers[layerName];
    }
    document.getElementById('count-' + layerName).textContent = '0';
}

function updateLayersOpacity(opacity) {
    Object.keys(mapLayers).forEach(layerName => {
        mapLayers[layerName].eachLayer(layer => {
            if (layer.setStyle) {
                layer.setStyle({
                    opacity: opacity,
                    fillOpacity: opacity * 0.5
                });
            }
        });
    });
}

// ======= PANEL INFO =======
function updateInfoPanel(layerName) {
    const data = allLayersData[layerName] || [];
    let html = `<h4>${layerName}</h4><p><b>Elementos:</b> ${data.length}</p>
        <p style="font-size: 0.85rem; color: #666; margin-top: 1rem;"><i>💡 Haz clic en un elemento del mapa para ver sus atributos aquí</i></p>`;
    
    if (layerName === 'v_cobertura') {
        const types = {};
        data.forEach(d => {
            const type = d.ctn1 || 'Sin tipo';
            types[type] = (types[type] || 0) + 1;
        });
        html += '<h4 style="margin-top: 1.5rem;">Tipos:</h4>';
        Object.entries(types).forEach(([t, c]) => {
            html += `<p>${t}: ${c}</p>`;
        });
    } else if (layerName === 'v_incendios') {
        const values = data.filter(d => d.value).map(d => parseFloat(d.value));
        if (values.length > 0) {
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            const extremo = data.filter(d => parseFloat(d.value) >= 90).length;
            const muyAlto = data.filter(d => parseFloat(d.value) >= 75 && parseFloat(d.value) < 90).length;
            const alto = data.filter(d => parseFloat(d.value) >= 50 && parseFloat(d.value) < 75).length;
            
            html += `<h4 style="margin-top: 1.5rem;">Análisis de Riesgo:</h4>
                <p>🔥 Extremo (90-100): ${extremo}</p>
                <p>🔥 Muy Alto (75-89): ${muyAlto}</p>
                <p>🔥 Alto (50-74): ${alto}</p>
                <p><b>Promedio:</b> ${avg.toFixed(2)}</p>`;
        }
    } else if (layerName === 'v_poblados') {
        const totalPop = data.reduce((s, p) => s + (p.pop_2002 || 0), 0);
        html += `<p><b>Población total:</b> ${totalPop.toLocaleString()}</p>`;
    }
    
    document.getElementById('info-panel').innerHTML = html;
}

// ======= ANÁLISIS AVANZADO =======
function bufferAnalysis() {
    const poblados = allLayersData.v_poblados || [];
    const incendios = allLayersData.v_incendios || [];
    
    if (poblados.length === 0 || incendios.length === 0) {
        alert('Carga Poblados e Incendios');
        return;
    }
    
    const bufferRadio = 5;
    let enRiesgo = 0;
    
    poblados.forEach(pob => {
        if (!pob.geom_json) return;
        const geom = typeof pob.geom_json === 'string' ? JSON.parse(pob.geom_json) : pob.geom_json;
        if (geom.type !== 'Point') return;
        const [pLng, pLat] = geom.coordinates;
        
        incendios.forEach(inc => {
            if (!inc.geom_json) return;
            const incGeom = typeof inc.geom_json === 'string' ? JSON.parse(inc.geom_json) : inc.geom_json;
            if (incGeom.type !== 'Point') return;
            const [iLng, iLat] = incGeom.coordinates;
            
            const dist = Math.sqrt(Math.pow(pLng - iLng, 2) + Math.pow(pLat - iLat, 2)) * 111;
            if (dist < bufferRadio) {
                enRiesgo++;
            }
        });
    });
    
    const html = `
        <h3>Análisis de Buffer</h3>
        <p><b>Radio analizado:</b> ${bufferRadio} km</p>
        <p><b>Poblados en riesgo:</b> ${enRiesgo}/${poblados.length}</p>
        <p><b>Porcentaje:</b> ${((enRiesgo/poblados.length)*100).toFixed(1)}%</p>
    `;
    
    document.getElementById('analysis-results').innerHTML = html;
}

function proximityAnalysis() {
    const poblados = allLayersData.v_poblados || [];
    const educativas = allLayersData.v_educativas || [];
    
    let conAcceso = 0;
    poblados.forEach(pob => {
        if (!pob.geom_json) return;
        const geom = typeof pob.geom_json === 'string' ? JSON.parse(pob.geom_json) : pob.geom_json;
        if (geom.type !== 'Point') return;
        const [pLng, pLat] = geom.coordinates;
        
        const cercana = educativas.some(edu => {
            if (!edu.geom_json) return false;
            const eduGeom = typeof edu.geom_json === 'string' ? JSON.parse(edu.geom_json) : edu.geom_json;
            if (eduGeom.type !== 'Point') return false;
            const [eLng, eLat] = eduGeom.coordinates;
            const dist = Math.sqrt(Math.pow(pLng - eLng, 2) + Math.pow(pLat - eLat, 2)) * 111;
            return dist < 3;
        });
        
        if (cercana) conAcceso++;
    });
    
    const html = `
        <h3>Análisis de Proximidad</h3>
        <p><b>Total poblados:</b> ${poblados.length}</p>
        <p><b>Con acceso a educación (3km):</b> ${conAcceso}</p>
        <p><b>Cobertura:</b> ${((conAcceso/poblados.length)*100).toFixed(1)}%</p>
    `;
    
    document.getElementById('analysis-results').innerHTML = html;
}

function heatMapAnalysis() {
    const incendios = allLayersData.v_incendios || [];
    
    if (incendios.length === 0) {
        alert('Carga la capa Incendios');
        return;
    }
    
    const values = incendios.filter(i => i.value).map(i => parseFloat(i.value));
    
    const extremo = incendios.filter(i => parseFloat(i.value) >= 90).length;
    const muyAlto = incendios.filter(i => parseFloat(i.value) >= 75 && parseFloat(i.value) < 90).length;
    const alto = incendios.filter(i => parseFloat(i.value) >= 50 && parseFloat(i.value) < 75).length;
    const medio = incendios.filter(i => parseFloat(i.value) >= 25 && parseFloat(i.value) < 50).length;
    const bajo = incendios.filter(i => parseFloat(i.value) < 25).length;
    
    const html = `
        <h3>Mapa de Calor - Incendios</h3>
        <p><b>Total incendios analizados:</b> ${incendios.length}</p>
        <p><b>Intensidad mínima:</b> ${Math.min(...values).toFixed(1)}</p>
        <p><b>Intensidad máxima:</b> ${Math.max(...values).toFixed(1)}</p>
        <p><b>Promedio:</b> ${(values.reduce((s,i) => s + i, 0) / values.length).toFixed(1)}</p>
        <h4 style="margin-top: 1.5rem;">Distribución por Riesgo:</h4>
        <p>🔥 Extremo (90-100): ${extremo}</p>
        <p>🔥 Muy Alto (75-89): ${muyAlto}</p>
        <p>🔥 Alto (50-74): ${alto}</p>
        <p>🟠 Medio (25-49): ${medio}</p>
        <p>🟡 Bajo (0-24): ${bajo}</p>
    `;
    
    document.getElementById('analysis-results').innerHTML = html;
}

function overlayAnalysis() {
    const cobertura = allLayersData.v_cobertura || [];
    const incendios = allLayersData.v_incendios || [];
    
    const html = `
        <h3>Análisis de Superposición</h3>
        <p><b>Polígonos de cobertura:</b> ${cobertura.length}</p>
        <p><b>Eventos de incendios:</b> ${incendios.length}</p>
        <p><b>Densidad (incendios/cobertura):</b> ${(incendios.length / Math.max(cobertura.length, 1)).toFixed(4)}</p>
    `;
    
    document.getElementById('analysis-results').innerHTML = html;
}

function spatialStats() {
    const poblados = allLayersData.v_poblados || [];
    const totalPop = poblados.reduce((s, p) => s + (p.pop_2002 || 0), 0);
    
    const html = `
        <h3>Estadísticas Espaciales</h3>
        <p><b>Asentamientos:</b> ${poblados.length}</p>
        <p><b>Población total:</b> ${totalPop.toLocaleString()} hab</p>
        <p><b>Población promedio/asentamiento:</b> ${(totalPop / Math.max(poblados.length, 1)).toFixed(0)}</p>
    `;
    
    document.getElementById('analysis-results').innerHTML = html;
}

// ======= REPORTES =======
function reportCobertura() {
    const data = allLayersData.v_cobertura || [];
    const types = {};
    let totalArea = 0;
    
    data.forEach(d => {
        const type = d.ctn1 || 'Sin tipo';
        if (!types[type]) types[type] = { count: 0, area: 0 };
        types[type].count++;
        types[type].area += d.are || 0;
        totalArea += d.are || 0;
    });
    
    let html = `<h3>📊 Reporte: Cobertura Vegetal</h3>
        <p><b>Total de polígonos:</b> ${data.length}</p>
        <p><b>Área total:</b> ${(totalArea * 0.0001).toFixed(2)} hectáreas</p>
        <h4>Desglose:</h4>`;
    
    Object.entries(types).forEach(([t, d]) => {
        html += `<p>${t}: ${d.count} polígonos - ${(d.area * 0.0001).toFixed(2)} ha</p>`;
    });
    
    document.getElementById('report-results').innerHTML = html;
}

function reportIncendios() {
    const data = allLayersData.v_incendios || [];
    const extremo = data.filter(d => parseFloat(d.value) >= 90).length;
    const muyAlto = data.filter(d => parseFloat(d.value) >= 75 && parseFloat(d.value) < 90).length;
    const alto = data.filter(d => parseFloat(d.value) >= 50 && parseFloat(d.value) < 75).length;
    const medio = data.filter(d => parseFloat(d.value) >= 25 && parseFloat(d.value) < 50).length;
    const bajo = data.filter(d => parseFloat(d.value) < 25).length;
    
    const html = `<h3>🔥 Reporte: Análisis de Incendios</h3>
        <p><b>Total de eventos:</b> ${data.length}</p>
        <h4>Distribución por Riesgo:</h4>
        <p>🔥 Extremo (90-100): ${extremo}</p>
        <p>🔥 Muy Alto (75-89): ${muyAlto}</p>
        <p>🔥 Alto (50-74): ${alto}</p>
        <p>🟠 Medio (25-49): ${medio}</p>
        <p>🟡 Bajo (0-24): ${bajo}</p>
    `;
    
    document.getElementById('report-results').innerHTML = html;
}

function reportPoblacion() {
    const data = allLayersData.v_poblados || [];
    const incendios = allLayersData.v_incendios || [];
    
    let enRiesgo = 0;
    data.forEach(pob => {
        if (!pob.geom_json) return;
        const geom = typeof pob.geom_json === 'string' ? JSON.parse(pob.geom_json) : pob.geom_json;
        if (geom.type !== 'Point') return;
        const [pLng, pLat] = geom.coordinates;
        
        incendios.forEach(inc => {
            if (!inc.geom_json) return;
            const incGeom = typeof inc.geom_json === 'string' ? JSON.parse(inc.geom_json) : inc.geom_json;
            if (incGeom.type !== 'Point') return;
            const [iLng, iLat] = incGeom.coordinates;
            const dist = Math.sqrt(Math.pow(pLng - iLng, 2) + Math.pow(pLat - iLat, 2)) * 111;
            if (dist < 5) enRiesgo++;
        });
    });
    
    const totalPop = data.reduce((s, p) => s + (p.pop_2002 || 0), 0);
    
    const html = `<h3>👥 Reporte: Riesgo Poblacional</h3>
        <p><b>Población total:</b> ${totalPop.toLocaleString()} hab</p>
        <p><b>Asentamientos en riesgo (5km de incendios):</b> ${enRiesgo}/${data.length}</p>
    `;
    
    document.getElementById('report-results').innerHTML = html;
}

function reportIntegral() {
    const html = `<h3>📋 Reporte Integral</h3>
        <p>Cobertura: ${(allLayersData.v_cobertura || []).length} elementos</p>
        <p>Incendios: ${(allLayersData.v_incendios || []).length} eventos</p>
        <p>Poblados: ${(allLayersData.v_poblados || []).length} asentamientos</p>
        <p>Educativas: ${(allLayersData.v_educativas || []).length} instituciones</p>
        <p>Vías: ${(allLayersData.v_vias || []).length} tramos</p>
    `;
    
    document.getElementById('report-results').innerHTML = html;
}

// ======= DENUNCIAS =======
function openDenunciasModal() {
    document.getElementById('denunciasModal').classList.add('show');
    loadDenunciasList();
}

function getLocationAuto() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                document.getElementById('lat').value = pos.coords.latitude.toFixed(6);
                document.getElementById('lng').value = pos.coords.longitude.toFixed(6);
                if (userMarker) map.removeLayer(userMarker);
                userMarker = L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
                    radius: 8,
                    color: '#10b981',
                    fillColor: '#22c55e',
                    fillOpacity: 0.9,
                    weight: 3,
                    dashArray: '5,5'
                }).addTo(map).bindPopup('Tu ubicación');
            },
            () => {}
        );
    }
}

function getLocation() {
    if ('geolocation' in navigator) {
        document.getElementById('btnGeolocate').textContent = '⏳ Obteniendo...';
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                document.getElementById('lat').value = pos.coords.latitude.toFixed(6);
                document.getElementById('lng').value = pos.coords.longitude.toFixed(6);
                document.getElementById('btnGeolocate').textContent = '✓ Actualizado';
                setTimeout(() => {
                    document.getElementById('btnGeolocate').textContent = '📍 Obtener Ubicación';
                }, 2000);
            }
        );
    }
}

async function submitDenuncia(e) {
    e.preventDefault();
    const form = e.target;
    
    // Capturar datos del formulario
    const nombre = document.querySelector('input[name="nombre"]').value.trim();
    const email = document.querySelector('input[name="email"]').value.trim();
    const telefono = document.querySelector('input[name="telefono"]').value.trim();
    const tipo_denuncia = document.querySelector('select[name="tipo_denuncia"]').value;
    const severidad = document.querySelector('select[name="severidad"]').value;
    const ubicacion = document.querySelector('input[name="ubicacion"]').value.trim();
    const descripcion = document.querySelector('textarea[name="descripcion"]').value.trim();
    const latitud = document.getElementById('lat').value;
    const longitud = document.getElementById('lng').value;
    
    // Validaciones
    if (!nombre) {
        alert('❌ El nombre es obligatorio');
        return;
    }
    
    if (!tipo_denuncia) {
        alert('❌ Selecciona un tipo de denuncia');
        return;
    }
    
    if (!severidad) {
        alert('❌ Selecciona la severidad');
        return;
    }
    
    if (!ubicacion) {
        alert('❌ La ubicación es obligatoria');
        return;
    }
    
    if (!descripcion) {
        alert('❌ La descripción es obligatoria');
        return;
    }
    
    if (!latitud || !longitud) {
        alert('❌ Obtén tu ubicación antes de enviar');
        return;
    }
    
    try {
        const { data: insertData, error } = await db.from('denuncias_ambientales').insert([{
            nombre: nombre,
            email: email || null,
            telefono: telefono || null,
            latitud: parseFloat(latitud),
            longitud: parseFloat(longitud),
            ubicacion: ubicacion,
            tipo_denuncia: tipo_denuncia,
            severidad: severidad,
            descripcion: descripcion,
            estado: 'pendiente'
        }]);
        
        if (error) {
            console.error('Error Supabase:', error);
            alert('❌ Error al enviar: ' + error.message);
            return;
        }
        
        alert('✓ Denuncia enviada correctamente');
        
        // Limpiar formulario
        form.reset();
        getLocationAuto();
        
        // Marcador en mapa
        L.circleMarker([parseFloat(latitud), parseFloat(longitud)], {
            radius: 10,
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.7,
            weight: 2
        }).addTo(map).bindPopup(`<b>${tipo_denuncia}</b><br>${ubicacion}`);
        
        // Recargar listado
        loadDenunciasList();
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error: ' + error.message);
    }
}

async function loadDenunciasList() {
    try {
        const { data, error } = await db.from('denuncias_ambientales').select('*').order('created_at', { ascending: false });
        
        if (error) {
            document.getElementById('denuncias-list').innerHTML = '<p>Error al cargar denuncias</p>';
            return;
        }
        
        let html = '<h4>Listado de Denuncias</h4>';
        
        if (!data || data.length === 0) {
            html += '<p>Sin denuncias</p>';
        } else {
            html += `<p><b>Total:</b> ${data.length}</p>`;
            data.slice(0, 10).forEach(d => {
                html += `
                    <div style="background:#f3f4f6; padding:0.75rem; margin:0.5rem 0; border-radius:0.5rem;">
                        <p><b>${d.nombre}</b> - ${d.tipo_denuncia}</p>
                        <p>Ubicación: ${d.ubicacion}</p>
                        <p>Severidad: ${d.severidad} | Estado: ${d.estado}</p>
                        <p><small>${new Date(d.created_at).toLocaleDateString()}</small></p>
                    </div>
                `;
            });
        }
        
        document.getElementById('denuncias-list').innerHTML = html;
        
        // Estadísticas
        const stats = {};
        data.forEach(d => {
            const tipo = d.tipo_denuncia;
            stats[tipo] = (stats[tipo] || 0) + 1;
        });
        
        let statsHtml = '<h4>Estadísticas</h4>';
        Object.entries(stats).forEach(([tipo, count]) => {
            statsHtml += `<p>${tipo}: ${count}</p>`;
        });
        
        document.getElementById('denuncias-stats').innerHTML = statsHtml;
        
    } catch (error) {
        console.error(error);
    }
}

document.addEventListener('DOMContentLoaded', init);
