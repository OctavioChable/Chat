// Bloque: Paquete donde se encuentra la clase del servidor
package servidor;

// Bloque: Importación de librerías necesarias para WebSocket y utilidades
import jakarta.websocket.*; // Línea: Importa las clases principales de WebSocket
import jakarta.websocket.server.ServerEndpoint; // Línea: Permite definir un endpoint de servidor WebSocket
import java.util.*; // Línea: Importa utilidades generales de Java como Map y HashMap
import java.util.concurrent.ConcurrentHashMap; // Línea: Importa la implementación concurrente de HashMap
import com.google.gson.Gson; // Línea: Importa la librería Gson para trabajar con JSON

// Bloque: Definición del endpoint WebSocket en la ruta "/Server"
@ServerEndpoint("/Server")
public class Servidor {

    // Bloque: Mapa concurrente para almacenar todas las sesiones activas de usuarios
    private static Map<String, Session> sesiones = new ConcurrentHashMap<>();

    // Bloque: Objeto Gson para convertir mensajes entre JSON y objetos Java
    private static Gson gson = new Gson();

    // Bloque: Método que se ejecuta cuando un nuevo cliente se conecta al servidor
    @OnOpen
    public void onOpen(Session session) {
        // Línea: Se agrega la nueva sesión al mapa de sesiones activas
        sesiones.put(session.getId(), session);

        // Línea: Se crea un mapa con información de bienvenida
        Map<String, Object> bienvenida = new HashMap<>();

        // Línea: Se marca el mensaje como proveniente del sistema
        bienvenida.put("sistema", true);

        // Línea: Se indica el tipo de mensaje como "bienvenida"
        bienvenida.put("tipo", "bienvenida");

        // Línea: Se incluye el ID de la sesión recién conectada
        bienvenida.put("id", session.getId());

        // Línea: Se envía el mensaje de bienvenida al cliente en formato JSON
        session.getAsyncRemote().sendText(gson.toJson(bienvenida));
    }

    // Bloque: Método que se ejecuta cuando el servidor recibe un mensaje de un cliente
    @OnMessage
    public void onMessage(String message, Session session) {
        // Línea: Se convierte el mensaje JSON recibido en un mapa de datos
        Map<String, Object> data = gson.fromJson(message, Map.class);

        // Bloque: Condicional para manejar mensajes relacionados con WebRTC (video)
        if (data.containsKey("webrtc")) {
            // Línea: Se obtiene el ID del destinatario desde el mensaje
            String destinoId = String.valueOf(data.get("para"));

            // Línea: Se busca la sesión correspondiente al destinatario
            Session destino = sesiones.get(destinoId);

            // Línea: Si la sesión existe y está abierta, se envía el mensaje solo a ese destinatario
            if (destino != null && destino.isOpen()) {
                destino.getAsyncRemote().sendText(message);
            }
        } else {
            // Bloque: Si el mensaje no es de WebRTC, se envía a todos los usuarios conectados (broadcast)
            for (Session s : sesiones.values()) {
                // Línea: Si la sesión está abierta, se envía el mensaje recibido
                if (s.isOpen()) {
                    s.getAsyncRemote().sendText(message);
                }
            }
        }
    }

    // Bloque: Método que se ejecuta cuando un cliente se desconecta (cierra pestaña, recarga, pierde conexión)
    @OnClose
    public void onClose(Session session, CloseReason reason) {

        // Línea: Se elimina la sesión del usuario desconectado del mapa de sesiones activas
        sesiones.remove(session.getId());

        // Línea: Se crea un mapa para enviar un mensaje a todos indicando que un usuario salió
        Map<String, Object> salida = new HashMap<>();

        // Línea: Se marca el mensaje como proveniente del sistema
        salida.put("sistema", true);

        // Línea: Se indica el tipo de mensaje como "usuario_salio"
        salida.put("tipo", "usuario_salio");

        // Línea: Se incluye el ID de la sesión que se desconectó
        salida.put("id", session.getId());

        // Línea: Se convierte el mensaje de salida a JSON
        String jsonSalida = gson.toJson(salida);

        // Bloque: Se envía el mensaje de salida a todos los usuarios que siguen conectados
        for (Session s : sesiones.values()) {
            // Línea: Si la sesión está abierta, se envía el mensaje
            if (s.isOpen()) {
                s.getAsyncRemote().sendText(jsonSalida);
            }
        }

        // Línea: Se imprime en consola información de depuración sobre la desconexión
        System.out.println("Usuario desconectado: " + session.getId() + " motivo: " + reason);
    }

    // Bloque: Método que se ejecuta cuando ocurre un error en una conexión WebSocket
    @OnError
    public void onError(Session session, Throwable throwable) {

        // Bloque: Validación para evitar NullPointerException si la sesión viene nula
        if (session != null) {

            // Línea: Se elimina la sesión del usuario con error del mapa de sesiones activas
            sesiones.remove(session.getId());

            // Línea: Se crea un mapa para enviar un mensaje a todos indicando que un usuario salió por error
            Map<String, Object> salida = new HashMap<>();

            // Línea: Se marca el mensaje como proveniente del sistema
            salida.put("sistema", true);

            // Línea: Se indica el tipo de mensaje como "usuario_salio"
            salida.put("tipo", "usuario_salio");

            // Línea: Se incluye el ID de la sesión que tuvo el error
            salida.put("id", session.getId());

            // Línea: Se convierte el mensaje de salida a JSON
            String jsonSalida = gson.toJson(salida);

            // Bloque: Se envía el mensaje de salida a todos los usuarios que siguen conectados
            for (Session s : sesiones.values()) {
                // Línea: Si la sesión está abierta, se envía el mensaje
                if (s.isOpen()) {
                    s.getAsyncRemote().sendText(jsonSalida);
                }
            }

            // Línea: Se imprime en consola el ID de la sesión donde ocurrió el error
            System.out.println("Error en sesión: " + session.getId());
        }

        // Línea: Se imprime el error completo en consola para depuración
        throwable.printStackTrace();
    }

}
