import { createFileRoute } from "@tanstack/react-router";
import Privacy from "@/pages/Privacy";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Политика конфиденциальности — Nova" },
      { name: "description", content: "Политика конфиденциальности Nova — мессенджера для общения: какие данные обрабатываются, регистрация по номеру телефона и имени, хранение в РФ согласно 152-ФЗ." },
    ],
  }),
  component: Privacy,
});
