const API_ALERTA = "http://localhost:3000";

const tokenAlerta = localStorage.getItem("token");
const chatAbierto = Number(new URLSearchParams(window.location.search).get("chatId"));

const sonarUrgencia = () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const audio = new AudioCtx();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.value = 880;
  gain.gain.value = 0.08;
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.6);
  osc.onended = () => audio.close();
};

const mostrarBloqueo = (payload) => {
  if (document.getElementById("alerta-urgente-bloqueo")) return;

  document.title = "URGENTE — atender estudiante";
  sonarUrgencia();

  const overlay = document.createElement("div");
  overlay.id = "alerta-urgente-bloqueo";
  overlay.setAttribute("role", "alertdialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:9999",
    "background:#7f1d1d",
    "color:#fff",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:24px",
  ].join(";");

  const nombre = payload.estudianteNombre || "Un estudiante";
  const mensaje = payload.mensaje || "";
  overlay.innerHTML = `
    <div style="max-width:560px;text-align:center">
      <p style="letter-spacing:.2em;font-weight:800;margin:0 0 12px">URGENTE</p>
      <h1 style="font-size:32px;line-height:1.2;margin:0 0 16px">Atiende a ${nombre} ahora</h1>
      <p style="font-size:18px;margin:0 0 28px">${mensaje}</p>
      <button id="alerta-urgente-abrir" type="button" style="background:#fff;color:#7f1d1d;border:0;border-radius:8px;padding:14px 22px;font-size:16px;font-weight:800;cursor:pointer">
        Abrir chat ahora
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("alerta-urgente-abrir").addEventListener("click", () => {
    const destino = `chat-urgente.html?chatId=${encodeURIComponent(payload.chatId)}`;
    window.location.href = destino;
  });
};

if (tokenAlerta && window.io) {
  const socket = window.io(API_ALERTA, {
    auth: { token: tokenAlerta },
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    if (Number.isInteger(chatAbierto) && chatAbierto > 0) {
      socket.emit("alerta_atendida", { chatId: chatAbierto });
    }
  });

  socket.on("alerta_urgente", (payload) => {
    if (!payload || payload.urgente !== true) return;
    if (payload.chatId === chatAbierto) return;
    mostrarBloqueo(payload);
  });
}
