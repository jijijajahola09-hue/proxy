# 🌐 MiProxy

Tu propio proxy web personal, hecho con Node.js + Express.

## ¿Cómo subir a Render.com (GRATIS)?

### Paso 1 — Sube el código a GitHub
1. Ve a **github.com** y crea una cuenta si no tienes
2. Crea un repositorio nuevo (New repository), llámalo `miproxy`
3. Sube todos los archivos de esta carpeta ahí

### Paso 2 — Despliega en Render
1. Ve a **render.com** y crea una cuenta (es gratis)
2. Clic en **"New +"** → **"Web Service"**
3. Conecta tu cuenta de GitHub y selecciona el repo `miproxy`
4. Render detecta automáticamente que es Node.js
5. En **Start Command** pon: `node server.js`
6. Clic en **"Create Web Service"**

### Paso 3 — ¡Listo!
Render te da una URL tipo:
```
https://miproxy-xxxx.onrender.com
```

Entra desde cualquier compu o celular y navega sin restricciones 🚀

## Correrlo local (sin subir a internet)
```bash
npm install
npm start
# Abre http://localhost:3000
```
