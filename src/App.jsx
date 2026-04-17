import { useState, useEffect } from "react";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const ETAPAS = [
  { id:"recepcion",  label:"Recepción",  icon:"🚛", color:"#4ade80" },
  { id:"repelado",   label:"Repelado",   icon:"🍑", color:"#fb923c" },
  { id:"ojochino",   label:"Ojo Chino",  icon:"👁", color:"#60a5fa" },
  { id:"ojoelius",   label:"Ojo Elius",  icon:"👁", color:"#a78bfa" },
];
const ORDEN    = ETAPAS.map(e=>e.id);
const SIGUIENTE = { recepcion:"repelado", repelado:"ojochino", ojochino:"ojoelius" };

const CATS_MERMA = [
  { id:"calidad",   label:"Calidad",   desc:"Fruta dañada, podrida",       icon:"🍂", color:"#f87171" },
  { id:"proceso",   label:"Proceso",   desc:"Cáscara, carozo, pepas",      icon:"⚙️", color:"#fb923c" },
  { id:"calibrado", label:"Calibrado", desc:"Tamaño fuera de rango",        icon:"⚖️", color:"#facc15" },
  { id:"traslado",  label:"Traslado",  desc:"Golpes, caídas",               icon:"📦", color:"#a78bfa" },
];

const SUPERVISOR_PIN = "1234";
const STORAGE_KEY    = "frutatrackv8";

function loadData() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : { lotes:[], registros:[], operarios:[] }; }
  catch { return { lotes:[], registros:[], operarios:[] }; }
}
function saveData(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function fmtFecha(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit",year:"numeric"});
}
function uid() { return Math.random().toString(36).slice(2,9); }
function round(n) { return Math.round(n*10)/10; }

// ── Estado de cada etapa para un lote ────────────────────────────────────────
// "bloqueada"  → etapa anterior no aceptada aún
// "disponible" → puede registrar y entregar
// "entregada"  → entregó, esperando que la siguiente acepte
// "aceptada"   → la siguiente etapa ya aceptó
// "rechazada"  → rechazada por supervisor
function estadoEtapa(loteId, etapaId, registros) {
  const idx = ORDEN.indexOf(etapaId);
  const r   = registros.find(r => r.loteId === loteId && r.etapaId === etapaId);

  if (r) {
    if (r.estado === "entregado") return "entregada";
    if (r.estado === "aceptado")  return "aceptada";
    if (r.estado === "rechazado") return "rechazada";
  }

  // Primera etapa siempre disponible
  if (idx === 0) return "disponible";

  // Resto: disponible solo si la anterior fue aceptada
  const etapaAnterior = ORDEN[idx - 1];
  const rAnt = registros.find(r => r.loteId === loteId && r.etapaId === etapaAnterior);
  if (rAnt && rAnt.estado === "aceptado") return "disponible";

  return "bloqueada";
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function Badge({ color, children }) {
  return <span style={{ background:color+"22", color, padding:"3px 10px", borderRadius:8, fontSize:11, fontWeight:700 }}>{children}</span>;
}
function Card({ children, style={} }) {
  return <div style={{ background:"#1a1d27", border:"1px solid #2a2d3a", borderRadius:16, padding:20, ...style }}>{children}</div>;
}
function Label({ children }) {
  return <div style={{ fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>{children}</div>;
}
function FieldInput({ label, ...props }) {
  return (
    <div style={{ marginTop:12 }}>
      {label && <div style={{ fontSize:12, color:"#6b7280", marginBottom:5 }}>{label}</div>}
      <input {...props} style={{ width:"100%", background:"#0f1117", border:"1px solid #2a2d3a", borderRadius:10,
        padding:"12px 14px", color:"#fff", fontSize:14, outline:"none", boxSizing:"border-box", ...props.style }} />
    </div>
  );
}
function Btn({ children, onClick, disabled, color="#4ade80", textColor="#000", style={} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:disabled?"#1f2937":color, color:disabled?"#374151":textColor,
      border:"none", borderRadius:12, padding:"13px 20px", fontWeight:700,
      cursor:disabled?"not-allowed":"pointer", fontSize:14, transition:"all 0.15s", ...style
    }}>{children}</button>
  );
}
function Alert({ color, children, style={} }) {
  return <div style={{ padding:"11px 14px", background:color+"18", border:`1px solid ${color}55`, borderRadius:12, color, fontSize:13, marginTop:10, ...style }}>{children}</div>;
}
function Stat({ label, value, color="#fff", sub="" }) {
  return (
    <div style={{ background:"#0f1117", borderRadius:14, padding:"16px 18px" }}>
      <div style={{ fontSize:11, color:"#6b7280", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:800, color }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"#4b5563", marginTop:4 }}>{sub}</div>}
    </div>
  );
}

// ── PinPad ────────────────────────────────────────────────────────────────────
function PinPad({ value, onChange, label }) {
  const digits = ["1","2","3","4","5","6","7","8","9","←","0","✓"];
  function press(d) {
    if (d==="←") { onChange(value.slice(0,-1)); return; }
    if (d==="✓") return;
    if (value.length < 4) onChange(value+d);
  }
  return (
    <div>
      {label && <div style={{ fontSize:12, color:"#6b7280", marginBottom:10 }}>{label}</div>}
      <div style={{ display:"flex", justifyContent:"center", gap:10, marginBottom:16 }}>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{ width:18, height:18, borderRadius:"50%",
            background:i<value.length?"#4ade80":"#2a2d3a",
            border:"2px solid "+(i<value.length?"#4ade80":"#374151"), transition:"all 0.15s" }}/>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
        {digits.map(d=>(
          <button key={d} onClick={()=>press(d)} style={{
            padding:"16px", borderRadius:12, border:"none",
            background:d==="←"?"#1f2937":"#1a1d27", color:d==="←"?"#9ca3af":"#fff",
            fontSize:18, fontWeight:700, cursor:"pointer",
          }}>{d}</button>
        ))}
      </div>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#000c", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"#1a1d27", border:"1px solid #374151", borderRadius:20, padding:28, width:340, maxWidth:"92vw", maxHeight:"90vh", overflowY:"auto" }}>
        {children}
      </div>
    </div>
  );
}

function ModalLogin({ operarios, onLogin, onCancel }) {
  const [opId,setOpId]=useState(""); const [pin,setPin]=useState(""); const [err,setErr]=useState(false);
  function intentar(){ const op=operarios.find(o=>o.id===opId); if(op&&op.pin===pin){onLogin(op);}else{setErr(true);setPin("");} }
  useEffect(()=>{ if(pin.length===4) intentar(); },[pin]);
  const opSel=operarios.find(o=>o.id===opId);
  return (
    <Modal onClose={onCancel}>
      <div style={{ fontSize:22, marginBottom:4 }}>👤</div>
      <div style={{ fontSize:17, fontWeight:800, marginBottom:4 }}>Identificarse</div>
      <div style={{ fontSize:12, color:"#6b7280", marginBottom:16 }}>Selecciona tu nombre e ingresa tu PIN</div>
      <select value={opId} onChange={e=>{setOpId(e.target.value);setPin("");setErr(false);}}
        style={{ width:"100%", background:"#0f1117", border:"1px solid #2a2d3a", borderRadius:10, padding:"12px 14px", color:opId?"#fff":"#6b7280", fontSize:15, outline:"none", marginBottom:16 }}>
        <option value="">— Seleccionar operario —</option>
        {operarios.map(o=><option key={o.id} value={o.id}>{o.nombre}{o.etapa?" · "+ETAPAS.find(e=>e.id===o.etapa)?.label:""}</option>)}
      </select>
      {opId && <PinPad value={pin} onChange={v=>{setPin(v);setErr(false);}} label={`PIN de ${opSel?.nombre}`}/>}
      {err && <Alert color="#f87171">PIN incorrecto. Intenta de nuevo.</Alert>}
      <button onClick={onCancel} style={{ marginTop:14, background:"none", border:"none", color:"#4b5563", fontSize:13, cursor:"pointer", width:"100%", textAlign:"center" }}>Cancelar</button>
    </Modal>
  );
}

function ModalSupervisor({ titulo, desc, onConfirm, onCancel }) {
  const [pin,setPin]=useState(""); const [err,setErr]=useState(false);
  useEffect(()=>{ if(pin.length===4){ pin===SUPERVISOR_PIN?onConfirm():(setErr(true),setPin("")); } },[pin]);
  return (
    <Modal onClose={onCancel}>
      <div style={{ fontSize:22, marginBottom:4 }}>🔐</div>
      <div style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>{titulo}</div>
      <div style={{ fontSize:13, color:"#9ca3af", marginBottom:20 }}>{desc}</div>
      <PinPad value={pin} onChange={v=>{setPin(v);setErr(false);}} label="PIN Supervisor"/>
      {err && <Alert color="#f87171">PIN incorrecto.</Alert>}
      <button onClick={onCancel} style={{ marginTop:14, background:"none", border:"none", color:"#4b5563", fontSize:13, cursor:"pointer", width:"100%", textAlign:"center" }}>Cancelar</button>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
//  PANEL SUPERVISOR
// ════════════════════════════════════════════════════════════
function PanelSupervisor({ data, setData, onClose }) {
  const [nombre,setNombre]=useState(""); const [etapaOp,setEtapaOp]=useState("");
  const [pin1,setPin1]=useState(""); const [pin2,setPin2]=useState("");
  const [paso,setPaso]=useState(1); const [flash,setFlash]=useState("");

  useEffect(()=>{ if(paso===2&&pin1.length===4) setPaso(3); },[pin1]);
  useEffect(()=>{
    if(paso===3&&pin2.length===4){
      if(pin1!==pin2){setFlash("nocoincide");setPin2("");return;}
      const op={id:uid(),nombre:nombre.trim(),etapa:etapaOp||null,pin:pin1,creadoEn:new Date().toISOString()};
      const u={...data,operarios:[...data.operarios,op]};
      setData(u);saveData(u);
      setNombre("");setEtapaOp("");setPin1("");setPin2("");setPaso(1);
      setFlash("ok");setTimeout(()=>setFlash(""),2500);
    }
  },[pin2]);

  function eliminar(id){ if(!window.confirm("¿Eliminar este operario?"))return; const u={...data,operarios:data.operarios.filter(o=>o.id!==id)};setData(u);saveData(u); }

  return (
    <div style={{ minHeight:"100vh", background:"#0a0c13", color:"#fff", fontFamily:"'DM Sans',sans-serif", padding:"20px 16px 60px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{ maxWidth:480, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
          <div><div style={{ fontSize:20, fontWeight:800 }}>🔐 Panel Supervisor</div><div style={{ fontSize:12, color:"#4b5563" }}>Gestión de operarios</div></div>
          <button onClick={onClose} style={{ background:"#1a1d27", border:"1px solid #2a2d3a", borderRadius:10, color:"#9ca3af", padding:"8px 16px", cursor:"pointer", fontSize:13 }}>← Volver</button>
        </div>
        <Card style={{ marginBottom:24 }}>
          <Label>Nuevo operario</Label>
          {paso===1&&<>
            <FieldInput label="Nombre completo" placeholder="Ej: Juan Pérez" value={nombre} onChange={e=>setNombre(e.target.value)}/>
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:12, color:"#6b7280", marginBottom:5 }}>Etapa asignada (opcional)</div>
              <select value={etapaOp} onChange={e=>setEtapaOp(e.target.value)} style={{ width:"100%", background:"#0f1117", border:"1px solid #2a2d3a", borderRadius:10, padding:"12px 14px", color:etapaOp?"#fff":"#6b7280", fontSize:14, outline:"none" }}>
                <option value="">Todas las etapas</option>
                {ETAPAS.map(e=><option key={e.id} value={e.id}>{e.icon} {e.label}</option>)}
              </select>
            </div>
            <Btn onClick={()=>nombre.trim()&&setPaso(2)} disabled={!nombre.trim()} style={{ width:"100%", marginTop:16 }}>Siguiente → Crear PIN</Btn>
          </>}
          {paso===2&&<>
            <div style={{ fontSize:14, color:"#9ca3af", marginBottom:16 }}>Operario: <span style={{ color:"#fff", fontWeight:700 }}>{nombre}</span></div>
            <PinPad value={pin1} onChange={setPin1} label="Ingresa el PIN (4 dígitos)"/>
          </>}
          {paso===3&&<>
            <div style={{ fontSize:14, color:"#9ca3af", marginBottom:16 }}>Confirma el PIN para <span style={{ color:"#fff", fontWeight:700 }}>{nombre}</span></div>
            <PinPad value={pin2} onChange={setPin2} label="Repite el PIN"/>
            {flash==="nocoincide"&&<Alert color="#f87171">Los PINs no coinciden.</Alert>}
          </>}
          {flash==="ok"&&<Alert color="#4ade80">✓ Operario creado correctamente</Alert>}
          {paso>1&&<button onClick={()=>{setPaso(1);setPin1("");setPin2("");}} style={{ marginTop:12, background:"none", border:"none", color:"#4b5563", fontSize:13, cursor:"pointer", width:"100%", textAlign:"center" }}>← Volver</button>}
        </Card>
        <div style={{ fontSize:13, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Operarios ({data.operarios.length})</div>
        {data.operarios.length===0
          ? <Card><div style={{ textAlign:"center", padding:"20px 0", color:"#374151", fontSize:14 }}>Sin operarios aún</div></Card>
          : data.operarios.map(op=>{
              const etInfo=ETAPAS.find(e=>e.id===op.etapa);
              return (
                <Card key={op.id} style={{ marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700 }}>👤 {op.nombre}</div>
                    <div style={{ fontSize:12, color:"#6b7280", marginTop:4 }}>{etInfo?<Badge color={etInfo.color}>{etInfo.icon} {etInfo.label}</Badge>:<span style={{color:"#4b5563"}}>Todas las etapas</span>}</div>
                  </div>
                  <button onClick={()=>eliminar(op.id)} style={{ background:"#1f2937", border:"none", borderRadius:10, color:"#f87171", padding:"8px 14px", cursor:"pointer", fontSize:13 }}>Eliminar</button>
                </Card>
              );
            })
        }
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  PANEL REPORTES
// ════════════════════════════════════════════════════════════
function PanelReportes({ data, onClose }) {
  const [rango,setRango]=useState("todo");

  function enRango(iso) {
    if (rango==="todo") return true;
    const d=new Date(iso); const now=new Date();
    if (rango==="hoy")    return d.toDateString()===now.toDateString();
    if (rango==="semana") { const ini=new Date(now); ini.setDate(now.getDate()-7); return d>=ini; }
    if (rango==="mes")    { const ini=new Date(now); ini.setDate(now.getDate()-30); return d>=ini; }
    return true;
  }

  const registros=data.registros.filter(r=>enRango(r.fechaEntrega));
  const kgTotalEntrada=registros.filter(r=>r.etapaId==="recepcion").reduce((s,r)=>s+(r.kgEntregados||0),0);
  const kgTotalSalida =registros.filter(r=>r.etapaId==="ojoelius"&&r.estado==="aceptado").reduce((s,r)=>s+(r.kgEntregados||0),0);
  const mermaTotal    =kgTotalEntrada>0?((kgTotalEntrada-kgTotalSalida)/kgTotalEntrada*100).toFixed(1):null;
  const lotesActivos  =new Set(registros.map(r=>r.loteId)).size;

  const mermaPorCat=CATS_MERMA.map(cat=>{
    const kgCat=registros.filter(r=>r.catMerma===cat.id).reduce((s,r)=>s+(r.mermaKg||0),0);
    const pct=kgTotalEntrada>0?(kgCat/kgTotalEntrada*100).toFixed(1):"0.0";
    return {...cat,kg:round(kgCat),pct};
  }).sort((a,b)=>b.kg-a.kg);

  const mermaPorEtapa=ETAPAS.map(e=>{
    const regs=registros.filter(r=>r.etapaId===e.id);
    const kgEntregado=regs.reduce((s,r)=>s+(r.kgEntregados||0),0);
    const mermaKg=regs.reduce((s,r)=>s+(r.mermaKg||0),0);
    const mPct=kgEntregado>0?(mermaKg/(kgEntregado+mermaKg)*100).toFixed(1):"0.0";
    return {...e,kgEntregado,mermaKg:round(mermaKg),mPct};
  });

  const mermaPorOp={};
  registros.forEach(r=>{
    if(!r.operario) return;
    if(!mermaPorOp[r.operario]) mermaPorOp[r.operario]={nombre:r.operario,mermaKg:0,count:0};
    mermaPorOp[r.operario].mermaKg+=(r.mermaKg||0);
    mermaPorOp[r.operario].count+=1;
  });
  const opList=Object.values(mermaPorOp).sort((a,b)=>b.mermaKg-a.mermaKg);

  function exportarCSV(){
    const rows=[["Fecha","Proveedor","Especie","Variedad","Guía","Rampla","Etapa","KG Entregados","Merma KG","Cat. Merma","Justificación","Operario","Estado"]];
    registros.forEach(r=>{
      const lote=data.lotes.find(l=>l.id===r.loteId);
      rows.push([fmt(r.fechaEntrega),lote?.proveedor||"",lote?.especie||"",lote?.variedad||"",
        lote?.guia||"",lote?.rampla||"",
        ETAPAS.find(e=>e.id===r.etapaId)?.label||"",
        r.kgEntregados||"",r.mermaKg||0,
        CATS_MERMA.find(c=>c.id===r.catMerma)?.label||"",r.justMerma||"",
        r.operario||"",r.estado]);
    });
    const csv=rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url;
    a.download=`frutatrack_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#080b12", color:"#fff", fontFamily:"'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 32px 60px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32, flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:26, fontWeight:800, letterSpacing:"-1px" }}>📊 Reportes</div>
            <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>Análisis de mermas y rendimiento</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onClose} style={{ background:"#1a1d27", border:"1px solid #2a2d3a", borderRadius:10, color:"#9ca3af", padding:"9px 16px", cursor:"pointer", fontSize:13 }}>← Volver</button>
            <button onClick={exportarCSV} style={{ background:"#4ade80", border:"none", borderRadius:10, color:"#000", padding:"9px 18px", cursor:"pointer", fontSize:13, fontWeight:700 }}>⬇ Exportar CSV</button>
          </div>
        </div>

        <div style={{ display:"flex", gap:4, background:"#0f1117", padding:4, borderRadius:12, border:"1px solid #1e2130", marginBottom:28, width:"fit-content" }}>
          {[["hoy","Hoy"],["semana","7 días"],["mes","30 días"],["todo","Todo"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setRango(id)} style={{ padding:"7px 14px", borderRadius:9, border:"none", background:rango===id?"#4ade80":"none", color:rango===id?"#000":"#6b7280", fontWeight:700, cursor:"pointer", fontSize:13 }}>{lbl}</button>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:32 }}>
          <Stat label="KG ingresados"    value={`${round(kgTotalEntrada)} kg`} color="#4ade80"/>
          <Stat label="KG en Ojo Elius"  value={`${round(kgTotalSalida)} kg`}  color="#a78bfa"/>
          <Stat label="Merma total"       value={mermaTotal!=null?`${mermaTotal}%`:"—"} color={mermaTotal>15?"#f87171":mermaTotal>8?"#fb923c":"#4ade80"} sub={mermaTotal!=null?`${round(kgTotalEntrada-kgTotalSalida)} kg perdidos`:""}/>
          <Stat label="Lotes en período"  value={lotesActivos} color="#60a5fa"/>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:28 }}>
          <Card>
            <Label>Merma por categoría</Label>
            {mermaPorCat.every(c=>c.kg===0)
              ? <div style={{ color:"#374151", fontSize:13, padding:"20px 0", textAlign:"center" }}>Sin datos en este período</div>
              : mermaPorCat.map(cat=>(
                  <div key={cat.id} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{cat.icon} {cat.label}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:cat.color }}>{cat.kg} kg ({cat.pct}%)</div>
                    </div>
                    <div style={{ height:6, background:"#0f1117", borderRadius:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(parseFloat(cat.pct)*5,100)}%`, background:cat.color, borderRadius:4 }}/>
                    </div>
                  </div>
                ))
            }
          </Card>

          <Card>
            <Label>KG entregados y merma por etapa</Label>
            {mermaPorEtapa.every(e=>e.kgEntregado===0)
              ? <div style={{ color:"#374151", fontSize:13, padding:"20px 0", textAlign:"center" }}>Sin datos en este período</div>
              : mermaPorEtapa.map(e=>(
                  <div key={e.id} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{e.icon} {e.label}</div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontSize:11, color:"#6b7280" }}>{round(e.kgEntregado)} kg entregados</span>
                        <span style={{ fontSize:13, fontWeight:700, color:parseFloat(e.mPct)>15?"#f87171":parseFloat(e.mPct)>8?"#fb923c":e.color }}>
                          {e.mermaKg>0?`-${e.mPct}%`:"✓"}
                        </span>
                      </div>
                    </div>
                    <div style={{ height:6, background:"#0f1117", borderRadius:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(parseFloat(e.mPct)*3,100)}%`, background:e.color, borderRadius:4 }}/>
                    </div>
                  </div>
                ))
            }
          </Card>
        </div>

        <Card>
          <Label>Merma por operario</Label>
          {opList.length===0
            ? <div style={{ color:"#374151", fontSize:13, padding:"20px 0", textAlign:"center" }}>Sin datos</div>
            : <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr>{["Operario","Registros","Merma total (kg)"].map(h=><th key={h} style={{ textAlign:"left", fontSize:11, color:"#4b5563", fontWeight:700, paddingBottom:10 }}>{h}</th>)}</tr></thead>
                <tbody>{opList.map((o,i)=>(
                  <tr key={i} style={{ borderTop:"1px solid #2a2d3a" }}>
                    <td style={{ padding:"10px 0", fontSize:13, fontWeight:600 }}>👤 {o.nombre}</td>
                    <td style={{ padding:"10px 0", fontSize:13, color:"#6b7280" }}>{o.count}</td>
                    <td style={{ padding:"10px 0", fontSize:13, fontWeight:700, color:o.mermaKg>0?"#fb923c":"#4ade80" }}>{round(o.mermaKg)} kg</td>
                  </tr>
                ))}</tbody>
              </table>
          }
        </Card>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  VISTA TERRENO
// ════════════════════════════════════════════════════════════
function VistaTerreno({ data, setData }) {
  const [operario,setOperario]   = useState(null);
  const [showLogin,setShowLogin] = useState(false);
  const [showSup,setShowSup]     = useState(false);
  const [supAccion,setSupAccion] = useState(null);
  const [flash,setFlash]         = useState("");

  const [loteId,setLoteId]   = useState("");
  const [etapaId,setEtapaId] = useState("");

  // Formulario entrega
  const [kgEntregados,setKgEntregados] = useState("");
  const [mermaKg,setMermaKg]           = useState("");
  const [catMerma,setCatMerma]         = useState("");
  const [justMerma,setJustMerma]       = useState("");
  const [nota,setNota]                 = useState("");

  // Nuevo lote
  const [showNuevoLote,setShowNuevoLote]   = useState(false);
  const [nuevoProveedor,setNuevoProveedor] = useState("");
  const [nuevoEspecie,setNuevoEspecie]     = useState("");
  const [nuevoVariedad,setNuevoVariedad]   = useState("");
  const [nuevoGuia,setNuevoGuia]           = useState("");
  const [nuevoRampla,setNuevoRampla]       = useState("");

  function msg(m){ setFlash(m); setTimeout(()=>setFlash(""),2800); }

  function agregarLote(){
    if(!nuevoProveedor.trim()) return;
    const lote={id:uid(),proveedor:nuevoProveedor.trim(),especie:nuevoEspecie.trim(),variedad:nuevoVariedad.trim(),guia:nuevoGuia.trim(),rampla:nuevoRampla.trim(),creadoEn:new Date().toISOString()};
    const u={...data,lotes:[...data.lotes,lote]};
    setData(u);saveData(u);setLoteId(lote.id);setEtapaId("");
    setNuevoProveedor("");setNuevoEspecie("");setNuevoVariedad("");setNuevoGuia("");setNuevoRampla("");setShowNuevoLote(false);
  }

  function estEtapa(etId){ return loteId ? estadoEtapa(loteId, etId, data.registros) : "bloqueada"; }

  // Limpiar formulario al cambiar etapa
  useEffect(()=>{
    setKgEntregados(""); setMermaKg(""); setCatMerma(""); setJustMerma(""); setNota("");
  },[loteId, etapaId]);

  const hayMerma = mermaKg && parseFloat(mermaKg) > 0;
  const estadoActual = etapaId ? estEtapa(etapaId) : null;
  const registroActual = loteId&&etapaId ? data.registros.find(r=>r.loteId===loteId&&r.etapaId===etapaId) : null;
  const etapaActual = ETAPAS.find(e=>e.id===etapaId);
  const loteActual  = data.lotes.find(l=>l.id===loteId);
  const entregasPendientes = data.registros.filter(r=>r.estado==="entregado").length;

  function entregar(){
    if(!operario){setShowLogin(true);return;}
    if(!loteId||!etapaId||!kgEntregados) return;
    if(hayMerma&&!catMerma){msg("sinCat");return;}
    if(hayMerma&&!justMerma.trim()){msg("justMerma");return;}

    const reg={
      id:uid(), loteId, etapaId,
      kgEntregados: parseFloat(kgEntregados),
      mermaKg:      mermaKg ? parseFloat(mermaKg) : 0,
      catMerma:     hayMerma ? catMerma : "",
      justMerma:    hayMerma ? justMerma.trim() : "",
      nota:         nota.trim(),
      operario:     operario.nombre,
      operarioId:   operario.id,
      operarioAcepta: null,
      estado:       SIGUIENTE[etapaId] ? "entregado" : "aceptado", // última etapa se acepta sola
      fechaEntrega: new Date().toISOString(),
      fechaAcepta:  null,
    };
    const u={...data,registros:[...data.registros,reg]};
    setData(u);saveData(u);
    msg("ok");
  }

  function aceptar(){
    if(!operario){setShowLogin(true);return;}
    if(!registroActual) return;
    const u={...data,registros:data.registros.map(r=>r.id===registroActual.id?{
      ...r, estado:"aceptado", operarioAcepta:operario.nombre, fechaAcepta:new Date().toISOString()
    }:r)};
    setData(u);saveData(u);
    msg("aceptado");
  }

  function confirmarSupervisor(){
    if(supAccion.tipo==="rechazar"){
      const u={...data,registros:data.registros.map(r=>r.id===supAccion.id?{...r,estado:"rechazado",fechaAcepta:new Date().toISOString()}:r)};
      setData(u);saveData(u);msg("rechazado");
    } else if(supAccion.tipo==="reabrir"){
      const u={...data,registros:data.registros.map(r=>r.id===supAccion.id?{...r,estado:"entregado",fechaAcepta:null,operarioAcepta:null}:r)};
      setData(u);saveData(u);
    }
    setSupAccion(null);setShowSup(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0a0c13", color:"#fff", fontFamily:"'DM Sans',sans-serif", padding:"20px 16px 80px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>

      {showLogin&&<ModalLogin operarios={data.operarios} onLogin={op=>{setOperario(op);setShowLogin(false);}} onCancel={()=>setShowLogin(false)}/>}
      {showSup&&<ModalSupervisor titulo={supAccion?.tipo==="rechazar"?"Rechazar entrega":"Reabrir entrega"} desc={supAccion?.tipo==="rechazar"?"Solo supervisores pueden rechazar.":"Reabrir para corregir."} onConfirm={confirmarSupervisor} onCancel={()=>{setShowSup(false);setSupAccion(null);}}/>}

      <div style={{ maxWidth:480, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:26 }}>🍎</span>
            <div><div style={{ fontSize:20, fontWeight:800 }}>Terreno</div><div style={{ fontSize:12, color:"#4b5563" }}>Registro de proceso</div></div>
          </div>
          {operario
            ? <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <div style={{ background:"#14532d33", border:"1px solid #4ade8055", borderRadius:10, padding:"7px 12px" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#4ade80" }}>👤 {operario.nombre}</div>
                </div>
                <button onClick={()=>setOperario(null)} style={{ background:"#1a1d27", border:"1px solid #2a2d3a", borderRadius:10, color:"#6b7280", padding:"7px 10px", cursor:"pointer", fontSize:12 }}>Salir</button>
              </div>
            : <button onClick={()=>setShowLogin(true)} style={{ background:"#4ade80", border:"none", borderRadius:10, color:"#000", padding:"8px 14px", cursor:"pointer", fontSize:13, fontWeight:700 }}>👤 Identificarse</button>
          }
        </div>

        {entregasPendientes>0&&(
          <Alert color="#fb923c" style={{ marginBottom:16 }}>⏳ {entregasPendientes} entrega{entregasPendientes>1?"s":""} esperando aceptación</Alert>
        )}

        {/* 1. Lote */}
        <Card style={{ marginBottom:14 }}>
          <Label>1 · Proveedor / Lote</Label>
          <select value={loteId} onChange={e=>{setLoteId(e.target.value);setEtapaId("");}}
            style={{ width:"100%", background:"#0f1117", border:"1px solid #2a2d3a", borderRadius:10, padding:"12px 14px", color:loteId?"#fff":"#6b7280", fontSize:15, outline:"none" }}>
            <option value="">— Seleccionar lote —</option>
            {data.lotes.map(l=><option key={l.id} value={l.id}>{l.proveedor}{l.especie?" · "+l.especie:""}{l.variedad?" / "+l.variedad:""}</option>)}
          </select>

          {loteActual&&(
            <div style={{ marginTop:10, display:"flex", gap:8, flexWrap:"wrap" }}>
              {loteActual.especie&&<Badge color="#4ade80">🍎 {loteActual.especie}</Badge>}
              {loteActual.variedad&&<Badge color="#a78bfa">✨ {loteActual.variedad}</Badge>}
              {loteActual.guia&&<Badge color="#60a5fa">📋 Guía {loteActual.guia}</Badge>}
              {loteActual.rampla&&<Badge color="#fb923c">🚛 Rampla {loteActual.rampla}</Badge>}
            </div>
          )}

          {!showNuevoLote
            ? <button onClick={()=>setShowNuevoLote(true)} style={{ marginTop:10, background:"none", border:"1px dashed #374151", borderRadius:10, color:"#60a5fa", fontSize:13, padding:"9px 14px", width:"100%", cursor:"pointer" }}>+ Nuevo lote</button>
            : <div style={{ marginTop:12, background:"#0f1117", borderRadius:12, padding:"14px" }}>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:10, fontWeight:700 }}>NUEVO LOTE</div>
                <FieldInput label="Proveedor" placeholder="Nombre del proveedor" value={nuevoProveedor} onChange={e=>setNuevoProveedor(e.target.value)}/>
                <FieldInput label="Especie" placeholder="Ej: Durazno, Manzana..." value={nuevoEspecie} onChange={e=>setNuevoEspecie(e.target.value)}/>
                <FieldInput label="Variedad (opcional)" placeholder="Ej: Flat Queen..." value={nuevoVariedad} onChange={e=>setNuevoVariedad(e.target.value)}/>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <FieldInput label="N° Guía" placeholder="Ej: 123456" type="number" value={nuevoGuia} onChange={e=>setNuevoGuia(e.target.value)}/>
                  <FieldInput label="N° Rampla" placeholder="Ej: 3" type="number" value={nuevoRampla} onChange={e=>setNuevoRampla(e.target.value)}/>
                </div>
                <div style={{ display:"flex", gap:8, marginTop:12 }}>
                  <button onClick={()=>setShowNuevoLote(false)} style={{ flex:1, background:"none", border:"1px solid #374151", borderRadius:10, color:"#6b7280", padding:"10px", cursor:"pointer", fontSize:13 }}>Cancelar</button>
                  <Btn onClick={agregarLote} disabled={!nuevoProveedor.trim()} style={{ flex:2 }}>Crear lote</Btn>
                </div>
              </div>
          }
        </Card>

        {/* 2. Etapas en orden */}
        {loteId&&(
          <Card style={{ marginBottom:14 }}>
            <Label>2 · Seleccionar etapa</Label>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {ETAPAS.map((e,i)=>{
                const est=estEtapa(e.id);
                const selec=etapaId===e.id;
                const iconEst={ bloqueada:"🔒", disponible:"", entregada:"⏳", aceptada:"✅", rechazada:"🔒" }[est];
                const colorTexto={ bloqueada:"#374151", disponible:"#9ca3af", entregada:"#fb923c", aceptada:"#4ade80", rechazada:"#f87171" }[est];
                const colorBorde=selec?e.color:{ bloqueada:"#1f2937", disponible:"#2a2d3a", entregada:"#fb923c44", aceptada:"#4ade8044", rechazada:"#f8717144" }[est];
                return (
                  <button key={e.id} onClick={()=>est!=="bloqueada"&&setEtapaId(e.id)}
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                      background:selec?e.color+"22":"#0f1117", border:`2px solid ${colorBorde}`,
                      borderRadius:12, padding:"14px 16px", cursor:est==="bloqueada"?"not-allowed":"pointer" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:20 }}>{e.icon}</span>
                      <div style={{ textAlign:"left" }}>
                        <div style={{ fontSize:13, fontWeight:700, color:selec?e.color:colorTexto }}>{e.label}</div>
                        <div style={{ fontSize:11, color:"#6b7280", marginTop:1 }}>Paso {i+1}</div>
                      </div>
                    </div>
                    <span style={{ fontSize:16 }}>{iconEst}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* 3. Acción según estado */}
        {loteId&&etapaId&&(
          <>
            {/* ── DISPONIBLE: registrar y entregar ── */}
            {estadoActual==="disponible"&&(
              <Card style={{ marginBottom:14 }}>
                <Label>3 · Registrar KG y entregar a {ETAPAS.find(e=>e.id===SIGUIENTE[etapaId])?.label || "siguiente etapa"}</Label>

                <div style={{ marginTop:4 }}>
                  <div style={{ fontSize:12, color:"#6b7280", marginBottom:6 }}>📤 KG entregados desde {etapaActual?.label}</div>
                  <input type="number" placeholder="0.0" value={kgEntregados} onChange={e=>setKgEntregados(e.target.value)}
                    style={{ width:"100%", background:"#0f1117", border:"1px solid #4ade8055", borderRadius:10, padding:"14px", color:"#4ade80", fontSize:28, fontWeight:800, outline:"none", boxSizing:"border-box" }}/>
                </div>

                <div style={{ marginTop:14 }}>
                  <div style={{ fontSize:12, color:"#6b7280", marginBottom:6 }}>🍂 Merma en este proceso (opcional)</div>
                  <input type="number" placeholder="0.0" value={mermaKg} onChange={e=>setMermaKg(e.target.value)}
                    style={{ width:"100%", background:"#0f1117", border:"1px solid #f8717133", borderRadius:10, padding:"12px 14px", color:"#f87171", fontSize:20, fontWeight:700, outline:"none", boxSizing:"border-box" }}/>
                </div>

                {hayMerma&&(
                  <div style={{ marginTop:14, background:"#0f1117", borderRadius:12, padding:"14px" }}>
                    <div style={{ fontSize:12, color:"#fb923c", fontWeight:700, marginBottom:10 }}>⚠️ Categoría de merma (obligatorio)</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                      {CATS_MERMA.map(cat=>(
                        <button key={cat.id} onClick={()=>setCatMerma(cat.id)} style={{
                          background:catMerma===cat.id?cat.color+"22":"#1a1d27",
                          border:`2px solid ${catMerma===cat.id?cat.color:"#2a2d3a"}`,
                          borderRadius:10, padding:"10px 8px", cursor:"pointer",
                          color:catMerma===cat.id?cat.color:"#9ca3af", textAlign:"left",
                        }}>
                          <div style={{ fontSize:16 }}>{cat.icon}</div>
                          <div style={{ fontSize:11, fontWeight:700, marginTop:4 }}>{cat.label}</div>
                          <div style={{ fontSize:10, color:"#6b7280", marginTop:2 }}>{cat.desc}</div>
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize:12, color:"#6b7280", marginBottom:6 }}>Justificación (obligatoria)</div>
                    <input placeholder="Describe la causa..." value={justMerma} onChange={e=>setJustMerma(e.target.value)}
                      style={{ width:"100%", background:"#1a1d27", border:"1px solid #374151", borderRadius:10, padding:"10px 12px", color:"#fff", fontSize:13, outline:"none", boxSizing:"border-box" }}/>
                  </div>
                )}

                <FieldInput label="Nota (opcional)" placeholder="Observaciones..." value={nota} onChange={e=>setNota(e.target.value)}/>
                {operario&&<div style={{ marginTop:10, background:"#0f1117", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#6b7280" }}>Registrará como: <span style={{ color:"#4ade80", fontWeight:700 }}>👤 {operario.nombre}</span></div>}

                {flash==="sinCat"   &&<Alert color="#fb923c">⚠️ Selecciona la categoría de merma.</Alert>}
                {flash==="justMerma"&&<Alert color="#fb923c">⚠️ Escribe la justificación de la merma.</Alert>}

                <Btn onClick={entregar} disabled={!kgEntregados}
                  color={flash==="ok"?"#4ade80":"linear-gradient(135deg,#4ade80,#22c55e)"}
                  style={{ width:"100%", padding:"16px", borderRadius:14, fontSize:16, marginTop:14 }}>
                  {flash==="ok"?"✓ Entregado":!operario?"👤 Identificarse para entregar":"Registrar entrega →"}
                </Btn>
              </Card>
            )}

            {/* ── ENTREGADA: esperando aceptación ── */}
            {estadoActual==="entregada"&&registroActual&&(
              <Card style={{ marginBottom:14, border:"1px solid #fb923c44" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                  <span style={{ fontSize:24 }}>⏳</span>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"#fb923c" }}>Esperando aceptación</div>
                    <div style={{ fontSize:12, color:"#6b7280" }}>Entregó: {registroActual.operario} · {fmt(registroActual.fechaEntrega)}</div>
                  </div>
                </div>

                {/* Resumen de lo entregado */}
                <div style={{ background:"#0f1117", borderRadius:12, padding:"14px", marginBottom:16 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ fontSize:12, color:"#6b7280" }}>📤 KG entregados desde {etapaActual?.label}</div>
                    <div style={{ fontSize:24, fontWeight:800, color:"#4ade80" }}>{registroActual.kgEntregados} kg</div>
                  </div>
                  {registroActual.mermaKg>0&&(
                    <div style={{ marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontSize:12, color:"#6b7280" }}>🍂 Merma registrada</div>
                      <div style={{ fontSize:14, fontWeight:700, color:"#f87171" }}>{registroActual.mermaKg} kg</div>
                    </div>
                  )}
                  {registroActual.catMerma&&(
                    <div style={{ marginTop:8 }}>
                      <Badge color={CATS_MERMA.find(c=>c.id===registroActual.catMerma)?.color||"#9ca3af"}>
                        {CATS_MERMA.find(c=>c.id===registroActual.catMerma)?.icon} {CATS_MERMA.find(c=>c.id===registroActual.catMerma)?.label}
                      </Badge>
                      {registroActual.justMerma&&<span style={{ fontSize:11, color:"#9ca3af", marginLeft:8 }}>{registroActual.justMerma}</span>}
                    </div>
                  )}
                </div>

                <div style={{ background:"#60a5fa11", border:"1px solid #60a5fa33", borderRadius:12, padding:"14px", marginBottom:14 }}>
                  <div style={{ fontSize:13, color:"#60a5fa", fontWeight:700, marginBottom:6 }}>
                    ¿Acepta el lote en {ETAPAS.find(e=>e.id===SIGUIENTE[etapaId])?.label||etapaActual?.label}?
                  </div>
                  <div style={{ fontSize:12, color:"#9ca3af" }}>
                    Al aceptar, confirmas que recibiste los {registroActual.kgEntregados} kg y se habilita la siguiente etapa.
                  </div>
                  {operario&&<div style={{ marginTop:10, fontSize:12, color:"#6b7280" }}>Aceptará como: <span style={{ color:"#4ade80", fontWeight:700 }}>👤 {operario.nombre}</span></div>}
                </div>

                {flash==="aceptado"&&<Alert color="#4ade80">✅ Lote aceptado — siguiente etapa desbloqueada</Alert>}

                <div style={{ display:"flex", gap:8 }}>
                  <Btn onClick={()=>{setSupAccion({tipo:"rechazar",id:registroActual.id});setShowSup(true);}} color="#1a1d27" textColor="#f87171" style={{ flex:1, border:"1px solid #f8717155" }}>🔒 Rechazar</Btn>
                  <Btn onClick={aceptar} disabled={!operario} color="#60a5fa" style={{ flex:2 }}>
                    {!operario?"👤 Identificarse":"✅ Aceptar lote"}
                  </Btn>
                </div>
              </Card>
            )}

            {/* ── ACEPTADA ── */}
            {estadoActual==="aceptada"&&registroActual&&(
              <Card style={{ border:"1px solid #4ade8044" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <span style={{ fontSize:24 }}>✅</span>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"#4ade80" }}>Etapa completada y aceptada</div>
                    <div style={{ fontSize:12, color:"#6b7280" }}>Aceptado: {fmt(registroActual.fechaAcepta)}</div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div style={{ background:"#0f1117", borderRadius:10, padding:"12px" }}>
                    <div style={{ fontSize:10, color:"#6b7280" }}>📤 KG entregados</div>
                    <div style={{ fontSize:20, fontWeight:800, color:"#4ade80" }}>{registroActual.kgEntregados} kg</div>
                    <div style={{ fontSize:11, color:"#4b5563", marginTop:2 }}>por {registroActual.operario}</div>
                  </div>
                  <div style={{ background:"#0f1117", borderRadius:10, padding:"12px" }}>
                    <div style={{ fontSize:10, color:"#6b7280" }}>✅ Aceptado por</div>
                    <div style={{ fontSize:14, fontWeight:700, color:"#60a5fa", marginTop:4 }}>{registroActual.operarioAcepta||"—"}</div>
                    {registroActual.mermaKg>0&&<div style={{ fontSize:11, color:"#f87171", marginTop:4 }}>Merma: {registroActual.mermaKg} kg</div>}
                  </div>
                </div>
              </Card>
            )}

            {/* ── RECHAZADA ── */}
            {estadoActual==="rechazada"&&registroActual&&(
              <Card style={{ border:"1px solid #f8717133" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <span style={{ fontSize:24 }}>🔒</span>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"#f87171" }}>Entrega rechazada</div>
                    <div style={{ fontSize:12, color:"#6b7280" }}>Requiere intervención del supervisor</div>
                  </div>
                </div>
                <Btn onClick={()=>{setSupAccion({tipo:"reabrir",id:registroActual.id});setShowSup(true);}} color="#1a1d27" textColor="#f87171" style={{ width:"100%", border:"1px solid #f8717155" }}>
                  🔑 Reabrir con PIN supervisor
                </Btn>
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
function VistaEscritorio({ data, setData }) {
  const [filtro,setFiltro]       = useState("todos");
  const [showSup,setShowSup]     = useState(false);
  const [panelSup,setPanelSup]   = useState(false);
  const [reportes,setReportes]   = useState(false);

  if(panelSup) return <PanelSupervisor data={data} setData={setData} onClose={()=>setPanelSup(false)}/>;
  if(reportes) return <PanelReportes data={data} onClose={()=>setReportes(false)}/>;

  const registros=filtro==="todos"?data.registros:data.registros.filter(r=>r.loteId===filtro);
  const estadoColor={entregado:"#fb923c",aceptado:"#4ade80",rechazado:"#f87171"};
  const estadoIcon ={entregado:"⏳",aceptado:"✅",rechazado:"🔒"};
  const entregados =data.registros.filter(r=>r.estado==="entregado").length;
  const rechazados =data.registros.filter(r=>r.estado==="rechazado").length;
  const aceptados  =data.registros.filter(r=>r.estado==="aceptado").length;

  function limpiar(){ if(window.confirm("¿Eliminar lotes y registros?")){ const e={lotes:[],registros:[],operarios:data.operarios};setData(e);saveData(e); } }

  return (
    <div style={{ minHeight:"100vh", background:"#080b12", color:"#fff", fontFamily:"'DM Sans',sans-serif", display:"flex" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      {showSup&&<ModalSupervisor titulo="Acceso Supervisor" desc="Ingresa el PIN de supervisor." onConfirm={()=>{setShowSup(false);setPanelSup(true);}} onCancel={()=>setShowSup(false)}/>}

      {/* Sidebar */}
      <div style={{ width:240, background:"#0f1117", borderRight:"1px solid #1e2130", padding:"28px 16px", flexShrink:0, position:"relative", minHeight:"100vh" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:32 }}>
          <span style={{ fontSize:24 }}>🍎</span>
          <div><div style={{ fontSize:16, fontWeight:800 }}>FrutaTrack</div><div style={{ fontSize:11, color:"#4b5563" }}>Trazabilidad en línea</div></div>
        </div>

        {entregados>0&&<div style={{ background:"#78350f22", border:"1px solid #fb923c", borderRadius:12, padding:"10px 14px", marginBottom:8 }}><div style={{ fontSize:12, color:"#fb923c", fontWeight:700 }}>⏳ {entregados} esperando aceptación</div></div>}
        {rechazados>0&&<div style={{ background:"#7f1d1d22", border:"1px solid #f87171", borderRadius:12, padding:"10px 14px", marginBottom:8 }}><div style={{ fontSize:12, color:"#f87171", fontWeight:700 }}>🔒 {rechazados} rechazado{rechazados>1?"s":""}</div></div>}

        <div style={{ fontSize:11, color:"#4b5563", textTransform:"uppercase", letterSpacing:1, marginBottom:8, marginTop:8 }}>Proveedores</div>
        <button onClick={()=>setFiltro("todos")} style={{ width:"100%", textAlign:"left", padding:"9px 12px", borderRadius:10, border:"none", background:filtro==="todos"?"#1e2130":"none", color:filtro==="todos"?"#fff":"#6b7280", cursor:"pointer", fontSize:14, marginBottom:4 }}>Todos los lotes</button>
        {data.lotes.map(l=>(
          <button key={l.id} onClick={()=>setFiltro(l.id)} style={{ width:"100%", textAlign:"left", padding:"9px 12px", borderRadius:10, border:"none", background:filtro===l.id?"#1e2130":"none", color:filtro===l.id?"#4ade80":"#6b7280", cursor:"pointer", fontSize:14, marginBottom:4 }}>
            🌿 {l.proveedor}{l.guia?<span style={{fontSize:11,color:"#60a5fa"}}> · G{l.guia}</span>:""}{l.especie?<span style={{fontSize:11,color:"#4b5563"}}> · {l.especie}</span>:""}
          </button>
        ))}

        <div style={{ position:"absolute", bottom:20, left:16, right:16, display:"flex", flexDirection:"column", gap:8 }}>
          <button onClick={()=>setReportes(true)} style={{ background:"#1a1d27", border:"1px solid #4ade8033", borderRadius:10, color:"#4ade80", padding:"9px", cursor:"pointer", fontSize:13, fontWeight:600 }}>📊 Ver Reportes</button>
          <button onClick={()=>setShowSup(true)}  style={{ background:"#1a1d27", border:"1px solid #374151", borderRadius:10, color:"#9ca3af", padding:"9px", cursor:"pointer", fontSize:13 }}>🔐 Panel Supervisor</button>
          <button onClick={limpiar}               style={{ background:"none", border:"1px solid #1e2130", borderRadius:10, color:"#374151", padding:"9px", cursor:"pointer", fontSize:13 }}>🗑 Limpiar datos</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, padding:"36px 40px", overflowY:"auto" }}>
        <div style={{ marginBottom:32 }}>
          <h1 style={{ margin:0, fontSize:28, fontWeight:800, letterSpacing:"-1px" }}>Panel de Control</h1>
          <p style={{ margin:"4px 0 0", color:"#6b7280", fontSize:14 }}>Recepción → Repelado → Ojo Chino → Ojo Elius</p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:36 }}>
          {[{label:"Esperando aceptación",val:entregados,color:"#fb923c",icon:"⏳"},{label:"Aceptados",val:aceptados,color:"#4ade80",icon:"✅"},{label:"Rechazados",val:rechazados,color:"#f87171",icon:"🔒"}].map(s=>(
            <div key={s.label} style={{ background:"#0f1117", border:`1px solid ${s.color}33`, borderRadius:16, padding:"20px" }}>
              <div style={{ fontSize:22 }}>{s.icon}</div>
              <div style={{ fontSize:32, fontWeight:800, color:s.color, marginTop:8 }}>{s.val}</div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {data.lotes.length===0
          ? <div style={{ textAlign:"center", padding:"80px 0", color:"#374151" }}><div style={{ fontSize:48, marginBottom:16 }}>📱</div><div style={{ fontSize:18, fontWeight:600, color:"#4b5563" }}>Sin datos aún</div></div>
          : <>
              {/* Flujo visual */}
              {(filtro==="todos"?data.lotes:data.lotes.filter(l=>l.id===filtro)).map(lote=>(
                <div key={lote.id} style={{ marginBottom:28 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#9ca3af" }}>🌿 {lote.proveedor}</div>
                    {lote.especie&&<Badge color="#4ade80">🍎 {lote.especie}</Badge>}
                    {lote.variedad&&<Badge color="#a78bfa">✨ {lote.variedad}</Badge>}
                    {lote.guia&&<Badge color="#60a5fa">📋 Guía {lote.guia}</Badge>}
                    {lote.rampla&&<Badge color="#fb923c">🚛 Rampla {lote.rampla}</Badge>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", overflowX:"auto", background:"#0f1117", borderRadius:16, padding:"20px", gap:0 }}>
                    {ETAPAS.map((e,i)=>{
                      const r=data.registros.find(r=>r.loteId===lote.id&&r.etapaId===e.id);
                      const est=estadoEtapa(lote.id,e.id,data.registros);
                      const cat=r&&CATS_MERMA.find(c=>c.id===r.catMerma);
                      return (
                        <div key={e.id} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                          <div style={{ background:est==="bloqueada"?"#0a0c13":"#1a1d27", border:`1px solid ${est==="bloqueada"?"#1f2937":e.color+"44"}`, borderRadius:12, padding:"14px", minWidth:130, textAlign:"center" }}>
                            <div style={{ fontSize:18 }}>{est==="bloqueada"?"🔒":e.icon}</div>
                            <div style={{ fontSize:11, color:est==="bloqueada"?"#374151":e.color, fontWeight:700, marginTop:4 }}>{e.label}</div>
                            {r&&<div style={{ marginTop:8 }}>
                              <div style={{ background:"#0f1117", borderRadius:8, padding:"6px 8px", marginBottom:4 }}>
                                <div style={{ fontSize:9, color:"#6b7280" }}>📤 Entregado</div>
                                <div style={{ fontSize:16, fontWeight:800, color:"#4ade80" }}>{r.kgEntregados} kg</div>
                              </div>
                              {r.mermaKg>0&&<div style={{ fontSize:10, color:"#f87171", marginBottom:4 }}>🍂 -{r.mermaKg} kg {cat&&`(${cat.label})`}</div>}
                              <div style={{ fontSize:10, color:estadoColor[r.estado] }}>{estadoIcon[r.estado]} {r.estado}</div>
                              <div style={{ fontSize:9, color:"#4b5563", marginTop:2 }}>👤 {r.operario}</div>
                              {r.operarioAcepta&&<div style={{ fontSize:9, color:"#4b5563" }}>✅ {r.operarioAcepta}</div>}
                            </div>}
                            {est==="bloqueada"&&!r&&<div style={{ marginTop:6, fontSize:10, color:"#374151" }}>Bloqueada</div>}
                          </div>
                          {i<ETAPAS.length-1&&<div style={{ width:24, height:2, background:r?estadoColor[r.estado]:"#1f2937", flexShrink:0 }}/>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Tabla */}
              <div style={{ marginTop:20 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:14 }}>Detalle de registros</div>
                <div style={{ background:"#0f1117", borderRadius:16, border:"1px solid #1e2130", overflow:"hidden" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid #1e2130" }}>
                        {["Fecha","Proveedor","Especie","Guía","Rampla","Etapa","KG Entregados","Merma","Cat. Merma","Justificación","Operario entrega","Operario acepta","Estado"].map(h=>(
                          <th key={h} style={{ padding:"12px 12px", textAlign:"left", fontSize:11, color:"#4b5563", fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...registros].reverse().map(r=>{
                        const lote=data.lotes.find(l=>l.id===r.loteId);
                        const etapa=ETAPAS.find(e=>e.id===r.etapaId);
                        const cat=CATS_MERMA.find(c=>c.id===r.catMerma);
                        return (
                          <tr key={r.id} style={{ borderBottom:"1px solid #0f1117" }}>
                            <td style={{ padding:"11px 12px", fontSize:11, color:"#6b7280", whiteSpace:"nowrap" }}>{fmt(r.fechaEntrega)}</td>
                            <td style={{ padding:"11px 12px", fontSize:13, fontWeight:600 }}>🌿 {lote?.proveedor}</td>
                            <td style={{ padding:"11px 12px", fontSize:12, color:"#9ca3af" }}>{lote?.especie||"—"}{lote?.variedad?" / "+lote.variedad:""}</td>
                            <td style={{ padding:"11px 12px", fontSize:12, color:"#60a5fa" }}>{lote?.guia||"—"}</td>
                            <td style={{ padding:"11px 12px", fontSize:12, color:"#fb923c" }}>{lote?.rampla||"—"}</td>
                            <td style={{ padding:"11px 12px" }}>{etapa&&<Badge color={etapa.color}>{etapa.icon} {etapa.label}</Badge>}</td>
                            <td style={{ padding:"11px 12px", fontSize:15, fontWeight:800, color:"#4ade80" }}>{r.kgEntregados} kg</td>
                            <td style={{ padding:"11px 12px", fontSize:13, fontWeight:700, color:r.mermaKg>0?"#f87171":"#374151" }}>{r.mermaKg>0?`-${r.mermaKg} kg`:"—"}</td>
                            <td style={{ padding:"11px 12px" }}>{cat?<Badge color={cat.color}>{cat.icon} {cat.label}</Badge>:<span style={{color:"#374151"}}>—</span>}</td>
                            <td style={{ padding:"11px 12px", fontSize:11, color:"#6b7280", maxWidth:160 }}>{r.justMerma||"—"}</td>
                            <td style={{ padding:"11px 12px", fontSize:12 }}>👤 {r.operario}</td>
                            <td style={{ padding:"11px 12px", fontSize:12, color:"#6b7280" }}>{r.operarioAcepta?`✅ ${r.operarioAcepta}`:"—"}</td>
                            <td style={{ padding:"11px 12px" }}><Badge color={estadoColor[r.estado]}>{estadoIcon[r.estado]} {r.estado}</Badge></td>
                          </tr>
                        );
                      })}
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
//  APP RAÍZ
// ════════════════════════════════════════════════════════════
export default function App() {
  const [vista,setVista] = useState("escritorio");
  const [data,setData]   = useState(loadData);
  useEffect(()=>{ const iv=setInterval(()=>setData(loadData()),3000); return ()=>clearInterval(iv); },[]);
  return (
    <div>
      <div style={{ position:"fixed", top:14, right:14, zIndex:1000, display:"flex", gap:5, background:"#0f1117", padding:5, borderRadius:14, border:"1px solid #1e2130" }}>
        <button onClick={()=>setVista("terreno")}    style={{ padding:"7px 14px", borderRadius:10, border:"none", background:vista==="terreno"?"#4ade80":"none",    color:vista==="terreno"?"#000":"#6b7280",    fontWeight:700, cursor:"pointer", fontSize:13 }}>📱 Terreno</button>
        <button onClick={()=>setVista("escritorio")} style={{ padding:"7px 14px", borderRadius:10, border:"none", background:vista==="escritorio"?"#60a5fa":"none", color:vista==="escritorio"?"#000":"#6b7280", fontWeight:700, cursor:"pointer", fontSize:13 }}>🖥 Escritorio</button>
      </div>
      {vista==="terreno"?<VistaTerreno data={data} setData={setData}/>:<VistaEscritorio data={data} setData={setData}/>}
    </div>
  );
}
