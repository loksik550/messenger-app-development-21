const CACHE = "nova-v12";
// Иконка уведомлений — иконка приложения из public (доступна по абсолютному URL origin).
const NOTIF_ICON = new URL("/app-icon-192.png", self.location.origin).href;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["/"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Пользователь нажал «Обновить» — активируем новый SW немедленно.
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("functions.poehali.dev")) return;
  if (e.request.url.includes("fonts.googleapis.com")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || fetch(e.request)))
  );
});

// ── Push уведомления ──────────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;
  let data = {};
  try { data = JSON.parse(e.data.text()); } catch { data = { title: "Nova", body: e.data.text() }; }

  const isCall = data.is_call === true;

  const options = isCall ? {
    body: data.body || "Входящий звонок",
    icon: NOTIF_ICON,
    badge: NOTIF_ICON,
    image: data.image,
    vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500],
    tag: data.tag || `call_${data.call_id}`,
    requireInteraction: true,
    renotify: true,
    silent: false,
    timestamp: Date.now(),
    data: { call_id: data.call_id, is_call: true, url: "/", from_name: data.from_name || data.title },
    actions: [
      { action: "answer", title: "Ответить" },
      { action: "decline", title: "Отклонить" },
    ],
  } : {
    body: data.body || "Новое сообщение",
    icon: NOTIF_ICON,
    badge: NOTIF_ICON,
    vibrate: [200, 100, 200],
    tag: data.tag || `msg_${data.chat_id || "x"}`,
    renotify: true,
    silent: false,
    timestamp: Date.now(),
    data: { chat_id: data.chat_id, url: "/" },
  };

  e.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = list.find((c) => c.visibilityState === "visible" && c.focused);
      if (visible) {
        if (isCall) {
          // Приложение открыто — сразу показываем экран входящего вызова внутри приложения
          visible.postMessage({ type: "incoming_call", call_id: data.call_id });
          return;
        }
        // Входящее сообщение — рендерим in-app тост, без системного уведомления
        visible.postMessage({ type: "in_app_message", chat_id: data.chat_id, title: data.title || "Nova", body: options.body });
        return;
      }
      await self.registration.showNotification(data.title || "Nova", options);
    })()
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const notifData = e.notification.data || {};

  // Отклонить звонок — просто закрываем уведомление
  if (e.action === "decline") return;

  // Если это звонок — открываем приложение с call_id в URL,
  // чтобы экран вызова открылся даже если приложение было закрыто.
  const callQuery = notifData.is_call && notifData.call_id
    ? `/?call_id=${encodeURIComponent(notifData.call_id)}`
    : "/";

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Найти открытое окно и передать сообщение
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          if (notifData.is_call) {
            client.postMessage({ type: "incoming_call", call_id: notifData.call_id });
          }
          return client.focus();
        }
      }
      return clients.openWindow(callQuery);
    })
  );
});