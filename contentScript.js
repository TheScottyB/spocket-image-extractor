// Content script for Spocket product pages
class SpocketExtractor {
  constructor() {
    this.productId = this.extractProductId();
    this.images = [];
    this.metadata = {};
    this.observer = null;
  }

  extractProductId() {
    const path = window.location.pathname;
    const match = path.match(/\/product\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  // Wait for React components to load and images to be available
  async waitForImages(timeout = 10000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkForImages = () => {
        const images = document.querySelectorAll('.ril-image-next, .ril__imageNext, .ril__image');
        
        if (images.length > 0 || Date.now() - startTime > timeout) {
          resolve(images.length > 0);
          return;
        }
        
        setTimeout(checkForImages, 500);
      };
      
      checkForImages();
    });
  }

  extractImages() {
    const imageElements = document.querySelectorAll('.ril-image-next, .ril__imageNext, .ril__image');
    const uniqueUrls = new Set();
    
    imageElements.forEach((img, index) => {
      const src = img.src;
      if (src && src.includes('d2nxps5jx3f309.cloudfront.net') && !uniqueUrls.has(src)) {
        uniqueUrls.add(src);
        
        // Extract filename from URL
        const urlParts = src.split('/');
        const filename = urlParts[urlParts.length - 1] || `image_${index + 1}.jpg`;
        
        this.images.push({
          url: src,
          filename: filename,
          index: index,
          alt: img.alt || `Image ${index + 1}`
        });
      }
    });
    
    // Also check for any other product images that might not have the exact classes
    const allImages = document.querySelectorAll('img[src*="d2nxps5jx3f309.cloudfront.net"]');
    allImages.forEach((img, index) => {
      const src = img.src;
      if (!uniqueUrls.has(src)) {
        uniqueUrls.add(src);
        
        const urlParts = src.split('/');
        const filename = urlParts[urlParts.length - 1] || `additional_image_${index + 1}.jpg`;
        
        this.images.push({
          url: src,
          filename: filename,
          index: this.images.length,
          alt: img.alt || `Additional Image ${index + 1}`
        });
      }
    });
    
    return this.images;
  }

  extractMetadata() {
    const metadata = {
      productId: this.productId,
      productName: '',
      vendorName: '',
      price: '',
      shippingInfo: '',
      timeframes: '',
      extractedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    // Try different selectors for product name
    const productNameSelectors = [
      'h1[data-testid="product-title"]',
      'h1.product-title',
      'h1',
      '[data-testid="product-name"]',
      '.product-name'
    ];
    
    for (const selector of productNameSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        metadata.productName = element.textContent.trim();
        break;
      }
    }

    // Try different selectors for vendor/supplier name
    const vendorSelectors = [
      '[data-testid="supplier-name"]',
      '.supplier-name',
      '.vendor-name',
      '[class*="supplier"]',
      '[class*="vendor"]'
    ];
    
    for (const selector of vendorSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        metadata.vendorName = element.textContent.trim();
        break;
      }
    }

    // Try different selectors for price
    const priceSelectors = [
      '[data-testid="product-price"]',
      '.price',
      '.product-price',
      '[class*="price"]',
      '.cost'
    ];
    
    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        metadata.price = element.textContent.trim();
        break;
      }
    }

    // Try to find shipping information
    const shippingSelectors = [
      '[data-testid="shipping-info"]',
      '.shipping-info',
      '[class*="shipping"]',
      '[class*="delivery"]'
    ];
    
    for (const selector of shippingSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        metadata.shippingInfo = element.textContent.trim();
        break;
      }
    }

    // Try to find timeframe information
    const timeframeSelectors = [
      '[data-testid="delivery-time"]',
      '.delivery-time',
      '[class*="timeframe"]',
      '[class*="delivery"]',
      '[class*="processing"]'
    ];
    
    for (const selector of timeframeSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        metadata.timeframes = element.textContent.trim();
        break;
      }
    }

    this.metadata = metadata;
    return metadata;
  }

  // Clean filename for safe file system usage
  sanitizeFilename(filename) {
    return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
  }

  async extractAll() {
    console.log('Spocket Extractor: Starting extraction...');
    
    // Wait for images to load
    const imagesFound = await this.waitForImages();
    
    if (!imagesFound) {
      console.log('Spocket Extractor: No images found after waiting');
      return { images: [], metadata: this.extractMetadata() };
    }

    // Extract images and metadata
    const images = this.extractImages();
    const metadata = this.extractMetadata();
    
    console.log('Spocket Extractor: Found', images.length, 'images');
    console.log('Spocket Extractor: Metadata:', metadata);
    
    return { images, metadata };
  }
}

// Initialize extractor
const extractor = new SpocketExtractor();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractData') {
    extractor.extractAll().then(data => {
      sendResponse(data);
    }).catch(error => {
      console.error('Spocket Extractor Error:', error);
      sendResponse({ error: error.message, images: [], metadata: {} });
    });
    return true; // Keep message channel open for async response
  }
});

// Auto-extract when page loads (for development/debugging)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => extractor.extractAll(), 2000);
  });
} else {
  setTimeout(() => extractor.extractAll(), 2000);
}
