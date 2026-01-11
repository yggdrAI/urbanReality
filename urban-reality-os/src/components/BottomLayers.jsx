import { useState } from "react";

export default function BottomLayers({ layers, setLayers, mapStyle, setMapStyle }) {
  const [hover, setHover] = useState(false);

  const items = [
    { id: 'map', label: 'Map' },
    { id: 'satellite', label: 'Satellite' },
    { id: 'terrain', label: 'Terrain' },
    { id: 'traffic', label: 'Traffic' }
  ];

  const selected = mapStyle === 'satellite' ? 'satellite' : mapStyle === 'terrain' ? 'terrain' : (layers.traffic ? 'traffic' : 'map');

  const handleSelect = (id) => {
    if (id === 'satellite') setMapStyle(mapStyle === 'satellite' ? 'default' : 'satellite');
    else if (id === 'terrain') setMapStyle(mapStyle === 'terrain' ? 'default' : 'terrain');
    else if (id === 'traffic') setLayers(prev => ({ ...prev, traffic: !prev.traffic }));
    else {
      // map selected: reset to default
      setMapStyle('default');
    }
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        bottom: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div style={{
        display: 'flex',
        gap: hover ? 10 : 0,
        alignItems: 'center',
        transition: 'all 220ms ease',
        background: 'transparent'
      }}>
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => handleSelect(item.id)}
            style={{
              width: hover ? 64 : 120,
              height: 56,
              borderRadius: 12,
              border: item.id === selected ? '2px solid #0ea5e9' : '1px solid rgba(0,0,0,0.08)',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 220ms ease',
              cursor: 'pointer',
              overflow: 'hidden'
            }}
            title={item.label}
          >
            {hover ? (
              <div style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: item.id === 'traffic' ? '#ef4444' : '#0ea5e9' }} />
                <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{item.id === selected ? item.label : selected === 'map' ? 'Map' : item.label}</div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
