// Firebase Cloud Messaging Service Worker
// Recibe notificaciones push en background y las muestra como notificación nativa

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID",
});

const messaging = firebase.messaging();

// Notificación cuando la app está en background
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || "SISMOVIGÍA", {
    body: body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.event_id || "sismex-alert",
    data: data,
    actions: [
      { action: "open", title: "Ver evento" },
      { action: "dismiss", title: "Cerrar" },
    ],
  });
});

// Click en la notificación
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const eventId = event.notification.data?.event_id;
  const url = eventId ? `/?event=${eventId}` : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Si ya hay una ventana abierta, enfocarla
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Si no, abrir nueva ventana
      return clients.openWindow(url);
    })
  );
});