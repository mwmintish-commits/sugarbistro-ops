"use client";
import { useState, useEffect, useRef } from "react";

const STEPS = ["基本資料","文件上傳","員工守則","獎金制度","工作合約"];
const ap = async (url, body) => { const opts = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}; return fetch(url, opts).then(r => r.json()); };

const FALLBACK_HB = [
  { title: "一、出勤、排班與請假", items: ["準時上班：應提前5分鐘到崗。","依公司系統進行上下班打卡，不得代打。","不得無故曠職，第一次書面警告，第二次得解僱。","事假、病假至少提前4小時通知主管。"] },
  { title: "二、儀容與服裝規定", items: ["穿著公司制服保持整潔。","操作食物時全程佩戴圍裙。","穿著防滑包趾鞋。","長髮必須紮起，指甲保持短乾淨。"] },
  { title: "三、食品衛生安全【最高優先】", items: ["接觸食品前洗手至少20秒。","手套破損立即更換。","冷藏7°C以下，冷凍-18°C以下。","生熟食分開，嚴禁交叉污染。"] },
  { title: "四、服務態度", items: ["微笑服務，稱謂使用「您」。","投訴保持冷靜傾聽，超出能力通知主管。"] },
  { title: "五、金錢誠信【零容忍】", items: ["收款必須依POS系統。","折扣免單退款需主管授權。","竊盜舞弊偽造一律解僱追訴。"] },
  { title: "六、違規等級", items: ["▲輕微→口頭警告","■中度→書面警告+考核扣分","●嚴重→停職或解僱","◆零容忍→立即解僱+法律追訴"] },
];

const FALLBACK_CONTRACT = "一、乙方同意遵守甲方之員工行為規範與工作守則。\n二、乙方了解並同意季績效獎金制度之計算方式與發放條件。\n三、乙方之薪資、工時、休假依勞動基準法及甲方規定辦理。\n四、乙方同意甲方依法代扣勞健保及所得稅。\n五、乙方應對甲方之營業秘密負保密義務，離職後仍有效。\n六、任一方得依勞動基準法規定終止本合約。\n七、本合約自到職日起生效。\n八、本合約一式兩份，甲乙雙方各執一份為憑。";

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [ld, setLd] = useState(true);
  const [err, setErr] = useState("");
  const [rec, setRec] = useState(null);
  const [tk, setTk] = useState("");
  const [handbook, setHandbook] = useState([]);
  const [contractText, setContractText] = useState(FALLBACK_CONTRACT);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    signature_name: "", phone: "", email: "", birthday: "", id_number: "",
    address: "", emergency_contact: "", emergency_phone: "", emergency_relation: "",
    bank_name: "", bank_account: ""
  });
  const [files, setFiles] = useState({ id_front: null, id_back: null, health_check: null });
  const [agreed, setAgreed] = useState({ handbook: false, bonus: false, contract: false });
  const [sigs, setSigs] = useState({ handbook: null, contract: null });
  const [sub, setSub] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || params.get("bind_code");
    if (!t) { setErr("缺少報到連結"); setLd(false); return; }
    setTk(t);
    Promise.all([
      fetch("/api/onboarding?token=" + t).then(r => r.json()),
      ap("/api/admin/system?key=handbook"),
      ap("/api/admin/system?key=contract"),
    ]).then(([d, hbData, ctData]) => {
      if (d.error) setErr(d.error);
      else {
        setRec(d.data);
        if (d.data?.contract_signed) setDone(true);
        setForm(f => ({ ...f, signature_name: d.data?.name || "", phone: d.data?.phone || "", email: d.data?.email || "" }));
      }
      if (hbData.data && Array.isArray(hbData.data) && hbData.data.length > 0) setHandbook(hbData.data);
      else setHandbook(FALLBACK_HB);
      if (ctData.data) setContractText(ctData.data);
      setLd(false);
    }).catch(() => { setErr("載入失敗"); setLd(false); });
  }, []);

  const f2b = (file) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });

  const goNext = async () => {
    setErr("");
    if (step === 0) {
      const req = ["signature_name","phone","id_number","birthday","address","emergency_contact","emergency_phone","bank_name","bank_account"];
      if (req.some(k => !form[k])) { setErr("請填寫所有必填欄位"); return; }
    }
    if (step === 1) {
      if (!files.health_check) { setErr("請上傳體檢表"); return; }
      if (!files.id_front) { setErr("請上傳身分證正面"); return; }
      if (!files.id_back) { setErr("請上傳身分證反面"); return; }
    }
    if (step === 2) { if (!agreed.handbook || !sigs.handbook) { setErr("請勾選同意並簽名"); return; } }
    if (step === 3) { if (!agreed.bonus) { setErr("請勾選確認已了解"); return; } }
    if (step === 4) {
      if (!agreed.contract || !sigs.contract) { setErr("請勾選同意並簽名"); return; }
      setSub(true);
      const r = await ap("/api/onboarding", {
        action: "complete", token: tk, ...form,
        health_check_url: files.health_check,
        id_front_url: files.id_front, id_back_url: files.id_back,
        handbook_signature: sigs.handbook, contract_signature: sigs.contract,
        handbook_content: handbook, contract_content: contractText,
      });
      if (r.success) setDone(true); else setErr(r.error || "提交失敗");
      setSub(false); return;
    }
    setStep(step + 1);
  };

  if (ld) return <Box><C><p>載入中...</p></C></Box>;
  if (done) return <Box><C>
    <div style={{fontSize:48,marginBottom:12}}>✅</div>
    <h1 style={{fontSize:20,fontWeight:600,marginBottom:8}}>報到完成！</h1>
    <p style={{fontSize:14,color:"#666"}}>所有文件已簽署存檔，可以開始打卡了。</p>
    <p style={{fontSize:12,color:"#999",marginTop:6}}>合約副本已寄至你的 Email</p>
  </C></Box>;
  if (err && !rec) return <Box><C><p style={{color:"#b91c1c"}}>{err}</p></C></Box>;

  return (
    <Box>
      <div style={{textAlign:"center",padding:"10px 0 6px"}}>
        <div style={{fontSize:28}}>🍯</div>
        <h1 style={{fontSize:16,fontWeight:600}}>小食糖 新人報到</h1>
        <p style={{fontSize:11,color:"#999"}}>{"👤 "+(rec?.name||"")+"｜🏠 "+(rec?.store_name||"")}</p>
      </div>
      <div style={{display:"flex",gap:2,margin:"8px 0 12px"}}>
        {STEPS.map((s,i)=><div key={i} style={{flex:1,textAlign:"center"}}>
          <div style={{height:4,borderRadius:2,background:i<=step?"#0a7c42":"#e8e6e1",marginBottom:2}} />
          <div style={{fontSize:8,color:i===step?"#0a7c42":"#aaa"}}>{(i+1)+". "+s}</div>
        </div>)}
      </div>
      {err && <div style={{background:"#fde8e8",color:"#b91c1c",padding:8,borderRadius:6,fontSize:12,marginBottom:8}}>{err}</div>}

      {/* Step 0: 基本資料 */}
      {step===0 && <Card title="📋 基本資料">
        <Grid>
          <F l="姓名" v={form.signature_name} c={v=>setForm({...form,signature_name:v})} r />
          <F l="生日" v={form.birthday} c={v=>setForm({...form,birthday:v})} t="date" r />
          <F l="身分證字號" v={form.id_number} c={v=>setForm({...form,id_number:v})} r />
          <F l="手機" v={form.phone} c={v=>setForm({...form,phone:v})} t="tel" r />
          <Full><F l="戶籍地址" v={form.address} c={v=>setForm({...form,address:v})} r /></Full>
          <F l="Email" v={form.email} c={v=>setForm({...form,email:v})} t="email" />
          <F l="緊急聯絡人" v={form.emergency_contact} c={v=>setForm({...form,emergency_contact:v})} r />
          <F l="關係" v={form.emergency_relation} c={v=>setForm({...form,emergency_relation:v})} p="父/母/配偶" />
          <Full><F l="緊急聯絡電話" v={form.emergency_phone} c={v=>setForm({...form,emergency_phone:v})} t="tel" r /></Full>
          <F l="銀行名稱" v={form.bank_name} c={v=>setForm({...form,bank_name:v})} p="中國信託" r />
          <F l="銀行帳號" v={form.bank_account} c={v=>setForm({...form,bank_account:v})} r />
        </Grid>
      </Card>}

      {/* Step 1: 文件上傳（身分證正反面分開） */}
      {step===1 && <Card title="📄 必要文件上傳">
        <Up label="🏥 體檢表" desc="近三個月內有效" file={files.health_check} onFile={async f=>{setFiles({...files,health_check:await f2b(f)});}} />
        <p style={{fontSize:11,fontWeight:600,color:"#333",margin:"8px 0 4px"}}>🪪 身分證（正反面分開上傳）</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Up label="正面" desc="有照片那面" file={files.id_front} onFile={async f=>{setFiles({...files,id_front:await f2b(f)});}} small />
          <Up label="反面" desc="有地址那面" file={files.id_back} onFile={async f=>{setFiles({...files,id_back:await f2b(f)});}} small />
        </div>
        <p style={{fontSize:9,color:"#888",marginTop:6}}>請拍攝清晰照片，檔案將存檔於後台以便日後查閱列印</p>
      </Card>}

      {/* Step 2: 員工守則（完整顯示） */}
      {step===2 && <>
        <div style={{background:"#fff",borderRadius:10,border:"1px solid #e8e6e1",padding:14,marginBottom:10,maxHeight:400,overflowY:"auto"}}>
          <h3 style={{fontSize:14,fontWeight:600,marginBottom:4,textAlign:"center"}}>📖 員工行為規範與工作守則</h3>
          <p style={{fontSize:10,color:"#888",textAlign:"center",marginBottom:10}}>小食糖 SUGARbISTRO｜到職日起即受本規範約束</p>
          {handbook.map((ch,i)=><div key={i} style={{marginBottom:10}}>
            <h4 style={{fontSize:12,fontWeight:600,padding:"4px 8px",borderRadius:4,background:(ch.title||"").includes("零容忍")||(ch.title||"").includes("最高")?"#fde8e8":"#faf8f5",color:(ch.title||"").includes("零容忍")||(ch.title||"").includes("最高")?"#b91c1c":"#333",marginBottom:4}}>{ch.title}</h4>
            {(ch.items||[]).map((item,j)=><div key={j} style={{fontSize:11,lineHeight:1.8,color:"#444",paddingLeft:10}}>{"▸ "+item}</div>)}
          </div>)}
        </div>
        <Card title="">
          <label style={{display:"flex",gap:8,cursor:"pointer",marginBottom:10}}>
            <input type="checkbox" checked={agreed.handbook} onChange={e=>setAgreed({...agreed,handbook:e.target.checked})} style={{width:18,height:18,marginTop:2}} />
            <span style={{fontSize:12,lineHeight:1.6}}>本人已詳閱「員工行為規範與工作守則」全文並同意遵守</span>
          </label>
          <SigPad label="員工簽名" sig={sigs.handbook} onSign={d=>setSigs({...sigs,handbook:d})} />
        </Card>
      </>}

      {/* Step 3: 獎金制度（精簡版） */}
      {step===3 && <>
        <div style={{background:"#fff",borderRadius:10,border:"1px solid #e8e6e1",padding:14,marginBottom:10}}>
          <h3 style={{fontSize:14,fontWeight:600,marginBottom:8,textAlign:"center"}}>🏆 季績效獎金制度</h3>
          <Sec t="適用範圍" items={["本制度適用全體正式員工（試用期不納入），以季為單位計算並發放績效獎金。"]} />
          <Sec t="業績達標率" items={["各門市依每日營業目標計算月達標率，達標率85%以上方可發放獎金，120%以上額外加成。"]} />
          <Sec t="季末考核" items={["每季末進行個人考核（滿分100分），涵蓋出勤紀律、工作完成度、服務態度及違規紀錄。","考核80分以上全額發放，70~79分發放50%，未達70分取消資格。"]} />
          <Sec t="發放條件" items={["季度累計營收不得虧損。","發放日仍在職方可領取。","個人考核須達70分以上。"]} />
          <Sec t="法律聲明" items={["本獎金屬「恩惠性給與」，非勞動基準法所定之經常性薪資，不計入平均工資。","公司保有依營運狀況調整、暫停或終止本制度之最終裁量權。"]} warn />
        </div>
        <Card title="">
          <label style={{display:"flex",gap:8,cursor:"pointer"}}>
            <input type="checkbox" checked={agreed.bonus} onChange={e=>setAgreed({...agreed,bonus:e.target.checked})} style={{width:18,height:18,marginTop:2}} />
            <span style={{fontSize:12,lineHeight:1.6}}>本人已詳閱「季績效獎金制度」並了解相關發放條件</span>
          </label>
        </Card>
      </>}

      {/* Step 4: 工作合約（完整版，從設定讀取） */}
      {step===4 && <>
        <Card title="📝 工作合約">
          <div style={{fontSize:12,lineHeight:1.8,color:"#444"}}>
            <div style={{textAlign:"center",marginBottom:10}}>
              <b style={{fontSize:14}}>小食糖 SUGARbISTRO</b><br/>
              <span style={{fontSize:12,color:"#888"}}>勞動契約書</span>
            </div>
            <p><b>甲方（雇主）：</b>小食糖 SUGARbISTRO</p>
            <p><b>乙方（員工）：</b>{form.signature_name}</p>
            <p><b>身分證字號：</b>{form.id_number}</p>
            <p><b>服務門市：</b>{rec?.store_name}</p>
            <p><b>到職日期：</b>{rec?.hire_date||new Date().toLocaleDateString("sv-SE")}</p>
            <hr style={{margin:"10px 0",border:"none",borderTop:"1px solid #eee"}} />
            <p style={{fontWeight:600,marginBottom:6}}>雙方同意依下列條款訂定本勞動契約：</p>
            {contractText.split("\n").filter(Boolean).map((line,i)=><p key={i} style={{paddingLeft:4}}>{line}</p>)}
          </div>
        </Card>
        <div style={{background:"#fff",borderRadius:10,border:"2px solid #0a7c42",padding:14,marginBottom:10}}>
          <label style={{display:"flex",gap:8,cursor:"pointer",marginBottom:10}}>
            <input type="checkbox" checked={agreed.contract} onChange={e=>setAgreed({...agreed,contract:e.target.checked})} style={{width:18,height:18,marginTop:2}} />
            <span style={{fontSize:12,lineHeight:1.6}}>本人確認以上資料正確無誤，同意簽署工作合約</span>
          </label>
          <SigPad label="合約簽名" sig={sigs.contract} onSign={d=>setSigs({...sigs,contract:d})} />
        </div>
      </>}

      {!done && <div style={{display:"flex",gap:8,marginTop:4}}>
        {step>0 && <button onClick={()=>{setErr("");setStep(step-1);}} style={{flex:1,padding:12,borderRadius:10,border:"1px solid #ddd",background:"#fff",fontSize:14,cursor:"pointer"}}>←</button>}
        <button onClick={goNext} disabled={sub}
          style={{flex:2,padding:12,borderRadius:10,border:"none",background:sub?"#ccc":"#0a7c42",color:"#fff",fontSize:15,fontWeight:600,cursor:sub?"default":"pointer"}}>
          {sub?"提交中...":step===4?"✅ 確認簽署完成報到":"下一步 →"}
        </button>
      </div>}
    </Box>
  );
}

function F({l,v,c,t,p,r}){return <div style={{marginBottom:8}}><label style={{fontSize:11,color:"#888",display:"block",marginBottom:2}}>{l}{r&&<span style={{color:"#b91c1c"}}> *</span>}</label><input type={t||"text"} value={v} onChange={e=>c(e.target.value)} placeholder={p||""} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #ddd",fontSize:13}} /></div>;}
function Card({title,children}){return <div style={{background:"#fff",borderRadius:10,border:"1px solid #e8e6e1",padding:14,marginBottom:10}}>{title&&<h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>{title}</h3>}{children}</div>;}
function Grid({children}){return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 8px"}}>{children}</div>;}
function Full({children}){return <div style={{gridColumn:"1/-1"}}>{children}</div>;}
function Sec({t,items,warn}){return <div style={{marginBottom:8}}><h4 style={{fontSize:12,fontWeight:600,padding:"3px 6px",borderRadius:4,background:warn?"#fde8e8":"#faf8f5",color:warn?"#b91c1c":"#333",marginBottom:3}}>{t}</h4>{items.map((i,j)=><div key={j} style={{fontSize:11,lineHeight:1.7,color:"#555",paddingLeft:8}}>{"▸ "+i}</div>)}</div>;}

function Up({label,desc,file,onFile,small}){const ref=useRef();return <div onClick={()=>ref.current?.click()} style={{border:"2px dashed "+(file?"#0a7c42":"#ddd"),borderRadius:10,padding:small?10:16,textAlign:"center",marginBottom:small?0:10,background:file?"#e6f9f0":"#faf8f5",cursor:"pointer"}}><input ref={ref} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onFile(e.target.files[0]);}} /><div style={{fontSize:small?20:28}}>{file?"✅":"📄"}</div><div style={{fontSize:small?11:13,fontWeight:600,marginTop:2}}>{label}</div><div style={{fontSize:small?8:10,color:"#888"}}>{file?"已上傳（點擊更換）":desc}</div></div>;}

function SigPad({label,sig,onSign}){
  const ref=useRef(null);const[dr,setDr]=useState(false);
  const gp=e=>{const r=ref.current.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return{x:t.clientX-r.left,y:t.clientY-r.top};};
  const start=e=>{e.preventDefault();setDr(true);const ctx=ref.current.getContext("2d");const p=gp(e);ctx.beginPath();ctx.moveTo(p.x,p.y);};
  const draw=e=>{if(!dr)return;e.preventDefault();const ctx=ref.current.getContext("2d");const p=gp(e);ctx.lineTo(p.x,p.y);ctx.strokeStyle="#1a1a1a";ctx.lineWidth=2;ctx.lineCap="round";ctx.stroke();};
  const end=()=>{setDr(false);if(ref.current)onSign(ref.current.toDataURL());};
  const clear=()=>{ref.current.getContext("2d").clearRect(0,0,300,100);onSign(null);};
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
      <span style={{fontSize:11,color:"#888"}}>{label}</span>
      <button onClick={clear} type="button" style={{fontSize:10,color:"#4361ee",background:"none",border:"none",cursor:"pointer"}}>清除重簽</button>
    </div>
    <canvas ref={ref} width={300} height={100} style={{width:"100%",height:100,border:"1px solid "+(sig?"#0a7c42":"#ddd"),borderRadius:8,background:"#fff",touchAction:"none"}}
      onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
      onTouchStart={start} onTouchMove={draw} onTouchEnd={end} />
    {sig && <div style={{fontSize:10,color:"#0a7c42",marginTop:2}}>✅ 已簽名</div>}
  </div>;
}

function Box({children}){return <div style={{maxWidth:460,margin:"0 auto",padding:"14px 10px",fontFamily:"system-ui,'Noto Sans TC',sans-serif",background:"#faf8f5",minHeight:"100vh"}}>{children}</div>;}
function C({children}){return <div style={{minHeight:"60vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>{children}</div>;}
