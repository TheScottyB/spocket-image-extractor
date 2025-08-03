# Spocket Image Extractor

A Chrome extension that extracts and saves product images and metadata from Spocket product pages with a user-friendly selection interface.

## Features

- 🖼️ **Smart Image Detection**: Automatically finds product images on Spocket product pages
- ✅ **Selective Download**: Choose which images to save with thumbnail previews and checkboxes
- 📋 **Metadata Export**: Automatically generates JSON files with product information
- 🏷️ **Smart Naming**: Appends product names to image filenames for better organization
- 🔄 **Retry Logic**: Robust download handling with automatic retry on failures
- 🛡️ **Secure**: Minimal permissions, input sanitization, and secure file handling

## Installation

### Development Installation (Unpacked Extension)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TheScottyB/spocket-image-extractor.git
   cd spocket-image-extractor
   ```

2. **Install dependencies (optional for development):**
   ```bash
   pnpm install
   ```

3. **Load extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the project directory

4. **Add extension icons (optional):**
   - Create or add icon files: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
   - See `icons-README.md` for specifications

### Chrome Web Store Installation (Future)
*Extension will be available on the Chrome Web Store after testing and approval.*

## Usage

1. **Navigate to a Spocket product page:**
   - Visit any URL matching `https://app.spocket.co/product/*`
   - Example: `https://app.spocket.co/product/fd3b0f15-0f33-4db6-b324-fa7ef63e3377`

2. **Open the extension:**
   - Click the extension icon in Chrome's toolbar
   - The popup will automatically scan the page for images

3. **Select images to download:**
   - View thumbnails of all detected product images
   - Use checkboxes to select desired images
   - Use "Select All" or "Deselect All" for convenience

4. **Review product information:**
   - Check the extracted metadata (product name, vendor, price, etc.)
   - This information will be included in the JSON file

5. **Download selected images:**
   - Click "Save Selected Images"
   - Images will be saved to your Downloads folder in a `spocket-images` subfolder
   - A JSON metadata file will also be generated

## File Organization

Downloaded files are organized as follows:
```
Downloads/
└── spocket-images/
    ├── ProductName_image1.jpg
    ├── ProductName_image2.jpg
    └── ProductName_metadata.json
```

### Metadata JSON Structure
```json
{
  "productId": "fd3b0f15-0f33-4db6-b324-fa7ef63e3377",
  "productName": "Example Product",
  "vendorName": "Example Vendor",
  "price": "$29.99",
  "shippingInfo": "Free shipping",
  "timeframes": "3-7 business days",
  "extractedAt": "2025-01-01T12:00:00.000Z",
  "pageUrl": "https://app.spocket.co/product/fd3b0f15-0f33-4db6-b324-fa7ef63e3377",
  "downloadedImages": [...],
  "totalImages": 5,
  "successfulDownloads": 5,
  "downloadedAt": "2025-01-01T12:00:00.000Z"
}
```

## Development

### Requirements
- Node.js 20.11.0 (managed via Volta)
- PNPM 10.14.0 (package manager)
- Chrome browser for testing

### Development Setup
```bash
# Clone repository
git clone https://github.com/TheScottyB/spocket-image-extractor.git
cd spocket-image-extractor

# Install dependencies
pnpm install

# Load extension in Chrome for testing
# (Follow installation instructions above)
```

### Project Structure
```
spocket-image-extractor/
├── manifest.json          # Chrome extension configuration
├── contentScript.js       # DOM parsing and data extraction
├── background.js          # Download management service worker
├── popup.html            # Extension popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup interaction logic
├── SECURITY.md           # Security guidelines and best practices
├── volta.json            # Node.js version management
└── package.json          # Project configuration
```

### Testing
1. Load the unpacked extension in Chrome
2. Navigate to a Spocket product page
3. Test the extension functionality:
   - Image detection and display
   - Metadata extraction
   - Selection interface
   - Download process
   - Error handling

### Security Considerations
- See [SECURITY.md](./SECURITY.md) for detailed security guidelines
- All permissions follow the principle of least privilege
- Input sanitization prevents directory traversal attacks
- No external data transmission beyond image downloads
- Regular dependency audits with `pnpm audit`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with descriptive messages: `git commit -m "Add feature description"`
5. Push to your fork: `git push origin feature-name`
6. Open a pull request

### Development Workflow
- Use GitHub CLI for repository management: `gh repo create`, `gh pr create`
- Follow security best practices outlined in SECURITY.md
- Test on multiple Spocket product pages
- Ensure compatibility with Chrome's latest extension APIs

## License

ISC License - see LICENSE file for details.

## Support

- Report bugs via GitHub Issues
- Security vulnerabilities: see SECURITY.md for reporting procedures
- Feature requests welcome via Issues

## Version History

- **v1.0.0** - Initial release
  - Basic image extraction and download
  - Metadata export functionality
  - User-friendly selection interface
