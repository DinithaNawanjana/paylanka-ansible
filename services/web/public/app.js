const $ = (s)=>document.querySelector(s);
let last = null;

async function api(path, opts={}){
  const res = await fetch(path, { headers:{ "Content-Type":"application/json" }, ...opts });
  if(!res.ok){ const t = await res.text(); throw new Error(res.status + ": " + t); }
  const ct = res.headers.get("content-type")||"";
  return ct.includes("application/json") ? res.json() : res.text();
}
function showMessage(txt,isErr=false){
  const el = $("#msg"); if(!el) return;
  el.textContent = txt; el.style.color = isErr ? "var(--danger)" : "var(--txt)";
}
function renderLast(){
  const el = $("#last");
  if(!last){ el.innerHTML = '<div class="mut">No payments yet.</div>'; return; }
  el.innerHTML = `
    <div><strong>ID:</strong> ${last.id}</div>
    <div><strong>Amount:</strong> ${last.amount} ${last.currency}</div>
    <div><strong>Card:</strong> ${last.masked} <span class="badge">${new Date(last.createdAt).toLocaleString()}</span></div>
    <div><strong>Status:</strong> ${last.status}</div>
  `;
}
function row(p){
  const ts = new Date(p.createdAt).toLocaleString();
  return `<tr>
    <td>${ts}</td>
    <td><a href="/api/pay/${p.id}" target="_blank">${p.id.slice(0,8)}…</a></td>
    <td>${p.amount} ${p.currency}</td>
    <td>${p.masked}</td>
    <td>${p.status}</td>
  </tr>`;
}
async function loadTable(){
  const tbody = $("#paymentsBody");
  try{
    const data = await api("/api/payments");
    if(!data.ok || data.count===0){
      tbody.innerHTML = `<tr><td colspan="5" class="mut">No data</td></tr>`;
      return;
    }
    tbody.innerHTML = data.payments.map(row).join("");
  }catch(e){
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--danger)">${e.message}</td></tr>`;
  }
}

$("#ping").addEventListener("click", async ()=>{
  try{ const h = await api("/api/health"); showMessage(h.status==="ok"?"API Healthy":"API issue"); }
  catch(e){ showMessage(e.message,true); }
});
$("#refresh").addEventListener("click", loadTable);
$("#clear").addEventListener("click", async ()=>{
  if(!confirm("Clear all demo payments?")) return;
  try{ await api("/api/payments", { method:"DELETE" }); last = null; renderLast(); await loadTable(); showMessage("Cleared"); }
  catch(e){ showMessage(e.message,true); }
});

$("#payForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  showMessage("Processing…");
  const payload = {
    amount: Number($("#amount").value),
    currency: $("#currency").value,
    card: $("#card").value.replace(/\s+/g,""),
    exp: $("#exp").value,
    cvc: $("#cvc").value
  };
  try{
    const res = await api("/api/pay", { method:"POST", body: JSON.stringify(payload) });
    if(res.ok){ last = res.payment; renderLast(); await loadTable(); showMessage("Payment succeeded"); }
    else showMessage(res.error || "Failed", true);
  }catch(err){ showMessage(err.message,true); }
});

renderLast();
loadTable();