"use client";
import { useState, useEffect, useRef } from "react";

const HB = [
  { t: "一、出勤、排班與請假", s: [
    { h: "1.1 基本出勤規定", i: ["準時上班：應提前5分鐘到崗。","依公司系統進行上下班打卡，不得代打。","不得無故曠職，第一次書面警告，第二次得解僱。"] },
    { h: "1.2 請假規定", i: ["事假、病假至少提前4小時通知主管。","病假超過3日須檢附醫院證明。","換班須提前告知主管並經書面同意。"] },
  ]},
  { t: "二、儀容與服裝規定", s: [
    { h: "2.1 服裝", i: ["穿著公司制服保持整潔。","操作食物時全程佩戴圍裙。","穿著防滑包趾鞋，禁止拖鞋涼鞋。"] },
    { h: "2.2 個人衛生", i: ["長髮必須紮起，接觸食品時配戴髮網。","指甲保持短乾淨，不得塗指甲油。","工作時禁止濃烈香水，不得有酒味。"] },
  ]},
  { t: "三、食品衛生安全規範【最高優先】", w: true, s: [
    { h: "3.1 個人衛生", i: ["接觸食品前、如廁後洗手至少20秒。","手套破損立即更換。","身體不適須立即告知主管。"] },
    { h: "3.2 食材保存", i: ["冷藏7°C以下，冷凍-18°C以下。","食材標示日期效期，超期禁用。","生熟食分開，嚴禁交叉污染。"] },
  ]},
  { t: "四、服務態度與顧客應對", s: [
    { h: "", i: ["面對顧客主動親切微笑服務，稱「您」。","接待時禁止滑手機嬉鬧。","投訴保持冷靜傾聽，超出能力通知主管。"] },
  ]},
  { t: "五、金錢與財務誠信【零容忍】", w: true, s: [
    { h: "", i: ["收款必須依POS系統操作。","折扣免單退款需主管授權。","公司財物不得私自挪用帶離。","竊盜舞弊偽造一律解僱追訴。"] },
  ]},
  { t: "六、手機與社群媒體", s: [
    { h: "", i: ["工作期間禁止於服務區使用手機。","禁止發布門市內部照片影片。","禁止發布對公司同事顧客的負面評論。"] },
  ]},
  { t: "七、職場環境", s: [
    { h: "", i: ["禁止霸凌歧視性騷擾。","禁止洩露配方成本供應商營業數據。","設備異常立即停止使用通報。"] },
  ]},
  { t: "八、違規等級", s: [
    { h: "", i: ["▲輕微→口頭警告","■中度→書面警告+季考核扣分","●嚴重→停職或解僱","◆零容忍→立即解僱+法律追訴","書面警告累積3次得依勞基法解僱"] },
  ]},
  { t: "九、申訴舉報", s: [{ h: "", i: ["向主管書面申訴5個工作日回覆。","涉及主管可直接向總部提出。","公司禁止任何報復行為。"] }]},
  { t: "十、生效簽署", s: [{ h: "", i: ["本規範自2026年起施行，到職時須簽署確認。","公司保有隨時修訂之權利。"] }]},
];

export default function Page() {
  const[tk,setTk]=useState(null);const[rec,setRec]=useState(null);const[ld,setLd]=useState(true);const[err,setErr]=useState(null);
  const[form,setForm]=useState({signature_name:"",birthday:"",id_number:"",phone:"",email:"",emergency_contact:"",emergency_phone:"",emergency_relation:""});
  const[agreed,setAgreed]=useState(false);const[sub,setSub]=useState(false);const[done,setDone]=useState(false);const[scrolled,setScrolled]=useState(false);
  const bRef=useRef(null);

  useEffect(()=>{const t=new URLSearchParams(window.location.search).get("token");if(!t){setErr("缺少Token");setLd(false);return;}setTk(t);fetch(`/api/onboarding?token=${t}`).then(r=>r.json()).then(d=>{if(d.error)setErr(d.error);else{setRec(d.data);if(d.data.status==="signed")setDone(true);}setLd(false);}).catch(()=>{setErr("載入失敗");setLd(false);});},[]);
  useEffect(()=>{const ob=new IntersectionObserver(([e])=>{if(e.isIntersecting)setScrolled(true);},{threshold:0.5});if(bRef.current)ob.observe(bRef.current);return()=>ob.disconnect();},[rec]);

  const canSubmit=scrolled&&form.signature_name&&form.phone&&form.id_number&&form.email&&form.birthday&&form.emergency_contact&&form.emergency_phone&&form.emergency_relation&&agreed;

  const submit=async()=>{setSub(true);const r=await fetch("/api/onboarding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"sign",token:tk,...form})});const d=await r.json();if(d.success)setDone(true);else setErr(d.error);setSub(false);};
  const F=(k,l,t,p,req)=><div style={{marginBottom:8}}><label style={{fontSize:11,color:"#888",display:"block",marginBottom:2}}>{l}{req&&<span style={{color:"#b91c1c"}}> *</span>}</label><input type={t||"text"} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={p||""} disabled={!scrolled} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid #ddd",fontSize:14}}/></div>;

  if(ld)return<div style={S.c}>載入中...</div>;
  if(done)return<div style={S.box}><div style={S.c}><div style={{fontSize:48,marginBottom:12}}>✅</div><h1 style={{fontSize:20,fontWeight:600,marginBottom:8}}>報到完成！</h1><p style={{fontSize:14,color:"#666"}}>合約副本已寄至你的 Email</p><p style={{fontSize:13,color:"#999",marginTop:8}}>⏳ 請等待總部核發帳號權限</p></div></div>;

  return(<div style={S.box}>
    <div style={{textAlign:"center",padding:"16px 0",marginBottom:12}}>
      <div style={{fontSize:32,marginBottom:6}}>🍯</div>
      <h1 style={{fontSize:17,fontWeight:600}}>小食糖 SUGARbISTRO</h1>
      <h2 style={{fontSize:13,color:"#666",marginTop:4}}>新人報到 ─ 員工守則與個資填寫</h2>
      <p style={{fontSize:12,color:"#999",marginTop:6}}>👤 {rec?.name}｜🏠 {rec?.store_name}</p>
    </div>
    {err&&<div style={{background:"#fde8e8",color:"#b91c1c",padding:8,borderRadius:6,fontSize:12,marginBottom:10}}>{err}</div>}

    <div style={{background:"#fff",borderRadius:10,border:"1px solid #e8e6e1",padding:"14px 12px",marginBottom:12}}>
      <p style={{fontSize:12,lineHeight:1.8,color:"#444",marginBottom:12}}>本守則為全體同仁共同承諾，<b>到職日起即受本規範約束</b>。</p>
      {HB.map((ch,ci)=><div key={ci} style={{marginBottom:14}}>
        <h3 style={{fontSize:12,fontWeight:600,padding:"5px 8px",borderRadius:5,background:ch.w?"#fde8e8":"#faf8f5",color:ch.w?"#b91c1c":"#1a1a1a",marginBottom:5}}>{ch.t}</h3>
        {ch.s.map((sec,si)=><div key={si} style={{paddingLeft:4,marginBottom:6}}>
          {sec.h&&<h4 style={{fontSize:11,fontWeight:500,color:"#444",marginBottom:3}}>{sec.h}</h4>}
          {sec.i.map((item,ii)=><div key={ii} style={{fontSize:11,lineHeight:1.7,color:"#555",paddingLeft:8}}>▸ {item}</div>)}
        </div>)}
      </div>)}
      <div ref={bRef} style={{height:1}}/>
    </div>

    <div style={{background:"#fff",borderRadius:10,border:"1px solid #e8e6e1",padding:"14px 12px",marginBottom:12,opacity:scrolled?1:0.4,transition:"opacity .3s"}}>
      <h3 style={{fontSize:13,fontWeight:600,marginBottom:10}}>📋 基本資料填寫</h3>
      {!scrolled&&<p style={{fontSize:11,color:"#b45309",marginBottom:6}}>⬇ 請先閱讀完守則</p>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 8px"}}>
        {F("signature_name","姓名（全名）","text","",true)}
        {F("birthday","生日","date","",true)}
        {F("id_number","身分證字號","text","A123456789",true)}
        {F("phone","手機號碼","tel","0912345678",true)}
        {F("email","Email","email","name@email.com",true)}
        {F("emergency_contact","緊急聯絡人","text","",true)}
        {F("emergency_phone","緊急聯絡電話","tel","",true)}
        {F("emergency_relation","關係","text","父/母/配偶",true)}
      </div>
    </div>

    <div style={{background:"#fff",borderRadius:10,border:scrolled?"2px solid #0a7c42":"1px solid #e8e6e1",padding:"14px 12px",opacity:scrolled?1:0.4,transition:"all .3s"}}>
      <h3 style={{fontSize:13,fontWeight:600,marginBottom:10,textAlign:"center"}}>📝 電子簽署</h3>
      <label style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:12,cursor:scrolled?"pointer":"default"}}>
        <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} disabled={!scrolled} style={{marginTop:2,width:16,height:16}}/>
        <span style={{fontSize:11,lineHeight:1.6,color:"#444"}}>本人已詳閱「小食糖員工行為規範與工作守則」全文並同意遵守。本人所填寫之個人資料均為真實正確。</span>
      </label>
      <button onClick={submit} disabled={!canSubmit||sub}
        style={{width:"100%",padding:"12px",borderRadius:10,border:"none",fontSize:15,fontWeight:600,cursor:canSubmit?"pointer":"default",background:canSubmit&&!sub?"#0a7c42":"#ccc",color:"#fff"}}>
        {sub?"簽署中...":"✅ 確認簽署並完成報到"}
      </button>
      <p style={{fontSize:10,color:"#999",textAlign:"center",marginTop:6}}>簽署後合約副本將寄至你的 Email</p>
    </div>
  </div>);
}
const S={box:{maxWidth:460,margin:"0 auto",padding:"14px 10px",fontFamily:"system-ui,'Noto Sans TC',sans-serif",background:"#faf8f5",minHeight:"100vh"},c:{minHeight:"60vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}};
