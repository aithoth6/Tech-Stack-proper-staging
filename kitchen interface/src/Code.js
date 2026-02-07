// ============================================
// SEVERINA KITCHEN - ENVIRONMENT AWARE CONFIG
// ============================================

const CONFIG = (function() {
  const currentScriptId = ScriptApp.getScriptId();
  
  // Script IDs for Environment Detection
  const TEST_SCRIPT_ID = '1oJaxqtLLv9v-GYxMtd7_Y7E1q-bhEAQQtJM3sG7tWVvDLLf9ik5nkKuo';
  
  // Check if current environment is Development
  const isDev = (currentScriptId === TEST_SCRIPT_ID);

  return {
    IS_DEV: isDev,
    ENV_NAME: isDev ? '🧪 TESTING' : '🚀 PRODUCTION',
    // Environment specific IDs
    SHEET_ID: isDev ? '1kfFb7EFI67iEv8yP-Hbh0neZQ_K4tLUR7aatc1OBz3o' : '1RyMQ_73Gm9ub6EccABapzn9JgDra_79LZCX6ko_2KbU',
    
    // Webhook Routing
    N8N_WEBHOOK_URL: isDev ? 'https://unexpounded-infortunately-janessa.ngrok-free.dev/webhook-test/kitchen-ready' : 'https://n8n.srv1186827.hstgr.cloud/webhook/kitchen-ready',
    REPRINT_WEBHOOK_URL: isDev ? 'https://unexpounded-infortunately-janessa.ngrok-free.dev/webhook-test/kitchen-reprint' : 'https://n8n.srv1186827.hstgr.cloud/webhook/kitchen-reprint',
    
    // Global Constants
    ORDERS_SHEET_NAME: 'ORDERING_SHEET',
    SETTINGS_SHEET_NAME: 'SETTINGS',
    MENU_STATUS_SHEET: 'MENU_STATUS',
    TIMEZONE: 'GMT'
  };
})();

// ... [Rest of your doGet and Order Management functions follow here] ...
// ============================================
// WEB APP HANDLER (SINGLE UNIFIED FUNCTION)
// ============================================
function doGet(e) {
  const page = e.parameter.page;
  const action = e.parameter.action;

  // --- API ROUTING ---
  // All these functions automatically use CONFIG.SHEET_ID
  if (action === 'getOrders') return getOrders();
  if (action === 'getReadyOrders') return getReadyOrders();
  if (action === 'getMenuStatus') return ContentService.createTextOutput(JSON.stringify(getMenuStatus())).setMimeType(ContentService.MimeType.JSON);
  if (action === 'toggleStatus') return toggleStatus(e.parameter.status); // For kitchen status
  if (action === 'updateMenuStatus') return ContentService.createTextOutput(JSON.stringify(updateMenuStatus(e.parameter.itemName, e.parameter.status, e.parameter.staff))).setMimeType(ContentService.MimeType.JSON); // For menu items
// Inside function doGet(e) { ... }
if (action === 'getStatus') {
    const statusData = getKitchenStatus();
    return ContentService.createTextOutput(JSON.stringify(statusData)).setMimeType(ContentService.MimeType.JSON);
}

// Note: toggleStatus is now handled by google.script.run, 
// so it doesn't strictly need a line here unless you use fetch.
  // --- HTML TEMPLATE ROUTING ---
  const fileName = (page === 'menu') ? 'menu_manager' : 'kitchen_display';
  const template = HtmlService.createTemplateFromFile(fileName);
  
  // We pass these as strings to avoid the JS syntax error in the browser
  template.scriptUrl = ScriptApp.getService().getUrl();
  template.envName = CONFIG.ENV_NAME;
  template.isDev = CONFIG.IS_DEV ? "true" : "false"; 

  return template.evaluate()
    .setTitle(CONFIG.ENV_NAME + ' - Kitchen')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// --- 2. UPDATED getReadyOrders ---
function getReadyOrders() {
  try {
    // Dynamic routing to the correct sheet environment
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const col = {};
    headers.forEach((h, i) => {
      const cleanHeader = h.toString().trim().replace(/\s+/g, '_').toUpperCase();
      col[cleanHeader] = i;
    });

    const readyOrders = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[col['ORDER_ID']]) continue;

      const status = (row[col['STATUS']] || "").toString().trim();
      const clearedAt = row[col['CLEARED_AT']];

      if (status === 'Ready' && (!clearedAt || clearedAt === "")) {
        readyOrders.push({
          orderId: row[col['ORDER_ID']],
          customerName: row[col['CUSTOMER_NAME']] || "Guest",
          phone: row[col['PHONE']] || "N/A",
          items: row[col['ITEMS']] || "",
          readyAt: row[col['READY_AT']] ? Utilities.formatDate(new Date(row[col['READY_AT']]), CONFIG.TIMEZONE, "HH:mm") : "Just now",
          deliveryOption: row[col['DELIVERY_OPTION']] || "",
          deliveryZone: row[col['DELIVERY_ZONE']] || "",
          amount: row[col['AMOUNT']] || "0"
        });
      }
    }
    return readyOrders;
  } catch (e) {
    return [];
  }
}
// ============================================
// ORDER MANAGEMENT FUNCTIONS
// ============================================

// Get all orders (Pending and In Progress)
// MODIFIED getOrders for google.script.run
function getOrders() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const colIndices = {};
    headers.forEach((header, index) => { colIndices[header] = index; });
    
    const pending = [];
    const cooking = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[colIndices.ORDER_ID]) continue;
      const status = row[colIndices.STATUS];
      
      const order = {
        rowIndex: i + 1,
        orderId: row[colIndices.ORDER_ID],
        customerName: row[colIndices.CUSTOMER_NAME],
        phone: row[colIndices.PHONE],
        items: row[colIndices.ITEMS],
        deliveryOption: row[colIndices.DELIVERY_OPTION],
        amount: row[colIndices.AMOUNT],
        time: row[colIndices.TIME],
        status: status,
        updated: row[colIndices.ORDER_UPDATED] === 'YES'
      };
      
      if (status === 'Pending') pending.push(order);
      else if (status === 'In Progress') cooking.push(order);
    }
    
    return { pending, cooking, timestamp: new Date().toISOString() }; // Return object directly
  } catch (error) {
    return { pending: [], cooking: [], error: error.toString() };
  }
}

// Start cooking an order
function startCooking(orderId, staff) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const colIndices = {};
    headers.forEach((header, index) => {
      colIndices[header] = index;
    });
    
    // Find the order row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[colIndices.ORDER_ID] === orderId && row[colIndices.STATUS] === 'Pending') {
        const rowNum = i + 1;
        
        // Update STATUS to "In Progress"
        sheet.getRange(rowNum, colIndices.STATUS + 1).setValue('In Progress');
        
        // Set ACCEPTED_BY
        sheet.getRange(rowNum, colIndices.ACCEPTED_BY + 1).setValue(staff);
        
        // Set ACCEPTED_AT timestamp
        const timestamp = new Date();
        const formattedTime = Utilities.formatDate(timestamp, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
        sheet.getRange(rowNum, colIndices.ACCEPTED_AT + 1).setValue(formattedTime);
        
        Logger.log('Order ' + orderId + ' started by ' + staff);
        
       // ... (rest of your logic above)
        
        Logger.log('Order ' + orderId + ' started by ' + staff);
        
        // REMOVED ContentService! Just return the data object.
        return { 
          success: true,
          orderId: orderId,
          staff: staff
        };
      }
    }
    
    throw new Error('Order not found or already in progress');
    
  } catch (error) {
    Logger.log('Error in startCooking: ' + error.toString());
    // REMOVED ContentService! Return the error object.
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}
// Mark order as ready
function markReady(orderId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const colIndices = {};
    headers.forEach((header, index) => {
      colIndices[header] = index;
    });
    
    // Find the order row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[colIndices.ORDER_ID] === orderId && row[colIndices.STATUS] === 'In Progress') {
        const rowNum = i + 1;
        
        // Update STATUS to "Ready"
        sheet.getRange(rowNum, colIndices.STATUS + 1).setValue('Ready');
        
        // Set READY_AT timestamp
        const timestamp = new Date();
        const formattedTime = Utilities.formatDate(timestamp, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
        sheet.getRange(rowNum, colIndices.READY_AT + 1).setValue(formattedTime);
        
        // Trigger n8n webhook if configured
        if (CONFIG.N8N_WEBHOOK_URL) {
          const orderData = {
            orderId: orderId,
            customerName: row[colIndices.CUSTOMER_NAME],
            phone: row[colIndices.PHONE],
            items: row[colIndices.ITEMS],
            readyAt: formattedTime
          };
          triggerN8nWebhook(orderData);
        }
        
        // Return plain object for google.script.run
        return { success: true, orderId: orderId }; 
      }
    }
    throw new Error('Order not found or not in progress');

  } catch (error) {
    Logger.log('Error in markReady: ' + error.toString());
    // Return failure object correctly
    return { success: false, error: error.toString() }; 
  }
}
// ============================================
// N8N WEBHOOK INTEGRATION (Optional)
// ============================================

// Trigger n8n webhook when order is ready
function triggerN8nWebhook(orderData) {
  if (!CONFIG.N8N_WEBHOOK_URL) {
    Logger.log('N8N webhook not configured, skipping');
    return;
  }
  
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        event: 'order_ready',
        data: orderData
      }),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(CONFIG.N8N_WEBHOOK_URL, options);
    Logger.log('Webhook triggered successfully: ' + response.getContentText());
    
  } catch (error) {
    Logger.log('Error triggering webhook: ' + error.toString());
    // Don't throw - we don't want to fail the order update if webhook fails
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Test function to verify setup
function testSetup() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);
    
    if (!sheet) {
      Logger.log('ERROR: Sheet not found - ' + CONFIG.ORDERS_SHEET_NAME);
      return false;
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('✅ Sheet found! Headers: ' + headers.join(', '));
    
    // Check required columns
    const requiredColumns = [
      'ORDER_ID', 'PHONE', 'CUSTOMER_NAME', 'ITEMS', 'QUANTITY', 
      'DELIVERY_OPTION', 'AMOUNT', 'STATUS', 'DATE', 'TIME',
      'ACCEPTED_BY', 'ACCEPTED_AT', 'READY_AT'
    ];
    
    const missingColumns = [];
    
    requiredColumns.forEach(col => {
      if (!headers.includes(col)) {
        missingColumns.push(col);
      }
    });
    
    if (missingColumns.length > 0) {
      Logger.log('⚠️ WARNING: Missing columns: ' + missingColumns.join(', '));
      Logger.log('Please add these columns to your sheet!');
    } else {
      Logger.log('✅ SUCCESS: All required columns present!');
    }
    
    return true;
    
  } catch (error) {
    Logger.log('❌ ERROR in testSetup: ' + error.toString());
    return false;
  }
}

// Test HTML file loading
function testHtmlFile() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('kitchen_display');
    const content = html.getContent();
    
    Logger.log('✅ SUCCESS! HTML file loaded.');
    Logger.log('First 200 chars: ' + content.substring(0, 200));
    Logger.log('Total length: ' + content.length + ' characters');
    
    if (content.startsWith('<!DOCTYPE html>')) {
      Logger.log('✅ HTML starts with correct DOCTYPE');
    } else {
      Logger.log('⚠️ WARNING: HTML does not start with DOCTYPE');
      Logger.log('Actually starts with: ' + content.substring(0, 50));
    }
    
    return true;
    
  } catch (error) {
    Logger.log('❌ ERROR loading HTML file:');
    Logger.log(error.toString());
    return false;
  }
}
function debugGetOrders() {
  const result = getOrders();
  const content = result.getContent();
  Logger.log('Result: ' + content);
  
  const data = JSON.parse(content);
  Logger.log('Pending orders: ' + data.pending.length);
  Logger.log('Cooking orders: ' + data.cooking.length);
  
  if (data.pending.length > 0) {
    Logger.log('First pending order: ' + JSON.stringify(data.pending[0]));
  }
}
function simpleTest() {
  Logger.log('=== STARTING TEST ===');
  
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  Logger.log('Sheet opened');
  
  const sheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);
  Logger.log('Sheet found: ' + sheet.getName());
  
  const data = sheet.getDataRange().getValues();
  Logger.log('Total rows: ' + data.length);
  
  const headers = data[0];
  Logger.log('Headers: ' + headers.join(', '));
  
  if (data.length > 1) {
    Logger.log('Row 2 data: ' + data[1].join(' | '));
    
    // Find STATUS column
    const statusIndex = headers.indexOf('STATUS');
    Logger.log('STATUS column index: ' + statusIndex);
    Logger.log('STATUS value in row 2: "' + data[1][statusIndex] + '"');
  }
  
  Logger.log('=== TEST COMPLETE ===');
}
// ============================================
// MENU AVAILABILITY MANAGEMENT
// ============================================

// Get menu status for display
// MODIFIED getMenuStatus
function getMenuStatus() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const menuSheet = ss.getSheetByName(CONFIG.MENU_STATUS_SHEET);
    const data = menuSheet.getDataRange().getValues();
    const headers = data[0];
    const colIndices = {};
    headers.forEach((h, i) => { colIndices[h.toString().trim().toUpperCase()] = i; });
    
    const menuItems = data.slice(1).map((row, i) => ({
      rowIndex: i + 2,
      category: row[colIndices['CATEGORY']],
      itemName: row[colIndices['ITEM_NAME']],
      status: row[colIndices['STATUS']].toString().trim()
    }));
    
    return { success: true, items: menuItems }; // Return object directly
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Update menu item status
function updateMenuStatus(itemName, newStatus, staffName) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const menuSheet = ss.getSheetByName('MENU_STATUS');
    
    if (!menuSheet) {
      return {
        success: false,
        error: 'MENU_STATUS sheet not found'
      };
    }
    
    const data = menuSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Build column indices
    const colIndices = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.toString().trim().toUpperCase();
      colIndices[cleanHeader] = index;
    });
    
    // Find the item
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const currentItemName = row[colIndices['ITEM_NAME']];
      
      if (currentItemName === itemName) {
        const rowNum = i + 1;
        
        // Update STATUS
        menuSheet.getRange(rowNum, colIndices['STATUS'] + 1).setValue(newStatus);
        
        // Update LAST_UPDATED
        const timestamp = new Date();
        const formattedTime = Utilities.formatDate(timestamp, 'GMT', 'yyyy-MM-dd HH:mm:ss');
        menuSheet.getRange(rowNum, colIndices['LAST_UPDATED'] + 1).setValue(formattedTime);
        
        // Update UPDATED_BY
        menuSheet.getRange(rowNum, colIndices['UPDATED_BY'] + 1).setValue(staffName);
        
        Logger.log('Updated ' + itemName + ' to ' + newStatus + ' by ' + staffName);
        
        return {
          success: true,
          itemName: itemName,
          newStatus: newStatus,
          updatedBy: staffName,
          timestamp: formattedTime
        };
      }
    }
    
    return {
      success: false,
      error: 'Item not found: ' + itemName
    };
    
  } catch (error) {
    Logger.log('Error in updateMenuStatus: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// Check if specific item is available (for AI/n8n)
function checkItemAvailability(itemName) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const menuSheet = ss.getSheetByName('MENU_STATUS');
    
    if (!menuSheet) {
      // If sheet doesn't exist, assume everything is available
      return {
        success: true,
        available: true,
        itemName: itemName
      };
    }
    
    const data = menuSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Build column indices
    const colIndices = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.toString().trim().toUpperCase();
      colIndices[cleanHeader] = index;
    });
    
    // Search for the item (fuzzy matching)
    const searchTerm = itemName.toLowerCase().trim();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const menuItemName = (row[colIndices['ITEM_NAME']] || '').toString().toLowerCase().trim();
      const status = (row[colIndices['STATUS']] || '').toString().trim();
      
      // Check if item name matches (contains search term or exact match)
      if (menuItemName.includes(searchTerm) || searchTerm.includes(menuItemName)) {
        const isAvailable = status === 'Available';
        
        return {
          success: true,
          available: isAvailable,
          itemName: row[colIndices['ITEM_NAME']],
          status: status
        };
      }
    }
    
    // Item not found in menu - assume available (new item or extra)
    return {
      success: true,
      available: true,
      itemName: itemName,
      status: 'Not tracked'
    };
    
  } catch (error) {
    Logger.log('Error in checkItemAvailability: ' + error.toString());
    // On error, assume available (fail-safe)
    return {
      success: true,
      available: true,
      itemName: itemName,
      error: error.toString()
    };
  }
}

// Get all unavailable items (for AI to suggest alternatives)
function getUnavailableItems() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const menuSheet = ss.getSheetByName('MENU_STATUS');
    
    if (!menuSheet) {
      return {
        success: true,
        unavailableItems: []
      };
    }
    
    const data = menuSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Build column indices
    const colIndices = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.toString().trim().toUpperCase();
      colIndices[cleanHeader] = index;
    });
    
    const unavailable = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = (row[colIndices['STATUS']] || '').toString().trim();
      
      if (status === 'Out of Stock') {
        unavailable.push({
          category: row[colIndices['CATEGORY']],
          itemName: row[colIndices['ITEM_NAME']]
        });
      }
    }
    
    return {
      success: true,
      unavailableItems: unavailable
    };
    
  } catch (error) {
    Logger.log('Error in getUnavailableItems: ' + error.toString());
    return {
      success: true,
      unavailableItems: []
    };
  }
}

// Get available items by category (for AI suggestions)
function getAvailableItemsByCategory(category) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const menuSheet = ss.getSheetByName('MENU_STATUS');
    
    if (!menuSheet) {
      return {
        success: true,
        availableItems: []
      };
    }
    
    const data = menuSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Build column indices
    const colIndices = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.toString().trim().toUpperCase();
      colIndices[cleanHeader] = index;
    });
    
    const available = [];
    const searchCategory = category.toLowerCase().trim();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const itemCategory = (row[colIndices['CATEGORY']] || '').toString().toLowerCase().trim();
      const status = (row[colIndices['STATUS']] || '').toString().trim();
      
      if (itemCategory === searchCategory && status === 'Available') {
        available.push(row[colIndices['ITEM_NAME']]);
      }
    }
    
    return {
      success: true,
      category: category,
      availableItems: available
    };
    
  } catch (error) {
    Logger.log('Error in getAvailableItemsByCategory: ' + error.toString());
    return {
      success: true,
      category: category,
      availableItems: []
    };
  }
}
function testDoGet() {
  // Simulate the menu page request
  var e = {
    parameter: {
      page: 'menu'
    }
  };
  
  var result = doGet(e);
  Logger.log('=== TESTING doGet(page=menu) ===');
  Logger.log('Result type: ' + typeof result);
  Logger.log('Has getContent: ' + (typeof result.getContent === 'function'));
  
  if (typeof result.getContent === 'function') {
    var content = result.getContent();
    Logger.log('Content length: ' + content.length);
    Logger.log('First 200 chars: ' + content.substring(0, 200));
  }
  
  return result;
}
function testMenuManagerFile() {
  try {
    var html = HtmlService.createHtmlOutputFromFile('menu_manager');
    var content = html.getContent();
    
    Logger.log('=== MENU MANAGER FILE TEST ===');
    Logger.log('✅ File found!');
    Logger.log('Content length: ' + content.length);
    Logger.log('First 200 chars: ' + content.substring(0, 200));
    
    if (content.includes('Menu Manager')) {
      Logger.log('✅ Content looks correct - contains "Menu Manager"');
    } else {
      Logger.log('⚠️ WARNING: Content does not contain "Menu Manager"');
    }
    
    return true;
  } catch (error) {
    Logger.log('❌ ERROR: ' + error.toString());
    Logger.log('The file "menu_manager" does NOT exist or has a different name!');
    return false;
  }
}
function testDoGetLive() {
  // Test with page=menu parameter
  var e = {
    parameter: {
      page: 'menu'
    }
  };
  
  Logger.log('=== TESTING LIVE doGet ===');
  Logger.log('Parameter page: ' + e.parameter.page);
  
  var result = doGet(e);
  
  Logger.log('Result type: ' + typeof result);
  
  if (typeof result.getContent === 'function') {
    var content = result.getContent();
    Logger.log('Content length: ' + content.length);
    Logger.log('Title in content: ' + (content.includes('Menu Manager') ? 'YES' : 'NO'));
    Logger.log('Kitchen in content: ' + (content.includes('SEVERINA PLUS KITCHEN') ? 'YES' : 'NO'));
    Logger.log('First 300 chars: ' + content.substring(0, 300));
  }
}
function clearReadyOrder(orderId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const orderIdCol = headers.indexOf('ORDER_ID');
    const clearedAtCol = headers.indexOf('CLEARED_AT');
    const ts = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss");

    // Convert orderId to string to ensure a match
    const searchId = orderId.toString();

    for (let i = 1; i < data.length; i++) {
      if (data[i][orderIdCol].toString() === searchId) {
        sheet.getRange(i + 1, clearedAtCol + 1).setValue(ts);
        return { success: true }; // Return plain object
      }
    }
    return { success: false, error: "Order not found" };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
function clearAllReadyOrders() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusCol = headers.indexOf('STATUS');
  const clearedAtCol = headers.indexOf('CLEARED_AT');
  const ts = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss");

  for (let i = 1; i < data.length; i++) {
    if (data[i][statusCol] === 'Ready' && !data[i][clearedAtCol]) {
      sheet.getRange(i + 1, clearedAtCol + 1).setValue(ts);
    }
  }
  return { success: true };
}

function sendReprintToPrinter(orderId) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h.toString().trim().toUpperCase()] = i);

  let orderData = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][col['ORDER_ID']].toString() === orderId.toString()) {
      orderData = {
        orderId: data[i][col['ORDER_ID']],
        customerName: data[i][col['CUSTOMER_NAME']],
        items: data[i][col['ITEMS']],
        quantity: data[i][col['QUANTITY']],
        deliveryOption: data[i][col['DELIVERY_OPTION']],
        deliveryZone: data[i][col['DELIVERY_ZONE']],
        amount: data[i][col['AMOUNT']],
        phone: data[i][col['PHONE']],
        isReprint: true
      };
      break;
    }
  }

  if (orderData && CONFIG.REPRINT_WEBHOOK_URL) {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(orderData)
    };
    // This sends specifically to the Printer Webhook, skipping the notification logic
    UrlFetchApp.fetch(CONFIG.REPRINT_WEBHOOK_URL, options);
    return { success: true };
  }
  return { success: false, error: "Order not found or URL missing" };
}
function verifyKitchenEnvironment() {
  const currentId = CONFIG.SHEET_ID;
  const ss = SpreadsheetApp.openById(currentId);
  const isTest = (currentId === KITCHEN_DEV_SHEET_ID);
  
  console.log("KITCHEN CHECK:");
  console.log("Connected to: " + ss.getName());
  console.log("Environment: " + (isTest ? "🧪 TESTING" : "🚀 PRODUCTION"));
}
/**
 * Toggles the kitchen status between OPEN and CLOSED.
 */
function toggleStatus(status) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET_NAME);
    
    // NEW LOGIC: Find column by header name
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const statusColIndex = headers.indexOf('KITCHEN_STATUS');

    if (statusColIndex === -1) throw new Error("KITCHEN_STATUS column not found");

    // Update Row 2 (index 2) at the found column (index + 1)
    sheet.getRange(2, statusColIndex + 1).setValue(status);
    
    return { success: true, status: status };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Helper to fetch the current status on initial load.
 */
function getKitchenStatus() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET_NAME);
    
    // NEW LOGIC: Find column by header name
    const data = sheet.getDataRange().getValues();
    const headers = data[0]; // Row 1
    const statusColIndex = headers.indexOf('KITCHEN_STATUS');
    
    if (statusColIndex === -1) throw new Error("KITCHEN_STATUS column not found");

    const status = data[1][statusColIndex] || "OPEN"; // Row 2, Status Column
    return { status: status };
  } catch (e) {
    console.error("Error fetching status: " + e.toString());
    return { status: "OPEN" }; // Fallback
  }
}
