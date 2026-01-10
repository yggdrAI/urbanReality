import { BarChart, Bar, XAxis, Tooltip } from "recharts";

export default function EconomicImpact({ data }) {
  return (
    <BarChart width={300} height={200} data={data}>
      <XAxis dataKey="name" />
      <Tooltip />
      <Bar dataKey="loss" fill="#ef4444" />
    </BarChart>
  );
}
