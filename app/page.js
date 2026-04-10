"use client";
import { useState, useEffect, useCallback } from "react";
const fmt=(n)=>"$"+Number(n||0).toLocaleString();
const ROLES={admin:"👑總部",manager:"🏠管理",store_manager:"🏪門店主管",staff:"👤員工"};
const DAYS=["日","一","二","三","四","五","六"];
const LT={annual:{l:"特休",c:"#4361ee",bg:"#e6f1fb"},sick:{l:"病假",c:"#b45309",bg:"#fff8e6"},personal:{l:"事假",c:"#8a6d00",bg:"#fef9c3"},menstrual:{l:"生理假",c:"#993556",bg:"#fbeaf0"},off:{l:"例假",c:"#666",bg:"#f0f0f0"},rest:{l:"休息日",c:"#888",bg:"#f5f5f5"}};
const ROLE_TABS={admin:["schedules","leaves","shifts","attendance","worklogs","expenses","pnl","announcements","settings","settlements","deposits","employees"],manager:["schedules","leaves","shifts","attendance","worklogs","expenses","pnl","settlements","deposits","employees"],store_manager:["schedules","shifts","worklogs"]};
const TAB_L={schedules:"📅排班",leaves:"🙋請假",shifts:"⏰班別",attendance:"📍出勤",worklogs:"📋日誌",expenses:"📦費用",pnl:"📊損益",announcements:"📢公告",settings:"⚙️設定",settlements:"💰日結",deposits:"🏦存款",employees:"👥員工"};
function api(u,b){return b?fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(r=>r.json()):fetch(u).then(r=>r.json());}
function Badge({status}){const m={matched:{bg:"#e6f9f0",c:"#0a7c42"},pending:{bg:"#fff8e6",c:"#8a6d00"},approved:{bg:"#e6f9f0",c:"#0a7c42"},rejected:{bg:"#fde8e8",c:"#b91c1c"},anomaly:{bg:"#fde8e8",c:"#b91c1c"},minor_diff:{bg:"#fff8e6",c:"#8a6d00"}};const s=m[status]||{bg:"#f0f0f0",c:"#666"};return<span style={{padding:"2px 6px",borderRadius:8,fontSize:10,background:s.bg,color:s.c}}>{status}</span>;}
function RB({role}){const c={admin:{bg:"#fde8e8",c:"#b91c1c"},manager:{bg:"#e6f1fb",c:"#185fa5"},store_manager:{bg:"#fef9c3",c:"#8a6d00"},staff:{bg:"#e6f9f0",c:"#0a7c42"}};const s=c[role]||c.staff;return<span style={{padding:"1px 5px",borderRadius:5,fontSize:9,background:s.bg,color:s.c}}>{ROLES[role]||role}</span>;}

function LoginPage({onLogin}){
  const[step,setStep]=useState("phone");const[phone,setPhone]=useState("");const[code,setCode]=useState("");const[msg,setMsg]=useState("");const[ld,setLd]=useState(false);
  const send=async()=>{setLd(true);setMsg("");const r=await api("/api/auth",{action:"send_code",phone});setLd(false);if(r.success){setStep("code");setMsg("✅ 驗證碼已發送到LINE");}else setMsg("❌ "+r.error);};
  const verify=async()=>{setLd(true);setMsg("");const r=await api("/api/auth",{action:"verify",phone,code});setLd(false);if(r.success){localStorage.setItem("admin_token",r.token);onLogin(r);}else setMsg("❌ "+r.error);};
  return<div style={{minHeight:"100vh",background:"#faf8f5",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}><div style={{background:"#fff",borderRadius:16,border:"1px solid #e8e6e1",padding:"36px 28px",maxWidth:340,width:"100%",textAlign:"center"}}>
    <div style={{fontSize:32,marginBottom:10}}>🍯</div><h1 style={{fontSize:17,fontWeight:600,marginBottom:20}}>小食糖管理後台</h1>
    {step==="phone"&&<div><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="手機號碼" style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid #ddd",fontSize:15,textAlign:"center",marginBottom:10}} onKeyDown={e=>e.key==="Enter"&&send()}/><button onClick={send} disabled={!phone||ld} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",background:phone&&!ld?"#1a1a1a":"#ccc",color:"#fff",fontSize:14,cursor:"pointer"}}>{ld?"...":"發送驗證碼"}</button></div>}
    {step==="code"&&<div><input value={code} onChange={e=>setCode(e.target.value)} placeholder="6位驗證碼" maxLength={6} style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid #ddd",fontSize:20,textAlign:"center",letterSpacing:6,marginBottom:10}} onKeyDown={e=>e.key==="Enter"&&verify()}/><button onClick={verify} disabled={code.length!==6||ld} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",background:code.length===6&&!ld?"#0a7c42":"#ccc",color:"#fff",fontSize:14,cursor:"pointer"}}>{ld?"...":"登入"}</button><button onClick={()=>{setStep("phone");setCode("");}} style={{marginTop:6,background:"none",border:"none",color:"#999",fontSize:11,cursor:"pointer"}}>← 重新輸入</button></div>}
    {msg&&<p style={{marginTop:8,fontSize:12,color:msg.startsWith("✅")?"#0a7c42":"#b91c1c"}}>{msg}</p>}
  </div></div>;
}

// ===== 員工詳情彈窗 =====
const TIERS_R=[[1,"27,470"],[2,"27,471~28,800"],[3,"28,801~30,300"],[4,"30,301~31,800"],[5,"31,801~33,300"],[6,"33,301~34,800"],[7,"34,801~36,300"],[8,"36,301~38,200"],[9,"38,201~40,100"],[10,"40,101~42,000"],[11,"42,001~43,900"],[12,"43,901~45,800"]];
const TIERS_P=[[1,"~11,100"],[2,"11,101~12,540"],[3,"12,541~13,500"],[4,"13,501~15,840"],[5,"15,841~16,500"],[6,"16,501~17,280"],[7,"17,281~17,880"],[8,"17,881~19,047"],[9,"19,048~20,008"],[10,"20,009~21,009"],[11,"21,010~22,000"],[12,"22,001~23,100"]];

function EmpDetail({empId,onClose}){
  const[d,setD]=useState(null);const[ld,setLd]=useState(true);const[saving,setSaving]=useState(false);const[msg,setMsg]=useState("");
  const[form,setForm]=useState({role:"",employment_type:"",labor_tier:"",health_tier:"",labor_start_date:"",health_start_date:"",hourly_rate:"",monthly_salary:""});
  const reload=()=>api(`/api/admin/employees?id=${empId}`).then(r=>{setD(r);if(r.data)setForm({role:r.data.role||"staff",employment_type:r.data.employment_type||"regular",labor_tier:r.data.labor_tier||"",health_tier:r.data.health_tier||"",labor_start_date:r.data.labor_start_date||"",health_start_date:r.data.health_start_date||"",hourly_rate:r.data.hourly_rate||"",monthly_salary:r.data.monthly_salary||""});setLd(false);});
  useEffect(()=>{reload();},[empId]);
  const save=async()=>{setSaving(true);setMsg("");await api("/api/admin/employees",{action:"update",employee_id:empId,role:form.role,employment_type:form.employment_type,labor_tier:form.labor_tier?Number(form.labor_tier):null,health_tier:form.health_tier?Number(form.health_tier):null,labor_start_date:form.labor_start_date||null,health_start_date:form.health_start_date||null,hourly_rate:form.hourly_rate?Number(form.hourly_rate):null,monthly_salary:form.monthly_salary?Number(form.monthly_salary):null});setMsg("✅ 已儲存");setSaving(false);reload();};
  const tiers=form.employment_type==="parttime"?TIERS_P:TIERS_R;
  if(ld)return<div style={modal}><div style={mbox}><p>載入中...</p></div></div>;
  const e=d?.data,li=d?.labor_insurance,hi=d?.health_insurance;
  return<div style={modal} onClick={onClose}><div style={mbox} onClick={ev=>ev.stopPropagation()}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h2 style={{fontSize:16,fontWeight:600}}>👤 {e?.name}</h2>
      <button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer"}}>✕</button>
    </div>
    <div style={sec}><h4 style={sh}>基本資料</h4>
      <Row l="門市" v={e?.stores?.name||"總部"}/><Row l="手機" v={e?.phone}/><Row l="Email" v={e?.email}/>
      <Row l="生日" v={e?.birthday}/><Row l="身分證" v={e?.id_number}/>
      <Row l="緊急聯絡" v={`${e?.emergency_contact||""} ${e?.emergency_phone||""} (${e?.emergency_relation||""})`}/>
      <Row l="LINE" v={e?.line_uid?"✅已綁定":"未綁定"}/><Row l="帳號" v={e?.is_active?<span style={{color:"#0a7c42"}}>✅啟用</span>:<span style={{color:"#b91c1c"}}>⏳待啟用</span>}/>
    </div>
    <div style={sec}><h4 style={sh}>在職資訊</h4>
      <Row l="到職日" v={e?.hire_date||"未設定"}/><Row l="年資" v={`${d?.service_months||0}個月`}/>
      <Row l="合約" v={e?.contract_signed?`✅ ${new Date(e.contract_signed_at).toLocaleDateString("zh-TW")}`:"❌未簽"}/>
    </div>
    <div style={sec}><h4 style={sh}>特休假（{new Date().getFullYear()}年）</h4><Row l="年資特休" v={`${d?.annual_leave_days||0}天`}/></div>
    <div style={{...sec,border:"2px solid #4361ee"}}><h4 style={{...sh,color:"#4361ee"}}>✏️ 角色權限</h4>
      <select value={form.role} onChange={ev=>setForm({...form,role:ev.target.value})} style={inp}><option value="staff">👤員工</option><option value="store_manager">🏪門店主管</option><option value="manager">🏠管理</option><option value="admin">👑總部</option></select>
      <div style={{marginTop:4}}><label style={{fontSize:10,color:"#888"}}>投保類型</label><select value={form.employment_type} onChange={ev=>setForm({...form,employment_type:ev.target.value,labor_tier:"",health_tier:""})} style={inp}><option value="regular">一般</option><option value="parttime">兼職</option></select></div>
    </div>
    <div style={{...sec,border:"2px solid #b45309"}}><h4 style={{...sh,color:"#b45309"}}>🛡️ 勞保設定</h4>
      <label style={{fontSize:10,color:"#888"}}>勞保級距</label><select value={form.labor_tier} onChange={ev=>setForm({...form,labor_tier:ev.target.value})} style={inp}><option value="">未設定</option>{tiers.map(([i,r])=><option key={i} value={i}>第{i}級（{"$"}{r}）</option>)}</select>
      <div style={{marginTop:4}}><label style={{fontSize:10,color:"#888"}}>勞保加保日期</label><input type="date" value={form.labor_start_date} onChange={ev=>setForm({...form,labor_start_date:ev.target.value})} style={inp}/></div>
      {li&&<div style={{marginTop:6,padding:6,background:"#fff8e6",borderRadius:4,fontSize:11}}>投保薪資：{fmt(li.insured_salary)}｜<b>自付：{fmt(li.labor_self)}/月</b>｜雇主：{fmt(li.labor_employer)}/月</div>}
    </div>
    <div style={{...sec,border:"2px solid #0a7c42"}}><h4 style={{...sh,color:"#0a7c42"}}>🏥 健保設定</h4>
      <label style={{fontSize:10,color:"#888"}}>健保級距</label><select value={form.health_tier} onChange={ev=>setForm({...form,health_tier:ev.target.value})} style={inp}><option value="">未設定</option>{tiers.map(([i,r])=><option key={i} value={i}>第{i}級（{"$"}{r}）</option>)}</select>
      <div style={{marginTop:4}}><label style={{fontSize:10,color:"#888"}}>健保加保日期</label><input type="date" value={form.health_start_date} onChange={ev=>setForm({...form,health_start_date:ev.target.value})} style={inp}/></div>
      {hi&&<div style={{marginTop:6,padding:6,background:"#e6f9f0",borderRadius:4,fontSize:11}}>投保薪資：{fmt(hi.insured_salary)}｜<b>自付：{fmt(hi.health_self)}/月</b>｜雇主：{fmt(hi.health_employer)}/月</div>}
    </div>
    <div style={{...sec,border:"2px solid #666"}}><h4 style={{...sh,color:"#666"}}>💰 薪資設定</h4>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}><div><label style={{fontSize:10,color:"#888"}}>月薪</label><input type="number" value={form.monthly_salary} onChange={ev=>setForm({...form,monthly_salary:ev.target.value})} style={inp}/></div><div><label style={{fontSize:10,color:"#888"}}>時薪</label><input type="number" value={form.hourly_rate} onChange={ev=>setForm({...form,hourly_rate:ev.target.value})} style={inp}/></div></div>
      {(li||hi)&&<div style={{marginTop:6,padding:6,background:"#f0f0f0",borderRadius:4,fontSize:11}}>每月扣除：勞保 {fmt(li?.labor_self||0)} + 健保 {fmt(hi?.health_self||0)} = <b>{fmt((li?.labor_self||0)+(hi?.health_self||0))}</b></div>}
    </div>
    <button onClick={save} disabled={saving} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",background:saving?"#ccc":"#0a7c42",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>{saving?"儲存中...":"💾 儲存所有變更"}</button>
    {msg&&<p style={{textAlign:"center",fontSize:12,color:"#0a7c42",marginTop:4}}>{msg}</p>}
    </div>
  </div></div>;
}
const modal={position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16};
const mbox={background:"#fff",borderRadius:14,maxWidth:480,width:"100%",maxHeight:"85vh",overflow:"auto",padding:"20px 18px"};
const sec={marginBottom:14,padding:"10px 12px",background:"#faf8f5",borderRadius:8};
const sh={fontSize:12,fontWeight:600,marginBottom:6,color:"#444"};
const inp={width:"100%",padding:"5px 8px",borderRadius:5,border:"1px solid #ddd",fontSize:12};
function Row({l,v}){return<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",fontSize:12}}><span style={{color:"#888"}}>{l}</span><span>{v||"-"}</span></div>;}

// ===== 主後台 =====
export default function Admin(){
  const[auth,setAuth]=useState(null);const[ck,setCk]=useState(true);
  useEffect(()=>{const t=localStorage.getItem("admin_token");if(!t){setCk(false);return;}fetch("/api/auth",{headers:{"x-admin-token":t}}).then(r=>r.json()).then(d=>{if(d.authenticated)setAuth({token:t,...d});else{localStorage.removeItem("admin_token");}setCk(false);}).catch(()=>setCk(false));},[]);
  const logout=()=>{localStorage.removeItem("admin_token");setAuth(null);};
  if(ck)return<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#faf8f5"}}>載入中...</div>;
  if(!auth)return<LoginPage onLogin={d=>setAuth({token:d.token,...d})}/>;
  return<Dashboard auth={auth} onLogout={logout}/>;
}

function Dashboard({auth,onLogout}){
  const myTabs=ROLE_TABS[auth.role]||ROLE_TABS.store_manager;
  const[tab,setTab]=useState(myTabs[0]);const[stores,setStores]=useState([]);const[sf,setSf]=useState(auth.role==="store_manager"?auth.store_id||"":"");
  const[month,setMonth]=useState(()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;});
  const[sv,setSv]=useState("week");const[stl,setStl]=useState([]);const[sum,setSum]=useState({});const[dep,setDep]=useState([]);
  const[emps,setEmps]=useState([]);const[shifts,setShifts]=useState([]);const[scheds,setScheds]=useState([]);
  const[att,setAtt]=useState([]);const[as2,setAs2]=useState({});const[lr,setLr]=useState([]);const[ld,setLd]=useState(false);
  const[si,setSi]=useState(null);const[saf,setSaf]=useState(false);const[ne,setNe]=useState({name:"",store_id:"",role:"staff",phone:"",email:"",employment_type:"regular"});
  const[nbc,setNbc]=useState(null);const[ssf,setSsf]=useState(false);const[es,setEs]=useState(null);
  const[sf2,setSf2]=useState({store_id:"",name:"",start_time:"10:00",end_time:"20:00",break_minutes:60,work_hours:9,role:"all"});
  const[ws,setWs]=useState(()=>{const d=new Date();d.setDate(d.getDate()-d.getDay()+1);return d.toLocaleDateString("sv-SE");});
  const[pm,setPm]=useState(null);const[detailId,setDetailId]=useState(null);
  const[exps,setExps]=useState([]);const[expSum,setExpSum]=useState({});const[pnl,setPnl]=useState(null);
  const[anns,setAnns]=useState([]);const[newAnn,setNewAnn]=useState({title:"",content:"",priority:"normal",store_id:null});const[showAnnForm,setShowAnnForm]=useState(false);
  const[wlogs,setWlogs]=useState([]);const[wltemplates,setWltemplates]=useState([]);const[showWlForm,setShowWlForm]=useState(false);
  const[newWl,setNewWl]=useState({store_id:"",category:"開店準備",item:"",role:"all",shift_type:"opening",sort_order:0});

  useEffect(()=>{api("/api/admin/stores").then(d=>setStores(d.data||[]));},[]);
  const load=useCallback(()=>{
    setLd(true);const p=new URLSearchParams();if(month)p.set("month",month);if(sf)p.set("store_id",sf);
    const we2=new Date(new Date(ws).getTime()+6*86400000).toLocaleDateString("sv-SE");
    const sp=sv==="week"?`week_start=${ws}&week_end=${we2}${sf?`&store_id=${sf}`:""}`:`month=${month}${sf?`&store_id=${sf}`:""}`;
    Promise.all([
      myTabs.includes("settlements")?api(`/api/admin/settlements?${p}`):Promise.resolve({data:[],summary:{}}),
      myTabs.includes("deposits")?api(`/api/admin/deposits?${p}`):Promise.resolve({data:[]}),
      api("/api/admin/employees"),api(`/api/admin/shifts${sf?`?store_id=${sf}`:""}`),api(`/api/admin/schedules?${sp}`),
      myTabs.includes("attendance")?api(`/api/admin/attendance?type=records&${p}`):Promise.resolve({data:[]}),
      myTabs.includes("settings")?api("/api/admin/attendance?type=settings"):Promise.resolve({data:{}}),
      myTabs.includes("leaves")?api(`/api/admin/leaves?${p}`):Promise.resolve({data:[]}),
      myTabs.includes("expenses")?api(`/api/admin/expenses?month=${month}${sf?`&store_id=${sf}`:""}`):Promise.resolve({data:[],total:0,byCategory:{}}),
      myTabs.includes("pnl")?api(`/api/admin/pnl?month=${month}${sf?`&store_id=${sf}`:""}`):Promise.resolve(null),
      myTabs.includes("announcements")?api("/api/admin/announcements"):Promise.resolve({data:[]}),
      myTabs.includes("worklogs")?api(`/api/admin/worklogs?month=${month}${sf?`&store_id=${sf}`:""}`):Promise.resolve({data:[]}),
      myTabs.includes("worklogs")?api(`/api/admin/worklogs?type=templates${sf?`&store_id=${sf}`:""}`):Promise.resolve({data:[]}),
    ]).then(([s,d,e,sh,sc,at,as3,lr2,ex,pl2,an,wl,wlt])=>{setStl(s.data||[]);setSum(s.summary||{});setDep(d.data||[]);setEmps(e.data||[]);setShifts(sh.data||[]);setScheds(sc.data||[]);setAtt(at.data||[]);setAs2(as3.data||{});setLr(lr2.data||[]);setExps(ex.data||[]);setExpSum({total:ex.total,byCategory:ex.byCategory});setPnl(pl2);setAnns(an.data||[]);setWlogs(wl.data||[]);setWltemplates(wlt.data||[]);setLd(false);});
  },[month,sf,ws,sv,myTabs]);
  useEffect(()=>{load();},[load]);

  const addEmp=async()=>{const d=await api("/api/admin/employees",{action:"create",...ne});if(d.bind_code){setNbc(d.bind_code);load();}};
  const activate=async(id)=>{const d=await api("/api/admin/employees",{action:"activate",employee_id:id});if(d.bind_code)alert(`已啟用！綁定碼：${d.bind_code}`);load();};
  const deactivate=async(id)=>{if(confirm("確定停用？")){await api("/api/admin/employees",{action:"deactivate",employee_id:id});load();}};
  const regen=async(id)=>{const d=await api("/api/admin/employees",{action:"generate_bind_code",employee_id:id});if(d.bind_code)alert("綁定碼："+d.bind_code);load();};
  const saveShift=async()=>{if(es)await api("/api/admin/shifts",{action:"update",shift_id:es,...sf2});else await api("/api/admin/shifts",{action:"create",...sf2});setSsf(false);setEs(null);load();};
  const delShift=async(id)=>{if(confirm("刪除？")){await api("/api/admin/shifts",{action:"delete",shift_id:id});load();}};
  const editShift=(s)=>{setEs(s.id);setSf2({store_id:s.store_id,name:s.name,start_time:s.start_time,end_time:s.end_time,break_minutes:s.break_minutes,work_hours:s.work_hours,role:s.role});setSsf(true);};
  const addSch=async(eid,sid,date)=>{const sh=shifts.find(s=>s.id===sid);await api("/api/admin/schedules",{action:"create",employee_id:eid,store_id:sh?.store_id||sf,shift_id:sid,date});load();};
  const addLv=async(eid,date,lt)=>{await api("/api/admin/schedules",{action:"add_leave",employee_id:eid,date,leave_type:lt});load();};
  const delSch=async(id)=>{await api("/api/admin/schedules",{action:"delete",schedule_id:id});load();};
  const pub=async()=>{const we2=new Date(new Date(ws).getTime()+6*86400000).toLocaleDateString("sv-SE");const d=await api("/api/admin/schedules",{action:"publish",week_start:ws,week_end:we2,store_id:sf||undefined});setPm(`發布${d.published||0}筆`);setTimeout(()=>setPm(null),4000);load();};
  const rvLv=async(id,st)=>{await api("/api/admin/leaves",{action:"review",request_id:id,status:st});load();};
  const upS=(k,v)=>{setAs2({...as2,[k]:v});clearTimeout(window._st);window._st=setTimeout(()=>api("/api/admin/attendance",{action:"update_settings",[k]:v}),1000);};
  const rvExp=async(id,st)=>{await api("/api/admin/expenses",{action:"review",expense_id:id,status:st});load();};
  const addAnn=async()=>{await api("/api/admin/announcements",{action:"create",...newAnn,created_by:auth.employee_id});setShowAnnForm(false);setNewAnn({title:"",content:"",priority:"normal"});load();};
  const delAnn=async(id)=>{if(confirm("刪除？")){await api("/api/admin/announcements",{action:"delete",announcement_id:id});load();}};
  const addWlTemplate=async()=>{if(!newWl.item||!newWl.store_id)return;await api("/api/admin/worklogs",{action:"add_template",...newWl});setNewWl({...newWl,item:""});load();};
  const delWlTemplate=async(id)=>{await api("/api/admin/worklogs",{action:"delete_template",template_id:id});load();};

  const wd=Array.from({length:7},(_,i)=>new Date(new Date(ws).getTime()+i*86400000).toLocaleDateString("sv-SE"));
  const prevW=()=>setWs(new Date(new Date(ws).getTime()-7*86400000).toLocaleDateString("sv-SE"));
  const nextW=()=>setWs(new Date(new Date(ws).getTime()+7*86400000).toLocaleDateString("sv-SE"));
  const getMD=()=>{const[y,m]=month.split("-").map(Number);const f=new Date(y,m-1,1);const sd2=f.getDay();const ds=[];for(let i=-sd2;i<42-sd2&&ds.length<42;i++){const d=new Date(y,m-1,1+i);ds.push({date:d.toLocaleDateString("sv-SE"),inM:d.getMonth()===m-1});}return ds;};
  const ae=emps.filter(e=>e.is_active);const fe=sf?ae.filter(e=>e.store_id===sf):ae;
  const pendingEmps=emps.filter(e=>!e.is_active);const pl=lr.filter(l=>l.status==="pending");
  const ts=(id)=>({padding:"5px 12px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:tab===id?600:400,background:tab===id?"#1a1a1a":"transparent",color:tab===id?"#fff":"#888",whiteSpace:"nowrap",position:"relative"});

  const renderCell=(emp,date)=>{
    const sc=scheds.find(s=>s.employee_id===emp.id&&s.date===date);
    if(sc){if(sc.type==="leave"){const lt=LT[sc.leave_type]||LT.off;return<div style={{background:lt.bg,borderRadius:4,padding:"2px 3px",fontSize:9,position:"relative"}}><div style={{color:lt.c,fontWeight:500}}>{lt.l}</div><button onClick={()=>delSch(sc.id)} style={{position:"absolute",top:0,right:1,background:"none",border:"none",cursor:"pointer",fontSize:8,color:"#ccc"}}>✕</button></div>;}return<div style={{background:sc.published?"#e6f9f0":"#fff8e6",borderRadius:4,padding:"2px 3px",fontSize:9,position:"relative"}}><div style={{fontWeight:500}}>{sc.shifts?.name}</div><div style={{color:"#888"}}>{sc.shifts?.start_time?.slice(0,5)}~{sc.shifts?.end_time?.slice(0,5)}</div><button onClick={()=>delSch(sc.id)} style={{position:"absolute",top:0,right:1,background:"none",border:"none",cursor:"pointer",fontSize:8,color:"#ccc"}}>✕</button></div>;}
    return<select onChange={e=>{const v=e.target.value;e.target.value="";if(!v)return;if(v.startsWith("leave:"))addLv(emp.id,date,v.split(":")[1]);else addSch(emp.id,v,date);}} style={{width:"100%",padding:"1px",borderRadius:3,border:"1px dashed #ddd",fontSize:9,color:"#ccc",background:"transparent",cursor:"pointer"}}><option value="">＋</option><optgroup label="班別">{shifts.filter(s=>!sf||s.store_id===sf).map(s=><option key={s.id} value={s.id}>{s.name} {s.start_time?.slice(0,5)}~{s.end_time?.slice(0,5)}</option>)}</optgroup><optgroup label="休假">{Object.entries(LT).map(([k,v])=><option key={k} value={`leave:${k}`}>{v.l}</option>)}</optgroup></select>;
  };

  return(<div style={{minHeight:"100vh",background:"#faf8f5",fontFamily:"system-ui,'Noto Sans TC',sans-serif"}}>
    <div style={{background:"#fff",borderBottom:"1px solid #e8e6e1",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
      <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:18}}>🍯</span><span style={{fontSize:13,fontWeight:600}}>小食糖後台</span><RB role={auth.role}/><span style={{fontSize:11,color:"#888"}}>{auth.name}</span></div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{padding:"3px 6px",borderRadius:5,border:"1px solid #ddd",fontSize:11}}/>
        {auth.role!=="store_manager"&&<select value={sf} onChange={e=>setSf(e.target.value)} style={{padding:"3px 6px",borderRadius:5,border:"1px solid #ddd",fontSize:11}}><option value="">全部門市</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        <button onClick={onLogout} style={{padding:"3px 10px",borderRadius:5,border:"1px solid #ddd",background:"transparent",fontSize:11,cursor:"pointer",color:"#b91c1c"}}>登出</button>
      </div>
    </div>
    <div style={{maxWidth:1200,margin:"0 auto",padding:"12px 8px"}}>
      <div style={{display:"flex",gap:3,marginBottom:10,overflowX:"auto",paddingBottom:3}}>
        {myTabs.map(id=><button key={id} style={ts(id)} onClick={()=>setTab(id)}>{TAB_L[id]}{id==="leaves"&&pl.length>0&&<span style={{position:"absolute",top:-3,right:-3,background:"#b91c1c",color:"#fff",borderRadius:"50%",width:14,height:14,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center"}}>{pl.length}</span>}{id==="employees"&&pendingEmps.length>0&&<span style={{position:"absolute",top:-3,right:-3,background:"#b45309",color:"#fff",borderRadius:"50%",width:14,height:14,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center"}}>{pendingEmps.length}</span>}</button>)}
      </div>
      {ld&&<div style={{textAlign:"center",padding:30,color:"#aaa"}}>載入中...</div>}

      {/* 排班 */}
      {!ld&&tab==="schedules"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8,flexWrap:"wrap"}}>
          <button onClick={()=>setSv("week")} style={{padding:"3px 10px",borderRadius:5,border:"1px solid #ddd",background:sv==="week"?"#1a1a1a":"#fff",color:sv==="week"?"#fff":"#666",fontSize:11,cursor:"pointer"}}>週</button>
          <button onClick={()=>setSv("month")} style={{padding:"3px 10px",borderRadius:5,border:"1px solid #ddd",background:sv==="month"?"#1a1a1a":"#fff",color:sv==="month"?"#fff":"#666",fontSize:11,cursor:"pointer"}}>月</button>
          {sv==="week"&&<><button onClick={prevW} style={{padding:"3px 8px",borderRadius:5,border:"1px solid #ddd",background:"#fff",cursor:"pointer",fontSize:11}}>◀</button><span style={{fontSize:12,fontWeight:500}}>{ws}~{wd[6]}</span><button onClick={nextW} style={{padding:"3px 8px",borderRadius:5,border:"1px solid #ddd",background:"#fff",cursor:"pointer",fontSize:11}}>▶</button></>}
          <button onClick={pub} style={{padding:"4px 12px",borderRadius:5,border:"none",background:"#0a7c42",color:"#fff",cursor:"pointer",fontSize:11,marginLeft:"auto"}}>📢 發布</button>
        </div>
        {pm&&<div style={{background:"#e6f9f0",color:"#0a7c42",padding:"4px 10px",borderRadius:5,fontSize:11,marginBottom:6}}>{pm}</div>}
        {sv==="week"&&<div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:10,minWidth:700}}><thead><tr style={{background:"#faf8f5",borderBottom:"1px solid #e8e6e1"}}><th style={{padding:"7px 5px",textAlign:"left",fontWeight:500,color:"#666",minWidth:60,position:"sticky",left:0,background:"#faf8f5",zIndex:1}}>員工</th>{wd.map((d,i)=><th key={d} style={{padding:"7px 3px",textAlign:"center",fontWeight:500,color:i===0||i===6?"#b91c1c":"#666",minWidth:85}}>{d.slice(5)}({DAYS[new Date(d).getDay()]})</th>)}</tr></thead><tbody>{fe.map(emp=><tr key={emp.id} style={{borderBottom:"1px solid #f0eeea"}}><td style={{padding:"5px",fontWeight:500,fontSize:11,position:"sticky",left:0,background:"#fff",zIndex:1}}>{emp.name}<br/><RB role={emp.role}/></td>{wd.map(date=><td key={date} style={{padding:"2px",textAlign:"center",verticalAlign:"top"}}>{renderCell(emp,date)}</td>)}</tr>)}</tbody></table></div>}
        {sv==="month"&&<div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:10,tableLayout:"fixed"}}><thead><tr style={{background:"#faf8f5"}}>{DAYS.map((d,i)=><th key={d} style={{padding:"6px 3px",textAlign:"center",color:i===0||i===6?"#b91c1c":"#666",fontWeight:500}}>{d}</th>)}</tr></thead><tbody>{Array.from({length:6},(_,wk)=>{const md=getMD();const row=md.slice(wk*7,wk*7+7);if(!row.some(d=>d.inM))return null;return<tr key={wk}>{row.map(({date,inM})=>{const ds=scheds.filter(s=>s.date===date);return<td key={date} style={{padding:3,verticalAlign:"top",border:"1px solid #f0eeea",opacity:inM?1:0.3}}><div style={{fontSize:10,fontWeight:500,color:"#666"}}>{parseInt(date.split("-")[2])}</div>{ds.slice(0,3).map(s=>{if(s.type==="leave"){const lt=LT[s.leave_type]||LT.off;return<div key={s.id} style={{background:lt.bg,borderRadius:2,padding:"0 2px",fontSize:8,marginBottom:1,color:lt.c,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{s.employees?.name} {lt.l}</div>;}return<div key={s.id} style={{background:s.published?"#e6f9f0":"#fff8e6",borderRadius:2,padding:"0 2px",fontSize:8,marginBottom:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{s.employees?.name} {s.shifts?.name}</div>;})}{ds.length>3&&<div style={{fontSize:8,color:"#999"}}>+{ds.length-3}</div>}</td>;})}</tr>;})}</tbody></table></div>}
      </div>}

      {/* 請假 */}
      {!ld&&tab==="leaves"&&<div>
        {pl.length>0&&<div style={{background:"#fff8e6",borderRadius:8,padding:10,marginBottom:10}}><h3 style={{fontSize:13,fontWeight:500,marginBottom:6}}>⏳ 待審核（{pl.length}）</h3>{pl.map(l=><div key={l.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:"1px solid #f0eeea",flexWrap:"wrap",fontSize:12}}><b>{l.employees?.name}</b><span style={{color:LT[l.leave_type]?.c}}>{LT[l.leave_type]?.l}</span><span>{l.start_date}{l.end_date!==l.start_date?`~${l.end_date}`:""}{l.half_day?`(${l.half_day==="am"?"上":"下"})`:""}</span><div style={{marginLeft:"auto",display:"flex",gap:3}}><button onClick={()=>rvLv(l.id,"approved")} style={{padding:"3px 8px",borderRadius:4,border:"none",background:"#0a7c42",color:"#fff",fontSize:10,cursor:"pointer"}}>✅</button><button onClick={()=>rvLv(l.id,"rejected")} style={{padding:"3px 8px",borderRadius:4,border:"none",background:"#b91c1c",color:"#fff",fontSize:10,cursor:"pointer"}}>❌</button></div></div>)}</div>}
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:"#faf8f5",borderBottom:"1px solid #e8e6e1"}}>{["員工","假別","日期","狀態"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead><tbody>{lr.map(l=><tr key={l.id} style={{borderBottom:"1px solid #f0eeea"}}><td style={{padding:6,fontWeight:500}}>{l.employees?.name}</td><td style={{padding:6,color:LT[l.leave_type]?.c}}>{LT[l.leave_type]?.l}</td><td style={{padding:6}}>{l.start_date}{l.end_date!==l.start_date?`~${l.end_date}`:""}</td><td style={{padding:6}}><Badge status={l.status}/></td></tr>)}</tbody></table></div>
      </div>}

      {/* 班別 */}
      {!ld&&tab==="shifts"&&<div>
        <button onClick={()=>{setSsf(!ssf);setEs(null);setSf2({store_id:"",name:"",start_time:"10:00",end_time:"20:00",break_minutes:60,work_hours:9,role:"all"});}} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:ssf?"#f0f0f0":"#1a1a1a",color:ssf?"#666":"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>{ssf?"✕":"＋"}</button>
        {ssf&&<div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12,marginBottom:8}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:6}}>{[["store_id","門市","select"],["name","名稱","text"],["role","角色","role"],["start_time","上班","time"],["end_time","下班","time"],["break_minutes","休息(分)","number"]].map(([k,l,t])=><div key={k}><label style={{fontSize:10,color:"#888"}}>{l}</label>{t==="select"?<select value={sf2[k]} onChange={e=>setSf2({...sf2,[k]:e.target.value})} style={{width:"100%",padding:"4px",borderRadius:4,border:"1px solid #ddd",fontSize:11}}><option value="">選擇</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>:t==="role"?<select value={sf2[k]} onChange={e=>setSf2({...sf2,[k]:e.target.value})} style={{width:"100%",padding:"4px",borderRadius:4,border:"1px solid #ddd",fontSize:11}}><option value="all">全場</option><option value="外場">外場</option><option value="內場">內場</option></select>:<input type={t} value={sf2[k]} onChange={e=>setSf2({...sf2,[k]:t==="number"?Number(e.target.value):e.target.value})} style={{width:"100%",padding:"4px",borderRadius:4,border:"1px solid #ddd",fontSize:11}}/>}</div>)}</div><button onClick={saveShift} style={{padding:"4px 14px",borderRadius:4,border:"none",background:"#0a7c42",color:"#fff",fontSize:11,cursor:"pointer"}}>{es?"💾":"建立"}</button></div>}
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:"#faf8f5",borderBottom:"1px solid #e8e6e1"}}>{["門市","班別","時間","休息","角色","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead><tbody>{shifts.map(s=><tr key={s.id} style={{borderBottom:"1px solid #f0eeea"}}><td style={{padding:6}}>{s.stores?.name}</td><td style={{padding:6,fontWeight:500}}>{s.name}</td><td style={{padding:6}}>{s.start_time?.slice(0,5)}~{s.end_time?.slice(0,5)}</td><td style={{padding:6}}>{s.break_minutes}分</td><td style={{padding:6}}>{s.role}</td><td style={{padding:6}}><button onClick={()=>editShift(s)} style={{padding:"1px 5px",borderRadius:3,border:"1px solid #ddd",background:"transparent",cursor:"pointer",fontSize:10,marginRight:2}}>✏️</button><button onClick={()=>delShift(s.id)} style={{padding:"1px 5px",borderRadius:3,border:"1px solid #ddd",background:"transparent",cursor:"pointer",fontSize:10,color:"#b91c1c"}}>🗑</button></td></tr>)}</tbody></table></div>
      </div>}

      {/* 出勤 */}
      {!ld&&tab==="attendance"&&<div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:550}}><thead><tr style={{background:"#faf8f5",borderBottom:"1px solid #e8e6e1"}}>{["時間","員工","門市","類型","距離","遲到"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead><tbody>{att.map(a=><tr key={a.id} style={{borderBottom:"1px solid #f0eeea"}}><td style={{padding:6,fontSize:10}}>{new Date(a.timestamp).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}</td><td style={{padding:6,fontWeight:500}}>{a.employees?.name}</td><td style={{padding:6}}>{a.stores?.name}</td><td style={{padding:6}}>{a.type==="clock_in"?"🟢上班":"🔴下班"}</td><td style={{padding:6}}>{a.distance_meters?`${Math.round(a.distance_meters)}m`:"-"}{a.is_valid?"✅":"❌"}</td><td style={{padding:6,color:a.late_minutes>0?"#b91c1c":"#0a7c42"}}>{a.late_minutes>0?`${a.late_minutes}分`:"準時"}</td></tr>)}</tbody></table></div>}

      {/* 工作日誌管理 */}
      {!ld&&tab==="worklogs"&&<div>
        <h3 style={{fontSize:13,fontWeight:600,marginBottom:8}}>📋 工作日誌模板管理</h3>
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12,marginBottom:10}}>
          <h4 style={{fontSize:12,fontWeight:500,marginBottom:6}}>＋ 新增工作項目</h4>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:6}}>
            <div><label style={{fontSize:10,color:"#888"}}>門市 *</label><select value={newWl.store_id} onChange={e=>setNewWl({...newWl,store_id:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}><option value="">選擇</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label style={{fontSize:10,color:"#888"}}>分類</label><select value={newWl.category} onChange={e=>setNewWl({...newWl,category:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}><option>開店準備</option><option>營業中</option><option>打烊作業</option><option>清潔消毒</option><option>食材管理</option></select></div>
            <div><label style={{fontSize:10,color:"#888"}}>角色</label><select value={newWl.role} onChange={e=>setNewWl({...newWl,role:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}><option value="all">全員</option><option value="吧台">吧台</option><option value="內場">內場</option><option value="烘焙">烘焙</option><option value="外場">外場</option></select></div>
            <div><label style={{fontSize:10,color:"#888"}}>時段</label><select value={newWl.shift_type} onChange={e=>setNewWl({...newWl,shift_type:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}><option value="opening">開店</option><option value="during">營業中</option><option value="closing">打烊</option></select></div>
            <div style={{gridColumn:"span 2"}}><label style={{fontSize:10,color:"#888"}}>工作項目 *</label><input value={newWl.item} onChange={e=>setNewWl({...newWl,item:e.target.value})} placeholder="例：確認冷藏冷凍溫度" style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}/></div>
          </div>
          <button onClick={addWlTemplate} disabled={!newWl.item||!newWl.store_id} style={{padding:"4px 14px",borderRadius:4,border:"none",background:newWl.item&&newWl.store_id?"#0a7c42":"#ccc",color:"#fff",fontSize:11,cursor:"pointer"}}>新增</button>
        </div>
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto",marginBottom:14}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:"#faf8f5",borderBottom:"1px solid #e8e6e1"}}>{["門市","分類","角色","時段","工作項目",""].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
          <tbody>{wltemplates.length===0?<tr><td colSpan={6} style={{padding:20,textAlign:"center",color:"#ccc"}}>尚無工作項目</td></tr>:wltemplates.map(t=><tr key={t.id} style={{borderBottom:"1px solid #f0eeea"}}>
            <td style={{padding:6}}>{stores.find(s=>s.id===t.store_id)?.name||"-"}</td>
            <td style={{padding:6,fontWeight:500}}>{t.category}</td>
            <td style={{padding:6}}>{t.role==="all"?"全員":t.role}</td>
            <td style={{padding:6}}>{t.shift_type==="opening"?"開店":t.shift_type==="during"?"營業":"打烊"}</td>
            <td style={{padding:6}}>{t.item}</td>
            <td style={{padding:4}}><button onClick={()=>delWlTemplate(t.id)} style={{padding:"1px 5px",borderRadius:3,border:"1px solid #ddd",background:"transparent",cursor:"pointer",fontSize:9,color:"#b91c1c"}}>🗑</button></td>
          </tr>)}</tbody></table>
        </div>
        <h3 style={{fontSize:13,fontWeight:600,marginBottom:8}}>📝 員工提交紀錄</h3>
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:"#faf8f5",borderBottom:"1px solid #e8e6e1"}}>{["日期","員工","門市","完成項目","備註"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
          <tbody>{wlogs.length===0?<tr><td colSpan={5} style={{padding:20,textAlign:"center",color:"#ccc"}}>本月無提交紀錄</td></tr>:wlogs.map(l=><tr key={l.id} style={{borderBottom:"1px solid #f0eeea"}}>
            <td style={{padding:6}}>{l.date}</td>
            <td style={{padding:6,fontWeight:500}}>{l.employees?.name}</td>
            <td style={{padding:6}}>{l.stores?.name}</td>
            <td style={{padding:6}}>{(l.items||[]).length}項</td>
            <td style={{padding:6,fontSize:10,color:"#888",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.notes||"-"}</td>
          </tr>)}</tbody></table>
        </div>
      </div>}

      {/* 費用管理 */}
      {!ld&&tab==="expenses"&&<div>
        <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}><div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 12px",flex:1}}><div style={{fontSize:10,color:"#888"}}>本月費用總額</div><div style={{fontSize:16,fontWeight:600,color:"#b91c1c"}}>{fmt(expSum.total)}</div></div>{Object.entries(expSum.byCategory||{}).slice(0,3).map(([k,v])=><div key={k} style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 12px",flex:1}}><div style={{fontSize:10,color:"#888"}}>{k}</div><div style={{fontSize:14,fontWeight:600}}>{fmt(v)}</div></div>)}</div>
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:"#faf8f5",borderBottom:"1px solid #e8e6e1"}}>{["日期","門市","類型","廠商","分類","金額","狀態","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead><tbody>{exps.length===0&&<tr><td colSpan={8} style={{padding:30,textAlign:"center",color:"#ccc"}}>本月無費用紀錄</td></tr>}{exps.map(e=><tr key={e.id} style={{borderBottom:"1px solid #f0eeea"}}><td style={{padding:6}}>{e.date}</td><td style={{padding:6}}>{e.stores?.name}</td><td style={{padding:6}}>{e.expense_type==="vendor"?"📦廠商":"💰零用金"}</td><td style={{padding:6,fontWeight:500}}>{e.vendor_name||"-"}</td><td style={{padding:6}}>{e.expense_categories?.name||"-"}</td><td style={{padding:6,fontWeight:600}}>{fmt(e.amount)}</td><td style={{padding:6}}><Badge status={e.status}/></td><td style={{padding:6}}>{e.status==="pending"&&<><button onClick={()=>rvExp(e.id,"approved")} style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#0a7c42",color:"#fff",fontSize:9,cursor:"pointer",marginRight:2}}>✅</button><button onClick={()=>rvExp(e.id,"rejected")} style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#b91c1c",color:"#fff",fontSize:9,cursor:"pointer"}}>❌</button></>}</td></tr>)}</tbody></table></div>
      </div>}

      {/* 損益表 */}
      {!ld&&tab==="pnl"&&<div style={{maxWidth:500}}>
        <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>📊 {month} 損益表</h3>
        {pnl?<div>
          <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:14,marginBottom:10}}>
            <h4 style={{fontSize:13,fontWeight:500,color:"#0a7c42",marginBottom:8}}>收入</h4>
            <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f0eeea",fontSize:13}}><span>營業收入</span><b style={{color:"#0a7c42"}}>{fmt(pnl.revenue?.total)}</b></div>
            {Object.entries(pnl.revenue?.byStore||{}).map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",padding:"4px 0 4px 16px",fontSize:11,color:"#888"}}><span>{k}</span><span>{fmt(v)}</span></div>)}
            <div style={{fontSize:11,color:"#888",marginTop:4}}>共 {pnl.revenue?.days||0} 天營業</div>
          </div>
          <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:14,marginBottom:10}}>
            <h4 style={{fontSize:13,fontWeight:500,color:"#b91c1c",marginBottom:8}}>支出</h4>
            <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f0eeea",fontSize:13}}><span>📦 月結廠商</span><span>{fmt(pnl.expenses?.vendor)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f0eeea",fontSize:13}}><span>💰 零用金</span><span>{fmt(pnl.expenses?.petty_cash)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f0eeea",fontSize:13}}><span>👥 人事成本</span><span>{fmt(pnl.expenses?.labor)}</span></div>
            {Object.entries(pnl.expenses?.byCategory||{}).map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",padding:"3px 0 3px 16px",fontSize:11,color:"#888"}}><span>{k}</span><span>{fmt(v)}</span></div>)}
            <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0 0",fontSize:13,fontWeight:600,color:"#b91c1c"}}><span>支出合計</span><span>{fmt(pnl.expenses?.total)}</span></div>
          </div>
          <div style={{background:Number(pnl.profit?.net||0)>=0?"#e6f9f0":"#fde8e8",borderRadius:8,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13}}><span>毛利（收入-原物料-零用金）</span><b>{fmt(pnl.profit?.gross)}</b></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:15,fontWeight:700}}><span>淨利</span><span style={{color:Number(pnl.profit?.net||0)>=0?"#0a7c42":"#b91c1c"}}>{fmt(pnl.profit?.net)}</span></div>
            <div style={{textAlign:"right",fontSize:12,color:"#888"}}>利潤率 {pnl.profit?.margin}%</div>
          </div>
        </div>:<div style={{background:"#fff",borderRadius:8,padding:30,textAlign:"center",color:"#ccc"}}>無資料</div>}
      </div>}

      {/* 公布欄管理 */}
      {!ld&&tab==="announcements"&&<div>
        <button onClick={()=>setShowAnnForm(!showAnnForm)} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:showAnnForm?"#f0f0f0":"#1a1a1a",color:showAnnForm?"#666":"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>{showAnnForm?"✕":"＋新增公告"}</button>
        {showAnnForm&&<div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12,marginBottom:8}}>
          <div style={{marginBottom:6}}><label style={{fontSize:10,color:"#888"}}>標題 *</label><input value={newAnn.title} onChange={e=>setNewAnn({...newAnn,title:e.target.value})} style={{width:"100%",padding:5,borderRadius:4,border:"1px solid #ddd",fontSize:12}}/></div>
          <div style={{marginBottom:6}}><label style={{fontSize:10,color:"#888"}}>內容 *</label><textarea value={newAnn.content} onChange={e=>setNewAnn({...newAnn,content:e.target.value})} rows={3} style={{width:"100%",padding:5,borderRadius:4,border:"1px solid #ddd",fontSize:12}}/></div>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            <div style={{flex:1}}><label style={{fontSize:10,color:"#888"}}>指定門市</label><select value={newAnn.store_id||""} onChange={e=>setNewAnn({...newAnn,store_id:e.target.value||null})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}><option value="">全部門市</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div style={{flex:1}}><label style={{fontSize:10,color:"#888"}}>優先級</label><select value={newAnn.priority} onChange={e=>setNewAnn({...newAnn,priority:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}><option value="normal">一般</option><option value="urgent">🔴急件</option></select></div>
          </div>
          <button onClick={addAnn} disabled={!newAnn.title||!newAnn.content} style={{padding:"5px 14px",borderRadius:4,border:"none",background:newAnn.title&&newAnn.content?"#0a7c42":"#ccc",color:"#fff",fontSize:11,cursor:"pointer"}}>發布</button>
        </div>}
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>{anns.length===0?<div style={{padding:30,textAlign:"center",color:"#ccc"}}>尚無公告</div>:anns.map(a=><div key={a.id} style={{padding:10,borderBottom:"1px solid #f0eeea",display:"flex",gap:8,alignItems:"flex-start"}}>
          <div style={{flex:1}}>{a.priority==="urgent"&&<span style={{background:"#b91c1c",color:"#fff",padding:"1px 5px",borderRadius:3,fontSize:9,marginRight:4}}>急</span>}{a.store_id&&<span style={{background:"#e6f1fb",color:"#185fa5",padding:"1px 5px",borderRadius:3,fontSize:9,marginRight:4}}>{stores.find(s=>s.id===a.store_id)?.name||"指定門市"}</span>}<b style={{fontSize:13}}>{a.title}</b><p style={{fontSize:12,color:"#555",marginTop:3}}>{a.content}</p><span style={{fontSize:10,color:"#aaa"}}>{new Date(a.created_at).toLocaleDateString("zh-TW")}</span></div>
          <button onClick={()=>delAnn(a.id)} style={{padding:"2px 6px",borderRadius:3,border:"1px solid #ddd",background:"transparent",cursor:"pointer",fontSize:10,color:"#b91c1c"}}>🗑</button>
        </div>)}</div>
      </div>}

      {/* 設定 */}
      {!ld&&tab==="settings"&&<div style={{maxWidth:400}}><div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12}}><h3 style={{fontSize:13,fontWeight:500,marginBottom:8}}>⚙️ 打卡設定</h3>{[["late_grace_minutes","遲到寬限(分)"],["late_threshold_minutes","嚴重遲到(分)"],["early_leave_minutes","早退(分)"],["overtime_min_minutes","加班最低(分)"],["work_hours_per_day","每日工時"],["work_hours_per_week","每週工時"]].map(([k,l])=><div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #f0eeea"}}><span style={{fontSize:12}}>{l}</span><input type="number" value={as2[k]??""} onChange={e=>upS(k,Number(e.target.value))} style={{width:50,padding:3,borderRadius:4,border:"1px solid #ddd",textAlign:"center",fontSize:12}}/></div>)}</div></div>}

      {/* 日結 */}
      {!ld&&tab==="settlements"&&<div><div style={{display:"flex",gap:6,marginBottom:8}}><div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 12px",flex:1}}><div style={{fontSize:10,color:"#888"}}>淨額</div><div style={{fontSize:16,fontWeight:600,color:"#0a7c42"}}>{fmt(sum.total_net_sales)}</div></div><div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 12px",flex:1}}><div style={{fontSize:10,color:"#888"}}>應存</div><div style={{fontSize:16,fontWeight:600,color:"#b45309"}}>{fmt(sum.total_cash_to_deposit)}</div></div></div><div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:"#faf8f5",borderBottom:"1px solid #e8e6e1"}}>{["日期","門市","淨額","現金","應存","📷"].map(h=><th key={h} style={{padding:"6px 4px",textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead><tbody>{stl.map(s=><tr key={s.id} style={{borderBottom:"1px solid #f0eeea"}}><td style={{padding:"6px 4px"}}>{s.date}</td><td style={{padding:"6px 4px",fontWeight:500}}>{s.stores?.name}</td><td style={{padding:"6px 4px",color:"#0a7c42",fontWeight:600}}>{fmt(s.net_sales)}</td><td style={{padding:"6px 4px"}}>{fmt(s.cash_amount)}</td><td style={{padding:"6px 4px",color:"#b45309"}}>{fmt(s.cash_to_deposit)}</td><td style={{padding:"6px 4px"}}>{s.image_url&&<button onClick={()=>setSi(s.image_url)} style={{padding:"1px 4px",borderRadius:3,border:"1px solid #ddd",background:"transparent",cursor:"pointer",fontSize:9}}>📷</button>}</td></tr>)}</tbody></table></div></div>}

      {/* 存款 */}
      {!ld&&tab==="deposits"&&<div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:"#faf8f5",borderBottom:"1px solid #e8e6e1"}}>{["日期","門市","金額","應存","差異","狀態"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead><tbody>{dep.map(d=><tr key={d.id} style={{borderBottom:"1px solid #f0eeea"}}><td style={{padding:6}}>{d.deposit_date}</td><td style={{padding:6,fontWeight:500}}>{d.stores?.name}</td><td style={{padding:6,fontWeight:600}}>{fmt(d.amount)}</td><td style={{padding:6}}>{fmt(d.expected_cash)}</td><td style={{padding:6,color:Math.abs(d.difference)<=500?"#0a7c42":"#b91c1c"}}>{d.difference>=0?"+":""}{fmt(d.difference)}</td><td style={{padding:6}}><Badge status={d.status}/></td></tr>)}</tbody></table></div>}

      {/* 員工管理 */}
      {!ld&&tab==="employees"&&<div>
        {/* 待啟用 */}
        {pendingEmps.length>0&&<div style={{background:"#fff8e6",borderRadius:8,padding:10,marginBottom:10}}>
          <h3 style={{fontSize:13,fontWeight:500,marginBottom:6}}>⏳ 待啟用帳號（{pendingEmps.length}）</h3>
          {pendingEmps.map(e=><div key={e.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:"1px solid #f0eeea",fontSize:12,flexWrap:"wrap"}}>
            <b style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>setDetailId(e.id)}>{e.name}</b>
            <span style={{color:"#888"}}>{e.stores?.name||"總部"}</span>
            <span style={{fontSize:10,color:"#888"}}>{e.phone} {e.email}</span>
            <span style={{fontSize:10}}>{e.contract_signed?"📋✅":"📋❌"}</span>
            <button onClick={()=>activate(e.id)} style={{marginLeft:"auto",padding:"4px 12px",borderRadius:5,border:"none",background:"#0a7c42",color:"#fff",fontSize:11,cursor:"pointer"}}>✅ 啟用帳號</button>
          </div>)}
        </div>}

        <button onClick={()=>{setSaf(!saf);setNbc(null);}} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:saf?"#f0f0f0":"#1a1a1a",color:saf?"#666":"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>{saf?"✕":"＋新增"}</button>
        {saf&&<div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12,marginBottom:8}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
          <div><label style={{fontSize:10,color:"#888"}}>姓名*</label><input value={ne.name} onChange={e=>setNe({...ne,name:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}/></div>
          <div><label style={{fontSize:10,color:"#888"}}>手機*</label><input value={ne.phone} onChange={e=>setNe({...ne,phone:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}/></div>
          <div><label style={{fontSize:10,color:"#888"}}>Email*</label><input value={ne.email} onChange={e=>setNe({...ne,email:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}/></div>
          <div><label style={{fontSize:10,color:"#888"}}>門市</label><select value={ne.store_id} onChange={e=>setNe({...ne,store_id:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}><option value="">總部</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label style={{fontSize:10,color:"#888"}}>角色</label><select value={ne.role} onChange={e=>setNe({...ne,role:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}><option value="staff">員工</option><option value="store_manager">門店主管</option><option value="manager">管理</option><option value="admin">總部</option></select></div>
          <div><label style={{fontSize:10,color:"#888"}}>類型</label><select value={ne.employment_type} onChange={e=>setNe({...ne,employment_type:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}><option value="regular">一般</option><option value="parttime">兼職</option></select></div>
        </div><button onClick={addEmp} disabled={!ne.name||!ne.phone} style={{padding:"4px 14px",borderRadius:4,border:"none",background:ne.name&&ne.phone?"#0a7c42":"#ccc",color:"#fff",fontSize:11,cursor:"pointer"}}>建立</button>{nbc&&<div style={{marginTop:6,padding:6,background:"#e6f9f0",borderRadius:4,fontSize:11}}><b style={{color:"#0a7c42"}}>綁定碼：{nbc}</b> — 員工LINE輸入：綁定 {nbc}</div>}</div>}

        {/* 員工列表 */}
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:"#faf8f5",borderBottom:"1px solid #e8e6e1"}}>{["姓名","角色","門市","年資","特休","LINE","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
          <tbody>{emps.filter(e=>e.is_active).map(e=><tr key={e.id} style={{borderBottom:"1px solid #f0eeea"}}>
            <td style={{padding:6}}><span style={{fontWeight:500,cursor:"pointer",color:"#4361ee",textDecoration:"underline"}} onClick={()=>setDetailId(e.id)}>{e.name}</span></td>
            <td style={{padding:6}}><RB role={e.role}/></td>
            <td style={{padding:6}}>{e.stores?.name||"總部"}</td>
            <td style={{padding:6,fontSize:10}}>{e.service_months||0}月</td>
            <td style={{padding:6,fontSize:10}}>{e.annual_leave_days||0}天</td>
            <td style={{padding:6}}>{e.line_uid?<span style={{color:"#0a7c42"}}>✅</span>:<span style={{fontSize:10}}>{e.bind_code||"未綁"}</span>}</td>
            <td style={{padding:6,display:"flex",gap:2}}>{!e.line_uid&&<button onClick={()=>regen(e.id)} style={{padding:"1px 5px",borderRadius:3,border:"1px solid #ddd",background:"transparent",cursor:"pointer",fontSize:9}}>🔄</button>}<button onClick={()=>deactivate(e.id)} style={{padding:"1px 5px",borderRadius:3,border:"1px solid #ddd",background:"transparent",cursor:"pointer",fontSize:9,color:"#b91c1c"}}>停用</button></td>
          </tr>)}</tbody></table></div>
      </div>}
    </div>

    {/* 員工詳情彈窗 */}
    {detailId&&<EmpDetail empId={detailId} onClose={()=>{setDetailId(null);load();}}/>}

    {si&&<div onClick={()=>setSi(null)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9998,cursor:"pointer",padding:12}}><img src={si} alt="" style={{maxWidth:"90vw",maxHeight:"85vh",borderRadius:8}}/></div>}
  </div>);
}
