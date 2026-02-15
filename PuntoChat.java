/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package servidor;

/**
 *
 * @author octav
 */

import modelo.Mensaje;
import jakarta.websocket.*;
import jakarta.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

@ServerEndpoint("/chat")
public class PuntoChat {

    private static Set<Session> sesiones = new CopyOnWriteArraySet<>();

    @OnOpen
    public void alAbrir(Session sesion) throws IOException{
        sesiones.add(sesion);
        sesion.getBasicRemote().sendText("Bienvenido");
        System.out.println("Nueva conexión: " + sesion.getId());
    }

    @OnMessage
    public void alRecibir(String mensaje, Session sesion) throws IOException {
        
        for (Session s : sesiones) {
            if (s.isOpen()) {
                s.getBasicRemote().sendText(mensaje);
            }
        }
    }

    @OnClose
    public void alCerrar(Session sesion) {
        sesiones.remove(sesion);
        System.out.println("Conexión cerrada: " + sesion.getId());
    }

    @OnError
    public void alError(Session sesion, Throwable error) {
        System.out.println("Error en sesión " + sesion.getId() + ": " + error.getMessage());
    }
}
