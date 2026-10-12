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

function createHome(storage=new Map(), pending=[], saved=[], initialItems=items) {
  const timers=[];
  const state=[],effectDeps=[],effects=[];let cursor=0,effectCursor=0,failUpload=false,failLogout=false,failSavedDelete=false;
  const requests=[];
  const confirmations=[];
  const manualCreations=[];
  const activityRows=[...initialItems];
  const hooks={
    useState(initial){const index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return[state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value}];},
    useRef(initial){return hooks.useState(()=>({current:initial}))[0];},
    useMemo(fn){return fn();},
    useEffect(fn,deps){const index=effectCursor++;if(!effectDeps[index]||deps.some((dep,i)=>dep!==effectDeps[index][i])){effectDeps[index]=deps;effects.push(fn);}},
  };
  class FormData {constructor(form){this.form=form;}}
  const context={exports:{},FormData,localStorage:{getItem(){return null}},sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    window:{setTimeout(callback, delay){timers.push({callback,delay});return timers.length},clearTimeout(){}},
    fetch:async (url,init={})=>{
      const suffix=url.split('/api')[1];requests.push(suffix);let data,status=200;
      if(suffix==='/auth/login')data={access_token:'fake',username:'test'};
      else if(suffix==='/courses')data=courses;
      else if(suffix==='/activities'&&init.method==='POST'){
        const body=JSON.parse(init.body);manualCreations.push(body);
        data={...body,id:'manual-task',document_id:null};
      }
      else if(suffix==='/activities')data=activityRows;
      else if(suffix==='/documents/pending')data=pending;
      else if(suffix==='/documents')data=saved;
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
  const Home=load(path.join(root,'src/app/page.tsx')).default;
  function render(){cursor=0;effectCursor=0;const tree=Home();while(effects.length)effects.shift()();return tree;}
  function find(node,predicate){if(!node||typeof node!=='object')return[];return[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>find(child,predicate))];}
  function page(name){return find(render(),node=>node.type?.name===name)[0];}
  function nav(label){const button=find(render(),node=>node.type==='button'&&String(node.props.className).startsWith('nav')&&node.props.children[1].props.children===label)[0];assert(button);button.props.onClick();render();}
  return{render,page,nav,storage,pending,saved,timers,find,requests,confirmations,manualCreations,setFailLogout:value=>{failLogout=value},setFailUpload:value=>{failUpload=value},setFailSavedDelete:value=>{failSavedDelete=value}};
}



async function loggedIn(storage, pending, saved, activities) {
  const home=createHome(storage,pending,saved,activities);
  await home.page('AuthPage').props.onLogin({preventDefault(){}});
  return home;
}
async function analyze(home) {
  home.nav('Analizar documento');
  await home.page('AnalyzePage').props.onUpload({preventDefault(){},currentTarget:{}});
  return home.page('AnalyzePage');
}

test('panel exposes overdue and undated tasks and its filters do not affect Mis tareas', async()=>{
  const home=await loggedIn();
  const panel=home.page('PanelPage');
  assert.equal(panel.props.overdue[0].id,'overdue');
  assert.equal(panel.props.undated[0].id,'undated');
  panel.props.filters.setCourseFilter('course');
  home.nav('Mis tareas');
  assert.equal(home.page('TasksPage').props.filters.courseFilter,'');
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
  const reloaded=await loggedIn(home.storage,home.pending);
  reloaded.nav('Analizar documento');
  const review=reloaded.page('AnalyzePage').props.pendingReviews[0];
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
  assert(home.page('AuthPage'));
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
