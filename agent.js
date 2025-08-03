// OpenAI Vision Agent for Product Description Generation
class ProductVisionAgent {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1';
    this.model = 'gpt-4-vision-preview';
    this.maxTokens = 500;
  }

  // Analyze screenshot and generate product description
  async analyzeProductImage(imageData, context = {}) {
    try {
      const prompt = this.buildPrompt(context);
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: this.maxTokens,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`);
      }

      const result = await response.json();
      const content = result.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      return this.parseResponse(content);
      
    } catch (error) {
      console.error('Product Vision Agent Error:', error);
      return {
        success: false,
        error: error.message,
        generatedAt: new Date().toISOString()
      };
    }
  }

  // Build context-aware prompt for product analysis
  buildPrompt(context = {}) {
    const { productName, existingDescription, productType } = context;
    
    let prompt = `Analyze this product image and generate a comprehensive product description. Focus on:

1. **Product Identification**: What is the main product shown?
2. **Visual Features**: Colors, materials, design elements, size/scale indicators
3. **Key Selling Points**: Unique features that would appeal to customers
4. **Use Cases**: How and where this product would be used
5. **Quality Indicators**: Build quality, finish, craftsmanship visible in the image

Please provide the response in this JSON format:
{
  "title": "Product title based on visual analysis",
  "description": "Detailed product description (2-3 paragraphs)",
  "keyFeatures": ["feature1", "feature2", "feature3"],
  "materials": ["material1", "material2"],
  "colors": ["color1", "color2"],
  "estimatedSize": "size estimate based on visual cues",
  "useCase": "primary use case or target audience",
  "qualityAssessment": "assessment of visible quality/craftsmanship",
  "confidence": 0.95
}`;

    if (productName) {
      prompt += `\n\nExisting product name: "${productName}"`;
    }
    
    if (existingDescription) {
      prompt += `\n\nExisting description: "${existingDescription}"`;
      prompt += `\n\nPlease enhance and expand upon the existing information.`;
    }
    
    if (productType) {
      prompt += `\n\nProduct category: ${productType}`;
    }

    return prompt;
  }

  // Parse and validate the AI response
  parseResponse(content) {
    try {
      // Try to extract JSON from the response
      let jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        // Fallback: create structured response from text
        return {
          success: true,
          title: 'AI-Generated Product Analysis',
          description: content,
          keyFeatures: [],
          materials: [],
          colors: [],
          estimatedSize: '',
          useCase: '',
          qualityAssessment: '',
          confidence: 0.7,
          generatedAt: new Date().toISOString(),
          rawResponse: content
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        ...parsed,
        generatedAt: new Date().toISOString(),
        rawResponse: content
      };
      
    } catch (error) {
      console.error('Error parsing AI response:', error);
      
      return {
        success: true,
        title: 'AI-Generated Product Analysis',
        description: content,
        keyFeatures: [],
        materials: [],
        colors: [],
        estimatedSize: '',
        useCase: '',
        qualityAssessment: '',
        confidence: 0.5,
        generatedAt: new Date().toISOString(),
        rawResponse: content,
        parseError: error.message
      };
    }
  }

  // Capture screenshot of current page
  async captureScreenshot() {
    try {
      // Use Chrome extension API to capture screenshot
      return new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 90 }, (dataUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(dataUrl);
          }
        });
      });
    } catch (error) {
      throw new Error(`Screenshot capture failed: ${error.message}`);
    }
  }

  // Analyze current product page with screenshot
  async analyzeCurrentPage(existingMetadata = {}) {
    try {
      const screenshot = await this.captureScreenshot();
      
      const context = {
        productName: existingMetadata.productName,
        existingDescription: existingMetadata.productDescription,
        productType: existingMetadata.tags?.[0] // Use first tag as product type hint
      };
      
      const analysis = await this.analyzeProductImage(screenshot, context);
      
      return {
        ...analysis,
        screenshot: screenshot,
        context: context
      };
      
    } catch (error) {
      console.error('Page analysis failed:', error);
      return {
        success: false,
        error: error.message,
        generatedAt: new Date().toISOString()
      };
    }
  }
}

// Export for use in Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductVisionAgent;
} else if (typeof window !== 'undefined') {
  window.ProductVisionAgent = ProductVisionAgent;
}
