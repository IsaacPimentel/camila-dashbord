# Centro de control KAM

Dashboard de campañas, proveedores y pendientes para gestión de cuentas retail.

## Correr en tu computadora

Necesitas [Node.js](https://nodejs.org) instalado (versión 18 o más reciente).

```bash
npm install
npm run dev
```

Abre el link que te muestre la terminal (normalmente `http://localhost:5173`).

## Publicarlo en la web

### Opción A — Vercel o Netlify (recomendado, gratis)
1. Sube esta carpeta a un repositorio de GitHub (ver abajo).
2. Entra a [vercel.com](https://vercel.com) o [netlify.com](https://netlify.com), conecta tu cuenta de GitHub.
3. Importa el repositorio. Ambos detectan Vite automáticamente — no necesitas configurar nada.
4. Te da un link tipo `tu-dashboard.vercel.app` que puedes abrir desde cualquier laptop.

### Opción B — Subida manual sin GitHub
1. Corre `npm run build` — genera una carpeta `dist/`.
2. Arrastra esa carpeta `dist/` a [app.netlify.com/drop](https://app.netlify.com/drop).
3. Te da un link al instante.

## Crear el repositorio en GitHub (si aún no tienes uno)

```bash
git init
git add .
git commit -m "Dashboard KAM inicial"
gh repo create kam-dashboard --private --source=. --push
```

(Si no tienes `gh` instalado, crea el repo desde github.com y luego:
`git remote add origin TU_URL` seguido de `git push -u origin main`.)

## Importante sobre tus datos

Tus datos (campañas, checklist, SUNAT, proveedores) se guardan en el
almacenamiento local del navegador (`localStorage`), **atados a ese navegador
y ese dispositivo específico** — no se sincronizan solos entre tu laptop
personal, la de trabajo, o entre Chrome y Edge en la misma máquina.

Usa el botón **"Datos"** dentro del dashboard (pestaña Exportar) para bajar un
respaldo `.json` cuando quieras, y el botón **Importar** para cargarlo en otro
navegador o dispositivo.
