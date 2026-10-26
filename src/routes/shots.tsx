import { createFileRoute } from "@tanstack/react-router";
import Shots from "@/pages/Shots";

export const Route = createFileRoute("/shots")({
  head: () => ({ meta: [{ title: "Nova — экраны" }] }),
  component: Shots,
});
