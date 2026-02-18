// --- CONFIGURACIÓN DINÁMICA ---
// Bloque: Configuración inicial de WebSocket y WebRTC
const URL_WS = "wss://overfervently-optimal-claud.ngrok-free.dev/ChatTexto/Server"; // Línea: URL del servidor WebSocket
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }; // Línea: Configuración de servidores STUN para WebRTC

let socket, miId, miNombre, localStream; // Línea: Variables globales para conexión y usuario
let micActivo = true; // Línea: Estado inicial del micrófono
let camActiva = true; // Línea: Estado inicial de la cámara
const peerConnections = {}; // Línea: Objeto para almacenar conexiones WebRTC con otros usuarios

// --- REFERENCIAS UI ---
// Bloque: Referencias a elementos de la interfaz gráfica
const mensajesDiv = document.getElementById("mensajes"); // Línea: Contenedor de mensajes de chat
const entradaChat = document.getElementById("entrada"); // Línea: Campo de entrada de texto
const btnEmoji = document.getElementById("btnEmojiToggle"); // Línea: Botón para mostrar/ocultar emojis
const emojiMatrix = document.getElementById("emoji-matrix"); // Línea: Contenedor de emojis

// --- INICIO DE APP ---
// Bloque: Evento de inicio cuando el usuario entra a la aplicación
document.getElementById("btnEntrar").onclick = async () => {
    miNombre = document.getElementById("inputNombre").value.trim(); // Línea: Obtiene el nombre ingresado
    if (miNombre) {
        document.getElementById("tag-local").innerText = miNombre + " (Tú)"; // Línea: Muestra el nombre local
        document.getElementById("pantalla-inicio").style.display = "none"; // Línea: Oculta la pantalla de inicio

        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); // Línea: Captura video y audio del usuario
        document.getElementById("localVideo").srcObject = localStream; // Línea: Asigna el stream local al video propio

        conectarWS(); // Línea: Inicia conexión WebSocket
        Medios(); // Línea: Configura estados iniciales de micrófono y cámara
    }
};

// --- CONEXIÓN WEBSOCKET ---
// Bloque: Función para conectar al servidor WebSocket
function conectarWS() {
    socket = new WebSocket(URL_WS); // Línea: Crea conexión WebSocket
    configurarEventosWS(); // Línea: Configura eventos de cierre de conexión

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data); // Línea: Convierte mensaje recibido en objeto JSON

        // --- LÓGICA DE CHAT ---
        if (data.chat) {
            agregarBurbuja(data.texto, data.nombre === miNombre, data.nombre); // Línea: Agrega burbuja de chat
        }

        // --- AVISOS DEL SISTEMA ---
        if (data.sistema) {

            // Bloque: Mensaje de bienvenida del servidor
            if (data.tipo === "bienvenida") {
                miId = data.id; // Línea: Guarda el ID asignado por el servidor
                socket.send(JSON.stringify({ sistema: true, tipo: "nuevo_usuario", id: miId, nombre: miNombre })); // Línea: Notifica nuevo usuario
            }

            // Bloque: Evento cuando entra un nuevo usuario
            if (data.tipo === "nuevo_usuario" && data.id !== miId) {
                llamarUsuario(data.id, data.nombre); // Línea: Inicia llamada con nuevo usuario
            }

            // Bloque: Evento cuando un usuario sale (recibe del servidor)
            if (data.tipo === "usuario_salio") {

                // Línea: Evita ejecutar lógica si el ID recibido es el del mismo usuario
                if (data.id === miId) return;

                // Línea: Elimina contenedor de video del usuario que salió
                document.getElementById("cont-" + data.id)?.remove();

                // Línea: Si existe una conexión WebRTC con ese usuario, se cierra correctamente
                peerConnections[data.id]?.close();

                // Línea: Se elimina la conexión del objeto global
                delete peerConnections[data.id];
            }
        }

        // --- LÓGICA WEBRTC (VIDEO) ---
        if (data.webrtc && data.para === miId) {
            const { de, tipo, contenido, nombreRemoto } = data; // Línea: Extrae datos de señalización
            if (!peerConnections[de]) crearPeer(de, nombreRemoto); // Línea: Crea conexión si no existe
            const pc = peerConnections[de]; // Línea: Obtiene conexión existente

            if (tipo === "offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(contenido)); // Línea: Aplica oferta remota
                const answer = await pc.createAnswer(); // Línea: Crea respuesta
                await pc.setLocalDescription(answer); // Línea: Aplica respuesta local
                enviarSenal(de, "answer", answer); // Línea: Envía respuesta al usuario remoto
            } else if (tipo === "answer") {
                await pc.setRemoteDescription(new RTCSessionDescription(contenido)); // Línea: Aplica respuesta remota
            } else if (tipo === "candidate") {
                await pc.addIceCandidate(new RTCIceCandidate(contenido)); // Línea: Agrega candidato ICE
            }
        }
    };
}

// --- FUNCIONES DE CHAT ---
// Bloque: Funciones para enviar y mostrar mensajes de chat
function enviarChat() {
    const texto = entradaChat.value.trim(); // Línea: Obtiene texto del campo de entrada
    if (texto !== "" && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ chat: true, texto: texto, nombre: miNombre })); // Línea: Envía mensaje al servidor
        entradaChat.value = ""; // Línea: Limpia campo de entrada
        entradaChat.focus(); // Línea: Devuelve foco al campo
    }
}

function agregarBurbuja(texto, propio, nombre) {
    const b = document.createElement("div"); // Línea: Crea nuevo div para burbuja
    b.className = "burbuja " + (propio ? "propio" : "ajeno"); // Línea: Asigna clase según origen
    b.innerHTML = `<span class="nombre-chat">${nombre}</span>${texto}`; // Línea: Contenido de la burbuja
    mensajesDiv.appendChild(b); // Línea: Agrega burbuja al contenedor
    mensajesDiv.scrollTop = mensajesDiv.scrollHeight; // Línea: Desplaza scroll hacia abajo
}

// --- EMOJIS ---
// Bloque: Funciones para mostrar y seleccionar emojis
btnEmoji.onclick = (e) => {
    const isVisible = emojiMatrix.style.display === "grid"; // Línea: Verifica estado actual
    emojiMatrix.style.display = isVisible ? "none" : "grid"; // Línea: Alterna visibilidad
    e.stopPropagation(); // Línea: Evita propagación del evento
};

emojiMatrix.querySelectorAll("span").forEach(s => {
    s.onclick = () => {
        entradaChat.value += s.innerText; // Línea: Agrega emoji al campo de entrada
        emojiMatrix.style.display = "none"; // Línea: Oculta matriz de emojis
        entradaChat.focus(); // Línea: Devuelve foco al campo
    };
});

// --- VIDEO Y SEÑALIZACIÓN ---
// Bloque: Funciones para crear y manejar conexiones WebRTC
function crearPeer(idRemoto, nombreRemoto) {
    const pc = new RTCPeerConnection(config); // Línea: Crea nueva conexión WebRTC
    peerConnections[idRemoto] = pc; // Línea: Guarda conexión en objeto global
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream)); // Línea: Agrega tracks locales

    pc.ontrack = (event) => {
        if (!document.getElementById("cont-" + idRemoto)) {
            const cont = document.createElement("div"); // Línea: Crea contenedor de video remoto
            cont.id = "cont-" + idRemoto; // Línea: Asigna ID único
            cont.className = "video-container"; // Línea: Clase CSS para estilo
            cont.innerHTML = `<video id="v-${idRemoto}" autoplay playsinline></video>
                              <div class="etiqueta-nombre">${nombreRemoto}</div>`; // Línea: Video y etiqueta de nombre
            document.getElementById("video-grid").appendChild(cont); // Línea: Agrega contenedor al grid
            document.getElementById("v-" + idRemoto).srcObject = event.streams[0]; // Línea: Asigna stream remoto al video
        }
    };

    // Bloque: Evento cuando se genera un candidato ICE para conectividad
    pc.onicecandidate = (e) => {
        if (e.candidate) enviarSenal(idRemoto, "candidate", e.candidate); // Línea: Envía candidatos ICE
    };

    return pc; // Línea: Devuelve la conexión creada
}

async function llamarUsuario(idRemoto, nombreRemoto) {
    const pc = crearPeer(idRemoto, nombreRemoto); // Línea: Crea conexión con usuario remoto
    const offer = await pc.createOffer(); // Línea: Genera oferta
    await pc.setLocalDescription(offer); // Línea: Aplica oferta local
    enviarSenal(idRemoto, "offer", offer); // Línea: Envía oferta al usuario remoto
}

function enviarSenal(para, tipo, contenido) {
    socket.send(JSON.stringify({ webrtc: true, de: miId, para: para, tipo, contenido, nombreRemoto: miNombre })); // Línea: Envía señalización WebRTC
}

// --- VINCULACIÓN DE BOTONES ---
// Bloque: Asignación de eventos a botones de la interfaz para enviar mensajes y controlar medios

document.getElementById("btnEnviar").onclick = enviarChat; // Línea: Botón de enviar mensaje ejecuta la función enviarChat
entradaChat.onkeypress = (e) => { if (e.key === 'Enter') enviarChat(); }; // Línea: Permite enviar mensaje al presionar Enter

document.getElementById("btnMute").onclick = function () {
    // Bloque: Alterna el estado del micrófono desde el botón principal
    if (localStream) {
        micActivo = !micActivo; // Línea: Cambia el estado del micrófono
        localStream.getAudioTracks()[0].enabled = micActivo; // Línea: Activa o desactiva pista de audio
        this.innerHTML = micActivo ? "&#x1F3A4;" : "&#128263;"; // Línea: Cambia icono del botón
        this.style.backgroundColor = micActivo ? "" : "#ff4444"; // Línea: Cambia color de fondo según estado
    }
};

document.getElementById("btnCam").onclick = function () {
    // Bloque: Alterna el estado de la cámara desde el botón principal
    if (localStream) {
        camActiva = !camActiva; // Línea: Cambia el estado de la cámara
        localStream.getVideoTracks()[0].enabled = camActiva; // Línea: Activa o desactiva pista de video
        this.innerHTML = camActiva ? "&#128247;" : "&#128683;"; // Línea: Cambia icono del botón
        this.style.backgroundColor = camActiva ? "" : "#ff4444"; // Línea: Cambia color de fondo según estado
    }
};

document.getElementById("btnMicro").onclick = function () {
    // Bloque: Botón alternativo para micrófono
    micActivo = !micActivo; // Línea: Cambia estado del micrófono
    this.innerHTML = micActivo ? "&#x1F3A4;" : "&#128263;"; // Línea: Cambia icono del botón
    this.style.backgroundColor = micActivo ? "" : "#0e0c0c"; // Línea: Cambia color de fondo según estado
};

document.getElementById("btnCamara").onclick = function () {
    // Bloque: Botón alternativo para cámara
    camActiva = !camActiva; // Línea: Cambia estado de la cámara
    this.innerHTML = camActiva ? "&#128247;" : "&#128683;"; // Línea: Cambia icono del botón
    this.style.backgroundColor = camActiva ? "" : "#0e0c0c"; // Línea: Cambia color de fondo según estado
};

// --- FUNCIÓN DE MEDIOS ---
// Bloque: Configura estados iniciales de micrófono y cámara en la interfaz
function Medios() {
    if (localStream) {
        localStream.getAudioTracks()[0].enabled = micActivo; // Línea: Aplica estado actual del micrófono
        localStream.getVideoTracks()[0].enabled = camActiva; // Línea: Aplica estado actual de la cámara

        document.getElementById("btnMute").innerHTML = micActivo ? "&#x1F3A4;" : "&#128263;"; // Línea: Actualiza icono del botón de micrófono
        document.getElementById("btnMute").style.backgroundColor = micActivo ? "" : "#ff4444"; // Línea: Cambia color de fondo según estado

        document.getElementById("btnCam").innerHTML = camActiva ? "&#128247;" : "&#128683;"; // Línea: Actualiza icono del botón de cámara
        document.getElementById("btnCam").style.backgroundColor = camActiva ? "" : "#ff4444"; // Línea: Cambia color de fondo según estado
    }
}

// --- FUNCIÓN PARA CERRAR SOCKET ---
// Bloque: Cierra la conexión WebSocket y actualiza la interfaz
function cerrarWS() {
    if (socket && socket.readyState === WebSocket.OPEN) {

        // Línea: Notifica al servidor que el usuario salió
        socket.send(JSON.stringify({ sistema: true, tipo: "usuario_salio", id: miId }));

        // Línea: Cierra la conexión WebSocket
        socket.close();
    }

    // Bloque: Si existe el stream local, se detienen los tracks para liberar cámara y micrófono
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    // Bloque: Se cierran todas las conexiones WebRTC existentes
    for (const id in peerConnections) {
        peerConnections[id]?.close();
        delete peerConnections[id];
    }

    // Línea: Oculta pantalla de inicio
    document.getElementById("pantalla-inicio").style.display = "none";

    // Línea: Oculta grid de video
    document.getElementById("video-grid").style.display = "none";

    // Línea: Oculta contenedor de chat
    document.getElementById("chat-container").style.display = "none";

    // Línea: Asegura que modal de salida esté visible
    document.getElementById("modalSalida").style.display = "flex";
}

// --- MANEJO DEL EVENTO DE CIERRE ---
// Bloque: Configura evento cuando la conexión WebSocket se cierra
function configurarEventosWS() {
    socket.onclose = () => {
        console.log("Conexión WebSocket cerrada"); // Línea: Mensaje en consola
        mensajesDiv.innerHTML += `<div class="sistema">Has salido de la sala</div>`; // Línea: Mensaje en interfaz
        mensajesDiv.scrollTop = mensajesDiv.scrollHeight; // Línea: Ajusta scroll al final
    };
}

// --- VINCULACIÓN CON LA INTERFAZ ---
// Bloque: Asigna evento de salida al botón correspondiente
document.getElementById("btnSalir").onclick = cerrarWS; // Línea: Botón de salir ejecuta función cerrarWS

// --- SALIDA AUTOMÁTICA AL CERRAR PESTAÑA ---
// Bloque: Detecta cuando el usuario recarga o cierra la pestaña
window.addEventListener("pagehide", () => {

    // Bloque: Verifica que exista un socket y esté conectado
    if (socket && socket.readyState === WebSocket.OPEN) {

        // Línea: Envía al servidor el mensaje indicando que el usuario salió
        socket.send(JSON.stringify({ sistema: true, tipo: "usuario_salio", id: miId }));

        // Línea: Cierra la conexión WebSocket
        socket.close();
    }

    // Bloque: Si existe el stream local, se detienen los tracks para liberar cámara y micrófono
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    // Bloque: Se cierran todas las conexiones WebRTC existentes
    for (const id in peerConnections) {
        peerConnections[id]?.close();
        delete peerConnections[id];
    }
});
