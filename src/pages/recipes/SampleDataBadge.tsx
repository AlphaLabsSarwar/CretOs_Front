// Marks the Recipe Store screens as running on sample data (lib/recipes.ts),
// so nobody reads them as live plant figures. Remove once the API is wired.
export default function SampleDataBadge() {
  return (
    <span
      title="The Recipe Store has no backend yet — these screens show sample data."
      className="rounded-full border border-dashed border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-amber-700"
    >
      Sample data
    </span>
  )
}
