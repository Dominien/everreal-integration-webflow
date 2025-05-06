// Node.js implementation of Everreal Webflow Integration
const ftp = require('basic-ftp');
const { Writable } = require('stream');
const xml2js = require('xml2js');
const { WebflowClient } = require('webflow-api');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

// ---------------------------
// Logging Configuration
// ---------------------------
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} - ${level} - ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Load environment variables
require('dotenv').config();

// XML Parser (reuse instance for performance)
const xmlParser = new xml2js.Parser({ explicitArray: true });

// ---------------------------
// FTP Server Credentials
// ---------------------------
const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;
const FTP_PORT = parseInt(process.env.FTP_PORT || '21');
const REMOTE_FOLDER = process.env.REMOTE_FOLDER || "/";

// ---------------------------
// Webflow API Credentials
// ---------------------------
const WEBFLOW_CLIENT = new WebflowClient({ accessToken: process.env.WEBFLOW_TOKEN });
const COLLECTION_ID = process.env.COLLECTION_ID;
const SITE_ID = process.env.SITE_ID;

// ---------------------------
// Helper Functions
// ---------------------------
function slugify(text) {
  return text.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
}

function getText(element, tag) {
  if (!element || !element[tag] || !element[tag][0]) {
    return "";
  }
  return element[tag][0].trim();
}

function formatRichText(text) {
  if (!text) return "";
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length === 0 || (paragraphs.length === 1 && paragraphs[0].trim() === "")) {
    return "";
  }
  return paragraphs.map(p => {
    const lines = p.split(/\n/);
    if (lines.length > 1) return `<p>${lines.join("<br>")}</p>`;
    return `<p>${p}</p>`;
  }).join("");
}

// Parses the <openimmo> root object into property data
function parseOpenImmo(root, source) {
  let deleteFlag = false;
  if (root.aktion && root.aktion[0].$ && root.aktion[0].$.aktionart === "DELETE") {
    deleteFlag = true;
  }

  const anbieter = root.anbieter ? root.anbieter[0] : null;
  const immobilie = anbieter && anbieter.immobilie ? anbieter.immobilie[0] : null;
  if (!immobilie) {
    logger.error(`Invalid XML format (no <immobilie>): ${source}`);
    return null;
  }
  const verw = immobilie.verwaltung_techn ? immobilie.verwaltung_techn[0] : null;
  if (!deleteFlag && verw && verw.aktion && verw.aktion[0].$ && verw.aktion[0].$.aktionart === "DELETE") {
    deleteFlag = true;
  }

  // Extract fields
  const firma = anbieter ? getText(anbieter, "firma") : "";
  const freitexte = immobilie.freitexte ? immobilie.freitexte[0] : null;
  const objekttitel = freitexte ? getText(freitexte, "objekttitel") : "";
  const lage = freitexte ? getText(freitexte, "lage") : "";
  const objektbeschreibung = freitexte ? getText(freitexte, "objektbeschreibung") : "";
  const ausgestattBeschr = freitexte ? getText(freitexte, "ausstatt_beschr") : "";
  const sonstigeAngaben = freitexte ? getText(freitexte, "sonstige_angaben") : "";

  const geo = immobilie.geo ? immobilie.geo[0] : null;
  const plz = geo ? getText(geo, "plz") : "";
  const ort = geo ? getText(geo, "ort") : "";
  const strasse = geo ? getText(geo, "strasse") : "";
  const hausnummer = geo ? getText(geo, "hausnummer") : "";

  const preise = immobilie.preise ? immobilie.preise[0] : null;
  const kaltmiete = preise ? getText(preise, "kaltmiete") : "";
  const warmmiete = preise ? getText(preise, "warmmiete") : "";
  const nebenkosten = preise ? getText(preise, "nebenkosten") : "";
  const kaution = preise ? getText(preise, "kaution") : "";

  const flaech = immobilie.flaechen ? immobilie.flaechen[0] : null;
  const wohnflaeche = flaech ? getText(flaech, "wohnflaeche") : "";
  const anzahlZimmer = flaech ? getText(flaech, "anzahl_zimmer") : "";
  const anzahlSchlafzimmer = flaech ? getText(flaech, "anzahl_schlafzimmer") : "";
  const anzahlBadezimmer = flaech ? getText(flaech, "anzahl_badezimmer") : "";

  const zustand = immobilie.zustand_angaben ? immobilie.zustand_angaben[0] : null;
  const baujahr = zustand ? getText(zustand, "baujahr") : "";

  let kontaktfoto = "";
  if (immobilie.kontaktperson && immobilie.kontaktperson[0]) {
    const kp = immobilie.kontaktperson[0];
    if (kp.foto && kp.foto[0] && kp.foto[0].daten && kp.foto[0].daten[0]) {
      kontaktfoto = getText(kp.foto[0].daten[0], "pfad");
    }
  }

  const imageFields = {};
  if (immobilie.anhaenge && immobilie.anhaenge[0].anhang) {
    immobilie.anhaenge[0].anhang.slice(0,5).forEach((anhang, idx) => {
      if (anhang.daten && anhang.daten[0]) {
        const pfad = getText(anhang.daten[0], "pfad");
        if (pfad) imageFields[`anhang_image_${idx+1}`] = pfad;
      }
    });
  }

  let openimmoObid = getText(verw, "openimmo_obid") || getText(verw, "objektnr_extern");
  if (!openimmoObid) openimmoObid = immobilie.objektnr_intern ? getText(immobilie, "objektnr_intern") : "";

  let uniqueSlug = deleteFlag
    ? slugify(`${strasse} ${hausnummer}`.trim())
    : slugify(`${objekttitel}-${openimmoObid}`);

  const nameToUse = deleteFlag
    ? `${strasse} ${hausnummer}`.trim()
    : (objekttitel || `Immobilie ${openimmoObid || 'Unbekannt'}`);

  const propertyData = {
    name: nameToUse,
    slug: uniqueSlug || slugify(nameToUse),
    firma, objekttitel, lage, objektbeschreibung,
    "ausstatt-beschr": ausgestattBeschr,
    "sonstige-angaben": sonstigeAngaben,
    plz, ort, strasse, hausnummer,
    kaltmiete, warmmiete, nebenkosten, kaution,
    wohnflaeche, "anzahl-zimmer": anzahlZimmer,
    "anzahl-schlafzimmer": anzahlSchlafzimmer,
    "anzahl-badezimmer": anzahlBadezimmer,
    baujahr, kontaktfoto,
    "openimmo_obid": openimmoObid,
    delete: deleteFlag,
    ...imageFields
  };

  logger.info(`DELETE=${deleteFlag} | OBID=${openimmoObid} | Parsed: ${source}`);
  // Add name-for-link field (substring between '_' and '+' in filename)
  const idx1 = source.indexOf('_');
  const idx2 = source.indexOf('+');
  propertyData['name-for-link'] = (idx1 !== -1 && idx2 > idx1 + 1)
    ? source.substring(idx1 + 1, idx2)
    : '';
  return propertyData;
}

// ---------------------------
// FTP & XML Functions
// ---------------------------
async function listXmlFiles() {
  const client = new ftp.Client(); client.ftp.verbose = false;
  try {
    await client.access({ host: FTP_HOST, port: FTP_PORT, user: FTP_USER, password: FTP_PASSWORD, secure: false });
    await client.cd(REMOTE_FOLDER);
    return (await client.list())
      .filter(f => f.name.toLowerCase().endsWith('.xml'))
      .map(f => f.name);
  } catch (err) {
    logger.error(`FTP list error: ${err.message}`);
    return [];
  } finally { client.close(); }
}

async function fetchAndParseXml(filename) {
  const client = new ftp.Client(); client.ftp.verbose = false;
  try {
    await client.access({ host: FTP_HOST, port: FTP_PORT, user: FTP_USER, password: FTP_PASSWORD, secure: false });
    await client.cd(REMOTE_FOLDER);
    const chunks = [];
    const collector = new Writable({
      write(chunk, enc, cb) { chunks.push(chunk); cb(); }
    });
    await client.downloadTo(collector, filename);
    const xmlString = Buffer.concat(chunks).toString('utf8');
    const parser = new xml2js.Parser({ explicitArray: true });
    const result = await parser.parseStringPromise(xmlString);
    if (!result.openimmo) throw new Error('Missing <openimmo> root');
    return parseOpenImmo(result.openimmo, filename);
  } catch (err) {
    logger.error(`Error fetching/parsing ${filename}: ${err.message}`);
    return null;
  } finally { client.close(); }
}

async function deleteFileFromFtp(filename) {
  const client = new ftp.Client(); client.ftp.verbose = false;
  try {
    await client.access({ host: FTP_HOST, port: FTP_PORT, user: FTP_USER, password: FTP_PASSWORD, secure: false });
    await client.cd(REMOTE_FOLDER);
    await client.remove(filename);
    logger.info(`Deleted FTP file: ${filename}`);
  } catch (err) {
    logger.error(`FTP delete error: ${err.message}`);
  } finally { client.close(); }
}

async function parseXmlFile(filePath) {
  try {
    const parser = new xml2js.Parser({ explicitArray: true });
    const fileData = fs.readFileSync(filePath);
    const result = await parser.parseStringPromise(fileData);
    
    // Make sure we have the proper root element
    if (!result.openimmo) {
      logger.error(`Invalid XML format: missing openimmo root element`);
      return null;
    }
    
    const root = result.openimmo;
    let deleteFlag = false;
    
    // Check for DELETE action
    if (root.aktion && root.aktion[0].$ && root.aktion[0].$.aktionart === "DELETE") {
      deleteFlag = true;
    }
    
    const anbieter = root.anbieter ? root.anbieter[0] : null;
    const immobilie = anbieter && anbieter.immobilie ? anbieter.immobilie[0] : null;
    
    if (!immobilie) {
      logger.error(`Invalid XML format: missing immobilie element`);
      return null;
    }
    
    // Also check for DELETE inside <verwaltung_techn>
    if (!deleteFlag && immobilie) {
      const verwaltungTechn = immobilie.verwaltung_techn ? immobilie.verwaltung_techn[0] : null;
      if (verwaltungTechn && verwaltungTechn.aktion && verwaltungTechn.aktion[0].$ && 
          verwaltungTechn.aktion[0].$.aktionart === "DELETE") {
        deleteFlag = true;
      }
    }
    
    // Extract fields
    const firma = anbieter ? getText(anbieter, "firma") : "";
    const freitexte = immobilie && immobilie.freitexte ? immobilie.freitexte[0] : null;
    const objekttitel = freitexte ? getText(freitexte, "objekttitel") : "";
    const lage = freitexte ? getText(freitexte, "lage") : "";
    const objektbeschreibung = freitexte ? getText(freitexte, "objektbeschreibung") : "";
    const ausgestattBeschr = freitexte ? getText(freitexte, "ausstatt_beschr") : "";
    const sonstigeAngaben = freitexte ? getText(freitexte, "sonstige_angaben") : "";
    
    // Geo information
    const geo = immobilie && immobilie.geo ? immobilie.geo[0] : null;
    const plz = geo ? getText(geo, "plz") : "";
    const ort = geo ? getText(geo, "ort") : "";
    const strasse = geo ? getText(geo, "strasse") : "";
    const hausnummer = geo ? getText(geo, "hausnummer") : "";
    
    // Preise
    const preise = immobilie && immobilie.preise ? immobilie.preise[0] : null;
    const kaltmiete = preise ? getText(preise, "kaltmiete") : "";
    const warmmiete = preise ? getText(preise, "warmmiete") : "";
    const nebenkosten = preise ? getText(preise, "nebenkosten") : "";
    const kaution = preise ? getText(preise, "kaution") : "";
    
    // Flaechen
    const flaech = immobilie && immobilie.flaechen ? immobilie.flaechen[0] : null;
    const wohnflaeche = flaech ? getText(flaech, "wohnflaeche") : "";
    const anzahlZimmer = flaech ? getText(flaech, "anzahl_zimmer") : "";
    const anzahlSchlafzimmer = flaech ? getText(flaech, "anzahl_schlafzimmer") : "";
    const anzahlBadezimmer = flaech ? getText(flaech, "anzahl_badezimmer") : "";
    
    // Zustand
    const zustand = immobilie && immobilie.zustand_angaben ? immobilie.zustand_angaben[0] : null;
    const baujahr = zustand ? getText(zustand, "baujahr") : "";
    
    // Kontaktfoto
    let kontaktfoto = "";
    if (immobilie && immobilie.kontaktperson && immobilie.kontaktperson[0]) {
      const kontaktperson = immobilie.kontaktperson[0];
      if (kontaktperson.foto && kontaktperson.foto[0] && 
          kontaktperson.foto[0].daten && kontaktperson.foto[0].daten[0]) {
        kontaktfoto = getText(kontaktperson.foto[0].daten[0], "pfad");
      }
    }
    
    // Attached images (limit to first five)
    const imageFields = {};
    if (immobilie && immobilie.anhaenge && immobilie.anhaenge[0] && 
        immobilie.anhaenge[0].anhang) {
      const images = immobilie.anhaenge[0].anhang;
      for (let idx = 0; idx < Math.min(images.length, 5); idx++) {
        const anhang = images[idx];
        if (anhang.daten && anhang.daten[0]) {
          const pfad = getText(anhang.daten[0], "pfad");
          if (pfad) {
            imageFields[`anhang_image_${idx+1}`] = pfad;
          }
        }
      }
    }
    
    // Extract openimmo_obid
    let openimmoObid = "";
    if (immobilie.verwaltung_techn && immobilie.verwaltung_techn[0]) {
      const verwaltungTechn = immobilie.verwaltung_techn[0];
      openimmoObid = getText(verwaltungTechn, "openimmo_obid");
      if (!openimmoObid) {
        openimmoObid = getText(verwaltungTechn, "objektnr_extern");
        if (openimmoObid) {
          logger.info(`Using objektnr_extern as fallback for openimmo_obid: ${openimmoObid}`);
        }
      }
    }
    
    if (!openimmoObid) {
      openimmoObid = immobilie.objektnr_intern ? getText(immobilie, "objektnr_intern") : "";
      if (openimmoObid) {
        logger.info(`Using objektnr_intern as fallback for openimmo_obid: ${openimmoObid}`);
      }
    }
    
    // Generate a unique slug
    let uniqueSlug;
    if (!deleteFlag && openimmoObid) {
      uniqueSlug = `${slugify(objekttitel)}-${openimmoObid}`;
    } else {
      uniqueSlug = slugify(objekttitel);
    }
    
    // Default name if objekttitel is empty
    const nameToUse = objekttitel || `Immobilie ${openimmoObid || 'Unbekannt'}`;
    
    const propertyData = {
      name: nameToUse,
      slug: uniqueSlug || slugify(nameToUse),
      firma: firma,
      objekttitel: objekttitel,
      lage: lage,
      objektbeschreibung: objektbeschreibung,
      "ausstatt-beschr": ausgestattBeschr,
      "sonstige-angaben": sonstigeAngaben,
      plz: plz,
      ort: ort,
      strasse: strasse,
      hausnummer: hausnummer,
      kaltmiete: kaltmiete,
      warmmiete: warmmiete,
      nebenkosten: nebenkosten,
      kaution: kaution,
      wohnflaeche: wohnflaeche,
      "anzahl-zimmer": anzahlZimmer,
      "anzahl-schlafzimmer": anzahlSchlafzimmer,
      "anzahl-badezimmer": anzahlBadezimmer,
      baujahr: baujahr,
      kontaktfoto: kontaktfoto,
      openimmo_obid: openimmoObid, // Internal key
      delete: deleteFlag
    };
    
    // Add image fields
    Object.assign(propertyData, imageFields);
    
    // If DELETE, override name and slug using address
    if (deleteFlag) {
      propertyData.name = `${strasse} ${hausnummer}`.trim();
      propertyData.slug = slugify(propertyData.name);
    }
    
    logger.info(`DELETE flag: ${deleteFlag} | openimmo_obid: ${openimmoObid}`);
    logger.info(`Parsed XML: ${path.basename(filePath)}`);
    // Add name-for-link field (substring between '_' and '+' in filename)
    const baseName = path.basename(filePath);
    const start = baseName.indexOf('_');
    const plus = baseName.indexOf('+');
    propertyData['name-for-link'] = (start !== -1 && plus > start + 1)
      ? baseName.substring(start + 1, plus)
      : '';
    return propertyData;
  } catch (err) {
    logger.error(`Error parsing XML ${path.basename(filePath)}: ${err.message}`);
    return null;
  }
}

// ---------------------------
// Webflow Functions
// ---------------------------
async function getItemsFromWebflow() {
  try {
    logger.info(`Fetching items from collection: ${COLLECTION_ID}`);
    
    try {
      // Use the correct method for webflow-api v3.1.1 - listItems
      if (WEBFLOW_CLIENT.collections && WEBFLOW_CLIENT.collections.items && 
          typeof WEBFLOW_CLIENT.collections.items.listItems === 'function') {
        logger.info("Using WebflowClient.collections.items.listItems method");
        
        const response = await WEBFLOW_CLIENT.collections.items.listItems(COLLECTION_ID);
        
        if (response && response.items && Array.isArray(response.items)) {
          logger.info(`Found ${response.items.length} item(s) in collection`);
          return response.items;
        }
      }
      
      // FALLBACK #1: Try old items method
      if (typeof WEBFLOW_CLIENT.items === 'function') {
        logger.info("Using WebflowClient.items method");
        
        const items = await WEBFLOW_CLIENT.items({ collectionId: COLLECTION_ID });
        if (Array.isArray(items)) {
          logger.info(`Found ${items.length} item(s) in collection via items method`);
          return items;
        }
      }
      
      // FALLBACK #2: Try direct API calls
      logger.info("WebflowClient methods failed, trying direct API call");
      const axios = require('axios');
      
      const response = await axios({
        method: 'get',
        url: `https://api.webflow.com/collections/${COLLECTION_ID}/items`,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.WEBFLOW_TOKEN}`
        }
      });
      
      if (response.data && response.data.items && Array.isArray(response.data.items)) {
        logger.info(`Found ${response.data.items.length} item(s) using direct API call`);
        return response.data.items;
      }
      
      // If we get here, we couldn't get items with any method
      logger.warn('Could not get items using any available method. Your API token likely lacks proper permissions.');
      return [];
    } catch (err) {
      logger.error(`All item retrieval methods failed: ${err.message}`);
      
      if (err.response) {
        logger.error(`Status: ${err.response.status}`);
        logger.error(`Error data: ${JSON.stringify(err.response.data || {})}`);
        
        if (err.response.status === 401 || err.response.status === 403) {
          logger.error('API TOKEN PERMISSION ISSUE: Your token lacks permission to access items in this collection');
          logger.error('Generate a new token with CMS API Read/Write permissions for this collection');
        }
      }
      
      return [];
    }
  } catch (err) {
    logger.error(`Error in getItemsFromWebflow: ${err.message}`);
    return [];
  }
}

/**
 * Check if an item has the given OpenImmo Object ID
 * @param {Object} item The Webflow item to check
 * @param {string} obid The OpenImmo Object ID to look for
 * @returns {boolean} True if the item matches the OBID
 */
function itemMatchesObid(item, obid) {
  if (!item || !obid) return false;
  
  try {
    // Primary check: Look in fieldData."openimmo-obid" (confirmed format in webflow-api v3.1.1)
    if (item.fieldData && item.fieldData["openimmo-obid"]) {
      const exactMatch = item.fieldData["openimmo-obid"] === obid;
      if (exactMatch) {
        logger.info(`Found exact match for OBID ${obid} in item ${item.id}`);
        return true;
      }
    }
    
    // Fallback 1: Look for direct openimmo-obid property
    if (item["openimmo-obid"]) {
      const directMatch = item["openimmo-obid"] === obid;
      if (directMatch) {
        logger.info(`Found direct property match for OBID ${obid} in item ${item.id || item._id}`);
        return true;
      }
    }
    
    // Fallback 2: Check for underscore variant
    if (item["openimmo_obid"]) {
      const underscoreMatch = item["openimmo_obid"] === obid;
      if (underscoreMatch) {
        logger.info(`Found underscore property match for OBID ${obid} in item ${item.id || item._id}`);
        return true;
      }
    }
    
    // Fallback 3: Try to find anywhere in the JSON
    const itemStr = JSON.stringify(item);
    const jsonMatch = itemStr.includes(`"openimmo-obid":"${obid}"`) || 
                     itemStr.includes(`"openimmo_obid":"${obid}"`);
    
    if (jsonMatch) {
      logger.info(`Found JSON content match for OBID ${obid} in item ${item.id || item._id}`);
      return true;
    }
    
    return false;
  } catch (err) {
    logger.error(`Error in itemMatchesObid: ${err.message}`);
    return false;
  }
}

/**
 * Search for items with the given OBID and delete them
 * @param {string} obid The OpenImmo Object ID to search for
 * @returns {Promise<boolean>} Success status
 */
/**
 * Delete an item from Webflow using direct API calls
 * @param {string} itemId The ID of the item to delete
 * @returns {Promise<boolean>} Success status
 */
async function deleteItemWithDirectApi(itemId) {
  try {
    logger.info(`Attempting to delete item with ID ${itemId} using direct API call`);
    
    // Get the axios library
    const axios = require('axios');
    
    const response = await axios({
      method: 'delete',
      url: `https://api.webflow.com/collections/${COLLECTION_ID}/items/${itemId}`,
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.WEBFLOW_TOKEN}`
      }
    });
    
    logger.info(`Direct API delete successful: ${JSON.stringify(response.data)}`);
    return true;
  } catch (err) {
    logger.error(`Error deleting item with direct API: ${err.message}`);
    if (err.response) {
      logger.error(`Status: ${err.response.status}`);
      if (err.response.data) {
        logger.error(`Response: ${JSON.stringify(err.response.data)}`);
      }
    }
    return false;
  }
}

/**
 * Delete items with the specified OBID from Webflow
 * @param {string} obid The OpenImmo Object ID to search for
 * @returns {Promise<boolean>} Success status
 */
async function deleteItems(obid) {
  try {
    // Fetch items from Webflow
    const items = await getItemsFromWebflow();
    logger.info(`Retrieved ${items.length} item(s) from Webflow`);
    
    // Find items with matching OBID
    const matchingItems = items.filter(item => itemMatchesObid(item, obid));
    logger.info(`Found ${matchingItems.length} matching item(s) for OBID: ${obid}. Proceeding with deletion.`);
    
    // If no items found, done
    if (matchingItems.length === 0) {
      logger.info(`No items found in Webflow with OBID: ${obid}`);
      return true;
    }
    
    // Log the found items for debugging
    matchingItems.forEach((item, index) => {
      logger.info(`Match ${index+1}: ID=${item.id || item._id || 'Unknown'}, Name=${item.fieldData?.name || item.name || 'Unknown'}`);
    });
    
    // Delete each matching item
    let successCount = 0;
    for (const item of matchingItems) {
      const itemId = item.id || item._id;
      if (!itemId) {
        logger.warn(`Matching item missing id; skipping deletion. Item: ${JSON.stringify(item)}`);
        continue;
      }
      
      logger.info(`Attempting to delete item with id: ${itemId} for OBID: ${obid}`);
      
      let deleted = false;
      
      // PRIMARY METHOD: Using the WebflowClient.collections.items.deleteItem method
      // This is the correct method name for webflow-api v3.1.1 (confirmed working)
      if (WEBFLOW_CLIENT.collections && WEBFLOW_CLIENT.collections.items && 
          typeof WEBFLOW_CLIENT.collections.items.deleteItem === 'function') {
        try {
          logger.info("Using primary method: WEBFLOW_CLIENT.collections.items.deleteItem");
          logger.info(`Parameters: deleteItem(${COLLECTION_ID}, ${itemId})`);
          
          const response = await WEBFLOW_CLIENT.collections.items.deleteItem(
            COLLECTION_ID,
            itemId
          );
          
          logger.info(`Deletion response: ${JSON.stringify(response)}`);
          deleted = true;
          successCount++;
        } catch (err) {
          logger.error(`Error with deleteItem method: ${err.message}`);
          
          if (err.response) {
            logger.error(`Status: ${err.response.status}`);
            if (err.response.data) {
              logger.error(`Response: ${JSON.stringify(err.response.data)}`);
            }
          }
        }
      }
      
      // FALLBACK 1: Using the WebflowClient.collections.items.remove method
      if (!deleted && WEBFLOW_CLIENT.collections && WEBFLOW_CLIENT.collections.items && 
          typeof WEBFLOW_CLIENT.collections.items.remove === 'function') {
        try {
          logger.info("Using fallback 1: WEBFLOW_CLIENT.collections.items.remove");
          const response = await WEBFLOW_CLIENT.collections.items.remove(
            COLLECTION_ID,
            itemId
          );
          
          logger.info(`Deletion response: ${JSON.stringify(response)}`);
          deleted = true;
          successCount++;
        } catch (err) {
          logger.error(`Error with remove method: ${err.message}`);
          
          if (err.response) {
            logger.error(`Status: ${err.response.status}`);
            if (err.response.data) {
              logger.error(`Response: ${JSON.stringify(err.response.data)}`);
            }
          }
        }
      }
      
      // FALLBACK 2: Using direct axios API calls
      if (!deleted) {
        try {
          logger.info("Using fallback 2: Direct axios API call");
          const success = await deleteItemWithDirectApi(itemId);
          
          if (success) {
            deleted = true;
            successCount++;
          }
        } catch (err) {
          logger.error(`Error with direct API method: ${err.message}`);
        }
      }
      
      // Log the final result for this item
      if (deleted) {
        logger.info(`Successfully deleted item ${itemId}`);
      } else {
        logger.error(`Failed to delete item ${itemId} after trying all methods`);
      }
    }
    
    logger.info(`Successfully deleted ${successCount} of ${matchingItems.length} items for OBID: ${obid}`);
    return successCount > 0;
  } catch (err) {
    logger.error(`Error in deleteItems for OBID ${obid}: ${err.message}`);
    return false;
  }
}

async function itemExistsInWebflow(obid) {
  const items = await getItemsFromWebflow();
  return items.some(item => itemMatchesObid(item, obid));
}

/**
 * Import an item to Webflow with multiple fallback strategies
 * @param {Object} data The property data to import
 * @returns {Promise<boolean>} Success status
 */
/**
 * Process an image URL for Webflow
 * @param {string} imageUrl The URL of the image to use
 * @param {string} alt Alternative text for the image
 * @returns {Promise<Object|null>} Formatted image object for Webflow or null if failed
 */
async function processImageForWebflow(imageUrl, alt = "") {
  if (!imageUrl) return null;
  
  try {
    logger.info(`Processing image URL: ${imageUrl}`);
    
    // Validate URL format
    if (!imageUrl.startsWith('http')) {
      logger.warn(`Invalid image URL format: ${imageUrl}`);
      return null;
    }
    
    // For Webflow Image fields, we need to format it as an object with url and alt properties
    // This was confirmed in our test-image-fields.js test
    return {
      url: imageUrl,
      alt: alt
    };
  } catch (err) {
    logger.error(`Error processing image URL: ${err.message}`);
    return null;
  }
}

/**
 * Process image fields and prepare them for Webflow
 * @param {Object} data The property data containing image URLs
 * @returns {Promise<Object>} Object with processed image fields
 */
async function processImageFields(data) {
  const imageFields = {};
  // Preserve contact photo if provided
  if (data.kontaktfoto) {
    imageFields['kontaktfoto'] = { url: data.kontaktfoto };
  }
  // Collect all attachment images into the multi-images field
  const multiImages = [];
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('anhang_image_') && value) {
      multiImages.push({ url: value });
    }
  }
  if (multiImages.length > 0) {
    // Multi-images supports multiple images
    imageFields['multi-images'] = multiImages;
    // Also populate the first attachment into the existing thumbnail field
    imageFields['anhang_image_1'] = multiImages[0];
  }
  return imageFields;
}

async function importItemToWebflow(data) {
  const itemName = data.name || "Unknown Name";
  logger.info(`Attempting to import item: ${itemName}`);
  
  // Ensure required fields are present
  if (!data.name) {
    logger.error(`Missing required name field for Webflow import: name=${data.name}`);
    return false;
  }
  
  // Generate a totally unique slug based on timestamp
  const timeStamp = new Date().getTime();
  const uniqueSlug = `property-${timeStamp}`;
  
  logger.info(`Using guaranteed unique slug: ${uniqueSlug}`);
  
  // Create a simple data object with just basic field values
  // Using only the fields shown in the Webflow schema
  const fieldData = {
    // Required fields
    name: (data.name || "").substring(0, 256),
    slug: uniqueSlug,
    
    // Plain text fields
    firma: data.firma || "",
    objekttitel: data.objekttitel || "",
    plz: data.plz || "",
    ort: data.ort || "",
    strasse: data.strasse || "",
    hausnummer: data.hausnummer || "",
    kaltmiete: String(data.kaltmiete || ""),
    warmmiete: String(data.warmmiete || ""),
    nebenkosten: String(data.nebenkosten || ""),
    kaution: String(data.kaution || ""),
    wohnflaeche: String(data.wohnflaeche || ""),
    "anzahl-zimmer": String(data["anzahl-zimmer"] || ""),
    "anzahl-schlafzimmer": String(data["anzahl-schlafzimmer"] || ""),
    "anzahl-badezimmer": String(data["anzahl-badezimmer"] || ""),
    baujahr: String(data.baujahr || ""),
    // Identifier
    "openimmo-obid": String(data.openimmo_obid || ""),
    // Custom field: name-for-link from filename
    "name-for-link": data["name-for-link"] || "",
    
    // Rich text fields formatted as simple HTML
    lage: `<p>${data.lage || ""}</p>`,
    objektbeschreibung: `<p>${data.objektbeschreibung || ""}</p>`,
    "ausstatt-beschr": `<p>${data["ausstatt-beschr"] || ""}</p>`,
    "sonstige-angaben": `<p>${data["sonstige-angaben"] || ""}</p>`
  };
  
  // Process image fields
  logger.info("Processing image fields...");
  try {
    const imageFields = await processImageFields(data);
    
    // Add image fields to fieldData
    Object.assign(fieldData, imageFields);
    
    if (Object.keys(imageFields).length > 0) {
      logger.info(`Added ${Object.keys(imageFields).length} image fields`);
    } else {
      logger.warn("No image fields were processed");
    }
  } catch (err) {
    logger.error(`Error processing image fields: ${err.message}`);
  }
  
  // Try to import the item using the correct syntax
  try {
    logger.info("Attempting to import item with correct WebflowClient syntax");
    logger.info(`Fields being sent: ${Object.keys(fieldData).join(', ')}`);
    
    // Using the WebflowClient API with the correct format
    const response = await WEBFLOW_CLIENT.collections.items.createItem(
      COLLECTION_ID,
      {
        isArchived: false,
        isDraft: false,
        fieldData: fieldData
      }
    );
    
    if (response && response.id) {
      logger.info(`Success: Imported item. ID: ${response.id}`);
      return true;
    }
    
    logger.warn("Import succeeded but with unexpected response format");
    logger.info(`Response: ${JSON.stringify(response)}`);
    return true;
  } catch (err) {
    logger.error(`Error importing item: ${err.message}`);
    
    if (err.response) {
      logger.error(`Status: ${err.response.status}`);
      logger.error(`Error data: ${JSON.stringify(err.response.data)}`);
      
      // Check if the error is related to image fields
      const errorData = JSON.stringify(err.response.data || "");
      if (errorData.includes("image") || errorData.includes("anhang") || errorData.includes("kontaktfoto")) {
        logger.warn("Error might be related to image fields. Trying without images...");
        
        // Remove all image fields and try again
        Object.keys(fieldData).forEach(key => {
          if (key === "kontaktfoto" || key.startsWith("anhang-image-")) {
            delete fieldData[key];
          }
        });
        
        try {
          logger.info("Retrying without image fields");
          const retryResponse = await WEBFLOW_CLIENT.collections.items.createItem(
            COLLECTION_ID,
            {
              isArchived: false,
              isDraft: false,
              fieldData: fieldData
            }
          );
          
          if (retryResponse && retryResponse.id) {
            logger.info(`Success without images: Imported item. ID: ${retryResponse.id}`);
            return true;
          }
        } catch (retryErr) {
          logger.error(`Retry without images failed: ${retryErr.message}`);
        }
      }
    }
    
    // Try with minimal data as fallback
    try {
      logger.info("Attempting fallback with minimal data");
      
      const minimalData = {
        name: fieldData.name,
        slug: fieldData.slug,
        "openimmo-obid": fieldData["openimmo-obid"]
      };
      
      const fallbackResponse = await WEBFLOW_CLIENT.collections.items.createItem(
        COLLECTION_ID,
        {
          isArchived: false,
          isDraft: false,
          fieldData: minimalData
        }
      );
      
      if (fallbackResponse && fallbackResponse.id) {
        logger.info(`Success with minimal data: Imported item. ID: ${fallbackResponse.id}`);
        return true;
      }
      
      logger.error("Fallback import failed with unexpected response");
      return false;
    } catch (finalErr) {
      logger.error(`Fallback attempt failed: ${finalErr.message}`);
      return false;
    }
  }
}

// ---------------------------
// Site Publish Function
// ---------------------------
/**
 * Sleep function to pause execution
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>} - Promise that resolves after waiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Publish the site to Webflow with retry logic for rate limits
 * @param {number} maxRetries - Maximum number of retries (default: 5)
 * @param {number} retryDelay - Delay between retries in ms (default: 60000 - 1 minute)
 * @returns {Promise<boolean>} Success status
 */
async function publishSite(maxRetries = 5, retryDelay = 60000) {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      if (retries > 0) {
        logger.info(`Retry attempt ${retries}/${maxRetries} for publishing site...`);
      } else {
        logger.info(`Attempting to publish site with ID: ${SITE_ID}`);
      }
      
      // From our tests, WEBFLOW_CLIENT.sites.publish method exists
      logger.info("Publishing site using WebflowClient.sites.publish...");
      const response = await WEBFLOW_CLIENT.sites.publish(
        SITE_ID,
        {
          publishToWebflowSubdomain: true
        }
      );
      
      logger.info(`Publish response: ${JSON.stringify(response)}`);
      return true;
    } catch (err) {
      logger.error(`Error publishing site: ${err.message}`);
      
      // Handle TooManyRequestsError directly with or without response object
      const isTooManyRequestsError = 
        err.message.includes("TooManyRequestsError") || 
        (err.response && err.response.status === 429) ||
        (err.code === "too_many_requests");
      
      if (isTooManyRequestsError) {
        retries++;
        
        // For rate limiting errors, use fixed retry delay (1 minute)
        const rateLimit429Delay = 60000; // 1 minute
        
        // Log error details if available
        if (err.response) {
          logger.error(`Status code: ${err.response.status}`);
          logger.error(`Body: ${JSON.stringify(err.response.data || {})}`);
        }
        
        if (retries <= maxRetries) {
          logger.warn(`Rate limit hit. Waiting for ${rateLimit429Delay/1000} seconds before retry ${retries}/${maxRetries}...`);
          await sleep(rateLimit429Delay);
          continue; // Try again
        } else {
          logger.error(`Maximum retries (${maxRetries}) reached for rate limit. Giving up.`);
        }
      }
      // More detailed error logging for other errors
      else if (err.response) {
        logger.error(`Status: ${err.response.status}`);
        logger.error(`Error data: ${JSON.stringify(err.response.data || {})}`);
        
        if (err.response.status === 401) {
          logger.error('Unauthorized (401) means your API token is invalid or expired.');
        } else if (err.response.status === 404) {
          logger.error('Not Found (404) means the site ID is invalid.');
        } else if (err.response.status === 403) {
          logger.error('Forbidden (403) means your API token does not have permission to publish.');
        } else if (err.response.status === 400) {
          logger.error('Bad Request (400) - Check site ID and parameters.');
          
          // New Webflow API often returns validation errors
          if (err.response.data && err.response.data.message) {
            logger.error(`Validation error: ${err.response.data.message}`);
          }
        }
      }
      // For non-rate-limit errors or if we've exceeded max retries, return failure
      return false;
    }
  }
  
  return false; // Should never reach here, but just in case
}

// ---------------------------
// Main Execution Flow
// ---------------------------
// For testing purposes - parses a local test file instead of FTP
async function parseLocalXmlFile(filePath) {
  try {
    logger.info(`Parsing local test file: ${filePath}`);
    
    // Check Webflow client setup first
    try {
      logger.info("Testing Webflow API connection...");
      logger.info(`Using Collection ID: ${COLLECTION_ID}`);
      logger.info(`Using Site ID: ${SITE_ID}`);
      
      // Test if we can get collection info
      logger.info("Attempting to fetch collection information...");
      const collectionInfo = await WEBFLOW_CLIENT.collection({ collectionId: COLLECTION_ID });
      logger.info(`Collection connection successful: ${collectionInfo.name}`);
      
      // List fields for debugging
      if (collectionInfo.fields) {
        logger.info("Collection fields required for import:");
        collectionInfo.fields.forEach(field => {
          if (field.required) {
            logger.info(`- ${field.slug} (${field.type}): REQUIRED`);
          } else {
            logger.info(`- ${field.slug} (${field.type})`);
          }
        });
      }
    } catch (err) {
      logger.error(`Webflow API connection test failed: ${err.message}`);
      if (err.response) {
        logger.error(`Status: ${err.response.status}, Response: ${JSON.stringify(err.response.data)}`);
      }
      logger.error("Please check your Webflow credentials before trying to import items");
    }
    
    // Continue with XML parsing
    const data = await parseXmlFile(filePath);
    if (data) {
      await importItemToWebflow(data);
      logger.info("Test import completed");
    } else {
      logger.error("Failed to parse test XML file");
    }
  } catch (err) {
    logger.error(`Error in test parse: ${err.message}`);
  }
}

async function main() {
  // Check for test mode
  if (process.argv.includes('--test')) {
    const testFile = process.argv[process.argv.indexOf('--test') + 1];
    if (testFile) {
      logger.info(`Running in test mode with file: ${testFile}`);
      const data = await parseXmlFile(testFile);
      
      if (!data) {
        logger.error(`Failed to parse test file: ${testFile}`);
        return;
      }
      
      if (data.delete) {
        // If this is a DELETE XML, process the deletion
        logger.info(`DELETE XML detected with OBID: ${data.openimmo_obid}`);
        const deleteSuccess = await deleteItems(data.openimmo_obid);
        logger.info(`Deletion ${deleteSuccess ? 'successful' : 'failed'} for OBID ${data.openimmo_obid}`);
      } else {
        // For non-DELETE XML, check for existing items with the same OBID
        if (data.openimmo_obid) {
          const exists = await itemExistsInWebflow(data.openimmo_obid);
          if (exists) {
            logger.info(`Item with OBID ${data.openimmo_obid} already exists in Webflow.`);
            logger.info(`To replace it, first process a DELETE XML for this OBID.`);
          }
        }
        
        // Do a normal import
        await parseLocalXmlFile(testFile);
      }
      return;
    }
  }
  
  // ---------------------------
  // FTP fetch & XML parse (single session)
  // ---------------------------
  const ftpClient = new ftp.Client();
  ftpClient.ftp.verbose = false;
  let xmlFiles;
  try {
    await ftpClient.access({ host: FTP_HOST, port: FTP_PORT, user: FTP_USER, password: FTP_PASSWORD, secure: false });
    await ftpClient.cd(REMOTE_FOLDER);
    const list = await ftpClient.list();
    xmlFiles = list
      .filter(f => f.name.toLowerCase().endsWith('.xml'))
      .map(f => f.name);
  } catch (err) {
    logger.error(`FTP error listing files: ${err.message}`);
    ftpClient.close();
    return;
  }
  if (!xmlFiles.length) {
    logger.error("No XML files found. Exiting.");
    ftpClient.close();
    return;
  }

  const downloadedFilesInfo = [];
  for (const filename of xmlFiles) {
    const chunks = [];
    const collector = new Writable({ write(chunk, enc, cb) { chunks.push(chunk); cb(); } });
    try {
      await ftpClient.downloadTo(collector, filename);
      const xmlString = Buffer.concat(chunks).toString('utf8');
      const result = await xmlParser.parseStringPromise(xmlString);
      if (!result.openimmo) {
        logger.error(`Invalid XML format (missing <openimmo>): ${filename}`);
        continue;
      }
      const data = parseOpenImmo(result.openimmo, filename);
      if (data) {
        downloadedFilesInfo.push({
          filename,
          data,
          openimmo_obid: data.openimmo_obid || "",
          delete: data.delete || false,
          skip: false
        });
        logger.info(`File: ${filename} | OBID: ${data.openimmo_obid || ''} | DELETE flag: ${data.delete || false}`);
      }
    } catch (err) {
      logger.error(`Error fetching/parsing ${filename}: ${err.message}`);
    }
  }
  ftpClient.close();
  if (!downloadedFilesInfo.length) {
    logger.error("No XML files were downloaded or parsed. Exiting.");
    return;
  }
  
  // Group files by OBID
  const obidGroups = {};
  for (const info of downloadedFilesInfo) {
    const obid = info.openimmo_obid || "";
    if (obid) {
      if (!obidGroups[obid]) {
        obidGroups[obid] = [];
      }
      obidGroups[obid].push(info);
    }
  }
  
  // For each group, if any file has the DELETE flag set, mark the group as DELETE and call the deletion routine
  for (const [obid, group] of Object.entries(obidGroups)) {
    const deleteFlags = group.map(info => info.delete);
    logger.info(`Group for OBID ${obid}: ${group.length} file(s), DELETE flags: ${JSON.stringify(deleteFlags)}`);
    
    if (deleteFlags.some(flag => flag)) {
      logger.info(`DELETE action found for OBID ${obid}. Marking all ${group.length} file(s) as skip and deleting from Webflow.`);
      for (const info of group) {
        info.skip = true;
      }
      await deleteItems(obid);
    }
  }
  
  // Delete files marked as skip from FTP
  for (const info of downloadedFilesInfo) {
    if (info.skip) {
      await deleteFileFromFtp(info.filename);
    }
  }
  
  // Import remaining files if an item with the same OBID doesn't already exist
  let importSuccessCount = 0;
  let importFailureCount = 0;
  
  for (const info of downloadedFilesInfo) {
    if (!info.skip) {
      const obid = info.openimmo_obid || "";
      if (obid && await itemExistsInWebflow(obid)) {
        logger.info(`Item with OBID ${obid} already exists in Webflow. Skipping import for file ${info.filename}.`);
      } else {
        const success = await importItemToWebflow(info.data);
        if (success) {
          importSuccessCount++;
        } else {
          importFailureCount++;
        }
      }
    } else {
      logger.info(`Skipping file ${info.filename} due to DELETE action.`);
    }
  }
  
  // Log import statistics
  logger.info(`Import statistics: ${importSuccessCount} successful, ${importFailureCount} failed.`);
  
  // Only publish if we had at least one successful import or deletion
  if (importSuccessCount > 0 || downloadedFilesInfo.some(info => info.skip)) {
    logger.info("Changes were made to Webflow CMS. Publishing site...");
    await publishSite();
  } else if (importFailureCount > 0) {
    logger.warn("All imports failed. Skipping publish step.");
  } else {
    logger.info("No changes were made to Webflow CMS. Skipping publish step.");
  }
}

// Export the main function for use in other modules (e.g., serverless functions)
module.exports = { main };

// Run the main function directly when this file is executed
if (require.main === module) {
  main().catch(err => {
    logger.error(`Unhandled error in main: ${err.message}`);
    process.exit(1);
  });
}