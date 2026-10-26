import { createFileRoute } from "@tanstack/react-router";
import DevPanel from "@/pages/DevPanel";

export const Route = createFileRoute("/dev")({
  ssr: false,
  component: DevPanel,
});
