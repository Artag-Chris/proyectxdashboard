# Dashboard — Pendientes

## Prioridad alta
- [x] Login (pantalla + conectar con JWT del backend)
- [x] Layout con sidebar (navegación entre secciones)
- [x] Pantalla de escalaciones (lista desde `GET /api/dashboard/escalations`)
- [x] Pantalla de detalle de conversación (mensajes + resolver escalación)
- [x] Responder al cliente desde el detalle (`POST /api/dashboard/conversations/:id/send`)
- [x] Botón para resolver escalación desde el detalle (`POST /api/dashboard/conversations/:id/resolve`)
- [x] Burbuja distintiva de respuestas humanas (rol `HUMAN`)
- [x] Polling del detalle mientras la conversación está escalada
- [x] Explorador de chats de solo lectura (`/chats`): todas las conversaciones en cualquier estado, filtros por estado/canal/búsqueda, paginación y "cargar mensajes anteriores" en el detalle
- [x] Panel de conocimiento: acepta `.md`, `.markdown`, `.txt`, `.pdf`, `.csv` y `.xlsx` en la subida (antes solo PDF/CSV) y avisa de que re-subir el mismo nombre actualiza el documento

## Prioridad media
- [ ] Indicador de escalaciones no leídas
- [ ] Estados de conversación (resuelta, abandonada) visibles en la lista
- [x] Responsive / mobile

## Prioridad baja
- [ ] Logout button
- [ ] WebSocket en vez de polling
- [ ] Tests
- [ ] Build + deploy config
