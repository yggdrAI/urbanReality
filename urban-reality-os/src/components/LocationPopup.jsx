import React from 'react';

function getAqiColor(val) {
    if (!Number.isFinite(val)) return '#94a3b8';
    if (val <= 50) return '#22c55e';
    if (val <= 100) return '#eab308';
    if (val <= 150) return '#f97316';
    if (val <= 200) return '#dc2626';
    if (val <= 300) return '#9333ea';
    return '#6b21a8';
}

function getAqiStatus(val) {
    if (!Number.isFinite(val)) return 'Unknown';
    if (val <= 50) return 'Good';
    if (val <= 100) return 'Moderate';
    if (val <= 150) return 'Unhealthy (Sens.)';
    if (val <= 200) return 'Unhealthy';
    if (val <= 300) return 'Very Unhealthy';
    return 'Hazardous';
}

export default function LocationPopup({
    placeName,
    year,
    baseYear,
    realTimeAQI,
    finalAQI,
    rainfall,
    rainProbability,
    macroData,
    impact,
    analysis,
    analysisLoading,
    onSave
}) {
    const aqiVal = realTimeAQI?.aqi ?? finalAQI;
    const aqiColor = getAqiColor(aqiVal);
    const aqiStatus = getAqiStatus(aqiVal);

    const popMillions = macroData && macroData.population && Number.isFinite(macroData.population.value)
        ? `${(macroData.population.value / 1e6).toFixed(1)}M`
        : '—';

    return (
        <div style={{ position: 'relative', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", padding: 0, margin: 0, maxWidth: '100%', boxSizing: 'border-box', wordWrap: 'break-word' }}>
            <div style={{ padding: '12px 14px 10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Location</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, wordBreak: 'break-word' }}>{placeName}</div>
                <div style={{ marginTop: 10 }}>
                    <button onClick={() => { const name = prompt('Save name', 'Pinned Location'); if (name && onSave) onSave(name); }} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'rgba(245, 158, 11, 0.9)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 11, width: '100%', boxSizing: 'border-box' }}>⭐ Save</button>
                </div>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.95)', boxShadow: '0 6px 16px rgba(0,0,0,0.45)', borderRadius: 10, padding: 8, margin: 6, border: '1px solid rgba(255,255,255,0.06)', color: '#e2e8f0', maxWidth: 260, boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Air Quality</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontSize: 18, fontWeight: 800, color: aqiColor, lineHeight: 1, whiteSpace: 'nowrap' }}>{Number.isFinite(aqiVal) ? aqiVal : '—'}</span>
                            <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600 }}>{aqiStatus}</span>
                        </div>
                    </div>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: aqiColor, boxShadow: `0 0 8px ${aqiColor}60` }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>PM2.5</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{realTimeAQI?.components?.pm25 ?? '—'} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>μg/m³</span></div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>PM10</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{realTimeAQI?.components?.pm10 ?? '—'} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>μg/m³</span></div>
                    </div>
                </div>

                <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{realTimeAQI?.timestamp ?? ''}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{aqiStatus}</div>
                </div>

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: '#cbd5f5' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>🌧 <span>Rainfall</span><b style={{ marginLeft: 'auto', color: '#60a5fa' }}>{Number.isFinite(rainfall) ? rainfall.toFixed(1) + ' mm' : '—'}</b></div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>☔ <span>Probability</span><b style={{ marginLeft: 'auto', color: '#38bdf8' }}>{Number.isFinite(rainProbability) ? rainProbability + '%' : '—'}</b></div>
                </div>

                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: '#94a3b8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>Population: <b style={{ color: '#cbd5f5' }}>{popMillions}</b></div>
                    <div>GDP/capita: <b style={{ color: '#cbd5f5' }}>{macroData && macroData.gdpPerCapita ? `$${Math.round(macroData.gdpPerCapita.value)}` : '—'}</b></div>
                </div>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.95)', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', borderRadius: 10, padding: 12, margin: 10, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', maxWidth: 'calc(100% - 20px)', boxSizing: 'border-box' }}>
                <div style={{ textAlign: 'center', color: '#94a3b8', marginBottom: 12 }}>
                    {analysisLoading ? (
                        <div>
                            <div style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(96,165,250,0.3)', borderTopColor: '#60a5fa', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 8 }} />
                            <div style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>Generating AI Analysis...</div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>🤖 AI Locations Analysis</div>
                            <div style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto', fontWeight: 400 }}>{analysis || 'No analysis available.'}</div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } } .custom-popup { pointer-events: auto !important; } .custom-popup .maplibregl-popup-content { background: rgba(15, 23, 42, 0.98) !important; border: 1px solid rgba(255,255,255,0.15) !important; border-radius: 12px !important; box-shadow: 0 12px 40px rgba(0,0,0,0.8) !important; backdrop-filter: blur(16px) !important; padding: 0 !important; max-width: 92vw !important; width: min(320px, 92vw) !important; min-width: 200px !important; box-sizing: border-box !important; overflow: hidden !important; } .custom-popup .maplibregl-popup-tip { border-top-color: rgba(15, 23, 42, 0.98) !important; }`}</style>

        </div>
    );
}
