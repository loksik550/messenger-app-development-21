import { createFileRoute } from "@tanstack/react-router";
import VkCallback from "@/pages/VkCallback";

export const Route = createFileRoute("/vk-callback")({
  component: VkCallback,
});
