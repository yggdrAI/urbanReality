import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function EconomicImpact({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 10}} />
        <Tooltip 
            contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}}
            itemStyle={{color: '#fff'}}
            cursor={{fill: 'rgba(255,255,255,0.05)'}}
        />
        <Bar dataKey="loss" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.name === 'AQI' ? '#eab308' : entry.name === 'Flood' ? '#3b82f6' : '#ef4444'} />
            ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}