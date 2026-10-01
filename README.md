# Gestor de tareas académicas — Frontend

Next.js y React implementan interfaz en español y consumen la API Python. No se conecta directamente a PostgreSQL ni al proveedor de IA. La API FastAPI es la única interfaz de datos; aunque más adelante PostgreSQL se aloje en Supabase, el navegador seguirá consumiendo FastAPI y no el SDK ni las APIs de Supabase.

## Ubuntu

```bash
cd ~/proyectos/GestorDeTarea_Frontend
npm install
cp .env.example .env.local
npm run dev
```

Abre `http://localhost:3000`. Arranca primero la API según el README del backend y crea una cuenta privada local con su comando documentado. Sin iniciar API se verá un mensaje de conexión; el análisis real necesita `OPENAI_API_KEY` configurada solo en backend. PDF máximo 15 MB; el análisis no guarda propuestas hasta confirmar.
