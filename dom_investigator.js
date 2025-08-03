// DOM Investigator for exploratory analysis and reporting

class DOMInvestigator {
  constructor() {
    this.report = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      pageStructure: {},
      dataFields: {},
      potentialSelectors: {},
      recommendations: []
    };
    this.debug = true;
  }

  // Initialize DOM investigation and generate comprehensive report
  async investigate() {
    if (this.debug) console.log('DOMInvestigator: Starting investigation...');
    
    this.analyzePageStructure();
    this.identifyDataFields();
    this.generateSelectors();
    this.analyzeImages();
    this.detectDynamicElements();
    this.generateRecommendations();
    
    if (this.debug) {
      console.log('DOMInvestigator: Investigation complete');
      console.log('Report:', this.report);
    }
    
    return this.report;
  }

  // Analyze the overall page structure
  analyzePageStructure() {
    this.report.pageStructure = {
      title: document.title,
      headings: this.extractHeadings(),
      forms: this.analyzeForms(),
      buttons: this.analyzeButtons(),
      links: this.analyzeLinks(),
      images: this.countImages(),
      videos: this.countVideos(),
      scripts: this.countScripts(),
      stylesheets: this.countStylesheets()
    };
  }

  extractHeadings() {
    const headings = [];
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
      const elements = document.querySelectorAll(tag);
      elements.forEach(el => {
        headings.push({
          tag: tag,
          text: el.textContent.trim(),
          classes: Array.from(el.classList),
          id: el.id || null
        });
      });
    });
    return headings;
  }

  analyzeForms() {
    const forms = [];
    document.querySelectorAll('form').forEach(form => {
      const inputs = Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
        type: input.type || input.tagName.toLowerCase(),
        name: input.name,
        placeholder: input.placeholder,
        required: input.required
      }));
      
      forms.push({
        action: form.action,
        method: form.method,
        inputs: inputs
      });
    });
    return forms;
  }

  analyzeButtons() {
    const buttons = [];
    document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach(btn => {
      buttons.push({
        text: btn.textContent || btn.value,
        type: btn.type,
        classes: Array.from(btn.classList),
        onclick: btn.onclick ? 'has-onclick' : null
      });
    });
    return buttons;
  }

  analyzeLinks() {
    const links = [];
    document.querySelectorAll('a[href]').forEach(link => {
      links.push({
        href: link.href,
        text: link.textContent.trim(),
        isExternal: !link.href.startsWith(window.location.origin)
      });
    });
    return links.slice(0, 20); // Limit to first 20 for report size
  }

  countImages() {
    return {
      total: document.querySelectorAll('img').length,
      withAlt: document.querySelectorAll('img[alt]').length,
      lazyLoaded: document.querySelectorAll('img[data-src], img[loading="lazy"]').length
    };
  }

  countVideos() {
    return document.querySelectorAll('video').length;
  }

  countScripts() {
    return document.querySelectorAll('script').length;
  }

  countStylesheets() {
    return document.querySelectorAll('link[rel="stylesheet"]').length;
  }

  // Identify potential data fields for product information
  identifyDataFields() {
    const dataFields = {};
    
    // Product name candidates
    dataFields.productName = this.findElementsByContent([
      'name', 'title', 'product', 'item'
    ], ['h1', 'h2', 'h3', '[class*="title"]', '[class*="name"]']);
    
    // Price candidates
    dataFields.price = this.findElementsByContent([
      '$', 'price', 'cost', 'usd', 'eur', 'gbp'
    ], ['[class*="price"]', '[class*="cost"]', 'span', 'div']);
    
    // Description candidates
    dataFields.description = this.findElementsByContent([
      'description', 'details', 'about', 'info'
    ], ['p', 'div', 'section', '[class*="desc"]']);
    
    // Vendor/supplier candidates
    dataFields.vendor = this.findElementsByContent([
      'vendor', 'supplier', 'brand', 'seller', 'by'
    ], ['[class*="vendor"]', '[class*="supplier"]', '[class*="brand"]']);
    
    // Stock/availability candidates
    dataFields.stock = this.findElementsByContent([
      'stock', 'available', 'in stock', 'out of stock', 'inventory'
    ], ['[class*="stock"]', '[class*="avail"]', 'span', 'div']);
    
    this.report.dataFields = dataFields;
  }

  // Find elements by content keywords and potential selectors
  findElementsByContent(keywords, selectors) {
    const candidates = [];
    
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent.toLowerCase();
          const hasKeyword = keywords.some(keyword => 
            text.includes(keyword.toLowerCase())
          );
          
          if (hasKeyword) {
            candidates.push({
              element: el.tagName.toLowerCase(),
              text: el.textContent.trim().substring(0, 100),
              classes: Array.from(el.classList),
              id: el.id || null,
              selector: this.generateSelector(el),
              confidence: this.calculateConfidence(el, keywords)
            });
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });
    
    return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  // Generate a robust selector for an element
  generateSelector(element) {
    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }
    
    // Try data attributes
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-testid') || attr.name.startsWith('data-cy')) {
        return `[${attr.name}="${attr.value}"]`;
      }
    }
    
    // Try class combinations
    if (element.classList.length > 0) {
      const classes = Array.from(element.classList);
      return `.${classes.join('.')}`;
    }
    
    // Fallback to tag with position
    const siblings = Array.from(element.parentNode.children);
    const index = siblings.indexOf(element);
    return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
  }

  // Calculate confidence score for element matching
  calculateConfidence(element, keywords) {
    let score = 0;
    
    const text = element.textContent.toLowerCase();
    const className = element.className.toLowerCase();
    const id = (element.id || '').toLowerCase();
    
    // Text content matching
    keywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) score += 10;
      if (className.includes(keyword.toLowerCase())) score += 15;
      if (id.includes(keyword.toLowerCase())) score += 20;
    });
    
    // Structural bonuses
    if (element.closest('[class*="product"]')) score += 5;
    if (element.hasAttribute('data-testid')) score += 10;
    if (element.tagName.match(/^H[1-6]$/)) score += 5;
    
    return score;
  }

  // Generate robust selectors for identified elements
  generateSelectors() {
    const selectors = {};
    
    Object.keys(this.report.dataFields).forEach(field => {
      const candidates = this.report.dataFields[field];
      selectors[field] = {
        primary: candidates[0]?.selector || null,
        alternatives: candidates.slice(1, 3).map(c => c.selector),
        patterns: this.generatePatterns(candidates)
      };
    });
    
    this.report.potentialSelectors = selectors;
  }

  generatePatterns(candidates) {
    const patterns = [];
    
    candidates.forEach(candidate => {
      // Extract common class patterns
      candidate.classes.forEach(cls => {
        if (cls.length > 3) {
          patterns.push(`[class*="${cls}"]`);
        }
      });
    });
    
    return [...new Set(patterns)].slice(0, 3);
  }

  // Analyze images on the page
  analyzeImages() {
    const imageAnalysis = {
      productImages: [],
      thumbnails: [],
      logos: [],
      backgrounds: []
    };
    
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('data-src') || '';
      const alt = img.alt || '';
      const classes = Array.from(img.classList).join(' ');
      
      const imageInfo = {
        src: src.substring(0, 100),
        alt,
        classes,
        dimensions: `${img.width || 'auto'}x${img.height || 'auto'}`,
        isLazyLoaded: !!(img.getAttribute('data-src') || img.loading === 'lazy')
      };
      
      // Categorize images
      if (this.isProductImage(img)) {
        imageAnalysis.productImages.push(imageInfo);
      } else if (this.isThumbnail(img)) {
        imageAnalysis.thumbnails.push(imageInfo);
      } else if (this.isLogo(img)) {
        imageAnalysis.logos.push(imageInfo);
      }
    });
    
    this.report.imageAnalysis = imageAnalysis;
  }

  isProductImage(img) {
    const indicators = ['product', 'item', 'main', 'hero', 'feature'];
    const classes = img.className.toLowerCase();
    const alt = (img.alt || '').toLowerCase();
    
    return indicators.some(indicator => 
      classes.includes(indicator) || alt.includes(indicator)
    );
  }

  isThumbnail(img) {
    const indicators = ['thumb', 'thumbnail', 'small', 'preview'];
    const classes = img.className.toLowerCase();
    const size = Math.max(img.width || 0, img.height || 0);
    
    return indicators.some(indicator => classes.includes(indicator)) || size < 100;
  }

  isLogo(img) {
    const indicators = ['logo', 'brand', 'company'];
    const classes = img.className.toLowerCase();
    const alt = (img.alt || '').toLowerCase();
    
    return indicators.some(indicator => 
      classes.includes(indicator) || alt.includes(indicator)
    );
  }

  // Detect dynamic elements that might change
  detectDynamicElements() {
    const dynamicElements = {
      lazyLoaded: document.querySelectorAll('[data-src], [loading="lazy"]').length,
      withReactProps: document.querySelectorAll('[data-reactroot], [data-react-checksum]').length,
      withAngularDirectives: document.querySelectorAll('[ng-*], [data-ng-*]').length,
      withVueDirectives: document.querySelectorAll('[v-*], [data-v-*]').length,
      dynamicClasses: this.findDynamicClasses(),
      abTestingElements: this.findABTestingElements()
    };
    
    this.report.dynamicElements = dynamicElements;
  }

  findDynamicClasses() {
    const dynamicPatterns = [];
    const allElements = document.querySelectorAll('*');
    
    for (let i = 0; i < Math.min(allElements.length, 100); i++) {
      const el = allElements[i];
      Array.from(el.classList).forEach(cls => {
        // Look for generated class patterns
        if (/^[a-zA-Z]+-[a-z0-9]{6,}$/.test(cls) || // CSS-in-JS patterns
            /^sc-[a-zA-Z0-9]+$/.test(cls)) {          // Styled-components patterns
          dynamicPatterns.push(cls);
        }
      });
    }
    
    return [...new Set(dynamicPatterns)].slice(0, 10);
  }

  findABTestingElements() {
    const abElements = [];
    
    // Look for common A/B testing attributes
    const abSelectors = [
      '[data-ab]', '[data-experiment]', '[data-variant]',
      '[class*="test"]', '[class*="variant"]', '[class*="ab-"]'
    ];
    
    abSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        abElements.push({
          selector: selector,
          text: el.textContent.trim().substring(0, 50),
          attributes: Object.fromEntries(
            Array.from(el.attributes)
              .filter(attr => attr.name.includes('test') || attr.name.includes('variant'))
              .map(attr => [attr.name, attr.value])
          )
        });
      });
    });
    
    return abElements.slice(0, 5);
  }

  // Generate recommendations based on analysis
  generateRecommendations() {
    const recommendations = [];
    
    // Selector stability recommendations
    const dynamicClasses = this.report.dynamicElements?.dynamicClasses || [];
    if (dynamicClasses.length > 5) {
      recommendations.push({
        type: 'warning',
        category: 'selectors',
        message: `Found ${dynamicClasses.length} dynamic CSS classes. Consider using data attributes or semantic selectors instead.`,
        examples: dynamicClasses.slice(0, 3)
      });
    }
    
    // Data field recommendations
    Object.keys(this.report.dataFields).forEach(field => {
      const candidates = this.report.dataFields[field];
      if (candidates.length === 0) {
        recommendations.push({
          type: 'error',
          category: 'data-extraction',
          message: `No candidates found for ${field}. Manual investigation required.`
        });
      } else if (candidates[0].confidence < 20) {
        recommendations.push({
          type: 'warning',
          category: 'data-extraction',
          message: `Low confidence (${candidates[0].confidence}) for ${field} extraction. Consider multiple fallback strategies.`
        });
      }
    });
    
    // Image extraction recommendations
    const imageAnalysis = this.report.imageAnalysis;
    if (imageAnalysis && imageAnalysis.productImages.length === 0) {
      recommendations.push({
        type: 'error',
        category: 'images',
        message: 'No product images detected. Check image classification logic.'
      });
    }
    
    // A/B testing recommendations
    const abElements = this.report.dynamicElements?.abTestingElements || [];
    if (abElements.length > 0) {
      recommendations.push({
        type: 'info',
        category: 'ab-testing',
        message: `Detected ${abElements.length} potential A/B testing elements. Consider implementing variant detection.`
      });
    }
    
    this.report.recommendations = recommendations;
  }

  // Export report for analysis
  exportReport() {
    const reportJson = JSON.stringify(this.report, null, 2);
    const blob = new Blob([reportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `dom-investigation-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }
}

// Auto-run investigation when script loads
const investigator = new DOMInvestigator();
investigator.investigate().then(report => {
  // Make report available globally for debugging
  window.domInvestigationReport = report;
  console.log('DOM Investigation complete. Access report via window.domInvestigationReport');
});
