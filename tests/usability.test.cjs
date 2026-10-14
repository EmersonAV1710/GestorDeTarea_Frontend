const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const {test}=require('node:test');
const ts = require(path.join(root, 'node_modules/typescript'));
const {createRequire} = require('module');
const realRequire = createRequire(path.join(root, 'package.json'));
const courses = [{id:'course',name:'Prueba',is_active:true}];
const items = [
  {id:'overdue',title:'Vencida',status:'pending',course_id:'course',due_date:'2000-01-01'},
  {id:'undated',title:'Sin fecha',status:'pending',course_id:'course',due_date:null},
  {id:'future',title:'Próxima',status:'pending',course_id:'course',due_date:'2099-01-01'},
];
const proposal = {title:'Entrega final',description:'Descripción',due_date:'2099-01-01',review_required:false,activity_type:'proyecto'};
const docId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function createHome(storage=new Map(), pending=[], saved=[], initialItems=items, courseRows=courses, guestStorage=new Map(), authRoute) {
  const timers=[];
  const state=[],effectDeps=[],effects=[];let cursor=0,effectCursor=0,failUpload=false,failLogout=false,failSavedDelete=false;
  const requests=[];
  const confirmations=[];
  const courseChanges=[];
  const courseCreations=[];
  const courseEdits=[];
  const manualCreations=[];
  const activityRows=[...initialItems];
  const hooks={
    useState(initial){const index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return[state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value}];},
    useRef(initial){return hooks.useState(()=>({current:initial}))[0];},
    useMemo(fn){return fn();},
    useId(){return 'test-id';},
    useEffect(fn,deps){const index=effectCursor++;if(!effectDeps[index]||deps.some((dep,i)=>dep!==effectDeps[index][i])){effectDeps[index]=deps;effects.push(fn);}},
  };
  class FormData {constructor(form){this.form=form;}}
  const context={exports:{},FormData,URLSearchParams,localStorage:{getItem:key=>guestStorage.get(key)||null,setItem:(key,value)=>guestStorage.set(key,value),removeItem:key=>guestStorage.delete(key)},sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    window:{setTimeout(callback, delay){timers.push({callback,delay});return timers.length},clearTimeout(){},location:{search:''},history:{pushState(){},replaceState(){}}},
    fetch:async (url,init={})=>{
      const suffix=url.split('/api')[1];requests.push(suffix);let data,status=200;
      if(storage.get('gestor_token')==='expired' && !suffix.startsWith('/auth/'))return{ok:false,status:401,json:async()=>({detail:'Sesión vencida'})};
      if(suffix==='/auth/login')data={access_token:'fake',username:'test'};
      else if(suffix==='/courses'&&init.method==='POST'){
        const body=JSON.parse(init.body);courseCreations.push(body);
        data={...body,id:'new-course',is_active:true};
      }
      else if(suffix==='/courses')data=courseRows;
      else if(suffix.startsWith('/courses/')&&init.method==='PATCH'){
        const body=JSON.parse(init.body);courseEdits.push(body);
        data={...body,id:suffix.split('/')[2],is_active:true};
      }
      else if(suffix==='/activities'&&init.method==='POST'){
        const body=JSON.parse(init.body);manualCreations.push(body);
        data={...body,id:'manual-task',document_id:null};
      }
      else if(suffix==='/activities')data=activityRows;
      else if(suffix==='/documents/pending')data=pending;
      else if(suffix==='/documents')data=saved;
      else if(suffix.startsWith('/documents/')&&init.method==='PATCH'){
        const documentId=suffix.split('/')[2];
        const review=pending.find(item=>item.document_id===documentId);
        status=review?200:404;
        data=review?{...review,course_id:JSON.parse(init.body).course_id}:{detail:'Revisión no encontrada'};
        if(review){review.course_id=data.course_id;courseChanges.push({documentId,courseId:data.course_id});}
      }
      else if(suffix.startsWith('/documents/')&&suffix.endsWith('/saved')&&init.method==='DELETE'){
        const documentId=suffix.split('/')[2];
        const index=saved.findIndex(document=>document.document_id===documentId);
        status=failSavedDelete?503:index<0?404:204;
        data=failSavedDelete?{detail:'No se pudo borrar'}:index<0?{detail:'Documento guardado no encontrado'}:null;
        if(status===204){saved.splice(index,1);for(let i=activityRows.length-1;i>=0;i--)if(activityRows[i].document_id===documentId)activityRows.splice(i,1);}
      }
      else if(suffix.startsWith('/documents/')&&init.method==='DELETE'){
        const index=pending.findIndex(review=>review.document_id===suffix.split('/')[2]);
        status=index<0?404:204;data=index<0?{detail:'Revisión no encontrada'}:null;
        if(index>=0)pending.splice(index,1);
      }
      else if(suffix==='/auth/logout'){status=failLogout?503:204;data=failLogout?{detail:'No hay conexión con el servidor'}:null;}
      else if(suffix==='/activities/confirm'){confirmations.push(JSON.parse(init.body));data=[];pending.splice(0);}
      else if(suffix==='/documents/analyze'){
        status=failUpload?422:200;
        data=failUpload?{detail:'Archivo inválido'}:{document_id:docId,course_id:'course',filename:'programa.txt',proposals:[{...proposal}]};
        if(!failUpload && !pending.some(review=>review.document_id===docId))pending.push(data);
      }
      else throw Error('Unexpected endpoint '+suffix);
      return{ok:status>=200&&status<300,status,json:async()=>data};
    },process:{env:{}},setTimeout};
  const cache=new Map();
  function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    vm.runInNewContext(code,{...context,exports,require:id=>{
      if(id==='react')return hooks;if(!id.startsWith('.'))return realRequire(id);
      const target=path.resolve(path.dirname(file),id);return load(fs.existsSync(target+'.tsx')?target+'.tsx':target+'.ts');
    }});return exports;
  }
  const Home=load(path.join(root,'src/app/TareviaApp.tsx')).default;
  function render(){cursor=0;effectCursor=0;const tree=Home(authRoute?{authRoute}:undefined);while(effects.length)effects.shift()();return tree;}
  function find(node,predicate){if(!node||typeof node!=='object')return[];return[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>find(child,predicate))];}
  function page(name){let tree=render();if(tree===null||tree?.props?.className==='session-loading')tree=render();return find(tree,node=>node.type?.name===name)[0];}
  function nav(label){const button=find(render(),node=>node.type==='button'&&String(node.props.className).startsWith('nav')&&node.props.children[1].props.children===label)[0];assert(button);button.props.onClick();render();}
  return{render,page,nav,storage,guestStorage,pending,saved,timers,find,flushEffects(){while(effects.length)effects.shift()()},requests,confirmations,courseChanges,courseCreations,courseEdits,manualCreations,setFailLogout:value=>{failLogout=value},setFailUpload:value=>{failUpload=value},setFailSavedDelete:value=>{failSavedDelete=value}};
}



async function loggedIn(storage, pending, saved, activities, courseRows) {
  const home=createHome(storage,pending,saved,activities,courseRows);
  if(home.page('AuthPage')===undefined && !home.storage.has('gestor_token')){
    const signIn=home.find(home.render(),node=>node.type==='button'&&node.props.className==='logout')[0];
    signIn.props.onClick();
  }
  const auth=home.page('AuthPage');
  if(auth)await auth.props.onLogin({preventDefault(){}});
  else await new Promise(resolve=>setImmediate(resolve));
  return home;
}
async function analyze(home) {
  home.nav('Analizar documento');
  await home.page('AnalyzePage').props.onUpload({preventDefault(){},currentTarget:{}});
  return home.page('AnalyzePage');
}

test('guest creates local courses and tasks, uses the panel and calendar, and keeps analysis and account data separate', async()=>{
  const home=createHome();
  assert(home.page('PanelPage'));
  assert.equal(home.page('AuthPage'),undefined);
  assert.equal(home.requests.length,0);
  home.nav('Cursos');
  home.page('CoursesPage').props.setNewCourse('Curso invitado');
  await home.page('CoursesPage').props.onAdd({preventDefault(){}});
  const courseId=home.page('CoursesPage').props.courses[0].id;
  home.nav('Mis tareas');
  await home.page('TasksPage').props.onCreate(courseId,proposal);
  assert.equal(home.page('TasksPage').props.items[0].title,'Entrega final');
  home.nav('Calendario');
  assert.equal(home.page('CalendarPage').props.items[0].course_id,courseId);
  assert.equal(home.requests.length,0);
  const reloaded=createHome(new Map(),[],[],items,courses,home.guestStorage);
  assert(reloaded.page('PanelPage'));
  assert.equal(reloaded.page('CoursesPage'),undefined);
  reloaded.nav('Mis tareas');
  assert.equal(reloaded.page('TasksPage').props.items[0].title,'Entrega final');
  reloaded.nav('Panel');
  assert.equal(reloaded.page('PanelPage').props.items.length,1);
  assert.equal(reloaded.page('PanelPage').props.filters.courses[0].name,'Curso invitado');
  await reloaded.page('PanelPage').props.complete(reloaded.page('PanelPage').props.items[0].id);
  assert.equal(reloaded.page('PanelPage').props.items[0].status,'completed');
  reloaded.page('PanelPage').props.onAnalyze();
  assert.equal(reloaded.page('AnalyzePage').props.preview,true);
  assert.equal(reloaded.page('AuthRequiredDialog').props.open,false);
  await reloaded.page('AnalyzePage').props.onUpload({preventDefault(){},currentTarget:{}});
  assert.equal(reloaded.page('AuthRequiredDialog').props.open,true);
  assert.equal(reloaded.requests.length,0);
  reloaded.page('AuthRequiredDialog').props.onLogin();
  await reloaded.page('AuthPage').props.onLogin({preventDefault(){}});
  assert.equal(reloaded.page('AnalyzePage').props.preview,false);
  reloaded.nav('Cursos');
  assert.equal(reloaded.page('CoursesPage').props.courses[0].name,'Prueba');
  assert.equal(JSON.parse(home.guestStorage.get('tarevia_guest_data_v1')).activities.length,1);
  const logoutButton=reloaded.find(reloaded.render(),node=>node.type==='button'&&node.props.className==='logout')[0];
  logoutButton.props.onClick();
  const confirmLogout=reloaded.find(reloaded.render(),node=>node.type==='button'&&node.props.children==='Confirmar')[0];
  await confirmLogout.props.onClick();
  assert.equal(reloaded.page('AuthPage'),undefined);
  assert(reloaded.page('PanelPage'));
  reloaded.nav('Cursos');
  assert.equal(reloaded.page('CoursesPage').props.courses[0].name,'Curso invitado');
  assert.equal(reloaded.page('CoursesPage').props.items.length,1);
});

test('a missing session opens the panel, while direct login and registration routes stay voluntary',()=>{
  const home=createHome();
  assert(home.page('PanelPage'));
  assert.equal(home.page('AuthPage'),undefined);
  assert.equal(home.requests.length,0);

  const login=createHome(new Map(),[],[],items,courses,new Map(),'login');
  assert.equal(login.page('AuthPage').props.authMode,'login');
  assert.equal(login.requests.length,0);
  login.page('AuthPage').props.onContinueAsGuest();
  assert(login.page('PanelPage'));

  const register=createHome(new Map(),[],[],items,courses,new Map(),'register');
  assert.equal(register.page('AuthPage').props.authMode,'register');
});

test('an expired session falls back to the guest panel without exposing account activities',async()=>{
  const storage=new Map([['gestor_token','expired'],['gestor_username','private']]);
  const home=createHome(storage);
  home.page('PanelPage');
  await new Promise(resolve=>setImmediate(resolve));
  assert(home.page('PanelPage'));
  assert.equal(home.page('PanelPage').props.items.length,0);
  assert.equal(home.page('AuthPage'),undefined);
  assert.equal(storage.has('gestor_token'),false);
  assert.equal(home.requests.includes('/documents'),true);
});

test('panel exposes overdue and undated tasks and its filters do not affect Mis tareas', async()=>{
  const home=await loggedIn();
  const panel=home.page('PanelPage');
  assert.equal(panel.props.overdue[0].id,'overdue');
  assert.equal(panel.props.undated[0].id,'undated');
  panel.props.filters.setCourseFilter('course');
  panel.props.filters.setUpcomingWeeks(2);
  home.nav('Mis tareas');
  assert.equal(home.page('TasksPage').props.filters.courseFilter,'');
  home.nav('Panel');
  assert.equal(home.page('PanelPage').props.filters.upcomingWeeks,2);
});

test('panel combines course, type and completed status across dated and undated activities', async()=>{
  const other={id:'other',name:'Otro curso',code:null,term:null,is_active:true};
  const rows=[
    {id:'old-done',title:'Hecha anterior',status:'completed',course_id:'other',activity_type:'examen',due_date:'2000-01-01'},
    {id:'no-date-done',title:'Hecha sin fecha',status:'completed',course_id:'other',activity_type:'examen',due_date:null},
    {id:'future-done',title:'Hecha futura',status:'completed',course_id:'other',activity_type:'examen',due_date:'2099-01-01'},
    {id:'pending',title:'Pendiente',status:'pending',course_id:'other',activity_type:'examen',due_date:'2000-01-01'},
    {id:'other-type',title:'Otro tipo',status:'completed',course_id:'other',activity_type:'tarea',due_date:'2000-01-01'},
    {id:'other-course',title:'Otro curso',status:'completed',course_id:'course',activity_type:'examen',due_date:'2000-01-01'},
  ];
  const home=await loggedIn(new Map(),[],[],rows,[...courses,other]);
  home.page('PanelPage').props.filters.setCourseFilter('other');
  home.page('PanelPage').props.filters.setTypeFilter('examen');
  home.page('PanelPage').props.filters.setStatusFilter('completed');
  const panel=home.page('PanelPage');
  assert.deepEqual(Array.from(panel.props.upcoming, item=>item.id),['future-done']);
  assert.deepEqual(Array.from(panel.props.pastCompleted, item=>item.id),['old-done']);
  assert.deepEqual(Array.from(panel.props.undated, item=>item.id),['no-date-done']);
  assert.equal(panel.props.overdue.length,0);
  home.nav('Mis tareas');
  assert.equal(home.page('TasksPage').props.filters.statusFilter,'');
});

test('the compact navigation opens from the three-line button and closes after choosing a section', async()=>{
  const home=await loggedIn();
  const toggle=()=>home.find(home.render(),node=>node.type==='button'&&node.props.className==='mobile-menu-toggle')[0];
  assert.equal(toggle().props['aria-expanded'],false);
  toggle().props.onClick();
  assert.equal(toggle().props['aria-expanded'],true);
  assert(home.find(home.render(),node=>node.props?.id==='mobile-navigation'&&node.props.className.includes('is-open')).length);
  home.nav('Cursos');
  assert.equal(toggle().props['aria-expanded'],false);
  assert.equal(home.page('CoursesPage')?.type?.name,'CoursesPage');
});

test('a manual task is added directly without a document upload', async()=>{
  const home=await loggedIn();
  home.nav('Mis tareas');
  const error=await home.page('TasksPage').props.onCreate('course',{
    title:'Tarea manual',description:'',activity_type:'tarea',due_date:null,review_required:true,status:'pending',
  });
  assert.equal(error,null);
  assert.equal(home.manualCreations[0].title,'Tarea manual');
  assert.equal('document_id' in home.manualCreations[0],false);
  assert(home.page('TasksPage').props.items.some(item=>item.id==='manual-task'));
});

test('the new course dialog sends code and term, then closes after saving', async()=>{
  const home=await loggedIn();
  home.nav('Cursos');
  const renderCourses=()=>{const page=home.page('CoursesPage');return page.type(page.props)};
  let tree=renderCourses();
  const toggle=home.find(tree,node=>node.type==='button'&&node.props['aria-controls']==='course-create-dialog')[0];
  const dialog=home.find(tree,node=>node.type==='dialog'&&node.props.id==='course-create-dialog')[0];
  assert(toggle);
  assert(dialog);
  assert.match(realRequire('react-dom/server').renderToStaticMarkup(tree),/course-new-plus[^>]*>\+<\/span> Nuevo curso/);
  const nativeDialog={open:false,showModal(){this.open=true},close(){this.open=false}};
  dialog.props.ref.current=nativeDialog;
  toggle.props.onClick();
  tree=renderCourses();
  home.flushEffects();
  assert.equal(nativeDialog.open,true);
  const html=realRequire('react-dom/server').renderToStaticMarkup(tree);
  assert.match(html,/C[oó]digo \(opcional\)/);
  assert.match(html,/Periodo \(opcional\)/);
  const page=home.page('CoursesPage');
  page.props.setNewCourse('Matemática');
  page.props.setNewCourseCode('MAT-101');
  page.props.setNewCourseTerm('2026-II');
  const form=home.find(renderCourses(),node=>node.props?.className==='course-create-form')[0];
  await form.props.onSubmit({preventDefault(){}});
  assert.deepEqual(home.courseCreations,[{name:'Matemática',code:'MAT-101',term:'2026-II'}]);
  const cleared=home.page('CoursesPage').props;
  assert.equal(cleared.newCourse,'');
  assert.equal(cleared.newCourseCode,'');
  assert.equal(cleared.newCourseTerm,'');
  renderCourses();
  home.flushEffects();
  assert.equal(nativeDialog.open,false);
});

test('editing a course opens a dialog with its values and closes after saving', async()=>{
  const courseRows=[{id:'course',name:'Inge II',code:'ING-002',term:'2026-II',is_active:true}];
  const home=await loggedIn(new Map(),[],[],[],courseRows);
  home.nav('Cursos');
  const renderCourses=()=>{const page=home.page('CoursesPage');return page.type(page.props)};
  let tree=renderCourses();
  const dialog=home.find(tree,node=>node.type==='dialog'&&node.props.id==='course-edit-dialog')[0];
  const nativeDialog={open:false,showModal(){this.open=true},close(){this.open=false}};
  dialog.props.ref.current=nativeDialog;
  const edit=home.find(tree,node=>node.type==='button'&&node.props.children==='Editar')[0];
  edit.props.onClick({currentTarget:{closest:()=>({querySelector:()=>({focus(){}}),removeAttribute(){}})}});
  tree=renderCourses();
  home.flushEffects();
  assert.equal(nativeDialog.open,true);
  assert.match(realRequire('react-dom/server').renderToStaticMarkup(tree),/value="ING-002"/);
  const page=home.page('CoursesPage');
  page.props.setEditingCourse({...page.props.editingCourse,code:'ING-003'});
  const form=home.find(renderCourses(),node=>node.props?.className==='course-edit-form')[0];
  await form.props.onSubmit({preventDefault(){}});
  assert.deepEqual(home.courseEdits,[{name:'Inge II',code:'ING-003',term:'2026-II'}]);
  renderCourses();
  home.flushEffects();
  assert.equal(nativeDialog.open,false);
});

test('course filters and search narrow the compact list without decorative icons', async()=>{
  const courseRows=[{id:'one',name:'Base de Datos',code:null,term:null,is_active:true},{id:'two',name:'Inge II',code:'ING-002',term:'2026-II',is_active:false}];
  const home=await loggedIn(new Map(),[],[],[],courseRows);
  home.nav('Cursos');
  const renderCourses=()=>{const page=home.page('CoursesPage');return page.type(page.props)};
  let tree=renderCourses();
  assert.equal(home.find(tree,node=>node.props?.className?.startsWith?.('course-card')).length,2);
  assert.equal(home.find(tree,node=>node.type==='svg').length,0);
  home.find(tree,node=>node.type==='button'&&node.props.children==='Inactivos')[0].props.onClick();
  tree=renderCourses();
  assert.equal(home.find(tree,node=>node.props?.className?.startsWith?.('course-card')).length,1);
  assert.match(realRequire('react-dom/server').renderToStaticMarkup(tree),/ING-002/);
  home.find(tree,node=>node.type==='input'&&node.props.type==='search')[0].props.onChange({target:{value:'Sin coincidencias'}});
  tree=renderCourses();
  assert.equal(home.find(tree,node=>node.props?.className?.startsWith?.('course-card')).length,0);
});

test('failed new analysis keeps the previous document and corrected proposals', async()=>{
  const home=await loggedIn();
  const page=await analyze(home);
  page.props.onEdit(0,'title','Título corregido');
  home.render();
  home.setFailUpload(true);
  await home.page('AnalyzePage').props.onUpload({preventDefault(){},currentTarget:{}});
  assert.equal(home.page('AnalyzePage').props.docId,docId);
  assert.equal(home.page('AnalyzePage').props.proposals[0].title,'Título corregido');
});

test('pending reviews restore corrections after reload, including temporarily empty required fields', async()=>{
  const home=await loggedIn();
  const page=await analyze(home);
  page.props.onEdit(0,'title','');
  home.render();
  assert.equal(JSON.parse(home.storage.get(`tarevia-review:test:${docId}`))[0].title,'');
  const reloaded=await loggedIn(home.storage,home.pending);
  reloaded.nav('Analizar documento');
  const review=reloaded.page('AnalyzePage').props.pendingReviews[0];
  assert.equal(review.proposals[0].title,'');
  const reveal=[];
  reloaded.page('AnalyzePage').props.reviewRef.current={
    scrollIntoView(options){reveal.push(['scroll',options.block]);},
    focus(options){reveal.push(['focus',options.preventScroll]);},
  };
  reloaded.page('AnalyzePage').props.onResumeReview(review);
  assert.equal(reloaded.page('AnalyzePage').props.docId,docId);
  assert.equal(reloaded.page('AnalyzePage').props.proposals[0].title,'');
  assert.match(reloaded.page('AnalyzePage').props.reviewError,/título/);
  assert.deepEqual(reveal,[['scroll','start'],['focus',true]]);
});

test('changing a resumed review course persists and survives reload', async()=>{
  const courseRows=[...courses,{id:'other',name:'Otro curso',is_active:true}];
  const pending=[{document_id:docId,course_id:'course',filename:'programa.txt',proposals:[{...proposal}]}];
  const home=await loggedIn(new Map(),pending,[],items,courseRows);
  home.nav('Analizar documento');
  home.page('AnalyzePage').props.onResumeReview(home.page('AnalyzePage').props.pendingReviews[0]);
  const page=home.page('AnalyzePage');
  const html=realRequire('react-dom/server').renderToStaticMarkup(realRequire('react').createElement(page.type,page.props));
  assert.match(html,/Curso de esta revisión/);
  await page.props.onChangeReviewCourse('other');
  home.render();
  assert.equal(home.page('AnalyzePage').props.reviewCourseId,'other');
  assert.deepEqual(home.courseChanges,[{documentId:docId,courseId:'other'}]);
  assert.equal(pending[0].course_id,'other');

  const reloaded=await loggedIn(home.storage,pending,[],items,courseRows);
  reloaded.nav('Analizar documento');
  reloaded.page('AnalyzePage').props.onResumeReview(reloaded.page('AnalyzePage').props.pendingReviews[0]);
  assert.equal(reloaded.page('AnalyzePage').props.reviewCourseId,'other');
});

test('resuming a review recovers server proposals when the local draft has no activities', async()=>{
  const home=await loggedIn();
  await analyze(home);
  home.page('AnalyzePage').props.setProposals([]);
  home.render();
  const reloaded=await loggedIn(home.storage,home.pending);
  reloaded.nav('Analizar documento');
  const review=reloaded.page('AnalyzePage').props.pendingReviews[0];
  reloaded.page('AnalyzePage').props.onResumeReview(review);
  const resumed=reloaded.page('AnalyzePage');
  assert.equal(resumed.props.proposals.length,1);
  assert.equal(resumed.props.proposals[0].title,proposal.title);
});

test('an empty server review uses a local draft when one exists', async()=>{
  const storage=new Map([['tarevia-review:test:'+docId,JSON.stringify([proposal])]]);
  const pending=[{document_id:docId,course_id:'course',filename:'programa.txt',proposals:[]}];
  const home=await loggedIn(storage,pending);
  home.nav('Analizar documento');
  const review=home.page('AnalyzePage').props.pendingReviews[0];
  assert.equal(review.proposals[0].title,proposal.title);
});

test('uploaded documents show their filename, course and activity count', async()=>{
  const saved=[{document_id:docId,course_id:'course',filename:'programa.txt',activity_count:2}];
  const home=await loggedIn(new Map(),[],saved);
  home.nav('Analizar documento');
  const page=home.page('AnalyzePage');
  assert.equal(page.props.savedDocuments.length,1);
  const react=realRequire('react');
  const html=realRequire('react-dom/server').renderToStaticMarkup(react.createElement(page.type,page.props));
  assert.match(html,/Documentos guardados \(1\)/);
  assert.match(html,/programa\.txt/);
  assert.match(html,/2 actividades/);
  const tree=page.type(page.props);
  const trigger=home.find(tree,node=>node.type==='button'&&node.props.id==='saved-documents-trigger')[0];
  const dialog=home.find(tree,node=>node.type==='dialog'&&node.props.id==='saved-documents-dialog')[0];
  const upload=home.find(tree,node=>node.type==='section'&&node.props.className==='panel upload-panel')[0];
  assert(trigger&&dialog&&upload);
  assert(!home.find(upload,node=>node.props?.className==='saved-document').length);
  let opened=0,closed=0;
  trigger.props.onClick({currentTarget:{ownerDocument:{querySelector(){return{showModal(){opened++}}}}}});
  home.find(dialog,node=>node.type==='button'&&node.props.children==='Cerrar')[0].props.onClick({currentTarget:{closest(){return{close(){closed++}}}}});
  assert.equal(opened,1);
  assert.equal(closed,1);
});

test('saved document deletion requires confirmation and removes linked tasks', async()=>{
  const saved=[{document_id:docId,course_id:'course',filename:'programa.txt',activity_count:1}];
  const linked={...items[0],id:'linked',document_id:docId};
  const manual={...items[1],id:'manual',document_id:null};
  const home=await loggedIn(new Map(),[],saved,[linked,manual]);
  home.nav('Analizar documento');
  const page=home.page('AnalyzePage');
  const tree=page.type(page.props);
  const dialog=home.find(tree,node=>node.type==='dialog'&&node.props.id===`delete-saved-dialog-${docId}`)[0];
  const trigger=home.find(tree,node=>node.type==='button'&&node.props.id===`delete-saved-trigger-${docId}`)[0];
  assert(dialog&&trigger);
  const html=realRequire('react-dom/server').renderToStaticMarkup(realRequire('react').createElement(page.type,page.props));
  assert.match(html,/Se borrará.*programa\.txt.*la tarea asociada/);
  let opened=0,closed=0;
  trigger.props.onClick({currentTarget:{ownerDocument:{querySelector(){return{showModal(){opened++}}}}}});
  const cancel=home.find(dialog,node=>node.type==='button'&&node.props.children==='Cancelar')[0];
  cancel.props.onClick({currentTarget:{closest(){return{close(){closed++}}}}});
  assert.equal(opened,1);
  assert.equal(closed,1);
  assert.equal(home.requests.includes(`/documents/${docId}/saved`),false);
  const confirm=home.find(dialog,node=>node.type==='button'&&node.props.children==='Confirmar borrado')[0];
  await confirm.props.onClick({currentTarget:{closest(){return{isConnected:true,open:true,close(){closed++}}}}});
  assert.equal(closed,2);
  assert(home.requests.includes(`/documents/${docId}/saved`));
  assert.equal(home.page('AnalyzePage').props.savedDocuments.length,0);
  home.nav('Mis tareas');
  assert.deepEqual(home.page('TasksPage').props.items.map(activity=>activity.id),['manual']);
});

test('failed saved document deletion leaves confirmation open with an error', async()=>{
  const saved=[{document_id:docId,course_id:'course',filename:'programa.txt',activity_count:1}];
  const home=await loggedIn(new Map(),[],saved,[{...items[0],document_id:docId}]);
  home.nav('Analizar documento');
  home.setFailSavedDelete(true);
  const tree=home.page('AnalyzePage').type(home.page('AnalyzePage').props);
  const dialog=home.find(tree,node=>node.type==='dialog'&&node.props.id===`delete-saved-dialog-${docId}`)[0];
  const confirm=home.find(dialog,node=>node.type==='button'&&node.props.children==='Confirmar borrado')[0];
  let closed=0;
  await confirm.props.onClick({currentTarget:{closest(){return{close(){closed++}}}}});
  assert.equal(closed,0);
  assert.equal(home.page('AnalyzePage').props.savedDocuments.length,1);
  assert.match(home.page('AnalyzePage').props.deleteSavedError,/No se pudo borrar/);
});

test('an empty review lets the user select the original file for analysis', async()=>{
  const pending=[{document_id:docId,course_id:'course',filename:'programa.txt',proposals:[]}];
  const home=await loggedIn(new Map(),pending);
  home.nav('Analizar documento');
  const page=home.page('AnalyzePage');
  let opened=0;
  const input={value:'old-file',click(){opened++}};
  page.props.uploadFormRef.current={querySelector(){return input}};
  const tree=page.type(page.props);
  const button=home.find(tree,node=>node.type==='button'&&node.props.children==='Seleccionar archivo')[0];
  assert(button);
  assert.equal(button.props.disabled,false);
  button.props.onClick();
  assert.equal(opened,1);
  assert.equal(input.value,'');
  assert.equal(home.page('AnalyzePage').props.uploadCourse,'course');
});

test('current analysis enters pending reviews only after leaving without saving', async()=>{
  const home=await loggedIn();
  await analyze(home);
  home.render();
  assert.equal(home.storage.has('tarevia-review:test:'+docId),true);
  assert.equal(home.page('AnalyzePage').props.pendingReviews.length,0);
  home.nav('Panel');
  home.nav('Analizar documento');
  assert.equal(home.page('AnalyzePage').props.docId,'');
  assert.equal(home.page('AnalyzePage').props.pendingReviews.length,1);
});

test('the X removes an abandoned pending review from the server', async()=>{
  const home=await loggedIn();
  await analyze(home);
  home.render();
  home.nav('Panel');
  home.nav('Analizar documento');
  const page=home.page('AnalyzePage');
  const button=home.find(page.type(page.props),node=>node.type==='button'&&node.props['aria-label']==='Quitar revisión programa.txt')[0];
  assert(button);
  await button.props.onClick();
  const cleared=home.page('AnalyzePage');
  assert.equal(cleared.props.pendingReviews.length,0);
  assert.equal(cleared.props.docId,'');
  assert.equal(cleared.props.proposals.length,0);
  assert.equal(home.storage.has('tarevia-review:test:'+docId),false);
  assert(home.requests.includes('/documents/'+docId));
});

test('confirmation clears review and upload state and stays on the analysis page', async()=>{
  const home=await loggedIn();
  const page=await analyze(home);
  home.render();
  assert.equal(home.storage.has('tarevia-review:test:'+docId),true);
  await page.props.onConfirm();
  const cleared=home.page('AnalyzePage');
  assert(cleared);
  assert.equal(cleared.props.docId,'');
  assert.equal(cleared.props.uploadCourse,'');
  assert.equal(cleared.props.selectedFileName,'');
  assert.equal(cleared.props.proposals.length,0);
  assert.equal(home.storage.has('tarevia-review:test:'+docId),false);
});

test('a past proposal can be saved as delivered and changing it to a future date resets its status', async()=>{
  const home=await loggedIn();
  await analyze(home);
  home.page('AnalyzePage').props.onEdit(0,'due_date','2000-01-01');
  home.page('AnalyzePage').props.onEdit(0,'status','completed');
  await home.page('AnalyzePage').props.onConfirm();
  assert.equal(home.confirmations[0].activities[0].status,'completed');

  await analyze(home);
  home.page('AnalyzePage').props.onEdit(0,'due_date','2000-01-01');
  home.page('AnalyzePage').props.onEdit(0,'status','completed');
  home.page('AnalyzePage').props.onEdit(0,'due_date','2099-01-01');
  assert.equal(home.page('AnalyzePage').props.proposals[0].status,'pending');
});

test('review edits preserve the position of activities while typing', async()=>{
  const home=await loggedIn();
  const page=await analyze(home);
  page.props.setProposals([proposal,{...proposal,title:'Segundo'}]);
  home.render();
  home.page('AnalyzePage').props.onEdit(0,'due_date','2099-02-01');
  const edited=home.page('AnalyzePage');
  assert.equal(edited.props.proposals[0].title,proposal.title);
  const exports=realRequire('react-dom/server');
  const html=exports.renderToStaticMarkup(realRequire('react').createElement(edited.type,edited.props));
  assert.ok(html.indexOf('value="Entrega final"')<html.indexOf('value="Segundo"'));
});

test('errors automatically dismiss after five seconds', async()=>{
  const home=await loggedIn();
  home.nav('Analizar documento');home.setFailUpload(true);
  await home.page('AnalyzePage').props.onUpload({preventDefault(){},currentTarget:{}});
  home.render();
  assert.equal(home.timers.length,1);
  assert.equal(home.timers[0].delay,5000);
  home.timers[0].callback();
  const tree=home.render();
  function errorToasts(node){
    if(!node||typeof node!=="object")return [];
    return [...(node.props?.kind==="error"?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(errorToasts)];
  }
  assert.equal(errorToasts(tree).length,0);
});


test('logout asks the server to revoke the token before clearing the local session', async()=>{
  const home=await loggedIn();
  const button=home.find(home.render(),node=>node.type==='button'&&node.props.className==='primary'&&node.props.children==='Confirmar')[0];
  await button.props.onClick();
  assert.equal(home.requests.includes('/auth/logout'),true);
  assert.equal(home.storage.has('gestor_token'),false);
  assert(home.page('PanelPage'));
  assert.equal(home.page('AuthPage'),undefined);
});

test('failed logout keeps the session and shows the error inside the confirmation dialog', async()=>{
  const home=await loggedIn();home.setFailLogout(true);
  const button=home.find(home.render(),node=>node.type==='button'&&node.props.className==='primary'&&node.props.children==='Confirmar')[0];
  await button.props.onClick();
  assert.equal(home.storage.has('gestor_token'),true);
  assert(home.page('PanelPage'));
  const dialog=home.find(home.render(),node=>node.type==='dialog')[0];
  assert.equal(home.find(dialog,node=>node.props?.role==='alert').length,1);
});
