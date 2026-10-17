export default function DevToggle({
  on,
  size = "md",
  className = "",
}: {
  on: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const track = size === "sm" ? "w-9 h-5" : "w-11 h-6";
  const knob = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <span
      className={`relative inline-flex ${track} shrink-0 items-center rounded-full p-0.5 transition-colors ${
        on ? "bg-violet-500 justify-end" : "bg-white/15 justify-start"
      } ${className}`}
      aria-hidden
    >
      <span className={`${knob} rounded-full bg-white shadow-sm shadow-black/30`} />
    </span>
  );
}
