import { createFileRoute } from "@tanstack/react-router";
import Banner from "@/pages/Banner";

export const Route = createFileRoute("/banner")({
  head: () => ({ meta: [{ title: "Nova — обложка" }] }),
  component: Banner,
});
