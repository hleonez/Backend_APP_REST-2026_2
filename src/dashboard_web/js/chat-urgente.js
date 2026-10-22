const API_CHAT = "http://localhost:3000";
const tokenChat = localStorage.getItem("token");
const chatId = Number(new URLSearchParams(window.location.search).get("chatId"));
const lista = document.getElementById("mensajes");
const formulario = document.getElementById("formulario");
const entrada = document.getElementById("entrada");

const idDesdeToken = (token) => {
  try {
    const parte = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(parte.padEnd(Math.ceil(parte.length / 4) * 4, "="));
    return JSON.parse(json).id;
  } catch {
    return null;
  }
};

const miId = tokenChat ? idDesdeToken(tokenChat) : null;
const vistos = new Set();

const pintar = (mensaje) => {
  if (!mensaje || vistos.has(mensaje.id)) return;
  if (mensaje.id != null) vistos.add(mensaje.id);
  const propio = miId != null && mensaje.usuario_id === miId || mensaje.userId === miId;
  const burbuja = document.createElement("article");
  burbuja.className = propio
    ? "ml-auto max-w-[80%] rounded-lg bg-white text-red-950 px-3 py-2"
    : "mr-auto max-w-[80%] rounded-lg bg-red-800 px-3 py-2";
  burbuja.textContent = mensaje.mensaje;
  lista.appendChild(burbuja);
  lista.scrollTop = lista.scrollHeight;
};

const cargarHistorial = async () => {
  const respuesta = await fetch(`${API_CHAT}/api/chats/${chatId}/mensajes`, {
    headers: { Authorization: `Bearer ${tokenChat}` },
  });
  if (!respuesta.ok) {
    pintar({ id: "error", mensaje: "No se pudo abrir el chat.", usuario_id: null });
    return;
  }
  const mensajes = await respuesta.json();
  mensajes.reverse().forEach((mensaje) => pintar(mensaje));
};

if (!tokenChat || !Number.isInteger(chatId) || chatId <= 0) {
  pintar({ id: "error", mensaje: "Falta la sesión o el chat.", usuario_id: null });
} else {
  cargarHistorial();
  const socket = window.io(API_CHAT, {
    auth: { token: tokenChat },
    transports: ["websocket"],
  });
  socket.on("connect", () => {
    socket.emit("join_chat", chatId);
    socket.emit("alerta_atendida", { chatId });
  });
  socket.on("new_message", (mensaje) => {
    if (Number(mensaje.chatId) !== chatId) return;
    pintar(mensaje);
  });
  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const texto = entrada.value.trim();
    if (!texto) return;
    socket.emit("chat_message", { chatId, mensaje: texto });
    entrada.value = "";
  });
}
