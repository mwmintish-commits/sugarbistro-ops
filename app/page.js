"use client";
import { useState, useEffect, useCallback } from "react";
import { ap, fmt, Badge, RB, Row, LT, ROLES, LABOR_SELF, HEALTH_SELF } from "./components/utils";
import EmpDetail from "./components/EmpDetail";
import SettingsMgr from "./components/SettingsMgr";
import WorklogMgr from "./components/WorklogMgr";
import LeavesMgr from "./components/LeavesMgr";

const ROLE_TABS = {
  admin: ["dashboard","employees","schedules","leaves","attendance","overtime","payroll",
    "reviews","bonus",
    "settlements","deposits","expenses","payments","pnl",
    "recipes","production","inventory","clients","orders","products",
    "shifts","worklogs","announcements","settings"],
  manager: ["employees","schedules","leaves","attendance","overtime","payroll",
    "reviews",
    "settlements","deposits","expenses","payments","pnl",
    "recipes","production","inventory","clients","orders","products","shifts","worklogs"],
  store_manager: ["schedules","leaves","store_staff","shifts","worklogs","inventory",
    "announcements","settlements","deposits","expenses"]
};
const TAB_L = {
  dashboard:"🏠總覽",employees:"👥員工",schedules:"📅排班",leaves:"🙋請假",
  attendance:"📍出勤",overtime:"⏱加班",payroll:"💰薪資",
  reviews:"📝考核",bonus:"🏆獎金",
  settlements:"💰日結",
  deposits:"🏦存款",expenses:"📦費用",payments:"💳撥款",pnl:"📊損益",
  recipes:"📋配方",production:"🏭生產",inventory:"📊庫存",
  clients:"👥客戶",orders:"📝訂單",products:"🏷️產品",shifts:"⏰班別",worklogs:"📋日誌",
  announcements:"📢公告",settings:"⚙️設定",store_staff:"👥本店員工"
};
const TAB_GROUPS = {
  "總覽":["dashboard"],
  "人資":["employees","store_staff","schedules","leaves","attendance","overtime","payroll","reviews","bonus"],
  "財務":["settlements","deposits","expenses","payments","pnl"],
  "生產":["recipes","production","inventory"],
  "業務":["products","clients","orders"],
  "管理":["shifts","worklogs","announcements","settings"]
};
const DAYS = ["日","一","二","三","四","五","六"];
// ✦34 CSV匯出
function exportCSV(filename, headers, rows) {
  const bom = "\uFEFF";
  const csv = bom + headers.join(",") + "\n" + rows.map(r => r.map(c => '"' + String(c||"").replace(/"/g,'""') + '"').join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const [auth, setAuth] = useState(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState(1);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [sf, setSf] = useState("");
  const [ld, setLd] = useState(true);
  const [stores, setStores] = useState([]);
  const [emps, setEmps] = useState([]);
  const [stl, setStl] = useState([]);
  const [sum, setSum] = useState({});
  const [dep, setDep] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [scheds, setScheds] = useState([]);
  const [att, setAtt] = useState([]);
  const [lr, setLr] = useState([]);
  const [exps, setExps] = useState([]);
  const [expSum, setExpSum] = useState({});
  const [pnl, setPnl] = useState(null);
  const [anns, setAnns] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [sv, setSv] = useState("month");
  const [ws, setWs] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toLocaleDateString("sv-SE");
  });
  const [ssf, setSsf] = useState(false);
  const [es, setEs] = useState(null);
  const [sf2, setSf2] = useState({
    name:"",store_id:"",start_time:"10:00",end_time:"20:00",
    break_minutes:60,role:"all"
  });
  const [expType, setExpType] = useState("all");
  const [expSearch, setExpSearch] = useState("");
  const [otRecords, setOtRecords] = useState([]);
  const [otSum, setOtSum] = useState({});
  const [pmtRecords, setPmtRecords] = useState([]);
  const [pmtSum, setPmtSum] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [invItems, setInvItems] = useState([]);
  const [invSum, setInvSum] = useState({});
  const [recipeList, setRecipeList] = useState([]);
  const [clientList, setClientList] = useState([]);
  const [orderList, setOrderList] = useState([]);
  const [orderSum, setOrderSum] = useState({});
  const [prodList, setProdList] = useState([]);
  const [prodSum, setProdSum] = useState({});
  const [si, setSi] = useState(null);
  const [attView, setAttView] = useState("records");
  const [amendments, setAmendments] = useState([]);
  const [monthlyReport, setMonthlyReport] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [rvData, setRvData] = useState([]);
  const [bnData, setBnData] = useState(null);
  const [productList, setProductList] = useState([]);
  const pl = lr.filter(l => l.status === "pending");
  const ae = emps.filter(e => e.is_active);

  useEffect(() => {
    const s = localStorage.getItem("sb_auth");
    if (s) { try { setAuth(JSON.parse(s)); } catch(e) {} }
  }, []);

  useEffect(() => {
    ap("/api/admin/stores").then(d => setStores(d.data || []));
  }, []);

  const myTabs = auth ? (ROLE_TABS[auth.role] || ROLE_TABS.staff || []) : [];
  useEffect(() => {
    if (auth && myTabs.length > 0 && !tab) setTab(myTabs[0]);
  }, [auth]);

  const load = useCallback(() => {
    setLd(true);
    const p = new URLSearchParams();
    if (month) p.set("month", month);
    if (sf) p.set("store_id", sf);
    const we2 = new Date(new Date(ws).getTime() + 6*86400000).toLocaleDateString("sv-SE");
    const sp = sv === "week"
      ? "week_start=" + ws + "&week_end=" + we2 + (sf ? "&store_id=" + sf : "")
      : "month=" + month + (sf ? "&store_id=" + sf : "");

    Promise.all([
      myTabs.includes("settlements") ? ap("/api/admin/settlements?" + p) : Promise.resolve({data:[],summary:{}}),
      myTabs.includes("deposits") ? ap("/api/admin/deposits?" + p) : Promise.resolve({data:[]}),
      ap("/api/admin/employees" + (sf ? "?store_id=" + sf : "")),
      ap("/api/admin/shifts" + (sf ? "?store_id=" + sf : "")),
      ap("/api/admin/schedules?" + sp),
      ap("/api/admin/attendance?" + p),
      ap("/api/admin/attendance?summary=true&" + p),
      ap("/api/admin/leaves?" + p),
      ap("/api/admin/expenses?" + p + "&type=" + expType),
      myTabs.includes("pnl") ? ap("/api/admin/pnl?month=" + month + "&compare=stores" + (sf ? "&store_id=" + sf : "")) : Promise.resolve(null),
      ap("/api/admin/announcements"),
    ]).then(([s,d,e,shs,sc,at2,as3,lr2,ex,pl2,an]) => {
      setStl(s.data||[]); setSum(s.summary||{}); setDep(d.data||[]);
      setEmps(e.data||[]); setShifts(shs.data||[]);
      setScheds(sc.data||[]); setAtt(at2.data||[]);
      setLr(lr2.data||[]); setExps(ex.data||[]);
      setExpSum({total:ex.total,byCategory:ex.byCategory});
      setPnl(pl2); setAnns(an.data||[]);
      setLd(false);
    });

    if (myTabs.includes("overtime")) {
      ap("/api/admin/overtime?month=" + month + (sf ? "&store_id=" + sf : ""))
        .then(r => { setOtRecords(r.data||[]); setOtSum(r.summary||{}); });
    }
    if (myTabs.includes("payments")) {
      ap("/api/admin/payments")
        .then(r => { setPmtRecords(r.data||[]); setPmtSum(r.summary||{}); });
    }
    ap("/api/admin/holidays?month=" + month)
      .then(r => setHolidays(r.data||[])).catch(() => {});
    if (myTabs.includes("attendance")) {
      ap("/api/admin/attendance?type=amendments&month=" + month + (sf ? "&store_id=" + sf : ""))
        .then(r => setAmendments(r.data||[])).catch(() => {});
      ap("/api/admin/attendance?type=monthly_report&month=" + month + (sf ? "&store_id=" + sf : ""))
        .then(r => setMonthlyReport(r.data||[])).catch(() => {});
    }
    if (myTabs.includes("inventory")) {
      ap("/api/admin/inventory").then(r => { setInvItems(r.data||[]); setInvSum(r.summary||{}); });
    }
    if (myTabs.includes("recipes")) {
      ap("/api/admin/recipes").then(r => setRecipeList(r.data||[]));
    }
    if (myTabs.includes("clients")) {
      ap("/api/admin/clients").then(r => setClientList(r.data||[]));
      ap("/api/admin/products").then(r => setProductList(r.data||[])).catch(()=>{});
    }
    if (myTabs.includes("orders")) {
      ap("/api/admin/orders").then(r => { setOrderList(r.data||[]); setOrderSum(r.summary||{}); });
    }
    if (myTabs.includes("production")) {
      ap("/api/admin/production?month=" + month)
        .then(r => { setProdList(r.data||[]); setProdSum(r.summary||{}); });
    }
    // 系統提醒
    if (myTabs.includes("dashboard")) {
      ap("/api/admin/reminders").then(r => setReminders(r.data||[])).catch(() => {});
    }
  }, [month, sf, sv, ws, myTabs.join(","), expType]);

  useEffect(() => { if (auth) load(); }, [auth, load]);

  const login = async () => {
    setErr("");
    if (step === 1) {
      const r = await ap("/api/auth", { action: "send_code", phone });
      if (r.error) { setErr(r.error); return; }
      setStep(2);
    } else {
      const r = await ap("/api/auth", { action: "verify", phone, code });
      if (r.error) { setErr(r.error); return; }
      setAuth(r);
      localStorage.setItem("sb_auth", JSON.stringify(r));
    }
  };

  const logout = () => {
    setAuth(null);
    localStorage.removeItem("sb_auth");
    setTab("");
  };

  const rvExp = async (id, status) => {
    const r = await ap("/api/admin/expenses", { action: "review", expense_id: id, status, reviewer_role: auth.role });
    if (r.needs_escalation) { alert(r.error); return; }
    load();
  };
  const loadAmendments = () => {
    ap("/api/admin/attendance?type=amendments&month=" + month + (sf ? "&store_id=" + sf : ""))
      .then(r => setAmendments(r.data||[]));
  };
  const loadMonthlyReport = () => {
    ap("/api/admin/attendance?type=monthly_report&month=" + month + (sf ? "&store_id=" + sf : ""))
      .then(r => setMonthlyReport(r.data||[]));
  };
  const rvLv = async (id, status) => {
    await ap("/api/admin/leaves", { action: "review", request_id: id, status });
    load();
  };
  const saveShift = async () => {
    if (es) {
      await ap("/api/admin/shifts", { action: "update", shift_id: es.id, ...sf2 });
    } else {
      await ap("/api/admin/shifts", { action: "create", ...sf2 });
    }
    setSsf(false); setEs(null); load();
  };
  const editShift = (s) => {
    setSf2({
      name: s.name, store_id: s.store_id, start_time: s.start_time,
      end_time: s.end_time, break_minutes: s.break_minutes, role: s.role || "all"
    });
    setEs(s); setSsf(true);
  };
  const delShift = async (id) => {
    if (confirm("確定刪除？")) {
      await ap("/api/admin/shifts", { action: "delete", shift_id: id });
      load();
    }
  };
  const deactivate = async (id) => {
    if (confirm("確定停用？")) {
      await ap("/api/admin/employees", { action: "deactivate", employee_id: id });
      load();
    }
  };

  const lockedStore = auth?.role === "store_manager" ? auth.store_id : null;
  const storeName = auth?.role === "store_manager" ? auth.store_name : null;

  // 門店主管鎖定門市（必須在所有 hooks 之後、條件 return 之前）
  useEffect(() => { if (lockedStore && !sf) setSf(lockedStore); }, [lockedStore]);

  // ===== LOGIN =====
  if (!auth) {
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#faf8f5",fontFamily:"system-ui"}}>
        <div style={{background:"#fff",borderRadius:14,padding:30,maxWidth:340,width:"100%",boxShadow:"0 2px 20px rgba(0,0,0,0.08)"}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:36}}>🍯</div>
            <h1 style={{fontSize:18,fontWeight:700}}>小食糖後台</h1>
          </div>
          {step === 1 ? (
            <div>
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="手機號碼"
                style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #ddd",fontSize:14,marginBottom:10}} />
              <button onClick={login}
                style={{width:"100%",padding:12,borderRadius:8,border:"none",background:"#1a1a1a",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                發送驗證碼
              </button>
            </div>
          ) : (
            <div>
              <p style={{fontSize:12,color:"#888",marginBottom:8}}>驗證碼已發送到 LINE</p>
              <input value={code} onChange={e=>setCode(e.target.value)} placeholder="輸入驗證碼" maxLength={6}
                style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #ddd",fontSize:14,marginBottom:10,textAlign:"center",letterSpacing:6}} />
              <button onClick={login}
                style={{width:"100%",padding:12,borderRadius:8,border:"none",background:"#1a1a1a",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                登入
              </button>
            </div>
          )}
          {err && <p style={{color:"#b91c1c",fontSize:12,marginTop:8,textAlign:"center"}}>{err}</p>}
        </div>
      </div>
    );
  }

  // lockedStore 已在上方定義

  // ===== MAIN SHELL =====
  return (
    <div style={{fontFamily:"system-ui, 'Noto Sans TC', sans-serif",background:"#faf8f5",minHeight:"100vh"}}>
      {/* HEADER */}
      <div style={{background:"#fff",borderBottom:"1px solid #e8e6e1",padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:20}}>🍯</span>
          <b style={{fontSize:14}}>小食糖後台</b>
          <RB role={auth.role} />
          <span style={{fontSize:11,color:"#888"}}>{auth.name}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
            style={{padding:"3px 8px",borderRadius:6,border:"1px solid #ddd",fontSize:11}} />
          {!lockedStore ? (
            <select value={sf} onChange={e=>setSf(e.target.value)}
              style={{padding:"3px 8px",borderRadius:6,border:"1px solid #ddd",fontSize:11}}>
              <option value="">全部門市</option>
              {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : (
            <span style={{padding:"3px 8px",borderRadius:6,background:"#e6f1fb",color:"#185fa5",fontSize:11}}>{storeName}</span>
          )}
          <button onClick={logout}
            style={{padding:"3px 10px",borderRadius:6,border:"1px solid #ddd",background:"#fff",fontSize:11,cursor:"pointer",color:"#b91c1c"}}>
            登出
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{background:"#fff",borderBottom:"1px solid #e8e6e1",padding:"6px 10px",display:"flex",gap:2,overflowX:"auto",flexWrap:"wrap"}}>
        {Object.entries(TAB_GROUPS).map(([group, tabs]) => {
          const visible = tabs.filter(t => myTabs.includes(t));
          if (visible.length === 0) return null;
          return (
            <div key={group} style={{display:"flex",alignItems:"center",gap:1}}>
              <span style={{fontSize:9,color:"#aaa",padding:"0 4px"}}>{group}</span>
              {visible.map(t => (
                <button key={t} onClick={()=>setTab(t)}
                  style={{
                    padding:"4px 8px",borderRadius:6,fontSize:11,cursor:"pointer",
                    border: tab===t ? "1px solid #1a1a1a" : "1px solid transparent",
                    background: tab===t ? "#1a1a1a" : "transparent",
                    color: tab===t ? "#fff" : "#666",
                    fontWeight: tab===t ? 600 : 400,
                  }}>
                  {TAB_L[t]}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* CONTENT */}
      <div style={{padding:"12px 14px",maxWidth:1200,margin:"0 auto"}}>
        {ld && <div style={{textAlign:"center",padding:30,color:"#aaa"}}>載入中...</div>}

        {/* DASHBOARD */}
        {!ld && tab === "dashboard" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:6,marginBottom:10}}>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 10px"}}><div style={{fontSize:9,color:"#888"}}>本月營收</div><div style={{fontSize:18,fontWeight:700,color:"#0a7c42"}}>{fmt(sum.total_net_sales)}</div></div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 10px"}}><div style={{fontSize:9,color:"#888"}}>待審(假+費用)</div><div style={{fontSize:18,fontWeight:700,color:"#b45309"}}>{pl.length + exps.filter(e=>e.status==="pending").length}</div></div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 10px"}}><div style={{fontSize:9,color:"#888"}}>在職員工</div><div style={{fontSize:18,fontWeight:700}}>{ae.length}</div></div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 10px"}}><div style={{fontSize:9,color:"#888"}}>待撥款</div><div style={{fontSize:18,fontWeight:700,color:"#b91c1c"}}>{fmt(pmtSum.pending)}</div></div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 10px"}}><div style={{fontSize:9,color:"#888"}}>應收帳款</div><div style={{fontSize:18,fontWeight:700,color:"#b45309"}}>{fmt(orderSum.unpaid)}</div></div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              {/* 門市營收達成率 */}
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:10}}>
                <h4 style={{fontSize:11,fontWeight:600,marginBottom:6}}>📊 門市營收達成率</h4>
                {stores.map(s => {
                  const [my,mm] = month.split("-").map(Number);
                  const dim = new Date(my,mm,0).getDate();
                  const rev = stl.filter(r => r.store_id === s.id).reduce((a,r) => a + Number(r.net_sales||0), 0);
                  const target = (s.daily_target||0) * dim;
                  const pct = target > 0 ? Math.round(rev/target*100) : 0;
                  return (
                    <div key={s.id} style={{marginBottom:5}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}><span>{s.name}</span><span style={{fontWeight:600}}>{fmt(rev)}{target>0&&<span style={{color:"#888",fontWeight:400}}>{" / "+fmt(target)+" ("+pct+"%)"}</span>}</span></div>
                      {target > 0 && <div style={{height:5,background:"#f0f0f0",borderRadius:3,marginTop:1}}><div style={{height:"100%",width:Math.min(100,pct)+"%",background:pct>=100?"#0a7c42":pct>=70?"#fbbf24":"#b91c1c",borderRadius:3}} /></div>}
                    </div>
                  );
                })}
              </div>

              {/* 待辦集中 */}
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:10}}>
                <h4 style={{fontSize:11,fontWeight:600,marginBottom:6}}>📋 待辦事項</h4>
                {pl.length>0&&<div style={{fontSize:10,padding:"2px 0",color:"#b45309"}}>{"🙋 待審請假 "+pl.length+" 筆"}</div>}
                {exps.filter(e=>e.status==="pending").length>0&&<div style={{fontSize:10,padding:"2px 0",color:"#b45309"}}>{"📦 待審費用 "+exps.filter(e=>e.status==="pending").length+" 筆"}</div>}
                {otRecords.filter(r=>r.status==="pending").length>0&&<div style={{fontSize:10,padding:"2px 0",color:"#b45309"}}>{"⏱ 待審加班 "+otRecords.filter(r=>r.status==="pending").length+" 筆"}</div>}
                {amendments.filter(a=>a.status==="pending").length>0&&<div style={{fontSize:10,padding:"2px 0",color:"#b45309"}}>{"🔧 待審補登 "+amendments.filter(a=>a.status==="pending").length+" 筆"}</div>}
                {dep.filter(d=>d.status==="anomaly").length>0&&<div style={{fontSize:10,padding:"2px 0",color:"#b91c1c"}}>{"🚨 存款異常 "+dep.filter(d=>d.status==="anomaly").length+" 筆"}</div>}
                {pl.length===0&&exps.filter(e=>e.status==="pending").length===0&&otRecords.filter(r=>r.status==="pending").length===0&&<div style={{fontSize:10,color:"#ccc",textAlign:"center",padding:8}}>✅ 無待辦</div>}
              </div>
            </div>

            {/* 🔔 系統提醒 */}
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:10,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <h4 style={{fontSize:11,fontWeight:600}}>🔔 系統提醒</h4>
                <button onClick={async()=>{await ap("/api/admin/reminders",{action:"generate"});load();}}
                  style={{padding:"2px 8px",borderRadius:4,border:"1px solid #ddd",background:"#fff",fontSize:9,cursor:"pointer"}}>🔄 檢查</button>
              </div>
              {(reminders||[]).length===0
                ? <div style={{fontSize:10,color:"#ccc",textAlign:"center",padding:6}}>✅ 無提醒</div>
                : (reminders||[]).map(r=>(
                  <div key={r.id} style={{fontSize:10,padding:"3px 0",borderBottom:"1px solid #f0eeea",display:"flex",gap:4}}>
                    <span style={{flex:1}}>{r.message}</span>
                    <button onClick={async()=>{await ap("/api/admin/reminders",{action:"dismiss",reminder_id:r.id});load();}}
                      style={{background:"none",border:"none",cursor:"pointer",fontSize:9,color:"#ccc"}}>✕</button>
                  </div>
                ))
              }
            </div>

            {/* ✦42-44 KPI */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:10}}>
                <h4 style={{fontSize:11,fontWeight:600,marginBottom:6}}>👥 員工KPI</h4>
                {ae.slice(0,5).map(e => {
                  const schedCount = scheds.filter(s=>s.employee_id===e.id&&s.type==="shift").length;
                  const clockCount = att.filter(a=>a.employee_id===e.id&&a.type==="clock_in").length;
                  const lateCount = att.filter(a=>a.employee_id===e.id&&a.is_late).length;
                  const attRate = schedCount > 0 ? Math.round(clockCount/schedCount*100) : 100;
                  const onTimeRate = clockCount > 0 ? Math.round((clockCount-lateCount)/clockCount*100) : 100;
                  return (
                    <div key={e.id} style={{display:"flex",justifyContent:"space-between",fontSize:10,padding:"2px 0",borderBottom:"1px solid #f5f5f5"}}>
                      <span style={{fontWeight:500}}>{e.name}</span>
                      <span>出勤{attRate}% 準時{onTimeRate}%</span>
                    </div>
                  );
                })}
              </div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:10}}>
                <h4 style={{fontSize:11,fontWeight:600,marginBottom:6}}>🏠 門市人效</h4>
                {stores.map(s => {
                  const storeEmpCount = ae.filter(e=>e.store_id===s.id).length;
                  const storeRev = stl.filter(r=>r.store_id===s.id).reduce((a,r)=>a+Number(r.net_sales||0),0);
                  const perPerson = storeEmpCount > 0 ? Math.round(storeRev/storeEmpCount) : 0;
                  return (
                    <div key={s.id} style={{display:"flex",justifyContent:"space-between",fontSize:10,padding:"2px 0",borderBottom:"1px solid #f5f5f5"}}>
                      <span style={{fontWeight:500}}>{s.name}</span>
                      <span>{storeEmpCount+"人 人效"+fmt(perPerson)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {!ld && (tab === "employees" || tab === "store_staff") && (
          <div>
            <button onClick={async()=>{
              const name = prompt("員工姓名："); if(!name) return;
              const phone = prompt("手機號碼："); if(!phone) return;
              const storeId = sf || prompt("門市ID（從門市列表取得）：");
              const role = prompt("角色（staff/store_manager/manager/admin）：","staff");
              const r = await ap("/api/admin/employees",{action:"create",name,phone,store_id:storeId,role:role||"staff"});
              if(r.error) alert(r.error); else { alert("已新增，綁定碼：" + (r.bind_code||"")); load(); }
            }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>
              ＋新增員工
            </button>

            {/* 待啟用 */}
            {emps.filter(e=>!e.is_active).length > 0 && (
              <div style={{marginBottom:12}}>
                <h4 style={{fontSize:12,color:"#b45309",marginBottom:4}}>{"⏳ 待啟用（"+emps.filter(e=>!e.is_active).length+"）"}</h4>
                <div style={{background:"#fff8e6",borderRadius:8,border:"1px solid #f0e6c8",overflow:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <tbody>{emps.filter(e=>!e.is_active).map(e=>(
                      <tr key={e.id} style={{borderBottom:"1px solid #f0eeea"}}>
                        <td style={{padding:6,fontWeight:500,cursor:"pointer",color:"#4361ee"}} onClick={()=>setDetailId(e.id)}>{e.name}</td>
                        <td style={{padding:6}}>{e.stores?e.stores.name:"總部"}</td>
                        <td style={{padding:6}}>{e.line_uid?"✅":"❌"}</td>
                        <td style={{padding:6}}>
                          <button onClick={async()=>{await ap("/api/admin/employees",{action:"activate",employee_id:e.id});load();}}
                            style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#0a7c42",color:"#fff",fontSize:9,cursor:"pointer",marginRight:2}}>啟用</button>
                          <button onClick={async()=>{if(!confirm("確定刪除"+e.name+"的資料？此操作無法復原"))return;await ap("/api/admin/employees",{action:"deactivate",employee_id:e.id});load();}}
                            style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#b91c1c",color:"#fff",fontSize:9,cursor:"pointer"}}>刪除</button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 已啟用 */}
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{background:"#faf8f5"}}>
                    {["姓名","門市","角色","年資","特休","LINE","操作"].map(h =>
                      <th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {ae.map(e => (
                    <tr key={e.id} style={{borderBottom:"1px solid #f0eeea"}}>
                      <td style={{padding:6,fontWeight:500,cursor:"pointer",color:"#4361ee"}}
                        onClick={() => setDetailId(e.id)}>{e.name}</td>
                      <td style={{padding:6}}>{e.stores?e.stores.name:"總部"}</td>
                      <td style={{padding:6}}><RB role={e.role} /></td>
                      <td style={{padding:6}}>{(e.service_months||0)+"月"}</td>
                      <td style={{padding:6}}>{(e.annual_leave_days||0)+"天"}</td>
                      <td style={{padding:6}}>{e.line_uid?"✅":"❌"}</td>
                      <td style={{padding:6}}>
                        <button onClick={()=>deactivate(e.id)}
                          style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#b91c1c",color:"#fff",fontSize:9,cursor:"pointer"}}>
                          停用
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCHEDULES */}
        {!ld && tab === "schedules" && (
          <div>
            <div style={{display:"flex",gap:4,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
              <button onClick={()=>setSv("week")} style={{padding:"4px 10px",borderRadius:5,border:"1px solid #ddd",background:sv==="week"?"#1a1a1a":"#fff",color:sv==="week"?"#fff":"#666",fontSize:11,cursor:"pointer"}}>週檢視</button>
              <button onClick={()=>setSv("month")} style={{padding:"4px 10px",borderRadius:5,border:"1px solid #ddd",background:sv==="month"?"#1a1a1a":"#fff",color:sv==="month"?"#fff":"#666",fontSize:11,cursor:"pointer"}}>月檢視</button>
              {sv==="week" && (
                <>
                  <button onClick={()=>setWs(new Date(new Date(ws).getTime()-7*86400000).toLocaleDateString("sv-SE"))} style={{padding:"3px 8px",borderRadius:5,border:"1px solid #ddd",background:"#fff",cursor:"pointer",fontSize:11}}>◀</button>
                  <span style={{fontSize:12,fontWeight:500}}>{ws+" ~ "+new Date(new Date(ws).getTime()+6*86400000).toLocaleDateString("sv-SE")}</span>
                  <button onClick={()=>setWs(new Date(new Date(ws).getTime()+7*86400000).toLocaleDateString("sv-SE"))} style={{padding:"3px 8px",borderRadius:5,border:"1px solid #ddd",background:"#fff",cursor:"pointer",fontSize:11}}>▶</button>
                </>
              )}
              <button onClick={async()=>{
                const we2=new Date(new Date(ws).getTime()+6*86400000).toLocaleDateString("sv-SE");
                if(!confirm("發布 "+ws+" ~ "+we2+" 的班表？"))return;
                await ap("/api/admin/schedules",{action:"publish",week_start:ws,week_end:we2,store_id:sf||undefined});
                alert("已發布");load();
              }} style={{padding:"4px 10px",borderRadius:5,border:"1px solid #0a7c42",background:"transparent",color:"#0a7c42",fontSize:11,cursor:"pointer",marginLeft:"auto"}}>
                📢 發布班表
              </button>
              {/* ✦16 班表範本 */}
              <button onClick={async()=>{
                if(!sf){alert("請先選擇門市");return;}
                const name=prompt("範本名稱：");if(!name)return;
                const weekScheds=scheds.filter(s=>{const emp=emps.find(e=>e.id===s.employee_id);return emp&&emp.store_id===sf;});
                const tpl=weekScheds.map(s=>({employee_id:s.employee_id,shift_id:s.shift_id,type:s.type,leave_type:s.leave_type,day_of_week:Math.floor((new Date(s.date)-new Date(ws))/86400000)}));
                await ap("/api/admin/schedules",{action:"save_template",store_id:sf,name,template_data:tpl});
                alert("範本「"+name+"」已儲存");
              }} style={{padding:"4px 10px",borderRadius:5,border:"1px solid #4361ee",background:"transparent",color:"#4361ee",fontSize:11,cursor:"pointer"}}>
                💾 存範本
              </button>
              <button onClick={async()=>{
                if(!sf){alert("請先選擇門市");return;}
                const{data:tpls}=await ap("/api/admin/schedules?type=templates&store_id="+sf);
                if(!tpls?.length){alert("此門市無範本");return;}
                const name=prompt("選擇範本：\n"+tpls.map((t,i)=>(i+1)+". "+t.name).join("\n"));
                const tpl=tpls.find((t,i)=>name==String(i+1)||t.name.includes(name));
                if(!tpl){alert("找不到");return;}
                if(!confirm("將範本「"+tpl.name+"」套用到 "+ws+" 這週？"))return;
                await ap("/api/admin/schedules",{action:"apply_template",template_id:tpl.id,week_start:ws,store_id:sf});
                alert("已套用");load();
              }} style={{padding:"4px 10px",borderRadius:5,border:"1px solid #b45309",background:"transparent",color:"#b45309",fontSize:11,cursor:"pointer"}}>
                📋 套範本
              </button>
            </div>

            {sv==="week" && (() => {
              const wd=Array.from({length:7},(_,i)=>new Date(new Date(ws).getTime()+i*86400000).toLocaleDateString("sv-SE"));
              const schedEmps=ae.filter(e=>e.role!=="admin");
              const displayStores=sf?stores.filter(s=>s.id===sf):stores;
              const addSch=async(eid,sid,date)=>{const s=shifts.find(x=>x.id===sid);const r=await ap("/api/admin/schedules",{action:"create",employee_id:eid,store_id:s?s.store_id:sf,shift_id:sid,date});if(r.warning)alert(r.warning);load();};
              const addLv=async(eid,date,lt)=>{await ap("/api/admin/schedules",{action:"add_leave",employee_id:eid,date,leave_type:lt});load();};
              const delSch=async(id)=>{await ap("/api/admin/schedules",{action:"delete",schedule_id:id});load();};
              return displayStores.map(store=>{
                const storeEmps=schedEmps.filter(e=>e.store_id===store.id);
                const storeShifts=shifts.filter(s=>s.store_id===store.id);
                if(storeEmps.length===0)return null;
                return(
                  <div key={store.id} style={{marginBottom:10}}>
                    <h4 style={{fontSize:12,fontWeight:600,color:"#444",marginBottom:4,padding:"4px 8px",background:"#faf8f5",borderRadius:4}}>{"🏠 "+store.name+"（"+storeEmps.length+"人）"}</h4>
                    <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,minWidth:650}}>
                        <thead><tr style={{background:"#faf8f5",borderBottom:"1px solid #e8e6e1"}}>
                          <th style={{padding:"7px 5px",textAlign:"left",fontWeight:500,color:"#666",minWidth:70,position:"sticky",left:0,background:"#faf8f5",zIndex:1}}>員工</th>
                          {wd.map((d,i)=>{const day=DAYS[new Date(d).getDay()];const hol=holidays.find(h=>h.date===d);const isWe=new Date(d).getDay()===0||new Date(d).getDay()===6;
                            return <th key={d} style={{padding:"7px 3px",textAlign:"center",fontWeight:500,color:hol?"#b91c1c":isWe?"#b45309":"#666",minWidth:85,background:hol?"#fef2f2":"transparent"}}>{d.slice(5)+"("+day+")"}{hol&&<div style={{fontSize:7,color:"#b91c1c"}}>{hol.name}</div>}</th>;})}
                        </tr></thead>
                        <tbody>{storeEmps.map(emp=>(
                          <tr key={emp.id} style={{borderBottom:"1px solid #f0eeea"}}>
                            <td style={{padding:5,fontWeight:500,fontSize:11,position:"sticky",left:0,background:"#fff",zIndex:1}}>{emp.name}<br/><RB role={emp.role}/></td>
                            {wd.map(date=>{const sc=scheds.find(s=>s.employee_id===emp.id&&s.date===date);return(
                              <td key={date} style={{padding:2,textAlign:"center",verticalAlign:"top"}}>
                                {sc?(<div style={{background:sc.type==="leave"?(LT[sc.leave_type]||LT.off).bg:sc.published?"#e6f9f0":"#fff8e6",borderRadius:4,padding:"2px 3px",fontSize:9}}>
                                  {sc.type==="leave"?<div style={{color:(LT[sc.leave_type]||LT.off).c,fontWeight:500}}>{(LT[sc.leave_type]||LT.off).l}</div>:<div><div style={{fontWeight:500}}>{sc.shifts?sc.shifts.name:""}</div><div style={{color:"#888"}}>{sc.shifts?(sc.shifts.start_time||"").slice(0,5)+"~"+(sc.shifts.end_time||"").slice(0,5):""}</div></div>}
                                  <div style={{textAlign:"right",marginTop:1}}><button onClick={(ev)=>{ev.stopPropagation();delSch(sc.id);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:"#b91c1c",padding:"2px 4px"}}>✕刪</button></div>
                                </div>):(<select onChange={e=>{const v=e.target.value;e.target.value="";if(!v)return;if(v.startsWith("leave:"))addLv(emp.id,date,v.split(":")[1]);else addSch(emp.id,v,date);}} style={{width:"100%",padding:1,borderRadius:3,border:"1px dashed #ddd",fontSize:9,color:"#ccc",background:"transparent",cursor:"pointer"}}><option value="">+</option><optgroup label="班別">{storeShifts.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</optgroup><optgroup label="休假">{Object.entries(LT).filter(([k])=>!["off","rest"].includes(k)).map(([k,v])=><option key={k} value={"leave:"+k}>{v.l}</option>)}</optgroup></select>)}
                              </td>);})}
                          </tr>))}</tbody>
                      </table>
                    </div>
                  </div>);
              });
            })()}

            {sv==="month" && (
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                  <thead><tr>{DAYS.map(d=><th key={d} style={{padding:4,textAlign:"center",fontWeight:500,color:"#888",width:"14.2%"}}>{d}</th>)}</tr></thead>
                  <tbody>{(() => {
                    const [y,m]=month.split("-").map(Number);const sd=new Date(y,m-1,1).getDay();const dim=new Date(y,m,0).getDate();
                    const filteredScheds=sf?scheds.filter(s=>{const emp=emps.find(e=>e.id===s.employee_id);return emp&&emp.store_id===sf;}):scheds;
                    const rows=[];let cells=[];
                    for(let i=0;i<sd;i++)cells.push(<td key={"e"+i} style={{padding:3,border:"1px solid #f0eeea"}}/>);
                    for(let d=1;d<=dim;d++){
                      const date=y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
                      const ds=filteredScheds.filter(s=>s.date===date);const hol=holidays.find(h=>h.date===date);const isWe=new Date(date).getDay()===0||new Date(date).getDay()===6;
                      cells.push(<td key={date} style={{padding:3,verticalAlign:"top",border:"1px solid #f0eeea",minHeight:40,background:hol?"#fde8e8":isWe?"#faf8f5":"transparent"}}>
                        <div style={{fontSize:10,fontWeight:500,color:hol?"#b91c1c":"#666"}}>{d}{hol&&<span style={{fontSize:7,color:"#b91c1c",marginLeft:2}}>{hol.name}</span>}</div>
                        {ds.slice(0,4).map(s=>(<div key={s.id} style={{background:s.type==="leave"?(LT[s.leave_type]||LT.off).bg:s.published?"#e6f9f0":"#fff8e6",borderRadius:2,padding:"0 2px",fontSize:8,marginBottom:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",color:s.type==="leave"?(LT[s.leave_type]||LT.off).c:"inherit"}}>{(s.employees?s.employees.name:"")+" "+(s.type==="leave"?(LT[s.leave_type]||LT.off).l:s.shifts?s.shifts.name:"")}</div>))}
                      </td>);
                      if(cells.length===7){rows.push(<tr key={"r"+rows.length}>{cells}</tr>);cells=[];}
                    }
                    while(cells.length<7)cells.push(<td key={"f"+cells.length} style={{padding:3,border:"1px solid #f0eeea"}}/>);
                    if(cells.length)rows.push(<tr key={"r"+rows.length}>{cells}</tr>);
                    return rows;
                  })()}</tbody>
                </table>
              </div>
            )}
          </div>
        )}


        {/* LEAVES */}
        {!ld && tab === "leaves" && (
          <LeavesMgr lr={lr} pl={pl} rvLv={rvLv} sf={sf} />
        )}

        {/* ATTENDANCE */}
        {!ld && tab === "attendance" && (
          <div>
            <div style={{display:"flex",gap:4,marginBottom:8}}>
              {[["records","📍打卡紀錄"],["amendments","🔧補登申請"],["report","📊月報表"]].map(([k,l])=>(
                <button key={k} onClick={()=>setAttView(k)} style={{padding:"4px 10px",borderRadius:5,border:"1px solid #ddd",background:attView===k?"#1a1a1a":"#fff",color:attView===k?"#fff":"#666",fontSize:11,cursor:"pointer"}}>{l}</button>
              ))}
            </div>

            {attView === "records" && (
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{background:"#faf8f5"}}>{["時間","員工","類型","距離","遲到","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                  <tbody>{att.map(a=>(
                    <tr key={a.id} style={{borderBottom:"1px solid #f0eeea",background:a.is_amendment?"#f0f8ff":"transparent"}}>
                      <td style={{padding:6,fontSize:10}}>{a.timestamp?new Date(a.timestamp).toLocaleString("zh-TW",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):""}{a.is_amendment&&<span style={{fontSize:8,color:"#4361ee",marginLeft:2}}>補</span>}</td>
                      <td style={{padding:6,fontWeight:500}}>{a.employees?a.employees.name:""}</td>
                      <td style={{padding:6}}>{a.type==="clock_in"?"上班":"下班"}</td>
                      <td style={{padding:6}}>{a.distance_meters?a.distance_meters+"m":"-"}</td>
                      <td style={{padding:6,color:a.late_minutes>0?"#b91c1c":"#0a7c42"}}>{a.late_minutes>0?a.late_minutes+"分":"準時"}</td>
                      <td style={{padding:6}}>
                        <button onClick={async()=>{if(!confirm("確定刪除此打卡紀錄？"))return;await ap("/api/admin/attendance",{action:"delete",attendance_id:a.id});load();}}
                          style={{padding:"4px 8px",borderRadius:4,border:"1px solid #ddd",background:"#fff",fontSize:11,cursor:"pointer",color:"#b91c1c"}}>🗑刪除</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {attView === "amendments" && (
              <div>
                <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead><tr style={{background:"#faf8f5"}}>{["日期","員工","類型","時間","原因","狀態","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                    <tbody>{(amendments||[]).length===0?(
                      <tr><td colSpan={7} style={{padding:20,textAlign:"center",color:"#ccc"}}>無補登申請</td></tr>
                    ):(amendments||[]).map(a=>(
                      <tr key={a.id} style={{borderBottom:"1px solid #f0eeea"}}>
                        <td style={{padding:6}}>{a.date}</td>
                        <td style={{padding:6,fontWeight:500}}>{a.employees?a.employees.name:""}</td>
                        <td style={{padding:6}}>{a.type==="clock_in"?"上班":"下班"}</td>
                        <td style={{padding:6,fontWeight:600}}>{a.amended_time}</td>
                        <td style={{padding:6,fontSize:10,color:"#666",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.reason}</td>
                        <td style={{padding:6}}><Badge status={a.status} /></td>
                        <td style={{padding:6}}>
                          {a.status==="pending"&&(
                            <span>
                              <button onClick={async()=>{await ap("/api/admin/attendance",{action:"review_amendment",amendment_id:a.id,status:"approved"});loadAmendments();load();}}
                                style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#0a7c42",color:"#fff",fontSize:9,cursor:"pointer",marginRight:2}}>✅</button>
                              <button onClick={async()=>{await ap("/api/admin/attendance",{action:"review_amendment",amendment_id:a.id,status:"rejected"});loadAmendments();}}
                                style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#b91c1c",color:"#fff",fontSize:9,cursor:"pointer"}}>❌</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            {attView === "report" && (
              <div>
                <button onClick={async()=>{
                  const [y,m] = month.split("-").map(Number);
                  if(!confirm(month+" 月報表產生中，確定？")) return;
                  await ap("/api/admin/attendance",{action:"generate_monthly_report",year:y,month:m});
                  loadMonthlyReport(); alert("月報表已產生");
                }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>
                  {"📊 產生 "+month+" 月報表"}
                </button>
                <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead><tr style={{background:"#faf8f5"}}>{["員工","出勤","遲到","遲到分鐘","請假","加班hr","補休hr","加班費","補登"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                    <tbody>{(monthlyReport||[]).length===0?(
                      <tr><td colSpan={9} style={{padding:20,textAlign:"center",color:"#ccc"}}>請先點擊「產生月報表」</td></tr>
                    ):(monthlyReport||[]).map(r=>(
                      <tr key={r.id} style={{borderBottom:"1px solid #f0eeea"}}>
                        <td style={{padding:6,fontWeight:500}}>{r.employees?r.employees.name:""}</td>
                        <td style={{padding:6,fontWeight:600}}>{r.work_days+"天"}</td>
                        <td style={{padding:6,color:r.late_count>0?"#b91c1c":"#0a7c42"}}>{r.late_count+"次"}</td>
                        <td style={{padding:6,color:r.late_total_minutes>0?"#b91c1c":"#ccc"}}>{r.late_total_minutes||0}分</td>
                        <td style={{padding:6}}>{r.leave_days>0?r.leave_days+"天":"-"}</td>
                        <td style={{padding:6}}>{r.overtime_hours||0}</td>
                        <td style={{padding:6,color:"#4361ee"}}>{r.overtime_comp_hours>0?r.overtime_comp_hours+"hr":"-"}</td>
                        <td style={{padding:6,fontWeight:600}}>{r.overtime_pay_amount>0?fmt(r.overtime_pay_amount):"-"}</td>
                        <td style={{padding:6}}>{r.amendment_count>0?r.amendment_count+"筆":"-"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OVERTIME */}
        {!ld && tab === "overtime" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>{"⏱ "+month+" 加班紀錄"}</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:10}}>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 12px"}}><div style={{fontSize:10,color:"#888"}}>筆數</div><div style={{fontSize:18,fontWeight:600}}>{otSum.count||0}</div></div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 12px"}}><div style={{fontSize:10,color:"#888"}}>總時數</div><div style={{fontSize:18,fontWeight:600}}>{Math.round((otSum.totalMinutes||0)/60*10)/10+"hr"}</div></div>
              <div style={{background:"#fff8e6",borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:"#8a6d00"}}>加班費</div><div style={{fontSize:18,fontWeight:600}}>{fmt(otSum.totalAmount)}</div></div>
              <div style={{background:"#e6f1fb",borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:"#185fa5"}}>補休餘額</div><div style={{fontSize:18,fontWeight:600,color:"#4361ee"}}>{(otSum.compHours||0)+"hr"}</div></div>
            </div>
            <div style={{display:"flex",gap:4,marginBottom:8}}>
              <button onClick={async()=>{const r=await ap("/api/admin/overtime",{action:"convert_expired"});alert("已轉換 "+r.converted+" 筆過期補休為加班費");load();}}
                style={{padding:"4px 10px",borderRadius:5,border:"1px solid #b45309",background:"transparent",color:"#b45309",fontSize:11,cursor:"pointer"}}>
                🔄 過期補休轉加班費
              </button>
            </div>
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#faf8f5"}}>{["日期","員工","門市","時數","類型","金額/補休","狀態","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                <tbody>{otRecords.map(r=>(
                  <tr key={r.id} style={{borderBottom:"1px solid #f0eeea"}}>
                    <td style={{padding:6}}>{r.date}</td>
                    <td style={{padding:6,fontWeight:500}}>{r.employees?r.employees.name:""}</td>
                    <td style={{padding:6}}>{r.stores?r.stores.name:""}</td>
                    <td style={{padding:6}}>{Math.round(r.overtime_minutes/60*10)/10+"hr"}</td>
                    <td style={{padding:6}}>
                      {r.comp_type==="comp" && !r.comp_used && !r.comp_converted && (
                        <span style={{background:"#e6f1fb",color:"#185fa5",padding:"1px 5px",borderRadius:4,fontSize:9}}>
                          {"補休 "+r.comp_hours+"hr"}
                          <br/><span style={{fontSize:8,color:"#888"}}>{"到期 "+r.comp_expiry_date}</span>
                        </span>
                      )}
                      {r.comp_type==="comp" && r.comp_used && (
                        <span style={{background:"#e6f9f0",color:"#0a7c42",padding:"1px 5px",borderRadius:4,fontSize:9}}>補休已使用</span>
                      )}
                      {r.comp_type==="comp" && r.comp_converted && (
                        <span style={{background:"#fef9c3",color:"#8a6d00",padding:"1px 5px",borderRadius:4,fontSize:9}}>過期→轉薪資</span>
                      )}
                      {r.comp_type==="pay" && (
                        <span style={{background:"#fff8e6",color:"#8a6d00",padding:"1px 5px",borderRadius:4,fontSize:9}}>{"加班費 "+fmt(r.amount)}</span>
                      )}
                      {r.comp_type==="pending" && (
                        <span style={{background:"#f0f0f0",color:"#888",padding:"1px 5px",borderRadius:4,fontSize:9}}>待選擇</span>
                      )}
                    </td>
                    <td style={{padding:6,fontWeight:600}}>
                      {r.comp_type==="pay"||r.comp_converted?fmt(r.amount):r.comp_type==="comp"?(r.comp_hours||0)+"hr":fmt(r.amount)}
                    </td>
                    <td style={{padding:6}}><Badge status={r.status} /></td>
                    <td style={{padding:6}}>
                      {r.status==="pending" && (
                        <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
                          <button onClick={async()=>{await ap("/api/admin/overtime",{action:"review",record_id:r.id,status:"approved",comp_type:"pay"});load();}}
                            style={{padding:"1px 5px",borderRadius:3,border:"none",background:"#b45309",color:"#fff",fontSize:9,cursor:"pointer"}}>💰加班費</button>
                          <button onClick={async()=>{await ap("/api/admin/overtime",{action:"review",record_id:r.id,status:"approved",comp_type:"comp"});load();}}
                            style={{padding:"1px 5px",borderRadius:3,border:"none",background:"#4361ee",color:"#fff",fontSize:9,cursor:"pointer"}}>🔄補休</button>
                          <button onClick={async()=>{await ap("/api/admin/overtime",{action:"review",record_id:r.id,status:"rejected"});load();}}
                            style={{padding:"1px 5px",borderRadius:3,border:"none",background:"#b91c1c",color:"#fff",fontSize:9,cursor:"pointer"}}>❌</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {(() => {
              const byEmp = {};
              otRecords.forEach(r => { const n = r.employees ? r.employees.name : "?"; byEmp[n] = (byEmp[n]||0) + (r.overtime_minutes||0); });
              const over = Object.entries(byEmp).filter(([,m]) => m > 46*60);
              return over.length > 0 ? (
                <div style={{background:"#fde8e8",borderRadius:6,padding:8,marginTop:8,fontSize:11,color:"#b91c1c"}}>
                  {"⚠️ 月加班超過46小時上限：" + over.map(([n,m]) => n+"（"+Math.round(m/60)+"hr）").join("、")}
                </div>
              ) : null;
            })()}
          </div>
        )}
        {!ld && tab === "payroll" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>{"💰 "+month+" 薪資"}
              <button onClick={()=>{
                exportCSV("薪資_"+month+".csv",["員工","出勤天","底薪","加班費","勞保","健保","補充保費","加項","扣項","實發"],
                  ae.map(e=>{const wd=att.filter(a=>a.employees&&a.employees.name===e.name&&a.type==="clock_in").length;const bp=e.monthly_salary?Number(e.monthly_salary):(e.hourly_rate?Number(e.hourly_rate)*wd*8:0);const ot=otRecords.filter(r=>r.employee_id===e.id&&(r.comp_type==="pay"||r.comp_converted)).reduce((s,r)=>s+Number(r.amount||0),0);const ls=e.labor_tier?LABOR_SELF[e.labor_tier-1]||0:0;const hs=e.health_tier?HEALTH_SELF[e.health_tier-1]||0:0;const suppH=e.employment_type==="parttime"&&bp>29500?Math.round(bp*0.0211):0;const da=Number(e.default_allowance||0);const dd=Number(e.default_deduction||0);return[e.name,wd,bp,ot,ls,hs,suppH,da,dd,bp+ot-ls-hs-suppH+da-dd];}));
              }} style={{marginLeft:8,padding:"2px 8px",borderRadius:4,border:"1px solid #ddd",background:"#fff",fontSize:10,cursor:"pointer"}}>📥 匯出CSV</button>
            </h3>
            <div style={{display:"flex",gap:4,marginBottom:8}}>
              <button onClick={async()=>{
                const [y,m]=month.split("-").map(Number);
                if(!confirm(month+" 薪資結算？"))return;
                await ap("/api/admin/payroll",{action:"generate",year:y,month:m,store_id:sf||undefined});
                load(); alert("薪資已結算並存檔");
              }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer"}}>
                📊 結算薪資
              </button>
              <button onClick={async()=>{
                const [y,m]=month.split("-").map(Number);
                if(!confirm("確定LINE發送薪資條？"))return;
                const r = await ap("/api/admin/payroll",{action:"send_line",year:y,month:m});
                alert("已發送 "+(r.sent||0)+" 位");
              }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #4361ee",background:"transparent",color:"#4361ee",fontSize:11,cursor:"pointer"}}>
                📱 LINE發送薪資條
              </button>
            </div>
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,minWidth:750}}>
                <thead><tr style={{background:"#faf8f5"}}>{["員工","出勤","底薪","加班費","補休","勞保","健保","補充保費","加項","扣項","實發","存"].map(h=><th key={h} style={{padding:"5px 4px",textAlign:"right",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                <tbody>{ae.map(e=>{
                  const wd = att.filter(a=>a.employees&&a.employees.name===e.name&&a.type==="clock_in").length;
                  const bp = e.monthly_salary ? Number(e.monthly_salary) : (e.hourly_rate ? Number(e.hourly_rate)*wd*8 : 0);
                  const ot = otRecords.filter(r=>r.employee_id===e.id&&(r.comp_type==="pay"||r.comp_converted)).reduce((s,r)=>s+Number(r.amount||0),0);
                  const compH = otRecords.filter(r=>r.employee_id===e.id&&r.comp_type==="comp"&&!r.comp_used&&!r.comp_converted).reduce((s,r)=>s+Number(r.comp_hours||0),0);
                  const ls = e.labor_tier ? LABOR_SELF[e.labor_tier-1]||0 : 0;
                  const hs = e.health_tier ? HEALTH_SELF[e.health_tier-1]||0 : 0;
                  const suppH = e.employment_type==="parttime"&&bp>29500?Math.round(bp*0.0211):0;
                  const da = Number(e.default_allowance||0);
                  const dd = Number(e.default_deduction||0);
                  const net = bp+ot-ls-hs-suppH+da-dd;
                  return (
                    <tr key={e.id} style={{borderBottom:"1px solid #f0eeea"}}>
                      <td style={{padding:"5px 4px",fontWeight:500,textAlign:"left"}}>{e.name}</td>
                      <td style={{padding:"5px 4px",textAlign:"right"}}>{wd+"天"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right"}}>{fmt(bp)}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:ot>0?"#b45309":"#ccc"}}>{ot>0?"+"+fmt(ot):"-"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:compH>0?"#4361ee":"#ccc"}}>{compH>0?compH+"hr":"-"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:"#888"}}>{ls>0?"-"+fmt(ls):"-"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:"#888"}}>{hs>0?"-"+fmt(hs):"-"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:suppH>0?"#b91c1c":"#ccc"}}>{suppH>0?"-"+fmt(suppH):"-"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right"}}>
                        <input type="number" id={"pa-"+e.id} defaultValue={e.default_allowance||""} placeholder="0"
                          style={{width:50,padding:1,borderRadius:3,border:"1px solid #ddd",fontSize:9,textAlign:"right"}} />
                      </td>
                      <td style={{padding:"5px 4px",textAlign:"right"}}>
                        <input type="number" id={"pd-"+e.id} defaultValue={e.default_deduction||""} placeholder="0"
                          style={{width:50,padding:1,borderRadius:3,border:"1px solid #ddd",fontSize:9,textAlign:"right"}} />
                      </td>
                      <td style={{padding:"5px 4px",textAlign:"right",fontWeight:700,fontSize:12,color:"#0a7c42"}}>{fmt(net)}</td>
                      <td style={{padding:"5px 4px",textAlign:"center"}}>
                        <button onClick={async()=>{
                          const allow=Number(document.getElementById("pa-"+e.id).value||0);
                          const deduct=Number(document.getElementById("pd-"+e.id).value||0);
                          await ap("/api/admin/employees",{action:"update",employee_id:e.id,default_allowance:allow,default_deduction:deduct});
                          alert(e.name+" 加項$"+allow+" 扣項$"+deduct+" 已儲存（下月自動帶入）");
                        }} style={{padding:"1px 5px",borderRadius:3,border:"1px solid #0a7c42",background:"transparent",color:"#0a7c42",fontSize:8,cursor:"pointer"}}>💾</button>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* REVIEWS 考核 */}
        {!ld && tab === "reviews" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>📝 季考核</h3>
            <div style={{display:"flex",gap:4,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
              <select id="rv-year" defaultValue={new Date().getFullYear()} style={{padding:"4px 8px",borderRadius:5,border:"1px solid #ddd",fontSize:11}}>
                {[2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <select id="rv-quarter" defaultValue={Math.ceil((new Date().getMonth()+1)/3)} style={{padding:"4px 8px",borderRadius:5,border:"1px solid #ddd",fontSize:11}}>
                {[1,2,3,4].map(q=><option key={q} value={q}>{"Q"+q}</option>)}
              </select>
              <button onClick={async()=>{
                const y=Number(document.getElementById("rv-year").value),q=Number(document.getElementById("rv-quarter").value);
                const r=await ap("/api/admin/reviews?year="+y+"&quarter="+q+(sf?"&store_id="+sf:""));
                setRvData(r.data||[]);
              }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#fff",fontSize:11,cursor:"pointer"}}>
                🔍 查詢
              </button>
              <button onClick={async()=>{
                const y=Number(document.getElementById("rv-year").value),q=Number(document.getElementById("rv-quarter").value);
                if(!confirm(y+" Q"+q+" 一鍵產生考核表？"))return;
                await ap("/api/admin/reviews",{action:"generate",year:y,quarter:q});
                const r=await ap("/api/admin/reviews?year="+y+"&quarter="+q);
                setRvData(r.data||[]);alert("已產生");
              }} style={{padding:"5px 12px",borderRadius:6,border:"none",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer"}}>
                🔄 一鍵產生
              </button>
              <button onClick={async()=>{
                const y=Number(document.getElementById("rv-year").value),q=Number(document.getElementById("rv-quarter").value);
                if(!confirm("全部核准？"))return;
                await ap("/api/admin/reviews",{action:"approve_all",year:y,quarter:q});
                const r=await ap("/api/admin/reviews?year="+y+"&quarter="+q);
                setRvData(r.data||[]);
              }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #0a7c42",background:"transparent",color:"#0a7c42",fontSize:11,cursor:"pointer"}}>
                ✅ 全部核准
              </button>
            </div>
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#faf8f5"}}>{["員工","門市","出勤/30","完成度/30","服務/20","違規/20","總分","係數","狀態"].map(h=>
                  <th key={h} style={{padding:6,textAlign:"center",fontWeight:500,color:"#666",fontSize:10}}>{h}</th>
                )}</tr></thead>
                <tbody>
                  {rvData.length===0 ? (
                    <tr><td colSpan={9} style={{padding:20,textAlign:"center",color:"#ccc",fontSize:11}}>請選擇季度後按「查詢」或「一鍵產生」</td></tr>
                  ) : rvData.map(r=>(
                    <tr key={r.id} style={{borderBottom:"1px solid #f0eeea",background:r.bonus_coefficient===0?"#fef9c3":"transparent"}}>
                      <td style={{padding:6,fontWeight:500}}>{r.employees?.name}</td>
                      <td style={{padding:6,fontSize:10}}>{r.stores?.name}</td>
                      <td style={{padding:6,textAlign:"center"}}>{r.attendance_score}</td>
                      <td style={{padding:6,textAlign:"center"}}>{r.performance_score}{r.performance_adjust!==0&&<span style={{fontSize:8,color:r.performance_adjust>0?"#0a7c42":"#b91c1c"}}>{(r.performance_adjust>0?"+":"")+r.performance_adjust}</span>}</td>
                      <td style={{padding:6,textAlign:"center"}}>{r.service_score}{r.service_adjust!==0&&<span style={{fontSize:8,color:r.service_adjust>0?"#0a7c42":"#b91c1c"}}>{(r.service_adjust>0?"+":"")+r.service_adjust}</span>}</td>
                      <td style={{padding:6,textAlign:"center"}}>{r.violation_score}</td>
                      <td style={{padding:6,textAlign:"center",fontWeight:700,color:r.total_score>=80?"#0a7c42":r.total_score>=70?"#b45309":"#b91c1c"}}>{r.total_score}</td>
                      <td style={{padding:6,textAlign:"center",fontWeight:600}}>{r.bonus_coefficient===0?"❌":"×"+r.bonus_coefficient}</td>
                      <td style={{padding:6,textAlign:"center"}}>{r.status==="approved"?"✅":r.status==="submitted"?"📤":"📝"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{fontSize:9,color:"#888",marginTop:6}}>出勤/違規=全自動　完成度/服務=主管可±5分調整（API adjust）</p>
          </div>
        )}

        {/* BONUS 獎金 */}
        {!ld && tab === "bonus" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>🏆 季獎金發放</h3>
            <div style={{display:"flex",gap:4,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
              <select id="bn-year" defaultValue={new Date().getFullYear()} style={{padding:"4px 8px",borderRadius:5,border:"1px solid #ddd",fontSize:11}}>
                {[2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <select id="bn-quarter" defaultValue={Math.ceil((new Date().getMonth()+1)/3)} style={{padding:"4px 8px",borderRadius:5,border:"1px solid #ddd",fontSize:11}}>
                {[1,2,3,4].map(q=><option key={q} value={q}>{"Q"+q}</option>)}
              </select>
              <button onClick={async()=>{
                const y=Number(document.getElementById("bn-year").value);
                const q=Number(document.getElementById("bn-quarter").value);
                const r=await ap("/api/admin/bonus?year="+y+"&quarter="+q);
                if(!r.stores){alert("無資料");return;}
                let msg="📊 業績達標率\n";
                r.stores.forEach(s=>{
                  msg+="\n🏠 "+s.name+(s.is_loss?" ❌虧損":" ✅")+"\n";
                  s.months.forEach(m=>{msg+="  "+m.month.slice(5)+"月 "+fmt(m.revenue)+" / "+fmt(m.target)+" = "+m.rate+"%\n";});
                  msg+="  Q淨利: "+fmt(s.q_net)+"\n";
                });
                alert(msg);
              }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#fff",fontSize:11,cursor:"pointer"}}>
                📊 查看達標率
              </button>
            </div>

            {auth.role==="admin" && (
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12,marginBottom:10}}>
                <h4 style={{fontSize:12,fontWeight:600,marginBottom:6}}>💰 總部填入各門市獎金總額</h4>
                <p style={{fontSize:9,color:"#888",marginBottom:6}}>參照損益表決定金額，虧損門市自動鎖定</p>
                {stores.map(s=>(
                  <div key={s.id} style={{display:"flex",gap:6,alignItems:"center",padding:"4px 0",borderBottom:"1px solid #f0eeea"}}>
                    <span style={{fontSize:11,fontWeight:500,width:80}}>{s.name}</span>
                    <input type="number" id={"bp-"+s.id} placeholder="Q總獎金"
                      style={{flex:1,padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}} />
                    <button onClick={async()=>{
                      const y=Number(document.getElementById("bn-year").value);
                      const q=Number(document.getElementById("bn-quarter").value);
                      const amt=Number(document.getElementById("bp-"+s.id).value||0);
                      await ap("/api/admin/bonus",{action:"set_pool",store_id:s.id,year:y,quarter:q,total_amount:amt});
                      alert(s.name+" 獎金池已設定 "+fmt(amt));
                    }} style={{padding:"3px 8px",borderRadius:4,border:"none",background:"#0a7c42",color:"#fff",fontSize:10,cursor:"pointer"}}>💾</button>
                  </div>
                ))}
                <div style={{display:"flex",gap:4,marginTop:8}}>
                  <button onClick={async()=>{
                    const y=Number(document.getElementById("bn-year").value);
                    const q=Number(document.getElementById("bn-quarter").value);
                    if(!confirm("計算Q"+q+"個人獎金？"))return;
                    const r=await ap("/api/admin/bonus",{action:"calculate",year:y,quarter:q});
                    alert("已計算 "+(r.calculated||0)+" 人");load();
                  }} style={{padding:"5px 12px",borderRadius:6,border:"none",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer"}}>
                    📊 計算個人獎金
                  </button>
                  <button onClick={async()=>{
                    const y=Number(document.getElementById("bn-year").value);
                    const q=Number(document.getElementById("bn-quarter").value);
                    if(!confirm("LINE發送獎金條？"))return;
                    const r=await ap("/api/admin/bonus",{action:"send_line",year:y,quarter:q});
                    alert("已發送 "+(r.sent||0)+" 位");
                  }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #4361ee",background:"transparent",color:"#4361ee",fontSize:11,cursor:"pointer"}}>
                    📱 LINE發送獎金條
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!ld && tab === "settlements" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>{"💰 "+month+" 日結 ("+stl.length+"筆)"}
              <button onClick={()=>{
                exportCSV("日結_"+month+".csv",["日期","門市","營收","現金","LINE Pay","TWQR","UberEat","悠遊卡","餐券","應存"],
                  stl.map(s=>[s.date,s.stores?.name,s.net_sales,s.cash_amount,s.line_pay_amount,s.twqr_amount,s.uber_eat_amount,s.easy_card_amount,s.meal_voucher_amount,s.cash_to_deposit]));
              }} style={{marginLeft:8,padding:"2px 8px",borderRadius:4,border:"1px solid #ddd",background:"#fff",fontSize:10,cursor:"pointer"}}>📥 匯出CSV</button>
            </h3>
            {stl.length > 0 && (
              <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"6px 10px",flex:1,minWidth:80}}>
                  <div style={{fontSize:9,color:"#888"}}>營收合計</div>
                  <div style={{fontSize:16,fontWeight:700,color:"#0a7c42"}}>{fmt(sum.total_net_sales)}</div>
                </div>
                <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"6px 10px",flex:1,minWidth:80}}>
                  <div style={{fontSize:9,color:"#888"}}>現金合計</div>
                  <div style={{fontSize:14,fontWeight:600}}>{fmt(sum.total_cash)}</div>
                </div>
                <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"6px 10px",flex:1,minWidth:80}}>
                  <div style={{fontSize:9,color:"#888"}}>應存合計</div>
                  <div style={{fontSize:14,fontWeight:600,color:"#b45309"}}>{fmt(sum.total_cash_to_deposit)}</div>
                </div>
              </div>
            )}
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,minWidth:700}}>
                <thead><tr style={{background:"#faf8f5"}}>{["日期","門市","營收","現金","LINE Pay","TWQR","UberEat","悠遊卡","餐券","應存"].map(h=><th key={h} style={{padding:"5px 4px",textAlign:"right",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                <tbody>{stl.map(s=>(
                  <tr key={s.id} style={{borderBottom:"1px solid #f0eeea"}}>
                    <td style={{padding:"5px 4px",textAlign:"right"}}>{s.date?.slice(5)}</td>
                    <td style={{padding:"5px 4px",textAlign:"right",fontWeight:500}}>{s.stores?s.stores.name:""}</td>
                    <td style={{padding:"5px 4px",textAlign:"right",fontWeight:700,color:"#0a7c42"}}>{fmt(s.net_sales)}</td>
                    <td style={{padding:"5px 4px",textAlign:"right"}}>{fmt(s.cash_amount)}</td>
                    <td style={{padding:"5px 4px",textAlign:"right",color:s.line_pay_amount>0?"#185fa5":"#ccc"}}>{s.line_pay_amount>0?fmt(s.line_pay_amount):"-"}</td>
                    <td style={{padding:"5px 4px",textAlign:"right",color:s.twqr_amount>0?"#0a7c42":"#ccc"}}>{s.twqr_amount>0?fmt(s.twqr_amount):"-"}</td>
                    <td style={{padding:"5px 4px",textAlign:"right",color:s.uber_eat_amount>0?"#0a7c42":"#ccc"}}>{s.uber_eat_amount>0?fmt(s.uber_eat_amount):"-"}</td>
                    <td style={{padding:"5px 4px",textAlign:"right",color:s.easy_card_amount>0?"#0a7c42":"#ccc"}}>{s.easy_card_amount>0?fmt(s.easy_card_amount):"-"}</td>
                    <td style={{padding:"5px 4px",textAlign:"right",color:s.meal_voucher_amount>0?"#0a7c42":"#ccc"}}>{s.meal_voucher_amount>0?fmt(s.meal_voucher_amount):"-"}</td>
                    <td style={{padding:"5px 4px",textAlign:"right",fontWeight:600,color:"#b45309"}}>{fmt(s.cash_to_deposit)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* DEPOSITS */}
        {!ld && tab === "deposits" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>{"🏦 "+month+" 存款"}</h3>
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#faf8f5"}}>{["日期","門市","金額","應存","差異","說明","狀態"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                <tbody>{dep.map(d=>(
                  <tr key={d.id} style={{borderBottom:"1px solid #f0eeea",background:Math.abs(d.difference||0)>500?"#fef9f9":"transparent"}}>
                    <td style={{padding:6}}>{d.deposit_date}</td>
                    <td style={{padding:6}}>{d.stores?d.stores.name:""}</td>
                    <td style={{padding:6,fontWeight:600}}>{fmt(d.amount)}</td>
                    <td style={{padding:6}}>{fmt(d.expected_cash)}</td>
                    <td style={{padding:6,color:Math.abs(d.difference||0)>500?"#b91c1c":"#0a7c42",fontWeight:600}}>{fmt(d.difference)}</td>
                    <td style={{padding:6}}>
                      {Math.abs(d.difference||0)>500 ? (
                        <input defaultValue={d.difference_explanation||""} placeholder="請說明差異原因"
                          onBlur={e=>{if(e.target.value)ap("/api/admin/deposits",{action:"update",deposit_id:d.id,difference_explanation:e.target.value});}}
                          style={{padding:2,borderRadius:3,border:"1px solid #fbbf24",fontSize:10,width:100,background:"#fffbeb"}} />
                      ) : <span style={{fontSize:10,color:"#ccc"}}>-</span>}
                    </td>
                    <td style={{padding:6}}><Badge status={d.status} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXPENSES */}
        {!ld && tab === "expenses" && (
          <div>
            <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
              {[["all","全部"],["petty_cash","💰零用金"],["vendor","📦月結"],["hq_advance","🏢代付"]].map(([k,l])=>(
                <button key={k} onClick={()=>setExpType(k)} style={{padding:"4px 10px",borderRadius:5,border:"1px solid #ddd",background:expType===k?"#1a1a1a":"#fff",color:expType===k?"#fff":"#666",fontSize:11,cursor:"pointer"}}>{l}</button>
              ))}
              <input value={expSearch} onChange={e=>setExpSearch(e.target.value)} placeholder="搜尋廠商..."
                style={{padding:"4px 8px",borderRadius:5,border:"1px solid #ddd",fontSize:11,width:120}} />
              <button onClick={()=>{
                const filtered = exps.filter(e=>(expType==="all"||e.expense_type===expType)&&(!expSearch||(e.vendor_name||"").includes(expSearch)));
                const csv = "\uFEFF日期,門市,類型,廠商,提交人,金額,狀態\n" + filtered.map(e=>[e.date,e.stores?e.stores.name:"",e.expense_type,e.vendor_name||"",e.submitted_by_name||"",e.amount,e.status].join(",")).join("\n");
                const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download = month+"_費用.csv"; a.click();
              }} style={{padding:"4px 10px",borderRadius:5,border:"1px solid #0a7c42",background:"transparent",color:"#0a7c42",fontSize:11,cursor:"pointer"}}>📥CSV</button>
            </div>
            {/* 統計卡片 */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
              <div style={{background:"#fff8e6",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:10,color:"#8a6d00"}}>💰 零用金</div>
                <div style={{fontSize:15,fontWeight:600}}>{fmt(exps.filter(e=>e.expense_type==="petty_cash").reduce((s,e)=>s+Number(e.amount||0),0))}</div>
              </div>
              <div style={{background:"#e6f1fb",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:10,color:"#185fa5"}}>📦 月結</div>
                <div style={{fontSize:15,fontWeight:600}}>{fmt(exps.filter(e=>e.expense_type==="vendor").reduce((s,e)=>s+Number(e.amount||0),0))}</div>
              </div>
              <div style={{background:"#fde8e8",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:10,color:"#b91c1c"}}>🏢 總部代付</div>
                <div style={{fontSize:15,fontWeight:600}}>{fmt(exps.filter(e=>e.expense_type==="hq_advance").reduce((s,e)=>s+Number(e.amount||0),0))}</div>
              </div>
            </div>
            {/* ✦10 費用預算進度 */}
            {(() => {
              const totalExp = exps.reduce((s,e)=>s+Number(e.amount||0),0);
              const budgetStores = sf ? stores.filter(s=>s.id===sf) : stores;
              const hasBudget = budgetStores.some(s=>s.monthly_expense_budget>0);
              if (!hasBudget) return null;
              return (
                <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                  {budgetStores.filter(s=>s.monthly_expense_budget>0).map(s=>{
                    const storeExp = exps.filter(e=>e.store_id===s.id).reduce((sum,e)=>sum+Number(e.amount||0),0);
                    const pct = Math.round(storeExp/s.monthly_expense_budget*100);
                    return (
                      <div key={s.id} style={{flex:1,minWidth:140,background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 12px"}}>
                        <div style={{fontSize:10,color:"#888"}}>{s.name+" 預算"}</div>
                        <div style={{fontSize:12,fontWeight:600}}>{fmt(storeExp)+" / "+fmt(s.monthly_expense_budget)}</div>
                        <div style={{height:6,background:"#f0f0f0",borderRadius:3,marginTop:4}}>
                          <div style={{height:"100%",width:Math.min(100,pct)+"%",background:pct>100?"#b91c1c":pct>80?"#fbbf24":"#0a7c42",borderRadius:3}} />
                        </div>
                        <div style={{fontSize:9,color:pct>100?"#b91c1c":pct>80?"#b45309":"#888",marginTop:2}}>{pct+"%"}{pct>100?" ⚠️超標":pct>80?" ⚠️注意":""}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {/* 分類圖表 */}
            {(() => {
              const catTotals = {};
              exps.forEach(e => { const c = e.category_suggestion || "未分類"; catTotals[c] = (catTotals[c]||0) + Number(e.amount||0); });
              const sorted = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
              const total = sorted.reduce((s,[,v]) => s+v, 0);
              const colors = ["#4361ee","#0a7c42","#b45309","#b91c1c","#8a6d00","#993556","#185fa5","#666"];
              return sorted.length > 0 ? (
                <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12,marginBottom:8}}>
                  <h4 style={{fontSize:12,fontWeight:500,marginBottom:8}}>📊 費用分類佔比</h4>
                  <div style={{height:12,borderRadius:6,overflow:"hidden",display:"flex",marginBottom:8}}>
                    {sorted.map(([cat,amt],i) => (
                      <div key={cat} style={{width:(amt/total*100)+"%",background:colors[i%colors.length],minWidth:2}} title={cat+" "+fmt(amt)} />
                    ))}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {sorted.slice(0,8).map(([cat,amt],i) => (
                      <div key={cat} style={{display:"flex",alignItems:"center",gap:3,fontSize:10}}>
                        <div style={{width:8,height:8,borderRadius:2,background:colors[i%colors.length]}} />
                        <span>{cat}</span>
                        <span style={{fontWeight:600}}>{fmt(amt)}</span>
                        <span style={{color:"#888"}}>{"("+Math.round(amt/total*100)+"%)"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
            {/* 費用列表 */}
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#faf8f5"}}>{["日期","門市","類型","廠商","提交人","金額","狀態","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {exps.filter(e=>(expType==="all"||e.expense_type===expType)&&(!expSearch||(e.vendor_name||"").includes(expSearch))).map(e=>(
                    <tr key={e.id} style={{borderBottom:"1px solid #f0eeea"}}>
                      <td style={{padding:6}}>{e.date}</td>
                      <td style={{padding:6}}>{e.stores?e.stores.name:""}</td>
                      <td style={{padding:6}}>{e.expense_type==="vendor"?"📦":e.expense_type==="hq_advance"?"🏢":"💰"}</td>
                      <td style={{padding:6}}>
                        <div style={{fontWeight:500}}>{e.vendor_name||"-"}</div>
                        {e.invoice_number && <div style={{fontSize:9,color:"#4361ee"}}>{"🧾"+e.invoice_number}</div>}
                      </td>
                      <td style={{padding:6,fontSize:10}}>{e.submitted_by_name||"-"}</td>
                      <td style={{padding:6,fontWeight:600,cursor:e.image_url?"pointer":"default",textDecoration:e.image_url?"underline":"none"}}
                        onClick={()=>e.image_url&&setSi(e.image_url)}>
                        {fmt(e.amount)}
                      </td>
                      <td style={{padding:6}}><Badge status={e.status} /></td>
                      <td style={{padding:6}}>
                        {e.status==="pending" && (
                          <span>
                            <button onClick={()=>rvExp(e.id,"approved")} style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#0a7c42",color:"#fff",fontSize:9,cursor:"pointer",marginRight:2}}>✅</button>
                            <button onClick={()=>rvExp(e.id,"rejected")} style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#b91c1c",color:"#fff",fontSize:9,cursor:"pointer"}}>❌</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAYMENTS */}
        {!ld && tab === "payments" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>{"💳 "+month+" 撥款"}</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
              <div style={{background:"#fff8e6",borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:"#8a6d00"}}>待撥款</div><div style={{fontSize:18,fontWeight:600,color:"#b91c1c"}}>{fmt(pmtSum.pending)}</div></div>
              <div style={{background:"#e6f9f0",borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:"#0a7c42"}}>已撥款</div><div style={{fontSize:18,fontWeight:600,color:"#0a7c42"}}>{fmt(pmtSum.paid)}</div></div>
            </div>
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#faf8f5"}}>{["類型","對象","金額","狀態","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                <tbody>{pmtRecords.map(p=>(
                  <tr key={p.id} style={{borderBottom:"1px solid #f0eeea"}}>
                    <td style={{padding:6}}>{p.type}</td>
                    <td style={{padding:6,fontWeight:500}}>{p.recipient||(p.employees?p.employees.name:"-")}</td>
                    <td style={{padding:6,fontWeight:600}}>{fmt(p.amount)}</td>
                    <td style={{padding:6}}><Badge status={p.status} /></td>
                    <td style={{padding:6}}>
                      {p.status==="pending" && (
                        <button onClick={async()=>{await ap("/api/admin/payments",{action:"mark_paid",payment_id:p.id});load();}}
                          style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#0a7c42",color:"#fff",fontSize:9,cursor:"pointer"}}>✅已撥</button>
                      )}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* PNL */}
        {!ld && tab === "pnl" && pnl && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>{"📊 "+month+" 損益表"}</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
              <div style={{background:"#e6f9f0",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"#0a7c42"}}>總收入</div>
                <div style={{fontSize:18,fontWeight:700,color:"#0a7c42"}}>{fmt(pnl.profit?.total_income)}</div>
              </div>
              <div style={{background:"#fde8e8",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"#b91c1c"}}>總支出</div>
                <div style={{fontSize:18,fontWeight:700,color:"#b91c1c"}}>{fmt(pnl.expenses?.total)}</div>
              </div>
              <div style={{background:pnl.profit?.net>=0?"#e6f9f0":"#fde8e8",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9}}>淨利（{pnl.profit?.margin}%）</div>
                <div style={{fontSize:18,fontWeight:700,color:pnl.profit?.net>=0?"#0a7c42":"#b91c1c"}}>{fmt(pnl.profit?.net)}</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12}}>
                <h4 style={{fontSize:12,color:"#0a7c42",marginBottom:6}}>收入明細</h4>
                <Row l="門市營收" v={<b>{fmt(pnl.revenue?.total)}</b>} />
                {pnl.revenue?.b2b > 0 && <Row l="B2B批發" v={fmt(pnl.revenue.b2b)} />}
                {pnl.revenue?.oem > 0 && <Row l="OEM代工" v={fmt(pnl.revenue.oem)} />}
              </div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12}}>
                <h4 style={{fontSize:12,color:"#b91c1c",marginBottom:6}}>支出明細</h4>
                <Row l="月結廠商" v={fmt(pnl.expenses?.vendor)} />
                <Row l="零用金" v={fmt(pnl.expenses?.petty_cash)} />
                {pnl.expenses?.hq_advance > 0 && <Row l="總部代付" v={fmt(pnl.expenses.hq_advance)} />}
                <Row l="人事成本" v={fmt(pnl.expenses?.labor)} />
              </div>
            </div>
            {/* ✦26 門市比較 */}
            {pnl.storeComparison && pnl.storeComparison.length > 0 && (
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12,marginBottom:10}}>
                <h4 style={{fontSize:12,fontWeight:600,marginBottom:6}}>🏠 門市別比較</h4>
                <div style={{display:"grid",gridTemplateColumns:"repeat("+pnl.storeComparison.length+",1fr)",gap:6}}>
                  {pnl.storeComparison.map(s=>(
                    <div key={s.name} style={{textAlign:"center",padding:6,background:"#faf8f5",borderRadius:6}}>
                      <div style={{fontSize:11,fontWeight:600,marginBottom:4}}>{s.name}</div>
                      <div style={{fontSize:10}}>收入 <b style={{color:"#0a7c42"}}>{fmt(s.revenue)}</b></div>
                      <div style={{fontSize:10}}>支出 <b style={{color:"#b91c1c"}}>{fmt(s.expense)}</b></div>
                      <div style={{fontSize:12,fontWeight:700,color:s.profit>=0?"#0a7c42":"#b91c1c",marginTop:2}}>{fmt(s.profit)}</div>
                      <div style={{fontSize:9,color:"#888"}}>{s.margin}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* ✦27 趨勢圖 */}
            {pnl.trend && pnl.trend.length > 0 && (
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12}}>
                <h4 style={{fontSize:12,fontWeight:600,marginBottom:6}}>📈 營收趨勢（近6月）</h4>
                <div style={{display:"flex",alignItems:"flex-end",gap:4,height:100}}>
                  {(() => {
                    const maxR = Math.max(...pnl.trend.map(t=>t.revenue), 1);
                    return pnl.trend.map(t => (
                      <div key={t.month} style={{flex:1,textAlign:"center"}}>
                        <div style={{fontSize:9,fontWeight:600,marginBottom:2}}>{t.revenue>0?fmt(t.revenue):""}</div>
                        <div style={{height:Math.max(4, t.revenue/maxR*80),background:t.month===month?"#0a7c42":"#d1e7dd",borderRadius:3,minHeight:4}} />
                        <div style={{fontSize:8,color:"#888",marginTop:2}}>{t.month.slice(5)}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* RECIPES */}
        {!ld && tab === "recipes" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>📋 配方管理</h3>
            <button onClick={async()=>{const n=prompt("產品名稱：");if(!n)return;const c=prompt("分類：","泡芙");const y=prompt("每批產出：","50");const p=prompt("售價：","0");await ap("/api/admin/recipes",{action:"create",name:n,category:c,yield_qty:Number(y),selling_price:Number(p)});load();}}
              style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>＋新增配方</button>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:8}}>
              {recipeList.map(r=>(
                <div key={r.id} style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12}}>
                  <div style={{fontSize:13,fontWeight:600}}>{r.name}</div>
                  <div style={{fontSize:10,color:"#888"}}>{r.category} · 每批{r.yield_qty}{r.yield_unit||"個"}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,fontSize:10,marginTop:4}}>
                    <div><span style={{color:"#888"}}>成本</span><div style={{fontWeight:600}}>{fmt(r.cost_per_unit)}</div></div>
                    <div><span style={{color:"#888"}}>售價</span><div style={{fontWeight:600}}>{fmt(r.selling_price)}</div></div>
                    <div><span style={{color:"#888"}}>毛利</span><div style={{fontWeight:600,color:"#0a7c42"}}>{r.margin_percent?r.margin_percent+"%":"-"}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRODUCTION */}
        {!ld && tab === "production" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>{"🏭 "+month+" 生產"}</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 12px"}}><div style={{fontSize:10,color:"#888"}}>工單</div><div style={{fontSize:18,fontWeight:600}}>{prodSum.count||0}</div></div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 12px"}}><div style={{fontSize:10,color:"#888"}}>計劃/實際</div><div style={{fontSize:18,fontWeight:600}}>{(prodSum.totalPlanned||0)+"/"+(prodSum.totalActual||0)}</div></div>
              <div style={{background:"#e6f9f0",borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:"#888"}}>良率</div><div style={{fontSize:18,fontWeight:700,color:"#0a7c42"}}>{(prodSum.avgYield||0)+"%"}</div></div>
            </div>
            <button onClick={async()=>{const rn=prompt("配方名稱：");if(!rn)return;const qty=prompt("數量：","50");await ap("/api/admin/production",{action:"create",recipe_name:rn,planned_qty:Number(qty),production_date:new Date().toLocaleDateString("sv-SE")});load();}}
              style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>＋新增工單</button>
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#faf8f5"}}>{["單號","產品","計劃","實際","良率","狀態","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                <tbody>{prodList.map(p=>(
                  <tr key={p.id} style={{borderBottom:"1px solid #f0eeea"}}>
                    <td style={{padding:6,fontSize:10}}>{p.order_number}</td>
                    <td style={{padding:6,fontWeight:500}}>{p.recipe_name}</td>
                    <td style={{padding:6}}>{p.planned_qty}</td>
                    <td style={{padding:6,fontWeight:600}}>{p.actual_qty||"-"}</td>
                    <td style={{padding:6}}>{p.yield_rate?p.yield_rate+"%":"-"}</td>
                    <td style={{padding:6}}><Badge status={p.status} /></td>
                    <td style={{padding:6}}>
                      {p.status==="planned"&&<button onClick={async()=>{await ap("/api/admin/production",{action:"start",order_id:p.id});load();}} style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#4361ee",color:"#fff",fontSize:9,cursor:"pointer"}}>開工</button>}
                      {p.status==="in_progress"&&<button onClick={async()=>{const q=prompt("實際產出：");if(!q)return;await ap("/api/admin/production",{action:"complete",order_id:p.id,actual_qty:Number(q)});load();}} style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#0a7c42",color:"#fff",fontSize:9,cursor:"pointer"}}>完工</button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* INVENTORY */}
        {!ld && tab === "inventory" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>📊 庫存管理</h3>
            <div style={{display:"flex",gap:4,marginBottom:8}}>
              <button onClick={async()=>{const n=prompt("品項名稱：");if(!n)return;const t=prompt("類型(raw_material/finished/packaging)：","raw_material");const u=prompt("單位：","個");const c=prompt("單位成本：","0");const ss=prompt("安全庫存：","0");await ap("/api/admin/inventory",{action:"create",name:n,type:t,unit:u,cost_per_unit:Number(c),safe_stock:Number(ss)});load();}}
                style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer"}}>＋新增品項</button>
              <button onClick={async()=>{const from=prompt("來源門市ID：");const to=prompt("目標門市ID：");const item=prompt("品項ID：");const qty=prompt("數量：");if(!from||!to||!item||!qty)return;await ap("/api/admin/inventory",{action:"movement",item_id:item,store_id:from,type:"transfer_out",quantity:-Number(qty),notes:"調撥至其他門市"});await ap("/api/admin/inventory",{action:"movement",item_id:item,store_id:to,type:"transfer_in",quantity:Number(qty),notes:"從其他門市調入"});alert("調撥完成");load();}}
                style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"transparent",color:"#4361ee",fontSize:11,cursor:"pointer"}}>🔄 門市調撥</button>
            </div>
            {/* ✦19 效期警示 */}
            {invItems.filter(i=>i.expiry_days>0).length>0 && (
              <div style={{background:"#fef9c3",borderRadius:6,padding:8,marginBottom:8,fontSize:10}}>
                {"⚠️ 有效期品項："+invItems.filter(i=>i.expiry_days>0).map(i=>i.name+"("+i.expiry_days+"天)").join("、")}
              </div>
            )}
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#faf8f5"}}>{["品項","類型","庫存","安全量","單價","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                <tbody>{invItems.map(i=>(
                  <tr key={i.id} style={{borderBottom:"1px solid #f0eeea",background:i.safe_stock>0&&i.current_stock<=i.safe_stock?"#fef9c3":"transparent"}}>
                    <td style={{padding:6,fontWeight:500}}>{i.name}{i.safe_stock>0&&i.current_stock<=i.safe_stock&&<span style={{color:"#b91c1c",fontSize:9}}> ⚠️低</span>}</td>
                    <td style={{padding:6,fontSize:10}}>{i.type==="raw_material"?"原料":i.type==="finished"?"成品":"包材"}</td>
                    <td style={{padding:6,fontWeight:600}}>{i.current_stock+" "+(i.unit||"")}</td>
                    <td style={{padding:6}}>{i.safe_stock||"-"}</td>
                    <td style={{padding:6}}>{fmt(i.cost_per_unit)}</td>
                    <td style={{padding:6,whiteSpace:"nowrap"}}>
                      <button onClick={async()=>{const q=prompt("入庫數量：");if(!q)return;await ap("/api/admin/inventory",{action:"movement",item_id:i.id,store_id:sf||null,type:"purchase",quantity:Number(q),notes:"手動入庫"});load();}}
                        style={{padding:"1px 6px",borderRadius:3,border:"1px solid #0a7c42",background:"transparent",fontSize:9,cursor:"pointer",color:"#0a7c42"}}>+入庫</button>
                      <button onClick={async()=>{const q=prompt("出庫數量：");if(!q)return;await ap("/api/admin/inventory",{action:"movement",item_id:i.id,store_id:sf||null,type:"usage",quantity:-Number(q),notes:"手動出庫"});load();}}
                        style={{padding:"1px 6px",borderRadius:3,border:"1px solid #b91c1c",background:"transparent",fontSize:9,cursor:"pointer",color:"#b91c1c",marginLeft:2}}>-出庫</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {!ld && tab === "products" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>🏷️ 產品管理</h3>
            <button onClick={async()=>{
              const n=prompt("產品名稱：");if(!n)return;
              const c=prompt("分類（泡芙/餅乾/冰淇淋/棕櫚糖/飲品/其他）：","泡芙");
              await ap("/api/admin/products",{action:"create",name:n,category:c});load();
            }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>
              ＋新增產品
            </button>
            {productList.map(p=>(
              <div key={p.id} style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12,marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div>
                    <span style={{fontSize:14,fontWeight:600}}>{p.name}</span>
                    <span style={{fontSize:10,color:"#888",marginLeft:6,background:"#faf8f5",padding:"1px 6px",borderRadius:3}}>{p.category||""}</span>
                    <button onClick={async()=>{
                      const n=prompt("修改產品名稱：",p.name);if(!n)return;
                      const c=prompt("分類：",p.category||"");
                      await ap("/api/admin/products",{action:"update",product_id:p.id,name:n,category:c});load();
                    }} style={{fontSize:9,color:"#4361ee",background:"none",border:"none",cursor:"pointer",marginLeft:4}}>✏️</button>
                    <button onClick={async()=>{
                      if(!confirm("刪除產品「"+p.name+"」及所有規格？"))return;
                      await ap("/api/admin/products",{action:"delete",product_id:p.id});load();
                    }} style={{fontSize:9,color:"#b91c1c",background:"none",border:"none",cursor:"pointer"}}>🗑</button>
                  </div>
                  <button onClick={async()=>{
                    const sn=prompt("規格名稱（如：原味6入）：");if(!sn)return;
                    const u=prompt("單位：","盒");
                    const rp=prompt("零售價：","0");
                    const wp=prompt("批發價(B2B)：","0");
                    const dp=prompt("經銷價：","0");
                    const op=prompt("代工價(OEM)：","0");
                    const cp=prompt("成本價：","0");
                    await ap("/api/admin/products",{action:"add_variant",product_id:p.id,spec_name:sn,unit:u,retail_price:Number(rp),wholesale_price:Number(wp),dealer_price:Number(dp),oem_price:Number(op),cost_price:Number(cp)});
                    load();
                  }} style={{padding:"3px 8px",borderRadius:4,border:"1px solid #4361ee",background:"transparent",color:"#4361ee",fontSize:10,cursor:"pointer"}}>
                    ＋規格
                  </button>
                </div>
                {(p.variants||[]).length > 0 ? (
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                    <thead><tr style={{background:"#faf8f5"}}>{["規格","單位","零售價","批發價","經銷價","代工價","成本","毛利率","操作"].map(h=><th key={h} style={{padding:4,textAlign:"center",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                    <tbody>{(p.variants||[]).map(v=>{
                      const margin=v.retail_price>0?Math.round((v.retail_price-v.cost_price)/v.retail_price*100):0;
                      return (
                        <tr key={v.id} style={{borderBottom:"1px solid #f0eeea"}}>
                          <td style={{padding:4,fontWeight:500}}>{v.spec_name}{v.sku&&<span style={{fontSize:8,color:"#ccc",marginLeft:3}}>{v.sku}</span>}</td>
                          <td style={{padding:4,textAlign:"center"}}>{v.unit}</td>
                          <td style={{padding:4,textAlign:"center",color:"#0a7c42",fontWeight:600}}>{fmt(v.retail_price)}</td>
                          <td style={{padding:4,textAlign:"center",color:"#185fa5"}}>{fmt(v.wholesale_price)}</td>
                          <td style={{padding:4,textAlign:"center",color:"#8a6d00"}}>{v.dealer_price>0?fmt(v.dealer_price):"-"}</td>
                          <td style={{padding:4,textAlign:"center",color:"#993556"}}>{v.oem_price>0?fmt(v.oem_price):"-"}</td>
                          <td style={{padding:4,textAlign:"center",color:"#888"}}>{fmt(v.cost_price)}</td>
                          <td style={{padding:4,textAlign:"center",fontWeight:600,color:margin>=50?"#0a7c42":margin>=30?"#b45309":"#b91c1c"}}>{margin+"%"}</td>
                          <td style={{padding:4,textAlign:"center"}}>
                            <button onClick={async()=>{
                              const rp=prompt("零售價：",v.retail_price);if(rp===null)return;
                              const wp=prompt("批發價：",v.wholesale_price);
                              const dp=prompt("經銷價：",v.dealer_price||0);
                              const op=prompt("代工價：",v.oem_price);
                              const cp=prompt("成本價：",v.cost_price);
                              await ap("/api/admin/products",{action:"update_variant",variant_id:v.id,retail_price:Number(rp),wholesale_price:Number(wp||0),dealer_price:Number(dp||0),oem_price:Number(op||0),cost_price:Number(cp||0)});
                              load();
                            }} style={{fontSize:9,color:"#4361ee",background:"none",border:"none",cursor:"pointer"}}>✏️</button>
                            <button onClick={async()=>{if(!confirm("刪除此規格？"))return;await ap("/api/admin/products",{action:"delete_variant",variant_id:v.id});load();}}
                              style={{fontSize:9,color:"#b91c1c",background:"none",border:"none",cursor:"pointer"}}>✕</button>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                ) : (
                  <div style={{fontSize:10,color:"#ccc",textAlign:"center",padding:8}}>尚無規格，請點「＋規格」新增</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CLIENTS */}
        {!ld && tab === "clients" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>👥 客戶管理</h3>
            <button onClick={async()=>{const n=prompt("客戶名稱：");if(!n)return;const t=prompt("類型(oem/b2b)：","b2b");const p=prompt("聯絡人：","");const ph=prompt("電話：","");await ap("/api/admin/clients",{action:"create",name:n,type:t,contact_person:p,phone:ph});load();}}
              style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>＋新增客戶</button>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:8}}>
              {clientList.map(c=>(
                <div key={c.id} style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:13,fontWeight:600}}>{c.name}</div>
                    <div style={{display:"flex",gap:2,alignItems:"center"}}>
                      <Badge status={c.type==="oem"?"planned":c.type==="b2b"?"approved":"pending"} />
                      <button onClick={async()=>{
                        const n=prompt("客戶名稱：",c.name);if(!n)return;
                        const p=prompt("聯絡人：",c.contact_person||"");
                        const ph=prompt("電話：",c.phone||"");
                        const addr=prompt("地址：",c.address||"");
                        const tax=prompt("統編：",c.tax_id||"");
                        const pt=prompt("付款條件：",c.payment_terms||"");
                        await ap("/api/admin/clients",{action:"update",client_id:c.id,name:n,contact_person:p,phone:ph,address:addr,tax_id:tax,payment_terms:pt});load();
                      }} style={{fontSize:10,color:"#4361ee",background:"none",border:"none",cursor:"pointer"}}>✏️</button>
                      <button onClick={async()=>{
                        if(!confirm("刪除客戶「"+c.name+"」？"))return;
                        await ap("/api/admin/clients",{action:"delete",client_id:c.id});load();
                      }} style={{fontSize:10,color:"#b91c1c",background:"none",border:"none",cursor:"pointer"}}>🗑</button>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:"#888"}}>{c.contact_person}{c.phone?" · "+c.phone:""}</div>
                  <div style={{fontSize:10,color:"#888"}}>{c.payment_terms||""}{c.tax_id?" · 統編"+c.tax_id:""}{c.address?" · "+c.address:""}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ORDERS */}
        {!ld && tab === "orders" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>📝 訂單管理</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:10}}>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 12px"}}><div style={{fontSize:10,color:"#888"}}>訂單數</div><div style={{fontSize:18,fontWeight:600}}>{orderSum.count||0}</div></div>
              <div style={{background:"#fde8e8",borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:"#b91c1c"}}>應收帳款</div><div style={{fontSize:18,fontWeight:700,color:"#b91c1c"}}>{fmt(orderSum.unpaid)}</div></div>
              {/* ✦22 帳齡分析 */}
              {(() => {
                const today = new Date();
                const aging = {a:0,b:0,c:0,d:0};
                orderList.filter(o=>o.payment_status!=="paid").forEach(o => {
                  const days = Math.floor((today - new Date(o.order_date||o.created_at)) / 86400000);
                  if (days<=30) aging.a += Number(o.total_amount||0);
                  else if (days<=60) aging.b += Number(o.total_amount||0);
                  else if (days<=90) aging.c += Number(o.total_amount||0);
                  else aging.d += Number(o.total_amount||0);
                });
                return (
                  <>
                    <div style={{background:"#e6f9f0",borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:9,color:"#0a7c42"}}>0-30天</div><div style={{fontSize:14,fontWeight:600,color:"#0a7c42"}}>{fmt(aging.a)}</div></div>
                    <div style={{background:aging.d>0?"#fde8e8":"#fff8e6",borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:9,color:aging.d>0?"#b91c1c":"#8a6d00"}}>{"31-60" + (aging.c+aging.d>0?" / 60+":"")}</div><div style={{fontSize:14,fontWeight:600,color:aging.d>0?"#b91c1c":"#8a6d00"}}>{fmt(aging.b+aging.c+aging.d)}</div></div>
                  </>
                );
              })()}
            </div>
            <div style={{display:"flex",gap:4,marginBottom:8}}>
              <button onClick={async()=>{if(!clientList.length){alert("請先新增客戶");return;}const cn=prompt("客戶("+clientList.map(c=>c.name).join("/")+")：");const cl=clientList.find(c=>c.name.includes(cn));if(!cl)return alert("找不到");const pn=prompt("產品：");const q=prompt("數量：");const pr=prompt("單價：");const tt=prompt("含稅/未稅(included/excluded)：","included");await ap("/api/admin/orders",{action:"create",client_id:cl.id,type:cl.type==="oem"?"oem":"b2b",tax_type:tt,items:[{product_name:pn,quantity:Number(q),unit_price:Number(pr)}]});load();}}
                style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer"}}>＋新增訂單</button>
            </div>
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#faf8f5"}}>{["單號","客戶","小計","稅額","總額","稅別","帳齡","狀態","付款","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                <tbody>{orderList.map(o=>{
                  const days = Math.floor((new Date() - new Date(o.order_date||o.created_at)) / 86400000);
                  const agingColor = days>90?"#b91c1c":days>60?"#b45309":days>30?"#8a6d00":"#0a7c42";
                  return (
                  <tr key={o.id} style={{borderBottom:"1px solid #f0eeea"}}>
                    <td style={{padding:6,fontSize:10}}>{o.order_number}</td>
                    <td style={{padding:6,fontWeight:500}}>{o.clients?o.clients.name:""}</td>
                    <td style={{padding:6,fontSize:10}}>{fmt(o.subtotal||o.total_amount)}</td>
                    <td style={{padding:6,fontSize:10,color:"#888"}}>{o.tax_amount>0?fmt(o.tax_amount):"-"}</td>
                    <td style={{padding:6,fontWeight:600}}>{fmt(o.total_amount)}</td>
                    <td style={{padding:6,fontSize:9,color:"#888"}}>{o.tax_type==="excluded"?"未稅+5%":"含稅"}</td>
                    <td style={{padding:6,fontSize:10,color:agingColor,fontWeight:600}}>{days+"天"}</td>
                    <td style={{padding:6}}><Badge status={o.status} /></td>
                    <td style={{padding:6}}><Badge status={o.payment_status} /></td>
                    <td style={{padding:6,whiteSpace:"nowrap"}}>
                      {o.status==="confirmed"&&<button onClick={async()=>{await ap("/api/admin/orders",{action:"update_status",order_id:o.id,status:"shipped"});load();}} style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#4361ee",color:"#fff",fontSize:9,cursor:"pointer"}}>出貨</button>}
                      {o.payment_status!=="paid"&&<button onClick={async()=>{await ap("/api/admin/orders",{action:"update_status",order_id:o.id,status:"paid",paid_amount:o.total_amount});load();}} style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#b45309",color:"#fff",fontSize:9,cursor:"pointer",marginLeft:2}}>收款</button>}
                      {/* ✦23 訂單→工單 */}
                      {o.status==="confirmed"&&<button onClick={async()=>{const pn=o.items?.[0]?.product_name||prompt("產品名稱：");if(!pn)return;await ap("/api/admin/production",{action:"create",product_name:pn,planned_quantity:o.items?.[0]?.quantity||0,order_id:o.id,notes:"訂單#"+o.order_number});alert("生產工單已建立");load();}} style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#0a7c42",color:"#fff",fontSize:9,cursor:"pointer",marginLeft:2}}>🏭工單</button>}
                      <button onClick={async()=>{const r=await ap("/api/admin/orders?id="+o.id);const items=r.data?.items||[];alert("📦 "+o.order_number+" 明細\n"+items.map(i=>i.product_name+" ×"+i.quantity+" @"+i.unit_price+" = $"+i.total_price).join("\n")+"\n\n合計: $"+o.total_amount);}}
                        style={{padding:"1px 6px",borderRadius:3,border:"1px solid #ddd",background:"transparent",fontSize:9,cursor:"pointer",marginLeft:2}}>📋</button>
                      {o.status!=="shipped"&&o.status!=="paid"&&o.payment_status!=="paid"&&<button onClick={async()=>{if(!confirm("刪除訂單 "+o.order_number+"？"))return;await ap("/api/admin/orders",{action:"delete",order_id:o.id});load();}}
                        style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#b91c1c",color:"#fff",fontSize:9,cursor:"pointer",marginLeft:2}}>🗑</button>}
                    </td>
                  </tr>);
                })}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* SHIFTS */}
        {!ld && tab === "shifts" && (
          <div>
            <button onClick={()=>{setSsf(!ssf);setEs(null);}}
              style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:ssf?"#f0f0f0":"#1a1a1a",color:ssf?"#666":"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>
              {ssf?"✕":"＋新增班別"}
            </button>
            {ssf && (
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12,marginBottom:8}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:6}}>
                  <div><label style={{fontSize:10,color:"#888"}}>門市</label>
                    <select value={sf2.store_id} onChange={e=>setSf2({...sf2,store_id:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}>
                      <option value="">選擇</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div><label style={{fontSize:10,color:"#888"}}>名稱</label><input value={sf2.name} onChange={e=>setSf2({...sf2,name:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}} /></div>
                  <div><label style={{fontSize:10,color:"#888"}}>角色</label>
                    <select value={sf2.role} onChange={e=>setSf2({...sf2,role:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}}>
                      <option value="all">全場</option><option value="外場">外場</option><option value="內場">內場</option><option value="吧台">吧台</option><option value="烘焙">烘焙</option>
                    </select>
                  </div>
                  <div><label style={{fontSize:10,color:"#888"}}>上班</label><input type="time" value={sf2.start_time} onChange={e=>setSf2({...sf2,start_time:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}} /></div>
                  <div><label style={{fontSize:10,color:"#888"}}>下班</label><input type="time" value={sf2.end_time} onChange={e=>setSf2({...sf2,end_time:e.target.value})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}} /></div>
                  <div><label style={{fontSize:10,color:"#888"}}>休息分</label><input type="number" value={sf2.break_minutes} onChange={e=>setSf2({...sf2,break_minutes:Number(e.target.value)})} style={{width:"100%",padding:4,borderRadius:4,border:"1px solid #ddd",fontSize:11}} /></div>
                </div>
                <button onClick={saveShift} style={{padding:"4px 14px",borderRadius:4,border:"none",background:"#0a7c42",color:"#fff",fontSize:11,cursor:"pointer"}}>{es?"💾儲存":"建立"}</button>
              </div>
            )}
            {stores.filter(s=>!sf||s.id===sf).map(store=>{
              const ss = shifts.filter(s=>s.store_id===store.id);
              if (!ss.length) return null;
              return (
                <div key={store.id} style={{marginBottom:10}}>
                  <h4 style={{fontSize:12,fontWeight:600,color:"#444",marginBottom:4,padding:"4px 8px",background:"#faf8f5",borderRadius:4}}>
                    {"🏠 "+store.name+"（"+ss.length+"）"}
                  </h4>
                  <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr style={{background:"#faf8f5"}}>{["班別","角色","時間","休息","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                      <tbody>{ss.map(s=>(
                        <tr key={s.id} style={{borderBottom:"1px solid #f0eeea"}}>
                          <td style={{padding:6,fontWeight:500}}>{s.name}</td>
                          <td style={{padding:6}}>{s.role==="all"?"全場":s.role||"全場"}</td>
                          <td style={{padding:6}}>{(s.start_time||"").slice(0,5)+"~"+(s.end_time||"").slice(0,5)}</td>
                          <td style={{padding:6}}>{s.break_minutes+"分"}</td>
                          <td style={{padding:6}}>
                            <button onClick={()=>editShift(s)} style={{padding:"1px 5px",borderRadius:3,border:"1px solid #ddd",background:"transparent",cursor:"pointer",fontSize:10,marginRight:2}}>✏️</button>
                            <button onClick={()=>delShift(s.id)} style={{padding:"1px 5px",borderRadius:3,border:"1px solid #ddd",background:"transparent",cursor:"pointer",fontSize:10,color:"#b91c1c"}}>🗑</button>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* WORKLOGS - pure view */}
        {!ld && tab === "worklogs" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>📋 工作日誌</h3>
            <WorklogMgr stores={stores} sf={sf} month={month} auth={auth} />
          </div>
        )}

        {/* ANNOUNCEMENTS */}
        {!ld && tab === "announcements" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>📢 公告</h3>
            {auth.role !== "store_manager" && (
              <button onClick={async()=>{
                const title = prompt("公告標題："); if(!title) return;
                const content = prompt("公告內容："); if(!content) return;
                const priority = confirm("是否為急件？") ? "urgent" : "normal";
                const push_line = confirm("同步推送到員工LINE？");
                const r = await ap("/api/admin/announcements",{action:"create",title,content,priority,push_line,created_by:auth.employee_id});
                if (r.line_sent) alert("公告已建立，LINE推送 " + r.line_sent + " 位");
                else alert("公告已建立");
                load();
              }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>
                ＋新增公告
              </button>
            )}
            {anns.map(a=>(
              <div key={a.id} style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12,marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontWeight:600,fontSize:13}}>{a.priority==="urgent"?"🔴 ":""}{a.title}</div>
                  {auth.role !== "store_manager" && (
                    <button onClick={async()=>{if(!confirm("確定刪除公告？"))return;await ap("/api/admin/announcements",{action:"delete",announcement_id:a.id});load();}}
                      style={{fontSize:10,color:"#b91c1c",background:"none",border:"none",cursor:"pointer"}}>🗑</button>
                  )}
                </div>
                <div style={{fontSize:12,color:"#666",marginTop:4}}>{a.content}</div>
                <div style={{fontSize:10,color:"#aaa",marginTop:4}}>{a.created_at?new Date(a.created_at).toLocaleDateString():""}</div>
              </div>
            ))}
          </div>
        )}

        {/* SETTINGS */}
        {!ld && tab === "settings" && (
          <SettingsMgr stores={stores} load={load} month={month} />
        )}

        {/* IMAGE PREVIEW */}
        {si && (
          <div onClick={()=>setSi(null)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,cursor:"pointer"}}>
            <img src={si} alt="" style={{maxWidth:"90%",maxHeight:"90%",borderRadius:8}} />
          </div>
        )}

        {/* EMP DETAIL */}
        {detailId && (
          <EmpDetail
            empId={detailId}
            storesRef={stores}
            onClose={() => { setDetailId(null); load(); }}
          />
        )}
      </div>
    </div>
  );
}
