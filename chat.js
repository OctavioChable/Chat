// abre un canal de comunicación en tiempo real entre el navegador y el servidor GlassFish.
let conexion = new WebSocket("ws://192.168.1.106:8080/ChatTexto/chat"); 

//hace que los mensajes entrantes aparescan en el html
conexion.onmessage = function(evento) {
    let divMensajes = document.getElementById("mensajes");
    divMensajes.innerHTML += "<p>" + evento.data + "</p>";
};

//envia el mensaje del campo a traves del websocket 
function enviarMensaje() {
    let entrada = document.getElementById("entrada");
    conexion.send(entrada.value);
    entrada.value = "";
}
