// Simple determinate-looking progress bar. Since most of these operations
// don't report real progress from the server, `percent` is usually driven
// by a simulated ease-out ticker (see useSimulatedProgress) rather than a
// true byte/step count — good enough to reassure the user something is
// happening during a multi-second API call.
export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-[#1A73E8] transition-all duration-300 ease-out rounded-full"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
