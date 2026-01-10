export default function InfoPanel({ selected }) {
  if (!selected) return null;

  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <h3 className="font-bold text-xl">{selected.title}</h3>
      <p className="text-sm text-gray-300 mt-2">{selected.description}</p>

      <div className="mt-4">
        <p>Reality Gap: <b>{selected.gap}%</b></p>
        <p>People Affected: <b>{selected.people}</b></p>
        <p>Economic Loss: <b>₹{selected.loss} Cr/year</b></p>
      </div>
    </div>
  );
}
