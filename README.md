# NEXA IPTV

Reproductor IPTV **privado, local y sin cuentas**. SPA que importa, organiza y reproduce tus propias listas M3U/M3U8, con copia local persistente en IndexedDB.

> NEXA IPTV no incluye ni proporciona canales. Usa únicamente fuentes que tengas autorización para reproducir. No hay telemetría, registro ni servidores propios; ninguna lista sale de tu navegador.

## Puesta en marcha

```bash
npm install
npm run dev        # desarrollo (http://localhost:5173)
npm run build      # genera dist/index.html (archivo único autocontenido)
npm run preview    # sirve la build
npx vitest run     # ejecuta las pruebas automatizadas
```

`dist/index.html` es **un único archivo** con JS, CSS, hls.js, mpegts.js y el Web Worker del parser incrustados: no hay CDNs ni peticiones obligatorias a servicios externos. Se puede servir con cualquier servidor HTTP sencillo (`npx serve dist`, `python -m http.server`…).

### Nota sobre los iconos
La especificación pedía iconos «Horoicons». Ese paquete no existe en el registro de npm; se interpretó como una errata de **Heroicons** (set SVG outline/solid de Tailwind), usado en exclusiva. No hay emojis ni iconos Unicode.

## Stack
React 19 · TypeScript · Vite · Tailwind CSS 4 · Zustand · hls.js · mpegts.js · IndexedDB (API nativa, sin librerías).

## Arquitectura

```
src/
├── App.tsx                 Shell, tema y enrutado
├── lib/
│   ├── types.ts            Modelos (Channel, Playlist, Settings, BackupFile…)
│   ├── db.ts               Capa IndexedDB (stores: playlists, channels, favorites, history, status, kv)
│   ├── m3u.ts              Parser M3U puro (sin DOM) + saneado
│   ├── m3u.worker.ts       Web Worker que ejecuta el parser fuera del hilo principal
│   ├── parse-async.ts      Puente al worker con fallback al hilo principal
│   ├── categories.ts       Normalización de group-title → categorías
│   ├── playlist-manager.ts Importar / actualizar / duplicados / fetch con progreso
│   ├── backup.ts           Exportación, validación/saneado e importación de copias JSON
│   ├── store.ts            Estado global (Zustand) + persistencia + acciones
│   └── router.ts           Router por hash (sin recargas)
├── player/
│   ├── engine.ts           Estrategia por formato: hls.js → MPEG-TS (mpegts.js) → nativo
│   └── Player.tsx          UI del reproductor, reconexión, atajos, PiP, calidad, aspecto
├── components/             Shell (sidebar/header/toasts), tarjetas, virtualización, UI base
└── pages/                  Home, Channels (todos/favoritos), Recents, Playlists, Settings, Watch
tests/                      Vitest: parser, gestor/IndexedDB/backups, render integral de la app
```

Separación: **UI** (`components`, `pages`) · **almacenamiento** (`db.ts`) · **listas** (`playlist-manager`, `m3u*`, `backup`) · **reproducción** (`player/`). Todo el estado persistente pasa por `store.ts` → `db.ts`.

### Decisiones clave
- **Copia local real**: al importar se guardan todos los canales en IndexedDB; si la URL deja de funcionar, la lista sigue disponible. Si una actualización falla, la copia anterior se conserva intacta (y se anota el error en la tarjeta).
- **IDs de canal estables** (`listaId:hash(tvg-id|nombre|grupo)`, sin la URL). Al actualizar una lista, favoritos, historial y estado de disponibilidad se conservan aunque cambien tokens/hosts.
- **Duplicados**: entradas con la misma URL dentro de una lista se omiten (y se cuentan); una lista con la misma URL de origen o con los mismos canales que otra se rechaza con aviso; opción para ocultar duplicados entre listas.
- **Categorías**: el `group-title` original se conserva sin tocar; la categoría (Noticias, Deportes, Entretenimiento, Películas, Series, Infantiles, Música, Documentales, Internacionales, Otros) se deriva de él por reglas, y lo que no encaja va a «Otros».
- **Rendimiento**: parser en Web Worker; guardado transaccional; virtualización propia por ventanas (solo se montan las filas visibles) para miles de canales; logos con `loading="lazy"`; índice de búsqueda normalizado precalculado; sin comprobaciones masivas de disponibilidad (el estado verde/rojo se registra solo al reproducir).
- **Seguridad**: solo `http(s)` para listas; esquemas permitidos en canales (`http, https, rtmp, rtsp, udp…`; `javascript:`, `data:` y `file:` se descartan); logos solo `http(s)`; caracteres de control eliminados y longitudes limitadas; nada se inserta como HTML (React escapa); las copias de seguridad se validan y sanean campo a campo; descarga con `credentials: omit`, límite de 150 MB y timeout.

## Funcionalidades

**Listas**: añadir por URL (varias a la vez, una por línea) · importar uno o varios archivos (arrastrar y soltar) · nombre personalizado · renombrar · actualizar desde la URL (o reemplazar desde archivo) · activar/desactivar · eliminar (con confirmación) · contador de canales · fecha de actualización · barra de progreso y errores por importación.

**Explorador**: cuadrícula/lista · búsqueda instantánea (nombre, nombre alternativo, categoría, grupo, tvg-id, idioma, país) · filtros por categoría, grupo y lista · orden A–Z · favoritos · indicador de disponibilidad · densidad configurable.

**Inicio**: continuar viendo, estadísticas, favoritos, últimos reproducidos, listas, estado de primera ejecución.

**Reproductor**: hls.js, MPEG-TS/FLV con mpegts.js, reproducción nativa (MP4, WebM, HLS en Safari…) · selector de calidad HLS + calidad preferida · aspecto (auto, 16:9, 4:3, llenar, estirar) · PiP · pantalla completa (reproductor o solo vídeo) · volumen/silencio · barra de progreso en contenidos no en directo · indicador EN DIRECTO + «ir a directo» · info y logo del canal · estado de conexión · reconexión automática configurable (retardo e intentos) · watchdog de arranque y de bloqueos · pantalla de error con reintentar/siguiente · controles auto-ocultables · atajos (`Espacio/K`, `M`, `F`, `P`, `A`, `↑↓`, `←→`, `N/B`, `H`) · cola lateral (categoría / favoritos / recientes).

**Persistencia (IndexedDB)**: listas, canales, logos (URL), grupos, favoritos, historial (fecha/hora, sin duplicados, borrado individual y total), último canal, ajustes de reproductor y preferencias de interfaz (tema, densidad, vista, barra lateral, lista activa).

**Copias de seguridad JSON**: configuración · listas (con canales y favoritos) · copia completa; restauración fusionando o reemplazando.

**UX**: toasts, skeletons, estados vacíos (primera ejecución, sin listas, lista vacía, sin resultados), banner sin conexión, confirmaciones en línea (sin ventanas emergentes), tema oscuro/claro/sistema, responsive (barra inferior en móvil, barra lateral contraíble en escritorio).

## Limitaciones documentadas
- **MPEG-DASH (.mpd)** no se incluye (se informa con un mensaje claro). **RTMP, RTSP, UDP, RTP, SRT** no pueden reproducirse en navegadores: se importan pero se muestra «formato no compatible».
- **CORS**: tanto la descarga de listas por URL como los streams requieren que el servidor permita el acceso desde el navegador. Si no, descarga la lista y súbela como archivo. No se incluye ningún mecanismo para eludir restricciones de proveedores (las directivas `#EXTVLCOPT` de user-agent/referer se ignoran).
- **Contenido mixto**: una página servida por HTTPS no puede cargar streams HTTP. Para ellos sirve la app por `http://localhost`.
- **Logos**: se guarda su URL (carga diferida, con avatar de iniciales si falla), no una copia binaria, para no inflar el almacenamiento ni depender de CORS.
- MPEG-TS depende de Media Source Extensions (no disponible en iOS Safari antiguo).
- No es una PWA instalable ni hay mini-reproductor al navegar fuera de la pantalla de reproducción.
- La guía de programación (EPG/XMLTV) no está implementada.

## Informe de pruebas

Automatizadas (`npx vitest run`, **32 pruebas**, todas verdes):

| Área | Cobertura |
|---|---|
| Parser M3U | atributos completos/ausentes, comas entre comillas, CRLF/BOM, `#EXTGRP`, URLs relativas, duplicados, ids estables, esquemas peligrosos, manifiestos HLS, contenido inválido, **60 000 canales en < 1 s** |
| Categorías | 10 casos de normalización |
| Importación | archivo local, URL (fetch simulado), URL inválida/`javascript:`, HTTP 404, fallo CORS/red, archivo vacío o no M3U, duplicados por URL y por contenido, **50 000 canales en IndexedDB** |
| Actualización | conserva ids y favoritos, calcula altas/bajas, **conserva la copia local si la URL falla** |
| Borrado | cascada de canales, favoritos, historial y estados |
| Copias de seguridad | round-trip completo, rechazo de archivos ajenos, saneado de contenido manipulado, reemplazo total |
| App completa (jsdom) | primera ejecución → lista demo → explorador virtualizado → búsqueda → favoritos → montaje del reproductor → todas las páginas → recarga desde IndexedDB; cambio de tema persistente |

Verificación de compilación: `tsc` estricto y `npm run build` correctos.

**No verificado en esta entrega** (requiere navegador real con red y fuentes de vídeo): reproducción real HLS/MPEG-TS/nativa, PiP, pantalla completa y pruebas visuales de responsive en Chrome, Edge, Firefox y Android. El entorno de desarrollo no disponía de un navegador gráfico ejecutable, por lo que estas partes se implementaron según las APIs documentadas pero conviene validarlas con tus propias fuentes. La lista de demostración incluye flujos HLS de prueba públicos para ello (se añade solo si el usuario lo pide).
