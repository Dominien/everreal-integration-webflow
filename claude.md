# Everreal-Integration-Webflow Documentation

## Overview
This project integrates OpenImmo XML property listings with a Webflow CMS collection. It handles downloading XML files from an FTP server, parsing the property data, and importing it into Webflow.

## Configuration

The application uses environment variables for configuration. Create a `.env` file in the project root with the following values:

```
# FTP Server Credentials
FTP_HOST=your_ftp_host
FTP_USER=your_ftp_username
FTP_PASSWORD=your_ftp_password
FTP_PORT=21
REMOTE_FOLDER=/

# Webflow API Credentials
WEBFLOW_TOKEN=your_webflow_token
COLLECTION_ID=your_collection_id
SITE_ID=your_site_id
```

## Workflow

1. The script connects to the FTP server and lists all XML files
2. For each XML file:
   - Downloads the file to a local directory
   - Parses the XML to extract property information
   - Checks for DELETE flags
   
3. Properties are grouped by OpenImmo Object ID (OBID)
4. For each group:
   - If any file has DELETE flag, all files in that group are skipped and the property is deleted from Webflow
   - Otherwise, the property is imported to Webflow if it doesn't already exist
   
5. The Webflow site is published to make changes live

## Property Data Fields

The following fields are extracted from XML and mapped to Webflow:

- Basic Info: name, slug, firma, objekttitel
- Location: lage, plz, ort, strasse, hausnummer
- Description: objektbeschreibung, ausstatt-beschr, sonstige-angaben
- Financials: kaltmiete, warmmiete, nebenkosten, kaution
- Space: wohnflaeche, anzahl-zimmer, anzahl-schlafzimmer, anzahl-badezimmer
- Other: baujahr, kontaktfoto
- Images: Up to 5 property images (anhang-image-1 through anhang-image-5)
- Identifier: openimmo-obid (used for updates/deletions)

## Running the Application

```bash
# Run the standard integration
npm start

# Run with a test XML file
npm test

# Run with debugging enabled
npm run debug
```

## Dependencies

- basic-ftp - For FTP operations
- fs-extra - File system utilities
- xml2js - XML parsing
- webflow-api - Webflow API client
- winston - Logging
- dotenv - Environment variable management

## Troubleshooting

### Common Errors

#### 400 Bad Request (Webflow Import)
This usually means the data being sent to Webflow doesn't match the collection's requirements:
- Check that all required fields in your Webflow collection have values
- Verify field types match (e.g., numbers for numeric fields)
- Ensure slug format is valid (lowercase, no special characters except hyphens)
- Examine the detailed error logs to see which fields are causing problems

#### 401 Unauthorized
This means your Webflow API token is invalid:
- Verify the token in your .env file is correct
- Check if the token has expired (Webflow tokens can expire)
- Ensure the token has the necessary permissions

#### 404 Not Found
This typically means the Collection ID or Site ID is incorrect:
- Check your Collection ID and Site ID in the .env file
- Verify these IDs in your Webflow dashboard

#### FTP Connection Issues
If you're having trouble connecting to the FTP server:
- Verify your FTP credentials in the .env file
- Check if your network allows FTP connections
- Try connecting with an FTP client to test the credentials