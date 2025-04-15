# Everreal Integration Webflow

This project integrates OpenImmo XML property listings with a Webflow CMS collection. It handles downloading XML files from an FTP server, parsing the property data, and importing it into Webflow.

## Features

- Connect to FTP server to retrieve XML files
- Parse OpenImmo XML format to extract property information
- Import properties into a Webflow CMS collection
- Handle property deletions when specified in the XML
- Process images for property listings
- Publish the Webflow site to make changes live
- Automated scheduled execution via Vercel cron jobs

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/everreal-integration-webflow.git
cd everreal-integration-webflow

# Install dependencies
npm install
```

## Configuration

Create a `.env` file with the following configuration:

```
# Webflow API Credentials
WEBFLOW_TOKEN=your_webflow_api_token
COLLECTION_ID=your_webflow_collection_id
SITE_ID=your_webflow_site_id

# FTP Server Credentials
FTP_HOST=your_ftp_host
FTP_USER=your_ftp_username
FTP_PASSWORD=your_ftp_password
FTP_PORT=21
REMOTE_FOLDER=/
```

**Important**: Make sure your Webflow API token has CMS API Read/Write permissions for the collection, otherwise item operations will fail.

## Usage

```bash
# Run the integration script
npm start

# Test with a local XML file
npm test
```

The script will:
1. Connect to the FTP server
2. Download and parse XML files
3. Import property listings to Webflow
4. Handle DELETE operations for properties
5. Publish the site to make changes live

## Vercel Deployment with Cron Job

This project is configured to run as a scheduled cron job on Vercel.

### Setup

1. Connect your repository to Vercel
2. Add all environment variables in the Vercel dashboard
3. Deploy the project

The cron job will automatically run every 6 hours due to the configuration in `vercel.json`.

### Manual Trigger

You can also trigger the import manually by calling the API endpoint:

```
GET https://your-vercel-deployment.vercel.app/api/cron
```

## XML Support

This integration supports OpenImmo XML format with the following features:

- Property details extraction (all common fields)
- Image field processing (up to 5 property images)
- DELETE flag detection (in both root and verwaltung_techn elements)

## Troubleshooting

If you encounter 400 errors when trying to access Webflow items, check your API token permissions:

1. Generate a new token with CMS API access
2. Enable Read/Write permissions for your specific collection
3. Update your .env file with the new token

The script implements multiple fallback methods to ensure compatibility with different API versions and token permission levels.

## Dependencies

- axios - For direct API calls
- basic-ftp - For FTP operations
- dotenv - For environment variables
- fs-extra - File system utilities
- xml2js - XML parsing
- webflow-api - Webflow API client
- winston - Logging