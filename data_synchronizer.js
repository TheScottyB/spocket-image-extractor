// DataSynchronizer - Coordinates DOM and Vision API extraction
class DataSynchronizer {
  constructor(options = {}) {
    this.debug = options.debug || true;
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
    this.visionApiKey = options.visionApiKey || null;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    // Initialize components
    this.domInvestigator = new DOMInvestigator();
    this.visionAgent = this.visionApiKey ? new ProductVisionAgent(this.visionApiKey) : null;
    
    // Field mapping between DOM and Vision data
    this.fieldMapping = {
      'productName': {
        dom: ['productName'],
        vision: ['title'],
        weight: 1.0,
        validator: this.validateProductName.bind(this)
      },
      'productDescription': {
        dom: ['productDescription'],
        vision: ['description'],
        weight: 0.9,
        validator: this.validateDescription.bind(this)
      },
      'price': {
        dom: ['price', 'sellingPrice'],
        vision: ['estimatedPrice'],
        weight: 0.8,
        validator: this.validatePrice.bind(this)
      },
      'vendor': {
        dom: ['vendorName'],
        vision: ['brand'],
        weight: 0.7,
        validator: this.validateVendor.bind(this)
      },
      'features': {
        dom: ['tags'],
        vision: ['keyFeatures'],
        weight: 0.8,
        validator: this.validateFeatures.bind(this)
      },
      'materials': {
        dom: [],
        vision: ['materials'],
        weight: 0.6,
        validator: this.validateMaterials.bind(this)
      },
      'colors': {
        dom: [],
        vision: ['colors'],
        weight: 0.7,
        validator: this.validateColors.bind(this)
      }
    };
  }

  // Main synchronization method
  async synchronizeData(domData = null, visionData = null, forceVisionAnalysis = false) {
    try {
      if (this.debug) {
        console.group('DataSynchronizer: Starting data synchronization');
        console.log('DOM data provided:', !!domData);
        console.log('Vision data provided:', !!visionData);
        console.log('Force vision analysis:', forceVisionAnalysis);
      }

      // Step 1: Gather DOM data if not provided
      if (!domData) {
        domData = await this.extractDOMData();
      }

      // Step 2: Gather Vision data if needed
      if (!visionData && (forceVisionAnalysis || this.shouldUseVision(domData))) {
        visionData = await this.extractVisionData(domData);
      }

      // Step 3: Synchronize and merge data
      const synchronizedData = this.mergeData(domData, visionData);

      // Step 4: Validate and enhance final data
      const finalData = await this.validateAndEnhance(synchronizedData);

      if (this.debug) {
        console.log('Synchronization complete:', finalData);
        console.groupEnd();
      }

      return {
        success: true,
        data: finalData,
        sources: {
          dom: !!domData,
          vision: !!visionData,
          confidence: this.calculateOverallConfidence(finalData)
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('DataSynchronizer: Synchronization failed:', error);
      
      return {
        success: false,
        error: error.message,
        data: domData || {},
        sources: { dom: !!domData, vision: false, confidence: 0.3 },
        timestamp: new Date().toISOString()
      };
    }
  }

  // Extract data using DOM investigation
  async extractDOMData() {
    try {
      if (this.debug) console.log('DataSynchronizer: Extracting DOM data...');
      
      const domReport = await this.domInvestigator.investigate();
      
      // Convert DOM investigation report to standardized format
      const domData = this.convertDOMReport(domReport);
      
      if (this.debug) console.log('DOM extraction complete:', domData);
      
      return domData;
      
    } catch (error) {
      console.error('DOM extraction failed:', error);
      return {};
    }
  }

  // Extract data using Vision API
  async extractVisionData(contextData = {}) {
    if (!this.visionAgent) {
      if (this.debug) console.log('DataSynchronizer: Vision agent not available');
      return null;
    }

    try {
      if (this.debug) console.log('DataSynchronizer: Extracting Vision data...');
      
      // Prepare context for vision analysis
      const visionContext = {
        productName: contextData.productName,
        existingDescription: contextData.productDescription,
        productType: contextData.tags?.[0]
      };

      // Perform vision analysis with retries
      let visionData = null;
      let attempt = 0;
      
      while (attempt < this.retryAttempts && !visionData) {
        try {
          attempt++;
          if (this.debug) console.log(`Vision analysis attempt ${attempt}/${this.retryAttempts}`);
          
          visionData = await this.visionAgent.analyzeCurrentPage(visionContext);
          
          if (visionData?.success) {
            break;
          } else {
            throw new Error(visionData?.error || 'Vision analysis failed');
          }
          
        } catch (error) {
          console.warn(`Vision attempt ${attempt} failed:`, error.message);
          
          if (attempt < this.retryAttempts) {
            await this.delay(this.retryDelay * attempt);
          } else {
            throw error;
          }
        }
      }

      if (this.debug) console.log('Vision extraction complete:', visionData);
      
      return visionData;
      
    } catch (error) {
      console.error('Vision extraction failed:', error);
      return null;
    }
  }

  // Convert DOM investigation report to standardized format
  convertDOMReport(domReport) {
    const standardData = {
      productName: this.extractBestCandidate(domReport.dataFields?.productName),
      productDescription: this.extractBestCandidate(domReport.dataFields?.description),
      price: this.extractBestCandidate(domReport.dataFields?.price),
      vendorName: this.extractBestCandidate(domReport.dataFields?.vendor),
      tags: this.extractFeatureTags(domReport),
      stock: this.extractBestCandidate(domReport.dataFields?.stock),
      confidence: this.calculateDOMConfidence(domReport),
      source: 'dom',
      extractedAt: domReport.timestamp
    };

    return standardData;
  }

  // Extract best candidate from DOM investigation results
  extractBestCandidate(candidates) {
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return '';
    }

    // Sort by confidence and return the best match
    const sorted = candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    return sorted[0]?.text?.trim() || '';
  }

  // Extract feature tags from DOM report
  extractFeatureTags(domReport) {
    const tags = [];
    
    // Extract from headings
    if (domReport.pageStructure?.headings) {
      domReport.pageStructure.headings.forEach(heading => {
        if (heading.text && heading.text.length > 3 && heading.text.length < 50) {
          tags.push(heading.text.trim());
        }
      });
    }

    // Extract from button texts (might contain product features)
    if (domReport.pageStructure?.buttons) {
      domReport.pageStructure.buttons.forEach(button => {
        if (button.text && button.text.length > 3 && button.text.length < 30) {
          tags.push(button.text.trim());
        }
      });
    }

    return [...new Set(tags)].slice(0, 10); // Remove duplicates and limit
  }

  // Calculate DOM extraction confidence
  calculateDOMConfidence(domReport) {
    let confidence = 0.5; // Base confidence
    
    // Boost confidence based on data quality
    Object.values(domReport.dataFields || {}).forEach(fieldCandidates => {
      if (fieldCandidates && fieldCandidates.length > 0) {
        const bestCandidate = fieldCandidates[0];
        confidence += (bestCandidate.confidence || 0) * 0.1;
      }
    });

    return Math.min(confidence, 1.0);
  }

  // Determine if vision analysis should be used
  shouldUseVision(domData) {
    if (!this.visionAgent) return false;
    
    // Use vision if DOM confidence is low
    if (domData.confidence < this.confidenceThreshold) {
      return true;
    }

    // Use vision if critical fields are missing
    const criticalFields = ['productName', 'productDescription'];
    const missingCritical = criticalFields.some(field => !domData[field] || domData[field].length < 10);
    
    return missingCritical;
  }

  // Merge DOM and Vision data intelligently
  mergeData(domData, visionData) {
    const mergedData = { ...domData };
    
    if (!visionData || !visionData.success) {
      if (this.debug) console.log('Using DOM data only');
      return mergedData;
    }

    if (this.debug) console.log('Merging DOM and Vision data...');

    // Merge each field based on confidence and validation
    Object.keys(this.fieldMapping).forEach(field => {
      const mapping = this.fieldMapping[field];
      const domValue = this.getValueFromSource(domData, mapping.dom);
      const visionValue = this.getValueFromSource(visionData, mapping.vision);
      
      // Calculate confidence scores
      const domConfidence = this.calculateFieldConfidence(domValue, 'dom', field);
      const visionConfidence = this.calculateFieldConfidence(visionValue, 'vision', field) * (visionData.confidence || 0.8);
      
      // Choose the best value
      if (visionConfidence > domConfidence && visionConfidence > this.confidenceThreshold) {
        mergedData[field] = visionValue;
        mergedData[`${field}_source`] = 'vision';
        mergedData[`${field}_confidence`] = visionConfidence;
      } else if (domValue) {
        mergedData[field] = domValue;
        mergedData[`${field}_source`] = 'dom';
        mergedData[`${field}_confidence`] = domConfidence;
      }

      // Validate the chosen value
      if (mapping.validator && mergedData[field]) {
        const isValid = mapping.validator(mergedData[field]);
        if (!isValid) {
          if (this.debug) console.warn(`Field ${field} failed validation:`, mergedData[field]);
          // Try the alternative source if validation fails
          const altValue = visionConfidence > domConfidence ? domValue : visionValue;
          if (altValue && mapping.validator(altValue)) {
            mergedData[field] = altValue;
            mergedData[`${field}_source`] = visionConfidence > domConfidence ? 'dom' : 'vision';
          }
        }
      }
    });

    // Add vision-specific fields
    if (visionData.colors) mergedData.colors = visionData.colors;
    if (visionData.materials) mergedData.materials = visionData.materials;
    if (visionData.qualityAssessment) mergedData.qualityAssessment = visionData.qualityAssessment;
    if (visionData.useCase) mergedData.useCase = visionData.useCase;

    return mergedData;
  }

  // Get value from data source based on field mapping
  getValueFromSource(data, fieldNames) {
    for (const fieldName of fieldNames) {
      if (data[fieldName]) {
        return data[fieldName];
      }
    }
    return null;
  }

  // Calculate confidence score for a specific field
  calculateFieldConfidence(value, source, field) {
    if (!value) return 0;

    let confidence = 0.5; // Base confidence
    
    // Source-specific confidence adjustments
    if (source === 'vision') {
      confidence += 0.2; // Vision generally more reliable for semantic understanding
    } else {
      confidence += 0.1; // DOM is reliable but more brittle
    }

    // Field-specific confidence adjustments
    const fieldWeight = this.fieldMapping[field]?.weight || 0.5;
    confidence *= fieldWeight;

    // Content quality scoring
    if (typeof value === 'string') {
      // Length-based scoring
      if (field === 'productName' && value.length > 5 && value.length < 100) confidence += 0.1;
      if (field === 'productDescription' && value.length > 20 && value.length < 1000) confidence += 0.1;
      
      // Pattern-based scoring
      if (field === 'price' && value.match(/[\$€£¥]\d+/)) confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  // Validate and enhance final merged data
  async validateAndEnhance(data) {
    // Clean up data
    Object.keys(data).forEach(key => {
      if (typeof data[key] === 'string') {
        data[key] = data[key].trim();
      }
    });

    // Add computed fields
    data.extractionMethod = 'synchronized';
    data.overallConfidence = this.calculateOverallConfidence(data);
    data.qualityScore = this.calculateQualityScore(data);

    return data;
  }

  // Calculate overall confidence score
  calculateOverallConfidence(data) {
    const confidenceFields = Object.keys(data).filter(key => key.endsWith('_confidence'));
    if (confidenceFields.length === 0) return data.confidence || 0.5;

    const avgConfidence = confidenceFields.reduce((sum, field) => sum + (data[field] || 0), 0) / confidenceFields.length;
    return Math.round(avgConfidence * 100) / 100;
  }

  // Calculate data quality score
  calculateQualityScore(data) {
    let score = 0;
    let maxScore = 0;

    // Score based on field completeness and quality
    const criticalFields = ['productName', 'productDescription', 'price'];
    const optionalFields = ['vendorName', 'tags', 'materials', 'colors'];

    criticalFields.forEach(field => {
      maxScore += 20;
      if (data[field] && data[field].length > 5) {
        score += 20;
        if (data[`${field}_confidence`] > 0.8) score += 5;
      }
    });

    optionalFields.forEach(field => {
      maxScore += 10;
      if (data[field] && (Array.isArray(data[field]) ? data[field].length > 0 : data[field].length > 0)) {
        score += 10;
      }
    });

    return Math.round((score / maxScore) * 100);
  }

  // Validation methods
  validateProductName(name) {
    if (!name || typeof name !== 'string') return false;
    return name.length >= 3 && name.length <= 200 && !/^(undefined|null|N\/A)$/i.test(name);
  }

  validateDescription(description) {
    if (!description || typeof description !== 'string') return false;
    return description.length >= 10 && description.length <= 5000;
  }

  validatePrice(price) {
    if (!price || typeof price !== 'string') return false;
    return /[\$€£¥]\d+|\d+\.\d{2}/.test(price);
  }

  validateVendor(vendor) {
    if (!vendor || typeof vendor !== 'string') return false;
    return vendor.length >= 2 && vendor.length <= 100;
  }

  validateFeatures(features) {
    if (!Array.isArray(features)) return false;
    return features.length > 0 && features.every(f => typeof f === 'string' && f.length > 0);
  }

  validateMaterials(materials) {
    if (!Array.isArray(materials)) return false;
    return materials.every(m => typeof m === 'string' && m.length > 0);
  }

  validateColors(colors) {
    if (!Array.isArray(colors)) return false;
    return colors.every(c => typeof c === 'string' && c.length > 0);
  }

  // Utility method for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use in Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataSynchronizer;
} else if (typeof window !== 'undefined') {
  window.DataSynchronizer = DataSynchronizer;
}
