# Everreal-Webflow Real Estate Integration

An automated solution for keeping real estate listings synchronized between Everreal platform and Webflow CMS.

## What This Does

This integration creates a seamless, automated connection between the Everreal real estate platform and Webflow:

1. **Continuous Synchronization**: Property listings from Everreal are automatically synced to your Webflow CMS in real-time
2. **Bi-directional Updates**: Changes made in Everreal instantly reflect on your Webflow site
3. **Complete Automation**: No manual data entry required - listings, updates, and deletions are all handled automatically

## How It Works

1. The integration connects to Everreal's FTP server to retrieve OpenImmo XML property listing files
2. Each XML file is downloaded, parsed, and processed to extract all property details:
   - Property specifications (size, rooms, price, etc.)
   - Location details
   - Images and media content
   - Availability status
   - Marketing information
   
3. For each property:
   - New listings are added to Webflow
   - Updated listings are refreshed in Webflow
   - Deleted listings are automatically removed from Webflow
   
4. The Webflow site is published, making all changes live immediately

## Key Features

- **Full Property Data**: All property details from Everreal are available in Webflow
- **Image Processing**: Property images are processed and imported into Webflow's asset library
- **DELETE Operation Support**: Handles property deletions automatically
- **Scheduled Updates**: Runs automatically once daily at 10:00 UTC via Vercel cron jobs
- **Manual Trigger Support**: Can be triggered on-demand via API endpoint

## Technical Implementation

- Built on Node.js with a robust error handling system
- Uses OpenImmo XML standard for property data exchange
- Leverages Webflow's CMS and API for content management
- Deployed as a serverless function on Vercel with scheduled execution

## Setup & Configuration

### Requirements

- Everreal account with FTP access
- Webflow site with CMS collection configured for properties
- Vercel account (for deployment and scheduling)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/everreal-integration-webflow.git
cd everreal-integration-webflow

# Install dependencies
npm install
```

### Configuration

Create a `.env` file with the following:

```
# Webflow API Credentials
WEBFLOW_TOKEN=your_webflow_api_token
COLLECTION_ID=your_webflow_collection_id
SITE_ID=your_webflow_site_id

# FTP Server Credentials (Everreal)
FTP_HOST=your_ftp_host
FTP_USER=your_ftp_username
FTP_PASSWORD=your_ftp_password
FTP_PORT=21
REMOTE_FOLDER=/
```

**Important**: Your Webflow API token needs CMS API Read/Write permissions.

## Usage

```bash
# Run the integration manually
npm start

# Test with a sample XML file
npm test
```

## Vercel Deployment & Scheduling

This project includes configuration for automated execution via Vercel:

1. Connect your repository to Vercel
2. Add all environment variables in the Vercel dashboard
3. Deploy the project

The integration will automatically run once daily at 10:00 UTC. You can also trigger it manually by calling:

```
GET https://your-vercel-deployment.vercel.app/api/cron
```

## Troubleshooting

If you encounter issues:

- Check API token permissions for Webflow
- Verify FTP connection details
- Ensure XML files match the expected OpenImmo format
- Review logs for detailed error information

## Dependencies

- axios - API calls
- basic-ftp - FTP operations
- dotenv - Environment variables
- fs-extra - File system utilities
- xml2js - XML parsing
- webflow-api - Webflow API client
- winston - Logging