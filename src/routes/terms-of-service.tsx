import { createFileRoute } from "@tanstack/react-router";
import Terms from "@/pages/Terms";

export const Route = createFileRoute("/terms-of-service")({
  head: () => ({
    meta: [
      { title: "Пользовательское соглашение — Nova" },
      { name: "description", content: "Пользовательское соглашение мессенджера Nova: правила использования, запрещённый контент, модерация, ответственность и порядок рассмотрения жалоб." },
    ],
  }),
  component: Terms,
});
