export function SidebarIcon({name}:{name:"brand"|"panel"|"tareas"|"cursos"|"cargar"|"logout"|"calendario"}){
 return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
  {name==="brand"&&<><path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11.5V17c3.6 2.2 8.4 2.2 12 0v-5.5"/><path d="M22 9v6"/></>}
  {name==="panel"&&<><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></>}
  {name==="tareas"&&<><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M9 11l2 2 4-4M9 17h6"/></>}
  {name==="calendario"&&<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h2M12 15h2M7 18h2"/></>}
  {name==="cursos"&&<><path d="M12 6C9.6 4.4 6.7 4 3 5v14c3.7-1 6.6-.6 9 1 2.4-1.6 5.3-2 9-1V5c-3.7-1-6.6-.6-9 1Z"/><path d="M12 6v14"/></>}
  {name==="cargar"&&<><path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7"/><path d="M13 3v5h5M13 3l5 5v3"/><circle cx="16" cy="16" r="3"/><path d="m18.3 18.3 2.2 2.2"/></>}
  {name==="logout"&&<><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="M8 12h13m-4-4 4 4-4 4"/></>}
 </svg>;
}
