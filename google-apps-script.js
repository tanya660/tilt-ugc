// ══════════════════════════════════════════════════════════════════════════════
// TILT UGC — Google Apps Script
// Paste this into: Google Sheet → Extensions → Apps Script
// ══════════════════════════════════════════════════════════════════════════════

var SUPABASE_URL = "https://poluaucqywnvcdgeytdr.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbHVhdWNxeXdudmNkZ2V5dGRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjAyOTQsImV4cCI6MjA4OTkzNjI5NH0.U0avQqPCLRAjDyc2gGHRTALc42fp-pV4ZWO9llXQexM";
var BRIEFS_SHEET_NAME = "Briefs";

// ── Helper: Supabase REST request ────────────────────────────────────────────
function supabaseRequest(path, method, payload) {
  var options = {
    method: method || "get",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    muteHttpExceptions: true
  };
  if (payload) {
    options.payload = JSON.stringify(payload);
  }
  var response = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/" + path, options);
  return JSON.parse(response.getContentText());
}

// ── Helper: Look up creator ID by name ───────────────────────────────────────
function getCreatorIdByName(name) {
  var result = supabaseRequest("creators?name=eq." + encodeURIComponent(name) + "&select=id", "get");
  if (result && result.length > 0) {
    return result[0].id;
  }
  return null;
}

// ── Helper: Check if video_id already exists ─────────────────────────────────
function videoExists(videoId) {
  var result = supabaseRequest("videos?video_id=eq." + encodeURIComponent(videoId) + "&select=id", "get");
  return result && result.length > 0;
}

// ── onEdit trigger: Auto-create video in Supabase ────────────────────────────
// This runs every time someone edits a cell in the spreadsheet.
// It checks if the edited row in the "Briefs" tab has Video ID + Creator + Hook,
// and if so, creates a video record in Supabase.
function onSheetEdit(e) {
  var sheet = e.source.getActiveSheet();

  // Only act on the Briefs sheet
  if (sheet.getName() !== BRIEFS_SHEET_NAME) return;

  var row = e.range.getRow();
  // Skip header row
  if (row <= 1) return;

  var values = sheet.getRange(row, 1, 1, 9).getValues()[0];
  var videoId     = String(values[0] || "").trim();
  var creatorName = String(values[1] || "").trim();
  var delivery    = String(values[2] || "").trim();
  var hook        = String(values[3] || "").trim();
  var script      = String(values[4] || "").trim();
  var cta         = String(values[5] || "").trim();
  var dueDate     = values[6];
  var assignedDate= values[7];
  var status      = String(values[8] || "").trim();

  // Need at least Video ID + Creator + Hook
  if (!videoId || !creatorName || !hook) return;

  // Don't re-create if already assigned
  if (status === "assigned" || status === "posted") return;

  // Check if this video already exists in Supabase
  if (videoExists(videoId)) {
    // Just mark the status in the sheet if not already set
    if (!status) {
      sheet.getRange(row, 9).setValue("assigned");
    }
    return;
  }

  // Look up creator
  var creatorId = getCreatorIdByName(creatorName);
  if (!creatorId) {
    Logger.log("Creator not found: " + creatorName);
    return;
  }

  // Format dates
  var dueDateStr = "";
  if (dueDate instanceof Date) {
    dueDateStr = Utilities.formatDate(dueDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
  } else if (dueDate) {
    dueDateStr = String(dueDate);
  }

  var assignedDateStr = "";
  if (assignedDate instanceof Date) {
    assignedDateStr = Utilities.formatDate(assignedDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
  } else if (assignedDate) {
    assignedDateStr = String(assignedDate);
  }
  if (!assignedDateStr) {
    assignedDateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  // Create video in Supabase
  var videoData = {
    id: videoId + "-" + new Date().getTime(),
    video_id: videoId,
    creator_id: creatorId,
    delivery: delivery,
    hook: hook,
    script: script,
    cta: cta,
    due_date: dueDateStr || null,
    assigned_date: assignedDateStr,
    status: "assigned",
    video_url: "",
    platform: "TikTok"
  };

  var result = supabaseRequest("videos", "post", videoData);
  Logger.log("Created video: " + JSON.stringify(result));

  // Update the Status column in the sheet
  sheet.getRange(row, 9).setValue("assigned");
}

// ── doGet: Return all Briefs rows as JSON ────────────────────────────────────
// Used by the app's "Sync from Sheets" button
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BRIEFS_SHEET_NAME);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return ContentService.createTextOutput(JSON.stringify({ rows: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  var rows = [];

  for (var i = 0; i < data.length; i++) {
    var videoId = String(data[i][0] || "").trim();
    if (!videoId) continue;

    var dueDate = data[i][6];
    var assignedDate = data[i][7];

    rows.push({
      videoId: videoId,
      creator: String(data[i][1] || "").trim(),
      delivery: String(data[i][2] || "").trim(),
      hook: String(data[i][3] || "").trim(),
      script: String(data[i][4] || "").trim(),
      cta: String(data[i][5] || "").trim(),
      dueDate: dueDate instanceof Date ? Utilities.formatDate(dueDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(dueDate || ""),
      assignedDate: assignedDate instanceof Date ? Utilities.formatDate(assignedDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(assignedDate || ""),
      status: String(data[i][8] || "").trim(),
      rowNumber: i + 2
    });
  }

  return ContentService.createTextOutput(JSON.stringify({ rows: rows }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── doPost: Update a row's Status column ─────────────────────────────────────
// Called by the app when a video status changes
function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var videoId = body.video_id;
  var newStatus = body.status;

  if (!videoId || !newStatus) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Missing video_id or status" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BRIEFS_SHEET_NAME);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === videoId) {
      sheet.getRange(i + 2, 9).setValue(newStatus);
      return ContentService.createTextOutput(JSON.stringify({ success: true, row: i + 2 }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ error: "Video ID not found in sheet" }))
    .setMimeType(ContentService.MimeType.JSON);
}
