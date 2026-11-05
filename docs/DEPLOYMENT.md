# Despliegue de Burning Bull

El frontend React/Vite se publica en Vercel y la API Node/Express en Railway.
PostgreSQL es compartido por todos los usuarios y persiste en un volumen de Railway.
El navegador usa `/api` en el mismo origen del frontend; Vercel reenvía esas peticiones a Railway.

## Recursos del proyecto

| Recurso | Identificador o URL |
| --- | --- |
| Repositorio original | `Juanes2424/sisemp_proyecto` |
| Fork personal | <https://github.com/JhostinAleck/sisemp_proyecto> |
| Railway workspace | `703ee697-3103-4053-b992-581f646aae06` |
| Railway proyecto | `8c326b2c-15c5-4219-9ecf-e89c0ad4009f` |
| Railway entorno production | `fc934dcb-86bc-447d-aadf-60010d7bfa0a` |
| Railway servicio api | `fa7b6dc9-f923-4325-9037-6f53e8d5e687` |
| Railway servicio Postgres | `15fd84aa-688a-4f4d-8f92-d1d81dc2fd25` |
| Volumen Postgres | `7e62d843-caa8-43bf-883b-d772c2fb15c6`, montado en `/var/lib/postgresql/data` |
| API | <https://api-production-3f37.up.railway.app> |
| Vercel team | `team_N39Xc8CPlXU0WGIa2tc9BaOQ` |
| Vercel proyecto | `prj_acuMQn6Dn5xr2T2apCTJdpxyKCDU` |
| Aplicación | <https://burning-bull-sisemp-jhostin.vercel.app> |

El alias de la aplicación está verificado. La existencia de estos recursos y dominios no implica
que una versión de la aplicación ya esté desplegada: se debe comprobar el estado de cada despliegue.

## Variables de la API

Configurar las siguientes variables solamente en el servicio `api`, entorno `production`:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referencia privada de Railway) |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `APP_ORIGIN` | `https://burning-bull-sisemp-jhostin.vercel.app` |

El dominio público de la API apunta al puerto 3000. PostgreSQL no tiene proxy TCP público.
No copiar `DATABASE_URL` al frontend ni crear una variable `VITE_` con credenciales.
El frontend no necesita secretos: `vercel.json` define el destino de `/api`.

## Primera cuenta de gerencia

Antes del primer arranque, configurar en la API `BOOTSTRAP_INVITE_TOKEN`,
`BOOTSTRAP_MANAGER_EMAIL` y `BOOTSTRAP_MANAGER_NAME`. El token debe ser generado
con aleatoriedad criptográfica (32 bytes codificados como base64url, 43 caracteres).
Introducir los valores mediante stdin o el gestor de variables de Railway, sin imprimirlos
en logs ni almacenarlos en el repositorio.

Al arrancar con una base nueva, la API crea una invitación de gerencia válida durante siete
días y guarda solamente el hash del token. Los reinicios no reemplazan ni reactivan una
invitación inicial existente. La persona destinataria abre privadamente
`https://burning-bull-sisemp-jhostin.vercel.app/activar#token=<token>` y elige su nombre
y contraseña. Después de activar la cuenta, gerencia administra las invitaciones desde la aplicación.
Retirar las tres variables de bootstrap cuando la cuenta esté activada.

## Verificar y desplegar

Requiere Node.js 22.12 o superior, las dependencias del lockfile y una sesión del CLI de Railway
en la cuenta personal. Ejecutar desde la raíz de este repositorio:

```bash
npm ci
npm test
npm run build
railway link --project 8c326b2c-15c5-4219-9ecf-e89c0ad4009f --environment production --service api
railway up --service api --environment production --detach
railway service status --service api
```

`railway.json` configura `npm start` y comprueba `/api/health`. La API ejecuta las migraciones
antes de comenzar a aceptar peticiones. Un fallo de migración debe impedir que el proceso se marque sano.
Para ejecutar las migraciones manualmente desde un contenedor de API ya activo:

```bash
railway ssh --service api --environment production -- npm run db:migrate
```

El proyecto Vercel usa Vite, Node.js 22, `npm ci`, `npm run build` y salida `dist`.
Publicar desde el fork personal con la integración de Git o con el conector autenticado de Vercel,
seleccionando el proyecto y team de la tabla. Publicar una revisión ya validada y comprobar que
el alias de producción apunta a esa revisión. El archivo `vercel.json` debe acompañar al código.

Si se usa un CLI Vercel autenticado, la alternativa manual es:

```bash
vercel link --project burning-bull-sisemp --scope jhostinalecks-projects --yes
vercel deploy --prod --scope jhostinalecks-projects
```

Los CLI de Railway y Vercel mantienen sesiones separadas de los conectores MCP.
No se deben añadir tokens a la línea de comandos ni versionar archivos `.env` o `.secrets`.

## Comprobar la publicación

```bash
curl --fail https://api-production-3f37.up.railway.app/api/health
curl --fail https://burning-bull-sisemp-jhostin.vercel.app/api/health
```

Verificar en el navegador acceso por invitación, inicio y cierre de sesión, y autorización por rol.
Comprobar que los datos creados por un usuario autorizado aparecen en una segunda sesión autorizada.
Recargar una ruta interna del frontend debe servir la aplicación; una ruta `/api` desconocida
debe conservar la respuesta de la API y no devolver el HTML de la SPA.

## Operación

`railway logs --service api` permite revisar errores de la API. Evitar registrar contraseñas,
cookies, tokens de invitación o cadenas de conexión. El volumen mantiene los datos entre
despliegues; no borrar el servicio ni el volumen para publicar una actualización.

Referencias oficiales: [configuración Railway](https://docs.railway.com/config-as-code/reference),
[rewrites Vercel](https://vercel.com/docs/routing/rewrites) y
[despliegue Vercel CLI](https://vercel.com/docs/cli/deploy).
