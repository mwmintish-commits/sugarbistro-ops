"use client";
import { useState, useEffect, useCallback } from "react";
import { ap, fmt, Badge, RB, Row, LT, ROLES, LABOR_SELF, HEALTH_SELF } from "./components/utils";
import EmpDetail from "./components/EmpDetail";
import SettingsMgr from "./components/SettingsMgr";
import WorklogMgr from "./components/WorklogMgr";
import LeavesMgr from "./components/LeavesMgr";

const ROLE_TABS = {
  admin: ["dashboard","employees","schedules","leaves","attendance","overtime","payroll",
    "settlements","deposits","expenses","payments","pnl",
    "recipes","production","inventory","clients","orders",
    "shifts","worklogs","announcements","settings"],
  manager: ["employees","schedules","leaves","attendance","overtime","payroll",
    "settlements","deposits","expenses","payments","pnl",
    "recipes","production","inventory","clients","orders","shifts","worklogs"],
  store_manager: ["schedules","leaves","store_staff","shifts","worklogs",
    "announcements","settlements","deposits","expenses"]
};
const TAB_L = {
  dashboard:"🏠總覽",employees:"👥員工",schedules:"📅排班",leaves:"🙋請假",
  attendance:"📍出勤",overtime:"⏱加班",payroll:"💰薪資",settlements:"💰日結",
  deposits:"🏦存款",expenses:"📦費用",payments:"💳撥款",pnl:"📊損益",
  recipes:"📋配方",production:"🏭生產",inventory:"📊庫存",
  clients:"👥客戶",orders:"📝訂單",shifts:"⏰班別",worklogs:"📋日誌",
  announcements:"📢公告",settings:"⚙️設定",store_staff:"👥本店員工"
};
const TAB_GROUPS = {
  "總覽":["dashboard"],
  "人資":["employees","store_staff","schedules","leaves","attendance","overtime","payroll"],
  "財務":["settlements","deposits","expenses","payments","pnl"],
  "生產":["recipes","production","inventory"],
  "業務":["clients","orders"],
  "管理":["shifts","worklogs","announcements","settings"]
};
const DAYS = ["日","一","二","三","四","五","六"];

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
      myTabs.includes("pnl") ? ap("/api/admin/pnl?month=" + month + (sf ? "&store_id=" + sf : "")) : Promise.resolve(null),
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
    }
    if (myTabs.includes("orders")) {
      ap("/api/admin/orders").then(r => { setOrderList(r.data||[]); setOrderSum(r.summary||{}); });
    }
    if (myTabs.includes("production")) {
      ap("/api/admin/production?month=" + month)
        .then(r => { setProdList(r.data||[]); setProdSum(r.summary||{}); });
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

  const lockedStore = auth.role === "store_manager" ? auth.store_id : null;
  const storeName = auth.role === "store_manager" ? auth.store_name : null;

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
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:12}}>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"#888"}}>本月營收</div>
                <div style={{fontSize:20,fontWeight:700,color:"#0a7c42"}}>{fmt(sum.total_net_sales)}</div>
              </div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"#888"}}>待審核</div>
                <div style={{fontSize:20,fontWeight:700,color:"#b45309"}}>{pl.length}</div>
              </div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"#888"}}>在職員工</div>
                <div style={{fontSize:20,fontWeight:700}}>{ae.length}</div>
              </div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"#888"}}>待撥款</div>
                <div style={{fontSize:20,fontWeight:700,color:"#b91c1c"}}>{fmt(pmtSum.pending)}</div>
              </div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"#888"}}>應收帳款</div>
                <div style={{fontSize:20,fontWeight:700,color:"#b45309"}}>{fmt(orderSum.unpaid)}</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12}}>
                <h4 style={{fontSize:12,fontWeight:600,marginBottom:6}}>📊 門市營收</h4>
                {stores.map(s => {
                  const rev = stl.filter(r => r.store_id === s.id).reduce((a,r) => a + Number(r.net_sales||0), 0);
                  const target = (s.daily_target||0) * new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
                  const pct = target > 0 ? Math.round(rev/target*100) : 0;
                  return (
                    <div key={s.id} style={{marginBottom:6}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                        <span>{s.name}</span>
                        <span style={{fontWeight:600}}>{fmt(rev)}</span>
                      </div>
                      {target > 0 && (
                        <div style={{height:5,background:"#f0f0f0",borderRadius:3,marginTop:2}}>
                          <div style={{height:"100%",width:Math.min(100,pct)+"%",background:pct>=100?"#0a7c42":pct>=70?"#fbbf24":"#b91c1c",borderRadius:3}} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:12}}>
                <h4 style={{fontSize:12,fontWeight:600,marginBottom:6}}>⚠️ 異常通報</h4>
                {dep.filter(d => d.status === "anomaly").map(d => (
                  <div key={d.id} style={{fontSize:11,padding:"3px 0",color:"#b91c1c"}}>
                    {"🚨 存款 " + (d.stores?d.stores.name:"") + " 差" + fmt(d.difference)}
                  </div>
                ))}
                {dep.filter(d=>d.status==="anomaly").length===0 && att.filter(a=>a.late_minutes>30).length===0 && (
                  <div style={{fontSize:11,color:"#ccc",textAlign:"center",padding:10}}>✅ 無異常</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* EMPLOYEES */}
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
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>{"💰 "+month+" 薪資"}</h3>
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
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#faf8f5"}}>{["員工","出勤","底薪","加班費","補休","勞保","健保","補充保費","實發"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                <tbody>{ae.map(e=>{
                  const wd = att.filter(a=>a.employees&&a.employees.name===e.name&&a.type==="clock_in").length;
                  const bp = e.monthly_salary ? Number(e.monthly_salary) : (e.hourly_rate ? Number(e.hourly_rate)*wd*8 : 0);
                  const ot = otRecords.filter(r=>r.employee_id===e.id&&(r.comp_type==="pay"||r.comp_converted)).reduce((s,r)=>s+Number(r.amount||0),0);
                  const compH = otRecords.filter(r=>r.employee_id===e.id&&r.comp_type==="comp"&&!r.comp_used&&!r.comp_converted).reduce((s,r)=>s+Number(r.comp_hours||0),0);
                  const ls = e.labor_tier ? LABOR_SELF[e.labor_tier-1]||0 : 0;
                  const hs = e.health_tier ? HEALTH_SELF[e.health_tier-1]||0 : 0;
                  const suppH = e.employment_type==="parttime"&&bp>27470?Math.round(bp*0.0211):0;
                  return (
                    <tr key={e.id} style={{borderBottom:"1px solid #f0eeea"}}>
                      <td style={{padding:6,fontWeight:500}}>{e.name}</td>
                      <td style={{padding:6}}>{wd+"天"}</td>
                      <td style={{padding:6}}>{fmt(bp)}</td>
                      <td style={{padding:6,color:ot>0?"#b45309":"#ccc"}}>{ot>0?"+"+fmt(ot):"-"}</td>
                      <td style={{padding:6,color:compH>0?"#4361ee":"#ccc"}}>{compH>0?compH+"hr":"-"}</td>
                      <td style={{padding:6,color:"#888",fontSize:10}}>{ls>0?"-"+fmt(ls):"-"}</td>
                      <td style={{padding:6,color:"#888",fontSize:10}}>{hs>0?"-"+fmt(hs):"-"}</td>
                      <td style={{padding:6,color:suppH>0?"#b91c1c":"#ccc",fontSize:10}}>{suppH>0?"-"+fmt(suppH):"-"}</td>
                      <td style={{padding:6,fontWeight:700,fontSize:13}}>{fmt(bp+ot-ls-hs-suppH)}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
        )}
        {!ld && tab === "settlements" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>{"💰 "+month+" 日結 ("+stl.length+"筆)"}</h3>
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
          <div style={{maxWidth:500}}>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>{"📊 "+month+" 損益表"}</h3>
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:14,marginBottom:10}}>
              <h4 style={{fontSize:13,color:"#0a7c42",marginBottom:8}}>收入</h4>
              <Row l="門市營收" v={<b style={{color:"#0a7c42"}}>{fmt(pnl.revenue?pnl.revenue.total:0)}</b>} />
            </div>
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:14,marginBottom:10}}>
              <h4 style={{fontSize:13,color:"#b91c1c",marginBottom:8}}>支出</h4>
              <Row l="月結廠商" v={fmt(pnl.expenses?pnl.expenses.vendor:0)} />
              <Row l="零用金" v={fmt(pnl.expenses?pnl.expenses.petty_cash:0)} />
              <Row l="總部代付" v={fmt(pnl.expenses?pnl.expenses.hq_advance:0)} />
              <Row l="人事成本" v={fmt(pnl.expenses?pnl.expenses.labor:0)} />
              <Row l="加班費" v={fmt(otSum.totalAmount||0)} />
            </div>
            <div style={{background:"#e6f9f0",borderRadius:8,padding:14}}>
              <Row l="淨利" v={<b style={{fontSize:16,color:"#0a7c42"}}>{fmt((pnl.revenue?pnl.revenue.total:0)-(pnl.expenses?pnl.expenses.total:0)-(otSum.totalAmount||0))}</b>} />
            </div>
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
            <button onClick={async()=>{const n=prompt("品項名稱：");if(!n)return;const u=prompt("單位：","個");const c=prompt("單位成本：","0");await ap("/api/admin/inventory",{action:"create",name:n,unit:u,cost_per_unit:Number(c)});load();}}
              style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>＋新增品項</button>
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#faf8f5"}}>{["品項","類型","庫存","安全量","單價"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                <tbody>{invItems.map(i=>(
                  <tr key={i.id} style={{borderBottom:"1px solid #f0eeea",background:i.safe_stock>0&&i.current_stock<=i.safe_stock?"#fef9c3":"transparent"}}>
                    <td style={{padding:6,fontWeight:500}}>{i.name}</td>
                    <td style={{padding:6,fontSize:10}}>{i.type==="raw_material"?"原料":i.type==="finished"?"成品":"包材"}</td>
                    <td style={{padding:6,fontWeight:600}}>{i.current_stock+" "+(i.unit||"")}{i.safe_stock>0&&i.current_stock<=i.safe_stock&&<span style={{color:"#b91c1c",fontSize:9}}> ⚠️</span>}</td>
                    <td style={{padding:6}}>{i.safe_stock||"-"}</td>
                    <td style={{padding:6}}>{fmt(i.cost_per_unit)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
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
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <div style={{fontSize:13,fontWeight:600}}>{c.name}</div>
                    <Badge status={c.type==="oem"?"planned":c.type==="b2b"?"approved":"pending"} />
                  </div>
                  <div style={{fontSize:11,color:"#888"}}>{c.contact_person} · {c.phone}</div>
                  <div style={{fontSize:10,color:"#888"}}>{c.payment_terms}{c.tax_id?" · 統編"+c.tax_id:""}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ORDERS */}
        {!ld && tab === "orders" && (
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:10}}>📝 訂單管理</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
              <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",padding:"8px 12px"}}><div style={{fontSize:10,color:"#888"}}>訂單數</div><div style={{fontSize:18,fontWeight:600}}>{orderSum.count||0}</div></div>
              <div style={{background:"#fde8e8",borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:"#b91c1c"}}>應收帳款</div><div style={{fontSize:18,fontWeight:700,color:"#b91c1c"}}>{fmt(orderSum.unpaid)}</div></div>
            </div>
            <button onClick={async()=>{if(!clientList.length){alert("請先新增客戶");return;}const cn=prompt("客戶("+clientList.map(c=>c.name).join("/")+")：");const cl=clientList.find(c=>c.name.includes(cn));if(!cl)return alert("找不到");const pn=prompt("產品：");const q=prompt("數量：");const pr=prompt("單價：");await ap("/api/admin/orders",{action:"create",client_id:cl.id,type:cl.type==="oem"?"oem":"b2b",items:[{product_name:pn,quantity:Number(q),unit_price:Number(pr)}]});load();}}
              style={{padding:"5px 12px",borderRadius:6,border:"1px solid #ddd",background:"#1a1a1a",color:"#fff",fontSize:11,cursor:"pointer",marginBottom:8}}>＋新增訂單</button>
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e8e6e1",overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#faf8f5"}}>{["單號","客戶","金額","狀態","付款","操作"].map(h=><th key={h} style={{padding:6,textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
                <tbody>{orderList.map(o=>(
                  <tr key={o.id} style={{borderBottom:"1px solid #f0eeea"}}>
                    <td style={{padding:6,fontSize:10}}>{o.order_number}</td>
                    <td style={{padding:6,fontWeight:500}}>{o.clients?o.clients.name:""}</td>
                    <td style={{padding:6,fontWeight:600}}>{fmt(o.total_amount)}</td>
                    <td style={{padding:6}}><Badge status={o.status} /></td>
                    <td style={{padding:6}}><Badge status={o.payment_status} /></td>
                    <td style={{padding:6}}>
                      {o.status==="confirmed"&&<button onClick={async()=>{await ap("/api/admin/orders",{action:"update_status",order_id:o.id,status:"shipped"});load();}} style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#4361ee",color:"#fff",fontSize:9,cursor:"pointer"}}>出貨</button>}
                      {o.payment_status!=="paid"&&<button onClick={async()=>{await ap("/api/admin/orders",{action:"update_status",order_id:o.id,status:"paid",paid_amount:o.total_amount});load();}} style={{padding:"1px 6px",borderRadius:3,border:"none",background:"#b45309",color:"#fff",fontSize:9,cursor:"pointer",marginLeft:2}}>收款</button>}
                    </td>
                  </tr>
                ))}</tbody>
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
            <WorklogMgr stores={stores} sf={sf} month={month} />
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
                await ap("/api/admin/announcements",{action:"create",title,content,priority});
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
