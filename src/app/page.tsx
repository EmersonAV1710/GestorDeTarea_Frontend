"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import { clearReviewDraft, parsePendingReviews, parseSavedDocuments, restoreReviewDraft, storeReviewDraft, type PendingReview, type SavedDocument } from "../lib/reviewDraft";
import { compareActivityDates } from "../lib/activityOrder";
import { matchesActivityType } from "../lib/activityTypes";
import {apiError,localToday,parseAnalysis,proposalError,type Proposal} from "../lib/proposals";
import type { Activity, Course } from "../components/types";
import { Toast } from "../components/Toast";
import { SidebarIcon } from "../components/SidebarIcon";
import { UserPreferencesMenu } from "../components/UserPreferencesMenu";
import { AuthPage } from "../components/pages/AuthPage";
import { PanelPage, upcomingActivities } from "../components/pages/PanelPage";
import { TasksPage } from "../components/pages/TasksPage";
import { CalendarPage } from "../components/pages/CalendarPage";
import { CoursesPage } from "../components/pages/CoursesPage";
import { AnalyzePage } from "../components/pages/AnalyzePage";
const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:8000/api";
const NAV_ITEMS=[
 {id:"panel",label:"Panel"},
 {id:"tareas",label:"Mis tareas"},
 {id:"calendario",label:"Calendario"},
 {id:"cursos",label:"Cursos"},
 {id:"cargar",label:"Analizar documento"},
] as const;
class SessionExpiredError extends Error {}
function useTimedMessage(autoClose = true) {
 const [message,setMessage]=useState("");
 const [version,setVersion]=useState(0);
 function update(value:string){setMessage(value);if(value)setVersion(v=>v+1)}
 useEffect(()=>{
  if(!message || !autoClose)return;
  const timeout=window.setTimeout(()=>setMessage(""),5000);
  return ()=>window.clearTimeout(timeout);
 },[message,version,autoClose]);
 return [message,update,version] as const;
}
export default function Home(){
 const [token,setToken]=useState(""); const [email,setEmail]=useState(""); const [username,setUsername]=useState(""); const [password,setPassword]=useState(""); const [passwordConfirmation,setPasswordConfirmation]=useState(""); const [authMode,setAuthMode]=useState<"login"|"register">("login"); const [authError,setAuthError,authErrorId]=useTimedMessage(); const [courses,setCourses]=useState<Course[]>([]); const [items,setItems]=useState<Activity[]>([]); const [courseFilter,setCourseFilter]=useState(""); const [typeFilter,setTypeFilter]=useState(""); const [from,setFrom]=useState(""); const [to,setTo]=useState(""); const [section,setSection]=useState("panel"); const [taskView,setTaskView]=useState<"board"|"list">("board"); const [logoutOpen,setLogoutOpen]=useState(false); const [mobileMenuOpen,setMobileMenuOpen]=useState(false); const [busy,setBusy]=useState(false); const [error,setError,errorId]=useTimedMessage(); const [notice,setNotice,noticeId]=useTimedMessage(); const [newCourse,setNewCourse]=useState(""); const [newCourseCode,setNewCourseCode]=useState(""); const [newCourseTerm,setNewCourseTerm]=useState(""); const [editingCourse,setEditingCourse]=useState<Course|null>(null); const [confirmDeactivateId,setConfirmDeactivateId]=useState(""); const [uploadCourse,setUploadCourse]=useState(""); const [selectedFileName,setSelectedFileName]=useState(""); const [proposals,setProposals]=useState<Proposal[]>([]); const [docId,setDocId]=useState(""); const [loaded,setLoaded]=useState(false);
 const [logoutError,setLogoutError]=useState("");
 const [pendingReviews,setPendingReviews]=useState<PendingReview[]>([]);
 const [savedDocuments,setSavedDocuments]=useState<SavedDocument[]>([]);
 const [deleteSavedError,setDeleteSavedError]=useState("");
 const [resumeTargetId,setResumeTargetId]=useState("");
 const [reviewFileName,setReviewFileName]=useState("");
 const [reviewCourseId,setReviewCourseId]=useState("");
 const [panelCourseFilter,setPanelCourseFilter]=useState("");
 const [panelTypeFilter,setPanelTypeFilter]=useState("");
 useEffect(()=>{
  if(!docId||!username||!reviewCourseId)return;
  const review={document_id:docId,filename:reviewFileName,course_id:reviewCourseId,proposals};
  storeReviewDraft(review,username);
  setPendingReviews(previous=>previous.map(item=>item.document_id===docId?review:item));
 },[docId,proposals,username,reviewFileName,reviewCourseId]);
 const uploadFormRef=useRef<HTMLFormElement>(null);
 const reviewRef=useRef<HTMLElement>(null);
 const actionPending=useRef(false);
 const sessionVersion=useRef(0);
 const logoutDialogRef=useRef<HTMLDialogElement>(null);
 const logoutButtonRef=useRef<HTMLButtonElement>(null);
 const mobileMenuButtonRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!mobileMenuOpen||typeof document==="undefined")return;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  return ()=>{document.body.style.overflow=previousOverflow};
 },[mobileMenuOpen]);
 useEffect(()=>{
  if(!mobileMenuOpen||typeof window.matchMedia!=="function")return;
  const mobileViewport=window.matchMedia("(max-width: 820px)");
  const closeOnDesktop=()=>{if(!mobileViewport.matches)setMobileMenuOpen(false)};
  mobileViewport.addEventListener("change",closeOnDesktop);
  closeOnDesktop();
  return ()=>mobileViewport.removeEventListener("change",closeOnDesktop);
 },[mobileMenuOpen]);
 useEffect(()=>{
  if(section!=="cargar"||resumeTargetId!==docId||!resumeTargetId||!proposals.length||!reviewRef.current)return;
  reviewRef.current.scrollIntoView({block:"start"});
  reviewRef.current.focus({preventScroll:true});
  setResumeTargetId("");
 },[section,resumeTargetId,docId,proposals.length]);
 useEffect(()=>{
  if(section==="cargar"||!docId)return;
  setDocId("");setReviewCourseId("");setReviewFileName("");setResumeTargetId("");setProposals([]);
 },[section,docId]);
 useEffect(()=>{if(section!=="cargar")setSelectedFileName("")},[section]);
 useEffect(()=>{
  const dialog=logoutDialogRef.current;
  if(logoutOpen&&!dialog?.open)dialog?.showModal();
  if(!logoutOpen&&dialog?.open)dialog.close();
 },[logoutOpen]);
 function clearAccount(){
  sessionVersion.current+=1;
  sessionStorage.removeItem("gestor_token");sessionStorage.removeItem("gestor_username");
  setToken("");setUsername("");setEmail("");setCourses([]);setItems([]);setProposals([]);setDocId("");
  setPendingReviews([]);setSavedDocuments([]);setDeleteSavedError("");setReviewFileName("");setReviewCourseId("");setResumeTargetId("");setPanelCourseFilter("");setPanelTypeFilter("");
  setUploadCourse("");setSelectedFileName("");setCourseFilter("");setTypeFilter("");setFrom("");setTo("");setNewCourse("");setNewCourseCode("");setNewCourseTerm("");setEditingCourse(null);setConfirmDeactivateId("");
  setLoaded(false);setSection("panel");setTaskView("board");setLogoutOpen(false);setMobileMenuOpen(false);setNotice("");setError("");setPassword("");setPasswordConfirmation("");
 }
 const request=async(path:string,init:RequestInit={})=>{
  const version=sessionVersion.current;
  const res=await fetch(API+path,{...init,headers:{...(init.body instanceof FormData?{}:{"Content-Type":"application/json"}),...(token?{Authorization:`Bearer ${token}`}:{}) ,...init.headers}});
  const body=res.status===204?null:await res.json().catch(()=>null);
  if(version!==sessionVersion.current)throw Error("La sesión cambió. Inicia la operación de nuevo.");
  if(res.status===401){clearAccount();setAuthError("Tu sesión venció. Ingresa de nuevo.");}
  if(!res.ok)throw Error(apiError(body,`Error ${res.status}`));
  return body;
 };
 async function loadAccount(t:string,draftUsername:string){
  const headers={Authorization:`Bearer ${t}`};
  const [c,a,d,s]=await Promise.all([fetch(API+"/courses",{headers}),fetch(API+"/activities",{headers}),fetch(API+"/documents/pending",{headers}),fetch(API+"/documents",{headers})]);
  if(c.status===401||a.status===401||d.status===401||s.status===401)throw new SessionExpiredError("Tu sesión venció. Ingresa de nuevo.");
  if(!c.ok||!a.ok||!d.ok||!s.ok)throw Error("No se pudo cargar la información. Inténtalo de nuevo.");
  const [courses,items]=await Promise.all([c.json(),a.json()]);
  if(!Array.isArray(courses)||!Array.isArray(items))throw Error("El servidor devolvió información inválida.");
  return {courses,items,pendingReviews:parsePendingReviews(await d.json()).map(review=>restoreReviewDraft(review,draftUsername)),savedDocuments:parseSavedDocuments(await s.json())};
 }
 async function refresh(){
  if(!token)return;
  const version=sessionVersion.current;
  try{const data=await loadAccount(token,username);if(version!==sessionVersion.current)return;setCourses(data.courses);setItems(data.items);setPendingReviews(data.pendingReviews);setSavedDocuments(data.savedDocuments);setLoaded(true)}
  catch(e){
   if(version!==sessionVersion.current)return;
   if(e instanceof SessionExpiredError){clearAccount();setAuthError(e.message)}
   else setError(e instanceof Error?e.message:"Error de conexión");
  }
 }
 useEffect(()=>{
  let cancelled=false;
  const version=sessionVersion.current;
  const t=sessionStorage.getItem("gestor_token");
  const savedUsername=sessionStorage.getItem("gestor_username")||"";
  if(t)void loadAccount(t,savedUsername).then(data=>{
   if(cancelled||version!==sessionVersion.current)return;
   setToken(t);setUsername(savedUsername.toUpperCase());setCourses(data.courses);setItems(data.items);setPendingReviews(data.pendingReviews);setSavedDocuments(data.savedDocuments);setLoaded(true);
  }).catch(e=>{if(!cancelled&&version===sessionVersion.current){clearAccount();setAuthError(e instanceof Error?e.message:"Error de conexión")}});
  return ()=>{cancelled=true};
 },[]);
 const shown=useMemo(()=>from&&to&&from>to?[]:items.filter(x=>matchesActivityType(x.activity_type,typeFilter)&&(!courseFilter||x.course_id===courseFilter)&&(!from||!!x.due_date&&x.due_date>=from)&&(!to||!!x.due_date&&x.due_date<=to)),[items,courseFilter,typeFilter,from,to]);
 const activeCourses=courses.filter(c=>c.is_active);
 const panelShown=items.filter(x=>matchesActivityType(x.activity_type,panelTypeFilter)&&(!panelCourseFilter||x.course_id===panelCourseFilter));
 const upcoming=upcomingActivities(panelShown);
 const overdue=panelShown.filter(x=>x.status==="pending"&&x.due_date&&x.due_date<localToday()).sort(compareActivityDates);
 const undated=panelShown.filter(x=>x.status==="pending"&&!x.due_date);
 function resumeReview(review:PendingReview){
  if(actionPending.current)return;
  const restored=restoreReviewDraft(review,username);
  uploadFormRef.current?.reset();setSelectedFileName("");setUploadCourse(restored.course_id);
  setDocId(restored.document_id);setReviewCourseId(restored.course_id);setReviewFileName(restored.filename);
  setResumeTargetId(restored.document_id);
  setProposals([...restored.proposals].sort(compareActivityDates));setError("");setNotice("Revisión lista para continuar.");
 }
 async function changeReviewCourse(courseId:string){
  if(actionPending.current||!docId||courseId===reviewCourseId)return;
  actionPending.current=true;setBusy(true);setError("");
  const version=sessionVersion.current;
  const documentId=docId;
  try{
   const updated=await request(`/documents/${documentId}`,{method:"PATCH",body:JSON.stringify({course_id:courseId})});
   if(version!==sessionVersion.current)return;
   if(updated.document_id!==documentId||updated.course_id!==courseId)throw Error("El servidor no confirmó el cambio de curso.");
   setReviewCourseId(courseId);
   setNotice("Curso de la revisión actualizado.");
  }catch(e){if(version===sessionVersion.current)setError(e instanceof Error?e.message:"No se pudo cambiar el curso de la revisión.")}
  finally{actionPending.current=false;setBusy(false)}
 }
 async function deleteReview(documentId:string){
  if(actionPending.current)return;
  actionPending.current=true;setBusy(true);setError("");
  const version=sessionVersion.current;
  try{
   await request(`/documents/${documentId}`,{method:"DELETE"});
   if(version!==sessionVersion.current)return;
   clearReviewDraft(documentId,username);
   setPendingReviews(previous=>previous.filter(review=>review.document_id!==documentId));
   if(docId===documentId){
    setDocId("");setReviewCourseId("");setReviewFileName("");setResumeTargetId("");setProposals([]);
    setUploadCourse("");setSelectedFileName("");uploadFormRef.current?.reset();
   }
   setNotice("Revisión pendiente eliminada.");
  }catch(e){if(version===sessionVersion.current)setError(e instanceof Error?e.message:"No se pudo quitar la revisión.")}
  finally{actionPending.current=false;setBusy(false)}
 }
 async function deleteSavedDocument(documentId:string){
  if(actionPending.current)return false;
  actionPending.current=true;setBusy(true);setDeleteSavedError("");
  const version=sessionVersion.current;
  try{
   await request(`/documents/${documentId}/saved`,{method:"DELETE"});
   if(version!==sessionVersion.current)return false;
   setSavedDocuments(previous=>previous.filter(document=>document.document_id!==documentId));
   setItems(previous=>previous.filter(activity=>activity.document_id!==documentId));
   setNotice("Documento y actividades asociadas eliminados.");
   return true;
  }catch(e){if(version===sessionVersion.current)setDeleteSavedError(e instanceof Error?e.message:"No se pudo borrar el documento.");return false}
  finally{actionPending.current=false;setBusy(false)}
 }
 async function login(e:React.FormEvent){
  e.preventDefault();if(actionPending.current)return;actionPending.current=true;setBusy(true);setAuthError("");
  try{
   const r=await fetch(API+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});
   const d=await r.json();if(!r.ok)throw Error(apiError(d,"No se pudo iniciar sesión"));
   const data=await loadAccount(d.access_token,d.username);
   sessionStorage.setItem("gestor_token",d.access_token);sessionStorage.setItem("gestor_username",d.username.toUpperCase());
   sessionVersion.current+=1;setUsername(d.username.toUpperCase());setToken(d.access_token);setPassword("");
   setCourses(data.courses);setItems(data.items);setPendingReviews(data.pendingReviews);setSavedDocuments(data.savedDocuments);setLoaded(true);setNotice("");
  }catch(e){setAuthError(e instanceof Error?e.message:"Error de conexión")}
  finally{actionPending.current=false;setBusy(false)}
 }
 async function register(e:React.FormEvent){e.preventDefault();setBusy(true);setAuthError("");try{const r=await fetch(API+"/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,username,password,password_confirmation:passwordConfirmation})});const d=await r.json();if(!r.ok)throw Error(apiError(d,"No se pudo crear la cuenta"));setUsername(d.username.toUpperCase());setAuthMode("login");setPassword("");setPasswordConfirmation("");setNotice("Cuenta creada. Inicia sesión con tu usuario.")}catch(e){setAuthError(e instanceof Error?e.message:"Error de conexión")}finally{setBusy(false)}}
 async function addCourse(e:React.FormEvent):Promise<boolean>{e.preventDefault();setBusy(true);setError("");setNotice("");try{await request("/courses",{method:"POST",body:JSON.stringify({name:newCourse,code:newCourseCode||null,term:newCourseTerm||null})});setNewCourse("");setNewCourseCode("");setNewCourseTerm("");setNotice("Curso añadido.");await refresh();return true}catch(e){setError(e instanceof Error?e.message:String(e));return false}finally{setBusy(false)}}
 async function saveCourse(e:React.FormEvent){
  e.preventDefault();if(!editingCourse)return;
  setBusy(true);setError("");setNotice("");
  try{
   await request(`/courses/${editingCourse.id}`,{method:"PATCH",body:JSON.stringify({name:editingCourse.name,code:editingCourse.code||null,term:editingCourse.term||null})});
   setEditingCourse(null);setNotice("Curso actualizado.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 async function changeCourseStatus(course:Course,active:boolean):Promise<string|null>{
  setBusy(true);setError("");setNotice("");
  try{
   await request(`/courses/${course.id}${active?"/activate":""}`,{method:active?"PATCH":"DELETE"});
   if(!active&&uploadCourse===course.id)setUploadCourse("");
   setConfirmDeactivateId("");setNotice(active?"Curso reactivado.":"Curso desactivado. Sus tareas se conservan.");await refresh();return null;
  }catch(e){const message=e instanceof Error?e.message:String(e);setError(message);return message}finally{setBusy(false)}
 }
 async function deleteEmptyCourse(course:Course):Promise<string|null>{
  if(actionPending.current)return "Espera a que termine la operación actual.";
  actionPending.current=true;setBusy(true);setError("");setNotice("");
  const version=sessionVersion.current;
  try{
   await request(`/courses/${course.id}/permanent`,{method:"DELETE"});
   if(version!==sessionVersion.current)return "La sesión cambió. Inicia sesión de nuevo.";
   pendingReviews.filter(review=>review.course_id===course.id).forEach(review=>clearReviewDraft(review.document_id,username));
   if(reviewCourseId===course.id){
    clearReviewDraft(docId,username);
    setDocId("");setReviewCourseId("");setReviewFileName("");setResumeTargetId("");setProposals([]);
    setSelectedFileName("");uploadFormRef.current?.reset();
   }
   setCourses(previous=>previous.filter(item=>item.id!==course.id));
   setPendingReviews(previous=>previous.filter(review=>review.course_id!==course.id));
   setSavedDocuments(previous=>previous.filter(document=>document.course_id!==course.id));
   if(uploadCourse===course.id)setUploadCourse("");
   if(courseFilter===course.id)setCourseFilter("");
   if(panelCourseFilter===course.id)setPanelCourseFilter("");
   setEditingCourse(null);
   setNotice("Curso eliminado.");
   return null;
  }catch(e){const message=e instanceof Error?e.message:String(e);if(version===sessionVersion.current)setError(message);return message}
  finally{actionPending.current=false;setBusy(false)}
 }
 async function upload(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(actionPending.current)return;
  actionPending.current=true;setBusy(true);setError("");setNotice("");
  const version=sessionVersion.current;
  const form=new FormData(e.currentTarget);
  try{
   const response=await request("/documents/analyze",{method:"POST",body:form});
   const result=parseAnalysis(response);
   if(version!==sessionVersion.current)return;
   const review:PendingReview={...result,course_id:response.course_id||uploadCourse,filename:response.filename||selectedFileName};
   const restored=restoreReviewDraft(review,username);
   setDocId(restored.document_id);setReviewCourseId(restored.course_id);setReviewFileName(restored.filename);setUploadCourse(restored.course_id);
   setResumeTargetId("");
   setProposals([...restored.proposals].sort(compareActivityDates));
   setPendingReviews(previous=>[restored,...previous.filter(item=>item.document_id!==restored.document_id)]);
   setNotice(result.proposals.length?"Revisa y edita las propuestas antes de guardarlas.":"No se encontraron actividades explícitas. Puedes probar con otro documento.");
  }catch(e){if(version===sessionVersion.current)setError(e instanceof Error?e.message:"No se pudo analizar")}
  finally{actionPending.current=false;setBusy(false)}
 }
 function edit(i:number,key:keyof Proposal,value:string){
  setProposals(p=>p.map((x,n)=>n===i?{...x,[key]:key==="review_required"?value==="true":key==="due_date"?value||null:value,
   ...(key==="due_date"&&value?{year_unconfirmed:false,date_warning_reason:""}:{}),
   ...(key==="due_date"&&!value?{review_required:true}:{}),
   ...(key==="due_date"&&(!value||value>=localToday())?{status:"pending" as const}:{})}:x));
 }
 const reviewError=proposals.length?proposalError(proposals):"";
 async function confirm(){
  if(actionPending.current)return;
  const problem=proposalError(proposals);
  if(!docId||problem){setError(problem||"Analiza un documento antes de confirmar.");return;}
  actionPending.current=true;setBusy(true);setError("");setNotice("");
  const version=sessionVersion.current;
  try{
   const activities=proposals.map(({title,description,date_warning_reason,activity_type,due_date,review_required,year_unconfirmed,status})=>({title:title.trim(),description,date_warning_reason:due_date?"":date_warning_reason||"",activity_type:activity_type||"otro",due_date,review_required:review_required||due_date===null,year_unconfirmed:!!year_unconfirmed&&!due_date,status:due_date&&due_date<localToday()&&status==="completed"?"completed":"pending"}));
   await request("/activities/confirm",{method:"POST",body:JSON.stringify({document_id:docId,activities})});
   if(version!==sessionVersion.current)return;
   clearReviewDraft(docId,username);setPendingReviews(previous=>previous.filter(item=>item.document_id!==docId));
   uploadFormRef.current?.reset();setUploadCourse("");setSelectedFileName("");setReviewFileName("");setReviewCourseId("");
   setProposals([]);setDocId("");setResumeTargetId("");setNotice("Actividades confirmadas y guardadas.");await refresh();
  }catch(e){if(version===sessionVersion.current)setError(e instanceof Error?e.message:"No se pudo guardar. Tus correcciones se conservan.")}
  finally{actionPending.current=false;setBusy(false)}
 }
 async function mutateActivity(id:string,method:"PATCH"|"DELETE",data?:Proposal,suffix="",message="Actividad actualizada."):Promise<string|null>{
  if(actionPending.current)return "Espera a que termine la operación actual.";
  actionPending.current=true;setBusy(true);setError("");
  const version=sessionVersion.current;
  try{
   const updated=await request(`/activities/${id}${suffix?`/${suffix}`:""}`,{method,...(data?{body:JSON.stringify(data)}:{})});
   if(version!==sessionVersion.current)return "La sesión cambió. Inicia sesión de nuevo.";
   const removedDocumentId=method==="DELETE"?items.find(item=>item.id===id)?.document_id:null;
   setItems(previous=>method==="DELETE"?previous.filter(item=>item.id!==id):previous.map(item=>item.id===id?updated:item));
   if(removedDocumentId)setSavedDocuments(previous=>previous.map(document=>document.document_id===removedDocumentId?
    {...document,activity_count:document.activity_count-1}:document).filter(document=>document.activity_count>0));
   setNotice(message);return null;
  }catch(e){const message=e instanceof Error?e.message:String(e);if(version===sessionVersion.current)setError(message);return message}
  finally{actionPending.current=false;setBusy(false)}
 }
 async function createManualActivity(courseId:string,values:Proposal):Promise<string|null>{
  if(actionPending.current)return "Espera a que termine la operación actual.";
  actionPending.current=true;setBusy(true);setError("");
  const version=sessionVersion.current;
  try{
   const {title,description,date_warning_reason,activity_type,due_date,review_required,status}=values;
   const created=await request("/activities",{method:"POST",body:JSON.stringify({course_id:courseId,title,description,date_warning_reason:due_date?"":date_warning_reason||"",
    activity_type:activity_type||"otro",due_date,review_required,status:status||"pending"})});
   if(version!==sessionVersion.current)return "La sesión cambió. Inicia sesión de nuevo.";
   setItems(previous=>[created,...previous]);
   setCourseFilter("");setTypeFilter("");setFrom("");setTo("");
   setNotice("Tarea añadida.");return null;
  }catch(e){const message=e instanceof Error?e.message:"No se pudo añadir la tarea.";if(version===sessionVersion.current)setError(message);return message}
  finally{actionPending.current=false;setBusy(false)}
 }
 async function complete(id:string){await mutateActivity(id,"PATCH",undefined,"complete","Actividad marcada como hecha.")}
 async function reopen(id:string){await mutateActivity(id,"PATCH",undefined,"reopen","Actividad devuelta a pendientes.")}
 function cancelLogout(){
  if(busy)return;
  setLogoutError("");
  logoutDialogRef.current?.close();setLogoutOpen(false);logoutButtonRef.current?.focus();
 }
 async function logout(){
  if(actionPending.current)return;
  actionPending.current=true;setBusy(true);setError("");setLogoutError("");
  try{
   await request("/auth/logout",{method:"POST"});
   logoutDialogRef.current?.close();setLogoutOpen(false);clearAccount();setAuthError("");
  }catch(e){setLogoutError(e instanceof Error?e.message:"No se pudo cerrar la sesión. Inténtalo de nuevo.")}
  finally{actionPending.current=false;setBusy(false)}
 }
 if(!token)return <AuthPage
  authMode={authMode} email={email} setEmail={setEmail}
  username={username} setUsername={setUsername}
  password={password} setPassword={setPassword}
  passwordConfirmation={passwordConfirmation} setPasswordConfirmation={setPasswordConfirmation}
  busy={busy} authError={authError} authErrorId={authErrorId}
  notice={notice} noticeId={noticeId}
  onLogin={login} onRegister={register}
  onToggleMode={()=>{setAuthMode(authMode==="login"?"register":"login");setAuthError("");setPassword("");setPasswordConfirmation("")}}
  onClearAuthError={()=>setAuthError("")} onClearNotice={()=>setNotice("")}
 />;
 return <div className="layout"><dialog ref={logoutDialogRef} className="logout-dialog" aria-labelledby="logout-dialog-title" aria-describedby="logout-dialog-description" onCancel={e=>{e.preventDefault();cancelLogout()}}><h2 id="logout-dialog-title">¿Cerrar sesión?</h2><p id="logout-dialog-description">Volverás a la pantalla de acceso.</p>{logoutError&&<p className="error" role="alert">{logoutError}</p>}<div className="logout-dialog-actions"><button type="button" className="logout-cancel" autoFocus disabled={busy} onClick={cancelLogout}>Cancelar</button><button type="button" className="primary" disabled={busy} onClick={logout}>{busy?"Cerrando sesión…":"Confirmar"}</button></div></dialog><div className="toast-stack">{error&&<Toast key={`error-${errorId}`} kind="error" message={error} onClose={()=>setError("")}/>} {notice&&<Toast key={`notice-${noticeId}`} kind="success" message={notice} onClose={()=>setNotice("")}/>}</div><aside className="sidebar" onKeyDown={event=>{if(event.key==="Escape"&&mobileMenuOpen){setMobileMenuOpen(false);mobileMenuButtonRef.current?.focus()}}}>
 <div className="brand"><SidebarIcon name="brand"/><b>Tarevia</b></div>
 <button ref={mobileMenuButtonRef} type="button" className="mobile-menu-toggle" aria-label={mobileMenuOpen?"Cerrar menú":"Abrir menú"} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={()=>setMobileMenuOpen(open=>!open)}><span className="mobile-menu-lines" aria-hidden="true"><span/><span/><span/></span></button>
 <div id="mobile-navigation" className={`mobile-nav-panel${mobileMenuOpen?" is-open":""}`}>
 <nav aria-label="Navegación principal">{NAV_ITEMS.map(({id,label})=><button key={id} className={section===id?"nav active":"nav"} aria-current={section===id?"page":undefined} onClick={()=>{setSection(id);setMobileMenuOpen(false);if(id==="tareas")setTaskView("board");setNotice("")}}><SidebarIcon name={id}/><span>{label}</span></button>)}</nav>
 <div className="side-bottom"><UserPreferencesMenu username={username} /><button ref={logoutButtonRef} className="logout" disabled={busy} onClick={()=>{setMobileMenuOpen(false);setLogoutError("");setLogoutOpen(true)}}><SidebarIcon name="logout"/><span>Cerrar sesión</span></button></div>
 </div>
 </aside><main className="main" inert={mobileMenuOpen} aria-hidden={mobileMenuOpen}><div className="content">
 {section==="panel"&&<PanelPage items={items} upcoming={upcoming} overdue={overdue} undated={undated} busy={busy} filters={{courses,courseFilter:panelCourseFilter,setCourseFilter:setPanelCourseFilter,typeFilter:panelTypeFilter,setTypeFilter:setPanelTypeFilter}} loaded={loaded} complete={complete} reopen={reopen} onAnalyze={()=>setSection("cargar")} onShowAll={()=>{setTaskView("list");setSection("tareas")}}/>}
 {section==="tareas"&&<TasksPage items={shown} filters={{courses,courseFilter,setCourseFilter,typeFilter,setTypeFilter,from,setFrom,to,setTo}} loaded={loaded} busy={busy} view={taskView} onChangeView={setTaskView} complete={complete} reopen={reopen} onSave={(id,values)=>mutateActivity(id,"PATCH",values)} onCreate={createManualActivity} onDelete={id=>mutateActivity(id,"DELETE",undefined,"","Actividad borrada.")} onCourses={()=>setSection("cursos")}/>}
 {section==="calendario"&&<CalendarPage items={items} courses={courses} loaded={loaded} busy={busy} complete={complete} reopen={reopen}/>}
 {section==="cursos"&&<CoursesPage courses={courses} items={items} loaded={loaded} busy={busy} error={error} onClearError={()=>setError("")} newCourse={newCourse} setNewCourse={setNewCourse} newCourseCode={newCourseCode} setNewCourseCode={setNewCourseCode} newCourseTerm={newCourseTerm} setNewCourseTerm={setNewCourseTerm} editingCourse={editingCourse} setEditingCourse={setEditingCourse} confirmDeactivateId={confirmDeactivateId} setConfirmDeactivateId={setConfirmDeactivateId} onAdd={addCourse} onSave={saveCourse} onChangeStatus={changeCourseStatus} onDeleteEmpty={deleteEmptyCourse}/>}
 {section==="cargar"&&<AnalyzePage pendingReviews={pendingReviews.filter(review=>review.document_id!==docId)} savedDocuments={savedDocuments} deleteSavedError={deleteSavedError} onClearSavedDeleteError={()=>setDeleteSavedError("")} reviewFileName={reviewFileName} reviewCourseId={reviewCourseId} onChangeReviewCourse={changeReviewCourse} onResumeReview={resumeReview} onDeleteReview={deleteReview} onDeleteSavedDocument={deleteSavedDocument} reviewRef={reviewRef} uploadFormRef={uploadFormRef} courses={courses} activeCourses={activeCourses} uploadCourse={uploadCourse} setUploadCourse={setUploadCourse} selectedFileName={selectedFileName} setSelectedFileName={setSelectedFileName} busy={busy} proposals={proposals} setProposals={setProposals} docId={docId} reviewError={reviewError} onUpload={upload} onEdit={edit} onConfirm={confirm} onCourses={()=>setSection("cursos")}/>}
 </div></main></div>
}
