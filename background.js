// Background service worker for Spocket Image Extractor

// Import the AI agent (we'll load it dynamically)
let ProductVisionAgent = null;

class DownloadManager {
  constructor() {
    this.downloads = new Map();
    this.currentDownload = null;
  }

  // Sanitize filename for safe file system usage
  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .trim();
  }

  // Generate filename with product name prefix
  generateFilename(productName, originalFilename) {
    const sanitizedProductName = this.sanitizeFilename(productName);
    const sanitizedOriginal = this.sanitizeFilename(originalFilename);
    
    // Remove extension from original filename to add product name before it
    const lastDotIndex = sanitizedOriginal.lastIndexOf('.');
    if (lastDotIndex > -1) {
      const nameWithoutExt = sanitizedOriginal.substring(0, lastDotIndex);
      const extension = sanitizedOriginal.substring(lastDotIndex);
      return `${sanitizedProductName}_${nameWithoutExt}${extension}`;
    }
    
    return `${sanitizedProductName}_${sanitizedOriginal}`;
  }

  // Download a single image with retry logic
  async downloadImage(imageData, productName, retries = 3) {
    const filename = this.generateFilename(productName, imageData.filename);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const downloadId = await chrome.downloads.download({
          url: imageData.url,
          filename: `spocket-images/${filename}`,
          saveAs: false
        });
        
        console.log(`Downloaded: ${filename} (ID: ${downloadId})`);
        return {
          downloadId,
          filename,
          url: imageData.url,
          success: true
        };
        
      } catch (error) {
        console.error(`Download attempt ${attempt} failed for ${filename}:`, error);
        
        if (attempt === retries) {
          return {
            filename,
            url: imageData.url,
            success: false,
            error: error.message
          };
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // Generate and download metadata JSON file
  async downloadMetadata(metadata, selectedImages, downloadResults) {
    const jsonData = {
      ...metadata,
      downloadedImages: downloadResults.filter(result => result.success),
      failedImages: downloadResults.filter(result => !result.success),
      totalImages: selectedImages.length,
      successfulDownloads: downloadResults.filter(result => result.success).length,
      downloadedAt: new Date().toISOString()
    };

    const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: 'application/json'
    });
    
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const metadataFilename = this.sanitizeFilename(
      `${metadata.productName || metadata.productId || 'product'}_metadata.json`
    );

    try {
      const downloadId = await chrome.downloads.download({
        url: jsonUrl,
        filename: `spocket-images/${metadataFilename}`,
        saveAs: false
      });
      
      console.log(`Metadata downloaded: ${metadataFilename} (ID: ${downloadId})`);
      
      // Clean up blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(jsonUrl), 10000);
      
      return { success: true, filename: metadataFilename, downloadId };
    } catch (error) {
      console.error('Failed to download metadata:', error);
      URL.revokeObjectURL(jsonUrl);
      return { success: false, error: error.message };
    }
  }

  // Main download function
  async downloadSelectedImages(data) {
    const { selectedImages, metadata } = data;
    
    if (!selectedImages || selectedImages.length === 0) {
      throw new Error('No images selected for download');
    }

    console.log(`Starting download of ${selectedImages.length} images...`);
    
    // Download all selected images
    const downloadPromises = selectedImages.map(imageData => 
      this.downloadImage(imageData, metadata.productName || metadata.productId || 'product')
    );
    
    const downloadResults = await Promise.all(downloadPromises);
    
    // Download metadata file
    const metadataResult = await this.downloadMetadata(metadata, selectedImages, downloadResults);
    
    const successCount = downloadResults.filter(result => result.success).length;
    const failCount = downloadResults.filter(result => !result.success).length;
    
    console.log(`Download complete: ${successCount} successful, ${failCount} failed`);
    
    return {
      downloadResults,
      metadataResult,
      summary: {
        total: selectedImages.length,
        successful: successCount,
        failed: failCount
      }
    };
  }
}

// Initialize download manager
const downloadManager = new DownloadManager();

// AI Agent functions
async function initializeAgent() {
  try {
    // Get API key from storage
    const result = await chrome.storage.local.get(['openaiApiKey']);
    if (!result.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    // Load the agent script dynamically
    if (!ProductVisionAgent) {
      await import(chrome.runtime.getURL('agent.js')).then(module => {
        ProductVisionAgent = module.default || window.ProductVisionAgent;
      });
    }
    
    return new ProductVisionAgent(result.openaiApiKey);
  } catch (error) {
    console.error('Failed to initialize AI agent:', error);
    throw error;
  }
}

async function analyzeScreenshot(tabId, metadata = {}) {
  try {
    const agent = await initializeAgent();
    
    // Capture screenshot
    const dataUrl = await new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 90 }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(dataUrl);
        }
      });
    });
    
    // Analyze with AI
    const context = {
      productName: metadata.productName,
      existingDescription: metadata.productDescription,
      productType: metadata.tags?.[0]
    };
    
    const analysis = await agent.analyzeProductImage(dataUrl, context);
    
    return {
      success: true,
      analysis,
      screenshot: dataUrl
    };
    
  } catch (error) {
    console.error('Screenshot analysis failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'downloadImages') {
    downloadManager.downloadSelectedImages(request.data)
      .then(result => {
        console.log('Download operation completed:', result);
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('Download operation failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'analyzeScreenshot') {
    analyzeScreenshot(sender.tab?.id, request.metadata)
      .then(result => {
        console.log('Screenshot analysis completed:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('Screenshot analysis failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'setApiKey') {
    chrome.storage.local.set({ openaiApiKey: request.apiKey })
      .then(() => {
        sendResponse({ success: true, message: 'API key saved' });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
  
  if (request.action === 'getApiKey') {
    chrome.storage.local.get(['openaiApiKey'])
      .then(result => {
        sendResponse({ 
          success: true, 
          hasApiKey: !!result.openaiApiKey,
          apiKey: result.openaiApiKey ? result.openaiApiKey.substring(0, 10) + '...' : null
        });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
  
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'Background script is active' });
  }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Spocket Image Extractor installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set up any initial configuration
    chrome.storage.local.set({
      installDate: new Date().toISOString(),
      version: chrome.runtime.getManifest().version
    });
  }
});

// Handle download completion events
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    console.log(`Download completed: ${downloadDelta.id}`);
  }
  
  if (downloadDelta.error) {
    console.error(`Download error for ${downloadDelta.id}:`, downloadDelta.error);
  }
});

console.log('Spocket Image Extractor background script loaded');
