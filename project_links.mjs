const GOVSPENDING_HOST = "api-govspending.data.go.th";
const PROCESS5_HOST = "process5.gprocurement.go.th";

function asUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function isValidPoint(point) {
  return point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)) &&
    Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lon)) <= 180;
}

function parsePoint(value) {
  if (isValidPoint(value)) return { lat: Number(value.lat), lon: Number(value.lon) };
  if (typeof value !== "string") return null;
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const point = { lat: Number(match[1]), lon: Number(match[2]) };
  return isValidPoint(point) ? point : null;
}

function relatedContractReferences(project) {
  const related = [
    ...(Array.isArray(project?.egp?.related_contracts) ? project.egp.related_contracts : []),
    ...(Array.isArray(project?.related_procurements) ? project.related_procurements : []),
  ];
  return related.flatMap((contract) => [
    contract?.source_url,
    ...(Array.isArray(contract?.source_urls) ? contract.source_urls : []),
    ...(Array.isArray(contract?.process5_source_urls) ? contract.process5_source_urls : []),
  ]);
}

export function govspendingReferenceUrls(project) {
  const values = [
    ...(Array.isArray(project?.sources) ? project.sources : []),
    project?.egp?.source_url,
    ...(Array.isArray(project?.egp?.source_urls) ? project.egp.source_urls : []),
    ...relatedContractReferences(project),
  ];
  const seen = new Set();
  return values.filter((value) => {
    const url = asUrl(value);
    if (!url || url.hostname !== GOVSPENDING_HOST || !url.pathname.includes("/egp/project_detail")) return false;
    if (seen.has(url.href)) return false;
    seen.add(url.href);
    return true;
  });
}

export function process5ReferenceUrls(project) {
  const values = [
    ...(Array.isArray(project?.sources) ? project.sources : []),
    project?.egp?.process5_source_url,
    ...(Array.isArray(project?.egp?.process5_source_urls) ? project.egp.process5_source_urls : []),
    ...relatedContractReferences(project),
  ];
  // one button per project id: same project appears under 4 endpoint paths
  // (getProjectDetail / getProcurementDetail / getProcureResult / getContractAvailable);
  // prefer the richest endpoint per id instead of showing near-identical buttons.
  const preferred = ["getContractAvailable", "getProcureResult", "getProjectDetail", "getProcurementDetail"];
  const byProject = new Map();
  for (const value of values) {
    const url = asUrl(value);
    if (!url || url.hostname !== PROCESS5_HOST) continue;
    const projectId = url.searchParams.get("projectId");
    if (!projectId) continue;
    const path = url.pathname;
    const rank = preferred.findIndex((name) => path.includes(name));
    const candidate = { url, rank: rank === -1 ? preferred.length : rank };
    const current = byProject.get(projectId);
    if (!current || candidate.rank < current.rank) byProject.set(projectId, candidate);
  }
  return [...byProject.values()].map((entry) => entry.url.href);
}

export function procurementProjectIdGroups(project) {
  const egp = project?.egp ?? {};
  const explicit = [
    egp.govspending_project_id,
    egp.project_id,
    ...(Array.isArray(egp.project_ids) ? egp.project_ids : []),
    ...(Array.isArray(egp.projects) ? egp.projects.flatMap((item) => [item?.govspending_project_id, item?.project_id]) : []),
    ...(Array.isArray(egp.related_contracts) ? egp.related_contracts.flatMap((item) => [item?.govspending_project_id, item?.project_id]) : []),
  ];
  const referenceUrls = [...govspendingReferenceUrls(project), ...process5ReferenceUrls(project)];
  const fromUrls = referenceUrls.flatMap((value) => {
    const url = asUrl(value);
    const id = url?.searchParams.get("project_id") ?? url?.searchParams.get("projectId");
    return id ? [id] : [];
  });
  const candidateIds = new Set((Array.isArray(egp.candidate_projects) ? egp.candidate_projects : [])
    .map((item) => String(item?.project_id ?? "").trim())
    .filter((value) => /^\d{11}$/.test(value)));
  const allIds = [...new Set([...explicit, ...fromUrls]
    .map((value) => String(value ?? "").trim())
    .filter((value) => /^\d{11}$/.test(value)))];
  return {
    confirmed: allIds.filter((value) => !candidateIds.has(value)),
    candidate: [...candidateIds],
  };
}

export function procurementProjectIds(project) {
  const groups = procurementProjectIdGroups(project);
  return [...groups.confirmed, ...groups.candidate];
}

export function structuredProjectPoint(project) {
  const egp = project?.egp ?? {};
  const candidates = [
    [project?.coordinates, "record"],
    [egp.govspending_location, "egp.govspending_location"],
    [egp.coordinates, "egp.coordinates"],
    [egp.reported_coordinates, "egp.reported_coordinates"],
    [egp.egp_coordinate, "egp.egp_coordinate"],
  ];
  for (const [value, field] of candidates) {
    const point = parsePoint(value);
    if (point) return { ...point, field };
  }
  return null;
}

export function approximatePointDescription(point) {
  if (point?.precision === "tambon") {
    return "◎ จุดนี้เป็นศูนย์กลางตำบล ไม่ใช่พิกัดอาคารจริง; ใช้ดูบริเวณโดยรวมและค้นหมุดอาคารต่อ";
  }
  if (point?.precision === "district") {
    return "◎ จุดนี้เป็นศูนย์กลางอำเภอ/เขต ไม่ใช่พิกัดอาคารจริง; ใช้ดูบริเวณโดยรวมและค้นหมุดอาคารต่อ";
  }
  if (point?.precision === "province") {
    return "◎ จุดนี้เป็นศูนย์กลางจังหวัด ไม่ใช่พิกัดอาคารจริง; ใช้ดูบริเวณโดยรวมและค้นหมุดอาคารต่อ";
  }
  return "◎ จุดนี้เป็นพิกัดไซต์โดยประมาณ ไม่ใช่หมุดยืนยันอาคารจริง; ใช้ดูบริเวณโดยรวมและค้นหมุดอาคารต่อ";
}

export function mapsTargetUrl(project, point) {
  if (project?.maps_pin_url) return project.maps_pin_url;
  if (point && !point.warning && !point.approximate) {
    const query = `${Number(point.lat)},${Number(point.lon)}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  if (project?.maps_search_url) return project.maps_search_url;
  const query = [project?.name_th, project?.location].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
