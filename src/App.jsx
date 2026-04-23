import { useState, useEffect } from "react";

const ETAPAS = [
  { id:"recepcion", label:"Recepción", icon:"🚛", color:"#4ade80" },
  { id:"repelado",  label:"Repelado",  icon:"🍑", color:"#fb923c" },
  { id:"ojochino",  label:"Ojo Chino", icon:"👁",  color:"#60a5fa" },
  { id:"ojoelius",  label:"Ojo Elius", icon:"👁",  color:"#a78bfa" },
];
const ORDEN     = ["recepcion","repelado","ojochino","ojoelius"];
const SIGUIENTE = { recepcion:"repelado", repelado:"ojochino", ojochino:"ojoelius" };
const SUP_PIN   = "1972";

function uid()    { return Math.random().toString(36).slice(2,9); }
function round(n) { return Math.round(n*10)/10; }
function fmt(iso) {
  if(!iso) return "—";
  return new Date(iso).toLocaleString("es-CL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function fmtDia(iso) {
  if(!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
}

// ── Lógica pesajes ────────────────────────────────────────────────────────────
function pesajesDeEtapa(loteId, etapaId, registros) {
  return registros.filter(r=>r.loteId===loteId&&r.etapaId===etapaId);
}
function totalKgEtapa(loteId, etapaId, registros) {
  return round(pesajesDeEtapa(loteId,etapaId,registros)
    .filter(r=>r.estado==="aceptado")
    .reduce((s,r)=>s+r.kg,0));
}
function etapaCerrada(loteId, etapaId, registros) {
  return pesajesDeEtapa(loteId,etapaId,registros).some(r=>r.cerrada===true);
}
function calcMerma(loteId, etapaId, registros) {
  const idx=ORDEN.indexOf(etapaId);
  if(idx<=0) return null;
  const kgAnt=totalKgEtapa(loteId,ORDEN[idx-1],registros);
  const kgAct=totalKgEtapa(loteId,etapaId,registros);
  if(kgAnt===0||kgAct===0) return null;
  const mKg=round(kgAnt-kgAct);
  const mPct=(mKg/kgAnt*100).toFixed(1);
  return {mKg,mPct,kgAnt};
}
function estEtapa(loteId, etapaId, registros) {
  const idx=ORDEN.indexOf(etapaId);
  const ps=pesajesDeEtapa(loteId,etapaId,registros);
  if(ps.some(r=>r.cerrada)) return "cerrada";
  if(ps.length>0) return "en_proceso";
  if(idx===0) return "disponible";
  if(etapaCerrada(loteId,ORDEN[idx-1],registros)) return "disponible";
  return "bloqueada";
}
function mc(pct){ return parseFloat(pct)>15?"#f87171":parseFloat(pct)>8?"#fb923c":"#facc15"; }

// ── UI helpers ────────────────────────────────────────────────────────────────
function Badge({color,children}){
  return <span style={{background:color+"22",color,padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:700}}>{children}</span>;
}
function Card({children,style={}}){
  return <div style={{background:"#1a1d27",border:"1px solid #2a2d3a",borderRadius:14,padding:18,...style}}>{children}</div>;
}
function Lbl({children}){
  return <div style={{fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:1,marginBottom:9}}>{children}</div>;
}
function FI({label,...p}){
  return(
    <div style={{marginTop:11}}>
      {label&&<div style={{fontSize:12,color:"#6b7280",marginBottom:4}}>{label}</div>}
      <input {...p} style={{width:"100%",background:"#0f1117",border:"1px solid #2a2d3a",borderRadius:10,padding:"11px 14px",color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box",...p.style}}/>
    </div>
  );
}
function Btn({children,onClick,disabled,bg="#4ade80",fg="#000",style={}}){
  return(
    <button onClick={onClick} disabled={disabled} style={{background:disabled?"#1f2937":bg,color:disabled?"#374151":fg,border:"none",borderRadius:11,padding:"12px 18px",fontWeight:700,cursor:disabled?"not-allowed":"pointer",fontSize:13,...style}}>
      {children}
    </button>
  );
}
function Alerta({color,children,style={}}){
  return <div style={{padding:"10px 14px",background:color+"18",border:`1px solid ${color}44`,borderRadius:11,color,fontSize:13,marginTop:10,...style}}>{children}</div>;
}
function PinPad({value,onChange,label}){
  const keys=["1","2","3","4","5","6","7","8","9","←","0","OK"];
  function tap(k){
    if(k==="←"){onChange(value.slice(0,-1));return;}
    if(k==="OK") return;
    if(value.length<4) onChange(value+k);
  }
  return(
    <div>
      {label&&<div style={{fontSize:12,color:"#6b7280",marginBottom:10}}>{label}</div>}
      <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:14}}>
        {[0,1,2,3].map(i=><div key={i} style={{width:14,height:14,borderRadius:"50%",background:i<value.length?"#4ade80":"#374151"}}/>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
        {keys.map(k=>(
          <button key={k} onClick={()=>tap(k)} style={{padding:"14px",borderRadius:11,border:"none",background:k==="←"?"#1f2937":"#1a1d27",color:k==="←"?"#9ca3af":"#fff",fontSize:17,fontWeight:700,cursor:"pointer"}}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
function Overlay({children,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"#000c",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#1a1d27",border:"1px solid #374151",borderRadius:18,padding:24,width:320,maxWidth:"90vw",maxHeight:"88vh",overflowY:"auto"}}>
        {children}
      </div>
    </div>
  );
}
function LoginModal({operarios,onLogin,onClose}){
  const [opId,setOpId]=useState("");
  const [pin,setPin]=useState("");
  const [err,setErr]=useState(false);
  function tryLogin(p){ const op=operarios.find(o=>o.id===opId); if(op&&op.pin===p){onLogin(op);}else{setErr(true);setPin("");} }
  function handlePin(v){ setPin(v); setErr(false); if(v.length===4) tryLogin(v); }
  return(
    <Overlay onClose={onClose}>
      <div style={{fontSize:20,marginBottom:4}}>👤</div>
      <div style={{fontSize:16,fontWeight:800,marginBottom:3}}>Identificarse</div>
      <div style={{fontSize:12,color:"#6b7280",marginBottom:14}}>Selecciona nombre e ingresa PIN</div>
      <select value={opId} onChange={e=>{setOpId(e.target.value);setPin("");setErr(false);}}
        style={{width:"100%",background:"#0f1117",border:"1px solid #2a2d3a",borderRadius:10,padding:"11px 14px",color:opId?"#fff":"#6b7280",fontSize:14,outline:"none",marginBottom:14}}>
        <option value="">— Seleccionar operario —</option>
        {operarios.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
      {opId&&<PinPad value={pin} onChange={handlePin} label={`PIN de ${operarios.find(o=>o.id===opId)?.nombre}`}/>}
      {err&&<Alerta color="#f87171">PIN incorrecto.</Alerta>}
      <button onClick={onClose} style={{marginTop:12,background:"none",border:"none",color:"#4b5563",fontSize:13,cursor:"pointer",width:"100%",textAlign:"center"}}>Cancelar</button>
    </Overlay>
  );
}
function SupModal({titulo,desc,onConfirm,onClose}){
  const [pin,setPin]=useState("");
  const [err,setErr]=useState(false);
  function handlePin(v){ setPin(v); setErr(false); if(v.length===4){ if(v===SUP_PIN) onConfirm(); else{setErr(true);setPin("");} } }
  return(
    <Overlay onClose={onClose}>
      <div style={{fontSize:20,marginBottom:4}}>🔐</div>
      <div style={{fontSize:16,fontWeight:700,marginBottom:3}}>{titulo}</div>
      <div style={{fontSize:12,color:"#9ca3af",marginBottom:16}}>{desc}</div>
      <PinPad value={pin} onChange={handlePin} label="PIN Supervisor"/>
      {err&&<Alerta color="#f87171">PIN incorrecto.</Alerta>}
      <button onClick={onClose} style={{marginTop:12,background:"none",border:"none",color:"#4b5563",fontSize:13,cursor:"pointer",width:"100%",textAlign:"center"}}>Cancelar</button>
    </Overlay>
  );
}
function EditLoteModal({lote,onSave,onClose}){
  const [f,setF]=useState({proveedor:lote.proveedor||"",especie:lote.especie||"",variedad:lote.variedad||"",guia:lote.guia||"",rampla:lote.rampla||""});
  return(
    <Overlay onClose={onClose}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:14}}>✏️ Editar lote <span style={{fontSize:11,color:"#9ca3af"}}>(Supervisor)</span></div>
      {["proveedor","especie","variedad"].map(k=>(
        <FI key={k} label={k.charAt(0).toUpperCase()+k.slice(1)} value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/>
      ))}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <FI label="N° Guía" type="number" value={f.guia} onChange={e=>setF({...f,guia:e.target.value})}/>
        <FI label="N° Rampla" type="number" value={f.rampla} onChange={e=>setF({...f,rampla:e.target.value})}/>
      </div>
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <Btn onClick={onClose} bg="#1f2937" fg="#9ca3af" style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={()=>onSave(f)} disabled={!f.proveedor} style={{flex:2}}>Guardar</Btn>
      </div>
    </Overlay>
  );
}
function EditPesajeModal({pesaje,onSave,onClose}){
  const [kg,setKg]=useState(String(pesaje.kg));
  const [com,setCom]=useState(pesaje.comentario||"");
  return(
    <Overlay onClose={onClose}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:14}}>✏️ Editar pesaje <span style={{fontSize:11,color:"#9ca3af"}}>(Supervisor)</span></div>
      <FI label="KG" type="number" value={kg} onChange={e=>setKg(e.target.value)}/>
      <div style={{marginTop:11}}>
        <div style={{fontSize:12,color:"#6b7280",marginBottom:4}}>Comentario</div>
        <textarea value={com} onChange={e=>setCom(e.target.value)} rows={2} placeholder="Bin lleno, máquina lenta..."
          style={{width:"100%",background:"#0f1117",border:"1px solid #2a2d3a",borderRadius:10,padding:"10px 14px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box",resize:"none",fontFamily:"inherit"}}/>
      </div>
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <Btn onClick={onClose} bg="#1f2937" fg="#9ca3af" style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={()=>onSave({kg:parseFloat(kg),comentario:com})} disabled={!kg} style={{flex:2}}>Guardar</Btn>
      </div>
    </Overlay>
  );
}

// ── Panel Supervisor ──────────────────────────────────────────────────────────
function PanelSupervisor({operarios,setOperarios,onClose}){
  const [nombre,setNombre]=useState(""); const [etapaOp,setEtapaOp]=useState("");
  const [pin1,setPin1]=useState(""); const [pin2,setPin2]=useState("");
  const [paso,setPaso]=useState(1); const [flash,setFlash]=useState("");
  function hdl1(v){ setPin1(v); if(v.length===4) setPaso(3); }
  function hdl2(v){
    setPin2(v);
    if(v.length===4){
      if(v===pin1){ const op={id:uid(),nombre:nombre.trim(),etapa:etapaOp||null,pin:v,creadoEn:new Date().toISOString()}; setOperarios(p=>[...p,op]); setNombre(""); setEtapaOp(""); setPin1(""); setPin2(""); setPaso(1); setFlash("ok"); setTimeout(()=>setFlash(""),2500); }
      else { setFlash("nc"); setPin2(""); }
    }
  }
  function eliminar(id){ if(!window.confirm("¿Eliminar?"))return; setOperarios(p=>p.filter(o=>o.id!==id)); }
  return(
    <div style={{minHeight:"100%",background:"#0a0c13",color:"#fff",fontFamily:"sans-serif",padding:"16px 16px 50px"}}>
      <div style={{maxWidth:440,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontSize:17,fontWeight:800}}>🔐 Panel Supervisor</div>
          <button onClick={onClose} style={{background:"#1a1d27",border:"1px solid #2a2d3a",borderRadius:9,color:"#9ca3af",padding:"7px 14px",cursor:"pointer",fontSize:12}}>← Volver</button>
        </div>
        <Card style={{marginBottom:16}}>
          <Lbl>Nuevo operario</Lbl>
          {paso===1&&(<><FI label="Nombre" placeholder="Ej: Juan Pérez" value={nombre} onChange={e=>setNombre(e.target.value)}/>
            <div style={{marginTop:11}}><div style={{fontSize:12,color:"#6b7280",marginBottom:4}}>Etapa asignada (opcional)</div>
              <select value={etapaOp} onChange={e=>setEtapaOp(e.target.value)} style={{width:"100%",background:"#0f1117",border:"1px solid #2a2d3a",borderRadius:10,padding:"11px 14px",color:etapaOp?"#fff":"#6b7280",fontSize:14,outline:"none"}}>
                <option value="">Todas las etapas</option>
                {ETAPAS.map(e=><option key={e.id} value={e.id}>{e.icon} {e.label}</option>)}
              </select>
            </div>
            <Btn onClick={()=>nombre.trim()&&setPaso(2)} disabled={!nombre.trim()} style={{width:"100%",marginTop:14}}>Siguiente → Crear PIN</Btn>
          </>)}
          {paso===2&&<><div style={{fontSize:13,color:"#9ca3af",marginBottom:14}}>Operario: <b style={{color:"#fff"}}>{nombre}</b></div><PinPad value={pin1} onChange={hdl1} label="PIN (4 dígitos)"/></>}
          {paso===3&&(<><div style={{fontSize:13,color:"#9ca3af",marginBottom:14}}>Confirma PIN para <b style={{color:"#fff"}}>{nombre}</b></div><PinPad value={pin2} onChange={hdl2} label="Repite el PIN"/>{flash==="nc"&&<Alerta color="#f87171">PINs no coinciden.</Alerta>}</>)}
          {flash==="ok"&&<Alerta color="#4ade80">✓ Operario creado</Alerta>}
          {paso>1&&<button onClick={()=>{setPaso(1);setPin1("");setPin2("");setFlash("");}} style={{marginTop:10,background:"none",border:"none",color:"#4b5563",fontSize:12,cursor:"pointer",width:"100%",textAlign:"center"}}>← Volver</button>}
        </Card>
        <Lbl>Operarios ({operarios.length})</Lbl>
        {operarios.length===0?<Card><div style={{textAlign:"center",padding:"12px 0",color:"#374151",fontSize:13}}>Sin operarios aún.</div></Card>
          :operarios.map(op=>{ const et=ETAPAS.find(e=>e.id===op.etapa);
            return(<Card key={op.id} style={{marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:14,fontWeight:700}}>👤 {op.nombre}</div>
                {et?<div style={{marginTop:4}}><Badge color={et.color}>{et.icon} {et.label}</Badge></div>:<div style={{fontSize:11,color:"#4b5563",marginTop:4}}>Todas las etapas</div>}
              </div>
              <button onClick={()=>eliminar(op.id)} style={{background:"#1f2937",border:"none",borderRadius:9,color:"#f87171",padding:"7px 12px",cursor:"pointer",fontSize:12}}>Eliminar</button>
            </Card>);
          })
        }
      </div>
    </div>
  );
}

// ── Panel Historial ───────────────────────────────────────────────────────────
function PanelHistorial({historial,onClose}){
  const [sel,setSel]=useState(null);
  const sesion=sel!=null?historial[sel]:null;
  function lotesPorFecha(s){ const g={}; s.lotes.forEach(l=>{ const f=l.creadoEn?new Date(l.creadoEn).toDateString():"Sin fecha"; if(!g[f]) g[f]={fecha:l.creadoEn,lotes:[]}; g[f].lotes.push(l); }); return Object.values(g).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)); }
  return(
    <div style={{minHeight:"100%",background:"#080b12",color:"#fff",fontFamily:"sans-serif",padding:"16px 16px 50px"}}>
      <div style={{maxWidth:900,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <div><div style={{fontSize:20,fontWeight:800}}>📅 Historial</div><div style={{fontSize:12,color:"#6b7280"}}>Ordenado por fecha de inicio de lote</div></div>
          <button onClick={onClose} style={{background:"#1a1d27",border:"1px solid #2a2d3a",borderRadius:9,color:"#9ca3af",padding:"8px 16px",cursor:"pointer",fontSize:13}}>← Volver</button>
        </div>
        {historial.length===0
          ?<div style={{textAlign:"center",padding:"60px 0",color:"#374151"}}><div style={{fontSize:38,marginBottom:12}}>📭</div><div style={{fontSize:15,fontWeight:600,color:"#4b5563"}}>Sin historial guardado</div></div>
          :<div style={{display:"grid",gridTemplateColumns:sesion?"260px 1fr":"1fr",gap:20}}>
            <div>
              <Lbl>Sesiones ({historial.length})</Lbl>
              {[...historial].reverse().map((h,i)=>{ const idx=historial.length-1-i; const kgIn=h.lotes.reduce((s,l)=>s+round(h.registros.filter(r=>r.loteId===l.id&&r.etapaId==="recepcion"&&r.estado==="aceptado").reduce((s2,r)=>s2+r.kg,0)),0);
                return(<Card key={idx} style={{marginBottom:10,cursor:"pointer",border:sel===idx?"1px solid #4ade80":"1px solid #2a2d3a"}} onClick={()=>setSel(sel===idx?null:idx)}>
                  <div style={{fontSize:13,fontWeight:700,color:sel===idx?"#4ade80":"#fff",marginBottom:4}}>📅 {fmtDia(h.guardadoEn)}</div>
                  <div style={{fontSize:11,color:"#6b7280"}}>{fmt(h.guardadoEn)}</div>
                  <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}><Badge color="#60a5fa">{h.lotes.length} lotes</Badge><Badge color="#4ade80">{kgIn} kg</Badge></div>
                </Card>);
              })}
            </div>
            {sesion&&(
              <div>
                <Lbl>Detalle — {fmtDia(sesion.guardadoEn)}</Lbl>
                {lotesPorFecha(sesion).map((grupo,gi)=>(
                  <div key={gi} style={{marginBottom:24}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#9ca3af",marginBottom:12}}>🗓 Lotes iniciados el {fmtDia(grupo.fecha)}</div>
                    {[...new Set(grupo.lotes.map(l=>l.proveedor))].map(prov=>(
                      <div key={prov} style={{marginBottom:18}}>
                        <div style={{fontSize:12,fontWeight:700,color:"#9ca3af",marginBottom:10}}>🌿 {prov}</div>
                        {grupo.lotes.filter(l=>l.proveedor===prov).map(lote=>(
                          <div key={lote.id} style={{marginBottom:14}}>
                            <div style={{display:"flex",gap:6,marginBottom:7,flexWrap:"wrap"}}>
                              {lote.guia&&<Badge color="#60a5fa">📋 Guía {lote.guia}</Badge>}
                              {lote.rampla&&<Badge color="#fb923c">🚛 Rampla {lote.rampla}</Badge>}
                              {lote.especie&&<Badge color="#4ade80">🌰 {lote.especie}</Badge>}
                            </div>
                            <div style={{display:"flex",alignItems:"center",overflowX:"auto",background:"#0f1117",borderRadius:12,padding:"12px",gap:0}}>
                              {ETAPAS.map((e,i)=>{
                                const ps=sesion.registros.filter(r=>r.loteId===lote.id&&r.etapaId===e.id);
                                const total=round(ps.filter(r=>r.estado==="aceptado").reduce((s,r)=>s+r.kg,0));
                                const cerrada=ps.some(r=>r.cerrada);
                                const m=cerrada?calcMerma(lote.id,e.id,sesion.registros):null;
                                return(
                                  <div key={e.id} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                                    <div style={{background:ps.length>0?"#1a1d27":"#0a0c13",border:`1px solid ${ps.length>0?e.color+"44":"#1f2937"}`,borderRadius:11,padding:"10px 11px",minWidth:108,textAlign:"center"}}>
                                      <div style={{fontSize:14}}>{ps.length>0?e.icon:"🔒"}</div>
                                      <div style={{fontSize:10,color:ps.length>0?e.color:"#374151",fontWeight:700,marginTop:3}}>{e.label}</div>
                                      {total>0&&<div style={{marginTop:5}}>
                                        <div style={{background:"#0f1117",borderRadius:7,padding:"4px 7px",marginBottom:3}}>
                                          <div style={{fontSize:8,color:"#6b7280"}}>{ps.filter(r=>r.estado==="aceptado").length} pesajes</div>
                                          <div style={{fontSize:13,fontWeight:800,color:"#4ade80"}}>{total} kg</div>
                                        </div>
                                        {m&&m.mKg>0&&<div style={{fontSize:8,color:mc(m.mPct)}}>🍂 -{m.mKg} ({m.mPct}%)</div>}
                                        <div style={{fontSize:9,color:cerrada?"#4ade80":"#fb923c"}}>{cerrada?"✅ cerrada":"🔄 en proceso"}</div>
                                      </div>}
                                    </div>
                                    {i<ETAPAS.length-1&&<div style={{width:14,height:2,background:cerrada?"#4ade80":"#1f2937",flexShrink:0}}/>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        }
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  VISTA TERRENO
// ════════════════════════════════════════════════════════════
function VistaTerreno({data,setData,operarios}){
  const [operario,setOperario]=useState(null);
  const [showLogin,setShowLogin]=useState(false);
  const [supModal,setSupModal]=useState(null);
  const [flash,setFlash]=useState("");
  const [loteId,setLoteId]=useState("");
  const [etapaId,setEtapaId]=useState("");
  const [kgEnt,setKgEnt]=useState("");
  const [comentario,setComentario]=useState("");
  const [showNuevo,setShowNuevo]=useState(false);
  const [nL,setNL]=useState({proveedor:"",especie:"",variedad:"",guia:"",rampla:""});
  const [editLote,setEditLote]=useState(null);
  const [editPesaje,setEditPesaje]=useState(null);

  function msg(m){ setFlash(m); setTimeout(()=>setFlash(""),2800); }

  function crearLote(){
    if(!nL.proveedor.trim()) return;
    const lote={id:uid(),...nL,proveedor:nL.proveedor.trim(),creadoEn:new Date().toISOString()};
    setData(d=>({...d,lotes:[...d.lotes,lote]}));
    setLoteId(lote.id); setEtapaId("");
    setNL({proveedor:"",especie:"",variedad:"",guia:"",rampla:""}); setShowNuevo(false);
  }

  useEffect(()=>{ setKgEnt(""); setComentario(""); },[loteId,etapaId]);

  const loteActual  = data.lotes.find(l=>l.id===loteId);
  const etapaActual = ETAPAS.find(e=>e.id===etapaId);
  const eActual     = loteId&&etapaId ? estEtapa(loteId,etapaId,data.registros) : null;
  const pesajes     = loteId&&etapaId ? pesajesDeEtapa(loteId,etapaId,data.registros) : [];
  const totalAcept  = loteId&&etapaId ? totalKgEtapa(loteId,etapaId,data.registros) : 0;
  const pend        = data.registros.filter(r=>r.estado==="pendiente").length;
  const nombres     = [...new Set(data.lotes.map(l=>l.proveedor).filter(Boolean))].sort();

  const mermaPreview=(()=>{
    if(!loteId||!etapaId||!kgEnt) return null;
    const idx=ORDEN.indexOf(etapaId); if(idx<=0) return null;
    const kgAnt=totalKgEtapa(loteId,ORDEN[idx-1],data.registros); if(kgAnt===0) return null;
    const totalSalida=totalAcept+parseFloat(kgEnt||0);
    const mKg=round(kgAnt-totalSalida);
    const mPct=(mKg/kgAnt*100).toFixed(1);
    return {mKg,mPct,kgAnt,totalSalida};
  })();

  function registrarPesaje(){
    if(!operario){setShowLogin(true);return;}
    if(!loteId||!etapaId||!kgEnt) return;
    const p={id:uid(),loteId,etapaId,kg:parseFloat(kgEnt),comentario:comentario.trim(),operario:operario.nombre,operarioId:operario.id,operarioAcepta:null,estado:"pendiente",cerrada:false,fechaRegistro:new Date().toISOString(),fechaAcepta:null};
    setData(d=>({...d,registros:[...d.registros,p]}));
    setKgEnt(""); setComentario(""); msg("ok");
  }

  function aceptarPesaje(pesajeId){
    if(!operario){setShowLogin(true);return;}
    setData(d=>({...d,registros:d.registros.map(r=>r.id===pesajeId?{...r,estado:"aceptado",operarioAcepta:operario.nombre,fechaAcepta:new Date().toISOString()}:r)}));
    msg("aceptado");
  }

  function cerrarEtapa(){
    if(!operario){setShowLogin(true);return;}
    if(totalAcept===0){ msg("sinKg"); return; }
    setData(d=>({...d,registros:d.registros.map(r=>r.loteId===loteId&&r.etapaId===etapaId?{...r,cerrada:true}:r)}));
    msg("cerrado");
  }

  function confirmarSup(){
    const {tipo,payload}=supModal;
    if(tipo==="rechazar")    setData(d=>({...d,registros:d.registros.map(r=>r.id===payload?{...r,estado:"rechazado"}:r)}));
    if(tipo==="reabrir")     setData(d=>({...d,registros:d.registros.map(r=>r.id===payload?{...r,estado:"pendiente",fechaAcepta:null,operarioAcepta:null}:r)}));
    if(tipo==="reabrirEtapa") setData(d=>({...d,registros:d.registros.map(r=>r.loteId===payload.loteId&&r.etapaId===payload.etapaId?{...r,cerrada:false}:r)}));
    if(tipo==="editLote")    setEditLote(loteActual);
    if(tipo==="editPesaje")  setEditPesaje(data.registros.find(r=>r.id===payload));
    setSupModal(null);
    if(tipo==="rechazar") msg("rechazado");
  }

  const iconEst={bloqueada:"🔒",disponible:"",en_proceso:"🔄",cerrada:"✅"};
  const cTEst  ={bloqueada:"#374151",disponible:"#9ca3af",en_proceso:"#fb923c",cerrada:"#4ade80"};

  return(
    <div style={{minHeight:"100%",background:"#0a0c13",color:"#fff",fontFamily:"sans-serif",padding:"14px 14px 50px"}}>
      {showLogin&&<LoginModal operarios={operarios} onLogin={op=>{setOperario(op);setShowLogin(false);}} onClose={()=>setShowLogin(false)}/>}
      {supModal&&<SupModal titulo={supModal.titulo} desc={supModal.desc} onConfirm={confirmarSup} onClose={()=>setSupModal(null)}/>}
      {editLote&&<EditLoteModal lote={editLote} onSave={c=>{setData(d=>({...d,lotes:d.lotes.map(l=>l.id===editLote.id?{...l,...c}:l)}));setEditLote(null);msg("editado");}} onClose={()=>setEditLote(null)}/>}
      {editPesaje&&<EditPesajeModal pesaje={editPesaje} onSave={c=>{setData(d=>({...d,registros:d.registros.map(r=>r.id===editPesaje.id?{...r,...c}:r)}));setEditPesaje(null);msg("editado");}} onClose={()=>setEditPesaje(null)}/>}

      <div style={{maxWidth:460,margin:"0 auto"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:22}}>🌰</span>
            <div><div style={{fontSize:17,fontWeight:800}}>Terreno</div><div style={{fontSize:11,color:"#4b5563"}}>Registro de proceso</div></div>
          </div>
          {operario
            ?<div style={{display:"flex",gap:6,alignItems:"center"}}>
               <div style={{background:"#14532d33",border:"1px solid #4ade8055",borderRadius:9,padding:"5px 11px"}}><div style={{fontSize:11,fontWeight:700,color:"#4ade80"}}>👤 {operario.nombre}</div></div>
               <button onClick={()=>setOperario(null)} style={{background:"#1a1d27",border:"1px solid #2a2d3a",borderRadius:9,color:"#6b7280",padding:"5px 9px",cursor:"pointer",fontSize:11}}>Salir</button>
             </div>
            :<button onClick={()=>setShowLogin(true)} style={{background:"#4ade80",border:"none",borderRadius:9,color:"#000",padding:"7px 13px",cursor:"pointer",fontSize:12,fontWeight:700}}>👤 Identificarse</button>
          }
        </div>

        {pend>0&&<Alerta color="#fb923c">⏳ {pend} pesaje{pend>1?"s":""} pendiente{pend>1?"s":""} de aceptación</Alerta>}

        {/* 1. Lote */}
        <Card style={{marginTop:12,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <Lbl>1 · Seleccionar lote</Lbl>
            {loteActual&&<button onClick={()=>setSupModal({tipo:"editLote",titulo:"Editar lote",desc:"Solo supervisores pueden editar datos guardados."})} style={{background:"none",border:"1px solid #374151",borderRadius:7,color:"#6b7280",padding:"3px 9px",cursor:"pointer",fontSize:11}}>✏️ Editar</button>}
          </div>
          {nombres.length===0&&!showNuevo&&<div style={{fontSize:13,color:"#4b5563",textAlign:"center",padding:"10px 0"}}>Sin lotes. Crea uno nuevo abajo.</div>}
          {nombres.map(nombre=>(
            <div key={nombre} style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:0.8,marginBottom:5}}>🌿 {nombre}</div>
              {data.lotes.filter(l=>l.proveedor===nombre).map(l=>{
                const ests=ORDEN.map(etId=>estEtapa(l.id,etId,data.registros));
                const completo=ests[ests.length-1]==="cerrada";
                const proceso=ests.some(e=>e==="en_proceso");
                const selec=loteId===l.id;
                return(
                  <button key={l.id} onClick={()=>{setLoteId(l.id);setEtapaId("");}}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:selec?"#1e2130":"#0f1117",border:`2px solid ${selec?"#4ade80":proceso?"#fb923c55":completo?"#4ade8033":"#2a2d3a"}`,borderRadius:11,padding:"9px 13px",cursor:"pointer",textAlign:"left",marginBottom:5}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:selec?"#4ade80":"#fff"}}>Guía {l.guia||"—"} · Rampla {l.rampla||"—"}</div>
                      <div style={{fontSize:10,color:"#6b7280",marginTop:1}}>{l.especie||""}{l.variedad?" / "+l.variedad:""} · {fmt(l.creadoEn)}</div>
                    </div>
                    <span style={{fontSize:14}}>{completo?"✅":proceso?"🔄":"🔵"}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {!showNuevo
            ?<button onClick={()=>setShowNuevo(true)} style={{marginTop:4,background:"none",border:"1px dashed #374151",borderRadius:9,color:"#60a5fa",fontSize:12,padding:"8px 14px",width:"100%",cursor:"pointer"}}>+ Nuevo lote</button>
            :<div style={{marginTop:10,background:"#0f1117",borderRadius:11,padding:"14px"}}>
               <div style={{fontSize:11,color:"#6b7280",marginBottom:8,fontWeight:700}}>NUEVO LOTE</div>
               <FI label="Proveedor *" placeholder="Nombre del proveedor" value={nL.proveedor} onChange={e=>setNL({...nL,proveedor:e.target.value})}/>
               <FI label="Especie" placeholder="Ej: Durazno, Manzana..." value={nL.especie} onChange={e=>setNL({...nL,especie:e.target.value})}/>
               <FI label="Variedad (opcional)" value={nL.variedad} onChange={e=>setNL({...nL,variedad:e.target.value})}/>
               <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                 <FI label="N° Guía" type="number" value={nL.guia} onChange={e=>setNL({...nL,guia:e.target.value})}/>
                 <FI label="N° Rampla" type="number" value={nL.rampla} onChange={e=>setNL({...nL,rampla:e.target.value})}/>
               </div>
               <div style={{display:"flex",gap:8,marginTop:10}}>
                 <button onClick={()=>setShowNuevo(false)} style={{flex:1,background:"none",border:"1px solid #374151",borderRadius:9,color:"#6b7280",padding:"9px",cursor:"pointer",fontSize:12}}>Cancelar</button>
                 <Btn onClick={crearLote} disabled={!nL.proveedor.trim()} style={{flex:2}}>Crear lote</Btn>
               </div>
             </div>
          }
          {loteActual&&(
            <div style={{marginTop:10,display:"flex",gap:5,flexWrap:"wrap"}}>
              {loteActual.especie&&<Badge color="#4ade80">🌰 {loteActual.especie}</Badge>}
              {loteActual.variedad&&<Badge color="#a78bfa">✨ {loteActual.variedad}</Badge>}
              {loteActual.guia&&<Badge color="#60a5fa">📋 G-{loteActual.guia}</Badge>}
              {loteActual.rampla&&<Badge color="#fb923c">🚛 R-{loteActual.rampla}</Badge>}
            </div>
          )}
        </Card>

        {/* 2. Etapas */}
        {loteId&&(
          <Card style={{marginBottom:12}}>
            <Lbl>2 · Seleccionar etapa</Lbl>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {ETAPAS.map((e,i)=>{
                const es=estEtapa(loteId,e.id,data.registros);
                const selec=etapaId===e.id;
                const total=totalKgEtapa(loteId,e.id,data.registros);
                const nPesajes=pesajesDeEtapa(loteId,e.id,data.registros).filter(r=>r.estado==="aceptado").length;
                const m=es==="cerrada"?calcMerma(loteId,e.id,data.registros):null;
                const cB=selec?e.color:{bloqueada:"#1f2937",disponible:"#2a2d3a",en_proceso:"#fb923c55",cerrada:"#4ade8055"}[es];
                return(
                  <button key={e.id} onClick={()=>es!=="bloqueada"&&setEtapaId(e.id)}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:selec?e.color+"22":"#0f1117",border:`2px solid ${cB}`,borderRadius:11,padding:"12px 14px",cursor:es==="bloqueada"?"not-allowed":"pointer"}}>
                    <div style={{display:"flex",alignItems:"center",gap:9}}>
                      <span style={{fontSize:17}}>{e.icon}</span>
                      <div style={{textAlign:"left"}}>
                        <div style={{fontSize:12,fontWeight:700,color:selec?e.color:cTEst[es]}}>{e.label}</div>
                        <div style={{fontSize:10,color:"#6b7280"}}>Paso {i+1}</div>
                        {total>0&&<div style={{fontSize:10,color:e.color,marginTop:1}}>{nPesajes} pesaje{nPesajes!==1?"s":""} · {total} kg</div>}
                        {m&&<div style={{fontSize:10,color:m.mKg>0?mc(m.mPct):"#4ade80",marginTop:1}}>{m.mKg>0?`🍂 -${m.mKg} kg (${m.mPct}%)`:"✓ Sin merma"}</div>}
                      </div>
                    </div>
                    <span style={{fontSize:14}}>{iconEst[es]}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* 3. Acción */}
        {loteId&&etapaId&&(
          <>
            {(eActual==="disponible"||eActual==="en_proceso")&&(
              <Card style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <Lbl>3 · Pesajes — {etapaActual?.label}</Lbl>
                  {totalAcept>0&&<div style={{background:"#4ade8022",border:"1px solid #4ade8044",borderRadius:9,padding:"4px 10px",fontSize:12,color:"#4ade80",fontWeight:700}}>Total: {totalAcept} kg</div>}
                </div>

                {/* Lista pesajes */}
                {pesajes.length>0&&(
                  <div style={{marginBottom:14}}>
                    {pesajes.map((p,i)=>(
                      <div key={p.id} style={{background:"#0f1117",borderRadius:10,padding:"10px 13px",marginBottom:8,border:`1px solid ${p.estado==="aceptado"?"#4ade8033":p.estado==="rechazado"?"#f8717133":"#fb923c33"}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>Pesaje {i+1} — <span style={{color:"#4ade80"}}>{p.kg} kg</span></div>
                            <div style={{fontSize:10,color:"#6b7280",marginTop:2}}>👤 {p.operario} · {fmt(p.fechaRegistro)}</div>
                            {p.comentario&&<div style={{fontSize:10,color:"#9ca3af",marginTop:1}}>💬 {p.comentario}</div>}
                          </div>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                            <span style={{fontSize:11,fontWeight:700,color:p.estado==="aceptado"?"#4ade80":p.estado==="rechazado"?"#f87171":"#fb923c"}}>
                              {p.estado==="aceptado"?"✅":p.estado==="rechazado"?"🔒":"⏳"}
                            </span>
                            <div style={{display:"flex",gap:4}}>
                              <button onClick={()=>setSupModal({tipo:"editPesaje",payload:p.id,titulo:"Editar pesaje",desc:"Solo supervisores pueden editar."})} style={{background:"none",border:"1px solid #374151",borderRadius:6,color:"#6b7280",padding:"2px 7px",cursor:"pointer",fontSize:10}}>✏️</button>
                              {p.estado==="pendiente"&&(
                                <>
                                  <button onClick={()=>setSupModal({tipo:"rechazar",payload:p.id,titulo:"Rechazar pesaje",desc:"Solo supervisores pueden rechazar."})} style={{background:"none",border:"1px solid #f8717144",borderRadius:6,color:"#f87171",padding:"2px 7px",cursor:"pointer",fontSize:10}}>🔒</button>
                                  <button onClick={()=>aceptarPesaje(p.id)} style={{background:"#4ade8022",border:"1px solid #4ade8055",borderRadius:6,color:"#4ade80",padding:"2px 8px",cursor:"pointer",fontSize:10,fontWeight:700}}>✅ Aceptar</button>
                                </>
                              )}
                              {p.estado==="rechazado"&&<button onClick={()=>setSupModal({tipo:"reabrir",payload:p.id,titulo:"Reabrir pesaje",desc:"Solo supervisores."})} style={{background:"none",border:"1px solid #f8717144",borderRadius:6,color:"#f87171",padding:"2px 7px",cursor:"pointer",fontSize:10}}>🔑</button>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Merma preview */}
                {mermaPreview&&(
                  <div style={{marginBottom:12,background:"#0f1117",borderRadius:9,padding:"9px 13px",border:`1px solid ${parseFloat(mermaPreview.mPct)>15?"#f87171":parseFloat(mermaPreview.mPct)>8?"#fb923c44":"#2a2d3a"}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{fontSize:11,color:"#6b7280"}}>🍂 Merma acumulada</div>
                      <div style={{fontSize:14,fontWeight:800,color:mermaPreview.mKg>0?mc(mermaPreview.mPct):"#4ade80"}}>{mermaPreview.mKg>0?`-${mermaPreview.mKg} kg (${mermaPreview.mPct}%)`:"Sin merma ✓"}</div>
                    </div>
                    <div style={{fontSize:10,color:"#4b5563",marginTop:2}}>Entrada: {mermaPreview.kgAnt} kg · Salida acumulada: {mermaPreview.totalSalida} kg</div>
                  </div>
                )}

                {/* Nuevo pesaje */}
                <div style={{background:"#0f1117",borderRadius:11,padding:"13px"}}>
                  <div style={{fontSize:12,color:"#9ca3af",marginBottom:8,fontWeight:700}}>+ Pesaje {pesajes.length+1}</div>
                  <div style={{fontSize:12,color:"#6b7280",marginBottom:5}}>📤 KG de este pesaje</div>
                  <input type="number" placeholder="0.0" value={kgEnt} onChange={e=>setKgEnt(e.target.value)}
                    style={{width:"100%",background:"#1a1d27",border:"1px solid #4ade8044",borderRadius:10,padding:"13px",color:"#4ade80",fontSize:26,fontWeight:800,outline:"none",boxSizing:"border-box"}}/>
                  <div style={{marginTop:10}}>
                    <div style={{fontSize:12,color:"#6b7280",marginBottom:4}}>💬 Comentario (opcional)</div>
                    <textarea placeholder="Bin lleno, máquina lenta..." value={comentario} onChange={e=>setComentario(e.target.value)} rows={2}
                      style={{width:"100%",background:"#1a1d27",border:"1px solid #2a2d3a",borderRadius:9,padding:"9px 12px",color:"#fff",fontSize:12,outline:"none",boxSizing:"border-box",resize:"none",fontFamily:"inherit"}}/>
                  </div>
                  {operario&&<div style={{marginTop:8,fontSize:11,color:"#6b7280"}}>Registrará: <span style={{color:"#4ade80",fontWeight:700}}>👤 {operario.nombre}</span></div>}
                  <Btn onClick={registrarPesaje} disabled={!kgEnt} bg={flash==="ok"?"#4ade80":"linear-gradient(135deg,#4ade80,#22c55e)"} style={{width:"100%",padding:"12px",borderRadius:11,fontSize:13,marginTop:10}}>
                    {flash==="ok"?"✓ Pesaje registrado":!operario?"👤 Identificarse":"Registrar pesaje →"}
                  </Btn>
                </div>

                {/* Botón Listo */}
                {pesajes.filter(p=>p.estado==="aceptado").length>0&&(
                  <div style={{marginTop:14,background:"#4ade8011",border:"1px solid #4ade8044",borderRadius:11,padding:"14px"}}>
                    <div style={{fontSize:13,color:"#4ade80",fontWeight:700,marginBottom:3}}>
                      ¿Terminaste los pesajes de {etapaActual?.label}?
                    </div>
                    <div style={{fontSize:11,color:"#9ca3af",marginBottom:10}}>
                      Total: <b style={{color:"#4ade80"}}>{totalAcept} kg</b> en {pesajes.filter(p=>p.estado==="aceptado").length} pesaje{pesajes.filter(p=>p.estado==="aceptado").length!==1?"s":""}. Al presionar <b>Listo</b> se cierra esta etapa y se habilita <b style={{color:ETAPAS.find(e=>e.id===SIGUIENTE[etapaId])?.color||"#4ade80"}}>{ETAPAS.find(e=>e.id===SIGUIENTE[etapaId])?.label||"la siguiente etapa"}</b>.
                    </div>
                    <div style={{fontSize:11,color:"#6b7280",marginBottom:8}}>
                      Solo puede cerrar el responsable de <b style={{color:ETAPAS.find(e=>e.id===(SIGUIENTE[etapaId]||etapaId))?.color}}>{ETAPAS.find(e=>e.id===(SIGUIENTE[etapaId]||etapaId))?.label}</b>.
                    </div>
                    {flash==="noPermite"&&<Alerta color="#f87171">⛔ Solo el responsable de {ETAPAS.find(e=>e.id===(SIGUIENTE[etapaId]||etapaId))?.label} puede cerrar esta etapa.</Alerta>}
                    {flash==="cerrado"&&<Alerta color="#4ade80">✅ Etapa cerrada — siguiente etapa desbloqueada</Alerta>}
                    <Btn onClick={cerrarEtapa} disabled={!operario} bg="#4ade80" fg="#000" style={{width:"100%",padding:"14px",fontSize:15,fontWeight:800}}>
                      {!operario?"👤 Identificarse":"✅ Listo — cerrar etapa"}
                    </Btn>
                  </div>
                )}

                {flash==="rechazado"&&<Alerta color="#f87171">🔒 Pesaje rechazado</Alerta>}
                {flash==="editado"  &&<Alerta color="#60a5fa">✏️ Actualizado</Alerta>}
                {flash==="aceptado" &&<Alerta color="#4ade80">✅ Pesaje aceptado</Alerta>}
              </Card>
            )}

            {eActual==="cerrada"&&(
              <Card style={{border:"1px solid #4ade8044"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:18}}>✅</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"#4ade80"}}>Pesajes finalizados</div>
                      <div style={{fontSize:10,color:"#6b7280"}}>{pesajes.filter(p=>p.estado==="aceptado").length} pesajes · Total: {totalAcept} kg</div>
                    </div>
                  </div>
                  <button onClick={()=>setSupModal({tipo:"reabrirEtapa",payload:{loteId,etapaId},titulo:"Reabrir etapa",desc:"Solo supervisores pueden reabrir una etapa finalizada."})}
                    style={{background:"none",border:"1px solid #374151",borderRadius:7,color:"#6b7280",padding:"3px 9px",cursor:"pointer",fontSize:11}}>✏️ Reabrir</button>
                </div>
                {(()=>{ const m=calcMerma(loteId,etapaId,data.registros); if(!m) return null;
                  return <div style={{background:"#0f1117",borderRadius:9,padding:"9px 13px",marginBottom:10,display:"flex",justifyContent:"space-between"}}>
                    <div style={{fontSize:11,color:"#6b7280"}}>🍂 Merma</div>
                    <div style={{fontSize:13,fontWeight:800,color:m.mKg>0?mc(m.mPct):"#4ade80"}}>{m.mKg>0?`-${m.mKg} kg (${m.mPct}%)`:"Sin merma ✓"}</div>
                  </div>;
                })()}
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {pesajes.filter(p=>p.estado==="aceptado").map((p,i)=>(
                    <div key={p.id} style={{background:"#0f1117",borderRadius:9,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{fontSize:12,color:"#fff"}}>Pesaje {i+1} — <span style={{color:"#4ade80",fontWeight:700}}>{p.kg} kg</span></div>
                      <div style={{fontSize:10,color:"#6b7280"}}>✅ {p.operarioAcepta||p.operario}</div>
                    </div>
                  ))}
                </div>
                {flash==="editado"&&<Alerta color="#60a5fa" style={{marginTop:8}}>✏️ Actualizado</Alerta>}
              </Card>
            )}

            {eActual==="bloqueada"&&(
              <Card style={{border:"1px solid #1f2937",textAlign:"center",padding:"24px"}}>
                <div style={{fontSize:32,marginBottom:8}}>🔒</div>
                <div style={{fontSize:14,fontWeight:700,color:"#374151"}}>Etapa bloqueada</div>
                <div style={{fontSize:12,color:"#374151",marginTop:4}}>La etapa anterior debe finalizarse primero</div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  VISTA ESCRITORIO
// ════════════════════════════════════════════════════════════
function VistaEscritorio({data,setData,operarios,setOperarios,historial,setHistorial}){
  const [filtro,setFiltro]=useState("todos");
  const [panelSup,setPanelSup]=useState(false);
  const [verHist,setVerHist]=useState(false);
  const [pinAccion,setPinAccion]=useState(null);
  const [flashG,setFlashG]=useState("");

  if(panelSup) return <PanelSupervisor operarios={operarios} setOperarios={setOperarios} onClose={()=>setPanelSup(false)}/>;
  if(verHist)  return <PanelHistorial historial={historial} onClose={()=>setVerHist(false)}/>;

  const pendientes = data.registros.filter(r=>r.estado==="pendiente").length;
  const rechazados = data.registros.filter(r=>r.estado==="rechazado").length;
  const aceptados  = data.registros.filter(r=>r.estado==="aceptado").length;
  const kgIn       = data.lotes.reduce((s,l)=>s+totalKgEtapa(l.id,"recepcion",data.registros),0);
  const kgOut      = data.lotes.filter(l=>etapaCerrada(l.id,"ojoelius",data.registros)).reduce((s,l)=>s+totalKgEtapa(l.id,"ojoelius",data.registros),0);
  const mermaTot   = round(kgIn-kgOut);
  const mermaPct   = kgIn>0?(mermaTot/kgIn*100).toFixed(1):null;
  const nombres    = [...new Set(data.lotes.map(l=>l.proveedor).filter(Boolean))].sort();
  const lotesF     = filtro==="todos"?data.lotes:data.lotes.filter(l=>l.id===filtro);
  const porProv    = nombres.map(n=>({n,lotes:lotesF.filter(l=>l.proveedor===n)})).filter(g=>g.lotes.length>0);

  const accionInfo={
    guardar:  {titulo:"Guardar sesión",   desc:"Solo el supervisor puede guardar el estado actual."},
    historial:{titulo:"Ver historial",    desc:"Solo el supervisor puede acceder al historial."},
    vaciar:   {titulo:"Vaciar datos",     desc:"Elimina lotes y registros. El historial se mantiene."},
    panel:    {titulo:"Panel Supervisor", desc:"Ingresa el PIN de supervisor."},
  };

  function confirmarAccion(){
    if(pinAccion==="guardar"){
      if(data.lotes.length===0){ setFlashG("vacio"); setTimeout(()=>setFlashG(""),2500); }
      else{ const s={guardadoEn:new Date().toISOString(),lotes:data.lotes,registros:data.registros}; setHistorial(h=>[...h,s]); setFlashG("ok"); setTimeout(()=>setFlashG(""),3000); }
    }
    if(pinAccion==="historial") setVerHist(true);
    if(pinAccion==="vaciar")    setData({lotes:[],registros:[]});
    if(pinAccion==="panel")     setPanelSup(true);
    setPinAccion(null);
  }

  const eC={pendiente:"#fb923c",aceptado:"#4ade80",rechazado:"#f87171"};
  const eI={pendiente:"⏳",aceptado:"✅",rechazado:"🔒"};

  return(
    <div style={{minHeight:"100%",background:"#080b12",color:"#fff",fontFamily:"sans-serif",display:"flex"}}>
      {pinAccion&&<SupModal titulo={accionInfo[pinAccion].titulo} desc={accionInfo[pinAccion].desc} onConfirm={confirmarAccion} onClose={()=>setPinAccion(null)}/>}

      {/* Sidebar */}
      <div style={{width:215,background:"#0f1117",borderRight:"1px solid #1e2130",padding:"18px 13px",flexShrink:0,position:"relative",minHeight:"100%"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <span style={{fontSize:19}}>🌰</span>
          <div><div style={{fontSize:13,fontWeight:800}}>FrutaTrack</div><div style={{fontSize:10,color:"#4b5563"}}>Trazabilidad</div></div>
        </div>
        {pendientes>0&&<div style={{background:"#78350f22",border:"1px solid #fb923c",borderRadius:9,padding:"7px 11px",marginBottom:5}}><div style={{fontSize:11,color:"#fb923c",fontWeight:700}}>⏳ {pendientes} pesaje{pendientes>1?"s":""} pendiente{pendientes>1?"s":""}</div></div>}
        {rechazados>0&&<div style={{background:"#7f1d1d22",border:"1px solid #f87171",borderRadius:9,padding:"7px 11px",marginBottom:5}}><div style={{fontSize:11,color:"#f87171",fontWeight:700}}>🔒 {rechazados} rechazado{rechazados>1?"s":""}</div></div>}
        <div style={{fontSize:10,color:"#4b5563",textTransform:"uppercase",letterSpacing:1,marginBottom:6,marginTop:10}}>Lotes</div>
        <button onClick={()=>setFiltro("todos")} style={{width:"100%",textAlign:"left",padding:"7px 10px",borderRadius:8,border:"none",background:filtro==="todos"?"#1e2130":"none",color:filtro==="todos"?"#fff":"#6b7280",cursor:"pointer",fontSize:12,marginBottom:5}}>Todos</button>
        {nombres.map(nombre=>(
          <div key={nombre} style={{marginBottom:8}}>
            <div style={{fontSize:10,color:"#9ca3af",fontWeight:700,padding:"0 10px 3px"}}>🌿 {nombre}</div>
            {data.lotes.filter(l=>l.proveedor===nombre).map(l=>(
              <button key={l.id} onClick={()=>setFiltro(l.id)} style={{width:"100%",textAlign:"left",padding:"5px 10px",borderRadius:7,border:"none",background:filtro===l.id?"#1e2130":"none",color:filtro===l.id?"#4ade80":"#6b7280",cursor:"pointer",fontSize:11,marginBottom:2}}>
                G-{l.guia||"—"} · R-{l.rampla||"—"}
              </button>
            ))}
          </div>
        ))}
        <div style={{position:"absolute",bottom:14,left:13,right:13,display:"flex",flexDirection:"column",gap:6}}>
          <button onClick={()=>setPinAccion("guardar")} style={{background:"#14532d33",border:"1px solid #4ade8055",borderRadius:9,color:"#4ade80",padding:"9px",cursor:"pointer",fontSize:12,fontWeight:700}}>💾 Guardar sesión</button>
          {flashG==="ok"&&<div style={{fontSize:10,color:"#4ade80",textAlign:"center",marginTop:-2}}>✓ Guardado</div>}
          {flashG==="vacio"&&<div style={{fontSize:10,color:"#fb923c",textAlign:"center",marginTop:-2}}>Sin datos</div>}
          <button onClick={()=>setPinAccion("historial")} style={{background:"#1a1d27",border:"1px solid #60a5fa44",borderRadius:9,color:"#60a5fa",padding:"9px",cursor:"pointer",fontSize:12}}>📅 Ver historial {historial.length>0?`(${historial.length})`:""}</button>
          <button onClick={()=>setPinAccion("panel")} style={{background:"#1a1d27",border:"1px solid #374151",borderRadius:9,color:"#9ca3af",padding:"9px",cursor:"pointer",fontSize:12}}>🔐 Panel Supervisor</button>
          <button onClick={()=>setPinAccion("vaciar")} style={{background:"none",border:"1px solid #1e2130",borderRadius:9,color:"#374151",padding:"9px",cursor:"pointer",fontSize:12}}>🗑 Vaciar datos</button>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,padding:"22px 26px",overflowY:"auto"}}>
        <div style={{marginBottom:22}}>
          <h1 style={{margin:0,fontSize:20,fontWeight:800}}>Panel de Control</h1>
          <p style={{margin:"3px 0 0",color:"#6b7280",fontSize:11}}>Recepción → Repelado → Ojo Chino → Ojo Elius · Múltiples pesajes por etapa</p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:11,marginBottom:26}}>
          {[
            {l:"Pesajes pendientes",v:pendientes,              c:"#fb923c",i:"⏳"},
            {l:"Aceptados",         v:aceptados,               c:"#4ade80",i:"✅"},
            {l:"Rechazados",        v:rechazados,              c:"#f87171",i:"🔒"},
            {l:"KG en Recepción",   v:`${round(kgIn)} kg`,     c:"#60a5fa",i:"🚛",s:"Total ingresado"},
            {l:"Merma total",       v:mermaPct!=null?`${mermaPct}%`:"—",c:mermaPct?parseFloat(mermaPct)>15?"#f87171":parseFloat(mermaPct)>8?"#fb923c":"#4ade80":"#4ade80",i:"🍂",s:mermaPct?`${mermaTot} kg perdidos`:null},
          ].map(s=>(
            <div key={s.l} style={{background:"#0f1117",border:`1px solid ${s.c}33`,borderRadius:13,padding:"15px"}}>
              <div style={{fontSize:17}}>{s.i}</div>
              <div style={{fontSize:20,fontWeight:800,color:s.c,marginTop:5}}>{s.v}</div>
              <div style={{fontSize:10,color:"#6b7280",marginTop:3}}>{s.l}</div>
              {s.s&&<div style={{fontSize:10,color:"#4b5563",marginTop:2}}>{s.s}</div>}
            </div>
          ))}
        </div>

        {data.lotes.length===0
          ?<div style={{textAlign:"center",padding:"50px 0",color:"#374151"}}>
            <div style={{fontSize:38,marginBottom:12}}>📱</div>
            <div style={{fontSize:15,fontWeight:600,color:"#4b5563"}}>Sin datos activos</div>
            <div style={{fontSize:12,marginTop:5}}>Historial: {historial.length} sesion{historial.length!==1?"es":""}</div>
          </div>
          :<>
            {porProv.map(grupo=>(
              <div key={grupo.n} style={{marginBottom:22}}>
                <div style={{fontSize:13,fontWeight:800,color:"#9ca3af",marginBottom:11}}>🌿 {grupo.n}</div>
                {grupo.lotes.map(lote=>(
                  <div key={lote.id} style={{marginBottom:13}}>
                    <div style={{display:"flex",gap:6,marginBottom:7,flexWrap:"wrap",alignItems:"center"}}>
                      {lote.guia&&<Badge color="#60a5fa">📋 Guía {lote.guia}</Badge>}
                      {lote.rampla&&<Badge color="#fb923c">🚛 Rampla {lote.rampla}</Badge>}
                      {lote.especie&&<Badge color="#4ade80">🌰 {lote.especie}</Badge>}
                      {lote.variedad&&<Badge color="#a78bfa">✨ {lote.variedad}</Badge>}
                      <span style={{fontSize:10,color:"#4b5563"}}>Inicio: {fmt(lote.creadoEn)}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",overflowX:"auto",background:"#0f1117",borderRadius:13,padding:"13px",gap:0}}>
                      {ETAPAS.map((e,i)=>{
                        const ps=pesajesDeEtapa(lote.id,e.id,data.registros);
                        const total=totalKgEtapa(lote.id,e.id,data.registros);
                        const cerrada=etapaCerrada(lote.id,e.id,data.registros);
                        const nAcept=ps.filter(r=>r.estado==="aceptado").length;
                        const es=estEtapa(lote.id,e.id,data.registros);
                        const m=cerrada?calcMerma(lote.id,e.id,data.registros):null;
                        const mcol=m&&parseFloat(m.mPct)>15?"#f87171":m&&parseFloat(m.mPct)>8?"#fb923c":"#facc15";
                        return(
                          <div key={e.id} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                            <div style={{background:es==="bloqueada"?"#0a0c13":"#1a1d27",border:`1px solid ${es==="bloqueada"?"#1f2937":e.color+"44"}`,borderRadius:11,padding:"10px 11px",minWidth:115,textAlign:"center"}}>
                              <div style={{fontSize:14}}>{es==="bloqueada"?"🔒":es==="cerrada"?"✅":es==="en_proceso"?"🔄":e.icon}</div>
                              <div style={{fontSize:10,color:es==="bloqueada"?"#374151":e.color,fontWeight:700,marginTop:3}}>{e.label}</div>
                              {total>0&&<div style={{marginTop:5}}>
                                <div style={{background:"#0f1117",borderRadius:7,padding:"4px 7px",marginBottom:3}}>
                                  <div style={{fontSize:8,color:"#6b7280"}}>{nAcept} pesaje{nAcept!==1?"s":""}</div>
                                  <div style={{fontSize:14,fontWeight:800,color:"#4ade80"}}>{total} kg</div>
                                </div>
                                {m&&m.mKg>0&&<div style={{fontSize:8,color:mcol,marginBottom:2}}>🍂 -{m.mKg} kg ({m.mPct}%)</div>}
                                {m&&m.mKg<=0&&<div style={{fontSize:8,color:"#4ade80",marginBottom:2}}>✓ Sin merma</div>}
                                <div style={{fontSize:9,color:cerrada?"#4ade80":"#fb923c"}}>{cerrada?"🏁 Finalizado":"🔄 En proceso"}</div>
                              </div>}
                              {es==="bloqueada"&&!total&&<div style={{marginTop:4,fontSize:9,color:"#374151"}}>Bloqueada</div>}
                            </div>
                            {i<ETAPAS.length-1&&<div style={{width:14,height:2,background:cerrada?"#4ade80":total>0?"#fb923c":"#1f2937",flexShrink:0}}/>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div style={{marginTop:10}}>
              <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Detalle de pesajes</div>
              <div style={{background:"#0f1117",borderRadius:13,border:"1px solid #1e2130",overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:650}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid #1e2130"}}>
                      {["Fecha","Proveedor","Guía","Rampla","Etapa","Pesaje #","KG","Merma acum.","% Merma","Comentario","Operario","Estado"].map(h=>(
                        <th key={h} style={{padding:"10px 11px",textAlign:"left",fontSize:10,color:"#4b5563",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(filtro==="todos"?data.lotes:data.lotes.filter(l=>l.id===filtro)).flatMap(lote=>
                      ETAPAS.flatMap(e=>{
                        const ps=pesajesDeEtapa(lote.id,e.id,data.registros);
                        return ps.map((p,i)=>{
                          const kgAnt=totalKgEtapa(lote.id,ORDEN[ORDEN.indexOf(e.id)-1]||e.id,data.registros);
                          const mermaAcum=ORDEN.indexOf(e.id)>0&&kgAnt>0?round(kgAnt-totalKgEtapa(lote.id,e.id,data.registros)):null;
                          const mermaPct=mermaAcum!=null&&kgAnt>0?(mermaAcum/kgAnt*100).toFixed(1):null;
                          const mCol=mermaPct&&parseFloat(mermaPct)>15?"#f87171":mermaPct&&parseFloat(mermaPct)>8?"#fb923c":"#6b7280";
                          return(
                            <tr key={p.id} style={{borderBottom:"1px solid #0f1117"}}>
                              <td style={{padding:"9px 11px",fontSize:10,color:"#6b7280",whiteSpace:"nowrap"}}>{fmt(p.fechaRegistro)}</td>
                              <td style={{padding:"9px 11px",fontSize:12,fontWeight:600}}>🌿 {lote.proveedor}</td>
                              <td style={{padding:"9px 11px",fontSize:11,color:"#60a5fa"}}>{lote.guia||"—"}</td>
                              <td style={{padding:"9px 11px",fontSize:11,color:"#fb923c"}}>{lote.rampla||"—"}</td>
                              <td style={{padding:"9px 11px"}}><Badge color={e.color}>{e.icon} {e.label}</Badge></td>
                              <td style={{padding:"9px 11px",fontSize:11,color:"#6b7280"}}>#{i+1}</td>
                              <td style={{padding:"9px 11px",fontSize:13,fontWeight:800,color:"#4ade80"}}>{p.kg} kg</td>
                              <td style={{padding:"9px 11px",fontSize:11,fontWeight:700,color:mermaAcum&&mermaAcum>0?"#fb923c":"#374151"}}>{mermaAcum!=null&&mermaAcum>0?`-${mermaAcum} kg`:"—"}</td>
                              <td style={{padding:"9px 11px",fontSize:11,fontWeight:700,color:mermaPct&&parseFloat(mermaPct)>0?mCol:"#374151"}}>{mermaPct&&parseFloat(mermaPct)>0?`${mermaPct}%`:"—"}</td>
                              <td style={{padding:"9px 11px",fontSize:10,color:"#9ca3af",maxWidth:100}}>{p.comentario||"—"}</td>
                              <td style={{padding:"9px 11px",fontSize:11}}>👤 {p.operario}</td>
                              <td style={{padding:"9px 11px"}}><Badge color={eC[p.estado]}>{eI[p.estado]} {p.estado}</Badge></td>
                            </tr>
                          );
                        });
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        }
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  APP
// ════════════════════════════════════════════════════════════
export default function App(){
  const [vista,setVista]         = useState("escritorio");
  const [data,setData]           = useState({lotes:[],registros:[]});
  const [operarios,setOperarios] = useState([]);
  const [historial,setHistorial] = useState([]);

  return(
    <div style={{height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column",background:"#080b12"}}>
      <div style={{position:"fixed",top:11,right:11,zIndex:1000,display:"flex",gap:4,background:"#0f1117",padding:4,borderRadius:11,border:"1px solid #1e2130"}}>
        <button onClick={()=>setVista("terreno")}    style={{padding:"6px 13px",borderRadius:8,border:"none",background:vista==="terreno"?"#4ade80":"none",    color:vista==="terreno"?"#000":"#6b7280",    fontWeight:700,cursor:"pointer",fontSize:12}}>📱 Terreno</button>
        <button onClick={()=>setVista("escritorio")} style={{padding:"6px 13px",borderRadius:8,border:"none",background:vista==="escritorio"?"#60a5fa":"none", color:vista==="escritorio"?"#000":"#6b7280", fontWeight:700,cursor:"pointer",fontSize:12}}>🖥 Escritorio</button>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {vista==="terreno"
          ?<VistaTerreno    data={data} setData={setData} operarios={operarios}/>
          :<VistaEscritorio data={data} setData={setData} operarios={operarios} setOperarios={setOperarios} historial={historial} setHistorial={setHistorial}/>
        }
      </div>
    </div>
  );
}
