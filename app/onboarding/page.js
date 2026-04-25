"use client";
import { useState, useEffect, useRef } from "react";
import { BONUS_SECTION } from "@/lib/bonus-terms";

const STEPS = ["基本資料","文件上傳","員工守則暨福利","工作合約"];
const ap = async (url, body) => { const opts = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}; return fetch(url, opts).then(r => r.json()); };

const FALLBACK_HB = [
  { title: "一、出勤、排班與請假", items: ["準時上班：應提前5分鐘到崗。","依公司系統進行上下班打卡，不得代打。","不得無故曠職，第一次書面警告，第二次得解僱。","事假、病假至少提前4小時通知主管。"] },
  { title: "二、儀容與服裝規定", items: ["穿著公司制服保持整潔。","操作食物時全程佩戴圍裙。","穿著防滑包趾鞋。","長髮必須紮起，指甲保持短乾淨。"] },
  { title: "三、食品衛生安全【最高優先】", items: ["接觸食品前洗手至少20秒。","手套破損立即更換。","冷藏7°C以下，冷凍-18°C以下。","生熟食分開，嚴禁交叉污染。"] },
  { title: "四、服務態度", items: ["微笑服務，稱謂使用「您」。","投訴保持冷靜傾聽，超出能力通知主管。"] },
  { title: "五、金錢誠信【零容忍】", items: ["收款必須依POS系統。","折扣免單退款需主管授權。","竊盜舞弊偽造一律解僱追訴。"] },
  { title: "六、違規等級", items: ["▲輕微→口頭警告","■中度→書面警告+考核扣分","●嚴重→停職或解僱","◆零容忍→立即解僱+法律追訴"] },
];

const FALLBACK_CONTRACT = "一、薪資、工時、休假依勞動基準法及甲方規定辦理。\n二、甲方依法代扣勞工保險、全民健康保險及所得稅。\n三、任一方得依勞動基準法規定終止本合約；乙方離職應依規定辦理交接。\n四、本合約自到職日起生效，未盡事宜依勞動基準法及相關法令辦理。\n五、本合約一式兩份，甲乙雙方各執一份為憑。";

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [ld, setLd] = useState(true);
  const [err, setErr] = useState("");
  const [rec, setRec] = useState(null);
  const [tk, setTk] = useState("");
  const [handbook, setHandbook] = useState([]);
  const [bonusSec, setBonusSec] = useState(BONUS_SECTION);
  const [contractText, setContractText] = useState(FALLBACK_CONTRACT);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    signature_name: "", phone: "", email: "", birthday: "", id_number: "",
    address: "", emergency_contact: "", emergency_phone: "", emergency_relation: "",
    bank_name: "", bank_account: ""
  });
  const [files, setFiles] = useState({ id_front: null, id_back: null, health_check: null });
  const [agreed, setAgreed] = useState({ handbook: false, contract: false });
  const [sigs, setSigs] = useState({ contract: null });
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
      ap("/api/admin/system?key=bonus_terms"),
    ]).then(([d, hbData, ctData, btData]) => {
      if (d.error) setErr(d.error);
      else {
        setRec(d.data);
        if (d.data?.contract_signed) setDone(true);
        setForm(f => ({ ...f, signature_name: d.data?.name || "", phone: d.data?.phone || "", email: d.data?.email || "" }));
      }
      const hbVal = hbData.data?.value;
      const ctVal = ctData.data?.value;
      const btVal = btData.data?.value;
      if (Array.isArray(hbVal) && hbVal.length > 0) setHandbook(hbVal);
      else setHandbook(FALLBACK_HB);
      if (typeof ctVal === "string" && ctVal) setContractText(ctVal);
      if (btVal && btVal.title && Array.isArray(btVal.items)) setBonusSec(btVal);
      setLd(false);
    }).catch(() => { setErr("載入失敗"); setLd(false); });
  }, []);

  const f2b = (file) => new Promise((res) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 1200;
        let w = img.width, h = img.height;
        if (w > max) { h = h * max / w; w = max; }
        if (h > max) { w = w * max / h; h = max; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        res(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  const goNext = async () => {
    setErr("");
    if (step === 0) {
      const req = ["signature_name","phone","id_number","birthday","address","emergency_contact","emergency_phone","bank_name","bank_account"];
      if (req.some(k => !form[k])) { setErr("請填寫所有必填欄位"); return; }
    }
    if (step === 1) {
      // 體檢表/身分證為選填，可稍後補上傳
    }
    if (step === 2) { if (!agreed.handbook) { setErr("請勾選同意已詳閱守則暨福利條款"); return; } }
    if (step === 3) {
      if (!agreed.contract || !sigs.contract) { setErr("請勾選同意並簽名"); return; }
      setSub(true);
      try {
        // 守則內容包含後台編輯版本 + 系統固定的獎金福利段落（單一來源）
        const fullHandbook = [...handbook, bonusSec];
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete", token: tk, employee_id: rec?.id,
            ...form,
            health_check_url: files.health_check,
            id_front_url: files.id_front, id_back_url: files.id_back,
            handbook_signature: null, contract_signature: sigs.contract,
            handbook_content: fullHandbook, contract_content: contractText,
          }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          alert("❌ 伺服器錯誤 " + res.status + "：" + txt.slice(0, 200));
          setSub(false); return;
        }
        const r = await res.json().catch(() => null);
        if (!r) { alert("❌ 回應格式錯誤"); setSub(false); return; }
        if (r.success) { setDone(true); } else { alert("❌ " + (r.error || "提交失敗")); setErr(r.error || "提交失敗"); }
      } catch (e) {
        alert("❌ 連線錯誤：" + e.message);
        setErr("連線錯誤：" + e.message);
      }
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
          <div style={{marginBottom:8}}>
            <label style={{fontSize:11,color:"#888",display:"block",marginBottom:2}}>銀行<span style={{color:"#b91c1c"}}> *</span></label>
            <select value={form.bank_name} onChange={e=>setForm({...form,bank_name:e.target.value})}
              style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
              <option value="">請選擇銀行</option>
              {[["004","臺灣銀行"],["005","土地銀行"],["006","合庫銀行"],["007","第一銀行"],["008","華南銀行"],["009","彰化銀行"],["011","上海銀行"],["012","台北富邦"],["013","國泰世華"],["017","兆豐銀行"],["021","花旗銀行"],["048","王道銀行"],["050","臺灣企銀"],["052","渣打銀行"],["053","台中銀行"],["081","匯豐銀行"],["103","新光銀行"],["108","陽信銀行"],["118","板信銀行"],["700","中華郵政"],["803","聯邦銀行"],["805","遠東銀行"],["806","元大銀行"],["807","永豐銀行"],["808","玉山銀行"],["809","凱基銀行"],["810","星展銀行"],["812","台新銀行"],["816","安泰銀行"],["822","中國信託"]].map(([code,name])=>(
                <option key={code} value={code+"-"+name}>{code+"-"+name}</option>
              ))}
            </select>
          </div>
          <F l="銀行帳號" v={form.bank_account} c={v=>setForm({...form,bank_account:v})} r />
        </Grid>
      </Card>}

      {/* Step 1: 文件上傳（選填，可稍後補） */}
      {step===1 && <Card title="📄 文件上傳（選填）">
        <div style={{background:"#fff8e6",borderRadius:8,padding:8,marginBottom:10,fontSize:10,color:"#8a6d00"}}>
          💡 可先跳過，稍後由主管在後台補上傳。<br/>
          📷 拍照建議：將文件平放在桌面，光線充足，避免反光。
        </div>
        <Up label="🏥 體檢表" desc="選填，近三個月內有效" file={files.health_check} onFile={async f=>{setFiles({...files,health_check:await f2b(f)});}} />
        <p style={{fontSize:11,fontWeight:600,color:"#333",margin:"8px 0 4px"}}>🪪 身分證（正反面分開上傳）</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Up label="正面" desc="選填" file={files.id_front} onFile={async f=>{setFiles({...files,id_front:await f2b(f)});}} small />
          <Up label="反面" desc="選填" file={files.id_back} onFile={async f=>{setFiles({...files,id_back:await f2b(f)});}} small />
        </div>
      </Card>}

      {/* Step 2: 員工守則暨福利（後台版本 + 系統固定獎金福利段落，僅勾選確認，不簽名） */}
      {step===2 && <>
        <div style={{background:"#fff",borderRadius:10,border:"1px solid #e8e6e1",padding:14,marginBottom:10,maxHeight:420,overflowY:"auto"}}>
          <h3 style={{fontSize:14,fontWeight:600,marginBottom:4,textAlign:"center"}}>📖 員工守則暨福利條款</h3>
          <p style={{fontSize:10,color:"#888",textAlign:"center",marginBottom:10}}>小食糖 SUGARbISTRO｜到職日起即受本規範約束</p>
          {[...handbook, bonusSec].map((ch,i)=><div key={i} style={{marginBottom:10}}>
            <h4 style={{fontSize:12,fontWeight:600,padding:"4px 8px",borderRadius:4,background:(ch.title||"").includes("零容忍")||(ch.title||"").includes("最高")?"#fde8e8":"#faf8f5",color:(ch.title||"").includes("零容忍")||(ch.title||"").includes("最高")?"#b91c1c":"#333",marginBottom:4}}>{ch.title}</h4>
            {(ch.items||[]).map((item,j)=><div key={j} style={{fontSize:11,lineHeight:1.8,color:"#444",paddingLeft:10}}>{"▸ "+item}</div>)}
          </div>)}
        </div>
        <Card title="">
          <label style={{display:"flex",gap:8,cursor:"pointer"}}>
            <input type="checkbox" checked={agreed.handbook} onChange={e=>setAgreed({...agreed,handbook:e.target.checked})} style={{width:18,height:18,marginTop:2}} />
            <span style={{fontSize:12,lineHeight:1.6}}>本人已詳閱「員工守則暨福利條款」全部內容（含獎金與福利說明），了解相關獎金與福利均屬恩惠性給與，公司保留調整與停發之裁量權，本人同意遵守。</span>
          </label>
          <p style={{fontSize:10,color:"#888",marginTop:8,lineHeight:1.5}}>※ 守則內容後台可隨時查閱，與簽署版本一致；正式簽名於下一步「工作合約」一併完成。</p>
        </Card>
      </>}

      {/* Step 3: 工作合約（唯一簽名） */}
      {step===3 && <>
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
          {sub?"提交中...":step===3?"✅ 確認簽署完成報到":"下一步 →"}
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

function Up({label,desc,file,onFile,small}){
  const camRef=useRef();const fileRef=useRef();
  return <div style={{border:"2px dashed "+(file?"#0a7c42":"#ddd"),borderRadius:10,padding:small?10:16,textAlign:"center",marginBottom:small?0:10,background:file?"#e6f9f0":"#faf8f5"}}>
    <input ref={camRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onFile(e.target.files[0]);e.target.value="";}} />
    <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onFile(e.target.files[0]);e.target.value="";}} />
    <div style={{fontSize:small?20:28}}>{file?"✅":"📄"}</div>
    <div style={{fontSize:small?11:13,fontWeight:600,marginTop:2}}>{label}</div>
    <div style={{fontSize:small?8:10,color:"#888",marginBottom:6}}>{file?"已上傳（點擊更換）":desc}</div>
    <div style={{display:"flex",gap:8,justifyContent:"center"}}>
      <button type="button" onClick={()=>camRef.current?.click()} style={{padding:"6px 12px",borderRadius:6,border:"1px solid #4361ee",background:"#fff",color:"#4361ee",fontSize:11,cursor:"pointer"}}>📷 拍照</button>
      <button type="button" onClick={()=>fileRef.current?.click()} style={{padding:"6px 12px",borderRadius:6,border:"1px solid #ddd",background:"#fff",color:"#666",fontSize:11,cursor:"pointer"}}>📁 選檔案</button>
    </div>
  </div>;
}

function SigPad({label,sig,onSign}){
  const ref=useRef(null);const fullRef=useRef(null);
  const[dr,setDr]=useState(false);const[full,setFull]=useState(false);
  const gp=(e,cvs)=>{const r=cvs.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return{x:t.clientX-r.left,y:t.clientY-r.top};};
  const start=(e,cvs)=>{e.preventDefault();setDr(true);const ctx=cvs.getContext("2d");const p=gp(e,cvs);ctx.beginPath();ctx.moveTo(p.x,p.y);};
  const draw=(e,cvs)=>{if(!dr)return;e.preventDefault();const ctx=cvs.getContext("2d");const p=gp(e,cvs);ctx.lineTo(p.x,p.y);ctx.strokeStyle="#1a1a1a";ctx.lineWidth=3;ctx.lineCap="round";ctx.stroke();};
  const end=()=>{setDr(false);};
  const clear=(cvs)=>{if(cvs)cvs.getContext("2d").clearRect(0,0,cvs.width,cvs.height);};
  const confirm=()=>{if(fullRef.current)onSign(fullRef.current.toDataURL());setFull(false);};
  const openFull=()=>{setFull(true);setTimeout(()=>{if(fullRef.current){fullRef.current.width=fullRef.current.parentElement.clientWidth-32;fullRef.current.height=Math.min(300,window.innerHeight*0.5);clear(fullRef.current);}},50);};
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
      <span style={{fontSize:11,color:"#888"}}>{label}</span>
      {sig && <button onClick={()=>onSign(null)} type="button" style={{fontSize:10,color:"#4361ee",background:"none",border:"none",cursor:"pointer"}}>清除重簽</button>}
    </div>
    {sig ? (
      <div onClick={openFull} style={{border:"1px solid #0a7c42",borderRadius:8,padding:8,background:"#fff",cursor:"pointer",textAlign:"center"}}>
        <img src={sig} alt="簽名" style={{maxHeight:60,maxWidth:"100%"}} />
        <div style={{fontSize:10,color:"#0a7c42",marginTop:2}}>✅ 已簽名</div>
      </div>
    ) : (
      <div onClick={openFull} style={{border:"2px dashed #ddd",borderRadius:8,padding:20,background:"#fff",cursor:"pointer",textAlign:"center"}}>
        <div style={{fontSize:24}}>✍️</div>
        <div style={{fontSize:12,color:"#888"}}>點擊這裡簽名</div>
      </div>
    )}
    {full && (
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.85)",zIndex:9999,display:"flex",flexDirection:"column",justifyContent:"center",padding:16}}>
        <div style={{background:"#fff",borderRadius:12,padding:16,maxWidth:600,width:"100%",margin:"0 auto"}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:8,textAlign:"center"}}>{label}</div>
          <canvas ref={fullRef} style={{width:"100%",border:"1px solid #ddd",borderRadius:8,background:"#fefefe",touchAction:"none"}}
            onMouseDown={e=>start(e,fullRef.current)} onMouseMove={e=>draw(e,fullRef.current)} onMouseUp={end} onMouseLeave={end}
            onTouchStart={e=>start(e,fullRef.current)} onTouchMove={e=>draw(e,fullRef.current)} onTouchEnd={end} />
          <div style={{display:"flex",gap:10,marginTop:12}}>
            <button type="button" onClick={()=>clear(fullRef.current)} style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid #ddd",background:"#fff",fontSize:13,cursor:"pointer"}}>🔄 清除</button>
            <button type="button" onClick={()=>setFull(false)} style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid #ddd",background:"#fff",fontSize:13,cursor:"pointer",color:"#888"}}>取消</button>
            <button type="button" onClick={confirm} style={{flex:2,padding:"10px",borderRadius:8,border:"none",background:"#0a7c42",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>✅ 確認簽名</button>
          </div>
        </div>
      </div>
    )}
  </div>;
}

function Box({children}){return <div style={{maxWidth:460,margin:"0 auto",padding:"14px 10px",fontFamily:"system-ui,'Noto Sans TC',sans-serif",background:"#faf8f5",minHeight:"100vh"}}>{children}</div>;}
function C({children}){return <div style={{minHeight:"60vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>{children}</div>;}
