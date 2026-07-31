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

## Prioridad media
- [ ] Indicador de escalaciones no leídas
- [ ] Estados de conversación (resuelta, abandonada) visibles en la lista
- [ ] Responsive / mobile

## Prioridad baja
- [ ] Logout button
- [ ] WebSocket en vez de polling
- [ ] Tests
- [ ] Build + deploy config
