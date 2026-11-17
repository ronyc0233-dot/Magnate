# Magnate

Juego de mesa de propiedades en línea para 2 a 8 jugadores (Node.js + Socket.io).
El anfitrión elige el dinero inicial ($1500 a $5000).

**Regla especial:** se puede construir en cualquier calle propia sin tener el grupo de color completo
y sin construir parejo. Siempre hacen falta 4 casas antes de poner un hotel.

## Jugar en tu PC

```
npm install
npm start
```

Abre http://localhost:3000

## Publicar gratis en Render

1. Crea un repositorio en GitHub (por ejemplo `magnate`) y sube todos los archivos de esta carpeta
   **excepto `node_modules`**. Desde la web de GitHub puedes usar "Add file → Upload files" y arrastrar el contenido.
2. Entra a https://render.com, inicia sesión con tu cuenta de GitHub.
3. Pulsa **New → Blueprint**, elige el repositorio. Render lee `render.yaml` y crea el servicio.
   (También sirve **New → Web Service**: Build `npm install`, Start `npm start`, plan Free.)
4. Cuando termine, Render te da una dirección como `https://magnate-xxxx.onrender.com`. Compártela.

Notas del plan gratuito: el servidor se duerme tras 15 minutos sin visitas y tarda ~1 minuto
en despertar. Las partidas se guardan en memoria: si el servidor se reinicia o se duerme, las salas se pierden.
