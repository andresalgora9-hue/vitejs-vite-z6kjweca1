/// <reference types="vite/client" />

// Fix: permite importar CSS desde TypeScript (Leaflet, etc.)
declare module '*.css' {
  const content: string
  export default content
}
