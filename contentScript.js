// Content script for Spocket product pages
console.log('Spocket Content Script loaded on:', window.location.href);

class SpocketExtractor {
  constructor() {
    this.productId = this.extractProductId();
    this.images = [];
    this.metadata = {};
    this.observer = null;
    this.debug = true; // Enable debug logging
    this.lastExtractionCount = 0;
    this.extractionAttempts = 0;
    this.domAgent = null;
    this.visionDataCache = new Map();
    
    // Initialize MutationObserver for dynamic content
    this.initMutationObserver();
    this.initDOMAgent();
  }
  
  initMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      const hasNewImages = mutations.some(mutation => {
        return Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            return node.tagName === 'IMG' || 
                   node.querySelector && node.querySelector('img, picture, [style*="background-image"]');
          }
          return false;
        });
      });
      
      if (hasNewImages) {
        this.debounceExtraction();
      }
    });
  }
  
  startObserving() {
    if (this.observer) {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'style', 'data-src', 'srcset']
      });
      if (this.debug) console.log('SpocketExtractor: Started DOM observation');
    }
  }
  
  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      if (this.debug) console.log('SpocketExtractor: Stopped DOM observation');
    }
  }
  
  debounceExtraction() {
    clearTimeout(this.extractionTimeout);
    this.extractionTimeout = setTimeout(() => {
      const newImages = this.extractImages();
      if (newImages.length > this.lastExtractionCount) {
        this.lastExtractionCount = newImages.length;
        if (this.debug) console.log('SpocketExtractor: Found new images, total:', newImages.length);
      }
    }, 1000);
  }

  extractProductId() {
    const path = window.location.pathname;
    const match = path.match(/\/product\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  // Enhanced wait logic with exponential backoff and event-based retries
  async waitForImages(timeout = 30000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let attempt = 0;
      let eventListenersAdded = false;
      
      const checkForImages = () => {
        attempt++;
        const elapsed = Date.now() - startTime;
        
        // Try multiple selectors to detect images
        const imageSelectors = [
          '.ril-image-next', '.ril__imageNext', '.ril__image',
          'img[src*="d2nxps5jx3f309.cloudfront.net"]',
          '.lightbox-image', '.modal-image', '.popup-image',
          '[data-testid="feature-image"]', '.main-image', '.hero-image'
        ];
        
        let totalImages = 0;
        imageSelectors.forEach(selector => {
          const images = document.querySelectorAll(selector);
          totalImages += images.length;
        });
        
        if (this.debug) {
          console.log(`SpocketExtractor: Wait attempt #${attempt}, found ${totalImages} images after ${elapsed}ms`);
        }
        
        if (totalImages > 0 || elapsed > timeout) {
          if (eventListenersAdded) {
            this.removeWaitEventListeners();
          }
          resolve(totalImages > 0);
          return;
        }
        
        // Add event listeners on first attempt for dynamic content
        if (!eventListenersAdded) {
          this.addWaitEventListeners(checkForImages);
          eventListenersAdded = true;
        }
        
        // Exponential backoff: 500ms, 1s, 2s, 4s, 8s, then 8s intervals
        const delays = [500, 1000, 2000, 4000, 8000];
        const delay = delays[Math.min(attempt - 1, delays.length - 1)] || 8000;
        
        setTimeout(checkForImages, delay);
      };
      
      checkForImages();
    });
  }
  
  addWaitEventListeners(checkCallback) {
    this.waitEventHandlers = {
      scroll: () => {
        if (this.debug) console.log('SpocketExtractor: Scroll detected, rechecking images');
        setTimeout(checkCallback, 1000);
      },
      click: (e) => {
        // Check if click might trigger image loading (buttons, tabs, etc.)
        const target = e.target;
        if (target.matches('button, .tab, .thumbnail, [role="button"], [role="tab"]')) {
          if (this.debug) console.log('SpocketExtractor: Interactive element clicked, rechecking images');
          setTimeout(checkCallback, 1500);
        }
      },
      load: () => {
        if (this.debug) console.log('SpocketExtractor: Image loaded, rechecking');
        setTimeout(checkCallback, 500);
      }
    };
    
    // Add event listeners
    window.addEventListener('scroll', this.waitEventHandlers.scroll, { passive: true });
    document.addEventListener('click', this.waitEventHandlers.click, { passive: true });
    document.addEventListener('load', this.waitEventHandlers.load, true); // Use capture for images
    
    if (this.debug) console.log('SpocketExtractor: Added wait event listeners');
  }
  
  removeWaitEventListeners() {
    if (this.waitEventHandlers) {
      window.removeEventListener('scroll', this.waitEventHandlers.scroll);
      document.removeEventListener('click', this.waitEventHandlers.click);
      document.removeEventListener('load', this.waitEventHandlers.load, true);
      
      if (this.debug) console.log('SpocketExtractor: Removed wait event listeners');
      this.waitEventHandlers = null;
    }
  }
  
  // Manual retry method for forced re-extraction
  async forceRetry() {
    if (this.debug) console.log('SpocketExtractor: Force retry requested');
    
    // Stop current observation
    this.stopObserving();
    
    // Wait a bit for any pending operations
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start fresh extraction
    this.startObserving();
    const images = this.extractImages();
    
    if (this.debug) console.log(`SpocketExtractor: Force retry found ${images.length} images`);
    
    return { images, metadata: this.extractMetadata() };
  }

  extractImages() {
    const uniqueUrls = new Set();
    this.images = []; // Reset images array
    this.extractionAttempts++;
    
    if (this.debug) {
      console.group(`SpocketExtractor: Image extraction attempt #${this.extractionAttempts}`);
    }
    
    // Helper function to validate image URLs
    const isValidImageUrl = (url) => {
      if (!url) return false;
      
      // Support data URLs
      if (url.startsWith('data:image/')) return true;
      
      // Check for valid image extensions
      const imageExtensions = /\.(jpe?g|png|gif|webp|svg|bmp|ico)(\?.*)?$/i;
      return imageExtensions.test(url) || url.includes('d2nxps5jx3f309.cloudfront.net');
    };
    
    // Helper function to add image to collection
    const addImageToCollection = (url, type, element, fallbackAlt = '', index = 0) => {
      if (!isValidImageUrl(url) || uniqueUrls.has(url)) return false;
      
      uniqueUrls.add(url);
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1] || `${type}_image_${index + 1}.jpg`;
      
      this.images.push({
        url: url,
        filename: filename,
        index: this.images.length,
        alt: element?.alt || element?.getAttribute?.('aria-label') || fallbackAlt,
        type: type
      });
      
      return true;
    };
    
    // 1. React Image Lightbox images (original approach)
    const rilSelectors = [
      '.ril-image-next', '.ril__imageNext', '.ril__image',
      '.lightbox-image', '.modal-image', '.popup-image'
    ];
    
    rilSelectors.forEach(selector => {
      const images = document.querySelectorAll(selector);
      images.forEach((img, index) => {
        if (addImageToCollection(img.src, 'lightbox', img, `Lightbox Image ${index + 1}`, index)) {
          if (this.debug) console.log(`Found lightbox image: ${img.src}`);
        }
      });
    });
    
    // 2. Feature/main product images
    const featureSelectors = [
      '[data-testid="feature-image"]', '.sc-kNvTSQ.fXwRYd',
      '[data-testid="main-image"]', '[data-testid="hero-image"]',
      '.main-image', '.hero-image', '.featured-image',
      '[class*="main-image"]', '[class*="hero-image"]', '[class*="featured"]'
    ];
    
    featureSelectors.forEach(selector => {
      const img = document.querySelector(selector);
      if (img && addImageToCollection(img.src, 'featured', img, 'Featured Product Image')) {
        if (this.debug) console.log(`Found featured image: ${img.src}`);
      }
    });
    
    // 3. Thumbnail images
    const thumbnailSelectors = [
      '.sc-entYTK.knWYHm', '[alt="thumbnail image"]',
      '.thumbnail', '.thumb', '[class*="thumbnail"]', '[class*="thumb"]',
      '.carousel-item img', '.slider-item img', '.gallery-thumb img'
    ];
    
    thumbnailSelectors.forEach(selector => {
      const images = document.querySelectorAll(selector);
      images.forEach((img, index) => {
        if (addImageToCollection(img.src, 'thumbnail', img, `Thumbnail ${index + 1}`, index)) {
          if (this.debug) console.log(`Found thumbnail image: ${img.src}`);
        }
      });
    });
    
    // 4. Picture elements and srcset handling
    const pictureElements = document.querySelectorAll('picture');
    pictureElements.forEach((picture, index) => {
      const img = picture.querySelector('img');
      const sources = picture.querySelectorAll('source[srcset]');
      
      // Try to get the highest resolution from srcset
      let bestSrc = img?.src;
      let maxWidth = 0;
      
      sources.forEach(source => {
        const srcset = source.getAttribute('srcset');
        if (srcset) {
          const srcsetParts = srcset.split(',');
          srcsetParts.forEach(part => {
            const [url, descriptor] = part.trim().split(' ');
            const width = descriptor ? parseInt(descriptor.replace('w', '')) : 0;
            if (width > maxWidth) {
              maxWidth = width;
              bestSrc = url;
            }
          });
        }
      });
      
      if (addImageToCollection(bestSrc, 'picture', img, `Picture Element ${index + 1}`, index)) {
        if (this.debug) console.log(`Found picture element image: ${bestSrc}`);
      }
    });
    
    // 5. Images with data attributes (lazy loading)
    const lazySelectors = [
      '[data-src]', '[data-lazy-src]', '[data-original]',
      '[data-bg]', '[data-background]', '[data-hero-image]'
    ];
    
    lazySelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el, index) => {
        const dataSrc = el.getAttribute('data-src') || 
                       el.getAttribute('data-lazy-src') || 
                       el.getAttribute('data-original') ||
                       el.getAttribute('data-bg') ||
                       el.getAttribute('data-background') ||
                       el.getAttribute('data-hero-image');
        
        if (addImageToCollection(dataSrc, 'lazy', el, `Lazy Image ${index + 1}`, index)) {
          if (this.debug) console.log(`Found lazy-loaded image: ${dataSrc}`);
        }
      });
    });
    
    // 6. Background images from inline styles
    const allElements = document.querySelectorAll('*');
    let bgImageCount = 0;
    
    allElements.forEach(el => {
      const style = el.getAttribute('style');
      if (style && style.includes('background-image')) {
        const bgMatch = style.match(/background-image:\s*url\((["']?)(.*?)\1\)/);
        if (bgMatch && bgMatch[2]) {
          const bgUrl = bgMatch[2];
          if (addImageToCollection(bgUrl, 'background', el, el.getAttribute('aria-label') || `Background Image ${bgImageCount + 1}`, bgImageCount)) {
            bgImageCount++;
            if (this.debug) console.log(`Found background image: ${bgUrl}`);
          }
        }
      }
    });
    
    // 7. SVG image elements
    const svgImages = document.querySelectorAll('svg image[href], svg image[xlink\\:href]');
    svgImages.forEach((img, index) => {
      const href = img.getAttribute('href') || img.getAttribute('xlink:href');
      if (addImageToCollection(href, 'svg', img, `SVG Image ${index + 1}`, index)) {
        if (this.debug) console.log(`Found SVG image: ${href}`);
      }
    });
    
    // 8. Video poster images
    const videos = document.querySelectorAll('video[poster]');
    videos.forEach((video, index) => {
      const poster = video.getAttribute('poster');
      if (addImageToCollection(poster, 'video-poster', video, `Video Poster ${index + 1}`, index)) {
        if (this.debug) console.log(`Found video poster: ${poster}`);
      }
    });
    
    // 9. Images in hidden/modal containers
    const hiddenSelectors = [
      '.modal img', '.dialog img', '.popup img',
      '[aria-hidden="true"] img', '.hidden img',
      '[style*="display: none"] img', '[style*="visibility: hidden"] img'
    ];
    
    hiddenSelectors.forEach(selector => {
      const images = document.querySelectorAll(selector);
      images.forEach((img, index) => {
        if (addImageToCollection(img.src, 'hidden', img, `Hidden Image ${index + 1}`, index)) {
          if (this.debug) console.log(`Found hidden image: ${img.src}`);
        }
      });
    });
    
    // 10. Comprehensive fallback - all images with any image-related attributes or classes
    const comprehensiveSelectors = [
      'img', // All img tags
      '[class*="image"]', '[class*="img"]', // Class contains "image" or "img"
      '[id*="image"]', '[id*="img"]', // ID contains "image" or "img"
      '[src*=".jpg"]', '[src*=".jpeg"]', '[src*=".png"]', '[src*=".gif"]', '[src*=".webp"]', '[src*=".svg"]' // Source contains image extensions
    ];
    
    const fallbackImages = new Set();
    comprehensiveSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => fallbackImages.add(el));
      } catch (e) {
        if (this.debug) console.warn(`Invalid selector: ${selector}`, e);
      }
    });
    
    fallbackImages.forEach((el, index) => {
      const src = el.src || el.getAttribute('data-src') || el.getAttribute('href');
      if (addImageToCollection(src, 'fallback', el, `Fallback Image ${index + 1}`, index)) {
        if (this.debug) console.log(`Found fallback image: ${src}`);
      }
    });
    
    if (this.debug) {
      console.log(`Total unique images found: ${this.images.length}`);
      console.log('Image types:', this.images.reduce((acc, img) => {
        acc[img.type] = (acc[img.type] || 0) + 1;
        return acc;
      }, {}));
      console.groupEnd();
    }
    
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

    // Extract prices - look for price-related elements more broadly
    const priceSelectors = [
      '[data-testid="product-price"]',
      '.price',
      '.product-price',
      '[class*="price"]',
      '.cost',
      'span[class*="price"]',
      'div[class*="price"]'
    ];
    
    // Try to find price elements that contain $ or currency symbols
    const allElements = document.querySelectorAll('*');
    const priceElements = [];
    
    allElements.forEach(el => {
      const text = el.textContent.trim();
      if (text.match(/\$\d+\.\d{2}/) && el.children.length === 0) { // Price pattern and no child elements
        priceElements.push(el);
      }
    });
    
    if (priceElements.length >= 2) {
      metadata.price = priceElements[0].textContent.trim(); // You pay
      metadata.sellingPrice = priceElements[1].textContent.trim(); // You sell
    } else if (priceElements.length === 1) {
      metadata.price = priceElements[0].textContent.trim();
    } else {
      // Fallback to generic price selectors
      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim() && element.textContent.includes('$')) {
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
  
  if (request.action === 'forceRetry') {
    extractor.forceRetry().then(data => {
      sendResponse(data);
    }).catch(error => {
      console.error('Spocket Extractor Force Retry Error:', error);
      sendResponse({ error: error.message, images: [], metadata: {} });
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'startObserving') {
    extractor.startObserving();
    sendResponse({ success: true });
  }
  
  if (request.action === 'stopObserving') {
    extractor.stopObserving();
    sendResponse({ success: true });
  }
});

// Auto-start observation and extract when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    extractor.startObserving();
    setTimeout(() => extractor.extractAll(), 2000);
  });
} else {
  extractor.startObserving();
  setTimeout(() => extractor.extractAll(), 2000);
}
