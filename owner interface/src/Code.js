// @ts-nocheck
// SEVERINA PLUS OWNER DASHBOARD - COMPLETE VERSION
// All features + Commission tracking + Settings integration

// 1. Paste your TESTING Sheet ID here
const DEV_SHEET_ID = '1kfFb7EFI67iEv8yP-Hbh0neZQ_K4tLUR7aatc1OBz3o';

// 2. Paste your TESTING Script ID here (from .clasp-dev.json)
const DEV_SCRIPT_ID = '1VaBYGCkO7p_jJ6VUBMYXqKy03ewWMy3bBx5GzA2NipriCiFomsB0zXWJ';

// 3. This is your LIVE Production Sheet ID
const PROD_SHEET_ID = '1RyMQ_73Gm9ub6EccABapzn9JgDra_79LZCX6ko_2KbU';

/**
 * The Automatic Switch
 */
function getActiveSheetId() {
  const currentScriptId = ScriptApp.getScriptId();
  
  if (currentScriptId === DEV_SCRIPT_ID) {
    return DEV_SHEET_ID;
  } else {
    return PROD_SHEET_ID;
  }
}

// 4. Update your CONFIG to use these variables
const CONFIG = {
  SHEET_ID: getActiveSheetId(),
  ORDERS_SHEET_NAME: 'ORDERING_SHEET',
  SETTINGS_SHEET_NAME: 'SETTINGS'
};

// Main function to serve HTML
function doGet() {
  return HtmlService.createTemplateFromFile('owner_dashboard_complete')
    .evaluate()
    .setTitle('Severina Plus - Owner Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Get settings from Settings tab
function getSettings() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const settingsSheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET_NAME);
    
    if (!settingsSheet) {
      // Return defaults if Settings tab doesn't exist
      return {
        semesterStartDate: new Date(new Date().getFullYear(), 0, 1), // Jan 1st current year
        lowTierFee: 1.50,
        lowTierPercent: 1,
        highTierFee: 1.00,
        highTierPercent: 2
      };
    }
    
    // Read settings (B1, B3, B4, B5, B6)
    const semesterDate = settingsSheet.getRange('B1').getValue();
    const lowTierFee = parseFloat(settingsSheet.getRange('B3').getValue()) || 1.50;
    const lowTierPercent = parseFloat(settingsSheet.getRange('B4').getValue()) || 1;
    const highTierFee = parseFloat(settingsSheet.getRange('B5').getValue()) || 1.00;
    const highTierPercent = parseFloat(settingsSheet.getRange('B6').getValue()) || 2;
    
    return {
      semesterStartDate: new Date(semesterDate),
      lowTierFee: lowTierFee,
      lowTierPercent: lowTierPercent,
      highTierFee: highTierFee,
      highTierPercent: highTierPercent
    };
  } catch (error) {
    Logger.log('Error reading settings: ' + error.toString());
    // Return defaults on error
    return {
      semesterStartDate: new Date(new Date().getFullYear(), 0, 1),
      lowTierFee: 1.50,
      lowTierPercent: 1,
      highTierFee: 1.00,
      highTierPercent: 2
    };
  }
}

// Get dashboard metrics with all features
function getDashboardMetrics(period = 'today', customRange = null) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return {
        success: true,
        metrics: getEmptyMetrics(),
        orders: [],
        settings: getSettings()
      };
    }
    
    const headers = data[0];
const colIndices = {};
headers.forEach((header, index) => {
  const cleanHeader = header.toString().trim().toUpperCase();
  colIndices[cleanHeader] = index;
});
    
    // Get settings and date range
    const settings = getSettings();
    const dateRange = getDateRange(period, settings, customRange);
    
    // Initialize metrics
    let totalSales = 0;
    let totalOrders = 0;
    let totalCommission = 0;
    let smallOrders = 0;
    let largeOrders = 0;
    let smallOrdersCommission = 0;
    let largeOrdersCommission = 0;
    let cashPayments = 0;
    let onlinePayments = 0;
    let deliveryCount = 0;
    let pickupCount = 0;
    let cancelledCount = 0;
    let pendingCount = 0;
    let cookingCount = 0;
    let readyCount = 0;
    
    const staffPerformance = {};
    const peakHours = {};
    const itemCounts = {};
    const customerOrders = {};
    const detailedOrders = [];
    
   // Process each order
for (let i = 1; i < data.length; i++) {
  const row = data[i];
  
  // Skip if no order ID
  if (!row[colIndices['ORDER_ID']]) continue;
  
  // Parse date
  const orderDate = parseOrderDate(row[colIndices['DATE']]);
  if (!orderDate) continue;
  
  // Filter by date range
  // Filter by date range (inclusive of end date)
if (orderDate < dateRange.start || orderDate >= dateRange.end) continue;
  
  // Get order data (trim whitespace from status)
const status = (row[colIndices['STATUS']] || '').toString().trim();
const amount = parseFloat(row[colIndices['AMOUNT']]) || 0;
const deliveryFee = parseFloat(row[colIndices['DELIVERY_FEE']]) || 0;
const totalAmount = parseFloat(row[colIndices['TOTAL_AMOUNT']]) || (amount + deliveryFee);

// Calculate commission (0 for cancelled orders)
let commission = 0;
if (status !== 'Cancelled') {
  commission = parseFloat(row[colIndices['COMMISSION']]) || 0;
}

// Track status counts
if (status === 'Pending') pendingCount++;
else if (status === 'In Progress') cookingCount++;
else if (status === 'Ready') readyCount++;
else if (status === 'Cancelled') cancelledCount++;
  
  // Count all orders except cancelled
  if (status !== 'Cancelled') {
        totalOrders++;
        totalSales += totalAmount;
        totalCommission += commission;
        
        // Track small vs large orders
        if (amount < 50) {
          smallOrders++;
          smallOrdersCommission += commission;
        } else {
          largeOrders++;
          largeOrdersCommission += commission;
        }
        
        // Store detailed order info
        detailedOrders.push({
          orderId: row[colIndices.ORDER_ID],
          date: row[colIndices.DATE],
          time: row[colIndices.TIME] || '',
          customerName: row[colIndices.CUSTOMER_NAME] || 'Customer',
          phone: row[colIndices.PHONE] || '',
          items: row[colIndices.ITEMS] || '',
          quantity: row[colIndices.QUANTITY] || '',
          amount: amount,
          deliveryFee: deliveryFee,
          totalAmount: totalAmount,
          commission: commission,
          deliveryOption: row[colIndices.DELIVERY_OPTION] || '',
          deliveryZone: row[colIndices.DELIVERY_ZONE] || '',
          paymentMethod: row[colIndices.PAYMENT_METHOD] || '',
          status: status,
          notes: row[colIndices.NOTES] || '',  // ← ADD THIS
          orderUpdated: row[colIndices.ORDER_UPDATED] || ''
        });
        
        // Payment method
        const paymentMethod = row[colIndices.PAYMENT_METHOD];
        if (paymentMethod === 'Cash') cashPayments++;
        else if (paymentMethod === 'Online') onlinePayments++;
        
        // Delivery option
        const deliveryOption = row[colIndices.DELIVERY_OPTION];
        if (deliveryOption === 'Delivery') deliveryCount++;
        else if (deliveryOption === 'Pickup') pickupCount++;
        
        // Staff performance
        const acceptedBy = row[colIndices.ACCEPTED_BY];
        if (acceptedBy && status !== 'Pending') {
          if (!staffPerformance[acceptedBy]) {
            staffPerformance[acceptedBy] = { 
              orders: 0, 
              totalAmount: 0,
              avgAmount: 0
            };
          }
          staffPerformance[acceptedBy].orders++;
          staffPerformance[acceptedBy].totalAmount += totalAmount;
        }
        
        // Peak hours
        const time = row[colIndices.TIME];
        if (time) {
          const hour = extractHour(time);
          if (hour !== null) {
            peakHours[hour] = (peakHours[hour] || 0) + 1;
          }
        }
        
        // Popular items
        const items = row[colIndices.ITEMS];
        if (items) {
          const itemList = items.split(',');
          itemList.forEach(item => {
            const cleanItem = item.trim();
            if (cleanItem) {
              itemCounts[cleanItem] = (itemCounts[cleanItem] || 0) + 1;
            }
          });
        }
        
        // Customer loyalty
        const phone = row[colIndices.PHONE];
        if (phone) {
          customerOrders[phone] = (customerOrders[phone] || 0) + 1;
        }
      }
    }
    
    // Calculate repeat customers (customers with 2+ orders)
    const repeatCustomers = Object.values(customerOrders).filter(count => count >= 2).length;
    
    // Calculate staff averages
    Object.keys(staffPerformance).forEach(staff => {
      const perf = staffPerformance[staff];
      perf.avgAmount = perf.orders > 0 ? perf.totalAmount / perf.orders : 0;
    });
    
    // Get top 5 staff by orders
    const topStaff = Object.entries(staffPerformance)
      .sort((a, b) => b[1].orders - a[1].orders)
      .slice(0, 5)
      .map(([name, data]) => ({
        name: name,
        orders: data.orders,
        avgAmount: data.avgAmount.toFixed(2)
      }));
    
    // Calculate payment percentages
    const totalPayments = cashPayments + onlinePayments;
    const cashPercent = totalPayments > 0 ? Math.round((cashPayments / totalPayments) * 100) : 0;
    const onlinePercent = totalPayments > 0 ? Math.round((onlinePayments / totalPayments) * 100) : 0;
    
    // Get top 5 popular items
    const popularItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([item, count]) => ({ item, count }));
    
    // Get peak hours (top 3)
    const peakHoursList = Object.entries(peakHours)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({ 
        hour: formatHour(parseInt(hour)), 
        count 
      }));
    
    // Get customer leaderboard (top 10)
    const customerLeaderboard = Object.entries(customerOrders)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([phone, orders]) => ({ 
        phone: maskPhone(phone), 
        orders 
      }));
    
    // This is the clean structure the HTML is looking for
    const metricsResult = {
        totalSales: totalSales.toFixed(2),
        totalOrders: totalOrders,
        totalCommission: totalCommission.toFixed(2),
        smallOrders: smallOrders,
        smallOrdersCommission: smallOrdersCommission.toFixed(2),
        largeOrders: largeOrders,
        largeOrdersCommission: largeOrdersCommission.toFixed(2),
        pendingCount: pendingCount,
        cookingCount: cookingCount,
        readyCount: readyCount,
        cancelledCount: cancelledCount,
        repeatCustomers: repeatCustomers,
        cashPayments: cashPayments,
        cashPercent: cashPercent,
        onlinePayments: onlinePayments,
        onlinePercent: onlinePercent,
        deliveryCount: deliveryCount,
        pickupCount: pickupCount,
        topStaff: topStaff,
        popularItems: popularItems,
        peakHours: peakHoursList,
        customerLeaderboard: customerLeaderboard
    };

    const finalResponse = {
      success: true,
      metrics: metricsResult,
      orders: detailedOrders,
      settings: settings
    };

    // This "Sanitizes" the data for the browser
    return JSON.parse(JSON.stringify(finalResponse));

  } catch (error) {
    console.error('Fatal Error in getDashboardMetrics: ' + error.stack);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// Get date range based on period
function getDateRange(period, settings, customRange = null) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
 // Handle custom date range
  if (period === 'custom' && customRange) {
    const start = new Date(customRange.start);
    const end = new Date(customRange.end);
    // Add 1 full day to end (so it includes the entire end date)
    end.setDate(end.getDate() + 1);
    return {
      start: start,
      end: end
    };
  }
  
  switch(period) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 86400000) };
    
    case 'yesterday':
      return {
        start: new Date(today.getTime() - 86400000),
        end: today
      };
    
    case 'week':
      return {
        start: new Date(today.getTime() - (7 * 86400000)),
        end: new Date(today.getTime() + 86400000)
      };
    
    case 'month':
      return {
        start: new Date(today.getTime() - (30 * 86400000)),
        end: new Date(today.getTime() + 86400000)
      };
    
    case 'semester':
      return {
        start: settings.semesterStartDate,
        end: new Date(now.getTime() + 86400000)
      };
    
    default:
      return { start: today, end: new Date(today.getTime() + 86400000) };
  }
}

// Parse order date
function parseOrderDate(dateStr) {
  if (!dateStr) return null;
  
  // 1. If it's already a Date object from Google Sheets, return it directly
  if (dateStr instanceof Date) return dateStr;

  try {
    const s = dateStr.toString().trim();

    // 2. Handle DD/MM/YYYY (Ghana format)
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
    
    // 3. Handle ISO format (YYYY-MM-DD)
    if (s.includes('-')) {
      return new Date(s);
    }
    
    // 4. Final Fallback
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}

// Extract hour from time string
function extractHour(timeStr) {
  if (!timeStr) return null;
  
  try {
    // Handle "HH:MM AM/PM" format
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (match) {
      let hour = parseInt(match[1]);
      const ampm = match[3];
      
      if (ampm) {
        if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12;
        if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
      }
      
      return hour;
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

// Format hour for display
function formatHour(hour) {
  if (hour === 0) return '12 AM';
  if (hour < 12) return hour + ' AM';
  if (hour === 12) return '12 PM';
  return (hour - 12) + ' PM';
}

// Mask phone number
function maskPhone(phone) {
  if (!phone || phone.length < 4) return phone;
  const lastFour = phone.slice(-4);
  return '***' + lastFour;
}

// Get empty metrics structure
function getEmptyMetrics() {
  return {
    totalSales: '0.00',
    totalOrders: 0,
    totalCommission: '0.00',
    smallOrders: 0,
    smallOrdersCommission: '0.00',
    largeOrders: 0,
    largeOrdersCommission: '0.00',
    pendingCount: 0,
    cookingCount: 0,
    readyCount: 0,
    cancelledCount: 0,
    repeatCustomers: 0,
    cashPayments: 0,
    cashPercent: 0,
    onlinePayments: 0,
    onlinePercent: 0,
    deliveryCount: 0,
    pickupCount: 0,
    topStaff: [],
    popularItems: [],
    peakHours: [],
    customerLeaderboard: []
  };
}
function testSheetHeaders() {
  try {
    const ss = SpreadsheetApp.openById('1RyMQ_73Gm9ub6EccABapzn9JgDra_79LZCX6ko_2KbU');
    const sheet = ss.getSheetByName('ORDERING_SHEET');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    Logger.log('=== SHEET HEADERS ===');
    Logger.log('Total columns: ' + headers.length);
    
    headers.forEach((header, index) => {
      Logger.log('Column ' + index + ': [' + header + ']');
    });
    
    // Test column mapping
    const colIndices = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.toString().trim().toUpperCase();
      colIndices[cleanHeader] = index;
    });
    
    Logger.log('=== MAPPED COLUMNS ===');
    Logger.log(JSON.stringify(colIndices, null, 2));
    
    // Check for required columns
    const required = ['ORDER_ID', 'DATE', 'STATUS', 'AMOUNT', 'COMMISSION'];
    Logger.log('=== CHECKING REQUIRED COLUMNS ===');
    required.forEach(col => {
      if (colIndices[col] !== undefined) {
        Logger.log(col + ': FOUND at column ' + colIndices[col]);
      } else {
        Logger.log(col + ': MISSING!!!');
      }
    });
    
    return 'Check logs for results';
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    return error.toString();
  }
}
function debugMyDashboard() {
  const result = getDashboardMetrics('semester'); // Testing the longest period
  
  if (result.success) {
    console.log("✅ SUCCESS!");
    console.log("Total Orders Found: " + result.metrics.totalOrders);
    console.log("Total Sales: " + result.metrics.totalSales);
    console.log("Commission: " + result.metrics.totalCommission);
    console.log("First 2 Orders for Verification:", result.orders.slice(0, 2));
  } else {
    console.log("❌ ERROR: " + result.error);
  }
}
function testCancelledOrders() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Build column indices
    const colIndices = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.toString().trim().toUpperCase();
      colIndices[cleanHeader] = index;
    });
    
    Logger.log('=== TESTING CANCELLED ORDERS ===');
    Logger.log('Total rows (including header): ' + data.length);
    
    let cancelledFound = 0;
    let yesterdayOrders = 0;
    const yesterday = new Date('2026-01-04'); // Your yesterday date
    const today = new Date('2026-01-05');
    
    // Check each order
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const orderId = row[colIndices['ORDER_ID']];
      const status = row[colIndices['STATUS']];
      const dateStr = row[colIndices['DATE']];
      const commission = row[colIndices['COMMISSION']];
      
      // Parse date
      const orderDate = parseOrderDate(dateStr);
      
      // Check if from yesterday
      if (orderDate && orderDate >= yesterday && orderDate < today) {
        yesterdayOrders++;
        Logger.log('---');
        Logger.log('Order #' + orderId);
        Logger.log('  DATE raw: ' + dateStr);
        Logger.log('  DATE parsed: ' + orderDate);
        Logger.log('  STATUS: "' + status + '"');
        Logger.log('  COMMISSION: ' + commission);
        
        if (status === 'Cancelled') {
          cancelledFound++;
          Logger.log('  ✅ CANCELLED ORDER FOUND!');
        }
      }
    }
    
    Logger.log('---');
    Logger.log('=== SUMMARY ===');
    Logger.log('Total yesterday orders: ' + yesterdayOrders);
    Logger.log('Cancelled orders found: ' + cancelledFound);
    Logger.log('Expected cancelled: 3');
    
    return 'Check logs for results';
    
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    return error.toString();
  }
}
// ============================================
// MENU AVAILABILITY MANAGEMENT (READ-ONLY)
// ============================================

// Get menu status for display
function getMenuStatus() {
  try {
    const ss = SpreadsheetApp.openById('1RyMQ_73Gm9ub6EccABapzn9JgDra_79LZCX6ko_2KbU');
    const menuSheet = ss.getSheetByName('MENU_STATUS');
    
    if (!menuSheet) {
      return {
        success: false,
        error: 'MENU_STATUS sheet not found'
      };
    }
    
    const data = menuSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return {
        success: true,
        items: []
      };
    }
    
    const headers = data[0];
    const menuItems = [];
    
    // Build column indices
    const colIndices = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.toString().trim().toUpperCase();
      colIndices[cleanHeader] = index;
    });
    
    // Process menu items
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // --- THE FIX: Convert Date Object to a String ---
      let rawDate = row[colIndices['LAST_UPDATED']];
      let safeDate = "N/A";
      
      if (rawDate instanceof Date) {
        // Formats as "Jan 7, 7:03 PM"
        safeDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "MMM d, h:mm a");
      } else if (rawDate) {
        safeDate = rawDate.toString();
      }
      // ------------------------------------------------

      menuItems.push({
        rowIndex: i + 1,
        category: row[colIndices['CATEGORY']] || '',
        itemName: row[colIndices['ITEM_NAME']] || '',
        status: (row[colIndices['STATUS']] || '').toString().trim(),
        lastUpdated: safeDate, // Now safely a String
        updatedBy: row[colIndices['UPDATED_BY']] || ''
      });
    }
    
    return {
      success: true,
      items: menuItems
    };
    
  } catch (error) {
    Logger.log('Error in getMenuStatus: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}
/**
 * SMART TEST: Verifies environment via the Execution Log
 */
function verifySmartSwitch() {
  const currentId = CONFIG.SHEET_ID;
  console.log("--- ENVIRONMENT CHECK ---");
  
  try {
    const ss = SpreadsheetApp.openById(currentId);
    const sheetName = ss.getName();
    
    // Check if the ID matches your DEV_SHEET_ID
    // Make sure DEV_SHEET_ID is defined at the top of your script!
    const isTestSheet = (currentId === DEV_SHEET_ID); 
    
    console.log("Target Sheet Name: " + sheetName);
    console.log("Target Sheet ID: " + currentId);
    console.log("Current Environment: " + (isTestSheet ? "🧪 TESTING" : "🚀 PRODUCTION"));
    
    if (isTestSheet) {
      console.log("✅ SUCCESS: You are safely in the Staging area.");
    } else {
      console.log("⚠️ WARNING: You are pointing to the PRODUCTION sheet.");
    }
    
  } catch (e) {
    console.error("❌ ERROR: Could not connect. Check if your Sheet ID is correct.");
    console.error("Technical Error: " + e.message);
  }
}