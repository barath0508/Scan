/**
 * Energize 2026 - Event Management Extension
 * Created by Antigravity
 */

const CONFIG = {
  EVENT_NAME: "Energize 2026",
  PRIMARY_COLOR: "#6366f1",
  SECONDARY_COLOR: "#8b5cf6",
  STAFF_PASSCODE: "2026",
  VENUES: ["Main Entrance", "Registration Desk", "Hall A", "Food Court"],
  AUTHORIZED_STAFF_SHEET_NAME: "Authorized Staff",

  // ✅ PASTE YOUR SPREADSHEET ID HERE
  // Found in your Sheet URL: docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
  SPREADSHEET_ID: "19ku49oQjHEfPqwcALSBp7iRH0E7yiF5e1En4eWYpC-Q",

  COLUMN_MAPPING: {
    EMAIL: 2,
    TEAM_NAME: 3,
    LEADER_NAME: 4,
    TRACK: 25,
    TOKEN: 27,
    QR_LINK: 28,
    STATUS: 29,
    CHECKIN_TIME: 30,
    SCANNER_NAME: 31,
    CHECKIN_VENUE: 32
  }
};

/**
 * Helper to get the spreadsheet. Works from any account.
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Adds a custom menu to the spreadsheet.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Energize 2026 ⚡')
    .addItem('1. Initialize Sheet Layout', 'setupSheet')
    .addItem('2. Setup Authorized Staff', 'setupAuthorizedStaffSheet')
    .addItem('3. Generate QR Codes', 'generateTokensAndQRs')
    .addItem('4. Send Emails to Leaders', 'sendEmails')
    .addSeparator()
    .addItem('📊 Open Analytics Dashboard', 'showAnalyticsSidebar')
    .addItem('⚙️ Get Web App URL', 'showWebAppUrl')
    .addItem('⚙️ Get Private Scanner URL', 'showScannerUrl')
    .addToUi();
}

/**
 * Creates the Authorized Staff sheet if it doesn't exist.
 */
function setupAuthorizedStaffSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.AUTHORIZED_STAFF_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.AUTHORIZED_STAFF_SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([["EMAIL ADDRESS", "NAME / NOTES"]])
         .setBackground('#1e293b').setFontColor('white').setFontWeight('bold');
    sheet.setColumnWidth(1, 250);
  }
  SpreadsheetApp.getUi().alert('✅ Authorized Staff sheet is ready. Add emails in Column A.');
}

/**
 * Ensures the sheet has the required columns for the extension.
 */
function setupSheet() {
  const sheet = getSpreadsheet().getSheets()[0];
  const headers = ["TOKEN ID", "QR CODE LINK", "CHECK-IN STATUS", "CHECK-IN TIME", "SCANNER NAME", "VENUE"];
  
  const lastCol = sheet.getLastColumn();
  if (lastCol < CONFIG.COLUMN_MAPPING.TOKEN) {
    sheet.getRange(1, CONFIG.COLUMN_MAPPING.TOKEN, 1, headers.length)
         .setValues([headers])
         .setBackground('#1e293b')
         .setFontColor('white')
         .setFontWeight('bold');
    sheet.autoResizeColumns(CONFIG.COLUMN_MAPPING.TOKEN, headers.length);
    Logger.log('Sheet initialized with tracking columns.');
  } else {
    const currentHeaders = sheet.getRange(1, CONFIG.COLUMN_MAPPING.TOKEN, 1, headers.length).getValues()[0];
    if (!currentHeaders.includes("SCANNER NAME")) {
       sheet.getRange(1, CONFIG.COLUMN_MAPPING.TOKEN, 1, headers.length)
         .setValues([headers])
         .setBackground('#1e293b')
         .setFontColor('white')
         .setFontWeight('bold');
       Logger.log('Updated sheet with new tracking columns.');
    } else {
       Logger.log('Tracking columns already exist.');
    }
  }
}

/**
 * Generates unique tokens and QR code URLs for each row.
 */
function generateTokensAndQRs() {
  const sheet = getSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  
  // Use the deployed web app URL. Falls back to CONFIG if not deployed yet.
  let webAppUrl = ScriptApp.getService().getUrl();
  if (!webAppUrl) {
    Logger.log('ERROR: Web App is not deployed. Please deploy as Web App first.');
    return;
  }
  
  // Strip the mode parameter if present
  webAppUrl = webAppUrl.split('?')[0];

  const updates = [];
  for (let i = 1; i < data.length; i++) {
    let token = data[i][CONFIG.COLUMN_MAPPING.TOKEN - 1];
    if (!token) {
      token = 'ENG26-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(webAppUrl + '?id=' + token)}`;
    updates.push([token, qrUrl]);
  }
  
  if (updates.length === 0) {
    Logger.log('No data rows found in the sheet.');
    return;
  }

  sheet.getRange(2, CONFIG.COLUMN_MAPPING.TOKEN, updates.length, 2).setValues(updates);
  Logger.log('✅ QR Codes generated for ' + updates.length + ' rows.');
}

/**
 * Sends invitation emails with QR codes to team leaders.
 */
function sendEmails() {
  const sheet = getSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  let sentCount = 0;

  for (let i = 1; i < data.length; i++) {
    const email = data[i][CONFIG.COLUMN_MAPPING.EMAIL - 1];
    const teamName = data[i][CONFIG.COLUMN_MAPPING.TEAM_NAME - 1];
    const leaderName = data[i][CONFIG.COLUMN_MAPPING.LEADER_NAME - 1];
    const qrUrl = data[i][CONFIG.COLUMN_MAPPING.QR_LINK - 1];
    const status = data[i][CONFIG.COLUMN_MAPPING.STATUS - 1];

    if (email && qrUrl && status !== 'EMAIL_SENT' && status !== 'CHECKED_IN') {
      const template = HtmlService.createTemplateFromFile('Email');
      template.leaderName = leaderName;
      template.teamName = teamName;
      template.qrUrl = qrUrl;
      template.eventName = CONFIG.EVENT_NAME;
      
      const htmlBody = template.evaluate().getContent();
      
      GmailApp.sendEmail(email, `🎟️ Your Entry Ticket: ${CONFIG.EVENT_NAME} - ${teamName}`, '', {
        htmlBody: htmlBody,
        name: CONFIG.EVENT_NAME
      });
      
      sheet.getRange(i + 1, CONFIG.COLUMN_MAPPING.STATUS).setValue('EMAIL_SENT');
      sentCount++;
    }
  }
  
  SpreadsheetApp.getUi().alert(`✅ Sent ${sentCount} emails.`);
}

/**
 * Handles the QR scan (Web App Entry Point).
 */
function doGet(e) {
  const mode   = e.parameter.mode;
  const id     = e.parameter.id;
  const action = e.parameter.action;

  // ── JSON API (for external Vercel app) ──────────────────────────────
  if (action) {
    let result;
    const passcode = e.parameter.passcode || '';

    try {
      switch (action) {
        case 'venues':
          result = { venues: CONFIG.VENUES };
          break;

        case 'verify':
          result = { valid: passcode === CONFIG.STAFF_PASSCODE };
          break;

        case 'stats':
          if (passcode !== CONFIG.STAFF_PASSCODE) { result = { error: 'Unauthorized' }; break; }
          result = getAnalytics();
          break;

        case 'search':
          result = { results: searchRegistration(e.parameter.q || '', passcode) };
          break;

        case 'checkin':
          result = processScan(
            e.parameter.token,
            e.parameter.venue,
            e.parameter.name,
            passcode
          );
          break;

        case 'feed':
          result = { items: getRecentCheckIns(passcode) };
          break;

        default:
          result = { error: 'Unknown action' };
      }
    } catch (err) {
      result = { error: err.message };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 1. ADMIN PORTAL
  if (mode === 'admin') {
    return HtmlService.createTemplateFromFile('Admin').evaluate()
      .setTitle('Energize 2026 Admin')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }


  // 2. SCANNER MODE (kept for legacy)
  if (mode === 'scanner') {
    return HtmlService.createTemplateFromFile('Scanner').evaluate()
      .setTitle('Energize 2026 Mobile Scanner')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // 3. TICKET VIEW MODE
  if (id) {
    const sheet = getSpreadsheet().getSheets()[0];
    const data  = sheet.getDataRange().getValues();
    let foundRow = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][CONFIG.COLUMN_MAPPING.TOKEN - 1] === id) {
        foundRow = i + 1;
        break;
      }
    }

    const template = HtmlService.createTemplateFromFile('CheckIn');
    template.success          = foundRow !== -1;
    template.teamName         = foundRow !== -1 ? data[foundRow - 1][CONFIG.COLUMN_MAPPING.TEAM_NAME   - 1] : '';
    template.leaderName       = foundRow !== -1 ? data[foundRow - 1][CONFIG.COLUMN_MAPPING.LEADER_NAME  - 1] : '';
    template.track            = foundRow !== -1 ? data[foundRow - 1][CONFIG.COLUMN_MAPPING.TRACK        - 1] : '';
    template.alreadyCheckedIn = foundRow !== -1 && data[foundRow - 1][CONFIG.COLUMN_MAPPING.STATUS - 1] === 'CHECKED_IN';

    return template.evaluate()
      .setTitle('Energize 2026 Ticket')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return HtmlService.createHtmlOutput('<h1>Energize 2026 Entry System</h1><p>Ready to scan.</p>');
}

/**
 * Validates if the email is in the authorized staff list.
 */
function isUserAuthorized(email) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.AUTHORIZED_STAFF_SHEET_NAME);
  if (!sheet) return false;
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase().trim() === email.toLowerCase().trim()) return true;
  }
  return false;
}

/**
 * Searches for a registration by team name, leader name, or token.
 * Called by the Admin Portal.
 */
function searchRegistration(query, passcode) {
  if (passcode !== CONFIG.STAFF_PASSCODE) throw new Error('Unauthorized');
  const sheet = getSpreadsheet().getSheets()[0];
  const data  = sheet.getDataRange().getValues();
  const q     = query.toLowerCase().trim();
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const team   = String(data[i][CONFIG.COLUMN_MAPPING.TEAM_NAME   - 1]).toLowerCase();
    const leader = String(data[i][CONFIG.COLUMN_MAPPING.LEADER_NAME - 1]).toLowerCase();
    const token  = String(data[i][CONFIG.COLUMN_MAPPING.TOKEN       - 1]).toLowerCase();
    const email  = String(data[i][CONFIG.COLUMN_MAPPING.EMAIL       - 1]).toLowerCase();

    if (team.includes(q) || leader.includes(q) || token.includes(q) || email.includes(q)) {
      results.push({
        row:          i + 1,
        teamName:     data[i][CONFIG.COLUMN_MAPPING.TEAM_NAME   - 1],
        leaderName:   data[i][CONFIG.COLUMN_MAPPING.LEADER_NAME - 1],
        track:        data[i][CONFIG.COLUMN_MAPPING.TRACK       - 1],
        token:        data[i][CONFIG.COLUMN_MAPPING.TOKEN       - 1],
        status:       data[i][CONFIG.COLUMN_MAPPING.STATUS      - 1] || 'PENDING',
        checkinTime:  data[i][CONFIG.COLUMN_MAPPING.CHECKIN_TIME - 1] ? String(data[i][CONFIG.COLUMN_MAPPING.CHECKIN_TIME - 1]) : '',
        scannerName:  data[i][CONFIG.COLUMN_MAPPING.SCANNER_NAME - 1] || '',
        venue:        data[i][CONFIG.COLUMN_MAPPING.CHECKIN_VENUE - 1] || ''
      });
    }
  }
  return results.slice(0, 20); // Max 20 results
}

/**
 * Manually checks in a participant. Called by the Admin Portal.
 */
function adminCheckIn(rowIndex, venue, adminName, passcode) {
  if (passcode !== CONFIG.STAFF_PASSCODE) throw new Error('Unauthorized');
  const sheet = getSpreadsheet().getSheets()[0];
  const data  = sheet.getDataRange().getValues();
  const row   = data[rowIndex - 1];

  if (row[CONFIG.COLUMN_MAPPING.STATUS - 1] === 'CHECKED_IN') {
    return { success: false, message: 'Already checked in.' };
  }

  sheet.getRange(rowIndex, CONFIG.COLUMN_MAPPING.STATUS      ).setValue('CHECKED_IN');
  sheet.getRange(rowIndex, CONFIG.COLUMN_MAPPING.CHECKIN_TIME ).setValue(new Date());
  sheet.getRange(rowIndex, CONFIG.COLUMN_MAPPING.SCANNER_NAME ).setValue(adminName + ' (Admin)');
  sheet.getRange(rowIndex, CONFIG.COLUMN_MAPPING.CHECKIN_VENUE).setValue(venue);

  return {
    success:    true,
    teamName:   row[CONFIG.COLUMN_MAPPING.TEAM_NAME   - 1],
    leaderName: row[CONFIG.COLUMN_MAPPING.LEADER_NAME - 1]
  };
}

/**
 * Returns the last 20 check-ins for the live feed.
 */
function getRecentCheckIns(passcode) {
  if (passcode !== CONFIG.STAFF_PASSCODE) throw new Error('Unauthorized');
  const sheet = getSpreadsheet().getSheets()[0];
  const data  = sheet.getDataRange().getValues();
  const list  = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][CONFIG.COLUMN_MAPPING.STATUS - 1] === 'CHECKED_IN') {
      list.push({
        teamName:    data[i][CONFIG.COLUMN_MAPPING.TEAM_NAME    - 1],
        leaderName:  data[i][CONFIG.COLUMN_MAPPING.LEADER_NAME  - 1],
        track:       data[i][CONFIG.COLUMN_MAPPING.TRACK        - 1],
        checkinTime: data[i][CONFIG.COLUMN_MAPPING.CHECKIN_TIME - 1] ? String(data[i][CONFIG.COLUMN_MAPPING.CHECKIN_TIME - 1]) : '',
        scannerName: data[i][CONFIG.COLUMN_MAPPING.SCANNER_NAME - 1] || '',
        venue:       data[i][CONFIG.COLUMN_MAPPING.CHECKIN_VENUE - 1] || ''
      });
    }
  }

  // Return sorted by checkin time desc, last 20
  return list
    .filter(r => r.checkinTime)
    .sort((a, b) => new Date(b.checkinTime) - new Date(a.checkinTime))
    .slice(0, 20);
}

/**
 * Securely processes a scan from the Scanner UI.
 */
function processScan(tokenId, venue, staffName, passcode) {
  if (passcode !== CONFIG.STAFF_PASSCODE) {
    throw new Error('Invalid staff passcode.');
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  let foundRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][CONFIG.COLUMN_MAPPING.TOKEN - 1] === tokenId) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow === -1) {
    return { success: false, message: 'Invalid Ticket ID: ' + tokenId };
  }

  const currentStatus = data[foundRow - 1][CONFIG.COLUMN_MAPPING.STATUS - 1];
  if (currentStatus === 'CHECKED_IN') {
    return { 
      success: true, 
      alreadyIn: true, 
      teamName: data[foundRow - 1][CONFIG.COLUMN_MAPPING.TEAM_NAME - 1] 
    };
  }

  // Update check-in record
  sheet.getRange(foundRow, CONFIG.COLUMN_MAPPING.STATUS).setValue('CHECKED_IN');
  sheet.getRange(foundRow, CONFIG.COLUMN_MAPPING.CHECKIN_TIME).setValue(new Date());
  // Use manual name if provided, else fallback to email if available
  const loggedBy = staffName ? staffName : (Session.getActiveUser().getEmail() || 'Staff');
  sheet.getRange(foundRow, CONFIG.COLUMN_MAPPING.SCANNER_NAME).setValue(loggedBy);
  sheet.getRange(foundRow, CONFIG.COLUMN_MAPPING.CHECKIN_VENUE).setValue(venue || 'Main Gate');

  return {
    success: true,
    alreadyIn: false,
    teamName: data[foundRow - 1][CONFIG.COLUMN_MAPPING.TEAM_NAME - 1]
  };
}

/**
 * Returns analytics for the sidebar.
 */
function getAnalytics() {
  const sheet = getSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const total = data.length - 1;
  let checkedIn = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][CONFIG.COLUMN_MAPPING.STATUS - 1] === 'CHECKED_IN') {
      checkedIn++;
    }
  }
  
  return {
    total: total,
    checkedIn: checkedIn,
    percentage: total > 0 ? Math.round((checkedIn / total) * 100) : 0
  };
}

function showAnalyticsSidebar() {
  const html = HtmlService.createTemplateFromFile('Sidebar').evaluate()
      .setTitle('Energize 2026 Dashboard')
      .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getVenues() {
  return CONFIG.VENUES;
}

function verifyPasscode(passcode) {
  return passcode === CONFIG.STAFF_PASSCODE;
}

function showWebAppUrl() {
  const url = ScriptApp.getService().getUrl();
  const html = `<div style="font-family: sans-serif; padding: 20px;">
    <p>Your Public Web App URL (for QR codes) is:</p>
    <input type="text" value="${url}" readonly style="width: 100%; padding: 10px; margin-bottom: 20px;">
    <p style="color: red; font-size: 12px;">Ensure you have deployed as "New Deployment" -> "Web App" -> Access: "Anyone".</p>
  </div>`;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html), 'Web App URL');
}

function showScannerUrl() {
  const url = ScriptApp.getService().getUrl() + '?mode=scanner';
  const html = `<div style="font-family: sans-serif; padding: 20px;">
    <p>Share this <b>Private Link</b> with your authorized staff:</p>
    <input type="text" value="${url}" readonly style="width: 100%; padding: 10px; margin-bottom: 20px; border: 1px solid #6366f1; border-radius: 4px;">
    <p style="font-size: 12px; color: #64748b;">Staff must be logged into their Google account and be listed on the "Authorized Staff" sheet.</p>
  </div>`;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html), 'Private Scanner URL');
}
