# Burning Bull · operación de proyectos e inventario

## Intención y alcance
Mejorar el prototipo existente de Juanes2424/sisemp_proyecto para la sustentación de Design and Prototype del 6 de noviembre de 2026. Conservar React, TypeScript y Vite y el recorrido de cotización existente, conectándolo con inventario, reservas, salida y devolución. Desplegar la aplicación verificada en Vercel en el equipo personal JhostinAleck's projects. El repositorio fuente tiene acceso READ: trabajar en una copia local, conservar atribución y crear una rama/copia propia si hace falta para entregar el código; no modificar el repositorio ajeno.

## Evidencia del proceso actual
Google Sheet STUNTS INVENTARIO UNIFICADO, pestaña UNIFICADO STUNTS (gid 1762675199), consultado 2026-11-05: código S000xx, artículo, talla, marca, stock, salida/fecha/responsable, retorno/fecha, ingresos, total, conteo, referencia, ubicación, observaciones, categoría. Total calculado como stock - salida + retorno + ingresos. Formatos impresos registran proyecto, supervisor, fechas y checklist de entrega, carga y retorno.

## Resultado visible
- Inicio con resumen calculado de proyectos, equipos disponibles, reservas, equipos fuera y devoluciones/novedades pendientes. Accesos al trabajo prioritario.
- Inventario con búsqueda por código/nombre/categoría/ubicación, filtros y ficha. Distinguir existencias totales, unidades fuera, en revisión/mantenimiento, reservas por fechas y disponibles. Historial con cantidad, responsable, proyecto y fecha.
- Proyectos con fechas de rodaje, responsable, desglose de materiales y disponibilidad por periodo; reservas que impiden sobreasignar existencias en fechas coincidentes.
- Actas de salida con proyecto, responsable, fecha prevista de retorno, líneas y checklist de preparación/carga. Se generan desde reservas, sin duplicar ni descontar el stock dos veces. Requieren fechas válidas y cantidades enteras positivas.
- Devoluciones parciales por línea: cantidad recibida en buen estado o con novedad, observación obligatoria para daños. Nunca devolver más de lo pendiente. Daños pasan a revisión y no están disponibles hasta resolverlos. Las unidades pendientes siguen fuera, incluso después de la fecha prevista.
- Mantener solicitud de cotización, proveedores, registro manual de ofertas, comparación y aprobación. No afirmar envío real de correos ni integración Siigo. Impedir aprobar faltantes sin cobertura y cambios silenciosos de una cotización aprobada. Cobertura significa: cada cantidad faltante según disponibilidad por fechas debe tener una oferta vigente seleccionada, disponible y para la cantidad solicitada; aprobar cotización no registra una recepción ni incrementa stock. Reservar solo las unidades propias disponibles. La compra/recepción física queda separada.
- Historial de actividad y matriz de roles visibles. Exportar actas mediante impresión/PDF del navegador.

## Roles y límites explícitos
Cuatro perfiles de demostración, sin pedir contraseñas ficticias:
- Producción: crear y editar proyectos/desgloses, consultar disponibilidad y reservar; consultar inventario y estado de compras.
- Bodega: catálogo, ingresos y revisión de equipos, salidas y devoluciones; consultar proyectos y reservas.
- Compras: administrar proveedores, solicitudes y ofertas; consultar proyectos e inventario.
- Gerencia: todas las acciones y aprobación/rechazo de cotizaciones; acceso a auditoría.
Ocultar/desactivar acciones sin permisos y validar permisos en la capa de aplicación antes de mutar. Mostrar que son perfiles de demo. No presentar la autorización del navegador como autenticación segura de producción.

## Arquitectura ligera
Monolito modular en el frontend: app (rutas, composición, persistencia), domains/access, domains/projects, domains/inventory, domains/procurement, domains/audit, shared (componentes, formato, utilidades). Tipos y reglas de negocio independientes de React. Servicios puros de dominio para disponibilidad, reservas, movimientos, despachos, devoluciones y aprobación. Persistencia versionada en localStorage mediante repositorio, errores visibles y validación de los datos al cargar. Evitar microservicios y dependencias innecesarias.

## Decisiones propuestas por el implementador
- Mantener la persistencia local del prototipo actual para la entrega de mañana: datos por navegador, sin sincronización entre usuarios. Documentar la sustitución futura del repositorio por API/base de datos y autenticación real. Esta limitación debe ser explícita en acceso y documentación.
- Usar una muestra acotada de artículos del Excel para demostrar códigos, categorías, marcas y ubicaciones. Movimientos, proyectos y saldos operativos serán de ejemplo, identificados como tales. No publicar personas, correos, todo el archivo ni credenciales; no modificar el Sheet ni simular sincronización con Google.
- Interfaz en español, marca Burning Bull, navegación sobria y consistente, buen contraste, diseño adaptable y estados vacíos/errores comprensibles.
- Publicar como prototipo de demostración en un proyecto Vercel nuevo, sin reemplazar despliegues existentes.

## Validación y aceptación
Tests de dominio: reservas simultáneas y no coincidentes; doble reserva y fechas inválidas; salida sin stock/reserva o sin checklist; devolución parcial/completa; exceso de devolución; daños y liberación tras revisión; permisos; aprobación sin cobertura; carga corrupta y persistencia. Compilación TypeScript y build Vite. Prueba real en navegador de recorrido producción → reserva → bodega → salida → devolución, búsqueda/filtros, perfiles y recarga de ruta profunda. Capturas desktop y móvil. Comprobar despliegue READY y navegación en URL pública.

## No incluido en esta iteración
Integración Siigo, envíos a proveedores, sincronización en tiempo real con Sheets, autenticación de producción, multiusuario compartido, importación masiva automática o certificación de seguridad del equipo. El prototipo registra novedades; no certifica que un equipo sea seguro para un stunt.

## Actualización aprobada por el usuario
El usuario solicita acceso real y base compartida, elige Railway en lugar de Firestore y autoriza subagentes para implementar y desplegar rápidamente. Arquitectura definitiva: PostgreSQL y API Express en Railway; React/Vite en Vercel con proxy /api al backend; cookies HttpOnly y roles validados en servidor. Acceso por invitaciones de un solo uso, con activación del primer gerente mediante enlace privado. Usuarios, sesiones, invitaciones, límites de login y auditoría en tablas SQL; datos operativos en un agregado JSONB transaccional bloqueado con SELECT FOR UPDATE, apropiado para esta empresa/prototipo pequeño. No se utiliza localStorage como fuente de verdad. Las secciones anteriores sobre perfiles demo y persistencia local quedan reemplazadas. No se crean recursos Firebase.
