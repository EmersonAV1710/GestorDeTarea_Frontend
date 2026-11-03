import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tarevia",
  description: "Organiza tus cursos y actividades académicas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es" suppressHydrationWarning><body><script dangerouslySetInnerHTML={{ __html: `(function(){try{document.documentElement.dataset.darkStyle=localStorage.getItem('tarevia-dark_style')==='black'?'black':'gray'}catch(e){document.documentElement.dataset.darkStyle='gray'}})();(function(){try{var saved=localStorage.getItem('tarevia-theme');document.documentElement.dataset.theme=saved==='dark'||(saved!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}})();(function(){try{var color=localStorage.getItem('tarevia-accent');if(['blue','violet','green','rose','orange','teal','red','amber','lime','cyan','indigo','fuchsia','silver','coral','ocean','grape','copper','olive','raspberry'].indexOf(color)!==-1)document.documentElement.dataset.accent=color}catch(e){}})();(function(){try{var bg=localStorage.getItem('tarevia-background');if(['blue','violet','mint','rose','sand','slate','forest','lavender','peach','lagoon','cherry','coffee','galaxy','porcelain','sky','pistachio','vanilla','petals','lilac'].indexOf(bg)!==-1)document.documentElement.dataset.background=bg}catch(e){}})()` }} />{children}</body></html>;
}
