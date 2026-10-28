# Nuestra historia ❤️

Una página web romántica e interactiva hecha con HTML, CSS y JavaScript, sin frameworks ni instalaciones.

## Cómo abrirla

1. Descomprime la carpeta `nuestra-historia-web`.
2. Abre `index.html` con Chrome, Firefox o Edge.
3. Pulsa el engranaje ⚙ del menú para configurar nombres, fecha de inicio de la relación y número de WhatsApp.
4. Empieza a añadir recuerdos, cartas, canciones, planes y cápsulas del tiempo.

Para una experiencia más estable puedes abrir la carpeta con la extensión **Live Server** de Visual Studio Code. No necesita `npm install`.

## Funcionalidades incluidas

- Contador de tiempo juntos y cuenta regresiva para el siguiente aniversario.
- Historia de la relación en una línea de tiempo.
- Galería de imágenes y videos con fecha, categoría y descripción.
- Reproductor de música con lista de canciones locales.
- Cartas y mensajes de amor.
- Lista de planes y sueños compartidos, con progreso y ruleta de ideas para citas.
- Cápsulas del tiempo que se desbloquean según la fecha del dispositivo.
- Mensajes preparados para enviarlos por WhatsApp.
- Recuerdo del día y botón de sorpresa.
- Diseño adaptable a computador y móvil.

## Dónde se guardan los datos

El texto y la configuración se guardan en `localStorage`; los archivos de imágenes, videos y audio se guardan en `IndexedDB` dentro del navegador. Por tanto:

- Los datos no se sincronizan automáticamente entre celulares o computadores.
- Borrar los datos del sitio/navegador puede borrar los recuerdos locales.
- Para compartir datos entre dos personas, usar cuentas o acceder desde varios dispositivos hace falta añadir un backend y autenticación.
- Las cápsulas del tiempo de esta versión son una función sentimental local, no un bloqueo de seguridad: alguien con acceso al navegador puede modificar los datos y la fecha del dispositivo.
- Para subir archivos, comprueba que el navegador tenga espacio disponible. Evita archivos de video demasiado grandes.

## WhatsApp

En ⚙, introduce el número con el código de país y sin espacios ni el signo `+`. Para Colombia, por ejemplo, el formato comienza con `57`. El botón abrirá WhatsApp con el texto preparado; tú decides si enviarlo.

## Música

Añade archivos de audio que tengas disponibles en tu dispositivo y el reproductor los guardará en ese navegador. La página no incluye música protegida ni descarga canciones de servicios externos.

## Estructura

```text
nuestra-historia-web/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── img/
├── music/
├── videos/
└── README.md
```

Las carpetas `img`, `music` y `videos` están disponibles por si luego prefieres guardar archivos propios en el proyecto. Las cargas hechas desde el formulario se guardan en el almacenamiento del navegador.
