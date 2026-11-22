import "./styles.css";

const icon = {
  home:"⌂", itinerary:"◷", bookings:"▣", expenses:"₹", directions:"↗",
  flight:"✈", hotel:"⌂", ferry:"≈", calendar:"□", pin:"●", map:"↗", alert:"!", refresh:"↻"
};

let trip;
let activeView = "home";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[c]);
const formatDate = (value, options = {}) => new Intl.DateTimeFormat("en-IN", { day:"numeric", month:"short", year:"numeric", ...options }).format(new Date(value.includes("T") ? value : `${value}T12:00:00`));
const money = (value) => new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", minimumFractionDigits:0, maximumFractionDigits:2 }).format(value || 0);
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

async function init() {
  const appRoot = document.querySelector("#app");
  appRoot.innerHTML = `
    <main class="lock-screen">
      <section class="lock-card" aria-labelledby="lock-title">
        <span class="brand-mark">◯</span>
        <div class="eyebrow">Private travel companion</div>
        <h1 id="lock-title">Andaman Islands</h1>
        <p class="muted">Enter the shared password to open the itinerary.</p>
        <form id="unlock-form" class="unlock-form">
          <input id="unlock-password" type="password" autocomplete="current-password" placeholder="Shared password" required />
          <button class="btn" type="submit">Unlock</button>
        </form>
        <p id="unlock-error" class="disclaimer" role="alert" hidden></p>
      </section>
    </main>`;
  document.querySelector("#unlock-form").addEventListener("submit", unlockTrip);
}

async function unlockTrip(event) {
  event.preventDefault();
  const password = document.querySelector("#unlock-password").value;
  const error = document.querySelector("#unlock-error");
  try {
    const response = await fetch("./data/trip.enc");
    if (!response.ok) throw new Error("Encrypted trip data is not available");
    const raw = new Uint8Array(await response.arrayBuffer());
    if (raw.length < 29) throw new Error("Invalid encrypted trip data");
    const salt = raw.slice(0, 16);
    const iv = raw.slice(16, 28);
    const ciphertext = raw.slice(28);
    const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name:"PBKDF2", salt, iterations:250000, hash:"SHA-256" },
      baseKey,
      { name:"AES-GCM", length:256 },
      false,
      ["decrypt"]
    );
    const clear = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, ciphertext);
    trip = JSON.parse(new TextDecoder().decode(clear));
    await renderShell();
  } catch (_) {
    error.textContent = "Incorrect password or unavailable trip data.";
    error.hidden = false;
  }
}

async function renderShell() {
  document.querySelector("#app").innerHTML = `
    <div class="app-shell">
      <header class="topbar"><div class="brand"><span class="brand-mark">◯</span><span>Andaman Companion</span></div><div id="network-status" class="status"><span class="status-dot"></span><span></span></div></header>
      <main class="main" id="main"></main>
      <nav class="bottom-nav" aria-label="Primary navigation">
        ${["home","itinerary","bookings","expenses","directions"].map(v => `<button class="nav-item ${v==="home"?"active":""}" data-view="${v}" aria-label="${v}"><span>${icon[v]}</span><span>${v[0].toUpperCase()+v.slice(1)}</span></button>`).join("")}
      </nav>
    </div>`;
  bindNav();
  updateNetworkStatus();
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function bindNav() {
  document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
    navigateToView(button.dataset.view);
  }));
}

function navigateToView(view, targetId) {
  activeView = view;
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === activeView));
  render();

  if (!targetId) {
    window.scrollTo({ top:0, behavior:"smooth" });
    return;
  }

  const target = document.getElementById(targetId);
  if (!target) {
    console.error(`Navigation target not found: ${targetId}`);
    window.scrollTo({ top:0, behavior:"smooth" });
    return;
  }
  if (target.matches(".day")) {
    target.classList.add("open");
    target.querySelector(".day-toggle")?.setAttribute("aria-expanded", "true");
  }
  target.scrollIntoView({ behavior:"smooth", block:"start" });
}

function updateNetworkStatus() {
  const status = document.querySelector("#network-status");
  if (!status) return;
  status.classList.toggle("offline", !navigator.onLine);
  status.querySelector("span:last-child").textContent = navigator.onLine ? "Online" : "Offline";
}

function render() {
  const main = document.querySelector("#main");
  const renderers = { home:renderHome, itinerary:renderItinerary, bookings:renderBookings, expenses:renderExpenses, directions:renderDirections };
  main.innerHTML = renderers[activeView]();
  bindView();
}

function bindView() {
  document.querySelectorAll(".quick[data-view]").forEach(el => el.addEventListener("click", () => {
    navigateToView(el.dataset.view, el.dataset.target);
  }));
  document.querySelectorAll(".day-toggle").forEach(el => el.addEventListener("click", () => {
    const day = el.closest(".day");
    day.classList.toggle("open");
    el.setAttribute("aria-expanded", String(day.classList.contains("open")));
  }));
}

function renderHome() {
  const now = todayKey();
  const day = trip.itinerary.find(d => d.date === now);
  const departure = new Date(`${trip.startDate}T00:00:00`);
  const end = new Date(`${trip.endDate}T23:59:59`);
  const nowDate = new Date(`${now}T12:00:00`);
  let countdown = "Trip in progress";
  if (nowDate < departure) countdown = `${Math.ceil((departure-nowDate)/86400000)} days to go`;
  if (nowDate > end) countdown = "Trip complete";
  const next = trip.itinerary.find(d => d.date >= now) || trip.itinerary.at(-1);
  const itineraryTarget = day || next;
  const confirmedPaid = trip.expenses.filter(e => e.paid != null).reduce((sum,e)=>sum+e.paid,0);
  const knownBalance = trip.expenses.filter(e => e.confirmed && e.paid != null).reduce((sum,e)=>sum+e.total-e.paid,0);
  return `
    <section class="hero"><div class="eyebrow">9 days · Dec 2026 – Jan 2027</div><h1>${escapeHtml(trip.name)}</h1><div class="hero-meta"><span class="pill">${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}</span><span class="pill">${escapeHtml(countdown)}</span></div></section>
    <section class="section"><div class="grid grid-4">
      <div class="card metric"><span class="muted">Next / current day</span><strong>${day ? `Day ${day.day}` : next ? `Day ${next.day}` : "—"}</strong><span>${escapeHtml(day?.place || next.place)}</span></div>
      <div class="card metric"><span class="muted">Accommodation</span><strong>${escapeHtml(day?.hotel || next.hotel)}</strong><span>${escapeHtml(day?.place || next.place)}</span></div>
      <div class="card metric"><span class="muted">Paid so far</span><strong>${money(confirmedPaid)}</strong><span>${trip.expenses.filter(e=>e.paid!=null).length} booking payments recorded</span></div>
      <div class="card metric"><span class="muted">Known balance</span><strong>${money(knownBalance)}</strong><span>Verified expenses</span></div>
    </div></section>
    <section class="section"><div class="section-header"><h2>Today & next</h2></div><div class="card">
      <h3>${escapeHtml(day ? `${day.place} · Day ${day.day}` : next ? `${next.place} · Day ${next.day}` : "Trip complete")}</h3>
      ${(day || next).events.length ? (day || next).events.map(e=>`<div class="event"><span class="event-time">${escapeHtml(e.time || "Unspecified")}</span><div><span class="tag">${escapeHtml(e.type)}</span> <strong>${escapeHtml(e.title)}</strong><div class="muted">${escapeHtml(e.location)}</div></div></div>`).join("") : '<p class="muted">No timed activities are documented for this day.</p>'}
    </div></section>
    <section class="section"><div class="section-header"><h2>Quick access</h2></div><div class="quick-grid">
      ${[
        ["bookings","Flight information","flight","bookings-flights"],["bookings","Stay information","hotel","bookings-accommodation"],
        ["itinerary",day?"Today's itinerary":now< trip.startDate?"Next itinerary day":"Trip itinerary","calendar",itineraryTarget?`itinerary-day-${itineraryTarget.date}`:""],
        ["expenses","Payment summary","expenses","expenses-summary"],["directions","Maps & routes","map","directions-routes"]
      ].map(([view,label,ic,target])=>`<button class="quick" data-view="${view}" data-target="${target}"><span class="quick-icon">${icon[ic]}</span><strong>${label}</strong></button>`).join("")}
    </div></section>
    ${trip.discrepancies.length ? `<section class="section card alert"><h3>Items needing attention</h3>${trip.discrepancies.slice(0,3).map(d=>`<p>${escapeHtml(d)}</p>`).join("")}</section>` : ""}
  `;
}

function renderItinerary() {
  const today = todayKey();
  return `<section class="section-header"><div><div class="eyebrow">Day by day</div><h2>Itinerary</h2></div></section><div class="timeline">${trip.itinerary.map(day=>`
    <article class="card day quick-target ${day.date===today?"current open":""}" id="itinerary-day-${day.date}">
      <button class="day-toggle" aria-expanded="${day.date===today}"><span><strong>Day ${day.day} · ${formatDate(day.date,{year:undefined})}</strong><span class="muted">${escapeHtml(day.place)} · ${escapeHtml(day.hotel)}</span></span><span>${day.date===today?"Today":""} ›</span></button>
      <div class="day-body">${day.events.length ? day.events.map(e=>`<div class="event"><span class="event-time">${escapeHtml(e.time || "Time TBC")}</span><div><span class="tag">${escapeHtml(e.type)}</span> <strong>${escapeHtml(e.title)}</strong><div class="muted">${escapeHtml(e.location)}</div></div></div>`).join(""):"<p class=\"muted\">No timed activities are documented.</p>"}<p class="disclaimer">${escapeHtml(day.note)}</p></div>
    </article>`).join("")}</div>`;
}

function renderBookings() {
  return `<section class="section-header"><div><div class="eyebrow">Verified reservations</div><h2>Bookings</h2></div></section>
  <div class="section quick-target" id="bookings-flights"><h3>Flights</h3><div class="grid grid-2">${trip.flights.map(f=>`
    <article class="card booking-card"><div class="detail-row"><strong>${f.direction}</strong><span class="tag">${escapeHtml(f.status)}</span></div><h3>${escapeHtml(f.airline)} ${escapeHtml(f.flightNumber)}</h3>
      <div class="detail-row"><span>From</span><strong>${escapeHtml(f.from)}</strong></div><div class="detail-row"><span>Departure</span><strong>${formatDate(f.departure,{weekday:"short"})} · ${new Date(f.departure).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:false})}</strong></div>
      <div class="detail-row"><span>To</span><strong>${escapeHtml(f.to)}</strong></div><div class="detail-row"><span>Arrival</span><strong>${formatDate(f.arrival,{weekday:"short"})} · ${new Date(f.arrival).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:false})}</strong></div>
      <div class="detail-row"><span>Bag drop closes</span><strong>${new Date(f.bagDropCloses).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:false})}</strong></div>
      <div class="detail-row"><span>Baggage</span><strong>${escapeHtml(f.checkedBag)} · ${escapeHtml(f.cabinBag)}</strong></div><a class="map-link" href="${escapeHtml(f.mapFrom)}" target="_blank" rel="noopener">Open departure airport map ↗</a>
    </article>`).join("")}</div></div>
  <div class="section"><h3>Ferries</h3><div class="grid grid-2">${(trip.ferries || []).map(f=>`
    <article class="card booking-card"><div class="detail-row"><strong>${escapeHtml(f.operator)} · ${escapeHtml(f.class)}</strong><span class="tag">${escapeHtml(f.status)}</span></div><h3>${escapeHtml(f.from)} → ${escapeHtml(f.to)}</h3>
      <div class="detail-row"><span>Date</span><strong>${formatDate(f.date,{weekday:"short"})}</strong></div><div class="detail-row"><span>Departure</span><strong>${escapeHtml(f.departure)}</strong></div><div class="detail-row"><span>Arrival</span><strong>${escapeHtml(f.arrival)}</strong></div><div class="detail-row"><span>Reporting</span><strong>${escapeHtml(f.reporting)}</strong></div><div class="detail-row"><span>Fare / paid</span><strong>${money(f.total)} / ${money(f.paid)}</strong></div><a class="map-link" href="${escapeHtml(f.mapFrom)}" target="_blank" rel="noopener">Open departure terminal map ↗</a></article>`).join("")}</div></div>
  <div class="section quick-target" id="bookings-accommodation"><h3>Accommodation</h3><div class="grid grid-2">${trip.hotels.map(h=>`
    <article class="card booking-card"><h3>${escapeHtml(h.name)}</h3><p class="muted">${escapeHtml(h.location)}</p>
      ${h.address?`<div class="detail-row"><span>Address</span><strong>${escapeHtml(h.address)}</strong></div>`:""}
      ${h.checkIn?`<div class="detail-row"><span>Check-in</span><strong>${typeof h.checkIn==="string"&&h.checkIn.length===10?h.checkIn:formatDate(h.checkIn,{weekday:"short"})}${typeof h.checkIn==="string"&&h.checkIn.includes("T")?" · "+new Date(h.checkIn).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:false}):""}</strong></div>`:""}
      ${h.checkOut?`<div class="detail-row"><span>Check-out</span><strong>${typeof h.checkOut==="string"&&h.checkOut.length===10?h.checkOut:formatDate(h.checkOut,{weekday:"short"})}${typeof h.checkOut==="string"&&h.checkOut.includes("T")?" · "+new Date(h.checkOut).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:false}):""}</strong></div>`:""}
      ${h.nights?`<div class="detail-row"><span>Nights</span><strong>${h.nights}</strong></div>`:""}${h.room?`<div class="detail-row"><span>Room</span><strong>${escapeHtml(h.room)}</strong></div>`:""}${h.meal?`<div class="detail-row"><span>Meal</span><strong>${escapeHtml(h.meal)}</strong></div>`:""}
      ${h.total!=null||h.paid!=null?`<div class="detail-row"><span>Amount / paid</span><strong>${h.total!=null?money(h.total):"Total not provided"} / ${h.paid!=null?money(h.paid):"Not provided"}</strong></div>`:""}<div class="detail-row"><span>Status</span><strong>${escapeHtml(h.status)}</strong></div>
      ${h.dueDate?`<div class="detail-row"><span>Balance due</span><strong>${money(h.total-h.paid)} · ${formatDate(h.dueDate,{weekday:"short"})}</strong></div>`:""}
      ${h.plannedPaymentDate?`<div class="detail-row"><span>Planned payment date</span><strong>${formatDate(h.plannedPaymentDate,{weekday:"short"})}</strong></div>`:""}
      ${h.bookings?`<div class="disclaimer">${h.bookings.map(b=>`<strong>${formatDate(b.date,{weekday:"short"})} – ${formatDate(b.checkout,{weekday:"short"})}</strong><br>${escapeHtml(b.room)} · ${escapeHtml(b.status)}${b.amount!=null?` · ${money(b.amount)} total / ${money(b.paid)} paid / ${money(b.balance)} balance`:""}`).join("<br><br>")}</div>`:""}
      ${h.cancellation?`<p class="disclaimer">${escapeHtml(h.cancellation)}</p>`:""}${h.map?`<a class="btn secondary" href="${escapeHtml(h.map)}" target="_blank" rel="noopener">Open in Google Maps ↗</a>`:""}
    </article>`).join("")}</div></div>
  ${trip.activities?.length ? `<div class="section"><h3>Activities</h3><div class="grid grid-2">${trip.activities.map(a=>`
    <article class="card booking-card"><div class="detail-row"><strong>${escapeHtml(a.name)}</strong><span class="tag">${escapeHtml(a.status)}</span></div><div class="detail-row"><span>Date</span><strong>${formatDate(a.date,{weekday:"short"})}</strong></div>
      ${a.time?`<div class="detail-row"><span>Activity time</span><strong>${escapeHtml(a.time)}</strong></div>`:""}
      ${a.departureTime?`<div class="detail-row"><span>Meet / depart</span><strong>${escapeHtml(a.meetingTime)} / ${escapeHtml(a.departureTime)}</strong></div>`:""}
      ${a.pickup?`<div class="detail-row"><span>Pickup</span><strong>${escapeHtml(a.pickup)} at ${escapeHtml(a.meetingTime)}</strong></div>`:""}
      ${a.meetingPoint?`<div class="detail-row"><span>Meeting point</span><strong>${escapeHtml(a.meetingPoint)}</strong></div>`:""}
      ${a.durationOnIsland?`<div class="detail-row"><span>Island time</span><strong>${escapeHtml(a.durationOnIsland)}</strong></div>`:""}
      ${a.persons?`<div class="detail-row"><span>Persons</span><strong>${a.persons}</strong></div>`:""}
      ${a.total!=null?`<div class="detail-row"><span>${a.paid!=null||a.balance!=null?"Amount / advance / balance":"Total cost"}</span><strong>${money(a.total)}${a.paid!=null?` / ${money(a.paid)}`:""}${a.balance!=null?` / ${money(a.balance)}`:""}</strong></div>`:""}
      ${a.inclusions?`<p class="disclaimer">${escapeHtml(a.inclusions)}</p>`:""}
      ${a.notes?`<p class="disclaimer">${a.notes.map(note=>escapeHtml(note)).join("<br>")}</p>`:""}</article>`).join("")}</div></div>` : ""}`;
}

function renderExpenses() {
  const confirmed = trip.expenses.filter(e=>e.confirmed);
  const total = confirmed.reduce((sum,e)=>sum+(e.total??0),0);
  const paid = trip.expenses.filter(e=>e.paid!=null).reduce((sum,e)=>sum+e.paid,0);
  const pricedPayments = confirmed.filter(e=>e.total!=null&&e.paid!=null);
  const verifiedPaid = pricedPayments.reduce((sum,e)=>sum+e.paid,0);
  const balance = pricedPayments.reduce((sum,e)=>sum+e.total-e.paid,0);
  const percent = total ? Math.round(verifiedPaid/total*100) : 0;
  const paidWithoutTotal = trip.expenses.filter(e=>e.total==null&&e.paid!=null).reduce((sum,e)=>sum+e.paid,0);
  const estimatedPending = trip.expenses.filter(e=>!e.confirmed).reduce((sum,e)=>sum+(e.total??0),0);
  return `<section class="section-header"><div><div class="eyebrow">Verified costs</div><h2>Expenses</h2></div></section>
  <div class="grid grid-3 quick-target" id="expenses-summary"><div class="card metric"><span class="muted">Confirmed commitment</span><strong>${money(total)}</strong><span>${confirmed.length} paid or confirmed bookings</span></div><div class="card metric"><span class="muted">Paid</span><strong>${money(paid)}</strong><span>${paidWithoutTotal?`${money(paidWithoutTotal)} paid for bookings without a stated total`:`${percent}% of verified commitment`}</span></div><div class="card metric"><span class="muted">Outstanding</span><strong>${money(balance)}</strong><span>Verified balance</span></div></div>
  <div class="card section"><span class="muted">Payment progress on priced bookings · ${percent}%</span><div class="progress" style="margin-top:10px"><div style="width:${percent}%"></div></div></div>
  <div class="card section table-wrap"><table><thead><tr><th>Booking</th><th>Category</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${trip.expenses.map(e=>`<tr><td>${escapeHtml(e.name)}<br><small class="muted">${escapeHtml(e.source)}</small></td><td>${escapeHtml(e.category)}</td><td>${e.total==null?"Not provided":money(e.total)}</td><td>${e.paid==null?"Not provided":money(e.paid)}</td><td>${e.total==null||e.paid==null?"Not provided":money(e.total-e.paid)}</td><td>${escapeHtml(e.status)}</td></tr>`).join("")}</tbody></table></div>
  <p class="disclaimer">Estimated pending from the Excel workbook: ${money(estimatedPending)}. It is not included in confirmed commitment because no supporting booking document or due date is available. Payments for bookings with no stated total are included in reported paid, but excluded from commitment and verified balance.</p>`;
}

function renderDirections() {
  const routes = [...(trip.routes || [])].sort((a,b) =>
    a.date.localeCompare(b.date) || (a.time || "99:99").localeCompare(b.time || "99:99")
  );
  return `<section class="section-header"><div><div class="eyebrow">Route links by itinerary schedule</div><h2>Directions</h2></div></section>
  <section class="section quick-target" id="directions-routes"><div class="grid grid-2">${routes.map(route=>`
    <article class="card booking-card"><h3>${escapeHtml(route.name)}</h3>
      <div class="detail-row"><span>Date</span><strong>${formatDate(route.date,{weekday:"short"})}</strong></div>
      <div class="detail-row"><span>City / island</span><strong>${escapeHtml(route.place)}</strong></div>
      <div class="detail-row"><span>Itinerary time</span><strong>${route.time?escapeHtml(route.time):"Not specified"}${route.timeNote?` · ${escapeHtml(route.timeNote)}`:""}</strong></div>
      <div class="detail-row"><span>Route</span><strong>${escapeHtml(route.from)} → ${escapeHtml(route.to)}</strong></div>
      <div class="detail-row"><span>Mode</span><strong>${escapeHtml(route.mode)}</strong></div>
      <div class="detail-row"><span>Distance</span><strong>${escapeHtml(route.distance)}</strong></div>
      <a class="btn secondary" href="${escapeHtml(route.map)}" target="_blank" rel="noopener">Open Google Maps ↗</a>
    </article>`).join("")}</div></section>`;
}

init();
