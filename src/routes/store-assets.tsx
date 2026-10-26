import { createFileRoute } from "@tanstack/react-router";
import StoreAssets from "@/pages/StoreAssets";

export const Route = createFileRoute("/store-assets")({
  head: () => ({ meta: [{ title: "Скриншоты Nova для магазина" }] }),
  component: StoreAssets,
});
