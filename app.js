import {
  procurementProjectIdGroups,
  procurementProjectIds,
  govspendingReferenceUrls,
  mapsTargetUrl,
  process5ReferenceUrls,
  structuredProjectPoint,
  approximatePointDescription,
} from "./project_links.mjs";

const DATABASE_URL = "./database.json";
const MAP_LOCATIONS_URL = "./map_locations.json";
const ALIASES = new Set(["merged_alias", "quarantined"]);
const BUILDING_TERMS = /อาคาร|หอประชุม|ศูนย์|สำนักงาน|ที่ทำการ|สถานีตำรวจ|ท่าเรือ|ท่าเทียบเรือ|สะพาน|เขื่อน|โรงเรียน|โรงพยาบาล|รพ\.สต|โรงกรอง|บ่อบำบัด|ระบบประปา|ประปาหมู่บ้าน|โรงบำบัด|โรงงาน|ตลาด|บ้านพัก|สนามบิน|ท่าอากาศยาน|สถานีขนส่ง|พิพิธภัณฑ์|ค่ายลูกเสือ|หอพัก|สวนสาธารณะ|สถานศึกษา|หอศิลป์|อ่างเก็บน้ำ|โรงแรม|โรงไฟฟ้า|สนามม้า|อัฒจันทร์|ห้องสมุด|ศาล|เรือนจำ|โรงอาหาร|คลังสินค้า|สนามแข่ง|สนามกีฬา|ประตูระบายน้ำ|ฝาย|จุดชมวิว/;
const OUT_OF_SCOPE_TERMS = /เรือดำน้ำ|เรือหลวง|คอร์เวต|รถไฟฟ้า|รถไฟ|รถราง|\bBTS\b|\bMRT\b|\bBRT\b|โฮปเวลล์|แลนด์บริดจ์|ดาวเทียม|จรวด|คดีติดสินบน|คดีทุจริต|คดีคอร์รัปชัน|จำนำข้าว|ถล่ม|อุบัติเหตุ|เหตุระเบิด|เหตุเพลิงไหม้|แผนแม่บท|ระบบราชการดิจิทัล/;
const NEVER_BUILT_TERMS = /ไม่เคยก่อสร้าง|ไม่เคยสร้าง|ยังไม่เริ่มก่อสร้าง|ไม่เริ่มสร้าง|ยกเลิกก่อนก่อสร้าง|ยกเลิกก่อนสร้าง|ยังไม่ถูกสร้าง|ยกเลิกรายการค่าก่อสร้าง|ออกแบบเสร็จแต่ย้ายไป|พับแผน/;

const THAI_PROVINCES = [
  "กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น",
  "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย",
  "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม",
  "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน",
  "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี",
  "พระนครศรีอยุธยา", "พะเยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี",
  "เพชรบูรณ์", "แพร่", "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร",
  "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน",
  "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ", "สมุทรสงคราม",
  "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี",
  "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ",
  "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี",
].sort((a, b) => b.length - a.length);

const els = {
  list: document.querySelector("#project-list"),
  listEnd: document.querySelector("#list-end"),
  count: document.querySelector("#result-count"),
  caption: document.querySelector("#list-caption"),
  search: document.querySelector("#search-input"),
  province: document.querySelector("#province-filter"),
  sector: document.querySelector("#sector-filter"),
  status: document.querySelector("#status-filter"),
  sort: document.querySelector("#sort-filter"),
  photo: document.querySelector("#photo-filter"),
  clear: document.querySelector("#clear-filters"),
  details: document.querySelector("#detail-card"),
  statTotal: document.querySelector("#stat-total"),
  statMapped: document.querySelector("#stat-mapped"),
  statPhotos: document.querySelector("#stat-photos"),
  updated: document.querySelector("#updated-at"),
  mapPointCount: document.querySelector("#map-point-count"),
  mapLoading: document.querySelector("#map-loading"),
};

let allProjects = [];
let sourceProjectCount = 0;
let excludedProjectCount = 0;
let approximateLocations = new Map();
let visibleProjects = [];
let selectedKey = null;
let displayLimit = 30;
let map = null;
let markerLayer = null;
let hasMap = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function cleanText(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(" · ");
  if (value && typeof value === "object") return "";
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function projectKey(project, index = allProjects.indexOf(project)) {
  return String(project.__siteKey ?? project.id ?? `row-${index}`);
}

function inStructureScope(project) {
  if (project.id == null || String(project.id).trim() === "") return false;
  const subject = `${project.name_th ?? ""} ${project.type ?? ""}`;
  if (!BUILDING_TERMS.test(subject) || OUT_OF_SCOPE_TERMS.test(subject)) return false;
  if (/^\s*(?:คดี|เหตุการณ์|เหตุ|อุบัติเหตุ|แผน|นโยบาย)/.test(subject)) return false;
  const evidence = `${project.status ?? ""} ${project.description ?? ""}`;
  return !NEVER_BUILT_TERMS.test(evidence);
}

function locationIdentity(project) {
  return `${cleanText(project.name_th).replace(/[\s\u200b]+/g, "").replace(/[–—]/g, "-")}|${cleanText(project.location).replace(/[\s\u200b]+/g, "").replace(/[–—]/g, "-")}`;
}

function projectState(project) {
  return String(project.record_quality?.state ?? "").toLowerCase();
}

function statusCategory(project) {
  const state = projectState(project);
  const text = `${project.status ?? ""} ${project.description ?? ""} ${state}`.toLowerCase();
  if (ALIASES.has(state) || /merged_alias|quarantin/.test(text)) return "alias";
  if (/candidate|ผู้สมัคร|ยังไม่ยืนยัน/.test(text)) return "candidate";
  if (/ก่อสร้างไม่เสร็จ|ทิ้งงาน|หยุดก่อสร้าง|ค้างก่อสร้าง|งานก่อสร้างไม่แล้วเสร็จ|unfinished|incomplete construction/.test(text)) return "unbuilt";
  if (/อยู่ระหว่าง|ระหว่างดำเนิน|กำลังปรับปรุง|กำลังซ่อม|แผนฟื้นฟู|เสนอให้|อยู่ในขั้น|in progress|rehabilitat/.test(text)) return "repair";
  if (/ทิ้งร้าง|ปล่อยร้าง|อาคารร้าง|ไม่ได้ใช้ประโยชน์|ไม่ใช้ประโยชน์|ใช้ประโยชน์ไม่ได้|ใช้งานไม่ได้|ไม่เคยเปิด|ไม่เคยใช้|ใช้ประโยชน์ต่ำ|ไม่สามารถเปิด|underused|unusable|abandoned|unused/.test(text)) return "unused";
  return "other";
}

function statusLabel(category) {
  return {
    alias: "รายการซ้ำ / กักกัน",
    candidate: "candidate · ตรวจต่อ",
    unbuilt: "ก่อสร้างค้าง / ทิ้งงาน",
    repair: "อยู่ระหว่างแก้ไข",
    unused: "ใช้ไม่ได้ / ใช้ประโยชน์ต่ำ",
    other: "ต้องอ่านสถานะ",
  }[category] ?? "ต้องอ่านสถานะ";
}

function confidenceLabel(project) {
  const match = String(project.egp?.match_status ?? "").toLowerCase();
  const state = projectState(project);
  const ids = procurementProjectIdGroups(project);
  if (ALIASES.has(state)) return "รายการเชื่อมโยง";
  if (ids.candidate.length && ids.confirmed.length) return "e-GP ยืนยัน + มี candidate";
  if (ids.candidate.length) return "e-GP candidate · ตรวจต่อ";
  if (match.includes("confirmed")) return "e-GP ยืนยัน";
  if (state.includes("candidate") || /candidate/i.test(project.status ?? "")) return "หลักฐานยังไม่ครบ";
  const confidence = project.record_quality?.confidence;
  if (confidence) return cleanText(confidence).slice(0, 70);
  return "ดูระดับหลักฐานในระเบียน";
}

function getProvince(project) {
  const place = `${project.location ?? ""} ${project.name_th ?? ""}`;
  return THAI_PROVINCES.find((province) => place.includes(province)) ?? "ไม่ระบุจังหวัด";
}

function getPoint(project) {
  const candidate = structuredProjectPoint(project);
  const fromRecord = candidate?.field === "record" ? candidate : null;
  if (fromRecord && validPoint(fromRecord.lat, fromRecord.lon)) {
    const caveats = project.record_quality?.caveats ?? [];
    const locationText = `${project.location ?? ""} ${project.egp?.coordinate_caveat ?? ""} ${project.egp?.subdistrict_caveat ?? ""}`;
    const warning = caveats.some((item) => /พิกัด|ตำบล|ตำแหน่ง/.test(item)) || /พิกัด.*(?:ยังไม่ยืนยัน|จุดค้น|ตรวจซ้ำ|ไม่ยืนยัน|ขัดแย้ง)/.test(locationText);
    const approximate = /approx|site|contract_declared/i.test(String(project.coordinates?.precision ?? ""));
    const source = approximate
      ? "พิกัดระดับไซต์โดยประมาณ"
      : warning ? "พิกัดโครงการที่ยังมีข้อควรระวัง" : "พิกัดในระเบียน";
    return { lat: fromRecord.lat, lon: fromRecord.lon, source, warning, approximate, precision: project.coordinates?.precision };
  }

  const fromEgp = candidate && candidate.field !== "record" ? candidate : null;
  if (fromEgp && validPoint(fromEgp.lat, fromEgp.lon)) {
    const caveats = project.record_quality?.caveats ?? [];
    const coordinateCaveat = `${project.egp?.coordinate_caveat ?? ""} ${project.egp?.subdistrict_caveat ?? ""}`;
    const warning = caveats.some((item) => /พิกัด|ตำบล|ตำแหน่ง/.test(item)) || Boolean(coordinateCaveat.trim());
    const approximate = /approx|โดยประมาณ|ระดับโครงการ|ระดับตำบล|ไม่ใช่พิกัดอาคาร|ยังไม่ยืนยัน.*(?:อาคาร|จุดตั้ง)|geometry ว่าง/i.test(coordinateCaveat) ||
      caveats.some((item) => /พิกัด.*(?:โดยประมาณ|ระดับโครงการ|ระดับตำบล|ไม่ใช่พิกัดอาคาร|ยังไม่ยืนยัน.*(?:อาคาร|จุดตั้ง)|geometry ว่าง)/i.test(item));
    return {
      lat: fromEgp.lat,
      lon: fromEgp.lon,
      source: warning ? "พิกัด e-GP ที่ยังมีข้อควรระวัง" : "พิกัดจาก e-GP",
      warning,
      approximate,
      precision: approximate ? "site_approximate" : undefined,
    };
  }
  const areaPoint = approximateLocations.get(locationIdentity(project));
  if (areaPoint && validPoint(areaPoint.lat, areaPoint.lon)) {
    const level = { tambon: "ตำบล", district: "อำเภอ/เขต", province: "จังหวัด" }[areaPoint.precision] ?? "พื้นที่";
    return {
      lat: Number(areaPoint.lat),
      lon: Number(areaPoint.lon),
      source: `ประมาณจากจุดศูนย์กลาง${level}`,
      area: areaPoint.area,
      precision: areaPoint.precision,
      warning: false,
      approximate: true,
    };
  }
  return null;
}

function validPoint(lat, lon) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) &&
    Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;
}

function mapSearchUrl(project) {
  return mapsTargetUrl(project, getPoint(project));
}

function photoOf(project) {
  return photosOf(project)[0] ?? null;
}

function photosOf(project) {
  return Array.isArray(project.images) ? project.images.filter((image) => image?.url) : [];
}

function budgetText(project) {
  if (project.budget_baht) return cleanText(project.budget_baht);
  if (project.egp?.price_agree_baht) {
    return `${Number(project.egp.price_agree_baht).toLocaleString("th-TH")} บาท (ราคาตกลง e-GP)`;
  }
  return "ยังไม่พบตัวเลขที่ยืนยันได้";
}

function searchText(project) {
  const egp = project.egp ?? {};
  return [
    project.id,
    project.name_th,
    project.name_en,
    project.location,
    project.responsible_agency,
    project.sector,
    project.type,
    project.status,
    project.description,
    project.budget_baht,
    ...(project.contractors ?? []).flatMap((c) => [c?.name, c?.note]),
    egp.govspending_project_id,
    egp.contract_no,
    egp.process5_contract_id,
    ...(project.sources ?? []),
  ].map(cleanText).join(" ").toLocaleLowerCase("th");
}

function addFilterOptions() {
  const provinces = [...new Set(allProjects.map(getProvince))].sort((a, b) => a.localeCompare(b, "th"));
  const sectors = [...new Set(allProjects.map((project) => cleanText(project.sector)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "th"));

  for (const province of provinces) {
    const option = document.createElement("option");
    option.value = province;
    option.textContent = province;
    els.province.append(option);
  }
  for (const sector of sectors) {
    const option = document.createElement("option");
    option.value = sector;
    option.textContent = sector;
    els.sector.append(option);
  }
}

function renderCard(project) {
  const key = projectKey(project);
  const image = photoOf(project);
  const imageCount = photosOf(project).length;
  const category = statusCategory(project);
  const location = cleanText(project.location) || "ยังไม่ระบุสถานที่";
  const id = project.id == null ? "ยังไม่มี ID ในฐาน" : `ID ${project.id}`;
  const imageMarkup = image
    ? `<div class="card-photo"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt ?? project.name_th)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" /><span class="sr-only">ภาพจาก ${escapeHtml(image.publisher ?? "แหล่งข่าว")}</span>${imageCount > 1 ? `<span class="photo-count">${imageCount.toLocaleString("th-TH")} ภาพ</span>` : ""}</div>`
    : `<div class="card-photo"><div class="card-photo-empty" aria-hidden="true"><span>ร.</span></div></div>`;

  return `<button class="project-card${key === selectedKey ? " is-active" : ""}" type="button" data-project-key="${escapeHtml(key)}" aria-pressed="${key === selectedKey}">
    ${imageMarkup}
    <span class="card-copy">
      <span class="card-kicker"><span class="project-id">${escapeHtml(id)}</span><span>${escapeHtml(cleanText(project.sector) || "ไม่ระบุหมวด")}</span></span>
      <span class="card-title">${escapeHtml(cleanText(project.name_th) || "ไม่ระบุชื่อโครงการ")}</span>
      <span class="card-location">⌖ ${escapeHtml(location)}</span>
      <span class="status-pill ${category}">${escapeHtml(statusLabel(category))}</span>
    </span>
  </button>`;
}

function detailFact(label, value) {
  return `<div class="fact"><span class="fact-label">${escapeHtml(label)}</span><span class="fact-value">${escapeHtml(value || "ไม่ระบุ")}</span></div>`;
}

function renderDetail(project) {
  if (!project) {
    els.details.innerHTML = `<div class="detail-empty"><span class="detail-number">02</span><p class="eyebrow eyebrow-dark">PROJECT FILE</p><h3>ไม่พบรายการที่ตรงกับตัวกรอง</h3><p>ลองเปลี่ยนคำค้นหรือกด “ล้างตัวกรอง”</p></div>`;
    return;
  }

  const category = statusCategory(project);
  const point = getPoint(project);
  const images = photosOf(project);
  const egpGroups = procurementProjectIdGroups(project);
  const egpIds = procurementProjectIds(project);
  const procurementUrls = [...new Set([...govspendingReferenceUrls(project), ...process5ReferenceUrls(project)])];
  const egpLinks = procurementUrls.map((url) => {
    const host = new URL(url).hostname;
    const egpId = new URL(url).searchParams.get("project_id") ?? new URL(url).searchParams.get("projectId");
    const label = host === "api-govspending.data.go.th" ? `GovSpending${egpId ? ` · ${egpId}` : ""}` : `e-GP Process5${egpId ? ` · ${egpId}` : ""}`;
    return `<a class="action-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`;
  }).join("");
  const uniqueSources = [...new Set([...(project.sources ?? []), ...(project.images ?? []).map((item) => item.source_url)].filter(Boolean))];
  const sourcesMarkup = uniqueSources.length
    ? `<details class="source-list"><summary>แหล่งอ้างอิง ${uniqueSources.length} รายการ</summary><ul>${uniqueSources.map((source, index) => `<li><a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceLabel(source, index))} ↗</a></li>`).join("")}</ul></details>`
    : `<p class="detail-status">ยังไม่มีแหล่งอ้างอิงแนบในระเบียนนี้</p>`;
  const pictureMarkup = images.length
    ? `<div class="detail-gallery" aria-label="ภาพประกอบ ${images.length} ภาพ">${images.map((image, index) => `<figure class="detail-image"><a href="${escapeHtml(image.source_url ?? image.url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt ?? project.name_th)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" /></a><figcaption>ภาพ ${index + 1}${images.length > 1 ? ` / ${images.length}` : ""}: ${escapeHtml(image.publisher ?? "แหล่งข่าว")}${image.source_year_buddhist ? ` · ${escapeHtml(image.source_year_buddhist)}` : ""} — ${escapeHtml(image.caption ?? "เปิดดูบทความต้นทาง ↗")}</figcaption></figure>`).join("")}</div>`
    : "";
  const pointText = point
    ? `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)} · ${point.source}${point.area ? ` (${point.area})` : ""}`
    : "ยังไม่มีพิกัดที่ลงแผนที่ได้";
  const warning = point?.warning
    ? `<p class="detail-status">⚠ ${escapeHtml(point.source)}; ตรวจสอบกับแหล่งต้นทางก่อนใช้เป็นจุดอ้างอิง</p>`
    : point?.approximate
      ? `<p class="detail-status">${escapeHtml(approximatePointDescription(point))}</p>`
    : point
      ? `<p class="detail-status">ตำแหน่งจากข้อมูลที่มีในทะเบียน ไม่ใช่การยืนยันเขตแปลงที่ดิน</p>`
      : `<p class="detail-status">ค้นชื่อและสถานที่บน Google Maps ได้ แต่ผลค้นหาไม่ใช่พิกัดยืนยัน</p>`;
  const agency = cleanText(project.responsible_agency) || "ยังไม่ระบุหน่วยงาน";
  const start = cleanText(project.year_started);
  const abandoned = cleanText(project.year_abandoned);
  const crossRefs = (project.see_also ?? []).filter((id) => allProjects.some((item) => String(item.id) === String(id)));
  const relatedMarkup = crossRefs.length
    ? `<div class="detail-status">รายการเชื่อมโยง: ${crossRefs.map((id) => `<button type="button" class="text-action" data-related-id="${escapeHtml(id)}">ID ${escapeHtml(id)}</button>`).join(" · ")}</div>`
    : "";
  const egpFacts = [];
  if (egpGroups.confirmed.length) egpFacts.push(`เลขยืนยัน ${egpGroups.confirmed.join(" · ")}`);
  if (egpGroups.candidate.length) egpFacts.push(`candidate (ยังไม่ยืนยัน) ${egpGroups.candidate.join(" · ")}`);
  if (project.egp?.contract_no) egpFacts.push(`สัญญา ${project.egp.contract_no}`);
  const egpFact = egpFacts.join("; ") || (egpIds.length ? `เลขโครงการ GovSpending/e-GP ${egpIds.join(" · ")}` : "ยังไม่ยืนยันเลข e-GP");
  const contractorsValue = (project.contractors ?? [])
    .map((c) => [cleanText(c.name), cleanText(c.note)].filter(Boolean).join(" — "))
    .filter(Boolean)
    .join(" · ");
  const contractorsFact = contractorsValue ? detailFact("ผู้รับเหมา", contractorsValue) : "";

  els.details.innerHTML = `<article class="detail-content">
    <div class="detail-meta"><span>${escapeHtml(project.id == null ? "ยังไม่มี ID ในฐาน" : `ID ${project.id}`)}</span><span>•</span><span>${escapeHtml(getProvince(project))}</span><span>•</span><span>${escapeHtml(confidenceLabel(project))}</span></div>
    <h3>${escapeHtml(cleanText(project.name_th) || "ไม่ระบุชื่อโครงการ")}</h3>
    <p class="status-pill ${category}">${escapeHtml(statusLabel(category))}</p>
    ${warning}
    <p class="detail-copy">${escapeHtml(cleanText(project.description) || "ไม่มีคำอธิบายแนบในระเบียน")}</p>
    ${pictureMarkup}
    <div class="detail-facts">
      ${detailFact("งบ / มูลค่าที่รายงาน", budgetText(project))}
      ${detailFact("หน่วยงาน", agency)}
      ${contractorsFact}
      ${detailFact("เริ่มก่อสร้าง", start || "ไม่ระบุ")}
      ${detailFact("ช่วงเริ่มทิ้งร้าง / เปลี่ยนสถานะ", abandoned || "ไม่ระบุ")}
      ${detailFact("พิกัด", pointText)}
      ${detailFact("จัดซื้อจัดจ้าง", egpFact)}
    </div>
    ${relatedMarkup}
    <div class="detail-actions">
      <a class="action-link primary" href="${escapeHtml(mapSearchUrl(project))}" target="_blank" rel="noopener noreferrer">${point ? "เปิดค้นหา / นำทางบน Maps" : "ค้นหาสถานที่บน Google Maps"} ↗</a>
      ${egpLinks}
    </div>
    ${sourcesMarkup}
  </article>`;
}

function sourceLabel(url, index) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const known = {
      "thaipbs.or.th": "Thai PBS",
      "thaipbs.th": "Thai PBS",
      "isranews.org": "สำนักข่าวอิศรา",
      "thairath.co.th": "ไทยรัฐออนไลน์",
      "api-govspending.data.go.th": "GovSpending API",
      "process5.gprocurement.go.th": "e-GP Process5",
      "nacc.go.th": "ป.ป.ช.",
    };
    return known[host] ?? host;
  } catch {
    return `แหล่งอ้างอิง ${index + 1}`;
  }
}

function filteredProjects() {
  const query = els.search.value.trim().toLocaleLowerCase("th");
  const province = els.province.value;
  const sector = els.sector.value;
  const status = els.status.value;
  const photoOnly = els.photo.checked;

  const matches = allProjects.filter((project) => {
    const category = statusCategory(project);
    if (!status && category === "alias") return false;
    if (status && category !== status) return false;
    if (province && getProvince(project) !== province) return false;
    if (sector && cleanText(project.sector) !== sector) return false;
    if (photoOnly && !photoOf(project)) return false;
    if (query && !searchText(project).includes(query)) return false;
    return true;
  });
  return matches.sort((a, b) => {
    if (els.sort.value === "photos") {
      const photoDifference = Number(photosOf(b).length > 0) - Number(photosOf(a).length > 0);
      if (photoDifference) return photoDifference;
    }
    if (els.sort.value === "name") {
      const byName = cleanText(a.name_th).localeCompare(cleanText(b.name_th), "th");
      if (byName) return byName;
    }
    const aId = Number(a.id);
    const bId = Number(b.id);
    if (Number.isFinite(aId) && Number.isFinite(bId)) return bId - aId;
    return cleanText(a.name_th).localeCompare(cleanText(b.name_th), "th");
  });
}

function refreshMarkers(projects) {
  if (!hasMap || !markerLayer) return;
  markerLayer.clearLayers();
  const groups = new Map();

  for (const project of projects) {
    const point = getPoint(project);
    if (!point) continue;
    const groupKey = `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { point, projects: [] });
    groups.get(groupKey).projects.push(project);
  }

  for (const { point, projects: groupedProjects } of groups.values()) {
    const groupedPoints = groupedProjects.map(getPoint);
    const warning = groupedPoints.some((entry) => entry.warning);
    const approximate = !warning && groupedPoints.every((entry) => entry.approximate);
    const count = groupedProjects.length;
    const icon = L.divIcon({
      className: "",
      html: `<span class="map-marker${warning ? " warning" : approximate ? " approximate" : ""}${count > 1 ? " grouped" : ""}" aria-hidden="true">${count > 1 ? count.toLocaleString("th-TH") : ""}</span>`,
      iconSize: count > 1 ? [27, 27] : [15, 15],
      iconAnchor: count > 1 ? [13.5, 13.5] : [7.5, 7.5],
    });
    const marker = L.marker([point.lat, point.lon], { icon, title: `${count} โครงการ`, keyboard: true });
    const title = count > 1 ? `${count} รายการในบริเวณเดียวกัน` : cleanText(groupedProjects[0].name_th) || "ไม่ระบุชื่อโครงการ";
    const note = point.approximate
      ? `${point.source} · ${point.area ?? "ไม่ระบุพื้นที่"}`
      : warning
        ? "พิกัดโครงการมีข้อควรระวัง — ตรวจต่อ"
        : count > 1 ? "หมุดเดียวกันหลายระเบียน" : statusLabel(statusCategory(groupedProjects[0]));
    const links = groupedProjects.map((project) => `<a class="popup-open" href="#directory" data-popup-key="${escapeHtml(projectKey(project))}">${escapeHtml(cleanText(project.name_th) || "ไม่ระบุชื่อโครงการ")} ↗</a>`).join("");
    marker.bindPopup(`<div class="popup-title">${escapeHtml(title)}</div><div class="popup-note">${escapeHtml(note)}</div>${links}`);
    if (count === 1) marker.on("click", () => selectProject(groupedProjects[0], { scroll: false, pan: false }));
    markerLayer.addLayer(marker);
  }

  const points = [...groups.values()].map((group) => group.point);
  const projectPointCount = [...groups.values()].reduce((sum, group) => sum + group.projects.length, 0);
  els.mapPointCount.textContent = projectPointCount.toLocaleString("th-TH");
  if (points.length && !map._hasInitialBounds) {
    map.fitBounds(L.latLngBounds(points.map((point) => [point.lat, point.lon])).pad(0.18), { maxZoom: 6 });
    map._hasInitialBounds = true;
  }
}

function render(resetLimit = true) {
  if (typeof resetLimit !== "boolean") resetLimit = true;
  if (resetLimit) displayLimit = 30;
  visibleProjects = filteredProjects();
  const keys = new Set(visibleProjects.map((project) => projectKey(project)));
  if (!keys.has(selectedKey)) selectedKey = visibleProjects.length ? projectKey(visibleProjects[0]) : null;

  els.list.setAttribute("aria-busy", "false");
  els.count.textContent = `${visibleProjects.length.toLocaleString("th-TH")} รายการ`;
  const hiddenAliases = allProjects.filter((project) => statusCategory(project) === "alias").length;
  els.caption.textContent = els.status.value === "alias"
    ? "แสดงระเบียน alias / กักกันของสิ่งปลูกสร้าง"
    : `ขอบเขตอาคาร/สิ่งปลูกสร้าง · ซ่อน alias / กักกัน ${hiddenAliases} รายการ`;

  if (visibleProjects.length) {
    els.list.innerHTML = visibleProjects.slice(0, displayLimit).map(renderCard).join("");
  } else {
    els.list.innerHTML = `<div class="no-results"><span aria-hidden="true">⌕</span>ไม่พบรายการ ลองคำค้นหรือเงื่อนไขอื่น</div>`;
  }
  const remaining = Math.max(0, visibleProjects.length - displayLimit);
  els.listEnd.innerHTML = remaining
    ? `<button class="load-more" type="button" id="load-more">แสดงเพิ่ม 30 รายการ <span>เหลืออีก ${remaining.toLocaleString("th-TH")}</span></button>`
    : "";

  const selected = visibleProjects.find((project) => projectKey(project) === selectedKey) ?? null;
  renderDetail(selected);
  refreshMarkers(visibleProjects);
}

function selectProject(project, options = {}) {
  selectedKey = projectKey(project);
  render(false);
  if (options.pan !== false && hasMap) {
    const point = getPoint(project);
    if (point) map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 9), { duration: 0.45 });
  }
  if (options.scroll !== false && window.matchMedia("(max-width: 800px)").matches) {
    document.querySelector(".map-column").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function initMap() {
  if (!window.L) {
    els.mapLoading.textContent = "โหลดไลบรารีแผนที่ไม่สำเร็จ — ยังใช้รายการและลิงก์ค้นหาได้";
    els.mapLoading.classList.add("is-error");
    return;
  }

  map = L.map("map", { scrollWheelZoom: false, zoomControl: true, preferCanvas: true }).setView([13.35, 101.05], 5.4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  hasMap = true;
  els.mapLoading.classList.add("is-hidden");
  refreshMarkers(visibleProjects.length ? visibleProjects : allProjects.filter((project) => statusCategory(project) !== "alias"));
  setTimeout(() => map.invalidateSize(), 150);
}

function updateStats(database) {
  const primary = allProjects.filter((project) => statusCategory(project) !== "alias");
  const mapped = primary.filter((project) => getPoint(project));
  const verifiedCoordinateCount = mapped.filter((project) => !getPoint(project).approximate).length;
  const approximateCoordinateCount = mapped.length - verifiedCoordinateCount;
  const photos = primary.filter((project) => photoOf(project));
  els.statTotal.textContent = primary.length.toLocaleString("th-TH");
  els.statMapped.textContent = mapped.length.toLocaleString("th-TH");
  els.statPhotos.textContent = photos.length.toLocaleString("th-TH");
  const date = database.last_updated ?? database.metadata?.last_updated;
  els.updated.textContent = date ? toThaiDate(date) : "ไม่ระบุ";
  els.mapPointCount.textContent = mapped.length.toLocaleString("th-TH");
  document.querySelector("#scope-note").textContent = `คัดจาก ${sourceProjectCount.toLocaleString("th-TH")} ระเบียน · ตัดรายการนอกขอบเขต/ไม่มี ID ${excludedProjectCount.toLocaleString("th-TH")} · พิกัดสถานที่ ${verifiedCoordinateCount} จุด / จุดประมาณระดับพื้นที่หรือไซต์ ${approximateCoordinateCount} จุด`;
}

function toThaiDate(date) {
  const match = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(date);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const year = Number(match[1]) + 543;
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${year}`;
}

async function start() {
  try {
    const response = await fetch(DATABASE_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const database = await response.json();
    if (!Array.isArray(database.projects)) throw new Error("ไม่พบ projects[] ใน database.json");
    const sourceProjects = database.projects.filter((project) => project && typeof project === "object");
    sourceProjectCount = sourceProjects.length;
    sourceProjects.forEach((project, index) => { project.__siteKey = project.id == null ? `row-${index}` : String(project.id); });
    allProjects = sourceProjects.filter(inStructureScope);
    excludedProjectCount = sourceProjectCount - allProjects.length;
    try {
      const locationResponse = await fetch(MAP_LOCATIONS_URL, { cache: "no-store" });
      if (locationResponse.ok) {
        const locationData = await locationResponse.json();
        approximateLocations = new Map((locationData.locations ?? []).map((entry) => [entry.key, entry]));
      }
    } catch {
      approximateLocations = new Map();
    }
    selectedKey = null;
    addFilterOptions();
    updateStats(database);
    initMap();
    render();
  } catch (error) {
    els.list.setAttribute("aria-busy", "false");
    els.list.innerHTML = `<div class="no-results">อ่านฐานข้อมูลไม่สำเร็จ (${escapeHtml(error.message)}). เปิดเว็บผ่าน HTTP เช่น <code>python3 -m http.server</code> แทนการเปิดไฟล์โดยตรง</div>`;
    els.count.textContent = "โหลดข้อมูลไม่ได้";
  }
}

document.querySelector("#filters").addEventListener("submit", (event) => event.preventDefault());
for (const control of [els.search, els.province, els.sector, els.status, els.sort, els.photo]) {
  control.addEventListener(control === els.search ? "input" : "change", render);
}
els.clear.addEventListener("click", () => {
  els.search.value = "";
  els.province.value = "";
  els.sector.value = "";
  els.status.value = "";
  els.photo.checked = false;
  selectedKey = null;
  render();
});
els.listEnd.addEventListener("click", (event) => {
  if (!event.target.closest("#load-more")) return;
  displayLimit += 30;
  render(false);
});
els.list.addEventListener("click", (event) => {
  const card = event.target.closest("[data-project-key]");
  if (!card) return;
  const project = allProjects.find((item) => projectKey(item) === card.dataset.projectKey);
  if (project) selectProject(project);
});
els.details.addEventListener("click", (event) => {
  const related = event.target.closest("[data-related-id]");
  if (!related) return;
  const project = allProjects.find((item) => String(item.id) === related.dataset.relatedId);
  if (project) {
    els.search.value = "";
    els.province.value = "";
    els.sector.value = "";
    els.status.value = "alias";
    selectProject(project);
  }
});
document.querySelector("#map").addEventListener("click", (event) => {
  const link = event.target.closest("[data-popup-key]");
  if (!link) return;
  const project = allProjects.find((item) => projectKey(item) === link.dataset.popupKey);
  if (project) selectProject(project, { scroll: false, pan: false });
});
document.querySelector("#map-reset").addEventListener("click", () => {
  if (!hasMap) return;
  const visiblePoints = visibleProjects.map((project) => getPoint(project)).filter(Boolean);
  if (visiblePoints.length) {
    map.fitBounds(L.latLngBounds(visiblePoints.map((point) => [point.lat, point.lon])).pad(0.18), { maxZoom: 6 });
  } else {
    map.setView([13.35, 101.05], 5.4);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
    event.preventDefault();
    els.search.focus();
  }
  if (event.key === "Escape" && document.activeElement === els.search) {
    els.search.value = "";
    render();
    els.search.blur();
  }
});

start();
