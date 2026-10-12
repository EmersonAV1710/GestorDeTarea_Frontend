import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tarevia",
  description: "Organiza tus cursos y actividades académicas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es" suppressHydrationWarning><body><script dangerouslySetInnerHTML={{ __html: `(function(){try{var saved=localStorage.getItem('tarevia-theme');document.documentElement.dataset.theme=saved==='dark'||(saved!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}})()` }} />{children}</body></html>;
}
