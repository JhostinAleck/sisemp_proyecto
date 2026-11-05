# Boom Cotizador

MVP para cotizar efectos especiales y stunts: desglose por escena → verificación de inventario → solicitud a proveedores → comparador y aprobación.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```

## Notas

- Demo sin backend: los datos se guardan en el `localStorage` del navegador. "Restaurar datos de ejemplo" en la barra lateral los reinicia.
- Inicio de sesión de demostración: cualquier correo y contraseña funcionan. El rol (Producción / Gerencia) se elige al entrar o desde la tarjeta de usuario.
- Aprobar / Rechazar cotizaciones: solo Gerencia.
