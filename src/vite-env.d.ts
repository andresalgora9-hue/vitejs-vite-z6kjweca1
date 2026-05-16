/// <reference types="vite/client" />
 
// Permite importar archivos CSS como módulos (fix para leaflet/dist/leaflet.css)
declare module '*.css' {
  const content: string;
  export default content;
}
 
declare module 'leaflet/dist/leaflet.css' {
  const content: string;
  export default content;
}
 
