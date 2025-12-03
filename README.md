# 📊 Sistema de Gestión IG - Monetto

Sistema de gestión financiera con autenticación, roles de usuario y dashboard interactivo.

## 🚀 Cambios Recientes (v2.0)

### ✨ Optimizaciones de Rendimiento
- **Reducción de consultas**: De 18 a 8 consultas en Dashboard (-55%)
- **Cleanup automático**: Prevención de memory leaks con AbortController
- **Reconexión automática**: Sistema de retry con exponential backoff
- **Monitoreo de conexión**: Indicador visual del estado de conexión

### 🎯 Nuevas Funcionalidades
- **Filtros de período funcionales**:
  - **Semana**: Navegación entre semanas (anterior/siguiente)
  - **Mes**: Selector de mes y año (últimos 5 años)
  - **Año**: Selector de año (últimos 10 años)
- **Comparaciones dinámicas**: vs semana/mes/año anterior
- **Hook de caché**: `useDataCache` para optimizar consultas repetidas

### 🔧 Mejoras Técnicas
- Sistema de caché con TTL (5 minutos)
- Cancelación automática de consultas al cambiar de pantalla
- Manejo mejorado de errores de red
- Notificaciones de estado de conexión

## 🛠️ Tecnologías

- React + Vite
- Supabase (Backend & Auth)
- TailwindCSS
- Recharts (Gráficos)
- React Router
- Zustand (State Management)

## 📦 Instalación

```bash
npm install
```

## 🔑 Configuración

Crear archivo `.env` con:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima
```

## 🚀 Desarrollo

```bash
npm run dev
```

## 🏗️ Build

```bash
npm run build
```

## 👥 Roles

- **Admin**: Acceso completo
- **Empleado**: Acceso limitado a sus propios registros

## 📝 Licencia

MIT
