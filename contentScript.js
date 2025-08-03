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
    const uniqueUrls = new Set();
    this.images = []; // Reset images array
    
    // 1. Look for React Image Lightbox images (original approach)
    const rilImages = document.querySelectorAll('.ril-image-next, .ril__imageNext, .ril__image');
    rilImages.forEach((img, index) => {
      const src = img.src;
      if (src && src.includes('d2nxps5jx3f309.cloudfront.net') && !uniqueUrls.has(src)) {
        uniqueUrls.add(src);
        
        const urlParts = src.split('/');
        const filename = urlParts[urlParts.length - 1] || `lightbox_image_${index + 1}.jpg`;
        
        this.images.push({
          url: src,
          filename: filename,
          index: this.images.length,
          alt: img.alt || `Lightbox Image ${index + 1}`,
          type: 'lightbox'
        });
      }
    });
    
    // 2. Look for feature/main product image
    const featureImage = document.querySelector('[data-testid="feature-image"], .sc-kNvTSQ.fXwRYd');
    if (featureImage && featureImage.src && featureImage.src.includes('d2nxps5jx3f309.cloudfront.net') && !uniqueUrls.has(featureImage.src)) {
      uniqueUrls.add(featureImage.src);
      
      const urlParts = featureImage.src.split('/');
      const filename = urlParts[urlParts.length - 1] || 'featured_image.jpg';
      
      this.images.push({
        url: featureImage.src,
        filename: filename,
        index: this.images.length,
        alt: featureImage.alt || 'Featured Product Image',
        type: 'featured'
      });
    }
    
    // 3. Look for thumbnail images
    const thumbnailImages = document.querySelectorAll('.sc-entYTK.knWYHm, [alt="thumbnail image"]');
    thumbnailImages.forEach((img, index) => {
      const src = img.src;
      if (src && src.includes('d2nxps5jx3f309.cloudfront.net') && !uniqueUrls.has(src)) {
        uniqueUrls.add(src);
        
        const urlParts = src.split('/');
        const filename = urlParts[urlParts.length - 1] || `thumbnail_${index + 1}.jpg`;
        
        this.images.push({
          url: src,
          filename: filename,
          index: this.images.length,
          alt: img.alt || `Thumbnail ${index + 1}`,
          type: 'thumbnail'
        });
      }
    });
    
    // 4. Fallback: Check for any other product images from the CDN
    const allImages = document.querySelectorAll('img[src*="d2nxps5jx3f309.cloudfront.net"]');
    allImages.forEach((img, index) => {
      const src = img.src;
      if (!uniqueUrls.has(src)) {
        uniqueUrls.add(src);
        
        const urlParts = src.split('/');
        const filename = urlParts[urlParts.length - 1] || `product_image_${index + 1}.jpg`;
        
        this.images.push({
          url: src,
          filename: filename,
          index: this.images.length,
          alt: img.alt || `Product Image ${index + 1}`,
          type: 'general'
        });
      }
    });
    
    return this.images;
  }

  extractMetadata() {
    const metadata = {
      productId: this.productId,
      productName: '',
      productDescription: '',
      vendorName: '',
      supplierLink: '',
      price: '',
      sellingPrice: '',
      processingTime: '',
      shippingInfo: '',
      shippingDetails: [],
      timeframes: '',
      marketplaceInfo: '',
      returnPolicy: '',
      paymentMethods: [],
      tags: [],
      extractedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    // Try different selectors for product name
    const productNameSelectors = [
      'h3[data-cy="listing-detail-modal-title"]', // From second HTML structure
      'h1[data-testid="product-title"]',
      'h1.product-title', 
      'h1',
      '[data-testid="product-name"]',
      '.product-name',
      'h1.sc-eZkCL.lmgIAS' // Based on the HTML structure
    ];
    
    for (const selector of productNameSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        metadata.productName = element.textContent.trim();
        break;
      }
    }

    // Extract product description from the description section
    const descriptionSelectors = [
      '.sc-cmaqmh.sc-fJKILO.kOUXxd.dUyFgg p',
      '[class*="product-description"] p',
      '.product-description p',
      'section p'
    ];
    
    let descriptionParts = [];
    for (const selector of descriptionSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach(el => {
          const text = el.textContent.trim();
          if (text && !text.startsWith('#') && text.length > 10) {
            descriptionParts.push(text);
          }
        });
        if (descriptionParts.length > 0) break;
      }
    }
    metadata.productDescription = descriptionParts.join('\n\n');

    // Extract tags from description (hashtags)
    const tagRegex = /#(\w+)/g;
    const fullText = document.body.textContent;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(fullText)) !== null) {
      if (!metadata.tags.includes(tagMatch[1])) {
        metadata.tags.push(tagMatch[1]);
      }
    }

    // Check if item is pushed to store
    const pushedElement = document.querySelector('[data-cy="pushed-tag"], .sc-jgtTJd.jmRLXz');
    if (pushedElement) {
      metadata.inStore = true;
      metadata.storeStatus = pushedElement.textContent.trim();
    }

    // Extract marketplace availability info
    const marketplaceElement = document.querySelector('.sc-iRfNzj.bBfjaY');
    if (marketplaceElement) {
      metadata.marketplaceInfo = marketplaceElement.textContent.trim();
    }

    // Supplier link extraction (priority over generic vendor selectors)
    const supplierLinkElement = document.querySelector('.supplier-link');
    if (supplierLinkElement) {
      metadata.vendorName = supplierLinkElement.textContent.trim();
      metadata.supplierLink = supplierLinkElement.href;
    } else {
      // Fallback to generic vendor selectors
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
    }

    // Prices for you pay and you sell (specific selector first)
    const priceElements = document.querySelectorAll('h3.sc-eZkCL.lmgIAS');
    if (priceElements.length > 1) {  
      metadata.price = priceElements[0].textContent.trim();
      metadata.sellingPrice = priceElements[1].textContent.trim();
    } else {
      // Fallback to generic price selectors
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
    }

    // Processing time extraction
    const processingTimeElement = document.querySelector('.sc-cmaqmh.ihBHZO');
    if (processingTimeElement && processingTimeElement.textContent.includes('business days')) {
      metadata.processingTime = processingTimeElement.textContent.trim();
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

    // Extract return policies
    const returnPolicyElement = document.querySelector('.sc-cmaqmh.kOUXxd');
    if (returnPolicyElement && returnPolicyElement.textContent.length > 50) {
      metadata.returnPolicy = returnPolicyElement.textContent.trim();
    }

    // Payment methods
    const paymentMethods = Array.from(document.querySelectorAll('.sc-dUSDBE img')).map(img => img.alt);
    metadata.paymentMethods = paymentMethods;

    // Shipping details extraction
    const shippingDivs = document.querySelectorAll('.sc-fDpJdc.cFpoNJ');
    shippingDivs.forEach(div => {
      const region = div.querySelector('.sc-hiEoHn.kOUXxd') ? div.querySelector('.sc-hiEoHn.kOUXxd').textContent.trim() : '';
      const timeText = div.querySelector('.sc-ksJxCS.kOUXxd') ? div.querySelector('.sc-ksJxCS.kOUXxd').textContent.trim() : '';
      if (region || timeText) {
        metadata.shippingDetails.push({ region, timeText });
      }
    });

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
