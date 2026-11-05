# Burning Bull en localhost

Requisitos: Node 22.12 o posterior, npm y PostgreSQL. Docker es una alternativa opcional.

## Inicio normal

Con PostgreSQL instalado e iniciado en tu computador:

```sh
npm ci
npm run dev
```

Abre **http://localhost:5173**. El comando comprueba los puertos, conecta a PostgreSQL, crea la base dedicada `burning_bull` si no existe, aplica las migraciones pendientes y carga la muestra inicial si el espacio está vacío. Después inicia la API en `127.0.0.1:3000` y Vite en el puerto 5173. Vite reenvía `/api` a la API local.

No se restablecen datos al reiniciar. La aplicación conserva proyectos, inventario, cuentas y contraseñas en PostgreSQL. `Ctrl+C` detiene ambos procesos; si uno falla, también se detiene el otro.

Si PostgreSQL usa otro usuario, puerto o contraseña:

```sh
cp .env.example .env.local
# Edita DATABASE_URL en .env.local y vuelve a ejecutar npm run dev.
```

`.env.local` se carga automáticamente antes de crear la conexión. Las variables explícitas de tu terminal tienen prioridad. La URL predeterminada es `postgresql://localhost/burning_bull`, usando el usuario del sistema. Tu rol PostgreSQL debe tener permiso para crear esa base, o debes crearla previamente con su propietario correcto. No uses las bases `postgres`, `template0` ni `template1` para la aplicación.

El comando de desarrollo acepta únicamente PostgreSQL en `localhost`, `127.0.0.1` o `::1`. No copies URLs ni secretos de Railway. El entorno se fija en `development`, con cookies de sesión apropiadas para HTTP local.

## Primera cuenta

En el primer inicio, la terminal muestra un enlace privado de activación para **gerencia@burningbull.local**. Ábrelo y elige tu nombre y contraseña personal de 12–128 caracteres. Es una cuenta real de gerencia con sesión en cookie HttpOnly; no hay contraseñas predeterminadas ni registro abierto.

El enlace se guarda en `.secrets/local-access.json`, con permisos privados y excluido de Git. El token que permite conservar la misma invitación tras un reinicio queda en `.secrets/local-bootstrap-<identificador>.json`, separado por base de datos. El enlace sirve una sola vez y vence a los siete días. Si vence antes de activar y todavía no hay usuarios, el próximo inicio genera otro enlace. No borres estos archivos para reiniciar el servidor.

Para cambiar el correo inicial antes de preparar la base, configura `LOCAL_ADMIN_EMAIL` en `.env.local`. Cambiarlo después no reemplaza cuentas ni invitaciones existentes. Después de activar, inicia sesión en la página principal con tu correo y contraseña. Invita a producción, bodega y compras desde **Equipo y accesos**.

Puedes preparar la base y obtener la invitación sin iniciar los servidores:

```sh
npm run local:setup
```

## PostgreSQL con Docker, opcional

Si no tienes PostgreSQL instalado, inicia Docker y ejecuta:

```sh
docker compose up -d db
cp .env.example .env.local
```

En `.env.local` establece:

```dotenv
DATABASE_URL=postgresql://burning_bull:burning_bull_dev@127.0.0.1:5433/burning_bull
```

Luego ejecuta `npm run dev`. El puerto 5433 evita interferir con un PostgreSQL instalado en el puerto 5432. Las credenciales del archivo Compose son exclusivamente para desarrollo en tu computador. El volumen `burning_bull_local_pg` conserva los datos al detener el contenedor con `docker compose stop db`. No elimines el volumen si quieres conservarlos.

## Puertos y comandos separados

Para usar otros puertos:

```sh
DEV_PORT=5174 DEV_API_PORT=3001 npm run dev
# También se acepta:
npm run dev -- --port 5174
```

Abre el origen que muestra la terminal. `localhost` y `127.0.0.1` funcionan en el puerto elegido; usa siempre el mismo nombre durante una sesión. El comando no mata servicios ajenos ni cambia silenciosamente a otro puerto.

`npm run dev:web` inicia solamente Vite. `npm run dev:api`, `npm run db:migrate` y `npm run db:bootstrap -- --email gerente@empresa.com` cargan `.env.local` automáticamente. Para el flujo cotidiano utiliza `npm run dev`, que coordina ambos procesos y prepara los requisitos. `npm start` conserva su uso de producción y espera las variables proporcionadas por el servicio.

## Si no inicia

- **PostgreSQL local no disponible:** inicia el servicio instalado, revisa usuario/puerto en `DATABASE_URL` o usa Docker con la configuración anterior. Una conexión rechazada significa que el servidor PostgreSQL no está escuchando en ese puerto.
- **Autenticación o permiso para crear base:** corrige el usuario/contraseña de `.env.local`, o crea `burning_bull` y concede acceso a ese rol PostgreSQL. No se imprimen credenciales en los errores.
- **Puerto ocupado:** cierra el proceso que conoces o elige `DEV_PORT` y `DEV_API_PORT` diferentes. Ambos deben estar libres y ser distintos entre sí.
- **Ya existe otra invitación inicial:** utiliza el enlace privado guardado para esa base. El comando evita reemplazar una invitación que no le pertenece.
- **Ya hay usuarios:** inicia sesión con la cuenta local existente; reiniciar nunca cambia su contraseña.
